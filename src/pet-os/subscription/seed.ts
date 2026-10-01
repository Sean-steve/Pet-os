/**
 * Pet OS Sprint 24 — Subscription & Premium Entitlements Canonical Seed Data
 * Populates standard plans, versioning, multi-currency prices, entitlement bundles,
 * and Elena's Household active Premium subscription.
 */

import {
  asConsumerPlanId,
  asPlanVersionId,
  asPlanPriceId,
  asEntitlementDefinitionId,
  asEntitlementBundleId,
  asEntitlementGrantId,
  asConsumerSubscriptionId,
  asSubscriptionBillingAgreementId,
  asSubscriptionInvoiceId,
  asSubscriptionStatusHistoryId,
  asPaymentTransactionId,
  asFinancialReceiptId,
} from '../kernel/ids';
import {
  ConsumerPlan,
  PlanVersion,
  PlanPrice,
  EntitlementDefinition,
  EntitlementBundle,
  ConsumerSubscription,
  SubscriptionBillingAgreement,
  SubscriptionInvoice,
} from './types';
import { SubscriptionStore } from './store';
import { CANONICAL_IDS } from '../seed/unified-seed';
import { IdentityStore } from '../identity/store';
import { asMembershipId, generateUUIDv7 } from '../kernel/ids';

export const CANONICAL_SUBSCRIPTION_IDS = {
  PLAN_FREE: asConsumerPlanId('plan-consumer-free-001'),
  PLAN_PREMIUM: asConsumerPlanId('plan-consumer-premium-001'),

  VERSION_FREE_V1: asPlanVersionId('plv-free-v1-001'),
  VERSION_PREMIUM_V1: asPlanVersionId('plv-prem-v1-001'),
  VERSION_PREMIUM_V2_DRAFT: asPlanVersionId('plv-prem-v2-draft-001'),

  PRICE_PREM_MONTHLY_KES: asPlanPriceId('prc-prem-mo-kes-001'),
  PRICE_PREM_ANNUAL_KES: asPlanPriceId('prc-prem-an-kes-001'),
  PRICE_PREM_MONTHLY_USD: asPlanPriceId('prc-prem-mo-usd-001'),
  PRICE_PREM_ANNUAL_USD: asPlanPriceId('prc-prem-an-usd-001'),

  BUNDLE_FREE_V1: asEntitlementBundleId('bdl-free-v1-001'),
  BUNDLE_PREMIUM_V1: asEntitlementBundleId('bdl-prem-v1-001'),

  ELENA_SUBSCRIPTION: asConsumerSubscriptionId('sub-elena-prem-001'),
  ELENA_AGREEMENT: asSubscriptionBillingAgreementId('agr-elena-mpesa-001'),
  ELENA_INITIAL_INVOICE: asSubscriptionInvoiceId('inv-elena-init-001'),
};

