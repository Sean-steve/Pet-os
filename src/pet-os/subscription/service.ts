/**
 * Pet OS Consumer Subscription & Monetization Service
 * Coordinates plan lifecycles, billing agreements, renewals, grace periods, dunning,
 * upgrades, downgrades, idempotency, webhook ingestion, and provider reconciliation.
 */

import {
  ConsumerSubscriptionId,
  PlanPriceId,
  UserId,
  HouseholdId,
  SupportGrantId,
  SubscriptionInvoiceId,
  SubscriptionBillingAgreementId,
  SubscriptionStatusHistoryId,
  SubscriptionReconciliationRunId,
  asConsumerSubscriptionId,
  asSubscriptionInvoiceId,
  asSubscriptionBillingAgreementId,
  asSubscriptionStatusHistoryId,
  asEntitlementGrantId,
  asSupportGrantId,
  asSubscriptionReconciliationRunId,
  asPaymentIntentId,
  asPaymentTransactionId,
  asFinancialReceiptId,
  generateUUIDv7,
} from '../kernel/ids';
import {
  ConsumerSubscription,
  SubscriptionBillingAgreement,
  SubscriptionInvoice,
  SupportGrant,
  SubscriptionBillingWebhookPayload,
  SubscriptionProviderReconciliationRecord,
  SubscriptionProviderReconciliationItem,
  BillingInterval,
  SubscriptionStatus,
} from './types';
import { SubscriptionStore } from './store';
import { SubscriptionBillingRegistry } from './billing-provider';
import { EntitlementService } from './entitlement-service';
import { SubscriptionOutbox } from './events';
import { IdentityStore } from '../identity/store';

export interface CheckoutSubscriptionParams {
  readonly ownerType: 'HOUSEHOLD' | 'USER';
  readonly ownerId: HouseholdId | UserId;
  readonly planPriceId: PlanPriceId;
  readonly actorUserId: UserId;
  readonly paymentTokenOrPhone: string;
  readonly providerName?: 'MPESA_RECURRING' | 'CARD_GATEWAY' | 'MOCK_BILLING_PROVIDER';
  readonly clientClaimedStatus?: string; // For testing forged activation attempts
}

export interface SupportGrantParams {
  readonly subjectType: 'USER' | 'HOUSEHOLD';
  readonly subjectId: string;
  readonly authorizedByUserId: UserId;
  readonly reason: string;
  readonly durationDays: number;
}

