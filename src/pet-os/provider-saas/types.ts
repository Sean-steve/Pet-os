/**
 * Pet OS Sprint 26 - Provider Business SaaS & Professional Subscription Domain Types
 * Volume XIV: Veterinary, Trainer, Groomer, Sitter & Boarding Workspaces
 * Volume XVIII: Subscription & Monetization Architecture
 * Volume XII: Pet Services Marketplace
 * Volume XVII: Payments, Ledger, Revenue & Financial Architecture
 * 
 * Strict Architectural Separation:
 * - Provider Verification remains Sprint 10 (SaaS payment CANNOT buy verification)
 * - Provider Reputation remains Sprint 23 (SaaS state CANNOT alter reviews or ratings)
 * - Organic Discovery remains Neutral (No pay-to-win covert search boosts)
 * - Active Service Continuity guarantees animal safety (Custody/care/clinical workflows cannot be interrupted by SaaS expiry)
 * - Staff seats and locations are NEVER destructively deleted on downgrade
 */

import {
  UserId,
  BusinessId,
  ProviderId,
  PetId,
  ProviderSaaSPlanId,
  ProviderSaaSPlanVersionId,
  ProviderSaaSPriceId,
  ProviderSaaSSubscriptionId,
  ProviderSaaSBillingAgreementId,
  ProviderSaaSSubscriptionInvoiceId,
  ProviderSaaSContinuityGrantId,
  ProviderSaaSSupportGrantId,
  ProviderSaaSChangeRequestId,
  ProviderSaaSReconciliationRunId,
  PaymentTransactionId,
  FinancialReceiptId,
} from '../kernel/ids';
import { CurrencyCode } from '../kernel/money';

// ============================================================================
// 1. TAXONOMY & ENUMS
// ============================================================================

export type ProviderSaaSTargetType = 'SERVICE_BUSINESS' | 'INDIVIDUAL_PROVIDER';

export type ProviderSaaSPlanTier = 'FREE' | 'PRO' | 'BUSINESS' | 'BUSINESS_PLUS';

export type ProviderSaaSBillingInterval = 'MONTHLY' | 'ANNUAL';

export type ProviderSaaSPlanStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type ProviderSaaSPriceStatus = 'ACTIVE' | 'GRANDFATHERED' | 'RETIRED';

export type ProviderSaaSSubscriptionStatus =
  | 'INCOMPLETE'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'GRACE_PERIOD'
  | 'RESTRICTED'
  | 'CANCEL_AT_PERIOD_END'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'TERMINATED';

export type ProviderSaaSFeatureKey =
  | 'provider.workspace.basic'
  | 'provider.workspace.advanced'
  | 'provider.staff.management'
  | 'provider.multi_location'
  | 'provider.schedule.advanced'
  | 'provider.analytics.advanced'
  | 'provider.exports.advanced'
  | 'provider.api.access'
  | 'provider.automation.advanced'
  | 'provider.bulk_operations'
  | 'provider.client_history.extended';

export type ActiveServiceSafetyType =
  | 'DOG_WALK'
  | 'VET_ENCOUNTER'
  | 'TRAINING_SESSION'
  | 'GROOMING_SESSION'
  | 'SITTER_VISIT'
  | 'BOARDING_STAY'
  | 'PET_TRANSPORT';

// ============================================================================
// 2. PLAN CATALOGUE, VERSIONS & PRICES
// ============================================================================

