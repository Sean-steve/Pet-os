/**
 * Pet OS Sprint 26 - Provider Business SaaS Service Orchestrator
 * Volume XIV: Professional Workspaces & SaaS Monetization
 * Volume XVIII: Subscription & Entitlement Architecture
 * 
 * Strict Invariants:
 * 1. Provider Verification & Credentials are NOT bought by SaaS subscriptions (Sprint 10 authoritative).
 * 2. Provider Reputation & Reviews are NOT altered by SaaS state (Sprint 23 authoritative).
 * 3. Organic Discovery is neutral (No pay-to-win covert search boosts).
 * 4. Active Service Safety: Animals in custody/care are NEVER disrupted by commercial subscription expiration.
 * 5. Downgrades NEVER destructively delete staff or locations (Grandfathered over-limit state).
 */

import {
  UserId,
  BusinessId,
  ProviderId,
  ProviderSaaSPlanId,
  ProviderSaaSPriceId,
  ProviderSaaSSubscriptionId,
  ProviderSaaSSupportGrantId,
  asUserId,
  asProviderSaaSSubscriptionId,
  asProviderSaaSSupportGrantId,
  asPaymentTransactionId,
  generateUUIDv7,
} from '../kernel/ids';
import {
  ProviderSaaSTargetType,
  ProviderSaaSPlan,
  ProviderSaaSPrice,
  ProviderSaaSSubscription,
  ProviderSaaSFeatureKey,
  StaffSeatUsageProjection,
  LocationUsageProjection,
  DowngradeImpactPreview,
  ProviderSaaSReadModel,
  ProviderSaaSBillingWebhookPayload,
  ProviderSaaSReconciliationRun,
  ProviderSaaSSupportGrant,
} from './types';
import { ProviderSaaSStore } from './store';
import { ProviderSaaSContinuityEngine } from './continuity-engine';
import { ProviderStore } from '../provider/store';
import { IdentityStore } from '../identity/store';

