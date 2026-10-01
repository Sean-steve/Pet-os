/**
 * Pet OS Sprint 25 - Tracker Connectivity Subscription & Device Service Plans
 * Volume XIX: Pet Tracking & Device Architecture
 * Volume XVIII: Subscription & Monetization Architecture
 * Volume XVII: Payments, Ledger, Revenue & Financial Architecture
 * Volume XX: Location, Geofencing & Lost-Pet Recovery
 * Volume XXI: Pet Identity Network & Device Interoperability
 * 
 * Strict separation of concerns:
 * - Consumer Premium Subscription vs Tracker Connectivity Subscription
 * - Billing Status is NOT Device Connectivity Status
 * - Devices own subscriptions, NOT Pets
 * - Physical hardware transfers preserve billing periods without altering historical telemetry
 * - Safety override in Lost Mode prevents billing failures from endangering pets
 */

import {
  UserId,
  HouseholdId,
  PetId,
  DeviceId,
  IncidentId,
  TrackerServicePlanId,
  TrackerPlanVersionId,
  TrackerPlanPriceId,
  TrackerSubscriptionId,
  TrackerBillingAgreementId,
  TrackerSubscriptionInvoiceId,
  TrackerCarrierServiceRecordId,
  TrackerEntitlementGrantId,
  TrackerDeviceTransferRecordId,
  TrackerDataUsageRecordId,
  TrackerSafetyOverrideRecordId,
  TrackerWebhookEventId,
  TrackerReconciliationRunId,
  PaymentTransactionId,
  FinancialReceiptId,
} from '../kernel/ids';
import { CurrencyCode } from '../kernel/money';
import { DeviceType, DeviceConnectivityStatus, BatteryStatus } from '../tracking/types';

// ============================================================================
// 1. TAXONOMY & ENUMS
// ============================================================================

export type TrackerPlanTier = 'BASIC' | 'PREMIUM_LIVE' | 'PRO_SAFETY' | 'COMPANION_BUNDLED';

export type TrackerBillingInterval = 'MONTHLY' | 'ANNUAL' | 'BIENNIAL';

export type TrackerPlanStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type TrackerPriceStatus = 'ACTIVE' | 'GRANDFATHERED' | 'RETIRED';

export type TrackerSubscriptionStatus =
  | 'INCOMPLETE'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'GRACE_PERIOD'
  | 'SUSPENDED'
  | 'CANCEL_AT_PERIOD_END'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'TERMINATED';

export type CarrierVendor =
  | 'SAFARICOM_IOT'
  | 'AIRTEL_IOT'
  | 'GLOBAL_ESIM_1P'
  | 'THIRD_PARTY_TRACTIVE'
  | 'THIRD_PARTY_FI'
  | 'THIRD_PARTY_WHISTLE';

export type CarrierProvisioningStatus =
  | 'PENDING_PROVISIONING'
  | 'PROVISIONED'
  | 'ACTIVE_SESSION'
  | 'SUSPENDED_CARRIER'
  | 'DEPROVISIONED'
  | 'SIM_LOCKED'
  | 'ROAMING_RESTRICTED';

export type CarrierNetworkAttachStatus =
  | 'ATTACHED'
  | 'SEARCHING'
  | 'DETACHED'
  | 'DENIED'
  | 'CARRIER_OUTAGE';

export type DeviceEntitlementKey =
  | 'cellular.attach'
  | 'telemetry.upload'
  | 'tracking.live_pin'
  | 'tracking.lost_mode_high_freq'
  | 'tracking.extended_retention'
  | 'geofence.cellular_alerts'
  | 'roaming.international';

// ============================================================================
// 2. CATALOGUE: PLANS, VERSIONS & PRICES
// ============================================================================

