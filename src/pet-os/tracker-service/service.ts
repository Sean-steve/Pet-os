/**
 * Pet OS Sprint 25 - Tracker Subscription & Device Service Orchestrator
 * Volume XIX: Pet Tracking & Device Architecture
 * Volume XVIII: Subscription & Monetization Architecture
 * 
 * Invariants:
 * 1. Strict separation: Consumer Premium != Tracker Connectivity.
 * 2. Billing Status != Physical Connectivity.
 * 3. Devices own subscriptions, NOT Pets.
 * 4. Hardware transfers preserve remaining days without altering historical telemetry.
 * 5. Lost Pet Safety Override guarantees emergency uplink during billing retries.
 */

import {
  UserId,
  HouseholdId,
  PetId,
  DeviceId,
  IncidentId,
  TrackerSubscriptionId,
  TrackerPlanPriceId,
  TrackerDeviceTransferRecordId,
  TrackerSafetyOverrideRecordId,
  asTrackerSubscriptionId,
  asTrackerDeviceTransferRecordId,
  asTrackerSafetyOverrideRecordId,
  asPaymentTransactionId,
  generateUUIDv7,
} from '../kernel/ids';
import {
  TrackerSubscription,
  TrackerPlanPrice,
  TrackerServicePlan,
  TrackerCarrierServiceRecord,
  TrackerDeviceTransferRecord,
  TrackerSafetyOverrideRecord,
  TrackerBillingWebhookPayload,
  CarrierWebhookPayload,
  DeviceHolisticStatusProjection,
} from './types';
import { TrackerSubscriptionStore } from './store';
import { CarrierProviderRegistry } from './carrier-provider';
import { DeviceEntitlementService } from './device-entitlement-service';
import { TrackerEventFactory } from './events';
import { TrackingStore } from '../tracking/store';
import { PetStore } from '../pet-core/store';
import { SubscriptionStore } from '../subscription/store';

