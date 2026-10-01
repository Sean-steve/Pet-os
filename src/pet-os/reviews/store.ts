/**
 * Pet OS Sprint 23 — Reviews & Reputation In-Memory Store
 * Implements Volume XXX (Database Schema & Technical Data Dictionary)
 * 
 * Normative Invariants:
 * - Transactional consistency and atomicity
 * - Uniqueness constraint: Exactly ONE active review per canonical ReviewEligibility
 * - Rebuildable projections: Projections are derived read models rebuildable from canonical Review history
 */

import {
  ReviewId,
  ReviewEligibilityId,
  ReviewReportId,
  ReviewDisputeId,
  ReviewAppealId,
  ReviewModerationActionId,
  ReviewAbuseSignalId,
  ReviewDimensionDefinitionId,
  ReputationProjectionId,
  UserId,
  ProviderId,
  BusinessId,
  BookingId,
  asReviewDimensionDefinitionId,
} from '../kernel/ids';
import {
  Review,
  ReviewEligibility,
  ReviewReport,
  ReviewDispute,
  ReviewAppeal,
  ReviewModerationAction,
  ReviewAbuseSignal,
  ReviewDimensionDefinition,
  ProviderReputationProjection,
  ServiceCategory,
} from './types';
import { ReviewDomainEvent } from './events';

export class ReviewStore {
  private static instance: ReviewStore | null = null;

  // Primary Entity Tables
  private eligibilities = new Map<ReviewEligibilityId, ReviewEligibility>();
  private reviews = new Map<ReviewId, Review>();
  private dimensionDefinitions = new Map<ReviewDimensionDefinitionId, ReviewDimensionDefinition>();
  private reports = new Map<ReviewReportId, ReviewReport>();
  private disputes = new Map<ReviewDisputeId, ReviewDispute>();
  private appeals = new Map<ReviewAppealId, ReviewAppeal>();
  private moderationActions = new Map<ReviewModerationActionId, ReviewModerationAction>();
  private abuseSignals = new Map<ReviewAbuseSignalId, ReviewAbuseSignal>();
  private reputationProjections = new Map<string, ProviderReputationProjection>(); // key: `${targetType}:${targetId}`
  private events: ReviewDomainEvent[] = [];

  // Secondary Indexes for Concurrency & Performance
  private eligibilityByBooking = new Map<BookingId, ReviewEligibilityId>();
  private reviewByEligibility = new Map<ReviewEligibilityId, ReviewId>();
  private reviewsByProvider = new Map<ProviderId, Set<ReviewId>>();
  private reviewsByBusiness = new Map<BusinessId, Set<ReviewId>>();
  private reviewsByReviewer = new Map<UserId, Set<ReviewId>>();

  private constructor() {
    this.initializeDimensionDefinitions();
  }

  public static getInstance(): ReviewStore {
    if (!ReviewStore.instance) {
      ReviewStore.instance = new ReviewStore();
    }
    return ReviewStore.instance;
  }

  public clear(): void {
    this.eligibilities.clear();
    this.reviews.clear();
    this.reports.clear();
    this.disputes.clear();
    this.appeals.clear();
    this.moderationActions.clear();
    this.abuseSignals.clear();
    this.reputationProjections.clear();
    this.events = [];

    this.eligibilityByBooking.clear();
    this.reviewByEligibility.clear();
    this.reviewsByProvider.clear();
    this.reviewsByBusiness.clear();
    this.reviewsByReviewer.clear();

    this.initializeDimensionDefinitions();
  }

  // ==========================================================================
  // 1. CANONICAL SERVICE-SPECIFIC DIMENSION DEFINITIONS
  // ==========================================================================

