/**
 * Pet OS Sprint 20 - Trainer Professional Workspace Store
 * 
 * In-memory repository with singleton architecture and deterministic state querying.
 */

import {
  PetId,
  UserId,
  BusinessId,
  TrainingAccessGrantId,
  TrainerConsentId,
  TrainerClientRelationshipId,
  TrainerWorkQueueItemId,
  ProfessionalTrainingAssessmentId,
  TrainerSessionAssignmentId,
  TrainerHomeworkHandoffId,
  TrainerProgressReviewId,
  TrainerReportId,
  TrainerRecordAmendmentId,
  TrainerCorrectionRequestId,
} from '../kernel/ids';

import {
  TrainingAccessGrant,
  TrainerConsent,
  TrainerClientRelationship,
  TrainerWorkQueueItem,
  ProfessionalTrainingAssessment,
  TrainerSessionExecution,
  TrainerHomeworkAssignment,
  ProfessionalProgressReview,
  TrainerReport,
  TrainerRecordAmendment,
  TrainerCorrectionRequest,
  TrainerSafetyEscalation,
} from './types';

export class TrainerWorkspaceStore {
  private static instance: TrainerWorkspaceStore | null = null;

  // Collections
  private grants: Map<TrainingAccessGrantId, TrainingAccessGrant> = new Map();
  private consents: Map<TrainerConsentId, TrainerConsent> = new Map();
  private relationships: Map<TrainerClientRelationshipId, TrainerClientRelationship> = new Map();
  private queueItems: Map<TrainerWorkQueueItemId, TrainerWorkQueueItem> = new Map();
  private assessments: Map<ProfessionalTrainingAssessmentId, ProfessionalTrainingAssessment> = new Map();
  private sessionExecutions: Map<TrainerSessionAssignmentId, TrainerSessionExecution> = new Map();
  private homeworkAssignments: Map<TrainerHomeworkHandoffId, TrainerHomeworkAssignment> = new Map();
  private progressReviews: Map<TrainerProgressReviewId, ProfessionalProgressReview> = new Map();
  private reports: Map<TrainerReportId, TrainerReport> = new Map();
  private amendments: Map<TrainerRecordAmendmentId, TrainerRecordAmendment> = new Map();
  private correctionRequests: Map<TrainerCorrectionRequestId, TrainerCorrectionRequest> = new Map();
  private safetyEscalations: Map<string, TrainerSafetyEscalation> = new Map();

  private constructor() {}

  public static getInstance(): TrainerWorkspaceStore {
    if (!TrainerWorkspaceStore.instance) {
      TrainerWorkspaceStore.instance = new TrainerWorkspaceStore();
    }
    return TrainerWorkspaceStore.instance;
  }

  public reset(): void {
    this.grants.clear();
    this.consents.clear();
    this.relationships.clear();
    this.queueItems.clear();
    this.assessments.clear();
    this.sessionExecutions.clear();
    this.homeworkAssignments.clear();
    this.progressReviews.clear();
    this.reports.clear();
    this.amendments.clear();
    this.correctionRequests.clear();
    this.safetyEscalations.clear();
  }

  // ============================================================================
  // GRANTS & CONSENT
  // ============================================================================

  public saveGrant(grant: TrainingAccessGrant): void {
    this.grants.set(grant.grantId, { ...grant });
  }

  public getGrant(grantId: TrainingAccessGrantId): TrainingAccessGrant | undefined {
    const grant = this.grants.get(grantId);
    return grant ? { ...grant } : undefined;
  }

  public findActiveGrant(petId: PetId, trainerOrBusinessId: string): TrainingAccessGrant | undefined {
    const now = new Date().toISOString();
    return Array.from(this.grants.values()).find(
      g =>
        g.petId === petId &&
        (g.trainerId === trainerOrBusinessId || g.businessId === trainerOrBusinessId) &&
        g.status === 'ACTIVE' &&
        (!g.validTo || g.validTo > now)
    );
  }

  public listGrantsForPet(petId: PetId): TrainingAccessGrant[] {
    return Array.from(this.grants.values()).filter(g => g.petId === petId);
  }

  public saveConsent(consent: TrainerConsent): void {
    this.consents.set(consent.consentId, { ...consent });
  }