export interface ProviderSaaSPlan {
  readonly planId: ProviderSaaSPlanId;
  readonly code: string; // e.g. 'PLAN_FREE_PROVIDER_BASELINE', 'PLAN_BUSINESS_OPERATIONS'
  readonly targetType: ProviderSaaSTargetType;
  readonly tier: ProviderSaaSPlanTier;
  readonly displayName: string;
  readonly description: string;
  readonly includedStaffSeats: number; // e.g. 1 for Free/Individual, 5 for Business, 25 for Business Plus
  readonly includedLocations: number; // e.g. 1 for Business, 5 for Business Plus
  readonly features: readonly string[];
  readonly entitlementKeys: readonly ProviderSaaSFeatureKey[];
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProviderSaaSPlanVersion {
  readonly versionId: ProviderSaaSPlanVersionId;
  readonly planId: ProviderSaaSPlanId;
  readonly version: number;
  readonly targetType: ProviderSaaSTargetType;
  readonly displayName: string;
  readonly includedStaffSeats: number;
  readonly includedLocations: number;
  readonly effectiveFrom: string;
  readonly effectiveUntil?: string;
  readonly status: ProviderSaaSPlanStatus;
  readonly changeSummary: string;
  readonly createdAt: string;
}

export interface ProviderSaaSPrice {
  readonly priceId: ProviderSaaSPriceId;
  readonly planVersionId: ProviderSaaSPlanVersionId;
  readonly planId: ProviderSaaSPlanId;
  readonly market: string; // 'GLOBAL', 'KE'
  readonly currency: CurrencyCode;
  readonly billingInterval: ProviderSaaSBillingInterval;
  readonly amountMinor: number; // integer minor units (e.g. 7900 for $79.00 or KES 950000)
  readonly status: ProviderSaaSPriceStatus;
  readonly gracePeriodDays: number; // standard 7 days
  readonly trialPeriodDays: number; // e.g. 14 days
  readonly createdAt: string;
}

// ============================================================================
// 3. SUBSCRIPTION AGGREGATE
// ============================================================================

export interface ProviderSaaSSubscription {
  readonly subscriptionId: ProviderSaaSSubscriptionId;
  readonly subscriberType: ProviderSaaSTargetType;
  readonly businessId?: BusinessId; // Bound to ServiceBusiness if business plan
  readonly providerId?: ProviderId; // Bound to Provider if individual plan
  
  // Billing administration (ordinary staff CANNOT manage billing)
  billingOwnerUserId: UserId;
  authorizedBillingAdminUserIds: UserId[];
  
  planId: ProviderSaaSPlanId;
  planVersionId: ProviderSaaSPlanVersionId;
  priceId: ProviderSaaSPriceId;
  status: ProviderSaaSSubscriptionStatus;
  
  // Lifecycle timestamps (ISO 8601 UTC)
  trialStart?: string;
  trialEnd?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  gracePeriodEnd?: string;
  
  // Cancellation & Suspension
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: string;
  cancellationReason?: string;
  suspendedAt?: string;
  suspensionReason?: string;
  consecutiveFailedPayments: number;
  
  externalBillingRef?: string;
  lastPaymentTransactionId?: PaymentTransactionId;
  
