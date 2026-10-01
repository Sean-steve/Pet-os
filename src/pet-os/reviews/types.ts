/**
 * Pet OS Sprint 23 — Provider Reviews, Reputation, Service Quality & Trust Engine Domain Types
 * 
 * Implements:
 * - Volume XII (Pet Services Marketplace & Review Bounded Context)
 * - Volume XIV (Professional Workspaces - Quality & Customer Feedback)
 * - Volume XXVII (UX/UI & Trust Command Center)
 * - Volume XXX (Database Schema & Integrity Invariants)
 * - Volume XXXI (Security, Privacy, Trust & Abuse Prevention)
 * - Volume XXXII (Kenyan Data Protection & Privacy Compliance)
 * 
 * Normative Invariants:
 * 1. Verified-Service Gating: Reviews can ONLY originate from eligible terminal service executions.
 * 2. Strict Credential Separation: Sprint 10 verification is authoritative credential evidence; customer
 *    reputation is transaction feedback. 5-star ratings do NOT verify credentials; 1-star reviews do not de-verify.
 * 3. Reviewer Identity Integrity: Server-authoritative derivation from booking household/payer; anonymous public display
 *    never leaks user ID or private contact info, while preserving internal auditability.
 * 4. Self-Review & Collusion Prevention: Deterministic block of self-reviews by provider, staff, business members, or household duplicates.
 * 5. Provider Agency Boundary: Providers can respond, report, and dispute; Providers CANNOT edit, hide, or alter customer reviews.
 * 6. Trust & Safety Escalation: Serious safety allegations (abuse, injury, pet escape concealment) route to T&S without automated guilt.
 * 7. Small-Sample Transparency: 0 reviews = "No reviews yet" (never 0.0 stars); low-volume reviews show exact sample count.
 */

import {
  UserId,
  HouseholdId,
  PetId,
  ProviderId,
  BusinessId,
  ServiceOfferingId,
  BookingId,
  ReviewEligibilityId,
  ReviewId,
  ReviewRevisionId,
  ReviewDimensionDefinitionId,
  ReviewMediaId,
  ReviewResponseId,
  ReviewResponseRevisionId,
  ReviewReportId,
  ReviewDisputeId,
  ReviewDisputeEvidenceId,
  ReviewAppealId,
  ReviewModerationActionId,
  ReviewAbuseSignalId,
  ReputationProjectionId,
} from '../kernel/ids';

// ============================================================================
// ENUMS & TYPES
// ============================================================================

export type ReviewEligibilityStatus =
  | 'PENDING'
  | 'ELIGIBLE'
  | 'CONSUMED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'INELIGIBLE';

export type ReviewStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_MODERATION'
  | 'PUBLISHED'
  | 'LIMITED'
  | 'HIDDEN'
  | 'WITHDRAWN'
  | 'REMOVED'
  | 'DISPUTED';

export type ReviewModerationStatus =
  | 'APPROVED'
  | 'PENDING'
  | 'FLAGGED'
  | 'ACTION_TAKEN';

export type PublicIdentityMode =
  | 'FIRST_NAME_INITIAL'
  | 'COMMUNITY_HANDLE'
  | 'ANONYMOUS_TO_PUBLIC';

export type ReviewTargetType = 'PROVIDER' | 'BUSINESS' | 'SERVICE_OFFERING';

export type ServiceCategory =
  | 'DOG_WALKING'
  | 'VETERINARY'
  | 'TRAINING'
  | 'GROOMING'
  | 'BOARDING'
  | 'PET_SITTING'
  | 'TRANSPORT';

export type ReviewDimensionKey =
  | 'COMMUNICATION'
  | 'PUNCTUALITY'
  | 'CARE_QUALITY'
  | 'PROFESSIONALISM'
  | 'INSTRUCTION_ADHERENCE'
  | 'VALUE'
  | 'CLEANLINESS'
  | 'SAFETY_COMMUNICATION'
  | 'PET_HANDLING'
  | 'SERVICE_EXECUTION'
  | 'GROOMING_OUTCOME'
  | 'CARE_UPDATES'
  | 'HANDOVER_EXPERIENCE'
  | 'TRANSIT_CARE'
  | 'TIMELINESS'
  | 'FACILITY_EXPERIENCE'
  | 'EXPLANATION_CLARITY'
  | 'SESSION_EXPERIENCE';

export type ReviewStructuredTag =
  | 'ON_TIME'
  | 'GOOD_COMMUNICATION'
  | 'FOLLOWED_INSTRUCTIONS'
  | 'HELPFUL_UPDATES'
  | 'GENTLE_HANDLING'
  | 'THOROUGH_CLEANUP'
  | 'DETAILED_REPORT'
  | 'SAFE_TRANSIT'
  | 'CALM_ENVIRONMENT'
  | 'PATIENT_TRAINER'
  | 'LATE'
  | 'COMMUNICATION_ISSUE'
  | 'INSTRUCTION_NOT_FOLLOWED'
  | 'RUSHED_VISIT'
  | 'DELAYED_UPDATES';

