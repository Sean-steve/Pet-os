/**
 * Pet OS Sprint 8 - Training & Behavior Domain Service
 * Implements Volume X (Training & Behavior Architecture), Volume IV, Volume VI, Volume XXV, Volume XXX, Volume XXXI
 */

import {
  generateUUIDv7,
  asSkillId,
  asTrainingGoalId,
  asTrainingPlanId,
  asTrainingProgramId,
  asProgramVersionId,
  asProgramStageId,
  asTrainingExerciseId,
  asTrainingSessionId,
  asExerciseAttemptId,
  asSkillProgressId,
  asTrainingMilestoneId,
  asTrainingEvidenceId,
  asBehaviorObservationId,
  asBehaviorAmendmentId,
  asTreatLogId,
  asCareCompletionRecordId,
  asTimelineEventId,
  asCorrelationId,
  PetId,
  HouseholdId,
  UserId,
  SkillId,
  TrainingPlanId,
  TrainingSessionId,
  BehaviorObservationId,
  CareOccurrenceId,
  CareObligationId,
  TrainingProgramId,
  ProgramVersionId,
  ProgramStageId,
  TrainingExerciseId,
  TrainingEvidenceId
} from '../kernel/ids';
import { currentClockUtcNow } from '../kernel/time';
import { AuthorizationService } from '../identity/authorization';
import { IdentityStore } from '../identity/store';
import { Permission, HouseholdRole } from '../identity/types';
import { PetStore } from '../pet-core/store';
import { CareStore } from '../care/store';
import { NutritionStore } from '../nutrition/store';
import { HealthStore } from '../health/store';
import { TimelineStore } from '../timeline/store';
import { TimelineEvent } from '../timeline/types';
import { TrainingStore } from './store';
import { createTrainingDomainEvent } from './events';
import {
  Skill,
  TrainingGoal,
  TrainingPlan,
  TrainingProgram,
  ProgramVersion,
  ProgramStage,
  TrainingExercise,
  TrainingSession,
  ExerciseAttempt,
  PetSkillProgress,
  PetSkillProgressHistory,
  TrainingMilestone,
  TrainingEvidence,
  BehaviorObservation,
  BehaviorAmendment,
  SkillProficiencyLevel,
  AssessmentProvenance,
  TrainerVerificationStatus,
  HighRiskSafetyCategory,
  TrainingProgressSummary,
  TodayTrainingTask,
  TrainerHandoffSummary,
  TrainingEnvironment,
  ExerciseAttemptResult,
  AssistanceLevel,
  DistractionLevel,
  BehaviorCategory,
  BehaviorTrigger,
  BehaviorFrequency,
  ObservationProvenance,
  TrainingPlanType,
  PlanProvenanceType
} from './types';

export class TrainingService {
  // ==========================================
  // AUTHORIZATION HELPER
  // ==========================================

  private static assertAuthorized(
    userId: UserId,
    householdId: HouseholdId,
    action: Permission,
    petId?: PetId
  ): void {
    const user = IdentityStore.findUserById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const memberships = IdentityStore.listMembersForHousehold(householdId)
      .filter(m => m.userId === userId && m.status === 'ACTIVE');

    const subject = {
      userId,
      accountStatus: user.accountStatus,
      memberships: memberships.map(m => ({
        householdId: m.householdId,
        role: m.role,
        status: m.status,
        expiresAt: m.expiresAt
      }))
    };

    const resource = {
      type: 'pet' as const,
      householdId,
      petId
    };

    const decision = AuthorizationService.authorize(subject, action, resource, {
      currentTime: currentClockUtcNow()
    });

    if (!decision.allowed) {
      throw new Error(`Authorization failed for action "${action}": ${decision.message} (${decision.reasonCode})`);
    }

    // Verify pet belongs to household
    if (petId) {
      const pet = PetStore.findPetById(petId);
      if (!pet) {
        throw new Error(`Pet not found: ${petId}`);
      }
      if (pet.householdId !== householdId) {
        throw new Error(`IDOR Violation: Pet ${petId} does not belong to household ${householdId}`);
      }
    }
  }

  // ==========================================
  // SKILL CATALOGUE
  // ==========================================

  static createSkill(
    cmd: Omit<Skill, 'skillId' | 'version' | 'createdAt' | 'updatedAt'>,
    userId: UserId,
    householdId: HouseholdId
  ): Skill {
    this.assertAuthorized(userId, householdId, 'pet.training.plan.create');

    const skillId = asSkillId(generateUUIDv7());
    const now = currentClockUtcNow();
    const skill: Skill = {
      ...cmd,
      skillId,
      version: 1,
      createdAt: now,
      updatedAt: now
    };

    TrainingStore.saveSkill(skill);
    return skill;
  }

  static listSkills(filter?: { species?: string; category?: string }): Skill[] {
    return TrainingStore.listSkills(filter);
  }

  static getSkill(skillId: SkillId): Skill | undefined {
    return TrainingStore.findSkillById(skillId);
  }

  // ==========================================
  // TRAINING PROGRAMS & VERSIONING
  // ==========================================

  static createProgram(
    cmd: Omit<TrainingProgram, 'programId' | 'currentVersionNumber' | 'createdAt' | 'updatedAt'>,
    userId: UserId,
    householdId: HouseholdId
  ): TrainingProgram {
    this.assertAuthorized(userId, householdId, 'pet.training.plan.create');

    const programId = asTrainingProgramId(generateUUIDv7());
    const now = currentClockUtcNow();
    const program: TrainingProgram = {
      ...cmd,
      programId,
      currentVersionNumber: 1,
      createdAt: now,
      updatedAt: now
    };

    TrainingStore.saveProgram(program);
    return program;
  }

  static publishProgramVersion(
    cmd: Omit<ProgramVersion, 'programVersionId' | 'createdAt' | 'publishedAt'>,
    userId: UserId,
    householdId: HouseholdId
  ): ProgramVersion {
    this.assertAuthorized(userId, householdId, 'pet.training.plan.create');

    const program = TrainingStore.findProgramById(cmd.programId);
    if (!program) {
      throw new Error(`Program not found: ${cmd.programId}`);
    }

    const versionId = asProgramVersionId(generateUUIDv7());
    const now = currentClockUtcNow();

    const version: ProgramVersion = {
      ...cmd,
      programVersionId: versionId,
      status: 'PUBLISHED',
      createdAt: now,
      publishedAt: now
    };

    TrainingStore.saveProgramVersion(version);

    // Update program current version number if higher
    if (version.versionNumber >= program.currentVersionNumber) {
      TrainingStore.saveProgram({
        ...program,
        currentVersionNumber: version.versionNumber,
        status: 'PUBLISHED',
        updatedAt: now
      });
    }

    return version;
  }

  static getProgram(programId: TrainingProgramId): TrainingProgram | undefined {
    return TrainingStore.findProgramById(programId);
  }

  static listPrograms(): TrainingProgram[] {
    return TrainingStore.listPrograms();
  }

  static getProgramVersion(versionId: ProgramVersionId): ProgramVersion | undefined {
    return TrainingStore.findProgramVersionById(versionId);
  }

  static listVersionsForProgram(programId: TrainingProgramId): ProgramVersion[] {
    return TrainingStore.listVersionsForProgram(programId);
  }

  // ==========================================
  // TRAINING GOALS
  // ==========================================

