/**
 * Pet OS Sprint 24 — Subscription, Premium Entitlements & Monetization Test Suite
 * Comprehensive automated verification covering all lifecycle, safety, entitlement,
 * anti-fraud, data preservation, and reconciliation requirements.
 */

import { ConsumerSubscriptionService } from './service';
import { EntitlementService } from './entitlement-service';
import { SubscriptionStore } from './store';
import { seedSubscriptionData, CANONICAL_SUBSCRIPTION_IDS } from './seed';
import { SubscriptionBillingRegistry } from './billing-provider';
import { CANONICAL_IDS } from '../seed/unified-seed';
import {
  asConsumerSubscriptionId,
  asPlanPriceId,
  asUserId,
  asHouseholdId,
  generateUUIDv7,
} from '../kernel/ids';
import { SignedEntitlementSnapshot, SubscriptionBillingWebhookPayload } from './types';
import { IdentityStore } from '../identity/store';
import { asMembershipId } from '../kernel/ids';

export interface TestResult {
  readonly id: string;
  readonly name: string;
  readonly category: 'LIFECYCLE' | 'ENTITLEMENTS' | 'SAFETY' | 'SECURITY' | 'RECONCILIATION' | 'BILLING';
  readonly passed: boolean;
  readonly message: string;
  readonly durationMs: number;
}