  private initializeDimensionDefinitions(): void {
    this.dimensionDefinitions.clear();

    const defs: Omit<ReviewDimensionDefinition, 'dimensionId'>[] = [
      // Dog Walking
      {
        dimensionKey: 'PUNCTUALITY',
        label: 'Punctuality',
        description: 'Arrived on time for pickup and scheduled walk duration',
        minScore: 1,
        maxScore: 5,
        applicableServiceTypes: ['DOG_WALKING', 'TRANSPORT', 'PET_SITTING'],
        isRequired: true,
        version: 'v1.0.0',
      },
      {
        dimensionKey: 'COMMUNICATION',
        label: 'Communication',
        description: 'Responsive, clear handover notifications and timely updates',
        minScore: 1,
        maxScore: 5,
        applicableServiceTypes: ['DOG_WALKING', 'VETERINARY', 'TRAINING', 'GROOMING', 'BOARDING', 'PET_SITTING', 'TRANSPORT'],
        isRequired: true,
        version: 'v1.0.0',
      },
      {
        dimensionKey: 'PET_HANDLING',
        label: 'Pet Handling & Temperament',
        description: 'Gentle, patient, and appropriate leash/handling skills',
        minScore: 1,
        maxScore: 5,
        applicableServiceTypes: ['DOG_WALKING', 'GROOMING', 'BOARDING'],
        isRequired: true,
        version: 'v1.0.0',
      },
      {
        dimensionKey: 'SERVICE_EXECUTION',
        label: 'Service Execution',
        description: 'Completed full scheduled exercise routine and clean handover',
        minScore: 1,
        maxScore: 5,
        applicableServiceTypes: ['DOG_WALKING', 'TRANSPORT'],
        isRequired: true,
        version: 'v1.0.0',
      },

      // Grooming
      {
        dimensionKey: 'INSTRUCTION_ADHERENCE',
        label: 'Instruction Adherence',
        description: 'Followed owner style preferences and sensitivity notes',
        minScore: 1,
        maxScore: 5,
        applicableServiceTypes: ['GROOMING', 'BOARDING', 'PET_SITTING'],
        isRequired: true,
        version: 'v1.0.0',
      },
      {
        dimensionKey: 'GROOMING_OUTCOME',
        label: 'Grooming Outcome',
        description: 'Quality of coat trim, cleanliness, ear cleaning, and nail trimming',
        minScore: 1,
        maxScore: 5,
        applicableServiceTypes: ['GROOMING'],
        isRequired: true,
        version: 'v1.0.0',
      },

      // Boarding & Pet Sitting
      {
        dimensionKey: 'CARE_UPDATES',
        label: 'Care Updates & Photos',
        description: 'Sent scheduled meal, rest, and activity photos throughout the stay',
        minScore: 1,
        maxScore: 5,
        applicableServiceTypes: ['BOARDING', 'PET_SITTING'],
        isRequired: true,
        version: 'v1.0.0',
      },
      {
        dimensionKey: 'HANDOVER_EXPERIENCE',
        label: 'Handover & Containment',
        description: 'Smooth check-in, secure accommodation, and stress-free return',
        minScore: 1,
        maxScore: 5,
        applicableServiceTypes: ['BOARDING', 'PET_SITTING', 'TRANSPORT'],
        isRequired: true,
        version: 'v1.0.0',
      },

      // Transport
      {
        dimensionKey: 'TRANSIT_CARE',
        label: 'Transit Safety & Comfort',
        description: 'Vehicle cleanliness, safe crate containment, and climate comfort',
        minScore: 1,
        maxScore: 5,
        applicableServiceTypes: ['TRANSPORT'],
        isRequired: true,
        version: 'v1.0.0',
      },

      // Veterinary (Strict customer-experience bounds: NO medical diagnostic opinion)
      {
        dimensionKey: 'TIMELINESS',
        label: 'Appointment Timeliness',
        description: 'Punctuality and wait-time communication at the facility',
        minScore: 1,
        maxScore: 5,
        applicableServiceTypes: ['VETERINARY', 'TRAINING'],
        isRequired: true,
        version: 'v1.0.0',
      },
      {
        dimensionKey: 'FACILITY_EXPERIENCE',
        label: 'Facility Cleanliness & Atmosphere',
        description: 'Hygiene of examination area and calm waiting room management',
        minScore: 1,
        maxScore: 5,
        applicableServiceTypes: ['VETERINARY'],
        isRequired: true,
        version: 'v1.0.0',
      },
      {
        dimensionKey: 'EXPLANATION_CLARITY',
        label: 'Communication & Explanation Clarity',
        description: 'Clear explanation of home care steps and discharge guidance',
        minScore: 1,
        maxScore: 5,
        applicableServiceTypes: ['VETERINARY', 'TRAINING'],
        isRequired: true,
        version: 'v1.0.0',
      },

      // Training (Behavioral experience bounds: NO scientific efficacy verdict)
      {
        dimensionKey: 'SESSION_EXPERIENCE',
        label: 'Session Engagement & Coaching',
        description: 'Patience in explaining handling mechanics and homework steps',
        minScore: 1,
        maxScore: 5,
        applicableServiceTypes: ['TRAINING'],
        isRequired: true,
        version: 'v1.0.0',
      },
    ];

    defs.forEach((def, index) => {
      const dimensionId = asReviewDimensionDefinitionId(`dim-def-${index + 1}-${def.dimensionKey.toLowerCase()}`);
      this.dimensionDefinitions.set(dimensionId, {
        dimensionId,
        ...def,
      });
    });
  }

