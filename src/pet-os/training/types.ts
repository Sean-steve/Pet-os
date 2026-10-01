/**
 * Pet OS Sprint 8 - Training, Skills, Behavior Development & Household Execution
 * Implements Volume X (Training & Behavior Architecture), Volume IV, Volume VI, Volume XXV, Volume XXX, Volume XXXI
 *
 * Core Boundaries:
 * - Observations != Diagnoses: The Behavior Journal records observed facts, triggers, and context.
 *   It strictly refuses to diagnose aggression, anxiety, or compulsive disorders.
 * - Training Plans != Vague Checklists: Plans contain versioned programs, stages, exercises, and quantifiable attempts.
 * - Proficiency != Arbitrary Score: Skill proficiency follows canonical stages (NOT_STARTED -> RELIABLE).
 * - Safety Escalation: High-risk events (bites, severe fights, self-harm) surface neutral professional guidance.
 * - Provenance: Professional trainer assessments and records cannot be forged by household owners.
 */

import {
  UserId,
  HouseholdId,
  PetId,
  CareOccurrenceId,
  SkillId,
  TrainingGoalId,
  TrainingPlanId,
  TrainingProgramId,
  ProgramVersionId,
  ProgramStageId,
  TrainingExerciseId,
  TrainingSessionId,
  ExerciseAttemptId,
  SkillProgressId,
  TrainingMilestoneId,
  TrainingEvidenceId,
  BehaviorObservationId,
  BehaviorAmendmentId
} from '../kernel/ids';

// ==========================================
// 1. SKILL TAXONOMY & CATALOGUE
// ==========================================

export type SkillCategory =
  | 'FOUNDATION'
  | 'OBEDIENCE'
  | 'RECALL'
  | 'LEASH'
  | 'SOCIALIZATION'
  | 'HANDLING'
  | 'HOUSEHOLD'
  | 'IMPULSE_CONTROL'
  | 'SAFETY'
  | 'ENRICHMENT';

export type SpeciesScope = 'ALL' | 'CANIS_LUPUS_FAMILIARIS' | 'FELIS_CATUS' | 'EQUUS_CABALLUS' | 'OTHER';

export type LifecycleStageScope = 'PUPPY' | 'KITTEN' | 'ADULT' | 'SENIOR' | 'ALL_STAGES';

export type DifficultyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