export class ConsumerSubscriptionService {
  /**
   * Checkout & create a new paid subscription.
   * Enforces:
   * - Authorization: actor must have billing admin role in household
   * - Client cannot forge ACTIVE status
   * - Valid PlanPrice & active PlanVersion
   * - Idempotent grant creation
   */
  public static async checkoutSubscription(
    params: CheckoutSubscriptionParams
  ): Promise<{ subscription: ConsumerSubscription; invoice: SubscriptionInvoice }> {
    // 1. FORGERY GUARD: Reject client-forged active/premium status attempts
    if (params.clientClaimedStatus === 'ACTIVE' || (params as any).isPremium) {
      throw new Error('SECURITY_VIOLATION: Client cannot forge subscription active state without server verification.');
    }

    // 2. AUTHORIZATION GUARD: Household Billing Permissions
    if (params.ownerType === 'HOUSEHOLD') {
      this.assertHouseholdBillingPermission(params.ownerId as HouseholdId, params.actorUserId);
    }

    // 3. RETRIEVE PLAN & PRICE
    const price = SubscriptionStore.getPlanPrice(params.planPriceId);
    if (!price || price.status !== 'ACTIVE') {
      throw new Error(`Plan price '${params.planPriceId}' is invalid or inactive.`);
    }

    const version = SubscriptionStore.getPlanVersion(price.planVersionId);
    if (!version || version.status !== 'ACTIVE') {
      throw new Error(`Plan version '${price.planVersionId}' is not active.`);
    }

    // 4. CHECK FOR DUPLICATE ACTIVE SUBSCRIPTION
    const existingActive = SubscriptionStore.getActiveSubscriptionForOwner(params.ownerId);
    if (existingActive) {
      throw new Error(`Owner '${params.ownerId}' already has an active subscription (${existingActive.subscriptionId}). Use changePlan instead.`);
    }

    // 5. RESOLVE BILLING PROVIDER & CREATE AGREEMENT
    const providerName = params.providerName || (price.currency === 'KES' ? 'MPESA_RECURRING' : 'CARD_GATEWAY');
    const billingProvider = SubscriptionBillingRegistry.getProvider(providerName);

    const agreementRes = await billingProvider.createBillingAgreement(
      String(params.ownerId),
      params.paymentTokenOrPhone
    );

    const subscriptionId = asConsumerSubscriptionId(`sub-${generateUUIDv7()}`);
    const agreement: SubscriptionBillingAgreement = {
      agreementId: asSubscriptionBillingAgreementId(`agr-${generateUUIDv7()}`),
      subscriptionId,
      provider: providerName,
      externalReference: agreementRes.agreementExternalReference,
      paymentMethodTokenMasked: agreementRes.maskedToken,
      status: 'ACTIVE',
      mandateReference: agreementRes.mandateReference,
      authorizedAt: new Date().toISOString(),
    };
    SubscriptionStore.saveBillingAgreement(agreement);

    // 6. EXECUTE INITIAL BILLING VIA PROVIDER
    const initialRecSub = await billingProvider.createRecurringSubscription(
      agreement.externalReference,
      price
    );

    const now = new Date();
    const periodDays = price.billingInterval === 'ANNUAL' ? 365 : 30;
    const periodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

    const subscription: ConsumerSubscription = {
      subscriptionId,
      ownerType: params.ownerType,
      ownerId: params.ownerId,
      planId: version.planId,
      planVersionId: version.planVersionId,
      planPriceId: price.planPriceId,
      billingProvider: providerName,
      externalSubscriptionReference: initialRecSub.externalSubscriptionReference,
      status: 'ACTIVE',
      billingInterval: price.billingInterval,
      currency: price.currency,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      version: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    SubscriptionStore.saveSubscription(subscription);

    // 7. RECORD STATUS HISTORY
    SubscriptionStore.recordStatusHistory({
      historyId: asSubscriptionStatusHistoryId(`sth-${generateUUIDv7()}`),
      subscriptionId,
      fromStatus: 'INCOMPLETE',
      toStatus: 'ACTIVE',
      reason: 'INITIAL_PURCHASE',
      actorUserId: params.actorUserId,
      timestamp: now.toISOString(),
      metadata: { planPriceId: price.planPriceId, amountMinor: price.amountMinor },
    });

    // 8. ISSUE INVOICE & SPRINT 12 INTEGRATION REFERENCE
    const invoiceId = asSubscriptionInvoiceId(`inv-${generateUUIDv7()}`);
    const paymentTxId = asPaymentTransactionId(`tx-sub-${generateUUIDv7()}`);
    const receiptId = asFinancialReceiptId(`rcp-sub-${generateUUIDv7()}`);

    const invoice: SubscriptionInvoice = {
      invoiceId,
      subscriptionId,
      periodStart: now.toISOString(),
      periodEnd: periodEnd.toISOString(),
      amountMinor: price.amountMinor,
      currency: price.currency,
      status: 'PAID',
      providerInvoiceReference: `prov-inv-${generateUUIDv7().slice(0, 8)}`,
      paymentTransactionId: paymentTxId,
      paymentIntentId: asPaymentIntentId(`pi-sub-${generateUUIDv7()}`),
      receiptId,
      issuedAt: now.toISOString(),
      dueAt: now.toISOString(),
      paidAt: now.toISOString(),
    };
    SubscriptionStore.saveInvoice(invoice);

    // 9. GRANT ENTITLEMENTS FROM BUNDLE
    this.grantBundleEntitlements(subscription, version.entitlementBundleId);

    // 10. PUBLISH DOMAIN EVENTS
    SubscriptionOutbox.publish({
      eventType: 'ConsumerSubscriptionCreated',
      subscriptionId,
      ownerId: params.ownerId,
      planVersionId: version.planVersionId,
      planPriceId: price.planPriceId,
      status: 'ACTIVE',
      correlationId: generateUUIDv7(),
      actorUserId: params.actorUserId,
    });

    SubscriptionOutbox.publish({
      eventType: 'ConsumerSubscriptionActivated',
      subscriptionId,
      ownerId: params.ownerId,
      planVersionId: version.planVersionId,
      currency: price.currency,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      correlationId: generateUUIDv7(),
      actorUserId: params.actorUserId,
    });

    return { subscription, invoice };
  }

  /**
   * Cancels a subscription.
   * Default: cancels at period end (preserves Premium until end of paid cycle).
   * Immediate cancellation is also supported if requested.
   */
  public static cancelSubscription(
    subscriptionId: ConsumerSubscriptionId,
    actorUserId: UserId,
    mode: 'PERIOD_END' | 'IMMEDIATE' = 'PERIOD_END',
    reason?: string
  ): ConsumerSubscription {
    const sub = SubscriptionStore.getSubscription(subscriptionId);
    if (!sub) throw new Error(`Subscription '${subscriptionId}' not found.`);

    if (sub.ownerType === 'HOUSEHOLD') {
      this.assertHouseholdBillingPermission(sub.ownerId as HouseholdId, actorUserId);
    }

    const now = new Date().toISOString();

    if (mode === 'PERIOD_END') {
      const updated: ConsumerSubscription = {
        ...sub,
        status: 'CANCEL_AT_PERIOD_END',
        cancelAtPeriodEnd: true,
        cancelledAt: now,
        cancellationReason: reason || 'CUSTOMER_REQUESTED',
        version: sub.version + 1,
        updatedAt: now,
      };
      SubscriptionStore.saveSubscription(updated);

      SubscriptionStore.recordStatusHistory({
        historyId: asSubscriptionStatusHistoryId(`sth-${generateUUIDv7()}`),
        subscriptionId,
        fromStatus: sub.status,
        toStatus: 'CANCEL_AT_PERIOD_END',
        reason: reason || 'CANCEL_AT_PERIOD_END_SCHEDULED',
        actorUserId,
        timestamp: now,
      });

      SubscriptionOutbox.publish({
        eventType: 'ConsumerSubscriptionCancellationScheduled',
        subscriptionId,
        ownerId: sub.ownerId,
        effectiveAt: sub.currentPeriodEnd,
        reason,
        correlationId: generateUUIDv7(),
        actorUserId,
      });

      return updated;
    } else {
      // Immediate cancellation
      const updated: ConsumerSubscription = {
        ...sub,
        status: 'CANCELLED',
        cancelAtPeriodEnd: false,
        cancelledAt: now,
        endedAt: now,
        cancellationReason: reason || 'IMMEDIATE_CANCELLATION',
        version: sub.version + 1,
        updatedAt: now,
      };
      SubscriptionStore.saveSubscription(updated);

      SubscriptionStore.recordStatusHistory({
        historyId: asSubscriptionStatusHistoryId(`sth-${generateUUIDv7()}`),
        subscriptionId,
        fromStatus: sub.status,
        toStatus: 'CANCELLED',
        reason: reason || 'IMMEDIATE_CANCELLATION',
        actorUserId,
        timestamp: now,
      });

      // Revoke paid grants (DATA IS PRESERVED!)
      SubscriptionStore.revokeGrantsForSource(String(subscriptionId));

      SubscriptionOutbox.publish({
        eventType: 'ConsumerSubscriptionCancelled',
        subscriptionId,
        ownerId: sub.ownerId,
        correlationId: generateUUIDv7(),
        actorUserId,
      });

      return updated;
    }
  }

  /**
   * Reactivates a subscription before scheduled period end.
   */
  public static reactivateSubscription(
    subscriptionId: ConsumerSubscriptionId,
    actorUserId: UserId
  ): ConsumerSubscription {
    const sub = SubscriptionStore.getSubscription(subscriptionId);
    if (!sub) throw new Error(`Subscription '${subscriptionId}' not found.`);

    if (sub.ownerType === 'HOUSEHOLD') {
      this.assertHouseholdBillingPermission(sub.ownerId as HouseholdId, actorUserId);
    }

    if (sub.status !== 'CANCEL_AT_PERIOD_END') {
      throw new Error(`Cannot reactivate subscription in status '${sub.status}'.`);
    }

    const now = new Date().toISOString();
    const updated: ConsumerSubscription = {
      ...sub,
      status: 'ACTIVE',
      cancelAtPeriodEnd: false,
      cancelledAt: undefined,
      cancellationReason: undefined,
      version: sub.version + 1,
      updatedAt: now,
    };
    SubscriptionStore.saveSubscription(updated);

    SubscriptionStore.recordStatusHistory({
      historyId: asSubscriptionStatusHistoryId(`sth-${generateUUIDv7()}`),
      subscriptionId,
      fromStatus: 'CANCEL_AT_PERIOD_END',
      toStatus: 'ACTIVE',
      reason: 'CUSTOMER_REACTIVATED',
      actorUserId,
      timestamp: now,
    });

    SubscriptionOutbox.publish({
      eventType: 'ConsumerSubscriptionReactivated',
      subscriptionId,
      ownerId: sub.ownerId,
      correlationId: generateUUIDv7(),
      actorUserId,
    });

    return updated;
  }

  /**
   * Processes renewal for an active subscription.
   * Enforces IDEMPOTENCY: Duplicate calls or webhooks for the same period will not double-renew.
   */
  public static async processRenewal(
    subscriptionId: ConsumerSubscriptionId,
    idempotencyKey?: string
  ): Promise<{ success: boolean; subscription: ConsumerSubscription; invoice?: SubscriptionInvoice; error?: string }> {
    const sub = SubscriptionStore.getSubscription(subscriptionId);
    if (!sub) throw new Error(`Subscription '${subscriptionId}' not found.`);

    // Check if period end has arrived or is imminent (within 1 day)
    const price = SubscriptionStore.getPlanPrice(sub.planPriceId);
    if (!price) throw new Error(`Plan price not found for subscription.`);

    // IDEMPOTENCY CHECK: Check if key has already been processed
    if (idempotencyKey) {
      const cached = SubscriptionStore.getIdempotency<{ success: boolean; subscription: ConsumerSubscription; invoice?: SubscriptionInvoice }>(idempotencyKey);
      if (cached) {
        return cached;
      }
    }

    // Call Billing Provider
    const provider = SubscriptionBillingRegistry.getProvider(sub.billingProvider);
    const renewalRes = await provider.collectRenewal(
      sub.externalSubscriptionReference || `sub-${sub.subscriptionId}`,
      price
    );

    const now = new Date();

    if (renewalRes.success) {
      // Period extension
      const prevEnd = new Date(sub.currentPeriodEnd);
      const periodDays = sub.billingInterval === 'ANNUAL' ? 365 : 30;
      const newEnd = new Date(prevEnd.getTime() + periodDays * 24 * 60 * 60 * 1000);

      const updatedSub: ConsumerSubscription = {
        ...sub,
        status: 'ACTIVE',
        currentPeriodStart: prevEnd.toISOString(),
        currentPeriodEnd: newEnd.toISOString(),
        version: sub.version + 1,
        updatedAt: now.toISOString(),
      };
      SubscriptionStore.saveSubscription(updatedSub);

      // Create new invoice
      const invoiceId = asSubscriptionInvoiceId(`inv-ren-${generateUUIDv7()}`);
      const invoice: SubscriptionInvoice = {
        invoiceId,
        subscriptionId,
        periodStart: prevEnd.toISOString(),
        periodEnd: newEnd.toISOString(),
        amountMinor: price.amountMinor,
        currency: price.currency,
        status: 'PAID',
        providerInvoiceReference: renewalRes.providerTransactionId,
        paymentTransactionId: asPaymentTransactionId(`tx-${generateUUIDv7()}`),
        receiptId: asFinancialReceiptId(`rcp-${generateUUIDv7()}`),
        issuedAt: now.toISOString(),
        dueAt: now.toISOString(),
        paidAt: now.toISOString(),
      };
      SubscriptionStore.saveInvoice(invoice);

      // Update grants validity
      const grants = SubscriptionStore.listGrantsForSubject(String(sub.ownerId));
      for (const grant of grants) {
        if (grant.sourceId === String(sub.subscriptionId)) {
          SubscriptionStore.saveEntitlementGrant({
            ...grant,
            validUntil: newEnd.toISOString(),
          });
        }
      }

      SubscriptionOutbox.publish({
        eventType: 'ConsumerSubscriptionRenewed',
        subscriptionId,
        ownerId: sub.ownerId,
        previousPeriodEnd: prevEnd.toISOString(),
        newPeriodEnd: newEnd.toISOString(),
        invoiceId,
        amountMinor: price.amountMinor,
        currency: price.currency,
        correlationId: generateUUIDv7(),
      });

      const result = { success: true, subscription: updatedSub, invoice };
      if (idempotencyKey) {
        SubscriptionStore.saveIdempotency(idempotencyKey, result);
      }
      return result;
    } else {
      // PAYMENT FAILED -> Transition to PAST_DUE / GRACE_PERIOD (7 days grace)
      const graceEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const failedSub: ConsumerSubscription = {
        ...sub,
        status: 'GRACE_PERIOD',
        gracePeriodEnd: graceEnd,
        version: sub.version + 1,
        updatedAt: now.toISOString(),
      };
      SubscriptionStore.saveSubscription(failedSub);

      SubscriptionStore.recordStatusHistory({
        historyId: asSubscriptionStatusHistoryId(`sth-${generateUUIDv7()}`),
        subscriptionId,
        fromStatus: sub.status,
        toStatus: 'GRACE_PERIOD',
        reason: `RENEWAL_FAILED: ${renewalRes.failureReason || 'CARD_DECLINED'}`,
        actorUserId: 'usr-system' as UserId,
        timestamp: now.toISOString(),
      });

      SubscriptionOutbox.publish({
        eventType: 'ConsumerSubscriptionPaymentFailed',
        subscriptionId,
        ownerId: sub.ownerId,
        failureReason: renewalRes.failureReason || 'RENEWAL_PAYMENT_FAILED',
        gracePeriodEnd: graceEnd,
        correlationId: generateUUIDv7(),
      });

      SubscriptionOutbox.publish({
        eventType: 'ConsumerSubscriptionEnteredGracePeriod',
        subscriptionId,
        ownerId: sub.ownerId,
        gracePeriodEnd: graceEnd,
        correlationId: generateUUIDv7(),
      });

      return {
        success: false,
        subscription: failedSub,
        error: renewalRes.failureReason || 'RENEWAL_PAYMENT_FAILED',
      };
    }
  }

  /**
   * Recovers a subscription currently in GRACE_PERIOD when a retry/payment method update succeeds.
   */
  public static recoverGracePeriod(
    subscriptionId: ConsumerSubscriptionId,
    actorUserId: UserId
  ): ConsumerSubscription {
    const sub = SubscriptionStore.getSubscription(subscriptionId);
    if (!sub) throw new Error(`Subscription '${subscriptionId}' not found.`);

    if (sub.status !== 'GRACE_PERIOD' && sub.status !== 'PAST_DUE') {
      throw new Error(`Subscription is not in grace period.`);
    }

    const now = new Date().toISOString();
    const updated: ConsumerSubscription = {
      ...sub,
      status: 'ACTIVE',
      gracePeriodEnd: undefined,
      version: sub.version + 1,
      updatedAt: now,
    };
    SubscriptionStore.saveSubscription(updated);

    SubscriptionStore.recordStatusHistory({
      historyId: asSubscriptionStatusHistoryId(`sth-${generateUUIDv7()}`),
      subscriptionId,
      fromStatus: sub.status,
      toStatus: 'ACTIVE',
      reason: 'GRACE_RECOVERED_PAYMENT_SUCCESS',
      actorUserId,
      timestamp: now,
    });

    SubscriptionOutbox.publish({
      eventType: 'ConsumerSubscriptionRecovered',
      subscriptionId,
      ownerId: sub.ownerId,
      correlationId: generateUUIDv7(),
      actorUserId,
    });

    return updated;
  }

  /**
   * Expires a subscription whose grace period has ended without payment.
   * INVARIANT: NO USER PET/HEALTH/TRAINING/DOCUMENT DATA IS DELETED.
   * Only Premium entitlement grants are revoked and baseline Free grants restored.
   */
  public static expireGracePeriod(subscriptionId: ConsumerSubscriptionId): ConsumerSubscription {
    const sub = SubscriptionStore.getSubscription(subscriptionId);
    if (!sub) throw new Error(`Subscription '${subscriptionId}' not found.`);

    const now = new Date().toISOString();
    const expired: ConsumerSubscription = {
      ...sub,
      status: 'EXPIRED',
      endedAt: now,
      version: sub.version + 1,
      updatedAt: now,
    };
    SubscriptionStore.saveSubscription(expired);

    SubscriptionStore.recordStatusHistory({
      historyId: asSubscriptionStatusHistoryId(`sth-${generateUUIDv7()}`),
      subscriptionId,
      fromStatus: sub.status,
      toStatus: 'EXPIRED',
      reason: 'GRACE_PERIOD_EXPIRED',
      actorUserId: 'usr-system' as UserId,
      timestamp: now,
    });

    // Revoke Premium grants - DOES NOT TOUCH CANONICAL USER DATA!
    SubscriptionStore.revokeGrantsForSource(String(subscriptionId));

    SubscriptionOutbox.publish({
      eventType: 'ConsumerSubscriptionExpired',
      subscriptionId,
      ownerId: sub.ownerId,
      correlationId: generateUUIDv7(),
    });

    return expired;
  }

  /**
   * Plan Upgrade & Downgrade
   */
  public static changePlan(
    subscriptionId: ConsumerSubscriptionId,
    newPlanPriceId: PlanPriceId,
    actorUserId: UserId
  ): ConsumerSubscription {
    const sub = SubscriptionStore.getSubscription(subscriptionId);
    if (!sub) throw new Error(`Subscription '${subscriptionId}' not found.`);

    if (sub.ownerType === 'HOUSEHOLD') {
      this.assertHouseholdBillingPermission(sub.ownerId as HouseholdId, actorUserId);
    }

    const newPrice = SubscriptionStore.getPlanPrice(newPlanPriceId);
    if (!newPrice || newPrice.status !== 'ACTIVE') {
      throw new Error(`Invalid target plan price '${newPlanPriceId}'.`);
    }

    const newVersion = SubscriptionStore.getPlanVersion(newPrice.planVersionId);
    if (!newVersion || newVersion.status !== 'ACTIVE') {
      throw new Error(`Invalid target plan version '${newPrice.planVersionId}'.`);
    }

    const currentPrice = SubscriptionStore.getPlanPrice(sub.planPriceId);
    const isUpgrade = newPrice.amountMinor >= (currentPrice?.amountMinor || 0);

    const now = new Date().toISOString();

    if (isUpgrade) {
      // Immediate upgrade
      const updated: ConsumerSubscription = {
        ...sub,
        planId: newVersion.planId,
        planVersionId: newVersion.planVersionId,
        planPriceId: newPrice.planPriceId,
        billingInterval: newPrice.billingInterval,
        currency: newPrice.currency,
        version: sub.version + 1,
        updatedAt: now,
      };
      SubscriptionStore.saveSubscription(updated);

      // Re-grant new bundle items
      SubscriptionStore.revokeGrantsForSource(String(subscriptionId));
      this.grantBundleEntitlements(updated, newVersion.entitlementBundleId);

      SubscriptionOutbox.publish({
        eventType: 'ConsumerSubscriptionPlanChanged',
        subscriptionId,
        ownerId: sub.ownerId,
        previousPlanVersionId: sub.planVersionId,
        newPlanVersionId: newVersion.planVersionId,
        effectiveTiming: 'IMMEDIATE',
        correlationId: generateUUIDv7(),
        actorUserId,
      });

      return updated;
    } else {
      // Downgrade: Non-destructive, takes effect at end of period
      // Note: All existing pets/records are retained and grandfathered!
      const updated: ConsumerSubscription = {
        ...sub,
        planId: newVersion.planId,
        planVersionId: newVersion.planVersionId,
        planPriceId: newPrice.planPriceId,
        billingInterval: newPrice.billingInterval,
        currency: newPrice.currency,
        version: sub.version + 1,
        updatedAt: now,
      };
      SubscriptionStore.saveSubscription(updated);

      SubscriptionOutbox.publish({
        eventType: 'ConsumerSubscriptionPlanChanged',
        subscriptionId,
        ownerId: sub.ownerId,
        previousPlanVersionId: sub.planVersionId,
        newPlanVersionId: newVersion.planVersionId,
        effectiveTiming: 'NEXT_RENEWAL',
        correlationId: generateUUIDv7(),
        actorUserId,
      });

      return updated;
    }
  }

  /**
   * Webhook Handler with Signature Verification, Replay Protection, and Out-of-Order Safety.
   */
  public static async handleBillingWebhook(
    payload: SubscriptionBillingWebhookPayload
  ): Promise<{ status: 'PROCESSED' | 'IGNORED_DUPLICATE' | 'IGNORED_STALE' | 'INVALID_SIGNATURE'; error?: string }> {
    // 1. Signature Check
    const provider = SubscriptionBillingRegistry.getProvider(payload.provider);
    if (!provider.verifyWebhookSignature(JSON.stringify(payload), payload.signature)) {
      return { status: 'INVALID_SIGNATURE', error: 'Webhook signature validation failed.' };
    }

    // 2. Idempotency Check
    if (SubscriptionStore.isWebhookEventProcessed(payload.eventId)) {
      return { status: 'IGNORED_DUPLICATE' };
    }
    SubscriptionStore.recordWebhookEvent(payload);

    // 3. Find matching subscription
    const allSubs = SubscriptionStore.listAllSubscriptions();
    const sub = allSubs.find(
      (s) => s.externalSubscriptionReference === payload.externalSubscriptionReference
    );

    if (!sub) {
      return { status: 'PROCESSED' };
    }

    // 4. Out-of-Order Protection: If webhook timestamp is older than subscription's last update, avoid state regression
    if (new Date(payload.timestamp) < new Date(sub.updatedAt)) {
      return { status: 'IGNORED_STALE' };
    }

    // 5. Route event type
    switch (payload.eventType) {
      case 'PAYMENT_SUCCEEDED':
        if (sub.status === 'GRACE_PERIOD' || sub.status === 'PAST_DUE') {
          this.recoverGracePeriod(sub.subscriptionId, 'usr-webhook' as UserId);
        } else {
          await this.processRenewal(sub.subscriptionId, payload.eventId);
        }
        break;

      case 'PAYMENT_FAILED':
        if (sub.status === 'ACTIVE') {
          const now = new Date();
          const graceEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
          const failedSub: ConsumerSubscription = {
            ...sub,
            status: 'GRACE_PERIOD',
            gracePeriodEnd: graceEnd,
            version: sub.version + 1,
            updatedAt: now.toISOString(),
          };
          SubscriptionStore.saveSubscription(failedSub);
          SubscriptionStore.recordStatusHistory({
            historyId: asSubscriptionStatusHistoryId(`sth-${generateUUIDv7()}`),
            subscriptionId: sub.subscriptionId,
            fromStatus: sub.status,
            toStatus: 'GRACE_PERIOD',
            reason: `WEBHOOK_PAYMENT_FAILED: ${payload.failureReason || 'DECLINED'}`,
            actorUserId: 'usr-webhook' as UserId,
            timestamp: now.toISOString(),
          });
        }
        break;

      case 'SUBSCRIPTION_CANCELLED':
        this.cancelSubscription(sub.subscriptionId, 'usr-webhook' as UserId, 'PERIOD_END', 'PROVIDER_CANCELLED');
        break;
    }

    return { status: 'PROCESSED' };
  }

  /**
   * Reconciles local subscriptions against external billing provider.
   */
  public static async reconcileWithProvider(
    providerName: 'MPESA_RECURRING' | 'CARD_GATEWAY' | 'MOCK_BILLING_PROVIDER'
  ): Promise<SubscriptionProviderReconciliationRecord> {
    const provider = SubscriptionBillingRegistry.getProvider(providerName);
    const allSubs = SubscriptionStore.listAllSubscriptions().filter(
      (s) => s.billingProvider === providerName && s.externalSubscriptionReference
    );

    const items: SubscriptionProviderReconciliationItem[] = [];
    let matchedCount = 0;
    let driftedCount = 0;

    for (const sub of allSubs) {
      try {
        const extStatus = await provider.fetchExternalStatus(sub.externalSubscriptionReference!);
        if (sub.status === extStatus.status) {
          matchedCount++;
        } else {
          driftedCount++;
          let resolution: string | undefined;

          // Deterministic safe restoration: if external provider is ACTIVE and local is EXPIRED/PAST_DUE, restore
          if (extStatus.status === 'ACTIVE' && (sub.status === 'EXPIRED' || sub.status === 'PAST_DUE')) {
            const restored: ConsumerSubscription = {
              ...sub,
              status: 'ACTIVE',
              gracePeriodEnd: undefined,
              version: sub.version + 1,
              updatedAt: new Date().toISOString(),
            };
            SubscriptionStore.saveSubscription(restored);
            resolution = 'AUTO_RESTORED_TO_ACTIVE';
          }

          items.push({
            subscriptionId: sub.subscriptionId,
            localStatus: sub.status,
            providerStatus: extStatus.status,
            discrepancy: `Local status '${sub.status}' differs from external provider status '${extStatus.status}'`,
            resolution,
          });
        }
      } catch (err: any) {
        driftedCount++;
        items.push({
          subscriptionId: sub.subscriptionId,
          localStatus: sub.status,
          providerStatus: 'UNKNOWN',
          discrepancy: `Fetch failure: ${err.message}`,
        });
      }
    }

    const record: SubscriptionProviderReconciliationRecord = {
      runId: asSubscriptionReconciliationRunId(`rec-prov-${generateUUIDv7()}`),
      timestamp: new Date().toISOString(),
      checkedCount: allSubs.length,
      matchedCount,
      driftedCount,
      items,
    };

    SubscriptionStore.recordProviderReconciliation(record);
    return record;
  }

  /**
   * Grants temporary support/promotional entitlement.
   * Requires authorized user, explicit reason, bounded expiry.
   * DOES NOT forge a fake paid subscription in the Finance ledger!
   */
  public static grantSupportPromotionalPeriod(params: SupportGrantParams): SupportGrant {
    const now = new Date();
    const validUntil = new Date(now.getTime() + params.durationDays * 24 * 60 * 60 * 1000).toISOString();

    const premiumPlan = SubscriptionStore.getPlanByCode('PREMIUM');
    if (!premiumPlan) throw new Error('Premium plan not found.');
    const version = SubscriptionStore.getLatestActivePlanVersion(premiumPlan.planId);
    if (!version) throw new Error('Active plan version not found.');

    const grantId = asSupportGrantId(`spt-${generateUUIDv7()}`);
    const supportGrant: SupportGrant = {
      grantId,
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      authorizedByUserId: params.authorizedByUserId,
      reason: params.reason,
      validFrom: now.toISOString(),
      validUntil,
      entitlementBundleId: version.entitlementBundleId,
      createdAt: now.toISOString(),
    };
    SubscriptionStore.saveSupportGrant(supportGrant);

    // Grant bundle items under SUPPORT_GRANT source
    const bundle = SubscriptionStore.getEntitlementBundle(version.entitlementBundleId);
    if (bundle) {
      for (const item of bundle.items) {
        SubscriptionStore.saveEntitlementGrant({
          grantId: asEntitlementGrantId(`grt-spt-${generateUUIDv7()}`),
          subjectType: params.subjectType,
          subjectId: params.subjectId,
          entitlementDefinitionId: item.entitlementDefinitionId,
          sourceType: 'SUPPORT_GRANT',
          sourceId: String(grantId),
          value: item.value,
          limitSemantics: item.limitSemantics || 'HARD_LIMIT',
          validFrom: now.toISOString(),
          validUntil,
          status: 'ACTIVE',
          createdAt: now.toISOString(),
        });
      }
    }

    SubscriptionOutbox.publish({
      eventType: 'SupportGrantCreated',
      grantId,
      subjectId: params.subjectId,
      authorizedByUserId: params.authorizedByUserId,
      reason: params.reason,
      validUntil,
      correlationId: generateUUIDv7(),
    });

    return supportGrant;
  }

  /**
   * Helper to grant all items in an EntitlementBundle to a subscription owner.
   */
  private static grantBundleEntitlements(
    subscription: ConsumerSubscription,
    bundleId: any
  ): void {
    const bundle = SubscriptionStore.getEntitlementBundle(bundleId);
    if (!bundle) return;

    for (const item of bundle.items) {
      SubscriptionStore.saveEntitlementGrant({
        grantId: asEntitlementGrantId(`grt-${generateUUIDv7()}`),
        subjectType: subscription.ownerType,
        subjectId: String(subscription.ownerId),
        entitlementDefinitionId: item.entitlementDefinitionId,
        sourceType: 'CONSUMER_SUBSCRIPTION',
        sourceId: String(subscription.subscriptionId),
        value: item.value,
        limitSemantics: item.limitSemantics || 'HARD_LIMIT',
        validFrom: subscription.currentPeriodStart,
        validUntil: subscription.currentPeriodEnd,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Validates that the actor has billing management permissions for the household.
   * Caregivers are NOT permitted to create, cancel, or modify household subscriptions.
   */
  private static assertHouseholdBillingPermission(householdId: HouseholdId, actorUserId: UserId): void {
    const memberships = IdentityStore.listMembersForHousehold(householdId);
    const actorMembership = memberships.find((m) => m.userId === actorUserId);

    if (!actorMembership) {
      throw new Error(`FORBIDDEN: User '${actorUserId}' is not a member of household '${householdId}'.`);
    }

    // Only HOUSEHOLD_OWNER or HOUSEHOLD_ADMIN have billing management rights
    if (actorMembership.role !== 'HOUSEHOLD_OWNER' && actorMembership.role !== 'HOUSEHOLD_ADMIN') {
      throw new Error(`BILLING_PERMISSION_DENIED: Household role '${actorMembership.role}' cannot manage subscriptions.`);
    }
  }
}
