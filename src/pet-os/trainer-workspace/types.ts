/**
 * Pet OS Sprint 20 - Trainer Professional Workspace Domain Types
 * 
 * Implements:
 * - Volume XIV (Veterinary, Trainer, Groomer, Sitter & Boarding Workspaces)
 * - Volume VIII (Training, Skills, Behavior Development, Training Plans, Sessions, Progress & Milestones)
 * - Volume IV (Identity, Organizations & RBAC)
 * - Volume XII (Pet Services Marketplace & Appointment Handoffs)
 * - Volume XXIV & XXV (AI Safety, Non-Diagnostic Governance & Professional Provenance)
 * - Volume XXVIII (API Specification)
 * - Volume XXX (Database Schema & Technical Data Dictionary)
 * - Volume XXXI & XXXII (Security, Medical Privacy & Kenyan Regulatory Compliance)
 * - ADR-005 (Clinical & Professional Provenance Preserved: Owner Observations vs Professional Assessments)
 * 
 * Normative Rules:
 * 1. Sprint 8 is authoritative for Training & Behavior. DO NOT duplicate canonical entities.
 * 2. Strict credential verification: only verified trainers with active credentials can finalize professional plans & assessments.
 * 3. Explicit training access grants & owner consent: NO global pet search by name.
 * 4. Professional boundary: Trainers DO NOT diagnose medical conditions, prescribe medication, or override veterinary restrictions.
 * 5. Role-based permissions: Assistant trainers cannot finalize assessments or forge lead trainer signatures.
 * 6. Finalized records are immutable: corrections require explicit amendments.
 * 7. ZERO autonomous AI diagnosis, prescribing, or unsupervised training plan execution.
 */

import {
  UserId,
  HouseholdId,
  PetId,
  BusinessId,
  ProviderId,
  BookingId,
  TrainingPlanId,
  TrainingSessionId,
  TrainingExerciseId,
  SkillId,
  ProgramStageId,
  TrainingProgramId,
  ProgramVersionId,
  TrainingEvidenceId,
  BehaviorObservationId,
  PetDocumentId,
  CareOccurrenceId,
  TrainingAccessGrantId,
  TrainerClientRelationshipId,
  TrainerConsentId,
  TrainingEngagementId,
  ProfessionalTrainingAssessmentId,
  TrainerSessionAssignmentId,
  TrainerProgressReviewId,
  TrainerHomeworkHandoffId,
  TrainerReportId,
  TrainerRecordAmendmentId,
  TrainerCorrectionRequestId,
  TrainerWorkQueueItemId,
} from '../kernel/ids';

import {
  SkillProficiencyLevel,
  TrainingEnvironment,
  ExerciseAttemptResult,
  AssistanceLevel,
  DistractionLevel,
  BehaviorCategory,
  BehaviorTrigger,
  BehaviorFrequency,
  HighRiskSafetyCategory,
  TrainingPlanType,
  PlanProvenanceType,
  AssessmentProvenance,
  ObservationProvenance,
  TrainerVerificationStatus,
} from '../training/types';

// ============================================================================
// TRAINER STAFF ROLES & WORKSPACE PERMISSIONS
// ============================================================================

export type TrainerStaffRole =
  | 'TRAINING_BUSINESS_OWNER'
  | 'TRAINING_DIRECTOR'
  | 'LEAD_TRAINER'
  | 'STAFF_TRAINER'
  | 'ASSISTANT_TRAINER'
  | 'COORDINATOR';

export type TrainingAccessScope =
  | 'PET_IDENTITY_SUMMARY'
  | 'TRAINING_READ'
  | 'TRAINING_WRITE'
  | 'BEHAVIOR_READ'
  | 'BEHAVIOR_WRITE'
  | 'TRAINING_EVIDENCE_READ'
  | 'TRAINING_EVIDENCE_WRITE'
  | 'OWNER_INSTRUCTIONS_READ'
  | 'RELEVANT_HEALTH_RESTRICTIONS_READ'
  | 'ACTIVITY_SUMMARY_READ';

