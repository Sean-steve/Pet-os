/**
 * Pet OS Subscription & Entitlements Domain - Types & Contracts
 * Volume XVIII: Subscription & Monetization Architecture
 * Volume IV: Identity & Households Access Control
 * Volume XVII: Payments & Financial Boundaries
 * 
 * Invariants:
 * - The user's pet data remains their data: downgrade/expiry never deletes Pet records.
 * - Single canonical Entitlement Engine: NO scattered `if (user.plan === "premium")`.
 * - Sprint 12 Finance remains authoritative for payments, transactions, ledger & refunds.
 */

import {
  UserId,
  HouseholdId,
  PetId,
  DeviceId,
  BusinessId,
  ProviderId,
  ConsumerPlanId,
  PlanVersionId,
  PlanPriceId,
  EntitlementDefinitionId,
  EntitlementBundleId,
  EntitlementGrantId,
  ConsumerSubscriptionId,
  SubscriptionBillingAgreementId,
  SubscriptionStatusHistoryId,
  SubscriptionInvoiceId,
  SubscriptionTrialId,
  SubscriptionChangeRequestId,
  SubscriptionCancellationRecordId,
  SubscriptionProviderEventId,
  SubscriptionReconciliationRunId,
  EntitlementReconciliationRunId,
  PromotionalGrantId,
  SupportGrantId,
  EntitlementUsageId,
  PaymentIntentId,
  PaymentTransactionId,
  FinancialReceiptId,
  RefundId,
} from '../kernel/ids';
import { CurrencyCode } from '../kernel/money';

// ============================================================================
// 1. ENUMS & CONSTANTS
// ============================================================================

export type ConsumerPlanCode = 'FREE' | 'PREMIUM';

export type PlanVersionStatus = 'DRAFT' | 'ACTIVE' | 'RETIRED' | 'ARCHIVED';

export type BillingInterval = 'MONTHLY' | 'ANNUAL';

export type PlanPriceStatus = 'ACTIVE' | 'GRANDFATHERED' | 'RETIRED';

export type SubscriptionOwnerType = 'HOUSEHOLD' | 'USER';

export type SubscriptionStatus =
  | 'INCOMPLETE'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'GRACE_PERIOD'
  | 'PAUSED'
  | 'CANCEL_AT_PERIOD_END'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'TERMINATED';

export type BillingAgreementStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'REQUIRES_ACTION'
  | 'REVOKED'
  | 'EXPIRED'
  | 'FAILED';

export type SubscriptionInvoiceStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'PAID'
  | 'FAILED'
  | 'VOID'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type EntitlementType =
  | 'BOOLEAN'
  | 'QUOTA'
  | 'CAPACITY'
  | 'DURATION'
  | 'HISTORY_WINDOW'
  | 'FEATURE_VARIANT';

export type EntitlementSubjectType = 'USER' | 'HOUSEHOLD' | 'PET' | 'DEVICE' | 'BUSINESS' | 'PROVIDER';

export type EntitlementSourceType =
  | 'FREE_BASELINE'
  | 'CONSUMER_SUBSCRIPTION'
  | 'PROMOTION'
  | 'SUPPORT_GRANT'
  | 'LEGACY_GRANDFATHERING'
  | 'TRACKER_SUBSCRIPTION'
  | 'PROVIDER_SAAS_SUBSCRIPTION'
  | 'ACTIVE_SERVICE_SAFETY_POLICY';

export type EntitlementDecision =
  | 'ALLOWED'
  | 'DENIED'
  | 'LIMIT_REACHED'
  | 'REQUIRES_UPGRADE'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'GRANDFATHERED';

export type LimitSemantics = 'SOFT_LIMIT' | 'HARD_LIMIT' | 'GRANDFATHERED_OVER_LIMIT';

export type UsageResetPeriod = 'BILLING_CYCLE' | 'CALENDAR_MONTH' | 'NEVER' | 'ROLLING_WINDOW';

export type SubscriptionBillingProviderName =
  | 'MPESA_RECURRING'
  | 'CARD_GATEWAY'
  | 'MOCK_BILLING_PROVIDER';

export type BillingReconciliationStatus =
  | 'MATCHED'
  | 'LOCAL_MISSING'
  | 'PROVIDER_MISSING'
  | 'STATUS_MISMATCH'
  | 'PERIOD_MISMATCH'
  | 'PRICE_MISMATCH'
  | 'PAYMENT_MISMATCH'
  | 'REQUIRES_REVIEW';

// ============================================================================
// 2. PLAN & PRICING ENTITIES
// ============================================================================