  public getDimensionDefinitions(): ReviewDimensionDefinition[] {
    return Array.from(this.dimensionDefinitions.values());
  }

  public getDimensionDefinitionsForServiceType(serviceType: ServiceCategory): ReviewDimensionDefinition[] {
    return Array.from(this.dimensionDefinitions.values()).filter(d =>
      d.applicableServiceTypes.includes(serviceType)
    );
  }

  // ==========================================================================
  // 2. ELIGIBILITY MANAGEMENT
  // ==========================================================================

  public saveEligibility(eligibility: ReviewEligibility): void {
    this.eligibilities.set(eligibility.eligibilityId, { ...eligibility });
    this.eligibilityByBooking.set(eligibility.bookingId, eligibility.eligibilityId);
  }

  public findEligibilityById(eligibilityId: ReviewEligibilityId): ReviewEligibility | undefined {
    const el = this.eligibilities.get(eligibilityId);
    return el ? { ...el } : undefined;
  }

  public findEligibilityByBookingId(bookingId: BookingId): ReviewEligibility | undefined {
    const elId = this.eligibilityByBooking.get(bookingId);
    if (!elId) return undefined;
    return this.findEligibilityById(elId);
  }

  public listEligibilitiesForUser(userId: UserId): ReviewEligibility[] {
    return Array.from(this.eligibilities.values())
      .filter(e => e.reviewerUserId === userId)
      .map(e => ({ ...e }));
  }

  public listAllEligibilities(): ReviewEligibility[] {
    return Array.from(this.eligibilities.values()).map(e => ({ ...e }));
  }

  // ==========================================================================
  // 3. REVIEW AGGREGATE MANAGEMENT
  // ==========================================================================

  public saveReview(review: Review): void {
    // Check concurrency & unique eligibility consumption
    const existingForEligibility = this.reviewByEligibility.get(review.eligibilityId);
    if (existingForEligibility && existingForEligibility !== review.reviewId) {
      throw new Error(`Integrity Invariant Violated: Eligibility ${review.eligibilityId} already consumed by Review ${existingForEligibility}.`);
    }

    this.reviews.set(review.reviewId, { ...review });
    this.reviewByEligibility.set(review.eligibilityId, review.reviewId);

    // Update Provider index
    if (!this.reviewsByProvider.has(review.providerId)) {
      this.reviewsByProvider.set(review.providerId, new Set());
    }
    this.reviewsByProvider.get(review.providerId)!.add(review.reviewId);

    // Update Business index
    if (review.businessId) {
      if (!this.reviewsByBusiness.has(review.businessId)) {
        this.reviewsByBusiness.set(review.businessId, new Set());
      }
      this.reviewsByBusiness.get(review.businessId)!.add(review.reviewId);
    }

    // Update Reviewer index
    if (!this.reviewsByReviewer.has(review.reviewerUserId)) {
      this.reviewsByReviewer.set(review.reviewerUserId, new Set());
    }
    this.reviewsByReviewer.get(review.reviewerUserId)!.add(review.reviewId);
  }

  public findReviewById(reviewId: ReviewId): Review | undefined {
    const rev = this.reviews.get(reviewId);
    return rev ? { ...rev } : undefined;
  }

  public findReviewByEligibilityId(eligibilityId: ReviewEligibilityId): Review | undefined {
    const revId = this.reviewByEligibility.get(eligibilityId);
    if (!revId) return undefined;
    return this.findReviewById(revId);
  }

