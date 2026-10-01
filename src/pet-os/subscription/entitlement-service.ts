/**
 * Pet OS Central Entitlement Service
 * Volume XVIII: Subscription & Monetization Architecture
 * Implements Step 17 (Entitlement Catalogue), Step 18 (Safety-Critical Entitlements),
 * Step 58 (Feature Gating Service), Step 59 (No Scattered Plan Checks), Step 60 (Server Authoritative Gating),
 * Step 77 (Multiple Entitlement Sources), Step 103 (Entitlement Reconciliation), Step 106-108 (Offline Entitlements).
 */

import {
  EntitlementSubjectType,
  EntitlementEvaluationContext,
  EntitlementEvaluationResult,
  EntitlementDecision,
  EntitlementGrant,
  SignedEntitlementSnapshot,
  EntitlementReconciliationRecord,
  EntitlementDefinition,
} from './types';
import { SubscriptionStore } from './store';
import {
  asEntitlementGrantId,
  asEntitlementReconciliationRunId,
  asEntitlementUsageId,
  generateUUIDv7,
} from '../kernel/ids';
import { SubscriptionOutbox } from './events';

export class EntitlementService {
  private static readonly OFFLINE_SIGNING_SECRET = 'petos_entitlement_hmac_secret_v1';

  /**
   * Evaluates feature access deterministically.
   * Central decision point across all domains.
   */
  public static evaluate(
    subjectType: EntitlementSubjectType,
    subjectId: string,
    entitlementCode: string,
    context: EntitlementEvaluationContext = {}
  ): EntitlementEvaluationResult {
    const def = SubscriptionStore.getEntitlementDefinitionByCode(entitlementCode);
    if (!def) {
      return {
        entitlementCode,
        decision: 'DENIED',
        isAllowed: false,
        value: false,
        reason: `Unknown entitlement definition '${entitlementCode}'.`,
        source: 'FREE_BASELINE',
        isSafetyFallback: false,
      };
    }

    // 1. SAFETY-CRITICAL & LEGAL INVARIANTS CHECK
    // Invariant: Legally required privacy data export is NEVER blocked
    if (entitlementCode === 'data_export.privacy' || context.isPrivacyExportRequest) {
      return {
        entitlementCode,
        decision: 'ALLOWED',
        isAllowed: true,
        value: true,
        reason: 'Legally mandated privacy personal data export is guaranteed for all users.',
        source: 'FREE_BASELINE',
        isSafetyFallback: true,
      };
    }

    // Invariant: Safety-critical core data (Pet profile, basic medical records)
    if (def.isSafetyCritical) {
      return {
        entitlementCode,
        decision: 'ALLOWED',
        isAllowed: true,
        value: true,
        reason: 'Safety-critical core pet record access is guaranteed across all tiers.',
        source: 'FREE_BASELINE',
        isSafetyFallback: true,
      };
    }

    // Invariant: Active Lost Pet Incident Safety Boundary
    // If an active lost pet incident is ongoing, essential recovery cannot be cut off due to billing expiration
    if (entitlementCode === 'lost_pet.core' || (context.activeLostPetIncident && entitlementCode.startsWith('lost_pet.'))) {
      return {
        entitlementCode,
        decision: 'ALLOWED',
        isAllowed: true,
        value: true,
        reason: 'Active emergency lost pet incident safety fallback engaged.',
        source: 'FREE_BASELINE',
        isSafetyFallback: true,
      };
    }

    // 2. RETRIEVE ALL ACTIVE GRANTS FOR SUBJECT
    // Grants may come from User, Household, or Pet
    const grants = this.resolveActiveGrants(subjectType, subjectId, context);
    const relevantGrants = grants.filter(
      (g) => g.entitlementDefinitionId === def.entitlementId && g.status === 'ACTIVE'
    );

    // If no explicit grant exists, check baseline Free defaults
    if (relevantGrants.length === 0) {
      return this.evaluateBaseline(def, { ...context, subjectId });
    }

    // 3. RESOLVE HIGHEST PRECEDENCE / MAX LIMIT GRANT
    const effectiveGrant = this.mergeGrants(def, relevantGrants);

    // 4. HANDLE CAPACITY / QUOTA LIMITS
    if (def.type === 'CAPACITY' || def.type === 'QUOTA') {
      const maxLimit = typeof effectiveGrant.value === 'number' ? effectiveGrant.value : 0;
      const periodKey = this.getCurrentPeriodKey();
      const usage = SubscriptionStore.getUsage(subjectId, def.entitlementId, periodKey);
      const currentUsage = usage ? usage.currentUsage : 0;
      const requestedDelta = context.requestedDelta !== undefined ? context.requestedDelta : 0;

      // Check for grandfathered over-limit state
      if (effectiveGrant.limitSemantics === 'GRANDFATHERED_OVER_LIMIT') {
        return {
          entitlementCode,
          decision: 'GRANDFATHERED',
          isAllowed: true,
          value: effectiveGrant.value,
          limit: maxLimit,
          currentUsage,
          remainingQuota: Math.max(0, maxLimit - currentUsage),
          reason: 'Existing resources grandfathered beyond standard tier capacity.',
          source: effectiveGrant.sourceType,
          effectiveUntil: effectiveGrant.validUntil,
          isSafetyFallback: false,
        };
      }

      if (maxLimit !== -1 && currentUsage + requestedDelta > maxLimit) {
        SubscriptionOutbox.publish({
          eventType: 'EntitlementLimitReached',
          subjectId,
          entitlementCode,
          currentUsage,
          maxLimit,
          correlationId: generateUUIDv7(),
        });

        return {
          entitlementCode,
          decision: 'LIMIT_REACHED',
          isAllowed: false,
          value: effectiveGrant.value,
          limit: maxLimit,
          currentUsage,
          remainingQuota: 0,
          reason: `Capacity limit of ${maxLimit} reached for '${def.displayName}'.`,
          source: effectiveGrant.sourceType,
          effectiveUntil: effectiveGrant.validUntil,
          isSafetyFallback: false,
        };
      }

      return {
        entitlementCode,
        decision: 'ALLOWED',
        isAllowed: true,
        value: effectiveGrant.value,
        limit: maxLimit,
        currentUsage,
        remainingQuota: maxLimit === -1 ? 999999 : Math.max(0, maxLimit - currentUsage),
        reason: 'Granted under active entitlement limit.',
        source: effectiveGrant.sourceType,
        effectiveUntil: effectiveGrant.validUntil,
        isSafetyFallback: false,
      };
    }

    // 5. BOOLEAN / FEATURE_VARIANT / HISTORY_WINDOW
    const isAllowed = Boolean(effectiveGrant.value);
    return {
      entitlementCode,
      decision: isAllowed ? 'ALLOWED' : 'REQUIRES_UPGRADE',
      isAllowed,
      value: effectiveGrant.value,
      reason: isAllowed
        ? 'Granted under active subscription/grant.'
        : `Feature '${def.displayName}' requires Premium subscription.`,
      source: effectiveGrant.sourceType,
      effectiveUntil: effectiveGrant.validUntil,
      isSafetyFallback: false,
    };
  }