  public getConsent(consentId: TrainerConsentId): TrainerConsent | undefined {
    const consent = this.consents.get(consentId);
    return consent ? { ...consent } : undefined;
  }

  public findActiveConsent(petId: PetId, trainerOrBusinessId: string): TrainerConsent | undefined {
    return Array.from(this.consents.values()).find(
      c =>
        c.petId === petId &&
        (c.trainerId === trainerOrBusinessId || c.businessId === trainerOrBusinessId) &&
        c.status === 'ACTIVE'
    );
  }

  public listConsentsForPet(petId: PetId): TrainerConsent[] {
    return Array.from(this.consents.values()).filter(c => c.petId === petId);
  }

  // ============================================================================
  // RELATIONSHIPS
  // ============================================================================

  public saveRelationship(rel: TrainerClientRelationship): void {
    this.relationships.set(rel.relationshipId, { ...rel });
  }

  public getRelationship(relId: TrainerClientRelationshipId): TrainerClientRelationship | undefined {
    const rel = this.relationships.get(relId);
    return rel ? { ...rel } : undefined;
  }

  public findActiveRelationship(petId: PetId, businessOrTrainerId: string): TrainerClientRelationship | undefined {
    return Array.from(this.relationships.values()).find(
      r =>
        r.petId === petId &&
        (r.businessId === businessOrTrainerId ||
          r.primaryTrainerId === businessOrTrainerId ||
          r.assignedAssistantTrainerIds.includes(businessOrTrainerId as UserId)) &&
        r.status === 'ACTIVE'
    );
  }

  public listRelationshipsForTrainer(trainerId: UserId): TrainerClientRelationship[] {
    return Array.from(this.relationships.values()).filter(
      r => r.primaryTrainerId === trainerId || r.assignedAssistantTrainerIds.includes(trainerId)
    );
  }

  public listRelationshipsForBusiness(businessId: BusinessId): TrainerClientRelationship[] {
    return Array.from(this.relationships.values()).filter(r => r.businessId === businessId);
  }

  // ============================================================================
  // WORK QUEUE
  // ============================================================================

  public saveQueueItem(item: TrainerWorkQueueItem): void {
    this.queueItems.set(item.queueItemId, { ...item });
  }

  public getQueueItem(itemId: TrainerWorkQueueItemId): TrainerWorkQueueItem | undefined {
    const item = this.queueItems.get(itemId);
    return item ? { ...item } : undefined;
  }

  public listQueueItems(businessId?: BusinessId, trainerId?: UserId): TrainerWorkQueueItem[] {
    return Array.from(this.queueItems.values()).filter(item => {
      if (businessId && item.businessId !== businessId) return false;
      if (trainerId && item.assignedTrainerId !== trainerId) return false;
      return true;
    });
  }

  // ============================================================================
  // ASSESSMENTS
  // ============================================================================

  public saveAssessment(assessment: ProfessionalTrainingAssessment): void {
    this.assessments.set(assessment.assessmentId, {
      ...assessment,
      skillBaselines: assessment.skillBaselines.map(b => ({ ...b })),
      behaviorObservations: assessment.behaviorObservations.map(o => ({ ...o })),
      amendments: assessment.amendments.map(a => ({ ...a })),
    });
  }

  public getAssessment(assessmentId: ProfessionalTrainingAssessmentId): ProfessionalTrainingAssessment | undefined {
    const a = this.assessments.get(assessmentId);
    if (!a) return undefined;
    return {
      ...a,
      skillBaselines: a.skillBaselines.map(b => ({ ...b })),
      behaviorObservations: a.behaviorObservations.map(o => ({ ...o })),
      amendments: a.amendments.map(am => ({ ...am })),
    };
  }

  public listAssessmentsForPet(petId: PetId): ProfessionalTrainingAssessment[] {
    return Array.from(this.assessments.values()).filter(a => a.petId === petId);
  }

  // ============================================================================
  // SESSION EXECUTIONS
  // ============================================================================

  public saveSessionExecution(session: TrainerSessionExecution): void {
    this.sessionExecutions.set(session.assignmentId, { ...session });
  }

