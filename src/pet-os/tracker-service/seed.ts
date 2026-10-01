/**
 * Pet OS Sprint 25 - Tracker Subscription & Device Service Plan Seed
 * Volume XIX: Pet Tracking & Device Architecture
 * Volume XVIII: Subscription & Monetization Architecture
 */

import {
  asTrackerServicePlanId,
  asTrackerPlanVersionId,
  asTrackerPlanPriceId,
  asTrackerSubscriptionId,
  asTrackerCarrierServiceRecordId,
  asDeviceId,
  asPaymentTransactionId,
  generateUUIDv7,
} from '../kernel/ids';
import {
  TrackerServicePlan,
  TrackerPlanVersion,
  TrackerPlanPrice,
  TrackerSubscription,
  TrackerCarrierServiceRecord,
} from './types';
import { TrackerSubscriptionStore } from './store';
import { CANONICAL_IDS } from '../seed/unified-seed';
import { TRACKING_SEED_IDS } from '../tracking/seed';

export const TRACKER_SEED_IDS = {
  // Plans
  PLAN_BASIC: asTrackerServicePlanId('tpl-cellular-basic-001'),
  PLAN_LIVE_WORLDWIDE: asTrackerServicePlanId('tpl-live-worldwide-002'),
  PLAN_PRO_SAFETY: asTrackerServicePlanId('tpl-petos-pro-003'),
  PLAN_COMPANION: asTrackerServicePlanId('tpl-companion-004'),

  // Plan Versions
  VERSION_BASIC_V1: asTrackerPlanVersionId('tpv-basic-v1-001'),
  VERSION_LIVE_V1: asTrackerPlanVersionId('tpv-live-v1-002'),
  VERSION_PRO_V1: asTrackerPlanVersionId('tpv-pro-v1-003'),

  // Prices
  PRICE_BASIC_MONTHLY: asTrackerPlanPriceId('tpr-basic-m-001'),
  PRICE_BASIC_ANNUAL: asTrackerPlanPriceId('tpr-basic-a-002'),
  PRICE_LIVE_MONTHLY: asTrackerPlanPriceId('tpr-live-m-003'),
  PRICE_LIVE_ANNUAL: asTrackerPlanPriceId('tpr-live-a-004'),
  PRICE_PRO_MONTHLY: asTrackerPlanPriceId('tpr-pro-m-005'),
  PRICE_PRO_ANNUAL: asTrackerPlanPriceId('tpr-pro-a-006'),

  // Subscriptions
  SUB_KIBO_TRACTIVE: asTrackerSubscriptionId('trk-sub-kibo-001'),
  SUB_SIMBA_FI: asTrackerSubscriptionId('trk-sub-simba-002'),

  // Carrier SIM records
  CARRIER_KIBO_SIM: asTrackerCarrierServiceRecordId('csr-safaricom-kibo-001'),
  CARRIER_SIMBA_SIM: asTrackerCarrierServiceRecordId('csr-esim-simba-002'),

  // Replacement / Standby Device
  DEVICE_REPLACEMENT_SPARE: asDeviceId('dev-spare-replacement-005'),
};