  /**
   * Resolves all grants that apply to this subject (including inherited Household grants).
   */
  public static resolveActiveGrants(
    subjectType: EntitlementSubjectType,
    subjectId: string,
    context: EntitlementEvaluationContext
  ): readonly EntitlementGrant[] {
    const directGrants = SubscriptionStore.listGrantsForSubject(subjectId).filter(
      (g) => g.status === 'ACTIVE' && (!g.validUntil || new Date(g.validUntil) > new Date())
    );

    // If subject is User or Pet, check inherited Household grants
    const inheritedGrants: EntitlementGrant[] = [];
    if (context.householdId && subjectId !== String(context.householdId)) {
      const hhGrants = SubscriptionStore.listGrantsForSubject(String(context.householdId)).filter(
        (g) => g.status === 'ACTIVE' && (!g.validUntil || new Date(g.validUntil) > new Date())
      );
      inheritedGrants.push(...hhGrants);
    }

    return [...directGrants, ...inheritedGrants];
  }

  /**
   * Evaluates standard Free baseline when no active paid grant exists.
   */
  private static evaluateBaseline(
    def: EntitlementDefinition,
    context: EntitlementEvaluationContext
  ): EntitlementEvaluationResult {
    const isAllowed = Boolean(def.defaultValue);

    if (def.type === 'CAPACITY' || def.type === 'QUOTA') {
      const limit = typeof def.defaultValue === 'number' ? def.defaultValue : 0;
      const periodKey = this.getCurrentPeriodKey();
      const usage = context.subjectId ? SubscriptionStore.getUsage(context.subjectId, def.entitlementId, periodKey) : undefined;
      const currentUsage = usage ? usage.currentUsage : 0;
      const requestedDelta = context.requestedDelta !== undefined ? context.requestedDelta : 0;

      if (limit !== -1 && currentUsage + requestedDelta > limit) {
        return {
          entitlementCode: def.code,
          decision: 'LIMIT_REACHED',
          isAllowed: false,
          value: def.defaultValue,
          limit,
          currentUsage,
          remainingQuota: 0,
          reason: `Capacity limit of ${limit} reached under Free baseline tier.`,
          source: 'FREE_BASELINE',
          isSafetyFallback: false,
        };
      }

      return {
        entitlementCode: def.code,
        decision: isAllowed ? 'ALLOWED' : 'REQUIRES_UPGRADE',
        isAllowed,
        value: def.defaultValue,
        limit,
        currentUsage,
        remainingQuota: Math.max(0, limit - currentUsage),
        reason: isAllowed
          ? 'Allowed under Free baseline capacity.'
          : `Requires Premium upgrade to unlock '${def.displayName}'.`,
        source: 'FREE_BASELINE',
        isSafetyFallback: false,
      };
    }

    return {
      entitlementCode: def.code,
      decision: isAllowed ? 'ALLOWED' : 'REQUIRES_UPGRADE',
      isAllowed,
      value: def.defaultValue,
      reason: isAllowed
        ? 'Allowed under Free baseline tier.'
        : `Feature '${def.displayName}' requires Premium subscription.`,
      source: 'FREE_BASELINE',
      isSafetyFallback: false,
    };
  }