export type ReviewReportReason =
  | 'HARASSMENT'
  | 'HATEFUL_ABUSIVE_CONTENT'
  | 'PERSONAL_INFORMATION'
  | 'SPAM'
  | 'IRRELEVANT'
  | 'FAKE_REVIEW'
  | 'CONFLICT_OF_INTEREST'
  | 'THREATS'
  | 'EXTORTION'
  | 'PROHIBITED_MEDIA'
  | 'OTHER';

export type ReviewReportStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'ACTION_REQUIRED'
  | 'RESOLVED'
  | 'DISMISSED'
  | 'ESCALATED';

export type ReviewDisputeReason =
  | 'SERVICE_DID_NOT_OCCUR'
  | 'WRONG_PROVIDER_TARGETED'
  | 'REVIEWER_NOT_CUSTOMER'
  | 'DUPLICATE_REVIEW'
  | 'PROHIBITED_PRIVATE_INFO'
  | 'UNRELATED_SERVICE_COMPLAINT';

export type ReviewDisputeStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'EVIDENCE_REQUESTED'
  | 'UPHELD'
  | 'REJECTED'
  | 'PARTIALLY_UPHELD'
  | 'APPEALED'
  | 'CLOSED';

export type ReviewModerationActionType =
  | 'NO_ACTION'
  | 'WARN'
  | 'REMOVE_MEDIA'
  | 'LIMIT_VISIBILITY'
  | 'REMOVE_REVIEW'
  | 'RESTORE_REVIEW'
  | 'ESCALATE_TRUST_SAFETY';

export type ReviewAbuseSignalType =
  | 'SELF_REVIEW_ATTEMPT'
  | 'HOUSEHOLD_DUPLICATE_ATTEMPT'
  | 'BUSINESS_STAFF_ATTEMPT'
  | 'RAPID_REVIEW_BURST'
  | 'DUPLICATE_CONTENT_DETECTED'
  | 'SUSPICIOUS_RECIPROCAL'
  | 'UNAUTHORIZED_ELIGIBILITY_FORGERY'
  | 'EXTORTION_THREAT_DETECTED'
  | 'SERIOUS_SAFETY_ALLEGATION';

// ============================================================================
// CORE ENTITIES & VALUE OBJECTS
// ============================================================================

export interface ReviewDimensionDefinition {
  dimensionId: ReviewDimensionDefinitionId;
  dimensionKey: ReviewDimensionKey;
  label: string;
  description: string;
  minScore: number;
  maxScore: number;
  applicableServiceTypes: ServiceCategory[];
  isRequired: boolean;
  version: string;
}

export interface ReviewDimensionScore {
  dimensionKey: ReviewDimensionKey;
  score: number; // 1-5 integer
  dimensionVersion: string;
}

export interface ReviewMedia {
  mediaId: ReviewMediaId;
  url: string;
  mediaType: 'IMAGE' | 'VIDEO';
  caption?: string;
  exifStripped: boolean;
  blurFacesAndPlates: boolean;
  uploadedAt: string;
}

export interface ReviewServiceSnapshot {
  serviceType: ServiceCategory;
  providerName: string;
  offeringTitle: string;
  completedAt: string;
  executionReference: string;
  bookingId: BookingId;
  isPartialService: boolean;
}