  static createGoal(
    cmd: {
      householdId: HouseholdId;
      petId: PetId;
      skillId?: SkillId;
      targetDescription: string;
      sourceType: 'OWNER_DEFINED' | 'TRAINER_RECOMMENDED' | 'PROGRAM_DEFAULT';
      targetDate?: string;
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    },
    userId: UserId
  ): TrainingGoal {
    this.assertAuthorized(userId, cmd.householdId, 'pet.training.plan.create', cmd.petId);

    const goalId = asTrainingGoalId(generateUUIDv7());
    const now = currentClockUtcNow();
    const goal: TrainingGoal = {
      trainingGoalId: goalId,
      householdId: cmd.householdId,
      petId: cmd.petId,
      skillId: cmd.skillId,
      targetDescription: cmd.targetDescription,
      sourceType: cmd.sourceType,
      sourceActorId: userId,
      targetDate: cmd.targetDate,
      priority: cmd.priority,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };

    TrainingStore.saveGoal(goal);
    return goal;
  }

  static listGoalsForPet(petId: PetId, userId: UserId, householdId: HouseholdId): TrainingGoal[] {
    this.assertAuthorized(userId, householdId, 'pet.training.read', petId);
    return TrainingStore.listGoalsForPet(petId);
  }

  // ==========================================
  // TRAINING PLANS (AGGREGATE)
  // ==========================================

  static createPlan(
    cmd: {
      householdId: HouseholdId;
      petId: PetId;
      title: string;
      description: string;
      planType: TrainingPlanType;
      sourceType: PlanProvenanceType;
      trainerId?: UserId;
      trainerName?: string;
      trainerOrganization?: string;
      trainerVerificationStatus?: TrainerVerificationStatus;
      programId?: TrainingProgramId;
      programVersionId?: ProgramVersionId;
      currentStageId?: ProgramStageId;
      startsAt?: string;
      targetEndAt?: string;
      timezone?: string;
      notes?: string;
    },
    userId: UserId
  ): TrainingPlan {
    this.assertAuthorized(userId, cmd.householdId, 'pet.training.plan.create', cmd.petId);

    // Deceased pet guard
    const pet = PetStore.findPetById(cmd.petId);
    if (pet?.status === 'DECEASED') {
      throw new Error(`Cannot create a training plan for deceased pet: ${cmd.petId}`);
    }

    // Professional Provenance Protection: Only verified trainers or admins can declare TRAINER_CREATED
    if (cmd.sourceType === 'TRAINER_CREATED' && cmd.trainerVerificationStatus === 'VERIFIED') {
      const isOwnerOrAdmin = IdentityStore.listMembersForHousehold(cmd.householdId).some(
        m => m.userId === userId && (m.role === 'HOUSEHOLD_OWNER' || m.role === 'HOUSEHOLD_ADMIN')
      );
      if (!isOwnerOrAdmin && userId !== cmd.trainerId) {
        throw new Error('Unauthorized to forge a verified professional trainer plan');
      }
    }

    const planId = asTrainingPlanId(generateUUIDv7());
    const now = currentClockUtcNow();

    const plan: TrainingPlan = {
      trainingPlanId: planId,
      householdId: cmd.householdId,
      petId: cmd.petId,
      title: cmd.title,
      description: cmd.description,
      planType: cmd.planType,
      sourceType: cmd.sourceType,
      sourceActorId: userId,
      trainerId: cmd.trainerId,
      trainerName: cmd.trainerName,
      trainerOrganization: cmd.trainerOrganization,
      trainerVerificationStatus: cmd.trainerVerificationStatus || 'NOT_APPLICABLE',
      status: 'DRAFT',
      programId: cmd.programId,
      programVersionId: cmd.programVersionId,
      currentStageId: cmd.currentStageId,
      startsAt: cmd.startsAt || now,
      targetEndAt: cmd.targetEndAt,
      timezone: cmd.timezone || 'UTC',
      notes: cmd.notes,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      concurrencyVersion: 1
    };

    TrainingStore.savePlan(plan);

    // Emit event
    createTrainingDomainEvent('TrainingPlanCreated', planId, cmd.householdId, cmd.petId, userId, { plan });

    return plan;
  }

  static activatePlan(
    planId: TrainingPlanId,
    userId: UserId,
    householdId: HouseholdId
  ): TrainingPlan {
    const plan = TrainingStore.findPlanById(planId);
    if (!plan) throw new Error(`Training plan not found: ${planId}`);
    this.assertAuthorized(userId, householdId, 'pet.training.plan.activate', plan.petId);

    // Deceased pet guard
    const pet = PetStore.findPetById(plan.petId);
    if (pet?.status === 'DECEASED') {
      throw new Error(`Cannot activate training plan for deceased pet: ${plan.petId}`);
    }

    // State machine check
    if (plan.status !== 'DRAFT' && plan.status !== 'PAUSED') {
      throw new Error(`Cannot activate plan in status ${plan.status}. Must be DRAFT or PAUSED.`);
    }

    // Check if an existing plan is currently ACTIVE; if so, supersede it
    const activeExisting = TrainingStore.findActivePlanForPet(plan.petId);
    let supersededId: string | undefined;
    if (activeExisting && activeExisting.trainingPlanId !== planId) {
      supersededId = activeExisting.trainingPlanId;
      TrainingStore.savePlan({
        ...activeExisting,
        status: 'SUPERSEDED',
        supersededBy: planId,
        updatedAt: currentClockUtcNow(),
        concurrencyVersion: activeExisting.concurrencyVersion + 1
      });
    }

    const now = currentClockUtcNow();
    const updatedPlan: TrainingPlan = {
      ...plan,
      status: 'ACTIVE',
      updatedAt: now,
      concurrencyVersion: plan.concurrencyVersion + 1
    };

    TrainingStore.savePlan(updatedPlan);

    // Emit domain event
    createTrainingDomainEvent(
      'TrainingPlanActivated',
      planId,
      householdId,
      plan.petId,
      userId,
      { plan: updatedPlan, previousPlanId: supersededId }
    );

    // Project to Timeline
    TimelineStore.save({
      timelineEventId: asTimelineEventId(generateUUIDv7()),
      petId: plan.petId,
      householdId,
      eventType: 'TRAINING_PLAN_ACTIVATED',
      eventCategory: 'TRAINING',
      occurredAt: now,
      recordedAt: now,
      sourceDomain: 'TRAINING',
      sourceEntityType: 'TRAINING_PLAN',
      sourceEntityId: planId,
      sourceActorType: 'USER',
      sourceActorId: userId,
      provenanceType: plan.sourceType === 'TRAINER_CREATED' ? 'VERIFIED_PROFESSIONAL' : 'OWNER_ENTERED',
      title: `Training Plan Activated: ${plan.title}`,
      summary: plan.description || `Active training plan started.`,
      visibility: 'HOUSEHOLD',
      status: 'ACTIVE',
      correlationId: asCorrelationId(generateUUIDv7()),
      deduplicationKey: `PLAN_ACT_${planId}`,
      createdAt: now,
      updatedAt: now
    });

    return updatedPlan;
  }

  static pausePlan(
    planId: TrainingPlanId,
    reason: string,
    userId: UserId,
    householdId: HouseholdId
  ): TrainingPlan {
    const plan = TrainingStore.findPlanById(planId);
    if (!plan) throw new Error(`Training plan not found: ${planId}`);
    this.assertAuthorized(userId, householdId, 'pet.training.plan.update', plan.petId);

    if (plan.status !== 'ACTIVE') {
      throw new Error(`Cannot pause plan with status ${plan.status}. Must be ACTIVE.`);
    }

    const now = currentClockUtcNow();
    const updatedPlan: TrainingPlan = {
      ...plan,
      status: 'PAUSED',
      notes: plan.notes ? `${plan.notes}\n[PAUSED: ${reason}]` : `[PAUSED: ${reason}]`,
      updatedAt: now,
      concurrencyVersion: plan.concurrencyVersion + 1
    };

    TrainingStore.savePlan(updatedPlan);
    createTrainingDomainEvent('TrainingPlanPaused', planId, householdId, plan.petId, userId, {
      plan: updatedPlan,
      reason
    });
    return updatedPlan;
  }