export interface TrackerServicePlan {
  id: TrackerServicePlanId;
  code: string; // e.g. 'PLAN_CELLULAR_BASIC', 'PLAN_LIVE_WORLDWIDE', 'PLAN_PETOS_PRO_SAFETY'
  tier: TrackerPlanTier;
  name: string;
  description: string;
  supportedDeviceTypes: DeviceType[];
  carrierVendorDefault: CarrierVendor;
  features: string[];
  maxHighFreqSeconds: number; // e.g. 5s for Live, 60s for Basic
  retentionDays: number; // e.g. 30 vs 365
  cellularDataAllowanceMbPerMonth: number; // e.g. 50MB, 250MB, 1000MB
  supportsLostModeHighFreq: boolean;
  supportsInternationalRoaming: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrackerPlanVersion {
  id: TrackerPlanVersionId;
  planId: TrackerServicePlanId;
  versionNumber: number;
  status: TrackerPlanStatus;
  effectiveFrom: string;
  effectiveTo?: string;
  changeSummary: string;
  createdAt: string;
}

export interface TrackerPlanPrice {
  id: TrackerPlanPriceId;
  planVersionId: TrackerPlanVersionId;
  planId: TrackerServicePlanId;
  interval: TrackerBillingInterval;
  currency: CurrencyCode;
  amountCents: number; // in lowest currency unit (e.g. 899 = $8.99 or 899 KES)
  bundledDiscountCents?: number; // discount if consumer has active Premium
  status: TrackerPriceStatus;
  gracePeriodDays: number; // standard 7 days
  trialPeriodDays: number; // 0 or 14/30 days
  createdAt: string;
}

// ============================================================================
// 3. CARRIER & SIM / eSIM SERVICE RECORD
// ============================================================================

/**
 * CarrierServiceRecord: Abstracts SIM / eSIM provisioning state.
 * Raw SIM secrets (K-keys, OPc, PIN, PUK) are strictly forbidden in Pet OS tables!
 * Only masked identifiers and vendor references are persisted.
 */
export interface TrackerCarrierServiceRecord {
  id: TrackerCarrierServiceRecordId;
  deviceId: DeviceId;
  carrierVendor: CarrierVendor;
  carrierSubscriptionRef: string; // Vendor contract / subscription ID
  iccidMasked: string; // e.g. '89254***4921'
  imsiMasked?: string; // e.g. '63902***109'
  msisdnMasked?: string; // e.g. '+254-712-***-901'
  provisioningStatus: CarrierProvisioningStatus;
  networkAttachStatus: CarrierNetworkAttachStatus;
  isRoamingAllowed: boolean;
  dataUsageMbCurrentCycle: number;
  dataLimitMbCurrentCycle: number;
  lastCarrierPingAt?: string;
  lastAttachedCellId?: string;
  carrierOutageReported: boolean;
  carrierOutageNotes?: string;
  activatedAt?: string;
  suspendedAt?: string;
  deprovisionedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 4. DEVICE SUBSCRIPTION CONTRACT
// ============================================================================

export interface TrackerSubscription {
  id: TrackerSubscriptionId;
  deviceId: DeviceId; // Physically bound to Device, NOT permanently to Pet
  householdId: HouseholdId;
  primaryUserId: UserId;
  planId: TrackerServicePlanId;
  planPriceId: TrackerPlanPriceId;
  status: TrackerSubscriptionStatus;
  carrierRecordId?: TrackerCarrierServiceRecordId;
  
  // Billing cycle timestamps (ISO 8601 UTC)
  trialStartsAt?: string;
  trialEndsAt?: string;
  currentPeriodStartsAt: string;
  currentPeriodEndsAt: string;
  
  // Lifecycle control flags
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: string;
  cancellationReason?: string;
  gracePeriodEndsAt?: string;
  suspendedAt?: string;
  suspensionReason?: string;
  restoredAt?: string;
  
  // Payment linking
  billingAgreementId?: TrackerBillingAgreementId;
  lastPaymentTransactionId?: PaymentTransactionId;
  consecutiveFailedPaymentAttempts: number;
  