export function seedSubscriptionData(): void {
  SubscriptionStore.reset();

  // Ensure canonical household memberships exist in IdentityStore
  const nowIso = new Date().toISOString();
  if (IdentityStore.listMembersForHousehold(CANONICAL_IDS.MAIN_HOUSEHOLD).length === 0) {
    IdentityStore.saveMembership({
      membershipId: asMembershipId('mem-elena-main-owner'),
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      userId: CANONICAL_IDS.OWNER_ELENA,
      role: 'HOUSEHOLD_OWNER',
      status: 'ACTIVE',
      joinedAt: nowIso,
      updatedAt: nowIso,
    });
    IdentityStore.saveMembership({
      membershipId: asMembershipId('mem-sean-main-caregiver'),
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      userId: CANONICAL_IDS.CAREGIVER_SEAN,
      role: 'CAREGIVER',
      status: 'ACTIVE',
      joinedAt: nowIso,
      updatedAt: nowIso,
    });
  }

  if (IdentityStore.listMembersForHousehold(CANONICAL_IDS.OUTSIDER_HOUSEHOLD).length === 0) {
    IdentityStore.saveMembership({
      membershipId: asMembershipId('mem-brian-outsider-owner'),
      householdId: CANONICAL_IDS.OUTSIDER_HOUSEHOLD,
      userId: CANONICAL_IDS.OUTSIDER_BRIAN,
      role: 'HOUSEHOLD_OWNER',
      status: 'ACTIVE',
      joinedAt: nowIso,
      updatedAt: nowIso,
    });
  }

  // 1. ENTITLEMENT DEFINITIONS
  const defs: EntitlementDefinition[] = [
    {
      entitlementId: asEntitlementDefinitionId('ent-pet-capacity'),
      code: 'pet.capacity',
      displayName: 'Pet Profile Capacity',
      category: 'PET_CORE',
      type: 'CAPACITY',
      defaultValue: 3,
      isSafetyCritical: false,
      description: 'Maximum number of active pet digital twins managed in household.',
    },
    {
      entitlementId: asEntitlementDefinitionId('ent-tracking-live'),
      code: 'tracking.live',
      displayName: 'Live GPS Real-Time Tracking',
      category: 'TRACKING',
      type: 'BOOLEAN',
      defaultValue: false,
      isSafetyCritical: false,
      description: 'Sub-second real-time GPS breadcrumbs and live tracking map.',
    },
    {
      entitlementId: asEntitlementDefinitionId('ent-tracking-history'),
      code: 'tracking.history.extended',
      displayName: 'Location History Retention',
      category: 'TRACKING',
      type: 'HISTORY_WINDOW',
      defaultValue: 7, // 7 days free
      isSafetyCritical: false,
      description: 'Retention window for full GPS telemetry and walking routes in days.',
    },
    {
      entitlementId: asEntitlementDefinitionId('ent-geofence-adv'),
      code: 'geofence.advanced',
      displayName: 'Active Safe Geofences',
      category: 'TRACKING',
      type: 'CAPACITY',
      defaultValue: 1, // 1 circular zone free
      isSafetyCritical: false,
      description: 'Number of simultaneous active polygon and circular safety boundaries.',
    },
    {
      entitlementId: asEntitlementDefinitionId('ent-passport-export'),
      code: 'passport.advanced_export',
      displayName: 'Certified Pet Passport PDF Export',
      category: 'DOCUMENTS',
      type: 'BOOLEAN',
      defaultValue: false,
      isSafetyCritical: false,
      description: 'Airline and border authority multi-language certified medical dossier.',
    },
    {
      entitlementId: asEntitlementDefinitionId('ent-analytics-adv'),
      code: 'analytics.advanced',
      displayName: 'Predictive Biometric Analytics',
      category: 'ANALYTICS',
      type: 'BOOLEAN',
      defaultValue: false,
      isSafetyCritical: false,
      description: 'Predictive health trends, weight trajectories, and activity metrics.',
    },
    {
      entitlementId: asEntitlementDefinitionId('ent-automation-adv'),
      code: 'automation.advanced',
      displayName: 'Multi-Carer Automated Reminders',
      category: 'AUTOMATION',
      type: 'BOOLEAN',
      defaultValue: false,
      isSafetyCritical: false,
      description: 'Automated care escalation and multi-member reminder schedules.',
    },
    {
      entitlementId: asEntitlementDefinitionId('ent-docs-storage'),
      code: 'documents.storage.extended',
      displayName: 'Document Cloud Storage',
      category: 'DOCUMENTS',
      type: 'QUOTA',
      defaultValue: 524288000, // 500 MB free
      isSafetyCritical: false,
      description: 'Cloud document vault storage limit in bytes.',
    },
    {
      entitlementId: asEntitlementDefinitionId('ent-ai-coach'),
      code: 'ai.pet_coach',
      displayName: 'AI Pet Wellness Coach',
      category: 'AI',
      type: 'BOOLEAN',
      defaultValue: false,
      isSafetyCritical: false,
      description: 'AI-assisted behavioral coaching and nutrition guidance.',
    },
    // SAFETY-CRITICAL & LEGAL ENTITLEMENTS (Never paywalled or stripped)
    {
      entitlementId: asEntitlementDefinitionId('ent-privacy-export'),
      code: 'data_export.privacy',
      displayName: 'Privacy & Legal Data Export',
      category: 'SAFETY',
      type: 'BOOLEAN',
      defaultValue: true,
      isSafetyCritical: true,
      description: 'Legally mandated GDPR/Data Protection export of personal and pet data.',
    },
    {
      entitlementId: asEntitlementDefinitionId('ent-pet-profile-core'),
      code: 'pet.profile.core',
      displayName: 'Core Pet Digital Twin & ID',
      category: 'PET_CORE',
      type: 'BOOLEAN',
      defaultValue: true,
      isSafetyCritical: true,
      description: 'Core pet identification, breed, microchip, and physical profile.',
    },
    {
      entitlementId: asEntitlementDefinitionId('ent-health-core'),
      code: 'health.records.core',
      displayName: 'Core Health & Vaccine Records',
      category: 'SAFETY',
      type: 'BOOLEAN',
      defaultValue: true,
      isSafetyCritical: true,
      description: 'Access to veterinary health records, vaccinations, and medication logs.',
    },
    {
      entitlementId: asEntitlementDefinitionId('ent-lost-pet-core'),
      code: 'lost_pet.core',
      displayName: 'Emergency Lost Pet Recovery',
      category: 'SAFETY',
      type: 'BOOLEAN',
      defaultValue: true,
      isSafetyCritical: true,
      description: 'Critical lost pet broadcast and emergency community recovery workflow.',
    },
  ];

  for (const def of defs) {
    SubscriptionStore.saveEntitlementDefinition(def);
  }

  // 2. ENTITLEMENT BUNDLES
  const freeBundle: EntitlementBundle = {
    entitlementBundleId: CANONICAL_SUBSCRIPTION_IDS.BUNDLE_FREE_V1,
    name: 'Free Baseline Core Bundle',
    version: 1,
    items: [
      { entitlementDefinitionId: asEntitlementDefinitionId('ent-pet-capacity'), value: 3, limitSemantics: 'HARD_LIMIT' },
      { entitlementDefinitionId: asEntitlementDefinitionId('ent-tracking-live'), value: false },
      { entitlementDefinitionId: asEntitlementDefinitionId('ent-tracking-history'), value: 7 },
      { entitlementDefinitionId: asEntitlementDefinitionId('ent-geofence-adv'), value: 1 },
      { entitlementDefinitionId: asEntitlementDefinitionId('ent-passport-export'), value: false },
      { entitlementDefinitionId: asEntitlementDefinitionId('ent-analytics-adv'), value: false },
      { entitlementDefinitionId: asEntitlementDefinitionId('ent-automation-adv'), value: false },
      { entitlementDefinitionId: asEntitlementDefinitionId('ent-docs-storage'), value: 524288000, limitSemantics: 'SOFT_LIMIT' },
      { entitlementDefinitionId: asEntitlementDefinitionId('ent-ai-coach'), value: false },
    ],
  };
  SubscriptionStore.saveEntitlementBundle(freeBundle);

  const premiumBundle: EntitlementBundle = {
    entitlementBundleId: CANONICAL_SUBSCRIPTION_IDS.BUNDLE_PREMIUM_V1,
    name: 'Pet OS Premium Care Bundle',
    version: 1,
    items: [
      { entitlementDefinitionId: asEntitlementDefinitionId('ent-pet-capacity'), value: 15, limitSemantics: 'HARD_LIMIT' },
      { entitlementDefinitionId: asEntitlementDefinitionId('ent-tracking-live'), value: true },
      { entitlementDefinitionId: asEntitlementDefinitionId('ent-tracking-history'), value: 365 },
      { entitlementDefinitionId: asEntitlementDefinitionId('ent-geofence-adv'), value: 50 },
      { entitlementDefinitionId: asEntitlementDefinitionId('ent-passport-export'), value: true },
      { entitlementDefinitionId: asEntitlementDefinitionId('ent-analytics-adv'), value: true },
      { entitlementDefinitionId: asEntitlementDefinitionId('ent-automation-adv'), value: true },
      { entitlementDefinitionId: asEntitlementDefinitionId('ent-docs-storage'), value: 26843545600, limitSemantics: 'SOFT_LIMIT' }, // 25 GB
      { entitlementDefinitionId: asEntitlementDefinitionId('ent-ai-coach'), value: true },
    ],
  };
  SubscriptionStore.saveEntitlementBundle(premiumBundle);

  // 3. PLANS
  const freePlan: ConsumerPlan = {
    planId: CANONICAL_SUBSCRIPTION_IDS.PLAN_FREE,
    code: 'FREE',
    displayName: 'Pet OS Free Baseline',
    description: 'Essential pet care, health tracking, and baseline safety for every pet owner.',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  SubscriptionStore.savePlan(freePlan);

  const premiumPlan: ConsumerPlan = {
    planId: CANONICAL_SUBSCRIPTION_IDS.PLAN_PREMIUM,
    code: 'PREMIUM',
    displayName: 'Pet OS Premium Care',
    description: 'Complete peace of mind: live GPS tracking, 365-day history, certified passports, and multi-pet care.',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  SubscriptionStore.savePlan(premiumPlan);

  // 4. PLAN VERSIONS
  const freeV1: PlanVersion = {
    planVersionId: CANONICAL_SUBSCRIPTION_IDS.VERSION_FREE_V1,
    planId: freePlan.planId,
    version: 1,
    displayName: 'Free Core Baseline v1',
    description: 'Standard baseline tier with up to 3 pets and 7-day tracking.',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    status: 'ACTIVE',
    entitlementBundleId: freeBundle.entitlementBundleId,
    limits: {
      maxPets: 3,
      storageQuotaBytes: 524288000,
      locationHistoryDays: 7,
      geofenceLimit: 1,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  SubscriptionStore.savePlanVersion(freeV1);

  const premiumV1: PlanVersion = {
    planVersionId: CANONICAL_SUBSCRIPTION_IDS.VERSION_PREMIUM_V1,
    planId: premiumPlan.planId,
    version: 1,
    displayName: 'Premium Care v1',
    description: 'Full premium experience with live tracking, 15 pets, and 25GB vault.',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    status: 'ACTIVE',
    entitlementBundleId: premiumBundle.entitlementBundleId,
    limits: {
      maxPets: 15,
      storageQuotaBytes: 26843545600,
      locationHistoryDays: 365,
      geofenceLimit: 50,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  SubscriptionStore.savePlanVersion(premiumV1);

  // 5. PLAN PRICES
  const prices: PlanPrice[] = [
    {
      planPriceId: CANONICAL_SUBSCRIPTION_IDS.PRICE_PREM_MONTHLY_KES,
      planVersionId: premiumV1.planVersionId,
      currency: 'KES',
      billingInterval: 'MONTHLY',
      amountMinor: 120000, // KES 1,200 / month
      marketCountry: 'KE',
      status: 'ACTIVE',
      externalPriceReference: 'price_kes_prem_monthly_v1',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      planPriceId: CANONICAL_SUBSCRIPTION_IDS.PRICE_PREM_ANNUAL_KES,
      planVersionId: premiumV1.planVersionId,
      currency: 'KES',
      billingInterval: 'ANNUAL',
      amountMinor: 1150000, // KES 11,500 / year (save 20%)
      marketCountry: 'KE',
      status: 'ACTIVE',
      externalPriceReference: 'price_kes_prem_annual_v1',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      planPriceId: CANONICAL_SUBSCRIPTION_IDS.PRICE_PREM_MONTHLY_USD,
      planVersionId: premiumV1.planVersionId,
      currency: 'USD',
      billingInterval: 'MONTHLY',
      amountMinor: 999, // $9.99 / month
      marketCountry: 'US',
      status: 'ACTIVE',
      externalPriceReference: 'price_usd_prem_monthly_v1',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      planPriceId: CANONICAL_SUBSCRIPTION_IDS.PRICE_PREM_ANNUAL_USD,
      planVersionId: premiumV1.planVersionId,
      currency: 'USD',
      billingInterval: 'ANNUAL',
      amountMinor: 9900, // $99.00 / year
      marketCountry: 'US',
      status: 'ACTIVE',
      externalPriceReference: 'price_usd_prem_annual_v1',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  for (const price of prices) {
    SubscriptionStore.savePlanPrice(price);
  }

  // 6. ELENA'S HOUSEHOLD SUBSCRIPTION (ACTIVE PREMIUM)
  const now = new Date();
  const periodStart = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const periodEnd = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString();

  const elenaSub: ConsumerSubscription = {
    subscriptionId: CANONICAL_SUBSCRIPTION_IDS.ELENA_SUBSCRIPTION,
    ownerType: 'HOUSEHOLD',
    ownerId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    planId: premiumPlan.planId,
    planVersionId: premiumV1.planVersionId,
    planPriceId: CANONICAL_SUBSCRIPTION_IDS.PRICE_PREM_MONTHLY_KES,
    billingProvider: 'MPESA_RECURRING',
    externalSubscriptionReference: 'sub_mpesa_elena_001',
    status: 'ACTIVE',
    billingInterval: 'MONTHLY',
    currency: 'KES',
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
    version: 1,
    createdAt: periodStart,
    updatedAt: periodStart,
  };
  SubscriptionStore.saveSubscription(elenaSub);

  // Billing Agreement
  const elenaAgreement: SubscriptionBillingAgreement = {
    agreementId: CANONICAL_SUBSCRIPTION_IDS.ELENA_AGREEMENT,
    subscriptionId: elenaSub.subscriptionId,
    provider: 'MPESA_RECURRING',
    externalReference: 'agr_mpesa_elena_001',
    paymentMethodTokenMasked: '2547••••0123',
    status: 'ACTIVE',
    mandateReference: 'MND-MPESA-ELENA',
    authorizedAt: periodStart,
  };
  SubscriptionStore.saveBillingAgreement(elenaAgreement);

  // Initial Invoice
  const elenaInvoice: SubscriptionInvoice = {
    invoiceId: CANONICAL_SUBSCRIPTION_IDS.ELENA_INITIAL_INVOICE,
    subscriptionId: elenaSub.subscriptionId,
    periodStart,
    periodEnd,
    amountMinor: 120000,
    currency: 'KES',
    status: 'PAID',
    providerInvoiceReference: 'MPESA-REC-001',
    paymentTransactionId: asPaymentTransactionId('tx-sub-elena-001'),
    receiptId: asFinancialReceiptId('rcp-sub-elena-001'),
    issuedAt: periodStart,
    dueAt: periodStart,
    paidAt: periodStart,
  };
  SubscriptionStore.saveInvoice(elenaInvoice);

  // Status History
  SubscriptionStore.recordStatusHistory({
    historyId: asSubscriptionStatusHistoryId('sth-elena-001'),
    subscriptionId: elenaSub.subscriptionId,
    fromStatus: 'INCOMPLETE',
    toStatus: 'ACTIVE',
    reason: 'INITIAL_PURCHASE',
    actorUserId: CANONICAL_IDS.OWNER_ELENA,
    timestamp: periodStart,
    metadata: { amountMinor: 120000, currency: 'KES' },
  });

  // Entitlement Grants for Elena's Household
  for (const item of premiumBundle.items) {
    SubscriptionStore.saveEntitlementGrant({
      grantId: asEntitlementGrantId(`grt-elena-${item.entitlementDefinitionId}`),
      subjectType: 'HOUSEHOLD',
      subjectId: String(CANONICAL_IDS.MAIN_HOUSEHOLD),
      entitlementDefinitionId: item.entitlementDefinitionId,
      sourceType: 'CONSUMER_SUBSCRIPTION',
      sourceId: String(elenaSub.subscriptionId),
      value: item.value,
      limitSemantics: item.limitSemantics || 'HARD_LIMIT',
      validFrom: periodStart,
      validUntil: periodEnd,
      status: 'ACTIVE',
      createdAt: periodStart,
    });
  }
}