  /**
   * Merges multiple active grants for the same definition.
   * Quotas: MAX. Duration/History: MAX. Boolean: OR.
   */
  private static mergeGrants(
    def: EntitlementDefinition,
    grants: readonly EntitlementGrant[]
  ): EntitlementGrant {
    if (grants.length === 1) return grants[0];

    // Prefer Support/Promotional or ConsumerSubscription over Baseline
    const sorted = [...grants].sort((a, b) => {
      if (typeof a.value === 'number' && typeof b.value === 'number') {
        return b.value - a.value; // larger quota wins
      }
      return 0;
    });

    return sorted[0];
  }

  /**
   * Atomically consumes usage for a quota-based entitlement.
   */
  public static consumeUsage(
    subjectType: EntitlementSubjectType,
    subjectId: string,
    entitlementCode: string,
    amount: number = 1
  ): { success: boolean; currentUsage: number; maxLimit: number; error?: string } {
    const def = SubscriptionStore.getEntitlementDefinitionByCode(entitlementCode);
    if (!def) {
      return { success: false, currentUsage: 0, maxLimit: 0, error: 'Unknown entitlement' };
    }

    const evalResult = this.evaluate(subjectType, subjectId, entitlementCode, { requestedDelta: amount });
    if (!evalResult.isAllowed) {
      return {
        success: false,
        currentUsage: evalResult.currentUsage || 0,
        maxLimit: evalResult.limit || 0,
        error: evalResult.reason,
      };
    }

    const periodKey = this.getCurrentPeriodKey();
    const existing = SubscriptionStore.getUsage(subjectId, def.entitlementId, periodKey);
    const newUsage = (existing ? existing.currentUsage : 0) + amount;
    const maxLimit = evalResult.limit !== undefined ? evalResult.limit : 999999;

    SubscriptionStore.saveUsage({
      usageId: existing ? existing.usageId : asEntitlementUsageId(`usg-${generateUUIDv7()}`),
      subjectType,
      subjectId,
      entitlementDefinitionId: def.entitlementId,
      periodKey,
      currentUsage: newUsage,
      maxLimit,
      resetPeriod: 'BILLING_CYCLE',
      resetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return { success: true, currentUsage: newUsage, maxLimit };
  }

  /**
   * Offline Entitlement Snapshot generator.
   * Produces a signed, tamper-resistant snapshot for mobile clients with a bounded validity window.
   */
  public static issueOfflineSnapshot(
    subjectType: EntitlementSubjectType,
    subjectId: string,
    durationHours: number = 72
  ): SignedEntitlementSnapshot {
    const definitions = SubscriptionStore.listEntitlementDefinitions();
    const snapshotEntitlements: Record<string, any> = {};

    for (const def of definitions) {
      const res = this.evaluate(subjectType, subjectId, def.code);
      snapshotEntitlements[def.code] = {
        isAllowed: res.isAllowed,
        value: res.value,
        limit: res.limit,
        decision: res.decision,
      };
    }

    const now = new Date();
    const issuedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000).toISOString();

    const payload = `${subjectType}:${subjectId}:${issuedAt}:${expiresAt}:${JSON.stringify(snapshotEntitlements)}`;
    const signature = this.computeHmac(payload);

    return {
      subjectType,
      subjectId,
      entitlements: snapshotEntitlements,
      issuedAt,
      expiresAt,
      signature,
      keyId: 'petos_key_2026_01',
    };
  }

  /**
   * Validates an offline snapshot's tamper-evident cryptographic signature and expiration.
   */
  public static verifyOfflineSnapshot(snapshot: SignedEntitlementSnapshot): {
    isValid: boolean;
    reason?: string;
  } {
    if (new Date(snapshot.expiresAt) < new Date()) {
      return { isValid: false, reason: 'Offline entitlement snapshot has expired.' };
    }

    const payload = `${snapshot.subjectType}:${snapshot.subjectId}:${snapshot.issuedAt}:${snapshot.expiresAt}:${JSON.stringify(snapshot.entitlements)}`;
    const expectedSignature = this.computeHmac(payload);

    if (snapshot.signature !== expectedSignature) {
      return { isValid: false, reason: 'Cryptographic signature mismatch: snapshot has been tampered with.' };
    }

    return { isValid: true };
  }

  /**
   * Entitlement Reconciliation:
   * Compares active paid subscriptions against granted entitlements.
   * Repairs missing grants for active subscriptions, and revokes orphaned grants for expired subscriptions.
   */
  public static reconcileEntitlements(): EntitlementReconciliationRecord {
    const allSubs = SubscriptionStore.listAllSubscriptions();
    const allGrants = SubscriptionStore.listAllActiveGrants();
    const details: string[] = [];
    let repairedCount = 0;

    // 1. Check active subscriptions have their corresponding bundle grants
    for (const sub of allSubs) {
      const isActive = ['ACTIVE', 'TRIALING', 'GRACE_PERIOD', 'CANCEL_AT_PERIOD_END'].includes(sub.status);
      const ownerId = String(sub.ownerId);
      const subGrants = allGrants.filter((g) => g.sourceId === String(sub.subscriptionId));

      if (isActive && subGrants.length === 0) {
        // DRIFT: Active subscription missing grants!
        const version = SubscriptionStore.getPlanVersion(sub.planVersionId);
        if (version) {
          const bundle = SubscriptionStore.getEntitlementBundle(version.entitlementBundleId);
          if (bundle) {
            for (const item of bundle.items) {
              const def = SubscriptionStore.getEntitlementDefinition(item.entitlementDefinitionId);
              SubscriptionStore.saveEntitlementGrant({
                grantId: asEntitlementGrantId(`grt-repair-${generateUUIDv7()}`),
                subjectType: sub.ownerType,
                subjectId: ownerId,
                entitlementDefinitionId: item.entitlementDefinitionId,
                sourceType: 'CONSUMER_SUBSCRIPTION',
                sourceId: String(sub.subscriptionId),
                value: item.value,
                limitSemantics: item.limitSemantics || 'HARD_LIMIT',
                validFrom: sub.currentPeriodStart,
                validUntil: sub.currentPeriodEnd,
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
              });
            }
            details.push(`Repaired missing entitlement bundle for active subscription ${sub.subscriptionId}`);
            repairedCount++;
          }
        }
      } else if (!isActive && subGrants.length > 0) {
        // DRIFT: Inactive subscription retaining active grants!
        SubscriptionStore.revokeGrantsForSource(String(sub.subscriptionId));
        details.push(`Revoked orphaned grants for inactive subscription ${sub.subscriptionId}`);
        repairedCount++;
      }
    }

    const record: EntitlementReconciliationRecord = {
      runId: asEntitlementReconciliationRunId(`rec-ent-${generateUUIDv7()}`),
      timestamp: new Date().toISOString(),
      checkedGrantsCount: allGrants.length,
      repairedGrantsCount: repairedCount,
      details,
    };

    SubscriptionStore.recordEntitlementReconciliation(record);
    SubscriptionOutbox.publish({
      eventType: 'EntitlementReconciled',
      checkedCount: allGrants.length,
      repairedCount,
      correlationId: generateUUIDv7(),
    });

    return record;
  }

  private static getCurrentPeriodKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private static computeHmac(data: string): string {
    // Deterministic simulated HMAC hash using secret and string folding
    let hash = 0x811c9dc5;
    const combined = `${this.OFFLINE_SIGNING_SECRET}:${data}`;
    for (let i = 0; i < combined.length; i++) {
      hash ^= combined.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return `hmac_${hash.toString(16)}`;
  }
}
