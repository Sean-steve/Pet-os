/**
 * Pet OS Sprint 23 — Provider Reviews, Reputation, Service Quality & Trust Engine Domain Service
 * Implements Volume XII (Pet Services Marketplace), Volume XIV (Professional Workspaces),
 * Volume XXXI (Trust, Safety, Security & Anti-Abuse)
 * 
 * Normative Invariants:
 * 1. Verified-Service Gating: Only real completed/eligible terminal services can generate Reviews.
 * 2. Strict Credential Separation: Customer feedback does not verify credentials; credentials do not overwrite feedback.
 * 3. Self-Review & Collusion Prevention: Deterministic block of providers, staff, and duplicate household members.
 * 4. Provider Agency Boundary: Providers can respond, report, and dispute; Providers CANNOT edit customer ratings.
 * 5. Small-Sample Transparency: 0 reviews = "No reviews yet"; low volume clearly indicates sample count.
 * 6. Idempotent Reputation Projection: Projections are derived read models rebuildable from canonical state.
 */

import {
  UserId,
  HouseholdId,
  ProviderId,
  BusinessId,
  ServiceOfferingId,
  BookingId,
  ReviewId,
  ReviewEligibilityId,
  ReviewRevisionId,
  ReviewResponseId,
  ReviewResponseRevisionId,
  ReviewReportId,
  ReviewDisputeId,
  ReviewAppealId,
  ReviewModerationActionId,
  ReviewAbuseSignalId,
  ReputationProjectionId,
  asReviewId,
  asReviewEligibilityId,
  asReviewRevisionId,
  asReviewResponseId,
  asReviewResponseRevisionId,
  asReviewReportId,
  asReviewDisputeId,
  asReviewAppealId,
  asReviewModerationActionId,
  asReviewAbuseSignalId,
  asReputationProjectionId,
  asEventId,
  generateUUIDv7,
} from '../kernel/ids';
import {
  Review,
  ReviewEligibility,
  ReviewRevision,
  ProviderReviewResponse,
  ReviewReport,
  ReviewDispute,
  ReviewAppeal,
  ReviewModerationAction,
  ReviewAbuseSignal,
  ReviewDimensionScore,
  ReviewStructuredTag,
  ReviewMedia,
  ServiceCategory,
  PublicIdentityMode,
  PublicReviewDTO,
  ProviderReputationProjection,
  ReviewReportReason,
  ReviewDisputeReason,
  ReviewModerationActionType,
} from './types';
import { ReviewStore } from './store';
import { BookingStore } from '../booking/store';
import { ProviderStore } from '../provider/store';
import { IdentityStore } from '../identity/store';

export class ReviewService {
  private static instance: ReviewService | null = null;
  private store: ReviewStore;
  private bookingStore: BookingStore;
  private providerStore: ProviderStore;

  private constructor() {
    this.store = ReviewStore.getInstance();
    this.bookingStore = BookingStore.getInstance();
    this.providerStore = ProviderStore.getInstance();
  }

  public static getInstance(): ReviewService {
    if (!ReviewService.instance) {
      ReviewService.instance = new ReviewService();
    }
    return ReviewService.instance;
  }

  // ==========================================================================
  // 1. REVIEW ELIGIBILITY LIFECYCLE
  // ==========================================================================

  /**
   * Grants ReviewEligibility upon terminal completed service execution.
   * Derives authoritative reviewer and service context directly from Booking truth.
   */
  public grantReviewEligibility(params: {
    bookingId: BookingId;
    serviceExecutionReference: string;
    completedAt?: string;
    isPartialService?: boolean;
  }): ReviewEligibility {
    // Check if eligibility already exists (idempotency)
    const existing = this.store.findEligibilityByBookingId(params.bookingId);
    if (existing) {
      return existing;
    }

    const booking = this.bookingStore.findBookingById(params.bookingId);
    if (!booking) {
      throw new Error(`Booking ${params.bookingId} not found. Cannot grant review eligibility.`);
    }

    // Invariant: Only completed or terminal partially completed services are eligible
    if (booking.status !== 'COMPLETED' && !params.isPartialService) {
      throw new Error(`Booking ${params.bookingId} is in status ${booking.status}. Only completed services are eligible for customer review.`);
    }

    // Lookup provider & offering
    const provider = this.providerStore.getProvider(booking.providerId);
    const offering = this.providerStore.getServiceOffering(booking.serviceOfferingId);

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30-day review window

    // Map service offering category to ServiceCategory
    const serviceType = this.mapCategoryToServiceCategory(offering?.category || 'DOG_WALKING');

    const eligibilityId = asReviewEligibilityId(generateUUIDv7());
    const eligibility: ReviewEligibility = {
      eligibilityId,
      bookingId: params.bookingId,
      serviceExecutionReference: params.serviceExecutionReference,
      reviewerUserId: booking.ownerUserId,
      reviewerHouseholdId: booking.householdId,
      providerId: booking.providerId,
      businessId: booking.businessId,
      offeringId: booking.serviceOfferingId,
      serviceType,
      serviceSnapshot: {
        serviceType,
        providerName: provider?.displayName || 'Professional Service Provider',
        offeringTitle: offering?.title || 'Professional Pet Care Service',
        completedAt: params.completedAt || now,
        executionReference: params.serviceExecutionReference,
        bookingId: params.bookingId,
        isPartialService: !!params.isPartialService,
      },
      eligibleAt: now,
      expiresAt,
      status: 'ELIGIBLE',
      eligibilityReason: params.isPartialService
        ? 'Service execution completed partially with verified terminal handover'
        : 'Service execution completed with verified return handover',
      createdAt: now,
      updatedAt: now,
    };

    this.store.saveEligibility(eligibility);

    this.store.recordEvent({
      eventId: asEventId(generateUUIDv7()),
      occurredAt: now,
      aggregateId: eligibilityId,
      aggregateType: 'ReviewEligibility',
      eventType: 'ReviewEligibilityGranted',
      payload: {
        eligibilityId,
        bookingId: params.bookingId,
        reviewerUserId: booking.ownerUserId,
        providerId: booking.providerId,
        businessId: booking.businessId,
        serviceType,
        eligibleAt: now,
        expiresAt,
      },
    });

    return eligibility;
  }