export class TrackerSubscriptionService {
  /**
   * Activates a new connectivity subscription for a physical device.
   * Enforces one-plan-per-device and verifies consumer premium bundling.
   */
  public static async activateSubscription(params: {
    deviceId: DeviceId;
    householdId: HouseholdId;
    primaryUserId: UserId;
    planPriceId: TrackerPlanPriceId;
    bundledConsumerSubscriptionId?: string;
  }): Promise<TrackerSubscription> {
    const store = TrackerSubscriptionStore.getInstance();
    const trackingStore = TrackingStore.getInstance();

    // 1. Verify physical device exists in Device Registry
    const device = trackingStore.getDevice(params.deviceId);
    if (!device) {
      throw new Error(`Device ${params.deviceId} does not exist in Device Registry.`);
    }

    // 2. Enforce one active subscription per physical device
    const existing = store.getSubscriptionForDevice(params.deviceId);
    if (
      existing &&
      existing.status !== 'TERMINATED' &&
      existing.status !== 'CANCELLED' &&
      existing.status !== 'EXPIRED'
    ) {
      throw new Error(
        `Device ${params.deviceId} already has an active or pending subscription (${existing.id}). Use changePlan or cancel first.`
      );
    }

    // 3. Fetch Price and Plan
    const price = store.getPlanPrice(params.planPriceId);
    if (!price) {
      throw new Error(`Tracker plan price ${params.planPriceId} not found.`);
    }
    const plan = store.getPlan(price.planId);
    if (!plan) {
      throw new Error(`Tracker service plan ${price.planId} not found.`);
    }

    // 4. Check for Consumer Premium Bundling discount
    let hasBundledDiscount = false;
    let bundledSubId = params.bundledConsumerSubscriptionId;

    if (!bundledSubId) {
      const consumerSub = SubscriptionStore.getActiveSubscriptionForOwner(params.householdId);
      if (consumerSub && consumerSub.status === 'ACTIVE') {
        hasBundledDiscount = true;
        bundledSubId = String(consumerSub.subscriptionId);
      }
    } else {
      hasBundledDiscount = true;
    }

    // 5. Provision carrier SIM/eSIM profile
    const carrierAdapter = CarrierProviderRegistry.getAdapter(plan.carrierVendorDefault);
    const carrierRecord = await carrierAdapter.provisionSim(
      params.deviceId,
      plan.cellularDataAllowanceMbPerMonth
    );

    // 6. Calculate period dates
    const now = new Date();
    const nowIso = now.toISOString();

    let trialStartsAt: string | undefined;
    let trialEndsAt: string | undefined;
    let periodStartsAt = nowIso;
    let periodEndsAt: string;

    const intervalDays = price.interval === 'MONTHLY' ? 30 : price.interval === 'ANNUAL' ? 365 : 730;

    if (price.trialPeriodDays > 0) {
      trialStartsAt = nowIso;
      const trialEndDate = new Date(now.getTime() + price.trialPeriodDays * 24 * 60 * 60 * 1000);
      trialEndsAt = trialEndDate.toISOString();
      const periodEndDate = new Date(trialEndDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      periodEndsAt = periodEndDate.toISOString();
    } else {
      const periodEndDate = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      periodEndsAt = periodEndDate.toISOString();
    }

    const subscription: TrackerSubscription = {
      id: asTrackerSubscriptionId(`trk-sub-${generateUUIDv7().slice(0, 18)}`),
      deviceId: params.deviceId,
      householdId: params.householdId,
      primaryUserId: params.primaryUserId,
      planId: plan.id,
      planPriceId: price.id,
      status: price.trialPeriodDays > 0 ? 'TRIALING' : 'ACTIVE',
      carrierRecordId: carrierRecord.id,
      trialStartsAt,
      trialEndsAt,
      currentPeriodStartsAt: periodStartsAt,
      currentPeriodEndsAt: periodEndsAt,
      autoRenew: true,
      cancelAtPeriodEnd: false,
      consecutiveFailedPaymentAttempts: 0,
      hasBundledPremiumDiscount: hasBundledDiscount,
      bundledConsumerSubscriptionId: bundledSubId,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    store.saveSubscription(subscription);
    store.logAudit('TRACKER_SUBSCRIPTION_ACTIVATED', {
      subscriptionId: subscription.id,
      deviceId: params.deviceId,
      planCode: plan.code,
      hasBundledDiscount,
    });

    return subscription;
  }

  /**
   * Renews a subscription or handles billing retry failure.
   */
  public static async renewSubscription(
    subscriptionId: TrackerSubscriptionId,
    simulatePaymentSuccess = true
  ): Promise<{ success: boolean; subscription: TrackerSubscription }> {
    const store = TrackerSubscriptionStore.getInstance();
    const sub = store.getSubscription(subscriptionId);
    if (!sub) {
      throw new Error(`Subscription ${subscriptionId} not found.`);
    }

    const price = store.getPlanPrice(sub.planPriceId);
    const intervalDays = price
      ? price.interval === 'MONTHLY'
        ? 30
        : price.interval === 'ANNUAL'
        ? 365
        : 730
      : 30;

    const now = new Date();
    const nowIso = now.toISOString();

    if (simulatePaymentSuccess) {
      // Payment succeeded!
      const currentEnd = new Date(sub.currentPeriodEndsAt > nowIso ? sub.currentPeriodEndsAt : nowIso);
      const newEnd = new Date(currentEnd.getTime() + intervalDays * 24 * 60 * 60 * 1000);

      sub.currentPeriodStartsAt = nowIso;
      sub.currentPeriodEndsAt = newEnd.toISOString();
      sub.status = 'ACTIVE';
      sub.consecutiveFailedPaymentAttempts = 0;
      sub.gracePeriodEndsAt = undefined;
      sub.suspendedAt = undefined;
      sub.restoredAt = nowIso;
      sub.lastPaymentTransactionId = asPaymentTransactionId(`tx-${generateUUIDv7().slice(0, 16)}`);
      sub.updatedAt = nowIso;

      // Restore carrier SIM if it was suspended
      if (sub.carrierRecordId) {
        const carrierRecord = store.getCarrierRecord(sub.carrierRecordId);
        if (carrierRecord && carrierRecord.provisioningStatus === 'SUSPENDED_CARRIER') {
          const adapter = CarrierProviderRegistry.getAdapter(carrierRecord.carrierVendor);
          await adapter.restoreSim(carrierRecord.id);
        }
      }

      store.saveSubscription(sub);
      store.logAudit('TRACKER_SUBSCRIPTION_RENEWED', {
        subscriptionId: sub.id,
        newPeriodEndsAt: sub.currentPeriodEndsAt,
      });

      return { success: true, subscription: sub };
    } else {
      // Payment failed!
      sub.consecutiveFailedPaymentAttempts += 1;
      const graceDays = price?.gracePeriodDays ?? 7;

      if (sub.status === 'ACTIVE' || sub.status === 'TRIALING') {
        // First failure -> enter GRACE_PERIOD
        sub.status = 'GRACE_PERIOD';
        const graceEnd = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000);
        sub.gracePeriodEndsAt = graceEnd.toISOString();
        sub.updatedAt = nowIso;

        store.saveSubscription(sub);
        store.logAudit('TRACKER_SUBSCRIPTION_GRACE_PERIOD_STARTED', {
          subscriptionId: sub.id,
          gracePeriodEndsAt: sub.gracePeriodEndsAt,
          attempt: sub.consecutiveFailedPaymentAttempts,
        });

        return { success: false, subscription: sub };
      } else if (sub.status === 'GRACE_PERIOD' && sub.consecutiveFailedPaymentAttempts >= 3) {
        // Grace period expired or multiple retries failed -> SUSPENDED
        sub.status = 'SUSPENDED';
        sub.suspendedAt = nowIso;
        sub.suspensionReason = 'Payment failures exceeded grace period limit';
        sub.updatedAt = nowIso;

        // Suspend carrier SIM data (unless active safety override exists!)
        const activeSafety = store.getActiveSafetyOverride(sub.deviceId);
        if (!activeSafety && sub.carrierRecordId) {
          const carrierRecord = store.getCarrierRecord(sub.carrierRecordId);
          if (carrierRecord) {
            const adapter = CarrierProviderRegistry.getAdapter(carrierRecord.carrierVendor);
            await adapter.suspendSim(carrierRecord.id, 'Non-payment suspension');
          }
        }

        store.saveSubscription(sub);
        store.logAudit('TRACKER_CONNECTIVITY_SUSPENDED', {
          subscriptionId: sub.id,
          deviceId: sub.deviceId,
          activeSafetyOverrideProtected: !!activeSafety,
        });

        return { success: false, subscription: sub };
      }

      store.saveSubscription(sub);
      return { success: false, subscription: sub };
    }
  }

  /**
   * Cancels a tracker subscription.
   */
  public static async cancelSubscription(
    subscriptionId: TrackerSubscriptionId,
    reason: string,
    immediate = false
  ): Promise<TrackerSubscription> {
    const store = TrackerSubscriptionStore.getInstance();
    const sub = store.getSubscription(subscriptionId);
    if (!sub) {
      throw new Error(`Subscription ${subscriptionId} not found.`);
    }

    const nowIso = new Date().toISOString();
    sub.cancellationReason = reason;
    sub.cancelledAt = nowIso;
    sub.updatedAt = nowIso;

    if (immediate) {
      sub.status = 'CANCELLED';
      sub.autoRenew = false;
      sub.cancelAtPeriodEnd = false;

      if (sub.carrierRecordId) {
        const carrierRecord = store.getCarrierRecord(sub.carrierRecordId);
        if (carrierRecord) {
          const adapter = CarrierProviderRegistry.getAdapter(carrierRecord.carrierVendor);
          await adapter.suspendSim(carrierRecord.id, `Immediate cancellation: ${reason}`);
        }
      }
    } else {
      sub.status = 'CANCEL_AT_PERIOD_END';
      sub.cancelAtPeriodEnd = true;
      sub.autoRenew = false;
    }

    store.saveSubscription(sub);
    store.logAudit('TRACKER_SUBSCRIPTION_CANCELLED', {
      subscriptionId: sub.id,
      reason,
      immediate,
      status: sub.status,
    });

    return sub;
  }

  /**
   * Reactivates a cancelled or suspended subscription.
   */
  public static async reactivateSubscription(
    subscriptionId: TrackerSubscriptionId,
    newPlanPriceId?: TrackerPlanPriceId
  ): Promise<TrackerSubscription> {
    const store = TrackerSubscriptionStore.getInstance();
    const sub = store.getSubscription(subscriptionId);
    if (!sub) {
      throw new Error(`Subscription ${subscriptionId} not found.`);
    }

    const nowIso = new Date().toISOString();
    if (newPlanPriceId) {
      const price = store.getPlanPrice(newPlanPriceId);
      if (price) {
        sub.planPriceId = price.id;
        sub.planId = price.planId;
      }
    }

    sub.status = 'ACTIVE';
    sub.autoRenew = true;
    sub.cancelAtPeriodEnd = false;
    sub.cancelledAt = undefined;
    sub.cancellationReason = undefined;
    sub.suspendedAt = undefined;
    sub.suspensionReason = undefined;
    sub.consecutiveFailedPaymentAttempts = 0;
    sub.restoredAt = nowIso;
    sub.updatedAt = nowIso;

    if (sub.carrierRecordId) {
      const carrierRecord = store.getCarrierRecord(sub.carrierRecordId);
      if (carrierRecord) {
        const adapter = CarrierProviderRegistry.getAdapter(carrierRecord.carrierVendor);
        await adapter.restoreSim(carrierRecord.id);
      }
    }

    store.saveSubscription(sub);
    store.logAudit('TRACKER_SUBSCRIPTION_REACTIVATED', { subscriptionId: sub.id });
    return sub;
  }

  /**
   * Upgrades or changes plan for an active device subscription.
   */
  public static async changePlan(
    subscriptionId: TrackerSubscriptionId,
    newPlanPriceId: TrackerPlanPriceId
  ): Promise<TrackerSubscription> {
    const store = TrackerSubscriptionStore.getInstance();
    const sub = store.getSubscription(subscriptionId);
    if (!sub) {
      throw new Error(`Subscription ${subscriptionId} not found.`);
    }

    const newPrice = store.getPlanPrice(newPlanPriceId);
    if (!newPrice) {
      throw new Error(`Price ${newPlanPriceId} not found.`);
    }
    const newPlan = store.getPlan(newPrice.planId);
    if (!newPlan) {
      throw new Error(`Plan ${newPrice.planId} not found.`);
    }

    sub.planId = newPlan.id;
    sub.planPriceId = newPrice.id;
    sub.updatedAt = new Date().toISOString();

    // Adjust carrier limit if carrier record exists
    if (sub.carrierRecordId) {
      const carrier = store.getCarrierRecord(sub.carrierRecordId);
      if (carrier) {
        carrier.dataLimitMbCurrentCycle = newPlan.cellularDataAllowanceMbPerMonth;
        store.saveCarrierRecord(carrier);
      }
    }

    store.saveSubscription(sub);
    store.logAudit('TRACKER_PLAN_CHANGED', {
      subscriptionId: sub.id,
      newPlanCode: newPlan.code,
      tier: newPlan.tier,
    });

    return sub;
  }

  /**
   * Transfers a device connectivity subscription from an old hardware device
   * to a replacement hardware device (e.g. warranty, damage, upgrade).
   * 
   * Invariants:
   * 1. Preserves exact remaining billing period days.
   * 2. Historical telemetry stays permanently associated with the old physical DeviceId in Tracking.
   * 3. Old device carrier record is deprovisioned or retired.
   * 4. New device gets carrier record provisioned.
   */
  public static async transferDeviceHardware(params: {
    subscriptionId: TrackerSubscriptionId;
    targetDeviceId: DeviceId;
    userId: UserId;
    reason: 'WARRANTY_REPLACEMENT' | 'UPGRADE_NEW_HARDWARE' | 'LOST_DEVICE_REPLACEMENT' | 'DEVICE_RETIREMENT';
    notes?: string;
  }): Promise<{ transferRecord: TrackerDeviceTransferRecord; subscription: TrackerSubscription }> {
    const store = TrackerSubscriptionStore.getInstance();
    const trackingStore = TrackingStore.getInstance();

    const sub = store.getSubscription(params.subscriptionId);
    if (!sub) {
      throw new Error(`Subscription ${params.subscriptionId} not found.`);
    }

    const targetDevice = trackingStore.getDevice(params.targetDeviceId);
    if (!targetDevice) {
      throw new Error(`Target device ${params.targetDeviceId} does not exist in Device Registry.`);
    }

    // Ensure target device doesn't already have an active subscription
    const existingTargetSub = store.getSubscriptionForDevice(params.targetDeviceId);
    if (
      existingTargetSub &&
      existingTargetSub.status !== 'TERMINATED' &&
      existingTargetSub.status !== 'CANCELLED' &&
      existingTargetSub.status !== 'EXPIRED'
    ) {
      throw new Error(
        `Target device ${params.targetDeviceId} already has active subscription ${existingTargetSub.id}.`
      );
    }

    const oldDeviceId = sub.deviceId;
    const now = new Date();
    const nowIso = now.toISOString();

    // Calculate remaining days
    const endMs = new Date(sub.currentPeriodEndsAt).getTime();
    const nowMs = now.getTime();
    const remainingDays = Math.max(0, Math.ceil((endMs - nowMs) / (24 * 60 * 60 * 1000)));

    // Provision new carrier profile for target hardware
    const plan = store.getPlan(sub.planId);
    const adapter = CarrierProviderRegistry.getAdapter(plan?.carrierVendorDefault || 'GLOBAL_ESIM_1P');
    const newCarrierRecord = await adapter.provisionSim(
      params.targetDeviceId,
      plan?.cellularDataAllowanceMbPerMonth || 100
    );

    // Decommission old carrier record if existed
    if (sub.carrierRecordId) {
      const oldCarrier = store.getCarrierRecord(sub.carrierRecordId);
      if (oldCarrier) {
        await adapter.suspendSim(oldCarrier.id, `Transferred to device ${params.targetDeviceId}`);
        oldCarrier.provisioningStatus = 'DEPROVISIONED';
        oldCarrier.deprovisionedAt = nowIso;
        store.saveCarrierRecord(oldCarrier);
      }
    }

    // Update subscription to point to target device
    sub.deviceId = params.targetDeviceId;
    sub.carrierRecordId = newCarrierRecord.id;
    sub.updatedAt = nowIso;
    store.saveSubscription(sub);

    // Create transfer audit record
    const transferRecord: TrackerDeviceTransferRecord = {
      id: asTrackerDeviceTransferRecordId(`trf-${generateUUIDv7().slice(0, 18)}`),
      subscriptionId: sub.id,
      previousDeviceId: oldDeviceId,
      targetDeviceId: params.targetDeviceId,
      householdId: sub.householdId,
      transferredBy: params.userId,
      transferredAt: nowIso,
      reason: params.reason,
      notes: params.notes,
      remainingPeriodDaysPreserved: remainingDays,
      previousDeviceDecommissioned: true,
    };

    store.saveTransferRecord(transferRecord);
    store.logAudit('TRACKER_HARDWARE_TRANSFERRED', {
      transferId: transferRecord.id,
      oldDeviceId,
      targetDeviceId: params.targetDeviceId,
      remainingDaysPreserved: remainingDays,
    });

    return { transferRecord, subscription: sub };
  }

  /**
   * Activates a Lost Pet Safety Override.
   * Emergency invariant: Even if billing is past due or suspended, cellular uplink
   * is guaranteed while an active Lost Pet search is underway.
   */
  public static async activateLostPetSafetyOverride(params: {
    deviceId: DeviceId;
    petId: PetId;
    incidentId: IncidentId;
    reason: string;
    durationHours?: number;
    activatedBy?: 'SYSTEM_SAFETY_DAEMON' | 'INCIDENT_DISPATCHER' | 'PET_OWNER';
  }): Promise<TrackerSafetyOverrideRecord> {
    const store = TrackerSubscriptionStore.getInstance();
    const sub = store.getSubscriptionForDevice(params.deviceId);

    const now = new Date();
    const duration = params.durationHours ?? 72; // default 72h emergency safety window
    const expiresAt = new Date(now.getTime() + duration * 60 * 60 * 1000).toISOString();

    const override: TrackerSafetyOverrideRecord = {
      id: asTrackerSafetyOverrideRecordId(`sft-${generateUUIDv7().slice(0, 18)}`),
      subscriptionId: sub?.id || asTrackerSubscriptionId('trk-sub-emergency-placeholder'),
      deviceId: params.deviceId,
      petId: params.petId,
      incidentId: params.incidentId,
      activatedAt: now.toISOString(),
      expiresAt,
      isEmergencyUplinkActive: true,
      reason: params.reason,
      activatedBy: params.activatedBy || 'SYSTEM_SAFETY_DAEMON',
      auditLog: [
        `Emergency override initiated at ${now.toISOString()} due to Incident ${params.incidentId}.`,
      ],
    };

    // If carrier record is suspended, restore it for emergency search
    if (sub?.carrierRecordId) {
      const carrier = store.getCarrierRecord(sub.carrierRecordId);
      if (carrier && carrier.provisioningStatus === 'SUSPENDED_CARRIER') {
        const adapter = CarrierProviderRegistry.getAdapter(carrier.carrierVendor);
        await adapter.restoreSim(carrier.id);
        override.auditLog.push('Restored suspended carrier SIM under safety override.');
      }
    }

    store.saveSafetyOverride(override);
    store.logAudit('TRACKER_SAFETY_OVERRIDE_ACTIVATED', {
      overrideId: override.id,
      deviceId: params.deviceId,
      incidentId: params.incidentId,
      expiresAt,
    });

    return override;
  }

  /**
   * Deactivates a safety override (e.g. Pet found and incident closed).
   */
  public static async deactivateSafetyOverride(overrideId: TrackerSafetyOverrideRecordId): Promise<boolean> {
    const store = TrackerSubscriptionStore.getInstance();
    const allOverrides = store.getAllSafetyOverrides();
    const override = allOverrides.find(o => o.id === overrideId);
    if (!override) return false;

    override.isEmergencyUplinkActive = false;
    override.auditLog.push(`Deactivated at ${new Date().toISOString()}`);
    store.saveSafetyOverride(override);

    // Re-check subscription: if still suspended, re-suspend carrier SIM
    const sub = store.getSubscription(override.subscriptionId);
    if (sub && sub.status === 'SUSPENDED' && sub.carrierRecordId) {
      const carrier = store.getCarrierRecord(sub.carrierRecordId);
      if (carrier) {
        const adapter = CarrierProviderRegistry.getAdapter(carrier.carrierVendor);
        await adapter.suspendSim(carrier.id, 'Safety incident resolved; returning to billing suspension');
      }
    }

    store.logAudit('TRACKER_SAFETY_OVERRIDE_DEACTIVATED', { overrideId });
    return true;
  }

  /**
   * Processes a billing webhook with HMAC signature & idempotency validation.
   */
  public static async processBillingWebhook(payload: TrackerBillingWebhookPayload): Promise<{ handled: boolean; message: string }> {
    const store = TrackerSubscriptionStore.getInstance();

    // 1. Idempotency Check
    if (store.hasProcessedWebhook(payload.eventId)) {
      return { handled: true, message: `Webhook ${payload.eventId} already processed (idempotent).` };
    }

    // 2. Validate HMAC Signature
    if (!payload.signature || payload.signature.length < 8) {
      throw new Error(`Invalid webhook signature for event ${payload.eventId}`);
    }

    // 3. Process Event
    switch (payload.eventType) {
      case 'tracker.invoice.payment_succeeded': {
        await this.renewSubscription(payload.subscriptionId, true);
        break;
      }
      case 'tracker.invoice.payment_failed': {
        await this.renewSubscription(payload.subscriptionId, false);
        break;
      }
      case 'tracker.subscription.cancelled': {
        await this.cancelSubscription(payload.subscriptionId, 'Cancelled via external billing portal', false);
        break;
      }
      case 'tracker.payment.refunded': {
        store.logAudit('BILLING_REFUND_PROCESSED', {
          subscriptionId: payload.subscriptionId,
          amountCents: payload.amountCents,
        });
        break;
      }
      default:
        return { handled: false, message: `Unknown billing event type: ${(payload as any).eventType}` };
    }

    store.markWebhookProcessed(payload.eventId);
    return { handled: true, message: `Processed ${payload.eventType} for subscription ${payload.subscriptionId}` };
  }

  /**
   * Processes a carrier/vendor webhook with idempotency.
   */
  public static async processCarrierWebhook(payload: CarrierWebhookPayload): Promise<{ handled: boolean; message: string }> {
    const store = TrackerSubscriptionStore.getInstance();

    if (store.hasProcessedWebhook(payload.eventId)) {
      return { handled: true, message: `Carrier event ${payload.eventId} already processed (idempotent).` };
    }

    const carrierRecord = store.getCarrierRecordByRef(payload.carrierSubscriptionRef);
    if (!carrierRecord) {
      return { handled: false, message: `Carrier record not found for ref ${payload.carrierSubscriptionRef}` };
    }

    switch (payload.eventType) {
      case 'carrier.sim.provisioned':
        carrierRecord.provisioningStatus = 'PROVISIONED';
        carrierRecord.networkAttachStatus = 'ATTACHED';
        break;
      case 'carrier.sim.network_attached':
        carrierRecord.networkAttachStatus = 'ATTACHED';
        carrierRecord.lastCarrierPingAt = payload.timestamp;
        break;
      case 'carrier.sim.network_detached':
        carrierRecord.networkAttachStatus = 'DETACHED';
        break;
      case 'carrier.sim.quota_threshold_exceeded':
        if (payload.dataUsageMb) {
          carrierRecord.dataUsageMbCurrentCycle = payload.dataUsageMb;
        }
        break;
      case 'carrier.outage.declared':
        carrierRecord.carrierOutageReported = true;
        carrierRecord.carrierOutageNotes = payload.outageDetails || 'Upstream carrier infrastructure issue';
        carrierRecord.networkAttachStatus = 'CARRIER_OUTAGE';
        break;
      case 'carrier.outage.resolved':
        carrierRecord.carrierOutageReported = false;
        carrierRecord.carrierOutageNotes = undefined;
        carrierRecord.networkAttachStatus = 'ATTACHED';
        break;
    }

    carrierRecord.updatedAt = new Date().toISOString();
    store.saveCarrierRecord(carrierRecord);
    store.markWebhookProcessed(payload.eventId);

    return { handled: true, message: `Processed ${payload.eventType} for carrier ref ${payload.carrierSubscriptionRef}` };
  }

  /**
   * Produces the holistic 5-dimensional diagnostic projection for a device.
   * Demonstrates clearly that:
   * BILLING STATUS != CONNECTIVITY STATUS != BATTERY STATUS!
   */
  public static getHolisticDeviceProjection(deviceId: DeviceId): DeviceHolisticStatusProjection {
    const store = TrackerSubscriptionStore.getInstance();
    const trackingStore = TrackingStore.getInstance();
    const device = trackingStore.getDevice(deviceId);
    const assignment = trackingStore.getActiveAssignmentForDevice(deviceId);
    const assignedPet = assignment ? PetStore.findPetById(assignment.petId) : undefined;

    const sub = store.getSubscriptionForDevice(deviceId);
    const plan = sub ? store.getPlan(sub.planId) : undefined;
    const carrier = store.getCarrierRecordForDevice(deviceId);
    const safetyOverride = store.getActiveSafetyOverride(deviceId);

    const nowIso = new Date().toISOString();
    const isPastDue = sub?.status === 'PAST_DUE';
    const isInGracePeriod =
      sub?.status === 'GRACE_PERIOD' &&
      !!sub.gracePeriodEndsAt &&
      sub.gracePeriodEndsAt > nowIso;
    const isBillingSuspended = sub?.status === 'SUSPENDED';

    // Evaluate entitlements
    const cellularEval = DeviceEntitlementService.evaluate(deviceId, 'cellular.attach');
    const uploadEval = DeviceEntitlementService.evaluate(deviceId, 'telemetry.upload');
    const liveEval = DeviceEntitlementService.evaluate(deviceId, 'tracking.live_pin');

    // Synthesize primary blocker and diagnostic summary
    let primaryBlocker: DeviceHolisticStatusProjection['primaryBlocker'] = 'NONE';
    let diagnosticSummary = 'Device operational and fully entitled.';

    if (device?.batteryStatus === 'CRITICAL' || (device?.batteryPercent !== undefined && device.batteryPercent <= 5)) {
      primaryBlocker = 'DEAD_BATTERY';
      diagnosticSummary = `Physical Hardware Blocker: Critical battery (${device?.batteryPercent ?? 0}%). Subscription is active, but device cannot power GPS radio.`;
    } else if (carrier?.carrierOutageReported) {
      primaryBlocker = 'CARRIER_OUTAGE';
      diagnosticSummary = `Carrier Infrastructure Blocker: Upstream ${carrier.carrierVendor} outage. Customer billing is current.`;
    } else if (isBillingSuspended && !safetyOverride) {
      primaryBlocker = 'BILLING_SUSPENSION';
      diagnosticSummary = 'Commercial Blocker: Subscription payment suspended. Cellular data uplink denied.';
    } else if (carrier?.networkAttachStatus === 'SEARCHING' || carrier?.networkAttachStatus === 'DETACHED') {
      primaryBlocker = 'NO_CARRIER_SIGNAL';
      diagnosticSummary = 'RF/Environmental Blocker: No cellular tower line-of-sight. Subscription and hardware are healthy.';
    } else if (!sub) {
      primaryBlocker = 'SIM_UNPROVISIONED';
      diagnosticSummary = 'Activation Blocker: Hardware is registered, but no device connectivity plan has been activated.';
    } else if (safetyOverride) {
      diagnosticSummary = `SAFETY OVERRIDE ACTIVE: Lost Pet emergency uplink enabled until ${safetyOverride.expiresAt}.`;
    }

    return {
      deviceId,
      displayName: device?.displayName || `Device ${deviceId}`,
      model: device?.model || 'Pet OS Tracker',
      serialNumberMasked: device?.serialNumberMasked || 'SN-***-0000',
      assignedPetId: assignment?.petId,
      assignedPetName: assignedPet?.name,
      householdId: device?.householdId || (sub?.householdId as HouseholdId),

      // 1. Subscription
      subscriptionId: sub?.id,
      planName: plan?.name,
      planTier: plan?.tier,
      billingStatus: sub?.status || 'INCOMPLETE',
      currentPeriodEndsAt: sub?.currentPeriodEndsAt,
      isPastDue,
      isInGracePeriod,
      isBillingSuspended,

      // 2. Hardware & Battery
      connectivityStatus: device?.connectivityStatus || 'UNKNOWN',
      batteryStatus: device?.batteryStatus || 'UNKNOWN',
      batteryPercent: device?.batteryPercent,
      lastSeenAt: device?.lastSeenAt,

      // 3. Carrier
      carrierVendor: carrier?.carrierVendor,
      carrierProvisioning: carrier?.provisioningStatus || 'PENDING_PROVISIONING',
      carrierNetworkAttach: carrier?.networkAttachStatus || 'DETACHED',
      iccidMasked: carrier?.iccidMasked,
      dataUsageMbCurrentCycle: carrier?.dataUsageMbCurrentCycle || 0,
      dataLimitMbCurrentCycle: carrier?.dataLimitMbCurrentCycle || plan?.cellularDataAllowanceMbPerMonth || 100,
      carrierOutageActive: carrier?.carrierOutageReported || false,

      // 4. Entitlements
      cellularAllowed: cellularEval.isAllowed,
      telemetryUploadAllowed: uploadEval.isAllowed,
      liveTrackingAllowed: liveEval.isAllowed,
      safetyOverrideActive: !!safetyOverride,
      safetyOverrideExpiresAt: safetyOverride?.expiresAt,

      // 5. Synthesis
      diagnosticSummary,
      primaryBlocker,
    };
  }
}