  // Consumer Premium Bundle integration
  hasBundledPremiumDiscount: boolean;
  bundledConsumerSubscriptionId?: string;
  
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 5. DEVICE TRANSFERS & REPLACEMENTS
// ============================================================================

export interface TrackerDeviceTransferRecord {
  id: TrackerDeviceTransferRecordId;
  subscriptionId: TrackerSubscriptionId;
  previousDeviceId: DeviceId;
  targetDeviceId: DeviceId;
  householdId: HouseholdId;
  transferredBy: UserId;
  transferredAt: string;
  reason: 'WARRANTY_REPLACEMENT' | 'UPGRADE_NEW_HARDWARE' | 'LOST_DEVICE_REPLACEMENT' | 'DEVICE_RETIREMENT';
  notes?: string;
  remainingPeriodDaysPreserved: number;
  previousDeviceDecommissioned: boolean;
}

// ============================================================================
// 6. SAFETY OVERRIDE FOR LOST PETS
// ============================================================================

/**
 * Critical Safety Invariant:
 * An active Lost Pet incident MUST NOT have its tracker cellular uplink severed
 * due to a concurrent credit card failure or billing retry.
 */
export interface TrackerSafetyOverrideRecord {
  id: TrackerSafetyOverrideRecordId;
  subscriptionId: TrackerSubscriptionId;
  deviceId: DeviceId;
  petId: PetId;
  incidentId: IncidentId;
  activatedAt: string;
  expiresAt: string; // Safety window (e.g. 72h emergency extension)
  isEmergencyUplinkActive: boolean;
  reason: string;
  activatedBy: 'SYSTEM_SAFETY_DAEMON' | 'INCIDENT_DISPATCHER' | 'PET_OWNER';
  auditLog: string[];
}

// ============================================================================
// 7. DEVICE ENTITLEMENT EVALUATION
// ============================================================================

export interface DeviceEntitlementDecision {
  deviceId: DeviceId;
  entitlement: DeviceEntitlementKey;
  isAllowed: boolean;
  decision: 'ALLOWED' | 'DENIED' | 'REQUIRES_ACTIVATION' | 'SUSPENDED_BILLING' | 'CARRIER_OUTAGE' | 'SAFETY_OVERRIDE';
  reason: string;
  effectivePlanTier?: TrackerPlanTier;
  isSafetyFallback: boolean;
  quotaRemainingMb?: number;
  minIntervalSec?: number;
  historyRetentionDays?: number;
  evaluatedAt: string;
}

// ============================================================================
// 8. BILLING & CARRIER WEBHOOKS
// ============================================================================

export interface TrackerBillingWebhookPayload {
  eventId: string;
  eventType:
    | 'tracker.invoice.payment_succeeded'
    | 'tracker.invoice.payment_failed'
    | 'tracker.subscription.cancelled'
    | 'tracker.payment.refunded';
  subscriptionId: TrackerSubscriptionId;
  deviceId: DeviceId;
  amountCents: number;
  currency: CurrencyCode;
  transactionRef: string;
  failureCode?: string;
  failureMessage?: string;
  timestamp: string;
  signature: string;
}

export interface CarrierWebhookPayload {
  eventId: string;
  eventType:
    | 'carrier.sim.provisioned'
    | 'carrier.sim.network_attached'
    | 'carrier.sim.network_detached'
    | 'carrier.sim.quota_threshold_exceeded'
    | 'carrier.sim.suspended'
    | 'carrier.outage.declared'
    | 'carrier.outage.resolved';
  carrierVendor: CarrierVendor;
  carrierSubscriptionRef: string;
  iccidMasked: string;
  dataUsageMb?: number;
  outageDetails?: string;
  timestamp: string;
  signature: string;
}

// ============================================================================
// 9. UNIFIED DIAGNOSTIC PROJECTION
// ============================================================================

/**
 * Unified diagnostic view juxtaposing:
 * 1. Billing & Subscription State
 * 2. Hardware Registry & Battery State
 * 3. Carrier SIM & Network State
 * Demonstrates that Billing != Connectivity != Battery!
 */
export interface DeviceHolisticStatusProjection {
  deviceId: DeviceId;
  displayName: string;
  model: string;
  serialNumberMasked: string;
  assignedPetId?: PetId;
  assignedPetName?: string;
  householdId: HouseholdId;
  
  // 1. Subscription & Commercial
  subscriptionId?: TrackerSubscriptionId;
  planName?: string;
  planTier?: TrackerPlanTier;
  billingStatus: TrackerSubscriptionStatus;
  currentPeriodEndsAt?: string;
  isPastDue: boolean;
  isInGracePeriod: boolean;
  isBillingSuspended: boolean;
  
  // 2. Hardware & Battery (from Tracking domain)
  connectivityStatus: DeviceConnectivityStatus; // ONLINE, RECENTLY_SEEN, OFFLINE
  batteryStatus: BatteryStatus;
  batteryPercent?: number;
  lastSeenAt?: string;
  
  // 3. Carrier & Network (from Carrier domain)
  carrierVendor?: CarrierVendor;
  carrierProvisioning: CarrierProvisioningStatus;
  carrierNetworkAttach: CarrierNetworkAttachStatus;
  iccidMasked?: string;
  dataUsageMbCurrentCycle: number;
  dataLimitMbCurrentCycle: number;
  carrierOutageActive: boolean;
  
  // 4. Entitlements & Safety
  cellularAllowed: boolean;
  telemetryUploadAllowed: boolean;
  liveTrackingAllowed: boolean;
  safetyOverrideActive: boolean;
  safetyOverrideExpiresAt?: string;
  
  // 5. Diagnostics synthesis
  diagnosticSummary: string;
  primaryBlocker?: 'NONE' | 'DEAD_BATTERY' | 'NO_CARRIER_SIGNAL' | 'CARRIER_OUTAGE' | 'BILLING_SUSPENSION' | 'SIM_UNPROVISIONED';
}