  static cancelPlan(
    planId: TrainingPlanId,
    reason: string,
    userId: UserId,
    householdId: HouseholdId
  ): TrainingPlan {
    const plan = TrainingStore.findPlanById(planId);
    if (!plan) throw new Error(`Training plan not found: ${planId}`);
    this.assertAuthorized(userId, householdId, 'pet.training.plan.cancel', plan.petId);

    // Protected trainer plan rule: If created by verified trainer, non-owner/non-admin cannot cancel
    if (plan.sourceType === 'TRAINER_CREATED' && plan.trainerVerificationStatus === 'VERIFIED') {
      const membership = IdentityStore.listMembersForHousehold(householdId).find(m => m.userId === userId);
      if (!membership || (membership.role !== 'HOUSEHOLD_OWNER' && membership.role !== 'HOUSEHOLD_ADMIN')) {
        throw new Error('Trainer-prescribed plans cannot be cancelled by ordinary caregivers or temporary members.');
      }
    }

    const now = currentClockUtcNow();
    const updatedPlan: TrainingPlan = {
      ...plan,
      status: 'CANCELLED',
      notes: plan.notes ? `${plan.notes}\n[CANCELLED: ${reason}]` : `[CANCELLED: ${reason}]`,
      updatedAt: now,
      concurrencyVersion: plan.concurrencyVersion + 1
    };

    TrainingStore.savePlan(updatedPlan);
    createTrainingDomainEvent('TrainingPlanCancelled', planId, householdId, plan.petId, userId, {
      plan: updatedPlan,
      reason
    });
    return updatedPlan;
  }

  static getPlan(planId: TrainingPlanId): TrainingPlan | undefined {
    return TrainingStore.findPlanById(planId);
  }

  static getActivePlanForPet(petId: PetId, userId: UserId, householdId: HouseholdId): TrainingPlan | undefined {
    this.assertAuthorized(userId, householdId, 'pet.training.read', petId);
    return TrainingStore.findActivePlanForPet(petId);
  }

  static listPlansForPet(petId: PetId, userId: UserId, householdId: HouseholdId): TrainingPlan[] {
    this.assertAuthorized(userId, householdId, 'pet.training.read', petId);
    return TrainingStore.listPlansForPet(petId);
  }

  // ==========================================
  // TRAINING SESSIONS & EXECUTION
  // ==========================================

  static startSession(
    cmd: {
      householdId: HouseholdId;
      petId: PetId;
      planId: TrainingPlanId;
      stageId?: ProgramStageId;
      scheduledOccurrenceId?: CareOccurrenceId;
      environment: TrainingEnvironment;
      trainerId?: UserId;
      notes?: string;
    },
    userId: UserId
  ): TrainingSession {
    this.assertAuthorized(userId, cmd.householdId, 'pet.training.session.start', cmd.petId);

    // Deceased pet guard
    const pet = PetStore.findPetById(cmd.petId);
    if (pet?.status === 'DECEASED') {
      throw new Error(`Cannot conduct training sessions with deceased pet: ${cmd.petId}`);
    }

    // Concurrency guard: Only one session IN_PROGRESS per pet
    const active = TrainingStore.findActiveSessionForPet(cmd.petId);
    if (active) {
      throw new Error(
        `Pet ${cmd.petId} already has an active training session in progress (${active.trainingSessionId}). Complete or abandon it first.`
      );
    }

    // Plan validation
    const plan = TrainingStore.findPlanById(cmd.planId);
    if (!plan) throw new Error(`Training plan not found: ${cmd.planId}`);
    if (plan.status !== 'ACTIVE') {
      throw new Error(`Cannot start session for plan with status ${plan.status}. Plan must be ACTIVE.`);
    }

    const sessionId = asTrainingSessionId(generateUUIDv7());
    const now = currentClockUtcNow();

    const session: TrainingSession = {
      trainingSessionId: sessionId,
      householdId: cmd.householdId,
      petId: cmd.petId,
      planId: cmd.planId,
      stageId: cmd.stageId || plan.currentStageId,
      scheduledOccurrenceId: cmd.scheduledOccurrenceId,
      status: 'IN_PROGRESS',
      conductedByUserId: userId,
      trainerId: cmd.trainerId,
      environment: cmd.environment,
      startedAt: now,
      attempts: [],
      notes: cmd.notes,
      createdAt: now,
      updatedAt: now,
      concurrencyVersion: 1
    };

    TrainingStore.saveSession(session);
    createTrainingDomainEvent('TrainingSessionStarted', sessionId, cmd.householdId, cmd.petId, userId, { session });
    return session;
  }

  static recordAttempt(
    cmd: {
      sessionId: TrainingSessionId;
      exerciseId: TrainingExerciseId;
      skillId: SkillId;
      result: ExerciseAttemptResult;
      repetitions: number;
      successfulRepetitions: number;
      assistanceLevel: AssistanceLevel;
      distractionLevel: DistractionLevel;
      environment: TrainingEnvironment;
      notes?: string;
      evidenceId?: TrainingEvidenceId;
    },
    userId: UserId,
    householdId: HouseholdId
  ): ExerciseAttempt {
    const session = TrainingStore.findSessionById(cmd.sessionId);
    if (!session) throw new Error(`Session not found: ${cmd.sessionId}`);
    this.assertAuthorized(userId, householdId, 'pet.training.session.start', session.petId);

    if (session.status !== 'IN_PROGRESS') {
      throw new Error(`Cannot record attempt for session in status ${session.status}. Must be IN_PROGRESS.`);
    }

    const attemptId = asExerciseAttemptId(generateUUIDv7());
    const sequence = session.attempts.length + 1;
    const now = currentClockUtcNow();

    const attempt: ExerciseAttempt = {
      attemptId,
      sessionId: cmd.sessionId,
      exerciseId: cmd.exerciseId,
      skillId: cmd.skillId,
      sequence,
      startedAt: now,
      result: cmd.result,
      repetitions: cmd.repetitions,
      successfulRepetitions: cmd.successfulRepetitions,
      assistanceLevel: cmd.assistanceLevel,
      distractionLevel: cmd.distractionLevel,
      environment: cmd.environment,
      notes: cmd.notes,
      evidenceId: cmd.evidenceId,
      recordedByUserId: userId
    };

    TrainingStore.saveAttempt(attempt);

    // Append attempt to session
    session.attempts.push(attempt);
    session.updatedAt = now;
    session.concurrencyVersion += 1;
    TrainingStore.saveSession(session);

    return attempt;
  }

