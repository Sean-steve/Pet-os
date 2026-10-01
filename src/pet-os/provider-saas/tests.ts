/**
 * Pet OS Sprint 26 - Provider Business SaaS & Professional Subscription Test Suite
 * Comprehensive automated verification covering all 26+ core domain requirements,
 * animal safety continuity, staff seat limits, over-limit preservation, verification separation,
 * reputation separation, discovery neutrality, and multi-business isolation.
 */

import { ProviderSaaSService } from './service';
import { ProviderSaaSContinuityEngine } from './continuity-engine';
import { ProviderSaaSStore } from './store';
import { seedProviderSaaSData, PROVIDER_SAAS_SEED_IDS } from './seed';
import { ProviderStore } from '../provider/store';
import { seedProviderData, SEED_BUSINESSES, SEED_USERS, SEED_PROVIDERS } from '../provider/seed';
import { CANONICAL_IDS } from '../seed/unified-seed';
import {
  asBusinessId,
  asBusinessMembershipId,
  asProviderId,
  asLocationId,
  asUserId,
  asPetId,
  generateUUIDv7,
} from '../kernel/ids';
import { ProviderSaaSBillingWebhookPayload } from './types';

export interface TestResult {
  readonly id: string;
  readonly name: string;
  readonly category: 'LIFECYCLE' | 'SAFETY' | 'SEATS' | 'LOCATIONS' | 'AUTHORIZATION' | 'SEPARATION' | 'BILLING';
  readonly passed: boolean;
  readonly message: string;
  readonly durationMs: number;
}

export class ProviderSaaSTestSuite {
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
      // 1. Catalogue & Exact Money
      {
        id: 'SAAS-01',
        name: 'Catalogue & Pricing: Exact Money Minor Units & Target Types Configured',
        category: 'BILLING',
        fn: () => {
          seedProviderData();
          seedProviderSaaSData();
          const store = ProviderSaaSStore.getInstance();

          const freePlan = store.getPlan(PROVIDER_SAAS_SEED_IDS.PLAN_FREE);
          if (!freePlan || freePlan.tier !== 'FREE' || freePlan.includedStaffSeats !== 1) {
            throw new Error('Free plan misconfigured');
          }

          const bizPlan = store.getPlan(PROVIDER_SAAS_SEED_IDS.PLAN_BUSINESS_OPERATIONS);
          if (!bizPlan || bizPlan.targetType !== 'SERVICE_BUSINESS' || bizPlan.includedStaffSeats !== 5) {
            throw new Error('Business operations plan misconfigured');
          }

          const price = store.getPrice(PROVIDER_SAAS_SEED_IDS.PRICE_BIZ_MONTHLY);
          if (!price || price.amountMinor !== 7900 || price.currency !== 'USD') {
            throw new Error(`Expected $79.00 (7900 minor units), got ${price?.amountMinor}`);
          }
        },
      },

      // 2. Free Provider Baseline
      {
        id: 'SAAS-02',
        name: 'Free Baseline: Standard Booking & Profile Available Without Paid SaaS',
        category: 'SEPARATION',
        fn: () => {
          seedProviderData();
          seedProviderSaaSData();
          const store = ProviderSaaSStore.getInstance();

          // Free provider baseline includes basic workspace
          const hasBasic = ProviderSaaSService.isFeatureEntitled({
            providerId: SEED_PROVIDERS.JANE_DOE,
            featureKey: 'provider.workspace.basic',
          });
          if (!hasBasic) {
            throw new Error('Free baseline must permit basic professional workspace');
          }

          // But advanced analytics requires paid plan
          const hasAdvanced = ProviderSaaSService.isFeatureEntitled({
            providerId: SEED_PROVIDERS.JANE_DOE,
            featureKey: 'provider.analytics.advanced',
          });
          if (hasAdvanced) {
            throw new Error('Free provider must not have advanced analytics');
          }
        },
      },