export interface Skill {
  skillId: SkillId;
  skillCode: string;
  name: string;
  description: string;
  category: SkillCategory;
  speciesScope: SpeciesScope;
  lifecycleStageScope: LifecycleStageScope;
  prerequisiteSkillIds: SkillId[];
  difficultyLevel: DifficultyLevel;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 2. TRAINING GOALS
// ==========================================

export type GoalPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type GoalStatus = 'ACTIVE' | 'ACHIEVED' | 'ABANDONED';

export interface TrainingGoal {
  trainingGoalId: TrainingGoalId;
  householdId: HouseholdId;
  petId: PetId;
  skillId?: SkillId;
  targetDescription: string;
  sourceType: 'OWNER_DEFINED' | 'TRAINER_RECOMMENDED' | 'PROGRAM_DEFAULT';
  sourceActorId: UserId;
  targetDate?: string;
  priority: GoalPriority;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 3. TRAINING PROGRAMS, VERSIONS & STAGES
// ==========================================

export type ProgramStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';

export interface TrainingProgram {
  programId: TrainingProgramId;
  code: string;
  title: string;
  description: string;
  speciesScope: SpeciesScope;
  lifecycleStageScope: LifecycleStageScope;
  category: SkillCategory;
  status: ProgramStatus;
  currentVersionNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProgramVersion {
  programVersionId: ProgramVersionId;
  programId: TrainingProgramId;
  versionNumber: number;
  title: string;
  summary: string;
  status: ProgramStatus;
  stages: ProgramStage[];
  createdAt: string;
  publishedAt?: string;
}

export interface ProgramStage {
  stageId: ProgramStageId;
  programVersionId: ProgramVersionId;
  sequence: number;
  title: string;
  description: string;
  entryCriteria: string;
  completionCriteria: string;
  exercises: TrainingExercise[];
}

export type TrainingEnvironment =
  | 'HOME'
  | 'YARD'
  | 'QUIET_OUTDOOR'
  | 'BUSY_OUTDOOR'
  | 'PUBLIC_SPACE'
  | 'TRAINING_FACILITY';

export interface TrainingExercise {
  exerciseId: TrainingExerciseId;
  programVersionId: ProgramVersionId;
  stageId: ProgramStageId;
  skillId: SkillId;
  title: string;
  instructions: string;
  environment: TrainingEnvironment;
  recommendedDurationMinutes: number;
  repetitionTarget: number;
  difficulty: DifficultyLevel;
  successCriteria: string;
  safetyNotes?: string;
  evidenceRequirements?: string;
  sequence: number;
}

// ==========================================
// 4. TRAINING PLANS & PROVENANCE
// ==========================================

export type TrainingPlanType =
  | 'STANDARD_PROGRAM'
  | 'CUSTOM_HOUSEHOLD'
  | 'VETERINARY_REHABILITATION'
  | 'BEHAVIORAL_MODIFICATION';

export type PlanProvenanceType =
  | 'OWNER_CREATED'
  | 'TRAINER_CREATED'
  | 'SYSTEM_TEMPLATE'
  | 'IMPORTED';

export type TrainerVerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'NOT_APPLICABLE';

export type TrainingPlanStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'SUPERSEDED';

export interface TrainingPlan {
  trainingPlanId: TrainingPlanId;
  householdId: HouseholdId;
  petId: PetId;
  title: string;
  description: string;
  planType: TrainingPlanType;
  sourceType: PlanProvenanceType;
  sourceActorId: UserId;
  trainerId?: UserId;
  trainerName?: string;
  trainerOrganization?: string;
  trainerVerificationStatus: TrainerVerificationStatus;
  status: TrainingPlanStatus;
  programId?: TrainingProgramId;
  programVersionId?: ProgramVersionId;
  currentStageId?: ProgramStageId;
  startsAt: string;
  targetEndAt?: string;
  completedAt?: string;
  timezone: string;
  notes?: string;
  createdBy: UserId;
  createdAt: string;
  updatedAt: string;
  supersededBy?: TrainingPlanId;
  concurrencyVersion: number;
}

// ==========================================
// 5. TRAINING SESSIONS & ATTEMPTS
// ==========================================

export type TrainingSessionStatus =
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ABANDONED'
  | 'CANCELLED';

export type ExerciseAttemptResult =
  | 'NOT_ATTEMPTED'
  | 'INTRODUCED'
  | 'PARTIAL'
  | 'SUCCESSFUL_WITH_ASSISTANCE'
  | 'SUCCESSFUL'
  | 'INCONSISTENT'
  | 'REGRESSED';

export type AssistanceLevel =
  | 'FULL_GUIDANCE'
  | 'PARTIAL_GUIDANCE'
  | 'PROMPTED'
  | 'INDEPENDENT';

export type DistractionLevel = 'NONE' | 'LOW' | 'MODERATE' | 'HIGH';

export interface ExerciseAttempt {
  attemptId: ExerciseAttemptId;
  sessionId: TrainingSessionId;
  exerciseId: TrainingExerciseId;
  skillId: SkillId;
  sequence: number;
  startedAt: string;
  result: ExerciseAttemptResult;
  repetitions: number;
  successfulRepetitions: number;
  assistanceLevel: AssistanceLevel;
  distractionLevel: DistractionLevel;
  environment: TrainingEnvironment;
  notes?: string;
  evidenceId?: TrainingEvidenceId;
  recordedByUserId: UserId;
}

export interface TrainingSession {
  trainingSessionId: TrainingSessionId;
  householdId: HouseholdId;
  petId: PetId;
  planId: TrainingPlanId;
  stageId?: ProgramStageId;
  scheduledOccurrenceId?: CareOccurrenceId;
  status: TrainingSessionStatus;
  conductedByUserId: UserId;
  trainerId?: UserId;
  environment: TrainingEnvironment;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  overallPerformance?: ExerciseAttemptResult;
  notes?: string;
  treatCountRecorded?: number;
  attempts: ExerciseAttempt[];
  createdAt: string;
  updatedAt: string;
  concurrencyVersion: number;
}

// ==========================================
// 6. SKILL PROFICIENCY & PROGRESS
// ==========================================

export type SkillProficiencyLevel =
  | 'NOT_STARTED'
  | 'INTRODUCED'
  | 'LEARNING'
  | 'DEVELOPING'
  | 'RELIABLE_IN_CONTROLLED_ENVIRONMENT'
  | 'GENERALIZING'
  | 'RELIABLE';

export type AssessmentProvenance =
  | 'SYSTEM_DERIVED'
  | 'OWNER_ASSESSED'
  | 'TRAINER_ASSESSED';

export interface PetSkillProgress {
  skillProgressId: SkillProgressId;
  petId: PetId;
  householdId: HouseholdId;
  skillId: SkillId;
  currentProficiency: SkillProficiencyLevel;
  assessmentProvenance: AssessmentProvenance;
  lastAssessedAt: string;
  assessedByUserId: UserId;
  assessedByTrainerId?: UserId;
  trainerVerificationStatus?: TrainerVerificationStatus;
  sessionCount: number;
  successfulRepetitionsTotal: number;
  notes?: string;
  updatedAt: string;
}

export interface PetSkillProgressHistory {
  historyId: string;
  skillProgressId: SkillProgressId;
  petId: PetId;
  skillId: SkillId;
  previousProficiency: SkillProficiencyLevel;
  newProficiency: SkillProficiencyLevel;
  provenance: AssessmentProvenance;
  assessedByUserId: UserId;
  assessedByTrainerId?: UserId;
  reason?: string;
  timestamp: string;
}

// ==========================================
// 7. MILESTONES & EVIDENCE
// ==========================================

export type MilestoneType =
  | 'FIRST_SUCCESSFUL_EXECUTION'
  | 'STAGE_COMPLETED'
  | 'PROGRAM_COMPLETED'
  | 'TEN_INDEPENDENT_STREAK'
  | 'RELIABLE_PROFICIENCY_REACHED'
  | 'CUSTOM_ACHIEVEMENT';

export type MilestoneSource =
  | 'SESSION_AUTOMATED'
  | 'TRAINER_AWARDED'
  | 'OWNER_LOGGED';

export interface TrainingMilestone {
  milestoneId: TrainingMilestoneId;
  householdId: HouseholdId;
  petId: PetId;
  planId?: TrainingPlanId;
  skillId?: SkillId;
  milestoneType: MilestoneType;
  title: string;
  description: string;
  achievedAt: string;
  source: MilestoneSource;
  evidenceId?: TrainingEvidenceId;
  verifiedByUserId?: UserId;
  idempotencyKey: string;
  createdAt: string;
}

export type TrainingEvidenceType =
  | 'PHOTO'
  | 'VIDEO'
  | 'TRAINER_NOTE'
  | 'SESSION_RESULT'
  | 'OWNER_CONFIRMATION';

export interface TrainingEvidence {
  evidenceId: TrainingEvidenceId;
  householdId: HouseholdId;
  petId: PetId;
  sessionId?: TrainingSessionId;
  exerciseId?: TrainingExerciseId;
  evidenceType: TrainingEvidenceType;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number;
  description?: string;
  recordedAt: string;
  uploadedByUserId: UserId;
  verificationStatus: 'UNVERIFIED' | 'TRAINER_VERIFIED';
  verifiedByTrainerId?: UserId;
  createdAt: string;
}

// ==========================================
// 8. BEHAVIOR JOURNAL & OBSERVATIONS
// ==========================================

export type BehaviorCategory =
  | 'BARKING'
  | 'CHEWING'
  | 'DIGGING'
  | 'JUMPING'
  | 'RESOURCE_GUARDING_OBSERVATION'
  | 'FEAR_RESPONSE'
  | 'SEPARATION_BEHAVIOR'
  | 'TOILETING_EVENT'
  | 'REACTIVITY_OBSERVATION'
  | 'DESTRUCTIVE_BEHAVIOR'
  | 'OTHER';

export type BehaviorTrigger =
  | 'DOORBELL'
  | 'STRANGER'
  | 'OTHER_DOG'
  | 'LOUD_NOISE'
  | 'LEFT_ALONE'
  | 'FOOD_PRESENT'
  | 'HANDLING'
  | 'UNKNOWN'
  | 'OTHER';

export type BehaviorFrequency =
  | 'ONCE'
  | 'OCCASIONAL'
  | 'REPEATED_IN_SESSION'
  | 'DAILY_PATTERN';

export type ObservationProvenance =
  | 'OWNER_OBSERVED'
  | 'TRAINER_RECORDED'
  | 'CAREGIVER_OBSERVED';

export type HighRiskSafetyCategory =
  | 'BITE_ATTEMPT'
  | 'CONFIRMED_BITE'
  | 'SEVERE_FIGHT'
  | 'SELF_INJURY'
  | 'DANGEROUS_ESCAPE'
  | 'NONE';

export interface BehaviorAmendment {
  amendmentId: BehaviorAmendmentId;
  observationId: BehaviorObservationId;
  amendedAt: string;
  amendedByUserId: UserId;
  previousText: string;
  newText: string;
  reason: string;
}

export interface BehaviorObservation {
  observationId: BehaviorObservationId;
  householdId: HouseholdId;
  petId: PetId;
  observedAt: string;
  recordedAt: string;
  category: BehaviorCategory;
  behaviorDescription: string;
  context?: string;
  trigger: BehaviorTrigger;
  triggerCustomText?: string;
  durationMinutes?: number;
  frequency: BehaviorFrequency;
  /** Observational intensity rating on a 1-5 scale. Not a clinical severity score. */
  intensity: number;
  locationContext?: string;
  peoplePresent?: string;
  animalsPresent?: string;
  precedingEvent?: string;
  ownerResponse?: string;
  outcome?: string;
  /** Explicit owner interpretation, preserved distinctly from observed factual facts. */
  ownerInterpretation?: string;
  provenance: ObservationProvenance;
  recordedByUserId: UserId;
  trainerId?: UserId;
  trainerVerificationStatus?: TrainerVerificationStatus;
  highRiskCategory: HighRiskSafetyCategory;
  /** Non-diagnostic, calm safety escalation message if highRiskCategory != NONE. */
  safetyEscalationMessage?: string;
  amendments: BehaviorAmendment[];
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 9. READ MODELS & DTOs
// ==========================================

export interface TrainingProgressSummary {
  petId: PetId;
  activePlan?: TrainingPlan;
  currentProgramTitle?: string;
  currentStage?: ProgramStage;
  skillsCount: {
    notStarted: number;
    learning: number;
    developing: number;
    reliable: number;
  };
  recentSessions: TrainingSession[];
  milestonesCount: number;
  recentMilestones: TrainingMilestone[];
  highRiskObservationsCount: number;
}

export interface TodayTrainingTask {
  scheduledOccurrenceId?: CareOccurrenceId;
  planId: TrainingPlanId;
  planTitle: string;
  stageTitle: string;
  exercise: TrainingExercise;
  assignedUserId?: UserId;
  isCompleted: boolean;
  activeSessionId?: TrainingSessionId;
}

export interface TrainerHandoffSummary {
  petId: PetId;
  petName: string;
  species: string;
  breed: string;
  dateOfBirth: string;
  activeGoals: TrainingGoal[];
  skillsProficiency: Array<{
    skillName: string;
    category: SkillCategory;
    proficiency: SkillProficiencyLevel;
    provenance: AssessmentProvenance;
  }>;
  recentBehaviorObservations: Array<{
    observedAt: string;
    category: BehaviorCategory;
    trigger: BehaviorTrigger;
    intensity: number;
    description: string;
    highRisk: boolean;
  }>;
  healthConstraints: string[];
}
