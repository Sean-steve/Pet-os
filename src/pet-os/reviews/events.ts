/**
 * Pet OS Sprint 23 — Provider Reviews, Reputation, Service Quality & Trust Engine Domain Events
 * Implements Volume XXIX (Event, Command & Asynchronous Architecture)
 * 
 * Normative Invariants:
 * - Minimal data payloads (no broad broadcasting of free-text review bodies or private user IDs)
 * - Explicit causation & correlation tracking
 * - Safe for replay and idempotency
 */

import {
  ReviewId,
  ReviewEligibilityId,
  ReviewRevisionId,
  ReviewResponseId,
  ReviewReportId,
  ReviewDisputeId,
  ReviewAppealId,
  ReviewModerationActionId,
  ReviewAbuseSignalId,
  ReputationProjectionId,
  UserId,
  ProviderId,
  BusinessId,
  EventId,
  CorrelationId,
} from '../kernel/ids';
import {
  ReviewStatus,
  ServiceCategory,
  ReviewModerationActionType,
  ReviewReportReason,
  ReviewDisputeReason,
  ReviewAbuseSignalType,
} from './types';

export interface ReviewEventBase {
  eventId: EventId;
  correlationId?: CorrelationId;
  occurredAt: string;
  aggregateId: string;
  aggregateType: 'Review' | 'ReviewEligibility' | 'ReviewReport' | 'ReviewDispute' | 'ReviewAppeal' | 'ReputationProjection';
}

// 1. ReviewEligibilityGranted
export interface ReviewEligibilityGrantedEvent extends ReviewEventBase {
  eventType: 'ReviewEligibilityGranted';
  aggregateType: 'ReviewEligibility';
  payload: {
    eligibilityId: ReviewEligibilityId;
    bookingId: string;
    reviewerUserId: UserId;
    providerId: ProviderId;
    businessId?: BusinessId;
    serviceType: ServiceCategory;
    eligibleAt: string;
    expiresAt: string;
  };
}

// 2. ReviewSubmitted
export interface ReviewSubmittedEvent extends ReviewEventBase {
  eventType: 'ReviewSubmitted';
  aggregateType: 'Review';
  payload: {
    reviewId: ReviewId;
    eligibilityId: ReviewEligibilityId;
    reviewerUserId: UserId;
    providerId: ProviderId;
    businessId?: BusinessId;
    serviceType: ServiceCategory;
    overallRating: number;
    submittedAt: string;
  };
}

// 3. ReviewPublished
export interface ReviewPublishedEvent extends ReviewEventBase {
  eventType: 'ReviewPublished';
  aggregateType: 'Review';
  payload: {
    reviewId: ReviewId;
    providerId: ProviderId;
    businessId?: BusinessId;
    serviceType: ServiceCategory;
    overallRating: number;
    verifiedService: boolean;
    publishedAt: string;
  };
}

// 4. ReviewUpdated
export interface ReviewUpdatedEvent extends ReviewEventBase {
  eventType: 'ReviewUpdated';
  aggregateType: 'Review';
  payload: {
    reviewId: ReviewId;
    revisionId: ReviewRevisionId;
    version: number;
    providerId: ProviderId;
    overallRating: number;
    updatedAt: string;
  };
}

// 5. ReviewWithdrawn
export interface ReviewWithdrawnEvent extends ReviewEventBase {
  eventType: 'ReviewWithdrawn';
  aggregateType: 'Review';
  payload: {
    reviewId: ReviewId;
    providerId: ProviderId;
    reviewerUserId: UserId;
    withdrawnAt: string;
  };
}

// 6. ReviewReported
export interface ReviewReportedEvent extends ReviewEventBase {
  eventType: 'ReviewReported';
  aggregateType: 'ReviewReport';
  payload: {
    reportId: ReviewReportId;
    reviewId: ReviewId;
    reporterUserId: UserId;
    reason: ReviewReportReason;
    reportedAt: string;
  };
}

// 7. ReviewDisputed
export interface ReviewDisputedEvent extends ReviewEventBase {
  eventType: 'ReviewDisputed';
  aggregateType: 'ReviewDispute';
  payload: {
    disputeId: ReviewDisputeId;
    reviewId: ReviewId;
    providerId: ProviderId;
    reasonCategory: ReviewDisputeReason;
    disputedAt: string;
  };
}

