/**
 * Pet OS Sprint 26 - Provider Business SaaS Canonical Seed Data
 * Volume XIV: Professional Workspaces & SaaS Monetization
 * Volume XVIII: Subscription & Entitlement Architecture
 */

import {
  asProviderSaaSPlanId,
  asProviderSaaSPlanVersionId,
  asProviderSaaSPriceId,
  asProviderSaaSSubscriptionId,
  asPaymentTransactionId,
  asPetId,
  generateUUIDv7,
} from '../kernel/ids';
import {
  ProviderSaaSPlan,
  ProviderSaaSPlanVersion,
  ProviderSaaSPrice,
  ProviderSaaSSubscription,
} from './types';
import { ProviderSaaSStore } from './store';
import { ProviderSaaSContinuityEngine } from './continuity-engine';
import { SEED_BUSINESSES, SEED_USERS, SEED_PROVIDERS } from '../provider/seed';
import { CANONICAL_IDS } from '../seed/unified-seed';

export const PROVIDER_SAAS_SEED_IDS = {
  // Plans
  PLAN_FREE: asProviderSaaSPlanId('pspl-free-baseline-001'),
  PLAN_INDIVIDUAL_PRO: asProviderSaaSPlanId('pspl-individual-pro-002'),
  PLAN_BUSINESS_OPERATIONS: asProviderSaaSPlanId('pspl-biz-operations-003'),
  PLAN_BUSINESS_PLUS: asProviderSaaSPlanId('pspl-biz-plus-multi-004'),

  // Versions
  VERSION_FREE_V1: asProviderSaaSPlanVersionId('pspv-free-v1-001'),
  VERSION_INDIVIDUAL_V1: asProviderSaaSPlanVersionId('pspv-individual-v1-002'),
  VERSION_BIZ_V1: asProviderSaaSPlanVersionId('pspv-biz-v1-003'),
  VERSION_BIZ_PLUS_V1: asProviderSaaSPlanVersionId('pspv-biz-plus-v1-004'),

  // Prices
  PRICE_FREE: asProviderSaaSPriceId('pspr-free-000'),
  PRICE_INDIVIDUAL_MONTHLY: asProviderSaaSPriceId('pspr-indiv-m-001'),
  PRICE_INDIVIDUAL_ANNUAL: asProviderSaaSPriceId('pspr-indiv-a-002'),
  PRICE_BIZ_MONTHLY: asProviderSaaSPriceId('pspr-biz-m-003'),
  PRICE_BIZ_ANNUAL: asProviderSaaSPriceId('pspr-biz-a-004'),
  PRICE_BIZ_PLUS_MONTHLY: asProviderSaaSPriceId('pspr-biz-plus-m-005'),
  PRICE_BIZ_PLUS_ANNUAL: asProviderSaaSPriceId('pspr-biz-plus-a-006'),

  // Subscriptions
  SUB_NAIROBI_VET: asProviderSaaSSubscriptionId('psub-nairobi-vet-001'),
  SUB_HAPPY_PAWS: asProviderSaaSSubscriptionId('psub-happy-paws-002'),
  SUB_APEX_K9: asProviderSaaSSubscriptionId('psub-apex-k9-003'),
};