export function seedTrackerSubscriptionData(
  store: TrackerSubscriptionStore = TrackerSubscriptionStore.getInstance()
): void {
  store.reset();
  const now = new Date();
  const nowIso = now.toISOString();

  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

  // ==========================================================================
  // 1. PLANS CATALOGUE
  // ==========================================================================

  const planBasic: TrackerServicePlan = {
    id: TRACKER_SEED_IDS.PLAN_BASIC,
    code: 'PLAN_CELLULAR_BASIC',
    tier: 'BASIC',
    name: 'Basic Cellular IoT',
    description: 'Reliable 60-second GPS interval with East Africa cellular data connectivity.',
    supportedDeviceTypes: ['GPS_CELLULAR_TRACKER', 'THIRD_PARTY_TRACKER', 'FUTURE_PET_OS_TRACKER'],
    carrierVendorDefault: 'SAFARICOM_IOT',
    features: [
      'Standard 60-second periodic GPS uplink',
      'Safaricom & Airtel East Africa IoT Coverage',
      '30-day route history retention',
      'Standard safe zone exit alerts',
      'Battery conservation sleep mode',
    ],
    maxHighFreqSeconds: 60,
    retentionDays: 30,
    cellularDataAllowanceMbPerMonth: 50,
    supportsLostModeHighFreq: false,
    supportsInternationalRoaming: false,
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const planLive: TrackerServicePlan = {
    id: TRACKER_SEED_IDS.PLAN_LIVE_WORLDWIDE,
    code: 'PLAN_LIVE_WORLDWIDE',
    tier: 'PREMIUM_LIVE',
    name: 'Premium Live Worldwide',
    description: 'Continuous real-time 5-second Live tracking with global roaming across 175+ countries.',
    supportedDeviceTypes: ['GPS_CELLULAR_TRACKER', 'THIRD_PARTY_TRACKER', 'FUTURE_PET_OS_TRACKER'],
    carrierVendorDefault: 'GLOBAL_ESIM_1P',
    features: [
      '5-second high-frequency Live Pin updates',
      'Worldwide Multi-Carrier eSIM Roaming (175+ countries)',
      '365-day full spatial route history',
      'High-frequency Lost Mode emergency uplink',
      'Instant cellular geofence breach notifications',
      'BLE Crowd network fallback sync',
    ],
    maxHighFreqSeconds: 5,
    retentionDays: 365,
    cellularDataAllowanceMbPerMonth: 250,
    supportsLostModeHighFreq: true,
    supportsInternationalRoaming: true,
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const planPro: TrackerServicePlan = {
    id: TRACKER_SEED_IDS.PLAN_PRO_SAFETY,
    code: 'PLAN_PETOS_PRO_SAFETY',
    tier: 'PRO_SAFETY',
    name: 'Pet OS Pro Safety & Telematics',
    description: 'Ultra-low latency 3-second emergency telemetry with unlimited Lost Mode and priority cellular attach.',
    supportedDeviceTypes: ['GPS_CELLULAR_TRACKER', 'FUTURE_PET_OS_TRACKER'],
    carrierVendorDefault: 'GLOBAL_ESIM_1P',
    features: [
      '3-second ultra-fast real-time GPS stream',
      'Unlimited high-frequency Lost Mode broadcasts',
      'Priority Cellular Attach (eSIM Dual-IMSI)',
      '730-day extended telemetry and behavioral archival',
      'Hardware accelerometer fall/crash detection',
      '24/7 Pet OS Recovery Safety Override guarantee',
    ],
    maxHighFreqSeconds: 3,
    retentionDays: 730,
    cellularDataAllowanceMbPerMonth: 1000,
    supportsLostModeHighFreq: true,
    supportsInternationalRoaming: true,
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  store.savePlan(planBasic);
  store.savePlan(planLive);
  store.savePlan(planPro);

  // ==========================================================================
  // 2. PLAN VERSIONS
  // ==========================================================================

  const versionBasic: TrackerPlanVersion = {
    id: TRACKER_SEED_IDS.VERSION_BASIC_V1,
    planId: planBasic.id,
    versionNumber: 1,
    status: 'ACTIVE',
    effectiveFrom: '2026-01-01T00:00:00Z',
    changeSummary: 'Initial production release of Basic Cellular IoT plan',
    createdAt: nowIso,
  };

  const versionLive: TrackerPlanVersion = {
    id: TRACKER_SEED_IDS.VERSION_LIVE_V1,
    planId: planLive.id,
    versionNumber: 1,
    status: 'ACTIVE',
    effectiveFrom: '2026-01-01T00:00:00Z',
    changeSummary: 'Initial production release of Premium Live Worldwide plan',
    createdAt: nowIso,
  };

  const versionPro: TrackerPlanVersion = {
    id: TRACKER_SEED_IDS.VERSION_PRO_V1,
    planId: planPro.id,
    versionNumber: 1,
    status: 'ACTIVE',
    effectiveFrom: '2026-01-01T00:00:00Z',
    changeSummary: 'Initial release of Pet OS Pro Safety telematics plan',
    createdAt: nowIso,
  };

  store.savePlanVersion(versionBasic);
  store.savePlanVersion(versionLive);
  store.savePlanVersion(versionPro);

  // ==========================================================================
  // 3. PLAN PRICES
  // ==========================================================================

  const priceBasicM: TrackerPlanPrice = {
    id: TRACKER_SEED_IDS.PRICE_BASIC_MONTHLY,
    planVersionId: versionBasic.id,
    planId: planBasic.id,
    interval: 'MONTHLY',
    currency: 'USD',
    amountCents: 699, // $6.99
    bundledDiscountCents: 200, // $4.99 with Premium
    status: 'ACTIVE',
    gracePeriodDays: 7,
    trialPeriodDays: 14,
    createdAt: nowIso,
  };

  const priceBasicA: TrackerPlanPrice = {
    id: TRACKER_SEED_IDS.PRICE_BASIC_ANNUAL,
    planVersionId: versionBasic.id,
    planId: planBasic.id,
    interval: 'ANNUAL',
    currency: 'USD',
    amountCents: 6900, // $69.00
    bundledDiscountCents: 1500,
    status: 'ACTIVE',
    gracePeriodDays: 7,
    trialPeriodDays: 30,
    createdAt: nowIso,
  };

  const priceLiveM: TrackerPlanPrice = {
    id: TRACKER_SEED_IDS.PRICE_LIVE_MONTHLY,
    planVersionId: versionLive.id,
    planId: planLive.id,
    interval: 'MONTHLY',
    currency: 'USD',
    amountCents: 1199, // $11.99
    bundledDiscountCents: 300, // $8.99 with Premium
    status: 'ACTIVE',
    gracePeriodDays: 7,
    trialPeriodDays: 14,
    createdAt: nowIso,
  };

  const priceLiveA: TrackerPlanPrice = {
    id: TRACKER_SEED_IDS.PRICE_LIVE_ANNUAL,
    planVersionId: versionLive.id,
    planId: planLive.id,
    interval: 'ANNUAL',
    currency: 'USD',
    amountCents: 11900, // $119.00
    bundledDiscountCents: 3000,
    status: 'ACTIVE',
    gracePeriodDays: 7,
    trialPeriodDays: 30,
    createdAt: nowIso,
  };

  const priceProM: TrackerPlanPrice = {
    id: TRACKER_SEED_IDS.PRICE_PRO_MONTHLY,
    planVersionId: versionPro.id,
    planId: planPro.id,
    interval: 'MONTHLY',
    currency: 'USD',
    amountCents: 1499,
    bundledDiscountCents: 400,
    status: 'ACTIVE',
    gracePeriodDays: 7,
    trialPeriodDays: 14,
    createdAt: nowIso,
  };

  const priceProA: TrackerPlanPrice = {
    id: TRACKER_SEED_IDS.PRICE_PRO_ANNUAL,
    planVersionId: versionPro.id,
    planId: planPro.id,
    interval: 'ANNUAL',
    currency: 'USD',
    amountCents: 14900,
    bundledDiscountCents: 4000,
    status: 'ACTIVE',
    gracePeriodDays: 7,
    trialPeriodDays: 30,
    createdAt: nowIso,
  };

  store.savePlanPrice(priceBasicM);
  store.savePlanPrice(priceBasicA);
  store.savePlanPrice(priceLiveM);
  store.savePlanPrice(priceLiveA);
  store.savePlanPrice(priceProM);
  store.savePlanPrice(priceProA);

  // ==========================================================================
  // 4. CARRIER RECORDS (Masked ICCID / IMSI / MSISDN)
  // ==========================================================================

  const carrierKibo: TrackerCarrierServiceRecord = {
    id: TRACKER_SEED_IDS.CARRIER_KIBO_SIM,
    deviceId: TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO,
    carrierVendor: 'SAFARICOM_IOT',
    carrierSubscriptionRef: 'saf-sub-kibo-001',
    iccidMasked: '8925402000***4921',
    msisdnMasked: '+254-712-***-492',
    provisioningStatus: 'ACTIVE_SESSION',
    networkAttachStatus: 'ATTACHED',
    isRoamingAllowed: false,
    dataUsageMbCurrentCycle: 14.8,
    dataLimitMbCurrentCycle: 50,
    lastCarrierPingAt: nowIso,
    carrierOutageReported: false,
    activatedAt: '2026-01-15T08:00:00Z',
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: nowIso,
  };

  const carrierSimba: TrackerCarrierServiceRecord = {
    id: TRACKER_SEED_IDS.CARRIER_SIMBA_SIM,
    deviceId: TRACKING_SEED_IDS.DEVICE_FI_SIMBA,
    carrierVendor: 'GLOBAL_ESIM_1P',
    carrierSubscriptionRef: 'esim-sub-simba-002',
    iccidMasked: '8988210000***8832',
    msisdnMasked: '+1-555-***-883',
    provisioningStatus: 'ACTIVE_SESSION',
    networkAttachStatus: 'ATTACHED',
    isRoamingAllowed: true,
    dataUsageMbCurrentCycle: 48.2,
    dataLimitMbCurrentCycle: 250,
    lastCarrierPingAt: nowIso,
    carrierOutageReported: false,
    activatedAt: '2026-02-01T10:00:00Z',
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: nowIso,
  };

  store.saveCarrierRecord(carrierKibo);
  store.saveCarrierRecord(carrierSimba);

  // ==========================================================================
  // 5. DEVICE SUBSCRIPTIONS (Elena's Household)
  // ==========================================================================

  const subKibo: TrackerSubscription = {
    id: TRACKER_SEED_IDS.SUB_KIBO_TRACTIVE,
    deviceId: TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    primaryUserId: CANONICAL_IDS.OWNER_ELENA,
    planId: planBasic.id,
    planPriceId: priceBasicA.id,
    status: 'ACTIVE',
    carrierRecordId: carrierKibo.id,
    currentPeriodStartsAt: '2026-01-15T08:00:00Z',
    currentPeriodEndsAt: oneYearLater,
    autoRenew: true,
    cancelAtPeriodEnd: false,
    consecutiveFailedPaymentAttempts: 0,
    hasBundledPremiumDiscount: true,
    lastPaymentTransactionId: asPaymentTransactionId('tx-seed-kibo-annual-001'),
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: nowIso,
  };

  const subSimba: TrackerSubscription = {
    id: TRACKER_SEED_IDS.SUB_SIMBA_FI,
    deviceId: TRACKING_SEED_IDS.DEVICE_FI_SIMBA,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    primaryUserId: CANONICAL_IDS.OWNER_ELENA,
    planId: planLive.id,
    planPriceId: priceLiveM.id,
    status: 'ACTIVE',
    carrierRecordId: carrierSimba.id,
    currentPeriodStartsAt: nowIso,
    currentPeriodEndsAt: thirtyDaysLater,
    autoRenew: true,
    cancelAtPeriodEnd: false,
    consecutiveFailedPaymentAttempts: 0,
    hasBundledPremiumDiscount: true,
    lastPaymentTransactionId: asPaymentTransactionId('tx-seed-simba-live-002'),
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: nowIso,
  };

  store.saveSubscription(subKibo);
  store.saveSubscription(subSimba);
}