// 8. ReviewModerated
export interface ReviewModeratedEvent extends ReviewEventBase {
  eventType: 'ReviewModerated';
  aggregateType: 'Review';
  payload: {
    actionId: ReviewModerationActionId;
    reviewId: ReviewId;
    moderatorUserId: UserId;
    action: ReviewModerationActionType;
    previousStatus: ReviewStatus;
    newStatus: ReviewStatus;
    reason: string;
    occurredAt: string;
  };
}

// 9. ReviewAppealed
export interface ReviewAppealedEvent extends ReviewEventBase {
  eventType: 'ReviewAppealed';
  aggregateType: 'ReviewAppeal';
  payload: {
    appealId: ReviewAppealId;
    reviewId: ReviewId;
    appellantUserId: UserId;
    appealedAt: string;
  };
}

// 10. ProviderRespondedToReview
export interface ProviderRespondedToReviewEvent extends ReviewEventBase {
  eventType: 'ProviderRespondedToReview';
  aggregateType: 'Review';
  payload: {
    responseId: ReviewResponseId;
    reviewId: ReviewId;
    providerId: ProviderId;
    responderUserId: UserId;
    publishedAt: string;
  };
}

// 11. ReviewResponseUpdated
export interface ReviewResponseUpdatedEvent extends ReviewEventBase {
  eventType: 'ReviewResponseUpdated';
  aggregateType: 'Review';
  payload: {
    responseId: ReviewResponseId;
    reviewId: ReviewId;
    version: number;
    updatedAt: string;
  };
}

// 12. ReviewAbuseSignalRaised
export interface ReviewAbuseSignalRaisedEvent extends ReviewEventBase {
  eventType: 'ReviewAbuseSignalRaised';
  aggregateType: 'Review';
  payload: {
    signalId: ReviewAbuseSignalId;
    reviewId?: ReviewId;
    providerId?: ProviderId;
    actorUserId: UserId;
    signalType: ReviewAbuseSignalType;
    severity: string;
    raisedAt: string;
  };
}

// 13. ReputationProjectionUpdated
export interface ReputationProjectionUpdatedEvent extends ReviewEventBase {
  eventType: 'ReputationProjectionUpdated';
  aggregateType: 'ReputationProjection';
  payload: {
    projectionId: ReputationProjectionId;
    targetId: string;
    targetType: 'PROVIDER' | 'BUSINESS';
    reviewCount: number;
    averageRating: number;
    updatedAt: string;
  };
}

// 14. ReviewSafetyConcernFlagged (Protected handoff to Trust & Safety)
export interface ReviewSafetyConcernFlaggedEvent extends ReviewEventBase {
  eventType: 'ReviewSafetyConcernFlagged';
  aggregateType: 'Review';
  payload: {
    reviewId: ReviewId;
    providerId: ProviderId;
    bookingId: string;
    allegationType: 'INJURY' | 'ABUSE' | 'ESCAPE_CONCEALMENT' | 'THEFT' | 'FRAUD';
    flaggedAt: string;
  };
}

// 15. ProviderReputationChanged (Discovery projection contract)
export interface ProviderReputationChangedEvent extends ReviewEventBase {
  eventType: 'ProviderReputationChanged';
  aggregateType: 'ReputationProjection';
  payload: {
    providerId: ProviderId;
    newAverageRating: number;
    reviewCount: number;
    displayStatus: 'NO_REVIEWS' | 'LOW_VOLUME' | 'ESTABLISHED';
    changedAt: string;
  };
}

export type ReviewDomainEvent =
  | ReviewEligibilityGrantedEvent
  | ReviewSubmittedEvent
  | ReviewPublishedEvent
  | ReviewUpdatedEvent
  | ReviewWithdrawnEvent
  | ReviewReportedEvent
  | ReviewDisputedEvent
  | ReviewModeratedEvent
  | ReviewAppealedEvent
  | ProviderRespondedToReviewEvent
  | ReviewResponseUpdatedEvent
  | ReviewAbuseSignalRaisedEvent
  | ReputationProjectionUpdatedEvent
  | ReviewSafetyConcernFlaggedEvent
  | ProviderReputationChangedEvent;