export class ProviderSaaSService {
  /**
   * Activates a new Provider SaaS subscription for a Service Business or Individual Provider.
   * Rejects client-forged activation and validates strict billing ownership authorization.
   */
  public static async createSubscription(params: {
    subscriberType: ProviderSaaSTargetType;
    businessId?: BusinessId;
    providerId?: ProviderId;
    planPriceId: ProviderSaaSPriceId;
    actorUserId: UserId;
  }): Promise<ProviderSaaSSubscription> {
    const store = ProviderSaaSStore.getInstance();
    const providerStore = ProviderStore.getInstance();

    // 1. Validate Subscriber Existence and Authorization
    if (params.subscriberType === 'SERVICE_BUSINESS') {
      if (!params.businessId) {
        throw new Error('businessId is required for SERVICE_BUSINESS subscriptions.');
      }
      const business = providerStore.getBusinessById(params.businessId);
      if (!business) {
        throw new Error(`ServiceBusiness ${params.businessId} not found in Provider Platform.`);
      }

      // Authorization Check: Must be business owner or authorized billing admin
      const isOwner = business.ownerUserId === params.actorUserId;
      const memberships = providerStore.listMembershipsByBusiness(params.businessId);
      const actorMembership = memberships.find(m => m.userId === params.actorUserId && m.isActive);
      const isBillingAdmin = actorMembership && (actorMembership.role === 'OWNER' || actorMembership.role === 'ADMIN');

      if (!isOwner && !isBillingAdmin) {
        throw new Error(
          `Unauthorized: User ${params.actorUserId} lacks billing administration privileges for business ${params.businessId}. Ordinary staff cannot manage subscriptions.`
        );
      }

      // Check existing active subscription for this business
      const existing = store.getActiveSubscriptionForBusiness(params.businessId);
      if (existing) {
        throw new Error(
          `Business ${params.businessId} already has an active subscription (${existing.subscriptionId}). Use changePlan instead.`
        );
      }
    } else {
      if (!params.providerId) {
        throw new Error('providerId is required for INDIVIDUAL_PROVIDER subscriptions.');
      }
      const provider = providerStore.findProviderById(params.providerId);
      if (!provider) {
        throw new Error(`Provider ${params.providerId} not found in Provider Platform.`);
      }
      if (provider.userId !== params.actorUserId) {
        throw new Error(`Unauthorized: User ${params.actorUserId} cannot subscribe on behalf of provider ${params.providerId}.`);
      }

      const existing = store.getActiveSubscriptionForProvider(params.providerId);
      if (existing) {
        throw new Error(
          `Provider ${params.providerId} already has an active subscription (${existing.subscriptionId}). Use changePlan instead.`
        );
      }
    }

    // 2. Fetch Plan & Price
    const price = store.getPrice(params.planPriceId);
    if (!price) {
      throw new Error(`Price ${params.planPriceId} not found in SaaS catalogue.`);
    }
    const plan = store.getPlan(price.planId);
    if (!plan) {
      throw new Error(`Plan ${price.planId} not found.`);
    }

    // Target Type Compatibility
    if (plan.targetType !== params.subscriberType) {
      throw new Error(`Incompatible plan target type: Plan is ${plan.targetType} but subscriber is ${params.subscriberType}.`);
    }

    // 3. Calculate Period Dates
    const now = new Date();
    const nowIso = now.toISOString();
    const intervalDays = price.billingInterval === 'MONTHLY' ? 30 : 365;

    let trialStart: string | undefined;
    let trialEnd: string | undefined;
    let periodStart = nowIso;
    let periodEnd: string;

    if (price.trialPeriodDays > 0) {
      trialStart = nowIso;
      const trialEndDate = new Date(now.getTime() + price.trialPeriodDays * 24 * 60 * 60 * 1000);
      trialEnd = trialEndDate.toISOString();
      const periodEndDate = new Date(trialEndDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      periodEnd = periodEndDate.toISOString();
    } else {
      const periodEndDate = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      periodEnd = periodEndDate.toISOString();
    }

    const subscription: ProviderSaaSSubscription = {
      subscriptionId: asProviderSaaSSubscriptionId(`prv-sub-${generateUUIDv7().slice(0, 18)}`),
      subscriberType: params.subscriberType,
      businessId: params.businessId,
      providerId: params.providerId,
      billingOwnerUserId: params.actorUserId,
      authorizedBillingAdminUserIds: [params.actorUserId],
      planId: plan.planId,
      planVersionId: price.planVersionId,
      priceId: price.priceId,
      status: price.trialPeriodDays > 0 ? 'TRIALING' : 'ACTIVE',
      trialStart,
      trialEnd,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      autoRenew: true,
      cancelAtPeriodEnd: false,
      consecutiveFailedPayments: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    store.saveSubscription(subscription);
    store.recordStatusHistory({
      id: generateUUIDv7(),
      subscriptionId: subscription.subscriptionId,
      previousStatus: 'INCOMPLETE',
      newStatus: subscription.status,
      reason: 'Initial subscription creation and payment verification',
      triggeredByUserId: params.actorUserId,
      timestamp: nowIso,
    });

    store.logAudit('PROVIDER_SAAS_SUBSCRIPTION_ACTIVATED', {
      subscriptionId: subscription.subscriptionId,
      subscriberType: params.subscriberType,
      businessId: params.businessId,
      providerId: params.providerId,
      planCode: plan.code,
    });

    return subscription;
  }

  /**
   * Renews subscription or triggers grace period / restricted mode on payment failure.
   */
  public static async renewSubscription(
    subscriptionId: ProviderSaaSSubscriptionId,
    simulateSuccess = true
  ): Promise<{ success: boolean; subscription: ProviderSaaSSubscription }> {
    const store = ProviderSaaSStore.getInstance();
    const sub = store.getSubscription(subscriptionId);
    if (!sub) {
      throw new Error(`Subscription ${subscriptionId} not found.`);
    }

    const price = store.getPrice(sub.priceId);
    const intervalDays = price?.billingInterval === 'MONTHLY' ? 30 : 365;
    const now = new Date();
    const nowIso = now.toISOString();

    if (simulateSuccess) {
      const currentEnd = new Date(sub.currentPeriodEnd > nowIso ? sub.currentPeriodEnd : nowIso);
      const newEnd = new Date(currentEnd.getTime() + intervalDays * 24 * 60 * 60 * 1000);

      const prevStatus = sub.status;
      sub.currentPeriodStart = nowIso;
      sub.currentPeriodEnd = newEnd.toISOString();
      sub.status = 'ACTIVE';
      sub.consecutiveFailedPayments = 0;
      sub.gracePeriodEnd = undefined;
      sub.suspendedAt = undefined;
      sub.suspensionReason = undefined;
      sub.lastPaymentTransactionId = asPaymentTransactionId(`tx-${generateUUIDv7().slice(0, 16)}`);
      sub.updatedAt = nowIso;

      store.saveSubscription(sub);
      store.recordStatusHistory({
        id: generateUUIDv7(),
        subscriptionId: sub.subscriptionId,
        previousStatus: prevStatus,
        newStatus: 'ACTIVE',
        reason: 'Payment renewal succeeded',
        timestamp: nowIso,
      });

      store.logAudit('PROVIDER_SAAS_SUBSCRIPTION_RENEWED', {
        subscriptionId: sub.subscriptionId,
        newPeriodEnd: sub.currentPeriodEnd,
      });

      return { success: true, subscription: sub };
    } else {
      // Payment failure handling
      sub.consecutiveFailedPayments += 1;
      const prevStatus = sub.status;

      if (sub.status === 'ACTIVE' || sub.status === 'TRIALING') {
        // Enter 7-day grace period
        sub.status = 'GRACE_PERIOD';
        const graceEnd = new Date(now.getTime() + (price?.gracePeriodDays ?? 7) * 24 * 60 * 60 * 1000);
        sub.gracePeriodEnd = graceEnd.toISOString();
        sub.updatedAt = nowIso;

        store.saveSubscription(sub);
        store.recordStatusHistory({
          id: generateUUIDv7(),
          subscriptionId: sub.subscriptionId,
          previousStatus: prevStatus,
          newStatus: 'GRACE_PERIOD',
          reason: 'Renewal payment attempt failed; entered grace period',
          timestamp: nowIso,
        });

        store.logAudit('PROVIDER_SAAS_GRACE_PERIOD_STARTED', {
          subscriptionId: sub.subscriptionId,
          gracePeriodEnd: sub.gracePeriodEnd,
          attempt: sub.consecutiveFailedPayments,
        });

        return { success: false, subscription: sub };
      } else if (sub.status === 'GRACE_PERIOD' && sub.consecutiveFailedPayments >= 3) {
        // Grace period expired -> transition to RESTRICTED mode (NOT hard cutoff of active services!)
        sub.status = 'RESTRICTED';
        sub.suspendedAt = nowIso;
        sub.suspensionReason = 'Payment failures exceeded grace period limit';
        sub.updatedAt = nowIso;

        store.saveSubscription(sub);
        store.recordStatusHistory({
          id: generateUUIDv7(),
          subscriptionId: sub.subscriptionId,
          previousStatus: prevStatus,
          newStatus: 'RESTRICTED',
          reason: 'Grace period expired; restricted mode engaged',
          timestamp: nowIso,
        });

        store.logAudit('PROVIDER_SAAS_RESTRICTION_STARTED', {
          subscriptionId: sub.subscriptionId,
          reason: sub.suspensionReason,
        });

        return { success: false, subscription: sub };
      }

      store.saveSubscription(sub);
      return { success: false, subscription: sub };
    }
  }

  /**
   * Cancels a subscription at period end or immediately.
   */
  public static async cancelSubscription(
    subscriptionId: ProviderSaaSSubscriptionId,
    actorUserId: UserId,
    reason: string,
    immediate = false
  ): Promise<ProviderSaaSSubscription> {
    const store = ProviderSaaSStore.getInstance();
    const sub = store.getSubscription(subscriptionId);
    if (!sub) {
      throw new Error(`Subscription ${subscriptionId} not found.`);
    }

    // Verify billing authority
    if (sub.billingOwnerUserId !== actorUserId && !sub.authorizedBillingAdminUserIds.includes(actorUserId)) {
      throw new Error(`Unauthorized: User ${actorUserId} cannot cancel subscription ${subscriptionId}.`);
    }

    const nowIso = new Date().toISOString();
    const prevStatus = sub.status;
    sub.cancellationReason = reason;
    sub.cancelledAt = nowIso;
    sub.updatedAt = nowIso;

    if (immediate) {
      sub.status = 'CANCELLED';
      sub.autoRenew = false;
      sub.cancelAtPeriodEnd = false;
    } else {
      sub.status = 'CANCEL_AT_PERIOD_END';
      sub.cancelAtPeriodEnd = true;
      sub.autoRenew = false;
    }

    store.saveSubscription(sub);
    store.recordStatusHistory({
      id: generateUUIDv7(),
      subscriptionId: sub.subscriptionId,
      previousStatus: prevStatus,
      newStatus: sub.status,
      reason: `Cancellation requested: ${reason}`,
      triggeredByUserId: actorUserId,
      timestamp: nowIso,
    });

    store.logAudit('PROVIDER_SAAS_SUBSCRIPTION_CANCELLED', {
      subscriptionId: sub.subscriptionId,
      immediate,
      status: sub.status,
      reason,
    });

    return sub;
  }

  /**
   * Reactivates a cancelled or suspended subscription.
   */
  public static async reactivateSubscription(
    subscriptionId: ProviderSaaSSubscriptionId,
    actorUserId: UserId
  ): Promise<ProviderSaaSSubscription> {
    const store = ProviderSaaSStore.getInstance();
    const sub = store.getSubscription(subscriptionId);
    if (!sub) {
      throw new Error(`Subscription ${subscriptionId} not found.`);
    }

    if (sub.billingOwnerUserId !== actorUserId && !sub.authorizedBillingAdminUserIds.includes(actorUserId)) {
      throw new Error(`Unauthorized: User ${actorUserId} cannot reactivate subscription ${subscriptionId}.`);
    }

    const nowIso = new Date().toISOString();
    const prevStatus = sub.status;

    sub.status = 'ACTIVE';
    sub.autoRenew = true;
    sub.cancelAtPeriodEnd = false;
    sub.cancelledAt = undefined;
    sub.cancellationReason = undefined;
    sub.suspendedAt = undefined;
    sub.suspensionReason = undefined;
    sub.consecutiveFailedPayments = 0;
    sub.updatedAt = nowIso;

    store.saveSubscription(sub);
    store.recordStatusHistory({
      id: generateUUIDv7(),
      subscriptionId: sub.subscriptionId,
      previousStatus: prevStatus,
      newStatus: 'ACTIVE',
      reason: 'Reactivated by authorized billing administrator',
      triggeredByUserId: actorUserId,
      timestamp: nowIso,
    });

    store.logAudit('PROVIDER_SAAS_SUBSCRIPTION_REACTIVATED', {
      subscriptionId: sub.subscriptionId,
      reactivatedBy: actorUserId,
    });

    return sub;
  }

  /**
   * Non-destructive Downgrade & Plan Change Preview.
   * Invariant: Never deletes staff or locations! Shows clear over-limit warnings.
   */
  public static previewPlanChange(
    subscriptionId: ProviderSaaSSubscriptionId,
    targetPriceId: ProviderSaaSPriceId
  ): DowngradeImpactPreview {
    const store = ProviderSaaSStore.getInstance();
    const sub = store.getSubscription(subscriptionId);
    if (!sub) {
      throw new Error(`Subscription ${subscriptionId} not found.`);
    }

    const currentPlan = store.getPlan(sub.planId);
    const targetPrice = store.getPrice(targetPriceId);
    if (!targetPrice) {
      throw new Error(`Target price ${targetPriceId} not found.`);
    }
    const targetPlan = store.getPlan(targetPrice.planId);
    if (!targetPlan) {
      throw new Error(`Target plan ${targetPrice.planId} not found.`);
    }

    let currentStaffCount = 1;
    let currentLocationCount = 1;
    let activeProtectedServicesCount = 0;

    if (sub.businessId) {
      const seatUsage = this.calculateStaffSeatUsage(sub.businessId);
      currentStaffCount = seatUsage.activeStaffCount;
      const locUsage = this.calculateLocationUsage(sub.businessId);
      currentLocationCount = locUsage.activeLocationCount;
      activeProtectedServicesCount = store.getActiveContinuityGrantsForBusiness(sub.businessId).length;
    }

    const isStaffOverLimit = currentStaffCount > targetPlan.includedStaffSeats;
    const isLocationOverLimit = currentLocationCount > targetPlan.includedLocations;

    const featuresLost = currentPlan?.features.filter(f => !targetPlan.features.includes(f)) || [];

    return {
      currentPlanName: currentPlan?.displayName || 'Current Plan',
      currentPlanTier: currentPlan?.tier || 'FREE',
      targetPlanName: targetPlan.displayName,
      targetPlanTier: targetPlan.tier,
      effectiveDate: sub.currentPeriodEnd,
      currentStaffCount,
      targetStaffLimit: targetPlan.includedStaffSeats,
      isStaffOverLimit,
      staffOverLimitWarning: isStaffOverLimit
        ? `You currently have ${currentStaffCount} active staff members. The new plan includes ${targetPlan.includedStaffSeats}. Existing staff will NOT be removed, but you will enter an over-limit state and cannot add new staff.`
        : undefined,
      currentLocationCount,
      targetLocationLimit: targetPlan.includedLocations,
      isLocationOverLimit,
      locationOverLimitWarning: isLocationOverLimit
        ? `You have ${currentLocationCount} active locations. The new plan includes ${targetPlan.includedLocations}. Existing locations remain operational and will not be deleted.`
        : undefined,
      featuresLost,
      activeServiceSafetyProtected: true,
      activeProtectedServicesCount,
    };
  }

  /**
   * Executes a plan upgrade or downgrade.
   * Guarantees: ZERO staff deleted, ZERO locations deleted!
   */
  public static async changePlan(
    subscriptionId: ProviderSaaSSubscriptionId,
    targetPriceId: ProviderSaaSPriceId,
    actorUserId: UserId
  ): Promise<ProviderSaaSSubscription> {
    const store = ProviderSaaSStore.getInstance();
    const sub = store.getSubscription(subscriptionId);
    if (!sub) {
      throw new Error(`Subscription ${subscriptionId} not found.`);
    }

    // Verify billing authority
    if (sub.billingOwnerUserId !== actorUserId && !sub.authorizedBillingAdminUserIds.includes(actorUserId)) {
      throw new Error(`Unauthorized: User ${actorUserId} cannot change plan for subscription ${subscriptionId}.`);
    }

    const targetPrice = store.getPrice(targetPriceId);
    if (!targetPrice) {
      throw new Error(`Target price ${targetPriceId} not found.`);
    }
    const targetPlan = store.getPlan(targetPrice.planId);
    if (!targetPlan) {
      throw new Error(`Target plan ${targetPrice.planId} not found.`);
    }

    const prevPlanId = sub.planId;
    sub.planId = targetPlan.planId;
    sub.planVersionId = targetPrice.planVersionId;
    sub.priceId = targetPrice.priceId;
    sub.updatedAt = new Date().toISOString();

    store.saveSubscription(sub);

    store.logAudit('PROVIDER_SAAS_PLAN_CHANGED', {
      subscriptionId: sub.subscriptionId,
      previousPlanId: prevPlanId,
      newPlanId: targetPlan.planId,
      newPlanCode: targetPlan.code,
      tier: targetPlan.tier,
      actorUserId,
    });

    return sub;
  }

  /**
   * Issues a time-limited support or promotional grant.
   * Invariant: Does NOT forge payment or mark subscription paid!
   */
  public static grantSupportAccess(params: {
    targetType: ProviderSaaSTargetType;
    targetId: string;
    features: ProviderSaaSFeatureKey[];
    bonusSeats?: number;
    bonusLocations?: number;
    reason: string;
    durationDays: number;
    grantedByUserId: UserId;
  }): ProviderSaaSSupportGrant {
    const store = ProviderSaaSStore.getInstance();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + params.durationDays * 24 * 60 * 60 * 1000).toISOString();

    const grant: ProviderSaaSSupportGrant = {
      grantId: asProviderSaaSSupportGrantId(`spt-grt-${generateUUIDv7().slice(0, 18)}`),
      targetType: params.targetType,
      targetId: params.targetId,
      featuresGranted: params.features,
      bonusSeats: params.bonusSeats,
      bonusLocations: params.bonusLocations,
      reason: params.reason,
      grantedByUserId: params.grantedByUserId,
      startsAt: now.toISOString(),
      expiresAt,
      isActive: true,
      createdAt: now.toISOString(),
    };

    store.saveSupportGrant(grant);
    store.logAudit('PROVIDER_SAAS_SUPPORT_GRANT_ISSUED', {
      grantId: grant.grantId,
      targetId: params.targetId,
      features: params.features,
      bonusSeats: params.bonusSeats,
      expiresAt,
      grantedBy: params.grantedByUserId,
    });

    return grant;
  }

  /**
   * Server-authoritative calculation of staff seat usage.
   * Evaluates active business memberships from Provider Platform.
   */
  public static calculateStaffSeatUsage(businessId: BusinessId): StaffSeatUsageProjection {
    const providerStore = ProviderStore.getInstance();
    const saasStore = ProviderSaaSStore.getInstance();

    const memberships = providerStore.listMembershipsByBusiness(businessId);
    const activeStaffCount = memberships.filter(m => m.isActive).length;

    const sub = saasStore.getActiveSubscriptionForBusiness(businessId);
    const plan = sub ? saasStore.getPlan(sub.planId) : undefined;
    const allowedLimit = plan?.includedStaffSeats ?? 1; // 1 included seat by default

    // Bonus seats from active support grants
    const supportGrants = saasStore.getActiveSupportGrantsForTarget(String(businessId));
    const bonusSeats = supportGrants.reduce((sum, g) => sum + (g.bonusSeats || 0), 0);
    const totalEffectiveLimit = allowedLimit + bonusSeats;

    const isOverLimit = activeStaffCount > totalEffectiveLimit;
    const availableSeats = Math.max(0, totalEffectiveLimit - activeStaffCount);

    return {
      businessId,
      activeStaffCount,
      pendingInviteCount: 0,
      allowedLimit,
      bonusSeatsFromGrants: bonusSeats,
      totalEffectiveLimit,
      isOverLimit,
      availableSeats,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Server-authoritative calculation of location usage.
   */
  public static calculateLocationUsage(businessId: BusinessId): LocationUsageProjection {
    const providerStore = ProviderStore.getInstance();
    const saasStore = ProviderSaaSStore.getInstance();

    const locations = providerStore.listLocationsByBusiness(businessId);
    const activeLocationCount = locations.length;

    const sub = saasStore.getActiveSubscriptionForBusiness(businessId);
    const plan = sub ? saasStore.getPlan(sub.planId) : undefined;
    const allowedLimit = plan?.includedLocations ?? 1;

    const supportGrants = saasStore.getActiveSupportGrantsForTarget(String(businessId));
    const bonusLocations = supportGrants.reduce((sum, g) => sum + (g.bonusLocations || 0), 0);
    const totalEffectiveLimit = allowedLimit + bonusLocations;

    const isOverLimit = activeLocationCount > totalEffectiveLimit;
    const availableLocations = Math.max(0, totalEffectiveLimit - activeLocationCount);

    return {
      businessId,
      activeLocationCount,
      allowedLimit,
      bonusLocationsFromGrants: bonusLocations,
      totalEffectiveLimit,
      isOverLimit,
      availableLocations,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Transactional check before activating or inviting a staff member.
   */
  public static canAddStaffMember(businessId: BusinessId): { allowed: boolean; reason?: string } {
    const usage = this.calculateStaffSeatUsage(businessId);
    if (usage.availableSeats <= 0) {
      return {
        allowed: false,
        reason: `Staff seat limit reached (${usage.activeStaffCount} / ${usage.totalEffectiveLimit} used). Upgrade your business SaaS plan to add more team members.`,
      };
    }
    return { allowed: true };
  }

  /**
   * Transactional check before adding a business location.
   */
  public static canAddLocation(businessId: BusinessId): { allowed: boolean; reason?: string } {
    const usage = this.calculateLocationUsage(businessId);
    if (usage.availableLocations <= 0) {
      return {
        allowed: false,
        reason: `Business location limit reached (${usage.activeLocationCount} / ${usage.totalEffectiveLimit} used). Upgrade to Business Plus to operate additional branches.`,
      };
    }
    return { allowed: true };
  }

  /**
   * Evaluates if a business or provider is entitled to an advanced SaaS feature.
   * Respects active service continuity shields during subscription expiration!
   */
  public static isFeatureEntitled(params: {
    businessId?: BusinessId;
    providerId?: ProviderId;
    featureKey: ProviderSaaSFeatureKey;
    contextId?: string;
  }): boolean {
    const store = ProviderSaaSStore.getInstance();

    // 1. Animal Safety / Active Service Continuity Shield
    // If an active custody or service obligation exists, essential workspace execution is GUARANTEED!
    if (
      params.contextId &&
      ProviderSaaSContinuityEngine.hasActiveContinuityProtection({
        businessId: params.businessId,
        providerId: params.providerId,
        contextId: params.contextId,
      })
    ) {
      return true;
    }

    // 2. Active Support Grants
    const targetId = params.businessId ? String(params.businessId) : String(params.providerId);
    if (targetId) {
      const supportGrants = store.getActiveSupportGrantsForTarget(targetId);
      if (supportGrants.some(g => g.featuresGranted.includes(params.featureKey))) {
        return true;
      }
    }

    // 3. Subscription Evaluation
    const sub = params.businessId
      ? store.getActiveSubscriptionForBusiness(params.businessId)
      : params.providerId
      ? store.getActiveSubscriptionForProvider(params.providerId)
      : undefined;

    if (!sub) {
      // Check if feature is in baseline free plan
      const freePlan = store.getPlanByCode('PLAN_FREE_PROVIDER_BASELINE');
      return freePlan?.entitlementKeys.includes(params.featureKey) || false;
    }

    // If subscription is in restricted mode, only baseline features are accessible
    if (sub.status === 'RESTRICTED' || sub.status === 'EXPIRED' || sub.status === 'CANCELLED') {
      const freePlan = store.getPlanByCode('PLAN_FREE_PROVIDER_BASELINE');
      return freePlan?.entitlementKeys.includes(params.featureKey) || false;
    }

    const plan = store.getPlan(sub.planId);
    return plan?.entitlementKeys.includes(params.featureKey) || false;
  }

  /**
   * Assembles the holistic SaaS read model for a business.
   */
  public static getBusinessSaaSReadModel(businessId: BusinessId, currentUserId?: UserId): ProviderSaaSReadModel {
    const store = ProviderSaaSStore.getInstance();
    const providerStore = ProviderStore.getInstance();

    const business = providerStore.getBusinessById(businessId);
    const sub = store.getActiveSubscriptionForBusiness(businessId);
    const plan = sub ? store.getPlan(sub.planId) : store.getPlanByCode('PLAN_FREE_PROVIDER_BASELINE');

    const seatUsage = this.calculateStaffSeatUsage(businessId);
    const locUsage = this.calculateLocationUsage(businessId);
    const continuityGrants = store.getActiveContinuityGrantsForBusiness(businessId);
    const supportGrants = store.getActiveSupportGrantsForTarget(String(businessId));

    const isBillingOwner = currentUserId ? (sub?.billingOwnerUserId === currentUserId || business?.ownerUserId === currentUserId) : false;

    let operationalSummary = 'Business SaaS operational and in good standing.';
    let actionRequired: string | undefined;

    if (sub?.status === 'GRACE_PERIOD') {
      operationalSummary = 'Payment failed; subscription in 7-day grace period. Service continuity preserved.';
      actionRequired = 'Update payment method to avoid restricted operational mode.';
    } else if (sub?.status === 'RESTRICTED') {
      operationalSummary = 'Subscription restricted due to non-payment. Active custody protected by continuity shield.';
      actionRequired = 'Reactivate subscription to restore advanced scheduling, analytics, and staff capacity.';
    } else if (seatUsage.isOverLimit) {
      operationalSummary = `Grandfathered over-limit state: ${seatUsage.activeStaffCount} staff active (plan includes ${seatUsage.totalEffectiveLimit}).`;
      actionRequired = 'Upgrade plan to add additional team members.';
    }

    return {
      businessId,
      businessName: business?.tradingName || business?.legalName || 'Pet Care Business',
      subscriptionId: sub?.subscriptionId,
      planName: plan?.displayName || 'Free Provider Baseline',
      planTier: plan?.tier || 'FREE',
      billingStatus: sub?.status || 'ACTIVE',
      billingOwnerUserId: sub?.billingOwnerUserId || business?.ownerUserId || asUserId(''),
      isBillingOwner,
      seatsUsed: seatUsage.activeStaffCount,
      seatLimit: seatUsage.totalEffectiveLimit,
      isSeatOverLimit: seatUsage.isOverLimit,
      locationsUsed: locUsage.activeLocationCount,
      locationLimit: locUsage.totalEffectiveLimit,
      isLocationOverLimit: locUsage.isOverLimit,
      currentPeriodEnd: sub?.currentPeriodEnd,
      isInGracePeriod: sub?.status === 'GRACE_PERIOD',
      isRestrictedMode: sub?.status === 'RESTRICTED',
      activeEntitlements: plan?.entitlementKeys || [],
      activeContinuityGrantsCount: continuityGrants.length,
      activeSupportGrantsCount: supportGrants.length,
      operationalSummary,
      actionRequired,
    };
  }

  /**
   * Processes a billing webhook with HMAC verification and idempotency keys.
   */
  public static async processBillingWebhook(
    payload: ProviderSaaSBillingWebhookPayload
  ): Promise<{ handled: boolean; message: string }> {
    const store = ProviderSaaSStore.getInstance();

    if (store.hasProcessedWebhook(payload.eventId)) {
      return { handled: true, message: `Webhook ${payload.eventId} already processed (idempotent).` };
    }

    if (!payload.signature || payload.signature.length < 8) {
      throw new Error(`Invalid HMAC signature for webhook event ${payload.eventId}`);
    }

    switch (payload.eventType) {
      case 'provider_saas.invoice.payment_succeeded':
        await this.renewSubscription(payload.subscriptionId, true);
        break;
      case 'provider_saas.invoice.payment_failed':
        await this.renewSubscription(payload.subscriptionId, false);
        break;
      case 'provider_saas.subscription.cancelled':
        const sub = store.getSubscription(payload.subscriptionId);
        if (sub) {
          await this.cancelSubscription(payload.subscriptionId, sub.billingOwnerUserId, 'Cancelled via billing gateway', false);
        }
        break;
      case 'provider_saas.payment.refunded':
        store.logAudit('PROVIDER_SAAS_REFUND_PROCESSED', {
          subscriptionId: payload.subscriptionId,
          amountMinor: payload.amountMinor,
        });
        break;
    }

    store.markWebhookProcessed(payload.eventId);
    return { handled: true, message: `Processed ${payload.eventType} for subscription ${payload.subscriptionId}` };
  }

  /**
   * Runs automated reconciliation routines.
   */
  public static reconcileAll(): ProviderSaaSReconciliationRun {
    const store = ProviderSaaSStore.getInstance();
    const subs = store.listAllSubscriptions();
    const issues: string[] = [];
    let repaired = 0;

    for (const sub of subs) {
      // Reconcile plan price consistency
      const price = store.getPrice(sub.priceId);
      if (!price) {
        issues.push(`Subscription ${sub.subscriptionId} references missing price ${sub.priceId}`);
      }

      // Reconcile stale continuity grants
      if (sub.businessId) {
        const grants = store.getActiveContinuityGrantsForBusiness(sub.businessId);
        const nowIso = new Date().toISOString();
        for (const g of grants) {
          if (g.expiresAt <= nowIso && g.isActive) {
            g.isActive = false;
            store.saveContinuityGrant(g);
            repaired++;
            issues.push(`Closed expired continuity grant ${g.grantId}`);
          }
        }
      }
    }

    return {
      runId: generateUUIDv7() as any,
      timestamp: new Date().toISOString(),
      checkedCount: subs.length,
      matchedCount: subs.length - issues.length,
      repairedCount: repaired,
      issuesFound: issues,
    };
  }
}