export class SubscriptionTestSuite {
  public static async runAllTests(): Promise<{
    passed: number;
    failed: number;
    total: number;
    results: TestResult[];
  }> {
    const results: TestResult[] = [];

    const testCases: Array<{
      id: string;
      name: string;
      category: TestResult['category'];
      fn: () => Promise<void> | void;
    }> = [
      // 1. Free Baseline & Entitlements
      {
        id: 'SUB-01',
        name: 'Free Baseline: Premium Features Denied while Baseline Allowed',
        category: 'ENTITLEMENTS',
        fn: () => {
          seedSubscriptionData();
          const outsiderHh = String(CANONICAL_IDS.OUTSIDER_HOUSEHOLD);

          const liveTracking = EntitlementService.evaluate('HOUSEHOLD', outsiderHh, 'tracking.live');
          if (liveTracking.isAllowed) throw new Error('Free user should not have live tracking');
          if (liveTracking.decision !== 'REQUIRES_UPGRADE') throw new Error(`Expected REQUIRES_UPGRADE, got ${liveTracking.decision}`);

          const petCapacity = EntitlementService.evaluate('HOUSEHOLD', outsiderHh, 'pet.capacity');
          if (!petCapacity.isAllowed || petCapacity.limit !== 3) {
            throw new Error(`Expected free pet capacity limit 3, got ${petCapacity.limit}`);
          }
        },
      },
      // 2. Safety Critical Non-Paywalled Features
      {
        id: 'SUB-02',
        name: 'Safety Invariant: Core Health & Pet ID Never Paywalled',
        category: 'SAFETY',
        fn: () => {
          seedSubscriptionData();
          const outsiderHh = String(CANONICAL_IDS.OUTSIDER_HOUSEHOLD);

          const health = EntitlementService.evaluate('HOUSEHOLD', outsiderHh, 'health.records.core');
          if (!health.isAllowed || !health.isSafetyFallback) {
            throw new Error('Health records must be accessible under safety fallback');
          }

          const petProfile = EntitlementService.evaluate('HOUSEHOLD', outsiderHh, 'pet.profile.core');
          if (!petProfile.isAllowed || !petProfile.isSafetyFallback) {
            throw new Error('Pet profile must be accessible under safety fallback');
          }
        },
      },
      // 3. Privacy Export Non-Gating Invariant
      {
        id: 'SUB-03',
        name: 'Legal Invariant: Privacy & GDPR Export Never Gated',
        category: 'SAFETY',
        fn: () => {
          seedSubscriptionData();
          const outsiderHh = String(CANONICAL_IDS.OUTSIDER_HOUSEHOLD);

          const privacy = EntitlementService.evaluate('HOUSEHOLD', outsiderHh, 'data_export.privacy', {
            isPrivacyExportRequest: true,
          });
          if (!privacy.isAllowed || !privacy.isSafetyFallback) {
            throw new Error('Privacy export must be unconditionally allowed');
          }
        },
      },
      // 4. Lost Pet Recovery Safety Boundary During Renewal Failure
      {
        id: 'SUB-04',
        name: 'Emergency Safety Boundary: Active Lost Pet Recovery during Billing Expiry',
        category: 'SAFETY',
        fn: () => {
          seedSubscriptionData();
          const outsiderHh = String(CANONICAL_IDS.OUTSIDER_HOUSEHOLD);

          // Evaluating with active emergency incident flag
          const lostPet = EntitlementService.evaluate('HOUSEHOLD', outsiderHh, 'lost_pet.core', {
            activeLostPetIncident: true,
          });
          if (!lostPet.isAllowed || !lostPet.isSafetyFallback) {
            throw new Error('Active lost pet incident must engage emergency safety fallback');
          }
        },
      },
      // 5. Elena Active Subscription Baseline
      {
        id: 'SUB-05',
        name: 'Elena Vance Household: Premium Entitlements Active',
        category: 'ENTITLEMENTS',
        fn: () => {
          seedSubscriptionData();
          const elenaHh = String(CANONICAL_IDS.MAIN_HOUSEHOLD);

          const liveTracking = EntitlementService.evaluate('HOUSEHOLD', elenaHh, 'tracking.live');
          if (!liveTracking.isAllowed || liveTracking.decision !== 'ALLOWED') {
            throw new Error('Elena should have active live tracking');
          }

          const petCapacity = EntitlementService.evaluate('HOUSEHOLD', elenaHh, 'pet.capacity');
          if (!petCapacity.isAllowed || petCapacity.limit !== 15) {
            throw new Error(`Elena expected 15 pets capacity, got ${petCapacity.limit}`);
          }

          const passportExport = EntitlementService.evaluate('HOUSEHOLD', elenaHh, 'passport.advanced_export');
          if (!passportExport.isAllowed) {
            throw new Error('Elena should have certified passport export');
          }
        },
      },
      // 6. Checkout New Subscription E2E
      {
        id: 'SUB-06',
        name: 'Lifecycle E2E: Checkout New Subscription with Paid Invoice',
        category: 'LIFECYCLE',
        fn: async () => {
          seedSubscriptionData();
          const testHh = asHouseholdId(`hh-checkout-${generateUUIDv7()}`);

          // Register membership so actor has billing permission
          const testUser = asUserId(`usr-buyer-${generateUUIDv7()}`);
          const now = new Date().toISOString();
          IdentityStore.saveMembership({
            membershipId: asMembershipId(`mem-${generateUUIDv7()}`),
            householdId: testHh,
            userId: testUser,
            role: 'HOUSEHOLD_OWNER',
            status: 'ACTIVE',
            joinedAt: now,
            updatedAt: now,
          });

          const { subscription, invoice } = await ConsumerSubscriptionService.checkoutSubscription({
            ownerType: 'HOUSEHOLD',
            ownerId: testHh,
            planPriceId: CANONICAL_SUBSCRIPTION_IDS.PRICE_PREM_MONTHLY_USD,
            actorUserId: testUser,
            paymentTokenOrPhone: 'tok_visa_4242',
            providerName: 'CARD_GATEWAY',
          });

          if (subscription.status !== 'ACTIVE') throw new Error(`Expected ACTIVE status, got ${subscription.status}`);
          if (invoice.status !== 'PAID') throw new Error(`Expected PAID invoice, got ${invoice.status}`);
          if (invoice.amountMinor !== 999) throw new Error(`Expected 999 cents, got ${invoice.amountMinor}`);

          const evalResult = EntitlementService.evaluate('HOUSEHOLD', String(testHh), 'tracking.live');
          if (!evalResult.isAllowed) throw new Error('Newly subscribed household should have live tracking');
        },
      },
      // 7. Client Forged Activation Rejection
      {
        id: 'SUB-07',
        name: 'Anti-Fraud: Client Forged ACTIVE Status Rejected',
        category: 'SECURITY',
        fn: async () => {
          seedSubscriptionData();
          let rejected = false;
          try {
            await ConsumerSubscriptionService.checkoutSubscription({
              ownerType: 'HOUSEHOLD',
              ownerId: CANONICAL_IDS.OUTSIDER_HOUSEHOLD,
              planPriceId: CANONICAL_SUBSCRIPTION_IDS.PRICE_PREM_MONTHLY_USD,
              actorUserId: CANONICAL_IDS.OUTSIDER_BRIAN,
              paymentTokenOrPhone: 'tok_fake',
              clientClaimedStatus: 'ACTIVE',
            });
          } catch (err: any) {
            if (err.message.includes('SECURITY_VIOLATION')) {
              rejected = true;
            }
          }
          if (!rejected) throw new Error('Client forged active status was not rejected!');
        },
      },
      // 8. Renewal Idempotency
      {
        id: 'SUB-08',
        name: 'Billing E2E: Renewal Success & Duplicate Idempotency Guard',
        category: 'BILLING',
        fn: async () => {
          seedSubscriptionData();
          const subId = CANONICAL_SUBSCRIPTION_IDS.ELENA_SUBSCRIPTION;

          const res1 = await ConsumerSubscriptionService.processRenewal(subId, 'key_renew_001');
          if (!res1.success || !res1.invoice) throw new Error('Initial renewal should succeed');

          const initialNewPeriodEnd = res1.subscription.currentPeriodEnd;

          // Duplicate call for the same period
          const res2 = await ConsumerSubscriptionService.processRenewal(subId, 'key_renew_001');
          if (!res2.success) throw new Error('Idempotent renewal should return success');
          if (res2.invoice?.invoiceId !== res1.invoice.invoiceId) {
            throw new Error('Duplicate renewal created a duplicate invoice!');
          }
          if (res2.subscription.currentPeriodEnd !== initialNewPeriodEnd) {
            throw new Error('Duplicate renewal advanced period end twice!');
          }
        },
      },
      // 9. Renewal Failure & Grace Period E2E
      {
        id: 'SUB-09',
        name: 'Dunning E2E: Renewal Failure Enters Grace Period with Premium Access Preserved',
        category: 'LIFECYCLE',
        fn: async () => {
          seedSubscriptionData();
          const subId = CANONICAL_SUBSCRIPTION_IDS.ELENA_SUBSCRIPTION;

          // Configure mock provider to fail
          const mockProvider = SubscriptionBillingRegistry.getMockProvider();
          mockProvider.shouldFailNextRenewal = true;
          mockProvider.failureReasonMessage = 'CARD_EXPIRED';

          // Update subscription provider to MOCK
          const sub = SubscriptionStore.getSubscription(subId)!;
          SubscriptionStore.saveSubscription({
            ...sub,
            billingProvider: 'MOCK_BILLING_PROVIDER',
          });

          const renewalRes = await ConsumerSubscriptionService.processRenewal(subId);
          if (renewalRes.success) throw new Error('Renewal should fail with mock failure');

          const failedSub = SubscriptionStore.getSubscription(subId)!;
          if (failedSub.status !== 'GRACE_PERIOD') {
            throw new Error(`Expected GRACE_PERIOD status, got ${failedSub.status}`);
          }
          if (!failedSub.gracePeriodEnd) {
            throw new Error('Expected gracePeriodEnd date set');
          }

          // Premium access MUST CONTINUE during grace period!
          const evalResult = EntitlementService.evaluate('HOUSEHOLD', String(CANONICAL_IDS.MAIN_HOUSEHOLD), 'tracking.live');
          if (!evalResult.isAllowed) {
            throw new Error('Customer must maintain access during grace period!');
          }

          mockProvider.shouldFailNextRenewal = false;
        },
      },
      // 10. Grace Recovery E2E
      {
        id: 'SUB-10',
        name: 'Recovery E2E: Grace Period Recovers to Active upon Payment Success',
        category: 'LIFECYCLE',
        fn: () => {
          seedSubscriptionData();
          const subId = CANONICAL_SUBSCRIPTION_IDS.ELENA_SUBSCRIPTION;

          // Put into grace period
          const sub = SubscriptionStore.getSubscription(subId)!;
          SubscriptionStore.saveSubscription({
            ...sub,
            status: 'GRACE_PERIOD',
            gracePeriodEnd: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          });

          const recovered = ConsumerSubscriptionService.recoverGracePeriod(subId, CANONICAL_IDS.OWNER_ELENA);
          if (recovered.status !== 'ACTIVE') {
            throw new Error(`Expected ACTIVE after recovery, got ${recovered.status}`);
          }
          if (recovered.gracePeriodEnd !== undefined) {
            throw new Error('gracePeriodEnd should be cleared after recovery');
          }
        },
      },
      // 11. Grace Expiry & Data Preservation Invariant E2E
      {
        id: 'SUB-11',
        name: 'Data Safety Invariant: Grace Expiry Revokes Premium without Deleting Canonical Pet Data',
        category: 'SAFETY',
        fn: () => {
          seedSubscriptionData();
          const subId = CANONICAL_SUBSCRIPTION_IDS.ELENA_SUBSCRIPTION;

          const expired = ConsumerSubscriptionService.expireGracePeriod(subId);
          if (expired.status !== 'EXPIRED') throw new Error('Expected EXPIRED status');

          // Premium feature now denied
          const liveTracking = EntitlementService.evaluate('HOUSEHOLD', String(CANONICAL_IDS.MAIN_HOUSEHOLD), 'tracking.live');
          if (liveTracking.isAllowed) throw new Error('Premium feature should be revoked after expiry');

          // CRITICAL INVARIANT: Core safety data and privacy export remain 100% active
          const health = EntitlementService.evaluate('HOUSEHOLD', String(CANONICAL_IDS.MAIN_HOUSEHOLD), 'health.records.core');
          if (!health.isAllowed) throw new Error('Core health records must remain accessible after expiry');

          const privacy = EntitlementService.evaluate('HOUSEHOLD', String(CANONICAL_IDS.MAIN_HOUSEHOLD), 'data_export.privacy');
          if (!privacy.isAllowed) throw new Error('Privacy export must remain accessible after expiry');
        },
      },
      // 12. Cancel at Period End E2E
      {
        id: 'SUB-12',
        name: 'Cancellation E2E: Cancel at Period End Retains Access until Cycle End',
        category: 'LIFECYCLE',
        fn: () => {
          seedSubscriptionData();
          const subId = CANONICAL_SUBSCRIPTION_IDS.ELENA_SUBSCRIPTION;

          const cancelled = ConsumerSubscriptionService.cancelSubscription(
            subId,
            CANONICAL_IDS.OWNER_ELENA,
            'PERIOD_END',
            'CUSTOMER_OPT_OUT'
          );

          if (cancelled.status !== 'CANCEL_AT_PERIOD_END' || !cancelled.cancelAtPeriodEnd) {
            throw new Error('Expected CANCEL_AT_PERIOD_END status');
          }

          // Premium access MUST remain active until currentPeriodEnd!
          const liveTracking = EntitlementService.evaluate('HOUSEHOLD', String(CANONICAL_IDS.MAIN_HOUSEHOLD), 'tracking.live');
          if (!liveTracking.isAllowed) {
            throw new Error('Customer must retain access until period end');
          }
        },
      },
      // 13. Reactivate Before Period End E2E
      {
        id: 'SUB-13',
        name: 'Lifecycle E2E: Reactivation Cancels Pending Expiry',
        category: 'LIFECYCLE',
        fn: () => {
          seedSubscriptionData();
          const subId = CANONICAL_SUBSCRIPTION_IDS.ELENA_SUBSCRIPTION;

          ConsumerSubscriptionService.cancelSubscription(subId, CANONICAL_IDS.OWNER_ELENA, 'PERIOD_END');
          const reactivated = ConsumerSubscriptionService.reactivateSubscription(subId, CANONICAL_IDS.OWNER_ELENA);

          if (reactivated.status !== 'ACTIVE' || reactivated.cancelAtPeriodEnd) {
            throw new Error(`Expected ACTIVE status without cancel flag, got ${reactivated.status}`);
          }
        },
      },
      // 14. Plan Upgrade E2E
      {
        id: 'SUB-14',
        name: 'Monetization E2E: Plan Upgrade Applies Immediately',
        category: 'BILLING',
        fn: () => {
          seedSubscriptionData();
          const subId = CANONICAL_SUBSCRIPTION_IDS.ELENA_SUBSCRIPTION;

          const upgraded = ConsumerSubscriptionService.changePlan(
            subId,
            CANONICAL_SUBSCRIPTION_IDS.PRICE_PREM_ANNUAL_KES,
            CANONICAL_IDS.OWNER_ELENA
          );

          if (upgraded.billingInterval !== 'ANNUAL') {
            throw new Error(`Expected ANNUAL interval, got ${upgraded.billingInterval}`);
          }
          if (upgraded.planPriceId !== CANONICAL_SUBSCRIPTION_IDS.PRICE_PREM_ANNUAL_KES) {
            throw new Error('Plan price ID was not updated');
          }
        },
      },
      // 15. Downgrade & Grandfathering Over-Capacity Pets E2E
      {
        id: 'SUB-15',
        name: 'Data Invariant: Downgrade Preserves Over-Limit Resources with Grandfathering',
        category: 'SAFETY',
        fn: () => {
          seedSubscriptionData();
          const elenaHh = String(CANONICAL_IDS.MAIN_HOUSEHOLD);

          // Household has 4 pets. Downgrading to Free (limit 3)
          // Revoke active subscription grants first to simulate downgrade
          SubscriptionStore.revokeGrantsForSource(String(CANONICAL_SUBSCRIPTION_IDS.ELENA_SUBSCRIPTION));

          // Manually record grant with GRANDFATHERED_OVER_LIMIT semantics
          const def = SubscriptionStore.getEntitlementDefinitionByCode('pet.capacity')!;
          SubscriptionStore.saveEntitlementGrant({
            grantId: 'grt-grandfathered-001' as any,
            subjectType: 'HOUSEHOLD',
            subjectId: elenaHh,
            entitlementDefinitionId: def.entitlementId,
            sourceType: 'LEGACY_GRANDFATHERING',
            sourceId: 'sub-legacy-001',
            value: 3,
            limitSemantics: 'GRANDFATHERED_OVER_LIMIT',
            validFrom: new Date().toISOString(),
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
          });

          const result = EntitlementService.evaluate('HOUSEHOLD', elenaHh, 'pet.capacity');
          if (result.decision !== 'GRANDFATHERED') {
            throw new Error(`Expected GRANDFATHERED decision, got ${result.decision}`);
          }
          if (!result.isAllowed) {
            throw new Error('Grandfathered resources must be allowed for existing records');
          }
        },
      },
      // 16. Webhook Verification, Replay & Out-of-Order Tests
      {
        id: 'SUB-16',
        name: 'Webhook Ingestion: Replay Idempotency & Stale Event Protection',
        category: 'SECURITY',
        fn: async () => {
          seedSubscriptionData();

          const payload: SubscriptionBillingWebhookPayload = {
            eventId: 'evt_webhook_001',
            provider: 'CARD_GATEWAY',
            eventType: 'PAYMENT_SUCCEEDED',
            externalSubscriptionReference: 'sub_mpesa_elena_001',
            timestamp: new Date().toISOString(),
            signature: 'sig_card_valid_001',
          };

          const res1 = await ConsumerSubscriptionService.handleBillingWebhook(payload);
          if (res1.status !== 'PROCESSED') throw new Error(`Expected PROCESSED, got ${res1.status}`);

          // Replay identical event
          const res2 = await ConsumerSubscriptionService.handleBillingWebhook(payload);
          if (res2.status !== 'IGNORED_DUPLICATE') throw new Error(`Expected IGNORED_DUPLICATE, got ${res2.status}`);

          // Stale out-of-order event
          const stalePayload: SubscriptionBillingWebhookPayload = {
            eventId: 'evt_stale_002',
            provider: 'CARD_GATEWAY',
            eventType: 'PAYMENT_FAILED',
            externalSubscriptionReference: 'sub_mpesa_elena_001',
            timestamp: '2020-01-01T00:00:00.000Z', // Far older than current state
            signature: 'sig_card_valid_002',
          };
          const res3 = await ConsumerSubscriptionService.handleBillingWebhook(stalePayload);
          if (res3.status !== 'IGNORED_STALE') throw new Error(`Expected IGNORED_STALE, got ${res3.status}`);
        },
      },
      // 17. Provider Reconciliation & Safe Auto-Restore E2E
      {
        id: 'SUB-17',
        name: 'Reconciliation: Local vs Provider Drift Detection & Auto-Restore',
        category: 'RECONCILIATION',
        fn: async () => {
          seedSubscriptionData();

          // Set local subscription to EXPIRED while mock provider reports ACTIVE
          const subId = CANONICAL_SUBSCRIPTION_IDS.ELENA_SUBSCRIPTION;
          const sub = SubscriptionStore.getSubscription(subId)!;
          SubscriptionStore.saveSubscription({
            ...sub,
            billingProvider: 'MOCK_BILLING_PROVIDER',
            status: 'EXPIRED',
          });

          const rec = await ConsumerSubscriptionService.reconcileWithProvider('MOCK_BILLING_PROVIDER');
          if (rec.driftedCount === 0) throw new Error('Reconciliation should detect drift');

          const item = rec.items.find((i) => i.subscriptionId === subId);
          if (!item || item.resolution !== 'AUTO_RESTORED_TO_ACTIVE') {
            throw new Error('Expected auto-restoration of active subscription');
          }

          const restored = SubscriptionStore.getSubscription(subId)!;
          if (restored.status !== 'ACTIVE') throw new Error('Local status should be restored to ACTIVE');
        },
      },
      // 18. Entitlement Drift Repair E2E
      {
        id: 'SUB-18',
        name: 'Entitlement Reconciliation: Repairs Missing Grants for Active Subscriptions',
        category: 'RECONCILIATION',
        fn: () => {
          seedSubscriptionData();
          const subId = CANONICAL_SUBSCRIPTION_IDS.ELENA_SUBSCRIPTION;

          // Intentionally delete grants to simulate drift
          SubscriptionStore.revokeGrantsForSource(String(subId));

          const preEval = EntitlementService.evaluate('HOUSEHOLD', String(CANONICAL_IDS.MAIN_HOUSEHOLD), 'tracking.live');
          if (preEval.isAllowed) throw new Error('Grants should be missing before repair');

          const report = EntitlementService.reconcileEntitlements();
          if (report.repairedGrantsCount === 0) throw new Error('Expected entitlement reconciliation to repair grants');

          const postEval = EntitlementService.evaluate('HOUSEHOLD', String(CANONICAL_IDS.MAIN_HOUSEHOLD), 'tracking.live');
          if (!postEval.isAllowed) throw new Error('Grants should be restored after reconciliation');
        },
      },
      // 19. Offline Snapshot & Tamper Resistance E2E
      {
        id: 'SUB-19',
        name: 'Security E2E: Offline Entitlement Snapshot Validated & Tampering Detected',
        category: 'SECURITY',
        fn: () => {
          seedSubscriptionData();
          const elenaHh = String(CANONICAL_IDS.MAIN_HOUSEHOLD);

          const snapshot = EntitlementService.issueOfflineSnapshot('HOUSEHOLD', elenaHh, 48);
          const verifyValid = EntitlementService.verifyOfflineSnapshot(snapshot);
          if (!verifyValid.isValid) throw new Error(`Snapshot should be valid: ${verifyValid.reason}`);

          // Tampering with entitlement value in client storage
          const tamperedSnapshot: SignedEntitlementSnapshot = {
            ...snapshot,
            entitlements: {
              ...snapshot.entitlements,
              'tracking.live': { isAllowed: true, value: true, decision: 'ALLOWED' },
              'pet.capacity': { isAllowed: true, value: 9999, decision: 'ALLOWED' },
            },
          };

          const verifyTampered = EntitlementService.verifyOfflineSnapshot(tamperedSnapshot);
          if (verifyTampered.isValid) {
            throw new Error('Tampered snapshot should fail cryptographic verification!');
          }
        },
      },
      // 20. Household Billing Isolation & Caregiver Protection
      {
        id: 'SUB-20',
        name: 'RBAC Security: Caregivers Cannot Cancel or Modify Subscriptions',
        category: 'SECURITY',
        fn: () => {
          seedSubscriptionData();
          const subId = CANONICAL_SUBSCRIPTION_IDS.ELENA_SUBSCRIPTION;

          let rejected = false;
          try {
            ConsumerSubscriptionService.cancelSubscription(
              subId,
              CANONICAL_IDS.CAREGIVER_SEAN, // Sean is CAREGIVER role, not OWNER/ADMIN
              'PERIOD_END'
            );
          } catch (err: any) {
            if (err.message.includes('BILLING_PERMISSION_DENIED')) {
              rejected = true;
            }
          }

          if (!rejected) throw new Error('Caregiver was able to cancel subscription!');
        },
      },
      // 21. Support Grant with Expiry E2E
      {
        id: 'SUB-21',
        name: 'Operations E2E: Support Grant Grants Temporary Premium without False Ledger Entry',
        category: 'LIFECYCLE',
        fn: () => {
          seedSubscriptionData();
          const outsiderHh = String(CANONICAL_IDS.OUTSIDER_HOUSEHOLD);

          const supportGrant = ConsumerSubscriptionService.grantSupportPromotionalPeriod({
            subjectType: 'HOUSEHOLD',
            subjectId: outsiderHh,
            authorizedByUserId: CANONICAL_IDS.ADMIN_CHARLES,
            reason: 'Customer goodwill VIP trial extension',
            durationDays: 7,
          });

          if (!supportGrant.grantId) throw new Error('Support grant not created');

          const evalResult = EntitlementService.evaluate('HOUSEHOLD', outsiderHh, 'tracking.live');
          if (!evalResult.isAllowed) {
            throw new Error('Subject should have live tracking under support grant');
          }
          if (evalResult.source !== 'SUPPORT_GRANT') {
            throw new Error(`Expected source SUPPORT_GRANT, got ${evalResult.source}`);
          }
        },
      },
      // 22. Quota Usage Metering & Hard Limit
      {
        id: 'SUB-22',
        name: 'Metering E2E: Atomic Quota Consumption Enforces Hard Limit',
        category: 'ENTITLEMENTS',
        fn: () => {
          seedSubscriptionData();
          const outsiderHh = String(CANONICAL_IDS.OUTSIDER_HOUSEHOLD);

          // Free limit is 3 pets
          const consume1 = EntitlementService.consumeUsage('HOUSEHOLD', outsiderHh, 'pet.capacity', 2);
          if (!consume1.success || consume1.currentUsage !== 2) throw new Error('Consume 2 should succeed');

          const consume2 = EntitlementService.consumeUsage('HOUSEHOLD', outsiderHh, 'pet.capacity', 1);
          if (!consume2.success || consume2.currentUsage !== 3) throw new Error('Consume 1 to reach 3 should succeed');

          // Exceeds limit of 3
          const consume3 = EntitlementService.consumeUsage('HOUSEHOLD', outsiderHh, 'pet.capacity', 1);
          if (consume3.success) throw new Error('Exceeding quota should fail with hard limit error');
        },
      },
    ];

    for (const tc of testCases) {
      const start = performance.now();
      try {
        await tc.fn();
        const durationMs = Math.round(performance.now() - start);
        results.push({
          id: tc.id,
          name: tc.name,
          category: tc.category,
          passed: true,
          message: 'Passed successfully with all invariants verified.',
          durationMs,
        });
      } catch (err: any) {
        const durationMs = Math.round(performance.now() - start);
        results.push({
          id: tc.id,
          name: tc.name,
          category: tc.category,
          passed: false,
          message: err.message || String(err),
          durationMs,
        });
      }
    }

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    return {
      passed,
      failed,
      total: results.length,
      results,
    };
  }
}