export function seedProviderSaaSData(
  store: ProviderSaaSStore = ProviderSaaSStore.getInstance()
): void {
  store.reset();
  const now = new Date();
  const nowIso = now.toISOString();
  const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

  // ==========================================================================
  // 1. PLANS CATALOGUE
  // ==========================================================================

  const planFree: ProviderSaaSPlan = {
    planId: PROVIDER_SAAS_SEED_IDS.PLAN_FREE,
    code: 'PLAN_FREE_PROVIDER_BASELINE',
    targetType: 'INDIVIDUAL_PROVIDER',
    tier: 'FREE',
    displayName: 'Free Provider Baseline',
    description: 'Essential professional profile, standard marketplace booking commitments, and verified credential management.',
    includedStaffSeats: 1,
    includedLocations: 1,
    features: [
      'Standard marketplace discovery profile',
      'Basic schedule availability calendar',
      'Standard customer booking fulfillment',
      'Single practitioner workspace',
      'Legal privacy and compliance data exports',
    ],
    entitlementKeys: ['provider.workspace.basic'],
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const planIndividualPro: ProviderSaaSPlan = {
    planId: PROVIDER_SAAS_SEED_IDS.PLAN_INDIVIDUAL_PRO,
    code: 'PLAN_INDIVIDUAL_PRO',
    targetType: 'INDIVIDUAL_PROVIDER',
    tier: 'PRO',
    displayName: 'Professional Solo Practitioner',
    description: 'Advanced scheduling, client history retention, and digital clinical/training tools for independent specialists.',
    includedStaffSeats: 1,
    includedLocations: 1,
    features: [
      'Advanced recurring availability rules & buffers',
      'Extended client & pet behavioral history (365 days)',
      'Digital exercise attempt logging & skill milestone builder',
      'Advanced operational CSV & PDF record exports',
      'Automated client session reminders',
    ],
    entitlementKeys: [
      'provider.workspace.basic',
      'provider.workspace.advanced',
      'provider.schedule.advanced',
      'provider.client_history.extended',
      'provider.exports.advanced',
    ],
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const planBizOperations: ProviderSaaSPlan = {
    planId: PROVIDER_SAAS_SEED_IDS.PLAN_BUSINESS_OPERATIONS,
    code: 'PLAN_BUSINESS_OPERATIONS',
    targetType: 'SERVICE_BUSINESS',
    tier: 'BUSINESS',
    displayName: 'Business Operations Pro',
    description: 'Full operational suite for pet care businesses, multi-staff team coordination, and business performance analytics.',
    includedStaffSeats: 5,
    includedLocations: 1,
    features: [
      'Up to 5 active staff seats included',
      'Team dispatch & multi-staff calendar coordination',
      'Advanced business conversion & utilization analytics',
      'Automated operational reminders & check-in alerts',
      'Bulk schedule & service management tools',
      'Custody continuity shield for active boarding & walks',
    ],
    entitlementKeys: [
      'provider.workspace.basic',
      'provider.workspace.advanced',
      'provider.staff.management',
      'provider.schedule.advanced',
      'provider.analytics.advanced',
      'provider.exports.advanced',
      'provider.automation.advanced',
      'provider.bulk_operations',
      'provider.client_history.extended',
    ],
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const planBizPlus: ProviderSaaSPlan = {
    planId: PROVIDER_SAAS_SEED_IDS.PLAN_BUSINESS_PLUS,
    code: 'PLAN_BUSINESS_PLUS_MULTI_LOCATION',
    targetType: 'SERVICE_BUSINESS',
    tier: 'BUSINESS_PLUS',
    displayName: 'Enterprise Multi-Location Plus',
    description: 'Multi-branch clinic or salon management, 25 staff seats, 5 business locations, and external API integration.',
    includedStaffSeats: 25,
    includedLocations: 5,
    features: [
      'Up to 25 staff seats across up to 5 business locations',
      'Multi-branch inventory & appointment dispatch',
      'REST & Webhook Business API access for custom integrations',
      'Executive P&L reference & team performance reports',
      'Priority 24/7 technical operations support',
      'Guaranteed emergency custody continuity protection',
    ],
    entitlementKeys: [
      'provider.workspace.basic',
      'provider.workspace.advanced',
      'provider.staff.management',
      'provider.multi_location',
      'provider.schedule.advanced',
      'provider.analytics.advanced',
      'provider.exports.advanced',
      'provider.api.access',
      'provider.automation.advanced',
      'provider.bulk_operations',
      'provider.client_history.extended',
    ],
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  store.savePlan(planFree);
  store.savePlan(planIndividualPro);
  store.savePlan(planBizOperations);
  store.savePlan(planBizPlus);

  // ==========================================================================
  // 2. PLAN VERSIONS
  // ==========================================================================

  const versionFree: ProviderSaaSPlanVersion = {
    versionId: PROVIDER_SAAS_SEED_IDS.VERSION_FREE_V1,
    planId: planFree.planId,
    version: 1,
    targetType: 'INDIVIDUAL_PROVIDER',
    displayName: planFree.displayName,
    includedStaffSeats: 1,
    includedLocations: 1,
    effectiveFrom: '2026-01-01T00:00:00Z',
    status: 'ACTIVE',
    changeSummary: 'Canonical release of Free Provider Baseline',
    createdAt: nowIso,
  };

  const versionIndiv: ProviderSaaSPlanVersion = {
    versionId: PROVIDER_SAAS_SEED_IDS.VERSION_INDIVIDUAL_V1,
    planId: planIndividualPro.planId,
    version: 1,
    targetType: 'INDIVIDUAL_PROVIDER',
    displayName: planIndividualPro.displayName,
    includedStaffSeats: 1,
    includedLocations: 1,
    effectiveFrom: '2026-01-01T00:00:00Z',
    status: 'ACTIVE',
    changeSummary: 'Canonical release of Solo Practitioner plan',
    createdAt: nowIso,
  };

  const versionBiz: ProviderSaaSPlanVersion = {
    versionId: PROVIDER_SAAS_SEED_IDS.VERSION_BIZ_V1,
    planId: planBizOperations.planId,
    version: 1,
    targetType: 'SERVICE_BUSINESS',
    displayName: planBizOperations.displayName,
    includedStaffSeats: 5,
    includedLocations: 1,
    effectiveFrom: '2026-01-01T00:00:00Z',
    status: 'ACTIVE',
    changeSummary: 'Canonical release of Business Operations plan',
    createdAt: nowIso,
  };

  const versionBizPlus: ProviderSaaSPlanVersion = {
    versionId: PROVIDER_SAAS_SEED_IDS.VERSION_BIZ_PLUS_V1,
    planId: planBizPlus.planId,
    version: 1,
    targetType: 'SERVICE_BUSINESS',
    displayName: planBizPlus.displayName,
    includedStaffSeats: 25,
    includedLocations: 5,
    effectiveFrom: '2026-01-01T00:00:00Z',
    status: 'ACTIVE',
    changeSummary: 'Canonical release of Enterprise Multi-Location plan',
    createdAt: nowIso,
  };

  store.savePlanVersion(versionFree);
  store.savePlanVersion(versionIndiv);
  store.savePlanVersion(versionBiz);
  store.savePlanVersion(versionBizPlus);

  // ==========================================================================
  // 3. PLAN PRICES (Multi-Currency & Exact Money Minor Units)
  // ==========================================================================

  const priceFree: ProviderSaaSPrice = {
    priceId: PROVIDER_SAAS_SEED_IDS.PRICE_FREE,
    planVersionId: versionFree.versionId,
    planId: planFree.planId,
    market: 'GLOBAL',
    currency: 'USD',
    billingInterval: 'MONTHLY',
    amountMinor: 0,
    status: 'ACTIVE',
    gracePeriodDays: 7,
    trialPeriodDays: 0,
    createdAt: nowIso,
  };

  const priceIndivM: ProviderSaaSPrice = {
    priceId: PROVIDER_SAAS_SEED_IDS.PRICE_INDIVIDUAL_MONTHLY,
    planVersionId: versionIndiv.versionId,
    planId: planIndividualPro.planId,
    market: 'GLOBAL',
    currency: 'USD',
    billingInterval: 'MONTHLY',
    amountMinor: 1900, // $19.00
    status: 'ACTIVE',
    gracePeriodDays: 7,
    trialPeriodDays: 14,
    createdAt: nowIso,
  };

  const priceIndivA: ProviderSaaSPrice = {
    priceId: PROVIDER_SAAS_SEED_IDS.PRICE_INDIVIDUAL_ANNUAL,
    planVersionId: versionIndiv.versionId,
    planId: planIndividualPro.planId,
    market: 'GLOBAL',
    currency: 'USD',
    billingInterval: 'ANNUAL',
    amountMinor: 19000, // $190.00
    status: 'ACTIVE',
    gracePeriodDays: 7,
    trialPeriodDays: 14,
    createdAt: nowIso,
  };

  const priceBizM: ProviderSaaSPrice = {
    priceId: PROVIDER_SAAS_SEED_IDS.PRICE_BIZ_MONTHLY,
    planVersionId: versionBiz.versionId,
    planId: planBizOperations.planId,
    market: 'GLOBAL',
    currency: 'USD',
    billingInterval: 'MONTHLY',
    amountMinor: 7900, // $79.00
    status: 'ACTIVE',
    gracePeriodDays: 7,
    trialPeriodDays: 14,
    createdAt: nowIso,
  };

  const priceBizA: ProviderSaaSPrice = {
    priceId: PROVIDER_SAAS_SEED_IDS.PRICE_BIZ_ANNUAL,
    planVersionId: versionBiz.versionId,
    planId: planBizOperations.planId,
    market: 'GLOBAL',
    currency: 'USD',
    billingInterval: 'ANNUAL',
    amountMinor: 79000, // $790.00
    status: 'ACTIVE',
    gracePeriodDays: 7,
    trialPeriodDays: 30,
    createdAt: nowIso,
  };

  const priceBizPlusM: ProviderSaaSPrice = {
    priceId: PROVIDER_SAAS_SEED_IDS.PRICE_BIZ_PLUS_MONTHLY,
    planVersionId: versionBizPlus.versionId,
    planId: planBizPlus.planId,
    market: 'GLOBAL',
    currency: 'USD',
    billingInterval: 'MONTHLY',
    amountMinor: 14900, // $149.00
    status: 'ACTIVE',
    gracePeriodDays: 7,
    trialPeriodDays: 14,
    createdAt: nowIso,
  };

  const priceBizPlusA: ProviderSaaSPrice = {
    priceId: PROVIDER_SAAS_SEED_IDS.PRICE_BIZ_PLUS_ANNUAL,
    planVersionId: versionBizPlus.versionId,
    planId: planBizPlus.planId,
    market: 'GLOBAL',
    currency: 'USD',
    billingInterval: 'ANNUAL',
    amountMinor: 149000, // $1,490.00
    status: 'ACTIVE',
    gracePeriodDays: 7,
    trialPeriodDays: 30,
    createdAt: nowIso,
  };

  store.savePrice(priceFree);
  store.savePrice(priceIndivM);
  store.savePrice(priceIndivA);
  store.savePrice(priceBizM);
  store.savePrice(priceBizA);
  store.savePrice(priceBizPlusM);
  store.savePrice(priceBizPlusA);

  // ==========================================================================
  // 4. BUSINESS SAAS SUBSCRIPTIONS
  // ==========================================================================

  // Nairobi West Vet Clinic (Dr. Kimani) -> Business Plus Multi-Location
  const subNairobiVet: ProviderSaaSSubscription = {
    subscriptionId: PROVIDER_SAAS_SEED_IDS.SUB_NAIROBI_VET,
    subscriberType: 'SERVICE_BUSINESS',
    businessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
    billingOwnerUserId: SEED_USERS.VET_DR_KIMANI,
    authorizedBillingAdminUserIds: [SEED_USERS.VET_DR_KIMANI],
    planId: planBizPlus.planId,
    planVersionId: versionBizPlus.versionId,
    priceId: priceBizPlusM.priceId,
    status: 'ACTIVE',
    currentPeriodStart: nowIso,
    currentPeriodEnd: oneMonthLater,
    autoRenew: true,
    cancelAtPeriodEnd: false,
    consecutiveFailedPayments: 0,
    externalBillingRef: 'sub_gateway_nairobi_vet_991',
    lastPaymentTransactionId: asPaymentTransactionId('tx-saas-vet-seed-001'),
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: nowIso,
  };

  // Happy Paws Walkers (Sarah Mwangi) -> Business Operations
  const subHappyPaws: ProviderSaaSSubscription = {
    subscriptionId: PROVIDER_SAAS_SEED_IDS.SUB_HAPPY_PAWS,
    subscriberType: 'SERVICE_BUSINESS',
    businessId: SEED_BUSINESSES.HAPPY_PAWS_WALKERS,
    billingOwnerUserId: SEED_USERS.WALKER_SARAH,
    authorizedBillingAdminUserIds: [SEED_USERS.WALKER_SARAH],
    planId: planBizOperations.planId,
    planVersionId: versionBiz.versionId,
    priceId: priceBizA.priceId,
    status: 'ACTIVE',
    currentPeriodStart: '2026-01-01T00:00:00Z',
    currentPeriodEnd: oneYearLater,
    autoRenew: true,
    cancelAtPeriodEnd: false,
    consecutiveFailedPayments: 0,
    externalBillingRef: 'sub_gateway_happy_paws_002',
    lastPaymentTransactionId: asPaymentTransactionId('tx-saas-walkers-annual-002'),
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: nowIso,
  };

  // Apex K9 Academy (Juma Ochieng) -> Business Operations
  const subApexK9: ProviderSaaSSubscription = {
    subscriptionId: PROVIDER_SAAS_SEED_IDS.SUB_APEX_K9,
    subscriberType: 'SERVICE_BUSINESS',
    businessId: SEED_BUSINESSES.APEX_K9_ACADEMY,
    billingOwnerUserId: SEED_USERS.TRAINER_JUMA,
    authorizedBillingAdminUserIds: [SEED_USERS.TRAINER_JUMA],
    planId: planBizOperations.planId,
    planVersionId: versionBiz.versionId,
    priceId: priceBizM.priceId,
    status: 'ACTIVE',
    currentPeriodStart: nowIso,
    currentPeriodEnd: oneMonthLater,
    autoRenew: true,
    cancelAtPeriodEnd: false,
    consecutiveFailedPayments: 0,
    externalBillingRef: 'sub_gateway_apex_k9_003',
    lastPaymentTransactionId: asPaymentTransactionId('tx-saas-apex-seed-003'),
    createdAt: '2026-02-01T09:00:00Z',
    updatedAt: nowIso,
  };

  store.saveSubscription(subNairobiVet);
  store.saveSubscription(subHappyPaws);
  store.saveSubscription(subApexK9);

  // ==========================================================================
  // 5. ACTIVE SERVICE CONTINUITY SHIELD SEED
  // ==========================================================================
  // Demonstrates the critical invariant: An active boarding stay or encounter
  // retains continuity protection even if subscription undergoes renewal retry!
  ProviderSaaSContinuityEngine.ensureContinuityGrant({
    businessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
    serviceType: 'BOARDING_STAY',
    contextId: 'boarding-simba-seed-001',
    petId: CANONICAL_IDS.PET_SIMBA,
    reason: 'Simba checked into Nairobi West Vet medical boarding facility; continuity shield active.',
    durationHours: 72,
  });
}