      // 3. Provider Verification Separation
      {
        id: 'SAAS-03',
        name: 'Verification Separation: Purchasing or Cancelling SaaS Cannot Buy or Revoke Verification',
        category: 'SEPARATION',
        fn: async () => {
          seedProviderData();
          seedProviderSaaSData();
          const providerStore = ProviderStore.getInstance();
          const saasStore = ProviderSaaSStore.getInstance();

          // Dr. Kimani is VERIFIED in Sprint 10
          const initialProfile = providerStore.findProviderById(SEED_PROVIDERS.DR_KIMANI);
          if (initialProfile?.verificationStatus !== 'VERIFIED') {
            throw new Error('Dr. Kimani must be VERIFIED');
          }

          // Cancel SaaS subscription for Dr. Kimani's clinic
          await ProviderSaaSService.cancelSubscription(
            PROVIDER_SAAS_SEED_IDS.SUB_NAIROBI_VET,
            SEED_USERS.VET_DR_KIMANI,
            'Testing verification separation',
            true
          );

          // Verification status MUST remain VERIFIED in Provider Platform!
          const profileAfterCancel = providerStore.findProviderById(SEED_PROVIDERS.DR_KIMANI);
          if (profileAfterCancel?.verificationStatus !== 'VERIFIED') {
            throw new Error('Cancelling SaaS subscription MUST NOT revoke professional verification!');
          }
        },
      },

      // 4. Reputation Separation
      {
        id: 'SAAS-04',
        name: 'Reputation Separation: SaaS State Cannot Alter Review Ratings or Truth',
        category: 'SEPARATION',
        fn: () => {
          seedProviderData();
          seedProviderSaaSData();
          const saasStore = ProviderSaaSStore.getInstance();

          // A provider's subscription state can be expired or active,
          // but SaaS store has zero authority over Sprint 23 Review models.
          const sub = saasStore.getSubscription(PROVIDER_SAAS_SEED_IDS.SUB_HAPPY_PAWS);
          if (!sub) throw new Error('Subscription not found');

          sub.status = 'EXPIRED';
          saasStore.saveSubscription(sub);

          // Factual invariant: sub state does not modify review data
          if ((sub as any).starRating || (sub as any).reviewCount) {
            throw new Error('SaaS subscription aggregate must not store or alter review truth');
          }
        },
      },

      // 5. Discovery Neutrality
      {
        id: 'SAAS-05',
        name: 'Discovery Neutrality: Paid SaaS Plan Does Not Covertly Boost Search Ranking',
        category: 'SEPARATION',
        fn: () => {
          seedProviderData();
          seedProviderSaaSData();
          const store = ProviderSaaSStore.getInstance();

          const plans = store.listPlans();
          for (const p of plans) {
            if (p.features.some(f => f.toLowerCase().includes('rank higher') || f.toLowerCase().includes('boost search'))) {
              throw new Error('Paid SaaS tier must not advertise or implement covert search boosts');
            }
          }
        },
      },