  static completeSession(
    cmd: {
      sessionId: TrainingSessionId;
      overallPerformance: ExerciseAttemptResult;
      notes?: string;
      treatCountRecorded?: number;
      treatFoodId?: string;
    },
    userId: UserId,
    householdId: HouseholdId
  ): TrainingSession {
    const session = TrainingStore.findSessionById(cmd.sessionId);
    if (!session) throw new Error(`Session not found: ${cmd.sessionId}`);
    this.assertAuthorized(userId, householdId, 'pet.training.session.complete', session.petId);

    if (session.status !== 'IN_PROGRESS') {
      throw new Error(`Cannot complete session in status ${session.status}. Must be IN_PROGRESS.`);
    }

    const now = currentClockUtcNow();
    const durationSeconds = Math.max(
      30,
      Math.round((new Date(now).getTime() - new Date(session.startedAt).getTime()) / 1000)
    );

    const updatedSession: TrainingSession = {
      ...session,
      status: 'COMPLETED',
      endedAt: now,
      durationSeconds,
      overallPerformance: cmd.overallPerformance,
      notes: cmd.notes || session.notes,
      treatCountRecorded: cmd.treatCountRecorded || 0,
      updatedAt: now,
      concurrencyVersion: session.concurrencyVersion + 1
    };

    TrainingStore.saveSession(updatedSession);

    // Link with Sprint 6 Care Occurrence: Mark occurrence completed if linked
    if (session.scheduledOccurrenceId) {
      const occurrence = CareStore.getOccurrence(session.scheduledOccurrenceId);
      if (occurrence && occurrence.status !== 'COMPLETED') {
        CareStore.saveOccurrence({
          ...occurrence,
          status: 'COMPLETED',
          completedAt: now,
          completedBy: userId,
          completionNotes: `Completed via Training Session ${session.trainingSessionId}`
        });

        CareStore.saveCompletion({
          completionId: asCareCompletionRecordId(generateUUIDv7()),
          occurrenceId: session.scheduledOccurrenceId,
          careObligationId: occurrence.careObligationId,
          petId: session.petId,
          completedAt: now,
          completedBy: userId,
          sourceType: 'TRAINING_SESSION',
          sourceId: session.trainingSessionId,
          notes: `Completed training session. Performance: ${cmd.overallPerformance}`,
          createdAt: now
        });
      }
    }

    // Link with Sprint 7 Nutrition Store: Record treat rewards if provided
    if (cmd.treatCountRecorded && cmd.treatCountRecorded > 0) {
      NutritionStore.saveTreatLog({
        treatLogId: asTreatLogId(generateUUIDv7()),
        householdId,
        petId: session.petId,
        foodId: (cmd.treatFoodId as any) || undefined,
        treatName: 'Training Treat Reward',
        quantity: {
          value: cmd.treatCountRecorded,
          unit: 'piece'
        },
        context: 'TRAINING',
        occurredAt: now,
        givenBy: userId,
        notes: `Reward for Training Session ${session.trainingSessionId}`,
        createdAt: now
      });
    }

    // ==========================================
    // DETERMINISTIC SKILL PROFICIENCY ENGINE
    // ==========================================
    for (const attempt of updatedSession.attempts) {
      this.evaluateAndAdvanceSkillProficiency(
        session.petId,
        householdId,
        attempt.skillId,
        attempt,
        userId,
        session.trainerId
      );
    }

    // ==========================================
    // DETERMINISTIC MILESTONES ENGINE
    // ==========================================
    this.evaluateSessionMilestones(updatedSession, userId, householdId);

    // Emit event
    createTrainingDomainEvent(
      'TrainingSessionCompleted',
      session.trainingSessionId,
      householdId,
      session.petId,
      userId,
      { session: updatedSession }
    );

    return updatedSession;
  }