  readonly createdAt: string;
  updatedAt: string;
}

export interface ProviderSaaSSubscriptionStatusHistory {
  readonly id: string;
  readonly subscriptionId: ProviderSaaSSubscriptionId;
  readonly previousStatus: ProviderSaaSSubscriptionStatus;
  readonly newStatus: ProviderSaaSSubscriptionStatus;
  readonly reason: string;
  readonly triggeredByUserId?: UserId;
  readonly timestamp: string;
}

// ============================================================================
// 4. USAGE PROJECTIONS: STAFF SEATS & LOCATIONS
// ============================================================================

export interface StaffSeatUsageProjection {
  readonly businessId: BusinessId;
  readonly activeStaffCount: number; // Server-authoritative count of active memberships
  readonly pendingInviteCount: number;
  readonly allowedLimit: number; // from plan
  readonly bonusSeatsFromGrants: number;
  readonly totalEffectiveLimit: number;
  readonly isOverLimit: boolean; // True if downgraded with excess staff (GRANDFATHERED_OVER_LIMIT)
  readonly availableSeats: number;
  readonly evaluatedAt: string;
}

export interface LocationUsageProjection {
  readonly businessId: BusinessId;
  readonly activeLocationCount: number; // Server-authoritative count of business locations
  readonly allowedLimit: number; // from plan
  readonly bonusLocationsFromGrants: number;
  readonly totalEffectiveLimit: number;
  readonly isOverLimit: boolean;
  readonly availableLocations: number;
  readonly evaluatedAt: string;
}

// ============================================================================
// 5. ACTIVE SERVICE CONTINUITY & SAFETY SHIELD
// ============================================================================

/**
 * Critical Animal Safety Invariant:
 * If a business SaaS plan expires or payment fails while an active boarding,
 * dog walk, veterinary encounter, transport, training, or sitter visit is underway,
 * continuity grants keep the required operational/clinical features active
 * until pet custody is returned or service concludes.
 */
export interface ProviderSaaSContinuityGrant {
  readonly grantId: ProviderSaaSContinuityGrantId;
  readonly businessId?: BusinessId;
  readonly providerId?: ProviderId;
  readonly serviceType: ActiveServiceSafetyType;
  readonly contextId: string; // EncounterId, WalkSessionId, BoardingStayId, TripId
  readonly petId: PetId;
  readonly reason: string;
  readonly activatedAt: string;
  readonly expiresAt: string;
  isActive: boolean;
  readonly auditLog: string[];
}

// ============================================================================
// 6. SUPPORT & PROMOTIONAL GRANTS
// ============================================================================

export interface ProviderSaaSSupportGrant {
  readonly grantId: ProviderSaaSSupportGrantId;
  readonly targetType: ProviderSaaSTargetType;
  readonly targetId: string; // BusinessId or ProviderId
  readonly featuresGranted: readonly ProviderSaaSFeatureKey[];
  readonly bonusSeats?: number;
  readonly bonusLocations?: number;
  readonly reason: string;
  readonly grantedByUserId: UserId;
  readonly startsAt: string;
  readonly expiresAt: string;
  isActive: boolean;
  readonly createdAt: string;
}

// ============================================================================
// 7. PLAN CHANGE & DOWNGRADE IMPACT PREVIEWS
// ============================================================================

export interface DowngradeImpactPreview {
  readonly currentPlanName: string;
  readonly currentPlanTier: ProviderSaaSPlanTier;
  readonly targetPlanName: string;
  readonly targetPlanTier: ProviderSaaSPlanTier;
  readonly effectiveDate: string;
  readonly currentStaffCount: number;
  readonly targetStaffLimit: number;
  readonly isStaffOverLimit: boolean;
  readonly staffOverLimitWarning?: string;
  readonly currentLocationCount: number;
  readonly targetLocationLimit: number;
  readonly isLocationOverLimit: boolean;
  readonly locationOverLimitWarning?: string;
  readonly featuresLost: readonly string[];
  readonly activeServiceSafetyProtected: boolean;
  readonly activeProtectedServicesCount: number;
}

// ============================================================================
// 8. UNIFIED BUSINESS SAAS READ MODEL
// ============================================================================

export interface ProviderSaaSReadModel {
  readonly businessId: BusinessId;
  readonly businessName: string;
  readonly subscriptionId?: ProviderSaaSSubscriptionId;
  readonly planName: string;
  readonly planTier: ProviderSaaSPlanTier;
  readonly billingStatus: ProviderSaaSSubscriptionStatus;
  readonly billingOwnerUserId: UserId;
  readonly isBillingOwner: boolean;
  
  // Seat metrics
  readonly seatsUsed: number;
  readonly seatLimit: number;
  readonly isSeatOverLimit: boolean;
  
  // Location metrics
  readonly locationsUsed: number;
  readonly locationLimit: number;
  readonly isLocationOverLimit: boolean;
  
  // Period & Grace
  readonly currentPeriodEnd?: string;
  readonly isInGracePeriod: boolean;
  readonly isRestrictedMode: boolean;
  
  // Entitlements
  readonly activeEntitlements: readonly ProviderSaaSFeatureKey[];
  readonly activeContinuityGrantsCount: number;
  readonly activeSupportGrantsCount: number;
  
  // Safeguards
  readonly operationalSummary: string;
  readonly actionRequired?: string;
}

// ============================================================================
// 9. WEBHOOKS & RECONCILIATION CONTRACTS
// ============================================================================

export interface ProviderSaaSBillingWebhookPayload {
  readonly eventId: string;
  readonly eventType:
    | 'provider_saas.invoice.payment_succeeded'
    | 'provider_saas.invoice.payment_failed'
    | 'provider_saas.subscription.cancelled'
    | 'provider_saas.payment.refunded';
  readonly subscriptionId: ProviderSaaSSubscriptionId;
  readonly businessId?: BusinessId;
  readonly providerId?: ProviderId;
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
  readonly transactionRef: string;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly timestamp: string;
  readonly signature: string;
}

export interface ProviderSaaSReconciliationRun {
  readonly runId: ProviderSaaSReconciliationRunId;
  readonly timestamp: string;
  readonly checkedCount: number;
  readonly matchedCount: number;
  readonly repairedCount: number;
  readonly issuesFound: readonly string[];
}