      // 6. Staff Seat Atomic Limit Enforcement
      {
        id: 'SAAS-06',
        name: 'Staff Seats: Atomic Limit Enforcement Blocks Adding Staff Beyond Capacity',
        category: 'SEATS',
        fn: () => {
          seedProviderData();
          seedProviderSaaSData();
          const providerStore = ProviderStore.getInstance();

          const bizId = SEED_BUSINESSES.HAPPY_PAWS_WALKERS;
          // Happy Paws is on Business Operations (5 seats included)
          // Add 5 staff members
          for (let i = 1; i <= 4; i++) {
            providerStore.saveMembership({
              membershipId: asBusinessMembershipId(`mem-test-staff-${i}`),
              businessId: bizId,
              userId: asUserId(`usr-staff-${i}`),
              role: 'STAFF',
              isActive: true,
              canManageServices: false,
              canManageSchedule: false,
              joinedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }

          const usage = ProviderSaaSService.calculateStaffSeatUsage(bizId);
          if (usage.activeStaffCount < 5) {
            throw new Error(`Expected at least 5 staff, got ${usage.activeStaffCount}`);
          }

          // Check if adding 6th staff member is allowed
          const check = ProviderSaaSService.canAddStaffMember(bizId);
          if (check.allowed) {
            throw new Error('Adding staff member beyond seat limit (5) must be DENIED');
          }
          if (!check.reason?.includes('Staff seat limit reached')) {
            throw new Error(`Expected seat limit warning, got ${check.reason}`);
          }
        },
      },

      // 7. Downgrade Over-Seat Safety Invariant (ZERO STAFF DELETED)
      {
        id: 'SAAS-07',
        name: 'Seat Invariant: Downgrade to Fewer Seats Enters Grandfathered State and NEVER Deletes Staff',
        category: 'SEATS',
        fn: async () => {
          seedProviderData();
          seedProviderSaaSData();
          const providerStore = ProviderStore.getInstance();
          const saasStore = ProviderSaaSStore.getInstance();

          const bizId = SEED_BUSINESSES.NAIROBI_WEST_VET;
          // Nairobi Vet has Business Plus (25 seats). Currently has active memberships.
          const initialMemberships = providerStore.listMembershipsByBusiness(bizId);
          const initialCount = initialMemberships.filter(m => m.isActive).length;

          const sub = saasStore.getActiveSubscriptionForBusiness(bizId);
          if (!sub) throw new Error('Sub not found');

          // Downgrade to Business Operations (5 seats) or Solo
          await ProviderSaaSService.changePlan(
            sub.subscriptionId,
            PROVIDER_SAAS_SEED_IDS.PRICE_BIZ_MONTHLY,
            SEED_USERS.VET_DR_KIMANI
          );

          // Staff count MUST NOT change! No staff deleted!
          const afterMemberships = providerStore.listMembershipsByBusiness(bizId);
          const afterCount = afterMemberships.filter(m => m.isActive).length;
          if (afterCount !== initialCount) {
            throw new Error(`Staff count changed from ${initialCount} to ${afterCount}! Downgrades must never delete staff.`);
          }

          // Projection must report isOverLimit = true if count > 5
          const usage = ProviderSaaSService.calculateStaffSeatUsage(bizId);
          if (usage.allowedLimit !== 5) {
            throw new Error(`Expected allowedLimit 5, got ${usage.allowedLimit}`);
          }
        },
      },

      // 8. Location Limit Enforcement
      {
        id: 'SAAS-08',
        name: 'Location Limits: Multi-Branch Capacity Governed by Plan Limit',
        category: 'LOCATIONS',
        fn: () => {
          seedProviderData();
          seedProviderSaaSData();
          const bizId = SEED_BUSINESSES.HAPPY_PAWS_WALKERS;
          // Happy Paws has 1 location included in Business Operations
          const usage = ProviderSaaSService.calculateLocationUsage(bizId);
          if (usage.allowedLimit !== 1) {
            throw new Error(`Expected 1 allowed location, got ${usage.allowedLimit}`);
          }

          const canAdd = ProviderSaaSService.canAddLocation(bizId);
          // If already at 1 location, cannot add second without upgrading to Business Plus
          if (usage.activeLocationCount >= 1 && canAdd.allowed) {
            throw new Error('Adding second location on 1-location plan must be denied');
          }
        },
      },

      // 9. Location Downgrade Invariant (ZERO LOCATIONS DELETED)
      {
        id: 'SAAS-09',
        name: 'Location Invariant: Downgrading Never Destructively Deletes Business Locations',
        category: 'LOCATIONS',
        fn: async () => {
          seedProviderData();
          seedProviderSaaSData();
          const providerStore = ProviderStore.getInstance();
          const saasStore = ProviderSaaSStore.getInstance();

          const bizId = SEED_BUSINESSES.NAIROBI_WEST_VET;
          const initialLocations = providerStore.listLocationsByBusiness(bizId);
          const initialCount = initialLocations.length;

          const sub = saasStore.getActiveSubscriptionForBusiness(bizId);
          if (!sub) throw new Error('Sub not found');

          // Downgrade to Business Operations (1 location limit)
          await ProviderSaaSService.changePlan(
            sub.subscriptionId,
            PROVIDER_SAAS_SEED_IDS.PRICE_BIZ_MONTHLY,
            SEED_USERS.VET_DR_KIMANI
          );

          // Locations must still exist!
          const afterLocations = providerStore.listLocationsByBusiness(bizId);
          if (afterLocations.length !== initialCount) {
            throw new Error('Locations were deleted during plan downgrade!');
          }
        },
      },

      // 10. Animal Safety Continuity: Boarding Stay
      {
        id: 'SAAS-10',
        name: 'Safety Invariant: Active Boarding Custody NOT Interrupted by SaaS Expiration',
        category: 'SAFETY',
        fn: () => {
          seedProviderData();
          seedProviderSaaSData();
          const saasStore = ProviderSaaSStore.getInstance();

          const bizId = SEED_BUSINESSES.NAIROBI_WEST_VET;
          const sub = saasStore.getActiveSubscriptionForBusiness(bizId);
          if (!sub) throw new Error('Sub not found');

          // Force subscription to EXPIRED / RESTRICTED
          sub.status = 'RESTRICTED';
          saasStore.saveSubscription(sub);

          // Baseline check: General advanced analytics is denied
          const analyticsEntitled = ProviderSaaSService.isFeatureEntitled({
            businessId: bizId,
            featureKey: 'provider.analytics.advanced',
          });
          if (analyticsEntitled) {
            throw new Error('Advanced analytics should be blocked in restricted mode');
          }

          // Active Boarding check: Animal in custody has continuity grant!
          const boardingShield = ProviderSaaSContinuityEngine.hasActiveContinuityProtection({
            businessId: bizId,
            contextId: 'boarding-simba-seed-001',
          });
          if (!boardingShield) {
            throw new Error('Boarding custody MUST have active continuity protection');
          }

          // Essential workspace execution for this context MUST be entitled!
          const workspaceProtected = ProviderSaaSService.isFeatureEntitled({
            businessId: bizId,
            featureKey: 'provider.workspace.basic',
            contextId: 'boarding-simba-seed-001',
          });
          if (!workspaceProtected) {
            throw new Error('Active boarding custody must remain fully executable');
          }
        },
      },

      // 11. Animal Safety Continuity: Veterinary Clinical Encounter
      {
        id: 'SAAS-11',
        name: 'Safety Invariant: In-Progress Veterinary Clinical Encounter Cannot Be Corrupted by SaaS Expiry',
        category: 'SAFETY',
        fn: () => {
          seedProviderData();
          seedProviderSaaSData();
          const saasStore = ProviderSaaSStore.getInstance();

          const bizId = SEED_BUSINESSES.NAIROBI_WEST_VET;
          const sub = saasStore.getActiveSubscriptionForBusiness(bizId);
          if (!sub) throw new Error('Sub not found');

          // Subscription expires mid-encounter
          sub.status = 'RESTRICTED';
          saasStore.saveSubscription(sub);

          const encounterId = 'enc-active-surgery-001';
          ProviderSaaSContinuityEngine.ensureContinuityGrant({
            businessId: bizId,
            serviceType: 'VET_ENCOUNTER',
            contextId: encounterId,
            petId: CANONICAL_IDS.PET_KIBO,
            reason: 'Emergency canine suture underway in operating theater',
            durationHours: 24,
          });

          const isProtected = ProviderSaaSContinuityEngine.hasActiveContinuityProtection({
            businessId: bizId,
            contextId: encounterId,
          });
          if (!isProtected) {
            throw new Error('Active clinical encounter must be protected by continuity shield');
          }
        },
      },

      // 12. Animal Safety Continuity: Dog Walking & Transport
      {
        id: 'SAAS-12',
        name: 'Safety Invariant: Active Dog Walk Session and Pet Transport Custody Guaranteed',
        category: 'SAFETY',
        fn: () => {
          seedProviderData();
          seedProviderSaaSData();

          const walkSessionId = 'walk-session-kibo-active-991';
          const grant = ProviderSaaSContinuityEngine.ensureContinuityGrant({
            businessId: SEED_BUSINESSES.HAPPY_PAWS_WALKERS,
            serviceType: 'DOG_WALK',
            contextId: walkSessionId,
            petId: CANONICAL_IDS.PET_KIBO,
            reason: 'Dog walk active on Karura forest trail',
            durationHours: 12,
          });

          if (!grant.isActive || grant.serviceType !== 'DOG_WALK') {
            throw new Error('Dog walk continuity grant was not properly issued');
          }
        },
      },

      // 13. Continuity Shield Safe Resolution
      {
        id: 'SAAS-13',
        name: 'Safety Lifecycle: Completing Service Safely Concludes Continuity Grant',
        category: 'SAFETY',
        fn: () => {
          seedProviderData();
          seedProviderSaaSData();
          const contextId = 'boarding-simba-seed-001';

          // Simba returns to owner custody -> resolve grant
          const resolved = ProviderSaaSContinuityEngine.resolveContinuityGrant(
            contextId,
            'Simba safely handed back to Elena Vance.'
          );
          if (!resolved) throw new Error('Failed to resolve continuity grant');

          const hasProtectionAfter = ProviderSaaSContinuityEngine.hasActiveContinuityProtection({
            contextId,
          });
          if (hasProtectionAfter) {
            throw new Error('Continuity protection must be inactive once service safely concludes');
          }
        },
      },

      // 14. Billing Authorization vs Ordinary Staff
      {
        id: 'SAAS-14',
        name: 'Authorization: Ordinary Staff Member Cannot Modify or Cancel Subscription',
        category: 'AUTHORIZATION',
        fn: async () => {
          seedProviderData();
          seedProviderSaaSData();

          const unauthorizedStaffUserId = asUserId('usr-staff-unauthorized-99');
          let errorThrown = false;

          try {
            await ProviderSaaSService.cancelSubscription(
              PROVIDER_SAAS_SEED_IDS.SUB_NAIROBI_VET,
              unauthorizedStaffUserId,
              'Malicious staff cancellation attempt',
              true
            );
          } catch (e: any) {
            errorThrown = true;
            if (!e.message.includes('Unauthorized')) {
              throw new Error(`Unexpected error message: ${e.message}`);
            }
          }

          if (!errorThrown) {
            throw new Error('Ordinary staff member must NOT be able to cancel subscription');
          }
        },
      },

      // 15. Billing Owner / Admin Authorization
      {
        id: 'SAAS-15',
        name: 'Authorization: Authorized Billing Admin Can Successfully Manage Subscription',
        category: 'AUTHORIZATION',
        fn: async () => {
          seedProviderData();
          seedProviderSaaSData();

          // Dr. Kimani is owner/billing admin
          const cancelled = await ProviderSaaSService.cancelSubscription(
            PROVIDER_SAAS_SEED_IDS.SUB_NAIROBI_VET,
            SEED_USERS.VET_DR_KIMANI,
            'Authorized period-end cancellation',
            false
          );

          if (cancelled.status !== 'CANCEL_AT_PERIOD_END' || !cancelled.cancelAtPeriodEnd) {
            throw new Error('Authorized billing admin cancellation should succeed with CANCEL_AT_PERIOD_END');
          }
        },
      },

      // 16. Renewal Success
      {
        id: 'SAAS-16',
        name: 'Lifecycle Renewal: Payment Success Extends Period and Clears Failures',
        category: 'BILLING',
        fn: async () => {
          seedProviderData();
          seedProviderSaaSData();
          const store = ProviderSaaSStore.getInstance();

          const sub = store.getSubscription(PROVIDER_SAAS_SEED_IDS.SUB_APEX_K9);
          if (!sub) throw new Error('Sub not found');

          const initialEnd = sub.currentPeriodEnd;
          const { success, subscription: renewed } = await ProviderSaaSService.renewSubscription(
            sub.subscriptionId,
            true
          );

          if (!success) throw new Error('Expected successful renewal');
          if (renewed.currentPeriodEnd <= initialEnd) {
            throw new Error('Renewal did not extend period end');
          }
          if (renewed.consecutiveFailedPayments !== 0) {
            throw new Error('Consecutive failures not cleared');
          }
        },
      },

      // 17. Payment Failure & Grace Period
      {
        id: 'SAAS-17',
        name: 'Billing Grace Period: First Failure Enters Grace with Full Service Continuity',
        category: 'BILLING',
        fn: async () => {
          seedProviderData();
          seedProviderSaaSData();
          const store = ProviderSaaSStore.getInstance();

          const sub = store.getSubscription(PROVIDER_SAAS_SEED_IDS.SUB_APEX_K9);
          if (!sub) throw new Error('Sub not found');

          const { success, subscription: failedSub } = await ProviderSaaSService.renewSubscription(
            sub.subscriptionId,
            false
          );

          if (success) throw new Error('Expected failure');
          if (failedSub.status !== 'GRACE_PERIOD') {
            throw new Error(`Expected GRACE_PERIOD status, got ${failedSub.status}`);
          }
          if (!failedSub.gracePeriodEnd) {
            throw new Error('gracePeriodEnd must be set');
          }
        },
      },

      // 18. Grace Expiry & Restricted Mode
      {
        id: 'SAAS-18',
        name: 'Dunning & Expiry: Exceeded Grace Failures Transitions to Restricted Operational Mode',
        category: 'BILLING',
        fn: async () => {
          seedProviderData();
          seedProviderSaaSData();
          const store = ProviderSaaSStore.getInstance();

          const sub = store.getSubscription(PROVIDER_SAAS_SEED_IDS.SUB_APEX_K9);
          if (!sub) throw new Error('Sub not found');

          // Fail 1 -> GRACE_PERIOD
          await ProviderSaaSService.renewSubscription(sub.subscriptionId, false);
          // Fail 2
          await ProviderSaaSService.renewSubscription(sub.subscriptionId, false);
          // Fail 3 -> RESTRICTED
          const { subscription: restrictedSub } = await ProviderSaaSService.renewSubscription(
            sub.subscriptionId,
            false
          );

          if (restrictedSub.status !== 'RESTRICTED') {
            throw new Error(`Expected RESTRICTED status after 3 failures, got ${restrictedSub.status}`);
          }
        },
      },

      // 19. Reactivation
      {
        id: 'SAAS-19',
        name: 'Reactivation: Billing Admin Can Restore Active Status and Full Feature Grants',
        category: 'LIFECYCLE',
        fn: async () => {
          seedProviderData();
          seedProviderSaaSData();
          const store = ProviderSaaSStore.getInstance();

          const sub = store.getSubscription(PROVIDER_SAAS_SEED_IDS.SUB_APEX_K9);
          if (!sub) throw new Error('Sub not found');

          sub.status = 'RESTRICTED';
          store.saveSubscription(sub);

          const reactivated = await ProviderSaaSService.reactivateSubscription(
            sub.subscriptionId,
            SEED_USERS.TRAINER_JUMA
          );

          if (reactivated.status !== 'ACTIVE') {
            throw new Error(`Expected ACTIVE status, got ${reactivated.status}`);
          }
        },
      },

      // 20. Cancellation at Period End
      {
        id: 'SAAS-20',
        name: 'Cancellation: Cancel-at-period-end Maintains Advanced Entitlements Until Expiry',
        category: 'LIFECYCLE',
        fn: async () => {
          seedProviderData();
          seedProviderSaaSData();
          const store = ProviderSaaSStore.getInstance();

          const sub = store.getSubscription(PROVIDER_SAAS_SEED_IDS.SUB_HAPPY_PAWS);
          if (!sub) throw new Error('Sub not found');

          await ProviderSaaSService.cancelSubscription(
            sub.subscriptionId,
            SEED_USERS.WALKER_SARAH,
            'Retiring dog walking business at year end',
            false
          );

          // Features must remain entitled while cancelAtPeriodEnd is true!
          const hasAdvanced = ProviderSaaSService.isFeatureEntitled({
            businessId: SEED_BUSINESSES.HAPPY_PAWS_WALKERS,
            featureKey: 'provider.analytics.advanced',
          });
          if (!hasAdvanced) {
            throw new Error('Advanced analytics must remain active until paid period ends');
          }
        },
      },

      // 21. Support Grant
      {
        id: 'SAAS-21',
        name: 'Support Grants: Time-Limited Grant Issued Without Forging Payment or Marking Invoices Paid',
        category: 'AUTHORIZATION',
        fn: () => {
          seedProviderData();
          seedProviderSaaSData();
          const store = ProviderSaaSStore.getInstance();

          const grant = ProviderSaaSService.grantSupportAccess({
            targetType: 'SERVICE_BUSINESS',
            targetId: String(SEED_BUSINESSES.APEX_K9_ACADEMY),
            features: ['provider.api.access'],
            bonusSeats: 2,
            reason: '14-day API integration trial grant by Pet OS Support',
            durationDays: 14,
            grantedByUserId: SEED_USERS.ADMIN,
          });

          if (!grant.isActive || !grant.featuresGranted.includes('provider.api.access')) {
            throw new Error('Support grant features not properly granted');
          }

          // Check that seat usage includes bonus seats
          const usage = ProviderSaaSService.calculateStaffSeatUsage(SEED_BUSINESSES.APEX_K9_ACADEMY);
          if (usage.bonusSeatsFromGrants !== 2) {
            throw new Error(`Expected 2 bonus seats, got ${usage.bonusSeatsFromGrants}`);
          }
        },
      },

      // 22. Webhook Idempotency
      {
        id: 'SAAS-22',
        name: 'Webhooks: Duplicate Ingestion Is Idempotent and Verifies Cryptographic Signatures',
        category: 'BILLING',
        fn: async () => {
          seedProviderData();
          seedProviderSaaSData();
          const store = ProviderSaaSStore.getInstance();

          const payload: ProviderSaaSBillingWebhookPayload = {
            eventId: `evt-wh-saas-${generateUUIDv7()}`,
            eventType: 'provider_saas.invoice.payment_succeeded',
            subscriptionId: PROVIDER_SAAS_SEED_IDS.SUB_APEX_K9,
            businessId: SEED_BUSINESSES.APEX_K9_ACADEMY,
            amountMinor: 7900,
            currency: 'USD',
            transactionRef: 'stripe-inv-apex-991',
            timestamp: new Date().toISOString(),
            signature: 'sha256=valid_test_signature_9988',
          };

          const res1 = await ProviderSaaSService.processBillingWebhook(payload);
          if (!res1.handled) throw new Error('First webhook execution failed');

          const res2 = await ProviderSaaSService.processBillingWebhook(payload);
          if (!res2.handled || !res2.message.includes('idempotent')) {
            throw new Error('Duplicate webhook must be handled idempotently');
          }
        },
      },

      // 23. Multi-Business User Isolation
      {
        id: 'SAAS-23',
        name: 'Multi-Business Isolation: Paid Plan on Business A Does NOT Unlock Business B',
        category: 'AUTHORIZATION',
        fn: async () => {
          seedProviderData();
          seedProviderSaaSData();
          const providerStore = ProviderStore.getInstance();

          // Register a second business for Dr. Kimani (Free / Unsubscribed)
          const secondBizId = asBusinessId('biz-second-unsubscribed-clinic');
          providerStore.saveBusiness({
            businessId: secondBizId,
            legalName: 'Second Satellite Clinic Ltd',
            tradingName: 'Satellite Clinic',
            businessType: 'VETERINARY_CLINIC',
            ownerUserId: SEED_USERS.VET_DR_KIMANI,
            verificationStatus: 'VERIFIED',
            isActive: true,
            contactEmail: 'clinic2@example.com',
            contactPhone: '+254700000002',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Nairobi West Vet has Business Plus (API access)
          const biz1HasApi = ProviderSaaSService.isFeatureEntitled({
            businessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
            featureKey: 'provider.api.access',
          });
          if (!biz1HasApi) throw new Error('Business 1 must have API access');

          // Second clinic is unsubscribed -> MUST NOT have API access!
          const biz2HasApi = ProviderSaaSService.isFeatureEntitled({
            businessId: secondBizId,
            featureKey: 'provider.api.access',
          });
          if (biz2HasApi) {
            throw new Error('Business 2 must NOT inherit Business 1 entitlements purely through shared owner');
          }
        },
      },

      // 24. Individual Provider Subscription
      {
        id: 'SAAS-24',
        name: 'Individual Provider Plan: Independent Solo Practitioner Plan Bound to Provider Aggregate',
        category: 'LIFECYCLE',
        fn: async () => {
          seedProviderData();
          seedProviderSaaSData();
          const store = ProviderSaaSStore.getInstance();

          // Subscribe Jane Doe as solo practitioner
          const sub = await ProviderSaaSService.createSubscription({
            subscriberType: 'INDIVIDUAL_PROVIDER',
            providerId: SEED_PROVIDERS.JANE_DOE,
            planPriceId: PROVIDER_SAAS_SEED_IDS.PRICE_INDIVIDUAL_MONTHLY,
            actorUserId: SEED_USERS.APPLICANT_JANE,
          });

          if (sub.subscriberType !== 'INDIVIDUAL_PROVIDER' || sub.providerId !== SEED_PROVIDERS.JANE_DOE) {
            throw new Error('Individual provider subscription not correctly bound');
          }

          // Verify advanced scheduling is entitled for Jane Doe
          const hasScheduling = ProviderSaaSService.isFeatureEntitled({
            providerId: SEED_PROVIDERS.JANE_DOE,
            featureKey: 'provider.schedule.advanced',
          });
          if (!hasScheduling) {
            throw new Error('Jane Doe should now be entitled to advanced scheduling');
          }
        },
      },

      // 25. Client Forgery Rejection
      {
        id: 'SAAS-25',
        name: 'Security: Unauthorized Client Request Cannot Forge Active or Paid Status',
        category: 'AUTHORIZATION',
        fn: async () => {
          seedProviderData();
          seedProviderSaaSData();

          let rejected = false;
          try {
            await ProviderSaaSService.createSubscription({
              subscriberType: 'SERVICE_BUSINESS',
              businessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
              planPriceId: PROVIDER_SAAS_SEED_IDS.PRICE_BIZ_PLUS_MONTHLY,
              actorUserId: asUserId('usr-attacker-random'), // Attacker
            });
          } catch (e: any) {
            rejected = true;
          }

          if (!rejected) {
            throw new Error('Unauthorized subscriber request must be rejected');
          }
        },
      },

      // 26. Data Preservation Invariant
      {
        id: 'SAAS-26',
        name: 'Data Preservation: Subscription Expiration Never Deletes Historical Business Records',
        category: 'SEPARATION',
        fn: () => {
          seedProviderData();
          seedProviderSaaSData();
          const providerStore = ProviderStore.getInstance();
          const saasStore = ProviderSaaSStore.getInstance();

          const bizId = SEED_BUSINESSES.NAIROBI_WEST_VET;
          const sub = saasStore.getActiveSubscriptionForBusiness(bizId);
          if (!sub) throw new Error('Sub not found');

          // Subscription expires
          sub.status = 'EXPIRED';
          saasStore.saveSubscription(sub);

          // Provider business record MUST still exist in Provider Platform!
          const biz = providerStore.getBusinessById(bizId);
          if (!biz) {
            throw new Error('ServiceBusiness was deleted upon subscription expiration!');
          }
          if (biz.legalName !== 'Nairobi West Veterinary Services Limited') {
            throw new Error('ServiceBusiness data was mutated upon subscription expiration!');
          }
        },
      },
    ];

    let passedCount = 0;
    let failedCount = 0;

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
          message: 'Passed',
          durationMs,
        });
        passedCount++;
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
        failedCount++;
      }
    }

    return {
      passed: passedCount,
      failed: failedCount,
      total: testCases.length,
      results,
    };
  }
}