export type TrainingRelationshipType =
  | 'ONE_ON_ONE_COACHING'
  | 'BEHAVIOR_CONSULTATION'
  | 'PUPPY_FOUNDATION'
  | 'GROUP_CLASS_SERIES'
  | 'BOARD_AND_TRAIN'
  | 'DAY_TRAIN'
  | 'SERVICE_DOG_TASK_TRAINING'
  | 'SHELTER_REHABILITATION';

// ============================================================================
// TRAINING ACCESS GRANTS & OWNER CONSENT
// ============================================================================

export type TrainingAccessGrantStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface TrainingAccessGrant {
  grantId: TrainingAccessGrantId;
  petId: PetId;
  householdId: HouseholdId;
  grantedByUserId: UserId;
  businessId?: BusinessId;
  trainerId?: UserId;
  scopes: TrainingAccessScope[];
  status: TrainingAccessGrantStatus;
  relationshipType: TrainingRelationshipType;
  validFrom: string;
  validTo?: string;
  bookingId?: BookingId;
  consentId?: TrainerConsentId;
  reason: string;
  revokedAt?: string;
  revokedByUserId?: UserId;
  createdAt: string;
  updatedAt: string;
}

export interface TrainerConsent {
  consentId: TrainerConsentId;
  petId: PetId;
  householdId: HouseholdId;
  consentedByUserId: UserId;
  trainerId?: UserId;
  businessId?: BusinessId;
  trainingRelationship: TrainingRelationshipType;
  consentedAt: string;
  handlingRestrictions: string[];
  treatAllergenExclusions: string[];
  allowOffLeashControlledArea: boolean;
  emergencyVetCareAuthorized: boolean;
  designatedEmergencyVet?: string;
  photoVideoEvidenceConsent: boolean;
  marketingMediaConsent: boolean; // Must be false by default
  status: 'ACTIVE' | 'REVOKED';
  revokedAt?: string;
  revokedReason?: string;
  signatureText: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// TRAINER-CLIENT RELATIONSHIP
// ============================================================================

export type TrainerRelationshipStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'TERMINATED';

export interface TrainerClientRelationship {
  relationshipId: TrainerClientRelationshipId;
  businessId: BusinessId;
  primaryTrainerId: UserId;
  assignedAssistantTrainerIds: UserId[];
  householdId: HouseholdId;
  petId: PetId;
  status: TrainerRelationshipStatus;
  relationshipType: TrainingRelationshipType;
  currentPlanId?: TrainingPlanId;
  enrolledProgramId?: TrainingProgramId;
  enrolledProgramVersionId?: ProgramVersionId;
  activeGrantId: TrainingAccessGrantId;
  activeConsentId: TrainerConsentId;
  bookingId?: BookingId;
  startDate: string;
  targetEndDate?: string;
  terminationReason?: string;
  terminatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// PROFESSIONAL WORK QUEUE
// ============================================================================

export type TrainerWorkQueueType =
  | 'INTAKE_PENDING'
  | 'ASSESSMENT_DUE'
  | 'SESSION_SCHEDULED'
  | 'SESSION_IN_PROGRESS'
  | 'PROGRESS_REVIEW_DUE'
  | 'HOMEWORK_FOLLOW_UP'
  | 'SAFETY_ESCALATION'
  | 'COMPLETED';

export type TrainerWorkQueueStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TrainerWorkQueuePriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface TrainerWorkQueueItem {
  queueItemId: TrainerWorkQueueItemId;
  businessId: BusinessId;
  assignedTrainerId: UserId;
  petId: PetId;
  householdId: HouseholdId;
  clientName: string;
  petName: string;
  itemType: TrainerWorkQueueType;
  status: TrainerWorkQueueStatus;
  priority: TrainerWorkQueuePriority;
  scheduledAt?: string;
  dueAt?: string;
  completedAt?: string;
  relatedEntityId?: string; // bookingId, assessmentId, sessionId, etc.
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// PROFESSIONAL TRAINING ASSESSMENT
// ============================================================================

export type AssessmentStatus = 'DRAFT' | 'READY_FOR_REVIEW' | 'FINALIZED' | 'AMENDED' | 'ENTERED_IN_ERROR';

export interface SkillBaseline {
  skillId: SkillId;
  skillName: string;
  baselineProficiency: SkillProficiencyLevel;
  notes?: string;
}

export interface BehavioralObservationSummary {
  category: BehaviorCategory;
  trigger: BehaviorTrigger;
  frequency: BehaviorFrequency;
  intensity: number; // 1 to 5 observational rating
  description: string;
  handlerSafetyRisk: boolean;
}

export interface ProfessionalTrainingAssessment {
  assessmentId: ProfessionalTrainingAssessmentId;
  businessId: BusinessId;
  trainerId: UserId;
  leadTrainerId?: UserId;
  petId: PetId;
  householdId: HouseholdId;
  bookingId?: BookingId;
  relationshipId: TrainerClientRelationshipId;
  assessmentDate: string;
  status: AssessmentStatus;
  
  // Intake & Goals
  ownerStatedGoals: string[];
  trainerAssessedGoals: string[];
  
  // Baselines & Observations
  skillBaselines: SkillBaseline[];
  behaviorObservations: BehavioralObservationSummary[];
  
  // Health & Safety Boundaries
  healthRestrictionsNoted: string[];
  trainerEnvironmentalRecommendation: TrainingEnvironment;
  handlerSafetyPrecautions: string[];
  
  // Program & Plan Formulation
  recommendedProgramId?: TrainingProgramId;
  recommendedProgramVersionId?: ProgramVersionId;
  recommendedPlanTitle: string;
  recommendedPlanType: TrainingPlanType;
  prescribedPlanId?: TrainingPlanId;
  
  // Veterinary Boundary Hand-off
  veterinaryReferralRecommended: boolean;
  veterinaryReferralReason?: string;
  nonDiagnosticDisclaimer: string;
  
  // Signing & Finalization
  finalizedAt?: string;
  signedByTrainerId?: UserId;
  trainerCredentialSnapshot?: string;
  
  // Amendments
  amendments: TrainerRecordAmendment[];
  enteredInErrorReason?: string;
  
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// SESSION OPERATIONAL EXECUTION & PREP
// ============================================================================

export interface TrainerSessionPrepChecklist {
  healthRestrictionsVerified: boolean;
  activeHealthRestrictions: string[];
  safeTreatsConfirmed: boolean;
  allergenExclusions: string[];
  environmentPrepared: TrainingEnvironment;
  equipmentInspected: boolean;
  emergencyContactAvailable: boolean;
}

export interface HouseholdHandoffPayload {
  whatWorkedOn: string[];
  whatChangedSummary: string;
  whatToPractice: string[];
  practiceFrequencyRecommendation: string;
  whatToWatchFor: string[];
  followUpNotes: string;
  nextSessionRecommendation?: string;
}

export interface TrainerSessionExecution {
  assignmentId: TrainerSessionAssignmentId;
  canonicalSessionId?: TrainingSessionId;
  planId: TrainingPlanId;
  petId: PetId;
  householdId: HouseholdId;
  businessId: BusinessId;
  trainerId: UserId;
  assistantTrainerId?: UserId;
  bookingId?: BookingId;
  status: 'PREPARATION' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  prepChecklist: TrainerSessionPrepChecklist;
  startedAt?: string;
  completedAt?: string;
  durationMinutes?: number;
  overallPerformance?: ExerciseAttemptResult;
  handoffSummary?: HouseholdHandoffPayload;
  treatCountRecorded?: number;
  homeworkAssignedId?: TrainerHomeworkHandoffId;
  activityRecordProjected: boolean;
  bookingFulfilled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// HOMEWORK & CAREGIVER PRACTICE
// ============================================================================

export interface HomeworkExerciseTask {
  exerciseId: string;
  exerciseName: string;
  skillId: SkillId;
  targetRepetitions: number;
  targetFrequencyPerDay: number;
  instructions: string;
  safetyAdvice?: string;
}

export interface CaregiverHomeworkLog {
  logId: string;
  completedAt: string;
  completedByUserId: UserId;
  caregiverProvenance: 'HOUSEHOLD_CAREGIVER';
  repetitionsCompleted: number;
  successObserved: boolean;
  notes?: string;
}

export interface TrainerHomeworkAssignment {
  homeworkId: TrainerHomeworkHandoffId;
  sessionId?: TrainingSessionId;
  planId: TrainingPlanId;
  petId: PetId;
  householdId: HouseholdId;
  trainerId: UserId;
  assignedDate: string;
  dueDate: string;
  title: string;
  instructions: string;
  tasks: HomeworkExerciseTask[];
  status: 'ACTIVE' | 'COMPLETED' | 'OVERDUE' | 'SKIPPED';
  caregiverLogs: CaregiverHomeworkLog[];
  careOccurrenceId?: CareOccurrenceId;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// PROGRESS REVIEW & PLAN ADVANCEMENT
// ============================================================================

export type ProgressReviewDecision =
  | 'CONTINUE_CURRENT_PLAN'
  | 'PROGRESS_STAGE'
  | 'MODIFY_EXERCISES'
  | 'PAUSE_PLAN'
  | 'GRADUATE_PROGRAM'
  | 'VETERINARY_REFERRAL';

export interface ProfessionalProgressReview {
  reviewId: TrainerProgressReviewId;
  planId: TrainingPlanId;
  petId: PetId;
  householdId: HouseholdId;
  trainerId: UserId;
  businessId: BusinessId;
  reviewDate: string;
  decision: ProgressReviewDecision;
  stageAdvancedToId?: ProgramStageId;
  skillsMasteredCount: number;
  skillsInProgressCount: number;
  evidenceReviewedIds: TrainingEvidenceId[];
  clinicalOrVeterinaryConsultNeeded: boolean;
  referralReason?: string;
  trainerNotes: string;
  supersededPlanId?: TrainingPlanId;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// PROFESSIONAL TRAINING REPORT
// ============================================================================

export type TrainerReportType =
  | 'INTAKE_SUMMARY'
  | 'ASSESSMENT_REPORT'
  | 'PROGRESS_REPORT'
  | 'GRADUATION_CERTIFICATE'
  | 'BEHAVIOR_EVALUATION';

export interface SkillProgressSummaryEntry {
  skillName: string;
  initialProficiency: SkillProficiencyLevel;
  currentProficiency: SkillProficiencyLevel;
  achievedReliable: boolean;
}

export interface TrainerReport {
  reportId: TrainerReportId;
  petId: PetId;
  householdId: HouseholdId;
  businessId: BusinessId;
  authorTrainerId: UserId;
  leadTrainerSignoffId?: UserId;
  reportType: TrainerReportType;
  title: string;
  status: 'DRAFT' | 'FINALIZED' | 'AMENDED';
  executiveSummary: string;
  skillProgression: SkillProgressSummaryEntry[];
  behaviorChangesSummary: string;
  caregiverInstructions: string;
  documentId?: PetDocumentId;
  finalizedAt?: string;
  amendments: TrainerRecordAmendment[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// AMENDMENTS & CORRECTION REQUESTS
// ============================================================================

export interface TrainerRecordAmendment {
  amendmentId: TrainerRecordAmendmentId;
  targetEntityType: 'ASSESSMENT' | 'SESSION' | 'REPORT' | 'PROGRESS_REVIEW';
  targetEntityId: string;
  amendedByTrainerId: UserId;
  amendedAt: string;
  amendmentReason: string;
  correctionDetails: string;
  previousContentSnapshot: string;
}

export type CorrectionRequestStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'AMENDMENT_ISSUED';

export interface TrainerCorrectionRequest {
  requestId: TrainerCorrectionRequestId;
  petId: PetId;
  householdId: HouseholdId;
  requestedByUserId: UserId;
  targetEntityType: 'ASSESSMENT' | 'REPORT' | 'BEHAVIOR_OBSERVATION';
  targetEntityId: string;
  requestReason: string;
  proposedCorrection: string;
  status: CorrectionRequestStatus;
  reviewerTrainerId?: UserId;
  reviewerNotes?: string;
  amendmentId?: TrainerRecordAmendmentId;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// SAFETY ESCALATION & VETERINARY BOUNDARY
// ============================================================================

export interface TrainerSafetyEscalation {
  escalationId: string;
  petId: PetId;
  householdId: HouseholdId;
  trainerId: UserId;
  incidentDate: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  observationFacts: string;
  triggerIdentified: string;
  handlerSafetyRisk: boolean;
  recommendedMitigations: string[];
  veterinaryReferralRecommended: boolean;
  veterinaryReferralReason?: string;
  nonDiagnosticNotice: string;
  createdAt: string;
}