  public listReviewsForProvider(providerId: ProviderId): Review[] {
    const ids = this.reviewsByProvider.get(providerId);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this.findReviewById(id))
      .filter((r): r is Review => r !== undefined);
  }

  public listReviewsForBusiness(businessId: BusinessId): Review[] {
    const ids = this.reviewsByBusiness.get(businessId);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this.findReviewById(id))
      .filter((r): r is Review => r !== undefined);
  }

  public listReviewsForUser(userId: UserId): Review[] {
    const ids = this.reviewsByReviewer.get(userId);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this.findReviewById(id))
      .filter((r): r is Review => r !== undefined);
  }

  public listAllReviews(): Review[] {
    return Array.from(this.reviews.values()).map(r => ({ ...r }));
  }

  // ==========================================================================
  // 4. REPORTS, DISPUTES, APPEALS & MODERATION
  // ==========================================================================

  public saveReport(report: ReviewReport): void {
    this.reports.set(report.reportId, { ...report });
  }

  public findReportById(reportId: ReviewReportId): ReviewReport | undefined {
    const rep = this.reports.get(reportId);
    return rep ? { ...rep } : undefined;
  }

  public listReportsForReview(reviewId: ReviewId): ReviewReport[] {
    return Array.from(this.reports.values()).filter(r => r.reviewId === reviewId);
  }

  public listAllReports(): ReviewReport[] {
    return Array.from(this.reports.values()).map(r => ({ ...r }));
  }

  public saveDispute(dispute: ReviewDispute): void {
    this.disputes.set(dispute.disputeId, { ...dispute });
  }

  public findDisputeById(disputeId: ReviewDisputeId): ReviewDispute | undefined {
    const d = this.disputes.get(disputeId);
    return d ? { ...d } : undefined;
  }

  public listDisputesForProvider(providerId: ProviderId): ReviewDispute[] {
    return Array.from(this.disputes.values()).filter(d => d.providerId === providerId);
  }

  public listAllDisputes(): ReviewDispute[] {
    return Array.from(this.disputes.values()).map(d => ({ ...d }));
  }

  public saveAppeal(appeal: ReviewAppeal): void {
    this.appeals.set(appeal.appealId, { ...appeal });
  }

  public findAppealById(appealId: ReviewAppealId): ReviewAppeal | undefined {
    const app = this.appeals.get(appealId);
    return app ? { ...app } : undefined;
  }

  public listAppealsForReview(reviewId: ReviewId): ReviewAppeal[] {
    return Array.from(this.appeals.values()).filter(a => a.reviewId === reviewId);
  }

  public listAllAppeals(): ReviewAppeal[] {
    return Array.from(this.appeals.values()).map(a => ({ ...a }));
  }

  public saveModerationAction(action: ReviewModerationAction): void {
    this.moderationActions.set(action.actionId, { ...action });
  }

  public listActionsForReview(reviewId: ReviewId): ReviewModerationAction[] {
    return Array.from(this.moderationActions.values()).filter(a => a.reviewId === reviewId);
  }

  public listAllModerationActions(): ReviewModerationAction[] {
    return Array.from(this.moderationActions.values()).map(a => ({ ...a }));
  }

  public saveAbuseSignal(signal: ReviewAbuseSignal): void {
    this.abuseSignals.set(signal.signalId, { ...signal });
  }

  public listAbuseSignals(): ReviewAbuseSignal[] {
    return Array.from(this.abuseSignals.values()).map(s => ({ ...s }));
  }

  // ==========================================================================
  // 5. REPUTATION PROJECTIONS
  // ==========================================================================

  public saveReputationProjection(projection: ProviderReputationProjection): void {
    const key = `${projection.targetType}:${projection.targetId}`;
    this.reputationProjections.set(key, { ...projection });
  }

  public findReputationProjection(targetType: 'PROVIDER' | 'BUSINESS', targetId: string): ProviderReputationProjection | undefined {
    const key = `${targetType}:${targetId}`;
    const p = this.reputationProjections.get(key);
    return p ? { ...p } : undefined;
  }

  public listAllProjections(): ProviderReputationProjection[] {
    return Array.from(this.reputationProjections.values()).map(p => ({ ...p }));
  }

  // ==========================================================================
  // 6. DOMAIN EVENTS & AUDITING
  // ==========================================================================

  public recordEvent(event: ReviewDomainEvent): void {
    this.events.push(event);
  }

  public listEvents(): ReviewDomainEvent[] {
    return [...this.events];
  }
}