  public getSessionExecution(assignmentId: TrainerSessionAssignmentId): TrainerSessionExecution | undefined {
    const s = this.sessionExecutions.get(assignmentId);
    return s ? { ...s } : undefined;
  }

  public listSessionExecutionsForPet(petId: PetId): TrainerSessionExecution[] {
    return Array.from(this.sessionExecutions.values()).filter(s => s.petId === petId);
  }

  // ============================================================================
  // HOMEWORK
  // ============================================================================

  public saveHomework(homework: TrainerHomeworkAssignment): void {
    this.homeworkAssignments.set(homework.homeworkId, {
      ...homework,
      tasks: homework.tasks.map(t => ({ ...t })),
      caregiverLogs: homework.caregiverLogs.map(l => ({ ...l })),
    });
  }

  public getHomework(homeworkId: TrainerHomeworkHandoffId): TrainerHomeworkAssignment | undefined {
    const h = this.homeworkAssignments.get(homeworkId);
    if (!h) return undefined;
    return {
      ...h,
      tasks: h.tasks.map(t => ({ ...t })),
      caregiverLogs: h.caregiverLogs.map(l => ({ ...l })),
    };
  }

  public listHomeworkForPet(petId: PetId): TrainerHomeworkAssignment[] {
    return Array.from(this.homeworkAssignments.values()).filter(h => h.petId === petId);
  }

  // ============================================================================
  // PROGRESS REVIEWS
  // ============================================================================

  public saveProgressReview(review: ProfessionalProgressReview): void {
    this.progressReviews.set(review.reviewId, { ...review });
  }

  public getProgressReview(reviewId: TrainerProgressReviewId): ProfessionalProgressReview | undefined {
    const r = this.progressReviews.get(reviewId);
    return r ? { ...r } : undefined;
  }

  public listProgressReviewsForPet(petId: PetId): ProfessionalProgressReview[] {
    return Array.from(this.progressReviews.values()).filter(r => r.petId === petId);
  }

  // ============================================================================
  // REPORTS
  // ============================================================================

  public saveReport(report: TrainerReport): void {
    this.reports.set(report.reportId, {
      ...report,
      skillProgression: report.skillProgression.map(s => ({ ...s })),
      amendments: report.amendments.map(a => ({ ...a })),
    });
  }

  public getReport(reportId: TrainerReportId): TrainerReport | undefined {
    const rep = this.reports.get(reportId);
    if (!rep) return undefined;
    return {
      ...rep,
      skillProgression: rep.skillProgression.map(s => ({ ...s })),
      amendments: rep.amendments.map(a => ({ ...a })),
    };
  }

  public listReportsForPet(petId: PetId): TrainerReport[] {
    return Array.from(this.reports.values()).filter(r => r.petId === petId);
  }

  // ============================================================================
  // AMENDMENTS & CORRECTION REQUESTS
  // ============================================================================

  public saveAmendment(amendment: TrainerRecordAmendment): void {
    this.amendments.set(amendment.amendmentId, { ...amendment });
  }

  public getAmendment(amendmentId: TrainerRecordAmendmentId): TrainerRecordAmendment | undefined {
    const am = this.amendments.get(amendmentId);
    return am ? { ...am } : undefined;
  }

  public saveCorrectionRequest(req: TrainerCorrectionRequest): void {
    this.correctionRequests.set(req.requestId, { ...req });
  }

  public getCorrectionRequest(requestId: TrainerCorrectionRequestId): TrainerCorrectionRequest | undefined {
    const cr = this.correctionRequests.get(requestId);
    return cr ? { ...cr } : undefined;
  }

  public listCorrectionRequestsForPet(petId: PetId): TrainerCorrectionRequest[] {
    return Array.from(this.correctionRequests.values()).filter(cr => cr.petId === petId);
  }

  // ============================================================================
  // SAFETY ESCALATIONS
  // ============================================================================

  public saveSafetyEscalation(esc: TrainerSafetyEscalation): void {
    this.safetyEscalations.set(esc.escalationId, { ...esc });
  }

  public listSafetyEscalationsForPet(petId: PetId): TrainerSafetyEscalation[] {
    return Array.from(this.safetyEscalations.values()).filter(e => e.petId === petId);
  }
}