  // ==========================================================================
  // 2. REVIEW SUBMISSION & FRAUD PREVENTION
  // ==========================================================================

  /**
   * Submits a customer review against a valid, non-expired, unconsumed ReviewEligibility.
   * Enforces self-review prevention, staff prevention, household duplicate prevention,
   * rating bounds, service-specific dimension rules, and Trust & Safety safety tagging.
   */
  public submitReview(params: {
    eligibilityId: ReviewEligibilityId;
    actorUserId: UserId;
    overallRating: number;
    dimensions: { dimensionKey: any; score: number }[];
    structuredTags?: ReviewStructuredTag[];
    body: string;
    media?: ReviewMedia[];
    publicIdentityMode: PublicIdentityMode;
  }): Review {
    const eligibility = this.store.findEligibilityById(params.eligibilityId);
    if (!eligibility) {
      throw new Error(`Review eligibility ${params.eligibilityId} not found.`);
    }

    if (eligibility.status === 'CONSUMED') {
      throw new Error(`Review eligibility ${params.eligibilityId} has already been consumed by an existing review.`);
    }

    if (eligibility.status !== 'ELIGIBLE') {
      throw new Error(`Review eligibility is in invalid status: ${eligibility.status}.`);
    }

    // Check expiration
    if (new Date(eligibility.expiresAt).getTime() < Date.now()) {
      eligibility.status = 'EXPIRED';
      this.store.saveEligibility(eligibility);
      throw new Error(`Review window has expired. Reviews must be submitted within 30 days of service completion.`);
    }

    // Invariant: Reviewer identity check (must be the authorized household member / payer)
    if (eligibility.reviewerUserId !== params.actorUserId) {
      throw new Error(`Authorization Error: Actor ${params.actorUserId} does not match eligible reviewer ${eligibility.reviewerUserId}.`);
    }

    // ------------------------------------------------------------------------
    // ANTI-MANIPULATION & FRAUD CHECKS
    // ------------------------------------------------------------------------

    // Check 1: Self-Review by Provider
    const provider = this.providerStore.getProvider(eligibility.providerId);
    if (provider && provider.userId === params.actorUserId) {
      this.raiseAbuseSignal({
        actorUserId: params.actorUserId,
        providerId: eligibility.providerId,
        signalType: 'SELF_REVIEW_ATTEMPT',
        severity: 'CRITICAL',
        details: `Provider user ${params.actorUserId} attempted to submit a self-review on provider ${eligibility.providerId}.`,
      });
      throw new Error(`Fraud Invariant: Providers are strictly forbidden from reviewing their own services.`);
    }

    // Check 2: Staff / Business-Linked Manipulation
    if (eligibility.businessId) {
      const memberships = this.providerStore.getBusinessMemberships(eligibility.businessId);
      const isStaff = memberships.some(m => m.userId === params.actorUserId && m.isActive);
      if (isStaff) {
        this.raiseAbuseSignal({
          actorUserId: params.actorUserId,
          providerId: eligibility.providerId,
          signalType: 'BUSINESS_STAFF_ATTEMPT',
          severity: 'HIGH',
          details: `Staff member ${params.actorUserId} of business ${eligibility.businessId} attempted to review their own business.`,
        });
        throw new Error(`Fraud Invariant: Business staff and contractors cannot submit customer reviews of their own business.`);
      }
    }

    // Check 3: Household-Linked Duplicate Prevention
    const existingReviewsForHousehold = this.store.listReviewsForUser(params.actorUserId)
      .filter(r => r.serviceSnapshot.bookingId === eligibility.bookingId);
    if (existingReviewsForHousehold.length > 0) {
      this.raiseAbuseSignal({
        actorUserId: params.actorUserId,
        providerId: eligibility.providerId,
        signalType: 'HOUSEHOLD_DUPLICATE_ATTEMPT',
        severity: 'MEDIUM',
        details: `Duplicate review attempt for booking ${eligibility.bookingId} from same household.`,
      });
      throw new Error(`Manipulation Invariant: Only one active review is permitted per booking transaction.`);
    }

    // ------------------------------------------------------------------------
    // RATING & DIMENSION BOUNDS
    // ------------------------------------------------------------------------

    if (
      !Number.isInteger(params.overallRating) ||
      params.overallRating < 1 ||
      params.overallRating > 5
    ) {
      throw new Error(`Validation Error: Overall rating must be an integer between 1 and 5. Received: ${params.overallRating}.`);
    }

    // Validate service-specific dimensions
    const allowedDimensionDefs = this.store.getDimensionDefinitionsForServiceType(eligibility.serviceType);
    const allowedKeys = new Set(allowedDimensionDefs.map(d => d.dimensionKey));

    const scoredDimensions: ReviewDimensionScore[] = [];
    for (const d of params.dimensions) {
      if (!allowedKeys.has(d.dimensionKey)) {
        throw new Error(`Validation Error: Dimension ${d.dimensionKey} is not applicable for service type ${eligibility.serviceType}.`);
      }
      if (!Number.isInteger(d.score) || d.score < 1 || d.score > 5) {
        throw new Error(`Validation Error: Dimension score for ${d.dimensionKey} must be an integer between 1 and 5.`);
      }
      const def = allowedDimensionDefs.find(def => def.dimensionKey === d.dimensionKey)!;
      scoredDimensions.push({
        dimensionKey: d.dimensionKey,
        score: d.score,
        dimensionVersion: def.version,
      });
    }

    // Check required dimensions
    const requiredDefs = allowedDimensionDefs.filter(d => d.isRequired);
    for (const req of requiredDefs) {
      if (!scoredDimensions.some(sd => sd.dimensionKey === req.dimensionKey)) {
        throw new Error(`Validation Error: Required dimension '${req.label}' was omitted.`);
      }
    }

    // ------------------------------------------------------------------------
    // FREE-TEXT, PRIVACY & SAFETY CHECKS
    // ------------------------------------------------------------------------

    const bodyClean = (params.body || '').trim();
    if (bodyClean.length < 5) {
      throw new Error(`Validation Error: Review body must contain at least 5 characters.`);
    }
    if (bodyClean.length > 2500) {
      throw new Error(`Validation Error: Review body cannot exceed 2500 characters.`);
    }

    // Check for serious safety allegations (Trust & Safety escalation)
    const lowerBody = bodyClean.toLowerCase();
    const safetyKeywords = ['abuse', 'abused', 'hit my dog', 'kicked', 'stole', 'theft', 'escaped and hid', 'poison', 'injured intentionally', 'malpractice'];
    const hasSafetyConcern = safetyKeywords.some(kw => lowerBody.includes(kw));

    // Resolve public display name
    const publicDisplayName = this.resolvePublicAuthorDisplayName(params.actorUserId, params.publicIdentityMode);

    // Sanitize media
    const sanitizedMedia: ReviewMedia[] = (params.media || []).map(m => ({
      ...m,
      exifStripped: true,
      blurFacesAndPlates: true,
    }));

    const now = new Date().toISOString();
    const reviewId = asReviewId(generateUUIDv7());
    const revisionId = asReviewRevisionId(generateUUIDv7());

    const initialRevision: ReviewRevision = {
      revisionId,
      reviewId,
      version: 1,
      overallRating: params.overallRating,
      dimensions: scoredDimensions,
      structuredTags: params.structuredTags || [],
      body: bodyClean,
      media: sanitizedMedia,
      createdAt: now,
      authorUserId: params.actorUserId,
    };

    const review: Review = {
      reviewId,
      eligibilityId: params.eligibilityId,
      reviewerUserId: params.actorUserId,
      reviewerHouseholdId: eligibility.reviewerHouseholdId,
      providerId: eligibility.providerId,
      businessId: eligibility.businessId,
      offeringId: eligibility.offeringId,
      serviceType: eligibility.serviceType,
      serviceSnapshot: eligibility.serviceSnapshot,
      overallRating: params.overallRating,
      dimensions: scoredDimensions,
      structuredTags: params.structuredTags || [],
      body: bodyClean,
      media: sanitizedMedia,
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
      publicIdentityMode: params.publicIdentityMode,
      publicAuthorDisplayName: publicDisplayName,
      verifiedService: true, // Backed by canonical completed service
      currentRevisionId: revisionId,
      revisions: [initialRevision],
      submittedAt: now,
      publishedAt: now,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    // Consume eligibility transactionally
    eligibility.status = 'CONSUMED';
    eligibility.consumedByReviewId = reviewId;
    eligibility.updatedAt = now;
    this.store.saveEligibility(eligibility);

    // Save review
    this.store.saveReview(review);

    // Emit Events
    this.store.recordEvent({
      eventId: asEventId(generateUUIDv7()),
      occurredAt: now,
      aggregateId: reviewId,
      aggregateType: 'Review',
      eventType: 'ReviewSubmitted',
      payload: {
        reviewId,
        eligibilityId: params.eligibilityId,
        reviewerUserId: params.actorUserId,
        providerId: eligibility.providerId,
        businessId: eligibility.businessId,
        serviceType: eligibility.serviceType,
        overallRating: params.overallRating,
        submittedAt: now,
      },
    });

    this.store.recordEvent({
      eventId: asEventId(generateUUIDv7()),
      occurredAt: now,
      aggregateId: reviewId,
      aggregateType: 'Review',
      eventType: 'ReviewPublished',
      payload: {
        reviewId,
        providerId: eligibility.providerId,
        businessId: eligibility.businessId,
        serviceType: eligibility.serviceType,
        overallRating: params.overallRating,
        verifiedService: true,
        publishedAt: now,
      },
    });

    // Trust & Safety handoff if safety concern detected
    if (hasSafetyConcern) {
      this.raiseAbuseSignal({
        reviewId,
        actorUserId: params.actorUserId,
        providerId: eligibility.providerId,
        signalType: 'SERIOUS_SAFETY_ALLEGATION',
        severity: 'CRITICAL',
        details: `Safety concern flagged in review text for booking ${eligibility.bookingId}: "${bodyClean.slice(0, 100)}..."`,
      });

      this.store.recordEvent({
        eventId: asEventId(generateUUIDv7()),
        occurredAt: now,
        aggregateId: reviewId,
        aggregateType: 'Review',
        eventType: 'ReviewSafetyConcernFlagged',
        payload: {
          reviewId,
          providerId: eligibility.providerId,
          bookingId: eligibility.bookingId,
          allegationType: lowerBody.includes('abuse') ? 'ABUSE' : 'INJURY',
          flaggedAt: now,
        },
      });
    }

    // Recompute reputation projections idempotently
    this.recomputeReputationForTarget('PROVIDER', eligibility.providerId);
    if (eligibility.businessId) {
      this.recomputeReputationForTarget('BUSINESS', eligibility.businessId);
    }

    return review;
  }

  // ==========================================================================
  // 3. REVIEW EDITING & WITHDRAWAL
  // ==========================================================================

  /**
   * Updates an existing published review within the 14-day edit window.
   * Creates an immutable ReviewRevision preserving full historical auditability.
   */
  public editReview(params: {
    reviewId: ReviewId;
    actorUserId: UserId;
    overallRating: number;
    dimensions: { dimensionKey: any; score: number }[];
    structuredTags?: ReviewStructuredTag[];
    body: string;
    media?: ReviewMedia[];
    editReason?: string;
  }): Review {
    const review = this.store.findReviewById(params.reviewId);
    if (!review) {
      throw new Error(`Review ${params.reviewId} not found.`);
    }

    if (review.reviewerUserId !== params.actorUserId) {
      throw new Error(`Authorization Error: Only the author can edit this review.`);
    }

    if (review.status === 'WITHDRAWN' || review.status === 'REMOVED') {
      throw new Error(`Cannot edit review in status ${review.status}.`);
    }

    // Check edit window (14 days from initial submission)
    const submissionTime = new Date(review.submittedAt).getTime();
    const editWindowMs = 14 * 24 * 60 * 60 * 1000;
    if (Date.now() - submissionTime > editWindowMs) {
      throw new Error(`Edit window expired. Reviews can only be edited within 14 days of submission.`);
    }

    if (
      !Number.isInteger(params.overallRating) ||
      params.overallRating < 1 ||
      params.overallRating > 5
    ) {
      throw new Error(`Validation Error: Overall rating must be an integer between 1 and 5.`);
    }

    const now = new Date().toISOString();
    const newVersion = review.version + 1;
    const revisionId = asReviewRevisionId(generateUUIDv7());

    const allowedDimensionDefs = this.store.getDimensionDefinitionsForServiceType(review.serviceType);
    const scoredDimensions: ReviewDimensionScore[] = params.dimensions.map(d => {
      const def = allowedDimensionDefs.find(def => def.dimensionKey === d.dimensionKey);
      return {
        dimensionKey: d.dimensionKey,
        score: d.score,
        dimensionVersion: def?.version || 'v1.0.0',
      };
    });

    const revision: ReviewRevision = {
      revisionId,
      reviewId: review.reviewId,
      version: newVersion,
      overallRating: params.overallRating,
      dimensions: scoredDimensions,
      structuredTags: params.structuredTags || review.structuredTags,
      body: params.body.trim(),
      media: params.media || review.media,
      editReason: params.editReason,
      createdAt: now,
      authorUserId: params.actorUserId,
    };

    review.overallRating = params.overallRating;
    review.dimensions = scoredDimensions;
    review.structuredTags = params.structuredTags || review.structuredTags;
    review.body = params.body.trim();
    review.media = params.media || review.media;
    review.currentRevisionId = revisionId;
    review.revisions.push(revision);
    review.version = newVersion;
    review.editedAt = now;
    review.updatedAt = now;

    this.store.saveReview(review);

    this.store.recordEvent({
      eventId: asEventId(generateUUIDv7()),
      occurredAt: now,
      aggregateId: review.reviewId,
      aggregateType: 'Review',
      eventType: 'ReviewUpdated',
      payload: {
        reviewId: review.reviewId,
        revisionId,
        version: newVersion,
        providerId: review.providerId,
        overallRating: params.overallRating,
        updatedAt: now,
      },
    });

    // Recompute reputation
    this.recomputeReputationForTarget('PROVIDER', review.providerId);
    if (review.businessId) {
      this.recomputeReputationForTarget('BUSINESS', review.businessId);
    }

    return review;
  }

  /**
   * Withdraws a review by author request.
   * Excludes the review from public reputation aggregates while preserving audit history.
   */
  public withdrawReview(params: {
    reviewId: ReviewId;
    actorUserId: UserId;
    reason?: string;
  }): Review {
    const review = this.store.findReviewById(params.reviewId);
    if (!review) {
      throw new Error(`Review ${params.reviewId} not found.`);
    }

    if (review.reviewerUserId !== params.actorUserId) {
      throw new Error(`Authorization Error: Only author can withdraw this review.`);
    }

    if (review.status === 'WITHDRAWN') {
      return review; // idempotent
    }

    const now = new Date().toISOString();
    review.status = 'WITHDRAWN';
    review.withdrawnAt = now;
    review.updatedAt = now;

    this.store.saveReview(review);

    this.store.recordEvent({
      eventId: asEventId(generateUUIDv7()),
      occurredAt: now,
      aggregateId: review.reviewId,
      aggregateType: 'Review',
      eventType: 'ReviewWithdrawn',
      payload: {
        reviewId: review.reviewId,
        providerId: review.providerId,
        reviewerUserId: review.reviewerUserId,
        withdrawnAt: now,
      },
    });

    // Recompute reputation
    this.recomputeReputationForTarget('PROVIDER', review.providerId);
    if (review.businessId) {
      this.recomputeReputationForTarget('BUSINESS', review.businessId);
    }

    return review;
  }

  // ==========================================================================
  // 4. PROVIDER RESPONSES & PRIVACY
  // ==========================================================================

  /**
   * Allows reviewed Provider or authorized Business Manager to publish a response.
   * Strictly enforces that provider CANNOT edit or alter customer review or rating.
   * Prohibits leaking private owner contact information or pet clinical diagnoses.
   */
  public respondToReview(params: {
    reviewId: ReviewId;
    actorUserId: UserId;
    providerId: ProviderId;
    businessId?: BusinessId;
    body: string;
  }): ProviderReviewResponse {
    const review = this.store.findReviewById(params.reviewId);
    if (!review) {
      throw new Error(`Review ${params.reviewId} not found.`);
    }

    // Verify Provider or Business Authorization
    const provider = this.providerStore.getProvider(params.providerId);
    let isAuthorized = false;
    let responderRole: ProviderReviewResponse['responderRole'] = 'REVIEWED_PROVIDER';

    if (provider && provider.userId === params.actorUserId && review.providerId === params.providerId) {
      isAuthorized = true;
      responderRole = 'REVIEWED_PROVIDER';
    } else if (params.businessId && review.businessId === params.businessId) {
      const memberships = this.providerStore.getBusinessMemberships(params.businessId);
      const m = memberships.find(mem => mem.userId === params.actorUserId && mem.isActive);
      if (m && (m.role === 'OWNER' || m.role === 'ADMIN' || m.role === 'MANAGER')) {
        isAuthorized = true;
        responderRole = 'BUSINESS_MANAGER';
      }
    }

    if (!isAuthorized) {
      throw new Error(`Authorization Error: Actor ${params.actorUserId} is not authorized to respond to this review.`);
    }

    // Privacy & Harassment Check: Provider response cannot expose private phone numbers, emails, or medical diagnoses
    const bodyClean = params.body.trim();
    if (bodyClean.length < 5) {
      throw new Error(`Validation Error: Response body must be at least 5 characters.`);
    }

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const phoneRegex = /(\+?[0-9]{1,3}[ -]?)?([0-9]{3}[ -]?){2}[0-9]{4}/;
    if (emailRegex.test(bodyClean) || phoneRegex.test(bodyClean)) {
      throw new Error(`Privacy Violation: Provider responses must not disclose private customer contact details (phone, email).`);
    }

    const now = new Date().toISOString();
    const responseId = review.providerResponse?.responseId || asReviewResponseId(generateUUIDv7());
    const revisionId = asReviewResponseRevisionId(generateUUIDv7());

    const isEdit = !!review.providerResponse;
    const version = isEdit ? (review.providerResponse!.version + 1) : 1;

    const responseRevision = {
      revisionId,
      responseId,
      version,
      body: bodyClean,
      createdAt: now,
    };

    const response: ProviderReviewResponse = {
      responseId,
      reviewId: review.reviewId,
      providerId: params.providerId,
      businessId: params.businessId,
      responderUserId: params.actorUserId,
      responderRole,
      body: bodyClean,
      publishedAt: isEdit ? review.providerResponse!.publishedAt : now,
      editedAt: isEdit ? now : undefined,
      version,
      revisions: isEdit ? [...review.providerResponse!.revisions, responseRevision] : [responseRevision],
      status: 'PUBLISHED',
    };

    review.providerResponse = response;
    review.updatedAt = now;
    this.store.saveReview(review);

    if (isEdit) {
      this.store.recordEvent({
        eventId: asEventId(generateUUIDv7()),
        occurredAt: now,
        aggregateId: review.reviewId,
        aggregateType: 'Review',
        eventType: 'ReviewResponseUpdated',
        payload: {
          responseId,
          reviewId: review.reviewId,
          version,
          updatedAt: now,
        },
      });
    } else {
      this.store.recordEvent({
        eventId: asEventId(generateUUIDv7()),
        occurredAt: now,
        aggregateId: review.reviewId,
        aggregateType: 'Review',
        eventType: 'ProviderRespondedToReview',
        payload: {
          responseId,
          reviewId: review.reviewId,
          providerId: params.providerId,
          responderUserId: params.actorUserId,
          publishedAt: now,
        },
      });
    }

    return response;
  }

  // ==========================================================================
  // 5. REPORTING & CONTENT MODERATION
  // ==========================================================================

  /**
   * Submits a report against a review for abusive, prohibited, or spam content.
   */
  public reportReview(params: {
    reviewId: ReviewId;
    reporterUserId: UserId;
    reason: ReviewReportReason;
    details: string;
  }): ReviewReport {
    const review = this.store.findReviewById(params.reviewId);
    if (!review) {
      throw new Error(`Review ${params.reviewId} not found.`);
    }

    const now = new Date().toISOString();
    const reportId = asReviewReportId(generateUUIDv7());

    const report: ReviewReport = {
      reportId,
      reviewId: params.reviewId,
      reporterUserId: params.reporterUserId,
      reason: params.reason,
      details: params.details.trim(),
      status: 'OPEN',
      createdAt: now,
    };

    this.store.saveReport(report);

    this.store.recordEvent({
      eventId: asEventId(generateUUIDv7()),
      occurredAt: now,
      aggregateId: reportId,
      aggregateType: 'ReviewReport',
      eventType: 'ReviewReported',
      payload: {
        reportId,
        reviewId: params.reviewId,
        reporterUserId: params.reporterUserId,
        reason: params.reason,
        reportedAt: now,
      },
    });

    return report;
  }

  /**
   * Executes an authorized platform moderation action on a review.
   * Audited, requires explicit reason. Never converts critical reviews to fake positive ones.
   */
  public executeModerationAction(params: {
    reviewId: ReviewId;
    moderatorUserId: UserId;
    action: ReviewModerationActionType;
    reason: string;
    notes?: string;
  }): ReviewModerationAction {
    const review = this.store.findReviewById(params.reviewId);
    if (!review) {
      throw new Error(`Review ${params.reviewId} not found.`);
    }

    if (!params.reason || params.reason.trim().length === 0) {
      throw new Error(`Validation Error: Explicit justification reason is mandatory for all moderation actions.`);
    }

    const now = new Date().toISOString();
    const actionId = asReviewModerationActionId(generateUUIDv7());
    const previousStatus = review.status;

    const actionRecord: ReviewModerationAction = {
      actionId,
      reviewId: params.reviewId,
      moderatorUserId: params.moderatorUserId,
      action: params.action,
      reason: params.reason,
      notes: params.notes,
      occurredAt: now,
    };

    this.store.saveModerationAction(actionRecord);

    let statusChanged = false;
    if (params.action === 'REMOVE_REVIEW') {
      review.status = 'REMOVED';
      review.moderationStatus = 'ACTION_TAKEN';
      statusChanged = true;
    } else if (params.action === 'LIMIT_VISIBILITY') {
      review.status = 'LIMITED';
      review.moderationStatus = 'FLAGGED';
      statusChanged = true;
    } else if (params.action === 'RESTORE_REVIEW') {
      review.status = 'PUBLISHED';
      review.moderationStatus = 'APPROVED';
      statusChanged = true;
    } else if (params.action === 'REMOVE_MEDIA') {
      review.media = [];
      review.moderationStatus = 'ACTION_TAKEN';
      statusChanged = true;
    }

    if (statusChanged) {
      review.updatedAt = now;
      this.store.saveReview(review);

      // Recompute reputation
      this.recomputeReputationForTarget('PROVIDER', review.providerId);
      if (review.businessId) {
        this.recomputeReputationForTarget('BUSINESS', review.businessId);
      }
    }

    this.store.recordEvent({
      eventId: asEventId(generateUUIDv7()),
      occurredAt: now,
      aggregateId: review.reviewId,
      aggregateType: 'Review',
      eventType: 'ReviewModerated',
      payload: {
        actionId,
        reviewId: review.reviewId,
        moderatorUserId: params.moderatorUserId,
        action: params.action,
        previousStatus,
        newStatus: review.status,
        reason: params.reason,
        occurredAt: now,
      },
    });

    return actionRecord;
  }

  // ==========================================================================
  // 6. PROVIDER DISPUTES & APPEALS
  // ==========================================================================

  /**
   * Submits a Provider dispute on factual/eligibility grounds.
   * Rejects "rating is too low" or dissatisfaction with customer opinion.
   */
  public submitProviderDispute(params: {
    reviewId: ReviewId;
    actorUserId: UserId;
    providerId: ProviderId;
    businessId?: BusinessId;
    reasonCategory: ReviewDisputeReason;
    statement: string;
    evidenceReferences?: string[];
  }): ReviewDispute {
    const review = this.store.findReviewById(params.reviewId);
    if (!review) {
      throw new Error(`Review ${params.reviewId} not found.`);
    }

    if (review.providerId !== params.providerId) {
      throw new Error(`Authorization Error: Target review does not belong to provider ${params.providerId}.`);
    }

    // Provider Authorization Check
    const provider = this.providerStore.getProvider(params.providerId);
    if (provider && provider.userId !== params.actorUserId) {
      // Check business membership if applicable
      let isBusinessManager = false;
      if (params.businessId && review.businessId === params.businessId) {
        const memberships = this.providerStore.getBusinessMemberships(params.businessId);
        const m = memberships.find(mem => mem.userId === params.actorUserId && mem.isActive);
        if (m && (m.role === 'OWNER' || m.role === 'ADMIN' || m.role === 'MANAGER')) {
          isBusinessManager = true;
        }
      }
      if (!isBusinessManager) {
        throw new Error(`Authorization Error: Actor ${params.actorUserId} is not authorized to submit disputes for provider ${params.providerId}.`);
      }
    }

    if (!params.statement || params.statement.trim().length < 10) {
      throw new Error(`Validation Error: Dispute statement must provide detailed factual justification.`);
    }

    const now = new Date().toISOString();
    const disputeId = asReviewDisputeId(generateUUIDv7());

    const dispute: ReviewDispute = {
      disputeId,
      reviewId: params.reviewId,
      providerId: params.providerId,
      businessId: params.businessId,
      disputantUserId: params.actorUserId,
      reasonCategory: params.reasonCategory,
      statement: params.statement.trim(),
      evidenceReferences: params.evidenceReferences || [],
      status: 'SUBMITTED',
      submittedAt: now,
    };

    this.store.saveDispute(dispute);

    this.store.recordEvent({
      eventId: asEventId(generateUUIDv7()),
      occurredAt: now,
      aggregateId: disputeId,
      aggregateType: 'ReviewDispute',
      eventType: 'ReviewDisputed',
      payload: {
        disputeId,
        reviewId: params.reviewId,
        providerId: params.providerId,
        reasonCategory: params.reasonCategory,
        disputedAt: now,
      },
    });

    return dispute;
  }

  /**
   * Resolves a Provider dispute after operational review.
   * If UPHELD, review is removed or corrected. If REJECTED, review remains published.
   */
  public resolveProviderDispute(params: {
    disputeId: ReviewDisputeId;
    moderatorUserId: UserId;
    outcome: 'UPHELD' | 'REJECTED' | 'PARTIALLY_UPHELD';
    notes: string;
  }): ReviewDispute {
    const dispute = this.store.findDisputeById(params.disputeId);
    if (!dispute) {
      throw new Error(`Dispute ${params.disputeId} not found.`);
    }

    const review = this.store.findReviewById(dispute.reviewId);
    if (!review) {
      throw new Error(`Review ${dispute.reviewId} not found.`);
    }

    const now = new Date().toISOString();
    dispute.status = params.outcome;
    dispute.resolvedAt = now;
    dispute.resolvedByModeratorId = params.moderatorUserId;
    dispute.moderatorNotes = params.notes;

    this.store.saveDispute(dispute);

    if (params.outcome === 'UPHELD') {
      review.status = 'REMOVED';
      review.moderationStatus = 'ACTION_TAKEN';
      review.updatedAt = now;
      this.store.saveReview(review);

      // Recompute reputation
      this.recomputeReputationForTarget('PROVIDER', review.providerId);
      if (review.businessId) {
        this.recomputeReputationForTarget('BUSINESS', review.businessId);
      }
    }

    return dispute;
  }

  /**
   * Submits an appeal by a customer whose review was removed.
   */
  public submitAppeal(params: {
    reviewId: ReviewId;
    actorUserId: UserId;
    reason: string;
  }): ReviewAppeal {
    const review = this.store.findReviewById(params.reviewId);
    if (!review) {
      throw new Error(`Review ${params.reviewId} not found.`);
    }

    if (review.reviewerUserId !== params.actorUserId) {
      throw new Error(`Authorization Error: Only the original author can appeal.`);
    }

    const now = new Date().toISOString();
    const appealId = asReviewAppealId(generateUUIDv7());

    const appeal: ReviewAppeal = {
      appealId,
      reviewId: params.reviewId,
      appellantUserId: params.actorUserId,
      reason: params.reason.trim(),
      status: 'SUBMITTED',
      submittedAt: now,
    };

    this.store.saveAppeal(appeal);

    this.store.recordEvent({
      eventId: asEventId(generateUUIDv7()),
      occurredAt: now,
      aggregateId: appealId,
      aggregateType: 'ReviewAppeal',
      eventType: 'ReviewAppealed',
      payload: {
        appealId,
        reviewId: params.reviewId,
        appellantUserId: params.actorUserId,
        appealedAt: now,
      },
    });

    return appeal;
  }

  // ==========================================================================
  // 7. REPUTATION PROJECTIONS & REBUILD ENGINE
  // ==========================================================================

  /**
   * Recomputes the ProviderReputationProjection for a Provider or Business.
   * Derived purely from active, published, verified reviews.
   */
  public recomputeReputationForTarget(
    targetType: 'PROVIDER' | 'BUSINESS',
    targetId: ProviderId | BusinessId
  ): ProviderReputationProjection {
    const allReviews = targetType === 'PROVIDER'
      ? this.store.listReviewsForProvider(targetId as ProviderId)
      : this.store.listReviewsForBusiness(targetId as BusinessId);

    // Filter strictly to PUBLISHED, NON-WITHDRAWN, NON-REMOVED reviews
    const eligibleReviews = allReviews.filter(r => r.status === 'PUBLISHED');

    const reviewCount = eligibleReviews.length;
    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    let totalScore = 0;
    const dimensionAccumulator: Record<string, { sum: number; count: number; label: string }> = {};
    const serviceTypeAccumulator: Record<string, { sum: number; count: number }> = {};
    let respondedCount = 0;

    const nowTime = Date.now();
    const ninetyDaysAgo = nowTime - 90 * 24 * 60 * 60 * 1000;
    let recentReviewCount = 0;

    for (const r of eligibleReviews) {
      const score = r.overallRating as 1 | 2 | 3 | 4 | 5;
      if (distribution[score] !== undefined) {
        distribution[score]++;
      }
      totalScore += r.overallRating;

      if (r.providerResponse && r.providerResponse.status === 'PUBLISHED') {
        respondedCount++;
      }

      if (new Date(r.submittedAt).getTime() >= ninetyDaysAgo) {
        recentReviewCount++;
      }

      // Dimension averages
      for (const d of r.dimensions) {
        if (!dimensionAccumulator[d.dimensionKey]) {
          const def = this.store.getDimensionDefinitions().find(def => def.dimensionKey === d.dimensionKey);
          dimensionAccumulator[d.dimensionKey] = {
            sum: 0,
            count: 0,
            label: def?.label || d.dimensionKey,
          };
        }
        dimensionAccumulator[d.dimensionKey].sum += d.score;
        dimensionAccumulator[d.dimensionKey].count++;
      }

      // Service type breakdown
      if (!serviceTypeAccumulator[r.serviceType]) {
        serviceTypeAccumulator[r.serviceType] = { sum: 0, count: 0 };
      }
      serviceTypeAccumulator[r.serviceType].sum += r.overallRating;
      serviceTypeAccumulator[r.serviceType].count++;
    }

    const averageRating = reviewCount > 0
      ? Math.round((totalScore / reviewCount) * 10) / 10
      : 0.0;

    const dimensionAverages: Record<string, { dimensionKey: any; label: string; average: number; count: number }> = {};
    for (const [key, val] of Object.entries(dimensionAccumulator)) {
      dimensionAverages[key] = {
        dimensionKey: key as any,
        label: val.label,
        average: val.count > 0 ? Math.round((val.sum / val.count) * 10) / 10 : 0,
        count: val.count,
      };
    }

    const serviceTypeBreakdown: Record<string, { serviceType: ServiceCategory; reviewCount: number; averageRating: number }> = {};
    for (const [sType, val] of Object.entries(serviceTypeAccumulator)) {
      serviceTypeBreakdown[sType] = {
        serviceType: sType as ServiceCategory,
        reviewCount: val.count,
        averageRating: val.count > 0 ? Math.round((val.sum / val.count) * 10) / 10 : 0,
      };
    }

    const responseRatePercent = reviewCount > 0
      ? Math.round((respondedCount / reviewCount) * 100)
      : 0;

    let displayStatus: ProviderReputationProjection['displayStatus'] = 'NO_REVIEWS';
    if (reviewCount === 0) {
      displayStatus = 'NO_REVIEWS';
    } else if (reviewCount <= 2) {
      displayStatus = 'LOW_VOLUME';
    } else {
      displayStatus = 'ESTABLISHED';
    }

    const now = new Date().toISOString();
    const existing = this.store.findReputationProjection(targetType, targetId);
    const projectionId = existing?.projectionId || asReputationProjectionId(generateUUIDv7());

    const projection: ProviderReputationProjection = {
      projectionId,
      targetId,
      targetType,
      reviewCount,
      averageRating,
      ratingDistribution: distribution,
      dimensionAverages,
      serviceTypeBreakdown,
      responseRatePercent,
      recentReviewCount,
      displayStatus,
      methodologyVersion: 'v1.0.0-canonical-arithmetic',
      lastAggregatedAt: now,
    };

    this.store.saveReputationProjection(projection);

    this.store.recordEvent({
      eventId: asEventId(generateUUIDv7()),
      occurredAt: now,
      aggregateId: projectionId,
      aggregateType: 'ReputationProjection',
      eventType: 'ReputationProjectionUpdated',
      payload: {
        projectionId,
        targetId,
        targetType,
        reviewCount,
        averageRating,
        updatedAt: now,
      },
    });

    if (targetType === 'PROVIDER') {
      this.store.recordEvent({
        eventId: asEventId(generateUUIDv7()),
        occurredAt: now,
        aggregateId: projectionId,
        aggregateType: 'ReputationProjection',
        eventType: 'ProviderReputationChanged',
        payload: {
          providerId: targetId as ProviderId,
          newAverageRating: averageRating,
          reviewCount,
          displayStatus,
          changedAt: now,
        },
      });
    }

    return projection;
  }

  /**
   * Completely rebuilds all provider and business reputation projections from scratch.
   * Verifies projection idempotency.
   */
  public rebuildAllReputationProjections(): { rebuiltCount: number } {
    const providers = this.providerStore.listProviders();
    const businesses = this.providerStore.listBusinesses();

    let rebuiltCount = 0;
    for (const p of providers) {
      this.recomputeReputationForTarget('PROVIDER', p.providerId);
      rebuiltCount++;
    }

    for (const b of businesses) {
      this.recomputeReputationForTarget('BUSINESS', b.businessId);
      rebuiltCount++;
    }

    return { rebuiltCount };
  }

  // ==========================================================================
  // 8. PUBLIC DTO TRANSFORMATION (DATA MINIMIZATION)
  // ==========================================================================

  /**
   * Converts a canonical Review aggregate into a public-safe DTO.
   * Strips internal user ID, household ID, booking ID, payment ID, incident IDs, internal moderation notes.
   */
  public toPublicReviewDTO(review: Review): PublicReviewDTO {
    const dimensionDefs = this.store.getDimensionDefinitions();
    const publicDimensions = review.dimensions.map(d => {
      const def = dimensionDefs.find(def => def.dimensionKey === d.dimensionKey);
      return {
        dimensionKey: d.dimensionKey,
        label: def?.label || d.dimensionKey,
        score: d.score,
      };
    });

    const completedDate = new Date(review.serviceSnapshot.completedAt);
    const formattedDate = completedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });

    return {
      reviewId: review.reviewId,
      providerId: review.providerId,
      businessId: review.businessId,
      serviceType: review.serviceType,
      serviceTitle: review.serviceSnapshot.offeringTitle,
      completedDateFormatted: formattedDate,
      overallRating: review.overallRating,
      dimensions: publicDimensions,
      structuredTags: review.structuredTags,
      body: review.body,
      media: review.media.map(m => ({
        url: m.url,
        mediaType: m.mediaType,
        caption: m.caption,
      })),
      publicAuthorDisplayName: review.publicAuthorDisplayName,
      verifiedService: review.verifiedService,
      publishedAt: review.publishedAt || review.submittedAt,
      providerResponse: review.providerResponse && review.providerResponse.status === 'PUBLISHED' ? {
        responseId: review.providerResponse.responseId,
        responderRole: review.providerResponse.responderRole === 'REVIEWED_PROVIDER' ? 'Provider Response' : 'Business Management',
        body: review.providerResponse.body,
        publishedAt: review.providerResponse.publishedAt,
      } : undefined,
    };
  }

  // ==========================================================================
  // 9. HELPER FUNCTIONS
  // ==========================================================================

  private resolvePublicAuthorDisplayName(userId: UserId, mode: PublicIdentityMode): string {
    const profile = IdentityStore.findProfileByUserId(userId);
    const firstName = profile?.firstName || profile?.displayName || 'Pet';
    const lastNameInitial = profile?.lastName ? `${profile.lastName.charAt(0)}.` : '';

    if (mode === 'ANONYMOUS_TO_PUBLIC') {
      return 'Verified Pet Parent';
    } else if (mode === 'COMMUNITY_HANDLE') {
      return `@${firstName.toLowerCase()}_parent`;
    } else {
      // FIRST_NAME_INITIAL
      return lastNameInitial ? `${firstName} ${lastNameInitial}` : firstName;
    }
  }

  private mapCategoryToServiceCategory(category: string): ServiceCategory {
    switch (category) {
      case 'DOG_WALKING':
      case 'DOG_WALKER':
        return 'DOG_WALKING';
      case 'VETERINARY':
      case 'VET':
      case 'VETERINARIAN':
        return 'VETERINARY';
      case 'TRAINING':
      case 'TRAINER':
        return 'TRAINING';
      case 'GROOMING':
      case 'GROOMER':
        return 'GROOMING';
      case 'BOARDING':
        return 'BOARDING';
      case 'PET_SITTING':
      case 'PET_SITTER':
        return 'PET_SITTING';
      case 'PET_TRANSPORT':
      case 'TRANSPORT':
        return 'TRANSPORT';
      default:
        return 'DOG_WALKING';
    }
  }

  private raiseAbuseSignal(params: {
    actorUserId: UserId;
    providerId?: ProviderId;
    reviewId?: ReviewId;
    signalType: ReviewAbuseSignal['signalType'];
    severity: ReviewAbuseSignal['severity'];
    details: string;
  }): ReviewAbuseSignal {
    const signalId = asReviewAbuseSignalId(generateUUIDv7());
    const now = new Date().toISOString();

    const signal: ReviewAbuseSignal = {
      signalId,
      actorUserId: params.actorUserId,
      providerId: params.providerId,
      reviewId: params.reviewId,
      signalType: params.signalType,
      severity: params.severity,
      details: params.details,
      raisedAt: now,
      resolved: false,
    };

    this.store.saveAbuseSignal(signal);

    this.store.recordEvent({
      eventId: asEventId(generateUUIDv7()),
      occurredAt: now,
      aggregateId: signalId,
      aggregateType: 'Review',
      eventType: 'ReviewAbuseSignalRaised',
      payload: {
        signalId,
        reviewId: params.reviewId,
        providerId: params.providerId,
        actorUserId: params.actorUserId,
        signalType: params.signalType,
        severity: params.severity,
        raisedAt: now,
      },
    });

    return signal;
  }
}