export interface ConsumerPlan {
  readonly planId: ConsumerPlanId;
  readonly code: ConsumerPlanCode;
  readonly displayName: string;
  readonly description: string;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlanVersion {
  readonly planVersionId: PlanVersionId;
  readonly planId: ConsumerPlanId;
  readonly version: number;
  readonly displayName: string;
  readonly description: string;
  readonly effectiveFrom: string;
  readonly effectiveUntil?: string;
  readonly status: PlanVersionStatus;
  readonly entitlementBundleId: EntitlementBundleId;
  readonly limits: {
    readonly maxPets: number;
    readonly storageQuotaBytes: number;
    readonly locationHistoryDays: number;
    readonly geofenceLimit: number;
  };
  readonly createdAt: string;
}

export interface PlanPrice {
  readonly planPriceId: PlanPriceId;
  readonly planVersionId: PlanVersionId;
  readonly currency: CurrencyCode;
  readonly billingInterval: BillingInterval;
  readonly amountMinor: number; // exact integer minor units (e.g., 1000 KES = 100000 minor units or 12.99 USD = 1299 minor)
  readonly marketCountry: string; // ISO 3166-1 alpha-2, e.g. 'KE', 'US', 'GB'
  readonly status: PlanPriceStatus;
  readonly externalPriceReference?: string;
  readonly effectiveFrom: string;
  readonly effectiveUntil?: string;
  readonly createdAt: string;
}

// ============================================================================
// 3. ENTITLEMENT CATALOGUE & GRANTS
// ============================================================================

export interface EntitlementDefinition {
  readonly entitlementId: EntitlementDefinitionId;
  readonly code: string; // e.g. 'pet.capacity', 'tracking.live', 'passport.advanced_export'
  readonly displayName: string;
  readonly category: 'PET_CORE' | 'TRACKING' | 'DOCUMENTS' | 'ANALYTICS' | 'AUTOMATION' | 'AI' | 'SAFETY';
  readonly type: EntitlementType;
  readonly defaultValue: any;
  readonly isSafetyCritical: boolean; // if true, NEVER stripped during downgrade/failure (e.g. data_export.privacy, pet.profile.core)
  readonly description: string;
}

export interface EntitlementBundleItem {
  readonly entitlementDefinitionId: EntitlementDefinitionId;
  readonly value: any;
  readonly limitSemantics?: LimitSemantics;
}

export interface EntitlementBundle {
  readonly entitlementBundleId: EntitlementBundleId;
  readonly name: string;
  readonly version: number;
  readonly items: readonly EntitlementBundleItem[];
}

export interface EntitlementGrant {
  readonly grantId: EntitlementGrantId;
  readonly subjectType: EntitlementSubjectType;
  readonly subjectId: string; // UserId | HouseholdId | PetId | DeviceId
  readonly entitlementDefinitionId: EntitlementDefinitionId;
  readonly sourceType: EntitlementSourceType;
  readonly sourceId: string; // SubscriptionId | SupportGrantId | CampaignId
  readonly value: any;
  readonly limitSemantics: LimitSemantics;
  readonly validFrom: string;
  readonly validUntil?: string;
  readonly status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  readonly createdAt: string;
}

// ============================================================================
// 4. CONSUMER SUBSCRIPTION AGGREGATE
// ============================================================================

export interface ConsumerSubscription {
  readonly subscriptionId: ConsumerSubscriptionId;
  readonly ownerType: SubscriptionOwnerType;
  readonly ownerId: HouseholdId | UserId;
  readonly planId: ConsumerPlanId;
  readonly planVersionId: PlanVersionId;
  readonly planPriceId: PlanPriceId;
  readonly billingProvider: SubscriptionBillingProviderName;
  readonly externalSubscriptionReference?: string;
  readonly status: SubscriptionStatus;
  readonly billingInterval: BillingInterval;
  readonly currency: CurrencyCode;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
  readonly cancelAtPeriodEnd: boolean;
  readonly cancelledAt?: string;
  readonly cancellationReason?: string;
  readonly trialStart?: string;
  readonly trialEnd?: string;
  readonly gracePeriodEnd?: string;
  readonly pausedAt?: string;
  readonly endedAt?: string;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SubscriptionStatusHistory {
  readonly historyId: SubscriptionStatusHistoryId;
  readonly subscriptionId: ConsumerSubscriptionId;
  readonly fromStatus: SubscriptionStatus;
  readonly toStatus: SubscriptionStatus;
  readonly reason: string;
  readonly actorUserId: UserId;
  readonly timestamp: string;
  readonly metadata?: Record<string, any>;
}

export interface SubscriptionBillingAgreement {
  readonly agreementId: SubscriptionBillingAgreementId;
  readonly subscriptionId: ConsumerSubscriptionId;
  readonly provider: SubscriptionBillingProviderName;
  readonly externalReference: string;
  readonly paymentMethodTokenMasked: string; // e.g. "•••• 4242" or "2547••••0123" - NEVER raw PAN / PIN!
  readonly status: BillingAgreementStatus;
  readonly mandateReference?: string;
  readonly authorizedAt: string;
  readonly revokedAt?: string;
  readonly expiresAt?: string;
}

export interface SubscriptionInvoice {
  readonly invoiceId: SubscriptionInvoiceId;
  readonly subscriptionId: ConsumerSubscriptionId;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
  readonly status: SubscriptionInvoiceStatus;
  readonly providerInvoiceReference?: string;
  readonly paymentTransactionId?: PaymentTransactionId;
  readonly paymentIntentId?: PaymentIntentId;
  readonly receiptId?: FinancialReceiptId;
  readonly refundId?: RefundId;
  readonly issuedAt: string;
  readonly dueAt: string;
  readonly paidAt?: string;
}

// ============================================================================
// 5. USAGE, SUPPORT GRANTS & OFFLINE TOKENS
// ============================================================================

export interface EntitlementUsage {
  readonly usageId: EntitlementUsageId;
  readonly subjectType: EntitlementSubjectType;
  readonly subjectId: string;
  readonly entitlementDefinitionId: EntitlementDefinitionId;
  readonly periodKey: string; // e.g. '2026-09' or 'billing-sub-001-2026-09-01'
  readonly currentUsage: number;
  readonly maxLimit: number;
  readonly resetPeriod: UsageResetPeriod;
  readonly resetAt: string;
  readonly updatedAt: string;
}

export interface SupportGrant {
  readonly grantId: SupportGrantId;
  readonly subjectType: EntitlementSubjectType;
  readonly subjectId: string;
  readonly authorizedByUserId: UserId;
  readonly reason: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly entitlementBundleId: EntitlementBundleId;
  readonly createdAt: string;
}

export interface SignedEntitlementSnapshot {
  readonly subjectType: EntitlementSubjectType;
  readonly subjectId: string;
  readonly entitlements: Record<string, any>;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly signature: string; // HMAC SHA-256 tamper-evident proof
  readonly keyId: string;
}

// ============================================================================
// 6. EVALUATION, RECONCILIATION & WEBHOOK CONTRACTS
// ============================================================================

export interface EntitlementEvaluationContext {
  readonly subjectId?: string;
  readonly userId?: UserId;
  readonly householdId?: HouseholdId;
  readonly petId?: PetId;
  readonly deviceId?: DeviceId;
  readonly businessId?: BusinessId;
  readonly providerId?: ProviderId;
  readonly activeLostPetIncident?: boolean; // Emergency safety boundary check
  readonly activeServiceContinuity?: boolean; // Active care/encounter/custody/transport safety check
  readonly isPrivacyExportRequest?: boolean; // Legally required export check
  readonly requestedDelta?: number; // For quota consumption checks
}

export interface EntitlementEvaluationResult {
  readonly entitlementCode: string;
  readonly decision: EntitlementDecision;
  readonly isAllowed: boolean;
  readonly value: any;
  readonly limit?: number;
  readonly currentUsage?: number;
  readonly remainingQuota?: number;
  readonly reason: string;
  readonly effectiveUntil?: string;
  readonly source: EntitlementSourceType;
  readonly isSafetyFallback: boolean;
}

export interface SubscriptionProviderReconciliationItem {
  readonly subscriptionId: ConsumerSubscriptionId;
  readonly localStatus: SubscriptionStatus;
  readonly providerStatus: string;
  readonly discrepancy: string;
  readonly resolution?: string;
}

export interface SubscriptionProviderReconciliationRecord {
  readonly runId: SubscriptionReconciliationRunId;
  readonly timestamp: string;
  readonly checkedCount: number;
  readonly matchedCount: number;
  readonly driftedCount: number;
  readonly items: readonly SubscriptionProviderReconciliationItem[];
}

export interface EntitlementReconciliationRecord {
  readonly runId: EntitlementReconciliationRunId;
  readonly timestamp: string;
  readonly checkedGrantsCount: number;
  readonly repairedGrantsCount: number;
  readonly details: readonly string[];
}

export interface SubscriptionBillingWebhookPayload {
  readonly eventId: string;
  readonly provider: SubscriptionBillingProviderName;
  readonly eventType: 'PAYMENT_SUCCEEDED' | 'PAYMENT_FAILED' | 'SUBSCRIPTION_CANCELLED' | 'RENEWAL_DUE';
  readonly externalSubscriptionReference: string;
  readonly timestamp: string;
  readonly amountMinor?: number;
  readonly currency?: CurrencyCode;
  readonly providerTransactionId?: string;
  readonly failureReason?: string;
  readonly signature: string;
}