  static abandonSession(
    sessionId: TrainingSessionId,
    reason: string,
    userId: UserId,
    householdId: HouseholdId
  ): TrainingSession {
    const session = TrainingStore.findSessionById(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    this.assertAuthorized(userId, householdId, 'pet.training.session.complete', session.petId);

    const now = currentClockUtcNow();
    const updatedSession: TrainingSession = {
      ...session,
      status: 'ABANDONED',
      endedAt: now,
      notes: session.notes ? `${session.notes}\n[ABANDONED: ${reason}]` : `[ABANDONED: ${reason}]`,
      updatedAt: now,
      concurrencyVersion: session.concurrencyVersion + 1
    };

    TrainingStore.saveSession(updatedSession);
    createTrainingDomainEvent('TrainingSessionAbandoned', sessionId, householdId, session.petId, userId, {
      session: updatedSession,
      reason
    });
    return updatedSession;
  }

  static getSession(sessionId: TrainingSessionId): TrainingSession | undefined {
    return TrainingStore.findSessionById(sessionId);
  }

  static listSessionsForPet(petId: PetId, userId: UserId, householdId: HouseholdId): TrainingSession[] {
    this.assertAuthorized(userId, householdId, 'pet.training.read', petId);
    return TrainingStore.listSessionsForPet(petId);
  }

  static listSkillProgress(petId: PetId, userId: UserId, householdId: HouseholdId): PetSkillProgress[] {
    this.assertAuthorized(userId, householdId, 'pet.training.read', petId);
    return TrainingStore.listSkillProgressForPet(petId);
  }

  static listMilestonesForPet(petId: PetId, userId: UserId, householdId: HouseholdId): TrainingMilestone[] {
    this.assertAuthorized(userId, householdId, 'pet.training.read', petId);
    return TrainingStore.listMilestonesForPet(petId);
  }

  static listObservationsForPet(petId: PetId, userId: UserId, householdId: HouseholdId): BehaviorObservation[] {
    this.assertAuthorized(userId, householdId, 'pet.training.read', petId);
    return TrainingStore.listObservationsForPet(petId);
  }

  // ==========================================
  // PROFICIENCY CALCULATION & EVALUATION
  // ==========================================

  private static evaluateAndAdvanceSkillProficiency(
    petId: PetId,
    householdId: HouseholdId,
    skillId: SkillId,
    latestAttempt: ExerciseAttempt,
    userId: UserId,
    trainerId?: UserId
  ): void {
    const current = TrainingStore.findSkillProgress(petId, skillId);
    const now = currentClockUtcNow();

    const isSuccess =
      latestAttempt.result === 'SUCCESSFUL' || latestAttempt.result === 'SUCCESSFUL_WITH_ASSISTANCE';
    const successfulIncrement = isSuccess ? latestAttempt.successfulRepetitions : 0;

    let existingProgress: PetSkillProgress;
    if (!current) {
      existingProgress = {
        skillProgressId: asSkillProgressId(generateUUIDv7()),
        petId,
        householdId,
        skillId,
        currentProficiency: 'NOT_STARTED',
        assessmentProvenance: 'SYSTEM_DERIVED',
        lastAssessedAt: now,
        assessedByUserId: userId,
        assessedByTrainerId: trainerId,
        sessionCount: 1,
        successfulRepetitionsTotal: successfulIncrement,
        updatedAt: now
      };
    } else {
      existingProgress = {
        ...current,
        sessionCount: current.sessionCount + 1,
        successfulRepetitionsTotal: current.successfulRepetitionsTotal + successfulIncrement,
        lastAssessedAt: now,
        updatedAt: now
      };
    }

    // Deterministic level progression
    const totalSuccesses = existingProgress.successfulRepetitionsTotal;
    const totalSessions = existingProgress.sessionCount;
    let newLevel: SkillProficiencyLevel = existingProgress.currentProficiency;

    if (newLevel === 'NOT_STARTED' && totalSessions >= 1) {
      newLevel = 'INTRODUCED';
    }
    if (newLevel === 'INTRODUCED' && totalSessions >= 2 && totalSuccesses >= 3) {
      newLevel = 'LEARNING';
    }
    if (
      newLevel === 'LEARNING' &&
      totalSessions >= 4 &&
      totalSuccesses >= 8 &&
      (latestAttempt.assistanceLevel === 'PROMPTED' || latestAttempt.assistanceLevel === 'INDEPENDENT')
    ) {
      newLevel = 'DEVELOPING';
    }
    if (
      newLevel === 'DEVELOPING' &&
      totalSessions >= 6 &&
      totalSuccesses >= 15 &&
      latestAttempt.assistanceLevel === 'INDEPENDENT'
    ) {
      newLevel = 'RELIABLE_IN_CONTROLLED_ENVIRONMENT';
    }
    if (
      newLevel === 'RELIABLE_IN_CONTROLLED_ENVIRONMENT' &&
      totalSessions >= 10 &&
      totalSuccesses >= 25 &&
      latestAttempt.assistanceLevel === 'INDEPENDENT' &&
      latestAttempt.distractionLevel !== 'NONE'
    ) {
      newLevel = 'GENERALIZING';
    }
    if (
      newLevel === 'GENERALIZING' &&
      totalSessions >= 14 &&
      totalSuccesses >= 40 &&
      latestAttempt.assistanceLevel === 'INDEPENDENT' &&
      (latestAttempt.environment === 'BUSY_OUTDOOR' || latestAttempt.environment === 'PUBLIC_SPACE')
    ) {
      newLevel = 'RELIABLE';
    }

    if (newLevel !== existingProgress.currentProficiency) {
      const prev = existingProgress.currentProficiency;
      existingProgress.currentProficiency = newLevel;

      TrainingStore.recordProgressHistory({
        historyId: generateUUIDv7(),
        skillProgressId: existingProgress.skillProgressId,
        petId,
        skillId,
        previousProficiency: prev,
        newProficiency: newLevel,
        provenance: 'SYSTEM_DERIVED',
        assessedByUserId: userId,
        assessedByTrainerId: trainerId,
        reason: `Earned via completed session repetitions (${totalSuccesses} successful reps)`,
        timestamp: now
      });

      // Check if reliable milestone
      if (newLevel === 'RELIABLE') {
        const skill = TrainingStore.findSkillById(skillId);
        const milestoneKey = `${petId}_RELIABLE_${skillId}`;
        const milestone: TrainingMilestone = {
          milestoneId: asTrainingMilestoneId(generateUUIDv7()),
          householdId,
          petId,
          skillId,
          milestoneType: 'RELIABLE_PROFICIENCY_REACHED',
          title: `Reliable Proficiency: ${skill?.name || 'Skill'}`,
          description: `Pet achieved reliable proficiency in ${skill?.name || 'skill'} across varied environments.`,
          achievedAt: now,
          source: 'SESSION_AUTOMATED',
          idempotencyKey: milestoneKey,
          createdAt: now
        };
        if (TrainingStore.saveMilestone(milestone)) {
          TimelineStore.save({
            timelineEventId: asTimelineEventId(generateUUIDv7()),
            petId,
            householdId,
            eventType: 'TRAINING_MILESTONE_ACHIEVED',
            eventCategory: 'TRAINING',
            occurredAt: now,
            recordedAt: now,
            sourceDomain: 'TRAINING',
            sourceEntityType: 'SKILL',
            sourceEntityId: skillId,
            sourceActorType: 'SYSTEM',
            sourceActorId: 'SYSTEM_RULES',
            provenanceType: 'SYSTEM_GENERATED',
            title: `Milestone Achieved: ${milestone.title}`,
            summary: milestone.description,
            visibility: 'HOUSEHOLD',
            status: 'ACTIVE',
            correlationId: asCorrelationId(generateUUIDv7()),
            deduplicationKey: milestoneKey,
            createdAt: now,
            updatedAt: now
          });
        }
      }
    }

    TrainingStore.saveSkillProgress(existingProgress);
  }

  // ==========================================
  // PROFESSIONAL & MANUAL SKILL ASSESSMENT
  // ==========================================

  static assessSkill(
    cmd: {
      petId: PetId;
      householdId: HouseholdId;
      skillId: SkillId;
      proficiency: SkillProficiencyLevel;
      provenance: AssessmentProvenance;
      trainerId?: UserId;
      trainerVerificationStatus?: TrainerVerificationStatus;
      notes?: string;
    },
    userId: UserId
  ): PetSkillProgress {
    this.assertAuthorized(userId, cmd.householdId, 'pet.training.skill.assess', cmd.petId);

    // Provenance validation: Only certified trainer or owner role can claim TRAINER_ASSESSED
    if (cmd.provenance === 'TRAINER_ASSESSED' && cmd.trainerVerificationStatus === 'VERIFIED') {
      const membership = IdentityStore.listMembersForHousehold(cmd.householdId).find(m => m.userId === userId);
      if (!membership || (membership.role !== 'HOUSEHOLD_OWNER' && membership.role !== 'HOUSEHOLD_ADMIN' && userId !== cmd.trainerId)) {
        throw new Error('Unauthorized to record a verified professional trainer skill assessment');
      }
    }

    const current = TrainingStore.findSkillProgress(cmd.petId, cmd.skillId);
    const now = currentClockUtcNow();
    const previousLevel = current?.currentProficiency || 'NOT_STARTED';

    const updated: PetSkillProgress = {
      skillProgressId: current ? current.skillProgressId : asSkillProgressId(generateUUIDv7()),
      petId: cmd.petId,
      householdId: cmd.householdId,
      skillId: cmd.skillId,
      currentProficiency: cmd.proficiency,
      assessmentProvenance: cmd.provenance,
      lastAssessedAt: now,
      assessedByUserId: userId,
      assessedByTrainerId: cmd.trainerId,
      trainerVerificationStatus: cmd.trainerVerificationStatus,
      sessionCount: current ? current.sessionCount : 0,
      successfulRepetitionsTotal: current ? current.successfulRepetitionsTotal : 0,
      notes: cmd.notes,
      updatedAt: now
    };

    TrainingStore.saveSkillProgress(updated);

    TrainingStore.recordProgressHistory({
      historyId: generateUUIDv7(),
      skillProgressId: updated.skillProgressId,
      petId: cmd.petId,
      skillId: cmd.skillId,
      previousProficiency: previousLevel,
      newProficiency: cmd.proficiency,
      provenance: cmd.provenance,
      assessedByUserId: userId,
      assessedByTrainerId: cmd.trainerId,
      reason: cmd.notes || `Assessed by ${cmd.provenance}`,
      timestamp: now
    });

    createTrainingDomainEvent('SkillProgressUpdated', updated.skillProgressId, cmd.householdId, cmd.petId, userId, {
      progress: updated,
      previousLevel
    });

    return updated;
  }

  // ==========================================
  // DETERMINISTIC MILESTONES EVALUATION
  // ==========================================

  private static evaluateSessionMilestones(
    session: TrainingSession,
    userId: UserId,
    householdId: HouseholdId
  ): void {
    const now = currentClockUtcNow();

    for (const attempt of session.attempts) {
      // 1. First Successful Execution of a skill
      if (attempt.result === 'SUCCESSFUL' || attempt.result === 'SUCCESSFUL_WITH_ASSISTANCE') {
        const skill = TrainingStore.findSkillById(attempt.skillId);
        const idempotencyKey = `${session.petId}_FIRST_SUCCESS_${attempt.skillId}`;
        const milestone: TrainingMilestone = {
          milestoneId: asTrainingMilestoneId(generateUUIDv7()),
          householdId,
          petId: session.petId,
          planId: session.planId,
          skillId: attempt.skillId,
          milestoneType: 'FIRST_SUCCESSFUL_EXECUTION',
          title: `First Success: ${skill?.name || 'Skill'}`,
          description: `Successfully performed ${skill?.name || 'skill'} for the first time during session.`,
          achievedAt: now,
          source: 'SESSION_AUTOMATED',
          idempotencyKey,
          createdAt: now
        };

        if (TrainingStore.saveMilestone(milestone)) {
          TimelineStore.save({
            timelineEventId: asTimelineEventId(generateUUIDv7()),
            petId: session.petId,
            householdId,
            eventType: 'TRAINING_MILESTONE_ACHIEVED',
            eventCategory: 'TRAINING',
            occurredAt: now,
            recordedAt: now,
            sourceDomain: 'TRAINING',
            sourceEntityType: 'SKILL',
            sourceEntityId: attempt.skillId,
            sourceActorType: 'USER',
            sourceActorId: userId,
            provenanceType: 'SYSTEM_GENERATED',
            title: `Milestone Achieved: ${milestone.title}`,
            summary: milestone.description,
            visibility: 'HOUSEHOLD',
            status: 'ACTIVE',
            correlationId: asCorrelationId(generateUUIDv7()),
            deduplicationKey: idempotencyKey,
            createdAt: now,
            updatedAt: now
          });
        }
      }

      // 2. Ten Independent Repetitions Streak
      if (attempt.assistanceLevel === 'INDEPENDENT' && attempt.successfulRepetitions >= 10) {
        const skill = TrainingStore.findSkillById(attempt.skillId);
        const idempotencyKey = `${session.petId}_TEN_STREAK_${attempt.skillId}_${session.trainingSessionId}`;
        const milestone: TrainingMilestone = {
          milestoneId: asTrainingMilestoneId(generateUUIDv7()),
          householdId,
          petId: session.petId,
          planId: session.planId,
          skillId: attempt.skillId,
          milestoneType: 'TEN_INDEPENDENT_STREAK',
          title: `10 Independent Streak: ${skill?.name || 'Skill'}`,
          description: `Executed 10 or more independent successful repetitions in a single session.`,
          achievedAt: now,
          source: 'SESSION_AUTOMATED',
          idempotencyKey,
          createdAt: now
        };

        TrainingStore.saveMilestone(milestone);
      }
    }

    // 3. Stage & Program Completion Check
    if (session.stageId) {
      const plan = TrainingStore.findPlanById(session.planId);
      if (plan && plan.programVersionId) {
        const version = TrainingStore.findProgramVersionById(plan.programVersionId);
        if (version) {
          const currentStage = version.stages.find(s => s.stageId === session.stageId);
          if (currentStage && session.overallPerformance === 'SUCCESSFUL') {
            const stageKey = `${session.petId}_STAGE_${currentStage.stageId}`;
            const stageMilestone: TrainingMilestone = {
              milestoneId: asTrainingMilestoneId(generateUUIDv7()),
              householdId,
              petId: session.petId,
              planId: session.planId,
              milestoneType: 'STAGE_COMPLETED',
              title: `Stage Completed: ${currentStage.title}`,
              description: `Mastered criteria for stage "${currentStage.title}".`,
              achievedAt: now,
              source: 'SESSION_AUTOMATED',
              idempotencyKey: stageKey,
              createdAt: now
            };
            TrainingStore.saveMilestone(stageMilestone);

            // Is this the final stage?
            const isLastStage = currentStage.sequence === version.stages.length;
            if (isLastStage) {
              const programKey = `${session.petId}_PROGRAM_${version.programId}`;
              const program = TrainingStore.findProgramById(version.programId);
              const progMilestone: TrainingMilestone = {
                milestoneId: asTrainingMilestoneId(generateUUIDv7()),
                householdId,
                petId: session.petId,
                planId: session.planId,
                milestoneType: 'PROGRAM_COMPLETED',
                title: `Program Graduated: ${program?.title || 'Program'}`,
                description: `Successfully completed all stages of ${program?.title || 'program'}.`,
                achievedAt: now,
                source: 'SESSION_AUTOMATED',
                idempotencyKey: programKey,
                createdAt: now
              };
              if (TrainingStore.saveMilestone(progMilestone)) {
                // Complete the training plan
                TrainingStore.savePlan({
                  ...plan,
                  status: 'COMPLETED',
                  completedAt: now,
                  updatedAt: now,
                  concurrencyVersion: plan.concurrencyVersion + 1
                });
                // Timeline
                TimelineStore.save({
                  timelineEventId: asTimelineEventId(generateUUIDv7()),
                  petId: session.petId,
                  householdId,
                  eventType: 'TRAINING_PROGRAM_GRADUATED',
                  eventCategory: 'TRAINING',
                  occurredAt: now,
                  recordedAt: now,
                  sourceDomain: 'TRAINING',
                  sourceEntityType: 'TRAINING_PLAN',
                  sourceEntityId: plan.trainingPlanId,
                  sourceActorType: 'SYSTEM',
                  sourceActorId: 'SYSTEM_RULES',
                  provenanceType: 'SYSTEM_GENERATED',
                  title: `Program Graduated: ${program?.title}`,
                  summary: progMilestone.description,
                  visibility: 'HOUSEHOLD',
                  status: 'ACTIVE',
                  correlationId: asCorrelationId(generateUUIDv7()),
                  deduplicationKey: programKey,
                  createdAt: now,
                  updatedAt: now
                });
              }
            }
          }
        }
      }
    }
  }

  // ==========================================
  // TRAINING EVIDENCE
  // ==========================================

  static addEvidence(
    cmd: {
      householdId: HouseholdId;
      petId: PetId;
      sessionId?: TrainingSessionId;
      exerciseId?: TrainingExerciseId;
      evidenceType: 'PHOTO' | 'VIDEO' | 'TRAINER_NOTE' | 'SESSION_RESULT' | 'OWNER_CONFIRMATION';
      fileUrl: string;
      mimeType: string;
      sizeBytes: number;
      durationSeconds?: number;
      description?: string;
      verificationStatus?: 'UNVERIFIED' | 'TRAINER_VERIFIED';
      verifiedByTrainerId?: UserId;
    },
    userId: UserId
  ): TrainingEvidence {
    this.assertAuthorized(userId, cmd.householdId, 'pet.training.evidence.manage', cmd.petId);

    const evidenceId = asTrainingEvidenceId(generateUUIDv7());
    const now = currentClockUtcNow();

    const evidence: TrainingEvidence = {
      evidenceId,
      householdId: cmd.householdId,
      petId: cmd.petId,
      sessionId: cmd.sessionId,
      exerciseId: cmd.exerciseId,
      evidenceType: cmd.evidenceType,
      fileUrl: cmd.fileUrl,
      mimeType: cmd.mimeType,
      sizeBytes: cmd.sizeBytes,
      durationSeconds: cmd.durationSeconds,
      description: cmd.description,
      recordedAt: now,
      uploadedByUserId: userId,
      verificationStatus: cmd.verificationStatus || 'UNVERIFIED',
      verifiedByTrainerId: cmd.verifiedByTrainerId,
      createdAt: now
    };

    TrainingStore.saveEvidence(evidence);
    createTrainingDomainEvent('TrainingEvidenceAdded', evidenceId, cmd.householdId, cmd.petId, userId, { evidence });
    return evidence;
  }

  static listEvidenceForPet(petId: PetId, userId: UserId, householdId: HouseholdId): TrainingEvidence[] {
    this.assertAuthorized(userId, householdId, 'pet.training.read', petId);
    return TrainingStore.listEvidenceForPet(petId);
  }

  // ==========================================
  // BEHAVIOR JOURNAL & OBSERVATIONS
  // ==========================================

  static recordBehaviorObservation(
    cmd: {
      householdId: HouseholdId;
      petId: PetId;
      observedAt?: string;
      category: BehaviorCategory;
      behaviorDescription: string;
      context?: string;
      trigger: BehaviorTrigger;
      triggerCustomText?: string;
      durationMinutes?: number;
      frequency: BehaviorFrequency;
      intensity: number; // 1 to 5 observational rating
      locationContext?: string;
      peoplePresent?: string;
      animalsPresent?: string;
      precedingEvent?: string;
      ownerResponse?: string;
      outcome?: string;
      ownerInterpretation?: string;
      provenance: ObservationProvenance;
      trainerId?: UserId;
      trainerVerificationStatus?: TrainerVerificationStatus;
    },
    userId: UserId
  ): BehaviorObservation {
    this.assertAuthorized(userId, cmd.householdId, 'pet.behavior.record', cmd.petId);

    // Provenance validation for trainer records
    if (cmd.provenance === 'TRAINER_RECORDED' && cmd.trainerVerificationStatus === 'VERIFIED') {
      const membership = IdentityStore.listMembersForHousehold(cmd.householdId).find(m => m.userId === userId);
      if (!membership || (membership.role !== 'HOUSEHOLD_OWNER' && membership.role !== 'HOUSEHOLD_ADMIN' && userId !== cmd.trainerId)) {
        throw new Error('Unauthorized to record a verified professional trainer behavior observation');
      }
    }

    const observationId = asBehaviorObservationId(generateUUIDv7());
    const now = currentClockUtcNow();
    const observedAt = cmd.observedAt || now;

    // Intensity bounds checking (1 to 5 observational scale)
    const normalizedIntensity = Math.min(5, Math.max(1, Math.round(cmd.intensity)));

    // ==========================================
    // HIGH-RISK SAFETY ESCALATION ENGINE
    // Strictly non-diagnostic; provides neutral escalation advice
    // ==========================================
    const { highRiskCategory, safetyEscalationMessage } = this.evaluateHighRiskBehavior(
      cmd.behaviorDescription,
      cmd.category,
      cmd.trigger,
      normalizedIntensity
    );

    const observation: BehaviorObservation = {
      observationId,
      householdId: cmd.householdId,
      petId: cmd.petId,
      observedAt,
      recordedAt: now,
      category: cmd.category,
      behaviorDescription: cmd.behaviorDescription,
      context: cmd.context,
      trigger: cmd.trigger,
      triggerCustomText: cmd.triggerCustomText,
      durationMinutes: cmd.durationMinutes,
      frequency: cmd.frequency,
      intensity: normalizedIntensity,
      locationContext: cmd.locationContext,
      peoplePresent: cmd.peoplePresent,
      animalsPresent: cmd.animalsPresent,
      precedingEvent: cmd.precedingEvent,
      ownerResponse: cmd.ownerResponse,
      outcome: cmd.outcome,
      ownerInterpretation: cmd.ownerInterpretation,
      provenance: cmd.provenance,
      recordedByUserId: userId,
      trainerId: cmd.trainerId,
      trainerVerificationStatus: cmd.trainerVerificationStatus || 'NOT_APPLICABLE',
      highRiskCategory,
      safetyEscalationMessage,
      amendments: [],
      createdAt: now,
      updatedAt: now
    };

    TrainingStore.saveBehaviorObservation(observation);

    // Emit event
    if (highRiskCategory !== 'NONE') {
      createTrainingDomainEvent(
        'HighRiskBehaviorObservationFlagged',
        observationId,
        cmd.householdId,
        cmd.petId,
        userId,
        { observation, guidance: safetyEscalationMessage || 'Safety escalation triggered.' }
      );

      // Project high-risk event to Timeline
      TimelineStore.save({
        timelineEventId: asTimelineEventId(generateUUIDv7()),
        petId: cmd.petId,
        householdId: cmd.householdId,
        eventType: 'HIGH_RISK_BEHAVIOR_OBSERVED',
        eventCategory: 'BEHAVIOR',
        occurredAt: observedAt,
        recordedAt: now,
        sourceDomain: 'BEHAVIOR',
        sourceEntityType: 'BEHAVIOR_OBSERVATION',
        sourceEntityId: observationId,
        sourceActorType: 'USER',
        sourceActorId: userId,
        provenanceType: cmd.provenance === 'TRAINER_RECORDED' ? 'VERIFIED_PROFESSIONAL' : 'OWNER_ENTERED',
        title: `Safety Note: High-Risk Behavior Logged (${highRiskCategory.replace('_', ' ')})`,
        summary: safetyEscalationMessage || `Owner logged high-intensity event.`,
        visibility: 'HOUSEHOLD',
        status: 'ACTIVE',
        correlationId: asCorrelationId(generateUUIDv7()),
        deduplicationKey: `OBS_RISK_${observationId}`,
        createdAt: now,
        updatedAt: now
      });
    } else {
      createTrainingDomainEvent(
        'BehaviorObservationRecorded',
        observationId,
        cmd.householdId,
        cmd.petId,
        userId,
        { observation }
      );
    }

    return observation;
  }

  static amendBehaviorObservation(
    cmd: {
      observationId: BehaviorObservationId;
      householdId: HouseholdId;
      newDescription: string;
      reason: string;
    },
    userId: UserId
  ): BehaviorObservation {
    const obs = TrainingStore.findBehaviorObservationById(cmd.observationId);
    if (!obs) throw new Error(`Behavior observation not found: ${cmd.observationId}`);
    this.assertAuthorized(userId, cmd.householdId, 'pet.behavior.update_owner_record', obs.petId);

    const now = currentClockUtcNow();
    const amendment: BehaviorAmendment = {
      amendmentId: asBehaviorAmendmentId(generateUUIDv7()),
      observationId: cmd.observationId,
      amendedAt: now,
      amendedByUserId: userId,
      previousText: obs.behaviorDescription,
      newText: cmd.newDescription,
      reason: cmd.reason
    };

    const updated: BehaviorObservation = {
      ...obs,
      behaviorDescription: cmd.newDescription,
      amendments: [...obs.amendments, amendment],
      updatedAt: now
    };

    TrainingStore.saveBehaviorObservation(updated);
    createTrainingDomainEvent(
      'BehaviorObservationAmended',
      cmd.observationId,
      cmd.householdId,
      obs.petId,
      userId,
      { observation: updated, amendmentId: amendment.amendmentId }
    );

    return updated;
  }

  static listBehaviorObservationsForPet(
    petId: PetId,
    userId: UserId,
    householdId: HouseholdId
  ): BehaviorObservation[] {
    this.assertAuthorized(userId, householdId, 'pet.behavior.read', petId);
    return TrainingStore.listBehaviorObservationsForPet(petId);
  }

  /**
   * Deterministic safety escalation rule engine.
   * STRICT NON-DIAGNOSIS RULE: Refuses to output psychiatric diagnoses (e.g. "generalized aggression").
   * Strictly outputs objective risk category and neutral safety escalation guidance.
   */
  private static evaluateHighRiskBehavior(
    description: string,
    category: BehaviorCategory,
    trigger: BehaviorTrigger,
    intensity: number
  ): { highRiskCategory: HighRiskSafetyCategory; safetyEscalationMessage?: string } {
    const text = description.toLowerCase();

    // Bite check
    if (text.includes('bit ') || text.includes('bite') || text.includes('biting') || text.includes('broke skin')) {
      if (text.includes('attempted') || text.includes('snapped at') || text.includes('air snap') || text.includes('missed')) {
        return {
          highRiskCategory: 'BITE_ATTEMPT',
          safetyEscalationMessage:
            'Safety Notice: An attempted bite indicates high distress or escalation. For the safety of your household and pet, avoid triggering situations and consider consulting a qualified veterinary behaviorist or certified trainer (e.g., IAABC, KPA).'
        };
      }
      return {
        highRiskCategory: 'CONFIRMED_BITE',
        safetyEscalationMessage:
          'Safety Escalation: Contact or broken skin reported. Immediate environmental management is advised. Please seek direct evaluation from a licensed veterinarian to rule out medical pain and consult a credentialed veterinary behaviorist.'
      };
    }

    // Severe fight check
    if (text.includes('fight') || text.includes('attack') || (category === 'REACTIVITY_OBSERVATION' && intensity === 5)) {
      return {
        highRiskCategory: 'SEVERE_FIGHT',
        safetyEscalationMessage:
          'Safety Notice: Severe altercation or high-intensity reactivity observed. Implement secure separation barriers at home and consult a qualified canine behavior specialist.'
      };
    }

    // Self-injury check
    if (text.includes('self-injury') || text.includes('self-harm') || text.includes('mutilat') || text.includes('chewing tail raw') || text.includes('bleeding from scratching')) {
      return {
        highRiskCategory: 'SELF_INJURY',
        safetyEscalationMessage:
          'Clinical Notice: Self-directed injury observed. Prompt veterinary examination is strongly recommended to diagnose and treat underlying dermatological, neurological, or pain-related causes.'
      };
    }

    // Dangerous escape check
    if (text.includes('escaped') && (text.includes('traffic') || text.includes('road') || text.includes('highway') || text.includes('lost'))) {
      return {
        highRiskCategory: 'DANGEROUS_ESCAPE',
        safetyEscalationMessage:
          'Safety Notice: Escape into high-risk traffic environment reported. Verify physical containment, crate latch security, and leash hardware integrity immediately.'
      };
    }

    return { highRiskCategory: 'NONE' };
  }

  // ==========================================
  // READ MODELS & INTEGRATIONS
  // ==========================================

  static getTrainingProgressSummary(
    petId: PetId,
    userId: UserId,
    householdId: HouseholdId
  ): TrainingProgressSummary {
    this.assertAuthorized(userId, householdId, 'pet.training.read', petId);

    const activePlan = TrainingStore.findActivePlanForPet(petId);
    let currentProgramTitle: string | undefined;
    let currentStage: ProgramStage | undefined;

    if (activePlan?.programVersionId) {
      const version = TrainingStore.findProgramVersionById(activePlan.programVersionId);
      if (version) {
        const program = TrainingStore.findProgramById(version.programId);
        currentProgramTitle = program?.title;
        currentStage = version.stages.find(s => s.stageId === activePlan.currentStageId) || version.stages[0];
      }
    }

    const allProgress = TrainingStore.listSkillProgressForPet(petId);
    const skillsCount = {
      notStarted: allProgress.filter(p => p.currentProficiency === 'NOT_STARTED').length,
      learning: allProgress.filter(p => p.currentProficiency === 'INTRODUCED' || p.currentProficiency === 'LEARNING').length,
      developing: allProgress.filter(p => p.currentProficiency === 'DEVELOPING' || p.currentProficiency === 'RELIABLE_IN_CONTROLLED_ENVIRONMENT').length,
      reliable: allProgress.filter(p => p.currentProficiency === 'GENERALIZING' || p.currentProficiency === 'RELIABLE').length
    };

    const recentSessions = TrainingStore.listSessionsForPet(petId).slice(0, 5);
    const milestones = TrainingStore.listMilestonesForPet(petId);
    const behaviorObs = TrainingStore.listBehaviorObservationsForPet(petId);
    const highRiskObservationsCount = behaviorObs.filter(o => o.highRiskCategory !== 'NONE').length;

    return {
      petId,
      activePlan,
      currentProgramTitle,
      currentStage,
      skillsCount,
      recentSessions,
      milestonesCount: milestones.length,
      recentMilestones: milestones.slice(0, 5),
      highRiskObservationsCount
    };
  }

  static getTodayTrainingTasks(
    petId: PetId,
    userId: UserId,
    householdId: HouseholdId
  ): TodayTrainingTask[] {
    this.assertAuthorized(userId, householdId, 'pet.training.read', petId);

    const activePlan = TrainingStore.findActivePlanForPet(petId);
    if (!activePlan || !activePlan.programVersionId) return [];

    const version = TrainingStore.findProgramVersionById(activePlan.programVersionId);
    if (!version) return [];

    const stage = version.stages.find(s => s.stageId === activePlan.currentStageId) || version.stages[0];
    if (!stage) return [];

    const activeSession = TrainingStore.findActiveSessionForPet(petId);

    return stage.exercises.map(exercise => ({
      planId: activePlan.trainingPlanId,
      planTitle: activePlan.title,
      stageTitle: stage.title,
      exercise,
      isCompleted: false,
      activeSessionId: activeSession?.trainingSessionId
    }));
  }

  /**
   * Scoped Pet Passport view.
   * Strictly limits information to basic cues, reward words, and safety alerts.
   * Does NOT leak private behavior journal entries!
   */
  static getPassportTrainingSnippet(
    petId: PetId,
    userId: UserId,
    householdId: HouseholdId
  ): {
    knownCues: Array<{ cueName: string; reliability: string }>;
    handlingNotes: string[];
    safetyAlerts: string[];
  } {
    this.assertAuthorized(userId, householdId, 'pet.passport.read', petId);

    const allProgress = TrainingStore.listSkillProgressForPet(petId);
    const knownCues = allProgress
      .filter(p => p.currentProficiency !== 'NOT_STARTED')
      .map(p => {
        const skill = TrainingStore.findSkillById(p.skillId);
        return {
          cueName: skill?.name || 'Unknown Cue',
          reliability: p.currentProficiency.replace(/_/g, ' ')
        };
      });

    const highRiskObs = TrainingStore.listBehaviorObservationsForPet(petId).filter(
      o => o.highRiskCategory !== 'NONE'
    );
    const safetyAlerts = highRiskObs.slice(0, 3).map(o => `Caution around ${o.trigger}: observed elevated reactivity.`);

    return {
      knownCues,
      handlingNotes: [
        'Responds best to gentle verbal praise and small soft treats.',
        'Allow 3 seconds processing time after giving verbal cue.'
      ],
      safetyAlerts
    };
  }

  /**
   * Scoped Trainer Handoff Dossier.
   * Cross-references Pet Core, Health (mobility restrictions), Training Goals, and Behavior Journal.
   */
  static getTrainerHandoffSummary(
    petId: PetId,
    userId: UserId,
    householdId: HouseholdId
  ): TrainerHandoffSummary {
    this.assertAuthorized(userId, householdId, 'pet.training.read', petId);

    const pet = PetStore.findPetById(petId);
    if (!pet) throw new Error(`Pet not found: ${petId}`);

    const goals = TrainingStore.listGoalsForPet(petId);
    const allProgress = TrainingStore.listSkillProgressForPet(petId);
    const skillsProficiency = allProgress.map(p => {
      const skill = TrainingStore.findSkillById(p.skillId);
      return {
        skillName: skill?.name || 'Skill',
        category: skill?.category || 'OBEDIENCE',
        proficiency: p.currentProficiency,
        provenance: p.assessmentProvenance
      };
    });

    const observations = TrainingStore.listBehaviorObservationsForPet(petId).slice(0, 10).map(o => ({
      observedAt: o.observedAt,
      category: o.category,
      trigger: o.trigger,
      intensity: o.intensity,
      description: o.behaviorDescription,
      highRisk: o.highRiskCategory !== 'NONE'
    }));

    // Cross-domain health integration: check active conditions for mobility or clinical constraints
    const conditions = HealthStore.listConditionsForPet(petId);
    const healthConstraints = conditions
      .filter(c => c.status === 'ACTIVE')
      .map(c => `Clinical Condition: ${c.conditionName} (${c.severity}) - Avoid excessive physical strain.`);

    return {
      petId,
      petName: pet.name,
      species: pet.speciesCode,
      breed: pet.breedCode,
      dateOfBirth: pet.dateOfBirth,
      activeGoals: goals,
      skillsProficiency,
      recentBehaviorObservations: observations,
      healthConstraints
    };
  }
}