export interface ReviewEligibility {
  eligibilityId: ReviewEligibilityId;
  bookingId: BookingId;
  serviceExecutionReference: string;
  reviewerUserId: UserId;
  reviewerHouseholdId: HouseholdId;
  providerId: ProviderId;
  businessId?: BusinessId;
  offeringId: ServiceOfferingId;
  serviceType: ServiceCategory;
  serviceSnapshot: ReviewServiceSnapshot;
  eligibleAt: string;
  expiresAt: string; // server enforced window (e.g. 30 days)
  status: ReviewEligibilityStatus;
  consumedByReviewId?: ReviewId;
  eligibilityReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewRevision {
  revisionId: ReviewRevisionId;
  reviewId: ReviewId;
  version: number;
  overallRating: number;
  dimensions: ReviewDimensionScore[];
  structuredTags: ReviewStructuredTag[];
  body: string;
  media: ReviewMedia[];
  editReason?: string;
  createdAt: string;
  authorUserId: UserId;
}

export interface ProviderReviewResponseRevision {
  revisionId: ReviewResponseRevisionId;
  responseId: ReviewResponseId;
  version: number;
  body: string;
  createdAt: string;
}

export interface ProviderReviewResponse {
  responseId: ReviewResponseId;
  reviewId: ReviewId;
  providerId: ProviderId;
  businessId?: BusinessId;
  responderUserId: UserId;
  responderRole: 'REVIEWED_PROVIDER' | 'BUSINESS_MANAGER' | 'SUPPORT_REPRESENTATIVE';
  body: string;
  publishedAt: string;
  editedAt?: string;
  version: number;
  revisions: ProviderReviewResponseRevision[];
  status: 'PUBLISHED' | 'HIDDEN_WITH_REVIEW' | 'MODERATED';
}

export interface Review {
  reviewId: ReviewId;
  eligibilityId: ReviewEligibilityId;
  reviewerUserId: UserId; // Authoritative internal reference - never exposed publicly
  reviewerHouseholdId: HouseholdId;
  providerId: ProviderId;
  businessId?: BusinessId;
  offeringId: ServiceOfferingId;
  serviceType: ServiceCategory;
  serviceSnapshot: ReviewServiceSnapshot;
  overallRating: number; // 1 to 5 integer
  dimensions: ReviewDimensionScore[];
  structuredTags: ReviewStructuredTag[];
  body: string;
  media: ReviewMedia[];
  status: ReviewStatus;
  moderationStatus: ReviewModerationStatus;
  publicIdentityMode: PublicIdentityMode;
  publicAuthorDisplayName: string;
  verifiedService: boolean; // Verified linkage to completed Pet OS service
  currentRevisionId: ReviewRevisionId;
  revisions: ReviewRevision[];
  providerResponse?: ProviderReviewResponse;
  submittedAt: string;
  publishedAt?: string;
  editedAt?: string;
  withdrawnAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewReport {
  reportId: ReviewReportId;
  reviewId: ReviewId;
  reporterUserId: UserId;
  reason: ReviewReportReason;
  details: string;
  status: ReviewReportStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedByModeratorId?: UserId;
  resolutionNotes?: string;
}

export interface ReviewDispute {
  disputeId: ReviewDisputeId;
  reviewId: ReviewId;
  providerId: ProviderId;
  businessId?: BusinessId;
  disputantUserId: UserId;
  reasonCategory: ReviewDisputeReason;
  statement: string;
  evidenceReferences: string[];
  status: ReviewDisputeStatus;
  submittedAt: string;
  resolvedAt?: string;
  resolvedByModeratorId?: UserId;
  moderatorNotes?: string;
}

export interface ReviewAppeal {
  appealId: ReviewAppealId;
  reviewId: ReviewId;
  appellantUserId: UserId;
  reason: string;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'UPHELD' | 'DENIED';
  submittedAt: string;
  resolvedAt?: string;
  reviewedByUserId?: UserId;
  decisionNotes?: string;
}

export interface ReviewModerationAction {
  actionId: ReviewModerationActionId;
  reviewId: ReviewId;
  moderatorUserId: UserId;
  action: ReviewModerationActionType;
  reason: string;
  notes?: string;
  occurredAt: string;
}

export interface ReviewAbuseSignal {
  signalId: ReviewAbuseSignalId;
  reviewId?: ReviewId;
  providerId?: ProviderId;
  actorUserId: UserId;
  signalType: ReviewAbuseSignalType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: string;
  raisedAt: string;
  resolved: boolean;
}

// ============================================================================
// READ MODELS & REPUTATION PROJECTIONS
// ============================================================================

export interface QualityDimensionAverage {
  dimensionKey: ReviewDimensionKey;
  label: string;
  average: number;
  count: number;
}

export interface ServiceTypeReputationBreakdown {
  serviceType: ServiceCategory;
  reviewCount: number;
  averageRating: number;
}

export interface ProviderReputationProjection {
  projectionId: ReputationProjectionId;
  targetId: ProviderId | BusinessId;
  targetType: 'PROVIDER' | 'BUSINESS';
  reviewCount: number;
  averageRating: number; // 0.0 to 5.0, 1 decimal place
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  dimensionAverages: Record<string, QualityDimensionAverage>;
  serviceTypeBreakdown: Record<string, ServiceTypeReputationBreakdown>;
  responseRatePercent: number;
  recentReviewCount: number; // e.g. within last 90 days
  displayStatus: 'NO_REVIEWS' | 'LOW_VOLUME' | 'ESTABLISHED';
  methodologyVersion: string;
  lastAggregatedAt: string;
}

/**
 * Public-Safe DTO: Stripped of internal user IDs, household IDs, booking references,
 * payment details, incident logs, or fraud signals.
 */
export interface PublicReviewDTO {
  reviewId: ReviewId;
  providerId: ProviderId;
  businessId?: BusinessId;
  serviceType: ServiceCategory;
  serviceTitle: string;
  completedDateFormatted: string;
  overallRating: number;
  dimensions: { dimensionKey: ReviewDimensionKey; label: string; score: number }[];
  structuredTags: ReviewStructuredTag[];
  body: string;
  media: { url: string; mediaType: 'IMAGE' | 'VIDEO'; caption?: string }[];
  publicAuthorDisplayName: string;
  verifiedService: boolean;
  publishedAt: string;
  providerResponse?: {
    responseId: ReviewResponseId;
    responderRole: string;
    body: string;
    publishedAt: string;
  };
}
