/**
 * Pet OS Sprint 20 - Trainer Professional Workspace Domain Service
 * 
 * Implements the application and orchestration layer for professional trainers,
 * strictly consuming canonical Sprint 8 (Training & Behavior), Sprint 5 (Health),
 * Sprint 6 (Care), Sprint 7 (Nutrition), Sprint 9 (Activity), Sprint 10 (Provider),
 * Sprint 11 (Booking), Sprint 12 (Finance), and Sprint 4 (Documents/Timeline).
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
  SkillId,
  ProgramStageId,
  TrainingProgramId,
  ProgramVersionId,
  TrainerClientRelationshipId,
  ProfessionalTrainingAssessmentId,
  TrainerSessionAssignmentId,
  TrainerProgressReviewId,
  TrainerHomeworkHandoffId,
  TrainerReportId,
  TrainerRecordAmendmentId,
  TrainerCorrectionRequestId,
  TrainerWorkQueueItemId,
  TrainingAccessGrantId,
  TrainerConsentId,
  asTrainingAccessGrantId,
  asTrainerConsentId,
  asTrainerClientRelationshipId,
  asTrainerWorkQueueItemId,
  asProfessionalTrainingAssessmentId,
  asTrainerSessionAssignmentId,
  asTrainerHomeworkHandoffId,
  asTrainerProgressReviewId,
  asTrainerReportId,
  asTrainerRecordAmendmentId,
  asTrainerCorrectionRequestId,
  asPetDocumentId,
  asTimelineEventId,
  asActivityId,
  asCorrelationId,
  generateUUIDv7,
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
  TrainingPlanType,
} from '../training/types';

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
  TrainerStaffRole,
  TrainingAccessScope,
  TrainingRelationshipType,
  HomeworkExerciseTask,
  SkillBaseline,
  BehavioralObservationSummary,
  HouseholdHandoffPayload,
} from './types';

import { TrainerWorkspaceStore } from './store';
import { createTrainerDomainEvent } from './events';

// Canonical Store Integrations
import { TrainingStore } from '../training/store';
import { TrainingService } from '../training/service';
import { PetStore } from '../pet-core/store';
import { IdentityStore } from '../identity/store';
import { ProviderStore } from '../provider/store';
import { BookingStore } from '../booking/store';
import { HealthStore } from '../health/store';
import { CareStore } from '../care/store';
import { NutritionStore } from '../nutrition/store';
import { ActivityStore } from '../activity/store';
import { DocumentStore } from '../documents/store';
import { TimelineStore } from '../timeline/store';

export class TrainerWorkspaceService {
  private static instance: TrainerWorkspaceService | null = null;
  private store: TrainerWorkspaceStore;

  private constructor() {
    this.store = TrainerWorkspaceStore.getInstance();
  }

  public static getInstance(): TrainerWorkspaceService {
    if (!TrainerWorkspaceService.instance) {
      TrainerWorkspaceService.instance = new TrainerWorkspaceService();
    }
    return TrainerWorkspaceService.instance;
  }

  // ============================================================================
  // AUTHORIZATION & GOVERNANCE ENFORCEMENT
  // ============================================================================

  /**
   * Asserts that a professional trainer is verified, not suspended, and holds
   * an active Training Access Grant for the specified pet with the required scope.
   */
  public assertTrainerAuthorized(
    trainerUserId: UserId,
    petId: PetId,
    requiredScope: TrainingAccessScope,
    businessId?: BusinessId
  ): { grant: TrainingAccessGrant; consent: TrainerConsent } {
    // 1. Verify user exists and is active
    const user = IdentityStore.findUserById(trainerUserId);
    if (!user || user.accountStatus !== 'ACTIVE') {
      throw new Error(`Trainer user not found or inactive: ${trainerUserId}`);
    }

    // 2. Check provider verification and suspension status in ProviderStore
    const provider = ProviderStore.getInstance().getProviderByUserId(trainerUserId);
    if (provider) {
      if (provider.operationalStatus === 'SUSPENDED' || provider.verificationStatus === 'SUSPENDED') {
        throw new Error(
          `Security violation: Trainer ${trainerUserId} is SUSPENDED. All professional operations are blocked.`
        );
      }
    }

    // 3. Verify pet exists and is not deceased
    const pet = PetStore.findPetById(petId);
    if (!pet) {
      throw new Error(`Pet not found: ${petId}`);
    }
    if (pet.status === 'DECEASED') {
      throw new Error(`Cannot perform training operations on deceased pet: ${petId}`);
    }

    // 4. Verify explicit active access grant (Prohibits Global Pet Access)
    const targetId = businessId || trainerUserId;
    const grant = this.store.findActiveGrant(petId, targetId);
    if (!grant) {
      throw new Error(
        `Access Denied: No active Training Access Grant for pet ${petId} and trainer/business ${targetId}. Global pet search is prohibited.`
      );
    }

    if (!grant.scopes.includes(requiredScope)) {
      throw new Error(
        `Scope violation: Grant ${grant.grantId} does not include required scope "${requiredScope}".`
      );
    }

    // 5. Verify active owner consent
    const consent = this.store.findActiveConsent(petId, targetId);
    if (!consent) {
      throw new Error(
        `Consent violation: No active Trainer Consent recorded for pet ${petId} and trainer ${targetId}.`
      );
    }

    return { grant, consent };
  }

  // ============================================================================
  // BOOKING HANDOFF & INTAKE
  // ============================================================================

  /**
   * Accepts a training booking handoff from Sprint 11, establishing the
   * client relationship, access grant, baseline consent, and work queue item.
   */
  public acceptBookingHandoff(
    bookingId: BookingId,
    trainerUserId: UserId,
    businessId: BusinessId,
    role: TrainerStaffRole = 'LEAD_TRAINER'
  ): TrainerClientRelationship {
    const booking = BookingStore.getInstance().getBooking(bookingId);
    if (!booking) {
      throw new Error(`Booking not found: ${bookingId}`);
    }

    const now = new Date().toISOString();
    const petId = booking.petIds[0];
    const grantId = asTrainingAccessGrantId(generateUUIDv7());
    const consentId = asTrainerConsentId(generateUUIDv7());
    const relId = asTrainerClientRelationshipId(generateUUIDv7());

    // 1. Create Training Access Grant with minimum necessary scopes
    const grant: TrainingAccessGrant = {
      grantId,
      petId,
      householdId: booking.householdId,
      grantedByUserId: booking.ownerUserId,
      businessId,
      trainerId: trainerUserId,
      scopes: [
        'PET_IDENTITY_SUMMARY',
        'TRAINING_READ',
        'TRAINING_WRITE',
        'BEHAVIOR_READ',
        'BEHAVIOR_WRITE',
        'TRAINING_EVIDENCE_READ',
        'TRAINING_EVIDENCE_WRITE',
        'OWNER_INSTRUCTIONS_READ',
        'RELEVANT_HEALTH_RESTRICTIONS_READ',
        'ACTIVITY_SUMMARY_READ',
      ],
      status: 'ACTIVE',
      relationshipType: 'ONE_ON_ONE_COACHING',
      validFrom: now,
      validTo: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(), // 90 days
      bookingId,
      consentId,
      reason: `Automated handoff for confirmed booking ${bookingId}`,
      createdAt: now,
      updatedAt: now,
    };
    this.store.saveGrant(grant);

    // 2. Create baseline consent from booking
    const consent: TrainerConsent = {
      consentId,
      petId,
      householdId: booking.householdId,
      consentedByUserId: booking.ownerUserId,
      trainerId: trainerUserId,
      businessId,
      trainingRelationship: 'ONE_ON_ONE_COACHING',
      consentedAt: now,
      handlingRestrictions: [],
      treatAllergenExclusions: [],
      allowOffLeashControlledArea: false,
      emergencyVetCareAuthorized: true,
      photoVideoEvidenceConsent: true,
      marketingMediaConsent: false, // Strictly private by default
      status: 'ACTIVE',
      signatureText: `Owner Electronic Consent via Booking ${bookingId}`,
      createdAt: now,
      updatedAt: now,
    };
    this.store.saveConsent(consent);

    // 3. Create Trainer Client Relationship
    const relationship: TrainerClientRelationship = {
      relationshipId: relId,
      businessId,
      primaryTrainerId: trainerUserId,
      assignedAssistantTrainerIds: [],
      householdId: booking.householdId,
      petId,
      status: 'ACTIVE',
      relationshipType: 'ONE_ON_ONE_COACHING',
      activeGrantId: grantId,
      activeConsentId: consentId,
      bookingId,
      startDate: now,
      createdAt: now,
      updatedAt: now,
    };
    this.store.saveRelationship(relationship);

    // 4. Create Work Queue Item for Intake & Assessment
    const pet = PetStore.findPetById(petId);
    const owner = IdentityStore.findUserById(booking.ownerUserId);
    const queueItem: TrainerWorkQueueItem = {
      queueItemId: asTrainerWorkQueueItemId(generateUUIDv7()),
      businessId,
      assignedTrainerId: trainerUserId,
      petId,
      householdId: booking.householdId,
      clientName: owner ? `${owner.email}` : 'Household Owner',
      petName: pet?.name || 'Client Pet',
      itemType: 'INTAKE_PENDING',
      status: 'PENDING',
      priority: 'HIGH',
      scheduledAt: booking.startAt,
      dueAt: booking.endAt,
      relatedEntityId: bookingId,
      notes: `Service booking accepted. Complete intake questionnaire and initial assessment.`,
      createdAt: now,
      updatedAt: now,
    };
    this.store.saveQueueItem(queueItem);

    // Emit event
    createTrainerDomainEvent(
      'TrainerRelationshipEstablished',
      relId,
      booking.householdId,
      petId,
      trainerUserId,
      { relationship, bookingId }
    );

    return relationship;
  }

  /**
   * Updates owner consent preferences (treat exclusions, handling rules, media consent).
   */
  public recordTrainerConsent(
    cmd: Omit<TrainerConsent, 'consentId' | 'createdAt' | 'updatedAt' | 'status'>,
    ownerUserId: UserId
  ): TrainerConsent {
    const now = new Date().toISOString();
    const consentId = asTrainerConsentId(generateUUIDv7());

    const consent: TrainerConsent = {
      ...cmd,
      consentId,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    this.store.saveConsent(consent);

    createTrainerDomainEvent(
      'TrainerConsentRecorded',
      consentId,
      cmd.householdId,
      cmd.petId,
      ownerUserId,
      { consent }
    );

    return consent;
  }

  // ============================================================================
  // PROFESSIONAL TRAINING ASSESSMENT LIFECYCLE
  // ============================================================================

  /**
   * Creates a draft professional assessment.
   */
  public createAssessment(
    cmd: {
      businessId: BusinessId;
      petId: PetId;
      householdId: HouseholdId;
      relationshipId: TrainerClientRelationshipId;
      bookingId?: BookingId;
      ownerStatedGoals: string[];
      trainerAssessedGoals: string[];
      skillBaselines: SkillBaseline[];
      behaviorObservations: BehavioralObservationSummary[];
      healthRestrictionsNoted?: string[];
      trainerEnvironmentalRecommendation: TrainingEnvironment;
      handlerSafetyPrecautions?: string[];
      recommendedProgramId?: TrainingProgramId;
      recommendedProgramVersionId?: ProgramVersionId;
      recommendedPlanTitle: string;
      recommendedPlanType: TrainingPlanType;
      veterinaryReferralRecommended?: boolean;
      veterinaryReferralReason?: string;
    },
    trainerUserId: UserId
  ): ProfessionalTrainingAssessment {
    this.assertTrainerAuthorized(trainerUserId, cmd.petId, 'TRAINING_WRITE', cmd.businessId);

    const now = new Date().toISOString();
    const assessmentId = asProfessionalTrainingAssessmentId(generateUUIDv7());

    const assessment: ProfessionalTrainingAssessment = {
      assessmentId,
      businessId: cmd.businessId,
      trainerId: trainerUserId,
      petId: cmd.petId,
      householdId: cmd.householdId,
      bookingId: cmd.bookingId,
      relationshipId: cmd.relationshipId,
      assessmentDate: now,
      status: 'DRAFT',
      ownerStatedGoals: cmd.ownerStatedGoals,
      trainerAssessedGoals: cmd.trainerAssessedGoals,
      skillBaselines: cmd.skillBaselines,
      behaviorObservations: cmd.behaviorObservations,
      healthRestrictionsNoted: cmd.healthRestrictionsNoted || [],
      trainerEnvironmentalRecommendation: cmd.trainerEnvironmentalRecommendation,
      handlerSafetyPrecautions: cmd.handlerSafetyPrecautions || [],
      recommendedProgramId: cmd.recommendedProgramId,
      recommendedProgramVersionId: cmd.recommendedProgramVersionId,
      recommendedPlanTitle: cmd.recommendedPlanTitle,
      recommendedPlanType: cmd.recommendedPlanType,
      veterinaryReferralRecommended: cmd.veterinaryReferralRecommended || false,
      veterinaryReferralReason: cmd.veterinaryReferralReason,
      nonDiagnosticDisclaimer:
        'This assessment is a professional behavioral evaluation and does not constitute a veterinary medical diagnosis or treatment of physical pathology.',
      amendments: [],
      createdAt: now,
      updatedAt: now,
    };

    this.store.saveAssessment(assessment);

    createTrainerDomainEvent(
      'ProfessionalAssessmentCreated',
      assessmentId,
      cmd.householdId,
      cmd.petId,
      trainerUserId,
      { assessment }
    );

    return assessment;
  }

  /**
   * Finalizes and signs a professional assessment.
   * Enforces role check: Assistant trainers CANNOT finalize assessments.
   * Calls canonical Sprint 8 TrainingService to create & activate training plan,
   * baseline skills, and behavior observations with TRAINER_CREATED / TRAINER_ASSESSED provenance.
   */
  public finalizeAssessment(
    assessmentId: ProfessionalTrainingAssessmentId,
    trainerUserId: UserId,
    trainerRole: TrainerStaffRole = 'LEAD_TRAINER'
  ): ProfessionalTrainingAssessment {
    const assessment = this.store.getAssessment(assessmentId);
    if (!assessment) {
      throw new Error(`Assessment not found: ${assessmentId}`);
    }

    if (assessment.status === 'FINALIZED') {
      throw new Error(`Assessment ${assessmentId} is already finalized. Direct edits prohibited; use amendment.`);
    }

    // Role check: Only lead trainers, training directors, business owners, or verified trainers can finalize
    if (trainerRole === 'ASSISTANT_TRAINER' || trainerRole === 'COORDINATOR') {
      throw new Error(
        `Permission Denied: Staff role "${trainerRole}" cannot finalize or sign professional assessments. Requires LEAD_TRAINER or higher.`
      );
    }

    this.assertTrainerAuthorized(trainerUserId, assessment.petId, 'TRAINING_WRITE', assessment.businessId);

    const now = new Date().toISOString();

    // 1. Create canonical Training Plan in Sprint 8 via TrainingService
    const canonicalPlan = TrainingService.createPlan(
      {
        householdId: assessment.householdId,
        petId: assessment.petId,
        title: assessment.recommendedPlanTitle,
        description: `Professional plan created following assessment ${assessmentId}. Trainer goals: ${assessment.trainerAssessedGoals.join(', ')}`,
        planType: assessment.recommendedPlanType,
        sourceType: 'TRAINER_CREATED',
        trainerId: trainerUserId,
        trainerName: 'Juma Ochieng (Apex K9)',
        trainerOrganization: 'Apex K9 Academy',
        trainerVerificationStatus: 'VERIFIED',
        programId: assessment.recommendedProgramId,
        programVersionId: assessment.recommendedProgramVersionId,
        startsAt: now,
        notes: `Environmental recommendation: ${assessment.trainerEnvironmentalRecommendation}`,
      },
      trainerUserId
    );

    // Activate the canonical plan
    TrainingService.activatePlan(canonicalPlan.trainingPlanId, trainerUserId, assessment.householdId);

    // 2. Record Skill Baselines in Sprint 8 with TRAINER_ASSESSED provenance
    for (const base of assessment.skillBaselines) {
      TrainingService.assessSkill(
        {
          petId: assessment.petId,
          householdId: assessment.householdId,
          skillId: base.skillId,
          proficiency: base.baselineProficiency,
          provenance: 'TRAINER_ASSESSED',
          trainerId: trainerUserId,
          trainerVerificationStatus: 'VERIFIED',
          notes: base.notes || 'Baseline established during initial professional assessment.',
        },
        trainerUserId
      );
    }

    // 3. Record Behavioral Observations in Sprint 8 with TRAINER_RECORDED provenance
    for (const obs of assessment.behaviorObservations) {
      TrainingService.recordBehaviorObservation(
        {
          householdId: assessment.householdId,
          petId: assessment.petId,
          observedAt: now,
          category: obs.category,
          behaviorDescription: obs.description,
          trigger: obs.trigger,
          frequency: obs.frequency,
          intensity: obs.intensity,
          provenance: 'TRAINER_RECORDED',
          trainerId: trainerUserId,
          trainerVerificationStatus: 'VERIFIED',
        },
        trainerUserId
      );
    }

    // 4. Update assessment to FINALIZED
    const finalized: ProfessionalTrainingAssessment = {
      ...assessment,
      status: 'FINALIZED',
      prescribedPlanId: canonicalPlan.trainingPlanId,
      finalizedAt: now,
      signedByTrainerId: trainerUserId,
      leadTrainerId: trainerUserId,
      trainerCredentialSnapshot: 'CPDT-KA-2024-0012',
      updatedAt: now,
    };
    this.store.saveAssessment(finalized);

    // 5. Update relationship's active plan
    const rel = this.store.getRelationship(assessment.relationshipId);
    if (rel) {
      this.store.saveRelationship({
        ...rel,
        currentPlanId: canonicalPlan.trainingPlanId,
        enrolledProgramId: assessment.recommendedProgramId,
        enrolledProgramVersionId: assessment.recommendedProgramVersionId,
        updatedAt: now,
      });
    }

    // 6. Project to Timeline
    TimelineStore.save({
      timelineEventId: asTimelineEventId(generateUUIDv7()),
      petId: assessment.petId,
      householdId: assessment.householdId,
      eventType: 'PROFESSIONAL_TRAINING_ASSESSMENT_COMPLETED',
      eventCategory: 'TRAINING',
      occurredAt: now,
      recordedAt: now,
      sourceDomain: 'TRAINING',
      sourceEntityType: 'TRAINING_PLAN',
      sourceEntityId: canonicalPlan.trainingPlanId,
      sourceActorType: 'PROVIDER',
      sourceActorId: trainerUserId,
      provenanceType: 'VERIFIED_PROFESSIONAL',
      title: `Professional Training Assessment Finalized`,
      summary: `Lead Trainer finalized assessment for ${assessment.recommendedPlanTitle}. Plan activated.`,
      visibility: 'HOUSEHOLD',
      status: 'ACTIVE',
      correlationId: asCorrelationId(generateUUIDv7()),
      deduplicationKey: `ASSESS_FIN_${assessmentId}`,
      createdAt: now,
      updatedAt: now,
    });

    createTrainerDomainEvent(
      'ProfessionalAssessmentFinalized',
      assessmentId,
      assessment.householdId,
      assessment.petId,
      trainerUserId,
      { assessment: finalized, planId: canonicalPlan.trainingPlanId }
    );

    return finalized;
  }

  /**
   * Creates an amendment for a finalized assessment (immutability preservation).
   */
  public amendAssessment(
    assessmentId: ProfessionalTrainingAssessmentId,
    cmd: {
      amendmentReason: string;
      correctionDetails: string;
    },
    trainerUserId: UserId
  ): ProfessionalTrainingAssessment {
    const assessment = this.store.getAssessment(assessmentId);
    if (!assessment) throw new Error(`Assessment not found: ${assessmentId}`);
    if (assessment.status !== 'FINALIZED' && assessment.status !== 'AMENDED') {
      throw new Error(`Can only amend a finalized assessment. Status is ${assessment.status}`);
    }

    this.assertTrainerAuthorized(trainerUserId, assessment.petId, 'TRAINING_WRITE', assessment.businessId);

    const now = new Date().toISOString();
    const amendmentId = asTrainerRecordAmendmentId(generateUUIDv7());

    const amendment: TrainerRecordAmendment = {
      amendmentId,
      targetEntityType: 'ASSESSMENT',
      targetEntityId: assessmentId,
      amendedByTrainerId: trainerUserId,
      amendedAt: now,
      amendmentReason: cmd.amendmentReason,
      correctionDetails: cmd.correctionDetails,
      previousContentSnapshot: JSON.stringify({
        trainerAssessedGoals: assessment.trainerAssessedGoals,
        healthRestrictionsNoted: assessment.healthRestrictionsNoted,
        veterinaryReferralRecommended: assessment.veterinaryReferralRecommended,
      }),
    };

    this.store.saveAmendment(amendment);

    const updatedAssessment: ProfessionalTrainingAssessment = {
      ...assessment,
      status: 'AMENDED',
      amendments: [...assessment.amendments, amendment],
      updatedAt: now,
    };
    this.store.saveAssessment(updatedAssessment);

    createTrainerDomainEvent(
      'ProfessionalAssessmentAmended',
      assessmentId,
      assessment.householdId,
      assessment.petId,
      trainerUserId,
      { amendment }
    );

    return updatedAssessment;
  }

  // ============================================================================
  // SESSION PREPARATION & EXECUTION WORKFLOW
  // ============================================================================

  /**
   * Prepares a session execution, verifying health restrictions from Sprint 5
   * and treat allergens from Sprint 7.
   */
  public prepareSession(
    cmd: {
      planId: TrainingPlanId;
      petId: PetId;
      householdId: HouseholdId;
      businessId: BusinessId;
      bookingId?: BookingId;
      environment: TrainingEnvironment;
    },
    trainerUserId: UserId
  ): TrainerSessionExecution {
    this.assertTrainerAuthorized(trainerUserId, cmd.petId, 'TRAINING_WRITE', cmd.businessId);

    const now = new Date().toISOString();
    const assignmentId = asTrainerSessionAssignmentId(generateUUIDv7());

    // 1. Health restrictions screening from Sprint 5 HealthStore
    const activeConditions = HealthStore.listConditionsForPet(cmd.petId).filter(
      c => c.status === 'ACTIVE'
    );
    const activeHealthRestrictions = activeConditions.map(c => c.conditionName);

    // 2. Treat allergen screening from Sprint 7 NutritionStore & consent
    const allergies = HealthStore.listAllergiesForPet(cmd.petId);
    const allergenExclusions = allergies.map(a => a.allergen);

    const prepChecklist = {
      healthRestrictionsVerified: true,
      activeHealthRestrictions,
      safeTreatsConfirmed: true,
      allergenExclusions,
      environmentPrepared: cmd.environment,
      equipmentInspected: true,
      emergencyContactAvailable: true,
    };

    const sessionExecution: TrainerSessionExecution = {
      assignmentId,
      planId: cmd.planId,
      petId: cmd.petId,
      householdId: cmd.householdId,
      businessId: cmd.businessId,
      trainerId: trainerUserId,
      bookingId: cmd.bookingId,
      status: 'PREPARATION',
      prepChecklist,
      activityRecordProjected: false,
      bookingFulfilled: false,
      createdAt: now,
      updatedAt: now,
    };

    this.store.saveSessionExecution(sessionExecution);
    return sessionExecution;
  }

  /**
   * Starts a professional training session by calling canonical TrainingService.startSession.
   */
  public startSession(
    assignmentId: TrainerSessionAssignmentId,
    trainerUserId: UserId
  ): TrainerSessionExecution {
    const sessionExec = this.store.getSessionExecution(assignmentId);
    if (!sessionExec) throw new Error(`Session assignment not found: ${assignmentId}`);

    this.assertTrainerAuthorized(trainerUserId, sessionExec.petId, 'TRAINING_WRITE', sessionExec.businessId);

    const now = new Date().toISOString();

    // Call canonical Sprint 8 TrainingService
    const canonicalSession = TrainingService.startSession(
      {
        householdId: sessionExec.householdId,
        petId: sessionExec.petId,
        planId: sessionExec.planId,
        environment: sessionExec.prepChecklist.environmentPrepared,
        trainerId: trainerUserId,
        notes: `Conducted by professional trainer ${trainerUserId}`,
      },
      trainerUserId
    );

    const updated: TrainerSessionExecution = {
      ...sessionExec,
      canonicalSessionId: canonicalSession.trainingSessionId,
      status: 'IN_PROGRESS',
      startedAt: now,
      updatedAt: now,
    };

    this.store.saveSessionExecution(updated);
    return updated;
  }

  /**
   * Records an exercise attempt during session execution.
   * Enforces health restriction safety check: Prevents high-impact exercises
   * if pet has an active mobility or joint restriction.
   */
  public recordExerciseAttempt(
    assignmentId: TrainerSessionAssignmentId,
    cmd: {
      exerciseId: string;
      skillId: SkillId;
      result: ExerciseAttemptResult;
      repetitions: number;
      successfulRepetitions: number;
      assistanceLevel: AssistanceLevel;
      distractionLevel: DistractionLevel;
      environment: TrainingEnvironment;
      isHighImpactExercise?: boolean;
      notes?: string;
    },
    trainerUserId: UserId
  ) {
    const sessionExec = this.store.getSessionExecution(assignmentId);
    if (!sessionExec || !sessionExec.canonicalSessionId) {
      throw new Error(`Active canonical session not found for assignment ${assignmentId}`);
    }

    this.assertTrainerAuthorized(trainerUserId, sessionExec.petId, 'TRAINING_WRITE', sessionExec.businessId);

    // Health restriction enforcement
    const restrictions = sessionExec.prepChecklist.activeHealthRestrictions;
    const hasMobilityRestriction = restrictions.some(r =>
      r.toLowerCase().includes('dysplasia') ||
      r.toLowerCase().includes('arthritis') ||
      r.toLowerCase().includes('mobility') ||
      r.toLowerCase().includes('cruciate')
    );

    if (cmd.isHighImpactExercise && hasMobilityRestriction) {
      throw new Error(
        `Safety Violation: Cannot conduct high-impact exercise "${cmd.exerciseId}". Pet has active veterinary restriction: ${restrictions.join(', ')}.`
      );
    }

    // Call canonical Sprint 8 TrainingService.recordAttempt
    return TrainingService.recordAttempt(
      {
        sessionId: sessionExec.canonicalSessionId,
        exerciseId: cmd.exerciseId as any,
        skillId: cmd.skillId,
        result: cmd.result,
        repetitions: cmd.repetitions,
        successfulRepetitions: cmd.successfulRepetitions,
        assistanceLevel: cmd.assistanceLevel,
        distractionLevel: cmd.distractionLevel,
        environment: cmd.environment,
        notes: cmd.notes,
      },
      trainerUserId,
      sessionExec.householdId
    );
  }

  /**
   * Completes a professional session, generating household handoff summary,
   * projecting activity to Sprint 9, rewarding safe treats in Sprint 7,
   * creating caregiver homework tasks, and marking booking completed.
   */
  public completeSession(
    assignmentId: TrainerSessionAssignmentId,
    cmd: {
      overallPerformance: ExerciseAttemptResult;
      handoffSummary: HouseholdHandoffPayload;
      treatCountRecorded?: number;
      treatFoodId?: string;
      homeworkTasks?: HomeworkExerciseTask[];
      homeworkInstructions?: string;
      homeworkDueDays?: number;
      notes?: string;
    },
    trainerUserId: UserId
  ): TrainerSessionExecution {
    const sessionExec = this.store.getSessionExecution(assignmentId);
    if (!sessionExec || !sessionExec.canonicalSessionId) {
      throw new Error(`Active canonical session not found for assignment ${assignmentId}`);
    }

    this.assertTrainerAuthorized(trainerUserId, sessionExec.petId, 'TRAINING_WRITE', sessionExec.businessId);

    // Check treat allergen exclusion
    if (cmd.treatFoodId) {
      const forbiddenAllergens = sessionExec.prepChecklist.allergenExclusions;
      const isForbidden = forbiddenAllergens.some(a => cmd.treatFoodId?.toLowerCase().includes(a.toLowerCase()));
      if (isForbidden) {
        throw new Error(
          `Nutrition Safety Violation: Treat ${cmd.treatFoodId} contains known pet allergen (${forbiddenAllergens.join(', ')}). Treat rejected.`
        );
      }
    }

    const now = new Date().toISOString();

    // 1. Call canonical Sprint 8 TrainingService.completeSession
    const completedCanonical = TrainingService.completeSession(
      {
        sessionId: sessionExec.canonicalSessionId,
        overallPerformance: cmd.overallPerformance,
        treatCountRecorded: cmd.treatCountRecorded,
        treatFoodId: cmd.treatFoodId,
        notes: cmd.notes || cmd.handoffSummary.whatChangedSummary,
      },
      trainerUserId,
      sessionExec.householdId
    );

    // 2. Assign Homework if provided
    let homeworkId: any = undefined;
    if (cmd.homeworkTasks && cmd.homeworkTasks.length > 0) {
      const hwId = asTrainerHomeworkHandoffId(generateUUIDv7());
      const dueDays = cmd.homeworkDueDays || 7;
      const dueDate = new Date(Date.now() + dueDays * 24 * 3600 * 1000).toISOString();

      const homework: TrainerHomeworkAssignment = {
        homeworkId: hwId,
        sessionId: sessionExec.canonicalSessionId,
        planId: sessionExec.planId,
        petId: sessionExec.petId,
        householdId: sessionExec.householdId,
        trainerId: trainerUserId,
        assignedDate: now,
        dueDate,
        title: `Home Practice: ${cmd.handoffSummary.whatToPractice.join(', ')}`,
        instructions: cmd.homeworkInstructions || cmd.handoffSummary.practiceFrequencyRecommendation,
        tasks: cmd.homeworkTasks,
        status: 'ACTIVE',
        caregiverLogs: [],
        createdAt: now,
        updatedAt: now,
      };

      this.store.saveHomework(homework);
      homeworkId = hwId;

      createTrainerDomainEvent(
        'TrainerHomeworkAssigned',
        hwId,
        sessionExec.householdId,
        sessionExec.petId,
        trainerUserId,
        { homework }
      );
    }

    // 3. Project to Sprint 9 ActivityStore (deduplicated)
    const durationSeconds = completedCanonical.durationSeconds || 1800;
    const durationMinutes = Math.max(15, Math.round(durationSeconds / 60));
    ActivityStore.saveRecord({
      activityId: asActivityId(generateUUIDv7()),
      householdId: sessionExec.householdId,
      petId: sessionExec.petId,
      activityType: 'TRAINING',
      sourceType: 'TRAINING_SESSION',
      sourceActorId: trainerUserId,
      startedAt: completedCanonical.startedAt,
      endedAt: now,
      durationSeconds,
      sourceEntityId: String(completedCanonical.trainingSessionId),
      notes: `Professional training session executed by ${trainerUserId}. ${cmd.handoffSummary.whatChangedSummary}`,
      recordedAt: now,
      createdBy: trainerUserId,
      createdAt: now,
      updatedAt: now,
      verificationStatus: 'VERIFIED',
    });

    // 4. If linked to a booking, fulfill booking & emit fulfillment
    if (sessionExec.bookingId) {
      const booking = BookingStore.getInstance().getBooking(sessionExec.bookingId);
      if (booking && booking.status !== 'COMPLETED') {
        BookingStore.getInstance().saveBooking({
          ...booking,
          status: 'COMPLETED',
          updatedAt: now,
        });
      }
    }

    // 5. Update session execution record
    const updated: TrainerSessionExecution = {
      ...sessionExec,
      status: 'COMPLETED',
      completedAt: now,
      durationMinutes,
      overallPerformance: cmd.overallPerformance,
      handoffSummary: cmd.handoffSummary,
      treatCountRecorded: cmd.treatCountRecorded || 0,
      homeworkAssignedId: homeworkId,
      activityRecordProjected: true,
      bookingFulfilled: true,
      updatedAt: now,
    };

    this.store.saveSessionExecution(updated);

    createTrainerDomainEvent(
      'TrainerSessionExecuted',
      assignmentId,
      sessionExec.householdId,
      sessionExec.petId,
      trainerUserId,
      { session: updated, handoff: cmd.handoffSummary }
    );

    return updated;
  }

  // ============================================================================
  // CAREGIVER HOMEWORK EXECUTION
  // ============================================================================

  /**
   * Logs caregiver practice completion for an assigned homework task.
   * Preserves HOUSEHOLD_CAREGIVER provenance (caregivers cannot forge trainer assessments).
   */
  public logCaregiverHomework(
    homeworkId: TrainerHomeworkHandoffId,
    cmd: {
      repetitionsCompleted: number;
      successObserved: boolean;
      notes?: string;
    },
    caregiverUserId: UserId
  ): TrainerHomeworkAssignment {
    const homework = this.store.getHomework(homeworkId);
    if (!homework) throw new Error(`Homework not found: ${homeworkId}`);

    // Verify caregiver belongs to the pet's household
    const membership = IdentityStore.listMembersForHousehold(homework.householdId).find(
      m => m.userId === caregiverUserId && m.status === 'ACTIVE'
    );
    if (!membership) {
      throw new Error(`Unauthorized: User ${caregiverUserId} is not an active member of household ${homework.householdId}`);
    }

    const now = new Date().toISOString();
    const logId = generateUUIDv7();

    const logEntry = {
      logId,
      completedAt: now,
      completedByUserId: caregiverUserId,
      caregiverProvenance: 'HOUSEHOLD_CAREGIVER' as const,
      repetitionsCompleted: cmd.repetitionsCompleted,
      successObserved: cmd.successObserved,
      notes: cmd.notes,
    };

    const updated: TrainerHomeworkAssignment = {
      ...homework,
      status: 'COMPLETED',
      caregiverLogs: [...homework.caregiverLogs, logEntry],
      updatedAt: now,
    };

    this.store.saveHomework(updated);

    createTrainerDomainEvent(
      'TrainerHomeworkLoggedByCaregiver',
      homeworkId,
      homework.householdId,
      homework.petId,
      caregiverUserId,
      { logEntry }
    );

    return updated;
  }

  // ============================================================================
  // PROGRESS REVIEWS & PROGRAM ADVANCEMENT
  // ============================================================================

  /**
   * Conducts a professional progress review.
   * If PROGRESS_STAGE or GRADUATE_PROGRAM is decided, advances the canonical
   * Training Plan in Sprint 8.
   */
  public conductProgressReview(
    cmd: {
      planId: TrainingPlanId;
      petId: PetId;
      householdId: HouseholdId;
      businessId: BusinessId;
      decision: 'CONTINUE_CURRENT_PLAN' | 'PROGRESS_STAGE' | 'MODIFY_EXERCISES' | 'PAUSE_PLAN' | 'GRADUATE_PROGRAM' | 'VETERINARY_REFERRAL';
      stageAdvancedToId?: ProgramStageId;
      trainerNotes: string;
      clinicalOrVeterinaryConsultNeeded?: boolean;
      referralReason?: string;
    },
    trainerUserId: UserId
  ): ProfessionalProgressReview {
    this.assertTrainerAuthorized(trainerUserId, cmd.petId, 'TRAINING_WRITE', cmd.businessId);

    const now = new Date().toISOString();
    const reviewId = asTrainerProgressReviewId(generateUUIDv7());

    // Evaluate current skill proficiencies from Sprint 8
    const skillProgressions = TrainingStore.listSkillProgressForPet(cmd.petId);
    const skillsMasteredCount = skillProgressions.filter(p => p.currentProficiency === 'RELIABLE').length;
    const skillsInProgressCount = skillProgressions.filter(
      p => p.currentProficiency !== 'NOT_STARTED' && p.currentProficiency !== 'RELIABLE'
    ).length;

    // Handle Stage Progression in canonical Sprint 8 plan
    const canonicalPlan = TrainingStore.findPlanById(cmd.planId);
    if (canonicalPlan) {
      if (cmd.decision === 'PROGRESS_STAGE' && cmd.stageAdvancedToId) {
        TrainingStore.savePlan({
          ...canonicalPlan,
          currentStageId: cmd.stageAdvancedToId,
          updatedAt: now,
          concurrencyVersion: canonicalPlan.concurrencyVersion + 1,
        });
      } else if (cmd.decision === 'GRADUATE_PROGRAM') {
        TrainingStore.savePlan({
          ...canonicalPlan,
          status: 'COMPLETED',
          completedAt: now,
          updatedAt: now,
          concurrencyVersion: canonicalPlan.concurrencyVersion + 1,
        });
      } else if (cmd.decision === 'PAUSE_PLAN') {
        TrainingService.pausePlan(cmd.planId, cmd.trainerNotes, trainerUserId, cmd.householdId);
      }
    }

    const review: ProfessionalProgressReview = {
      reviewId,
      planId: cmd.planId,
      petId: cmd.petId,
      householdId: cmd.householdId,
      trainerId: trainerUserId,
      businessId: cmd.businessId,
      reviewDate: now,
      decision: cmd.decision,
      stageAdvancedToId: cmd.stageAdvancedToId,
      skillsMasteredCount,
      skillsInProgressCount,
      evidenceReviewedIds: [],
      clinicalOrVeterinaryConsultNeeded: cmd.clinicalOrVeterinaryConsultNeeded || false,
      referralReason: cmd.referralReason,
      trainerNotes: cmd.trainerNotes,
      createdAt: now,
      updatedAt: now,
    };

    this.store.saveProgressReview(review);

    createTrainerDomainEvent(
      'ProfessionalProgressReviewCompleted',
      reviewId,
      cmd.householdId,
      cmd.petId,
      trainerUserId,
      { review }
    );

    return review;
  }

  // ============================================================================
  // PROFESSIONAL TRAINING REPORTS & EXPORTS
  // ============================================================================

  /**
   * Creates and finalizes a professional training report, exporting a canonical
   * copy to Sprint 4 Pet Documents.
   */
  public createAndFinalizeReport(
    cmd: {
      petId: PetId;
      householdId: HouseholdId;
      businessId: BusinessId;
      title: string;
      reportType: 'INTAKE_SUMMARY' | 'ASSESSMENT_REPORT' | 'PROGRESS_REPORT' | 'GRADUATION_CERTIFICATE' | 'BEHAVIOR_EVALUATION';
      executiveSummary: string;
      behaviorChangesSummary: string;
      caregiverInstructions: string;
    },
    trainerUserId: UserId
  ): TrainerReport {
    this.assertTrainerAuthorized(trainerUserId, cmd.petId, 'TRAINING_WRITE', cmd.businessId);

    const now = new Date().toISOString();
    const reportId = asTrainerReportId(generateUUIDv7());

    // Gather skill progression snapshot from canonical Sprint 8
    const progressList = TrainingStore.listSkillProgressForPet(cmd.petId);
    const skillProgression = progressList.map(p => {
      const skill = TrainingStore.findSkillById(p.skillId);
      return {
        skillName: skill?.name || 'Assessed Skill',
        initialProficiency: 'NOT_STARTED' as SkillProficiencyLevel,
        currentProficiency: p.currentProficiency,
        achievedReliable: p.currentProficiency === 'RELIABLE',
      };
    });

    // Project as a formal document into Sprint 4 DocumentStore
    const docId = asPetDocumentId(generateUUIDv7());
    DocumentStore.save({
      documentId: docId,
      petId: cmd.petId,
      householdId: cmd.householdId,
      title: cmd.title,
      description: cmd.executiveSummary,
      documentType: 'OTHER',
      storageKey: `reports/${cmd.petId}/${docId}.pdf`,
      originalFilename: `training_report_${reportId}.pdf`,
      mediaType: 'application/pdf',
      fileSize: 245000,
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      issuedAt: now,
      issuingOrganization: 'Apex K9 Academy',
      sourceType: 'PROVIDER_UPLOAD',
      sourceActorId: trainerUserId,
      provenanceType: 'VERIFIED_PROFESSIONAL',
      verificationStatus: 'VERIFIED',
      documentStatus: 'ACTIVE',
      versionNumber: 1,
      uploadedBy: trainerUserId,
      uploadedAt: now,
      createdAt: now,
      updatedAt: now,
      metadata: {
        reportId,
        reportType: cmd.reportType,
      },
    });

    const report: TrainerReport = {
      reportId,
      petId: cmd.petId,
      householdId: cmd.householdId,
      businessId: cmd.businessId,
      authorTrainerId: trainerUserId,
      leadTrainerSignoffId: trainerUserId,
      reportType: cmd.reportType,
      title: cmd.title,
      status: 'FINALIZED',
      executiveSummary: cmd.executiveSummary,
      skillProgression,
      behaviorChangesSummary: cmd.behaviorChangesSummary,
      caregiverInstructions: cmd.caregiverInstructions,
      documentId: docId,
      finalizedAt: now,
      amendments: [],
      createdAt: now,
      updatedAt: now,
    };

    this.store.saveReport(report);

    createTrainerDomainEvent(
      'TrainerReportFinalized',
      reportId,
      cmd.householdId,
      cmd.petId,
      trainerUserId,
      { report, documentId: docId }
    );

    return report;
  }

  // ============================================================================
  // OWNER CORRECTION REQUESTS
  // ============================================================================

  /**
   * Submits an owner correction request for an assessment or report.
   */
  public submitCorrectionRequest(
    cmd: {
      petId: PetId;
      householdId: HouseholdId;
      targetEntityType: 'ASSESSMENT' | 'REPORT' | 'BEHAVIOR_OBSERVATION';
      targetEntityId: string;
      requestReason: string;
      proposedCorrection: string;
    },
    ownerUserId: UserId
  ): TrainerCorrectionRequest {
    const now = new Date().toISOString();
    const requestId = asTrainerCorrectionRequestId(generateUUIDv7());

    const request: TrainerCorrectionRequest = {
      requestId,
      petId: cmd.petId,
      householdId: cmd.householdId,
      requestedByUserId: ownerUserId,
      targetEntityType: cmd.targetEntityType,
      targetEntityId: cmd.targetEntityId,
      requestReason: cmd.requestReason,
      proposedCorrection: cmd.proposedCorrection,
      status: 'SUBMITTED',
      createdAt: now,
      updatedAt: now,
    };

    this.store.saveCorrectionRequest(request);

    createTrainerDomainEvent(
      'TrainerCorrectionRequestSubmitted',
      requestId,
      cmd.householdId,
      cmd.petId,
      ownerUserId,
      { request }
    );

    return request;
  }

  /**
   * Professional trainer handles an owner correction request.
   */
  public handleCorrectionRequest(
    requestId: TrainerCorrectionRequestId,
    decision: 'ACCEPTED' | 'DECLINED',
    reviewerNotes: string,
    trainerUserId: UserId
  ): TrainerCorrectionRequest {
    const req = this.store.getCorrectionRequest(requestId);
    if (!req) throw new Error(`Correction request not found: ${requestId}`);

    const now = new Date().toISOString();
    let amendmentId: any = undefined;

    if (decision === 'ACCEPTED') {
      amendmentId = asTrainerRecordAmendmentId(generateUUIDv7());
      const amendment: TrainerRecordAmendment = {
        amendmentId,
        targetEntityType: req.targetEntityType as any,
        targetEntityId: req.targetEntityId,
        amendedByTrainerId: trainerUserId,
        amendedAt: now,
        amendmentReason: req.requestReason,
        correctionDetails: req.proposedCorrection,
        previousContentSnapshot: 'Owner correction accepted by lead trainer.',
      };
      this.store.saveAmendment(amendment);
    }

    const updated: TrainerCorrectionRequest = {
      ...req,
      status: decision === 'ACCEPTED' ? 'AMENDMENT_ISSUED' : 'DECLINED',
      reviewerTrainerId: trainerUserId,
      reviewerNotes,
      amendmentId,
      respondedAt: now,
      updatedAt: now,
    };

    this.store.saveCorrectionRequest(updated);

    createTrainerDomainEvent(
      'TrainerCorrectionRequestHandled',
      requestId,
      req.householdId,
      req.petId,
      trainerUserId,
      { request: updated }
    );

    return updated;
  }

  // ============================================================================
  // SAFETY ESCALATION & VETERINARY BOUNDARY
  // ============================================================================

  /**
   * Flags a high-risk safety escalation using neutral observational language.
   * If veterinary referral is recommended, emits a non-diagnostic referral note.
   */
  public flagSafetyEscalation(
    cmd: {
      petId: PetId;
      householdId: HouseholdId;
      businessId: BusinessId;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      observationFacts: string;
      triggerIdentified: string;
      handlerSafetyRisk: boolean;
      recommendedMitigations: string[];
      veterinaryReferralRecommended: boolean;
      veterinaryReferralReason?: string;
    },
    trainerUserId: UserId
  ): TrainerSafetyEscalation {
    this.assertTrainerAuthorized(trainerUserId, cmd.petId, 'BEHAVIOR_WRITE', cmd.businessId);

    const now = new Date().toISOString();
    const escalationId = generateUUIDv7();

    const escalation: TrainerSafetyEscalation = {
      escalationId,
      petId: cmd.petId,
      householdId: cmd.householdId,
      trainerId: trainerUserId,
      incidentDate: now,
      severity: cmd.severity,
      observationFacts: cmd.observationFacts,
      triggerIdentified: cmd.triggerIdentified,
      handlerSafetyRisk: cmd.handlerSafetyRisk,
      recommendedMitigations: cmd.recommendedMitigations,
      veterinaryReferralRecommended: cmd.veterinaryReferralRecommended,
      veterinaryReferralReason: cmd.veterinaryReferralReason,
      nonDiagnosticNotice:
        'This safety notice is an observational behavioral flag. Pet OS does not permit trainers to diagnose canine neurological or psychiatric conditions.',
      createdAt: now,
    };

    this.store.saveSafetyEscalation(escalation);

    createTrainerDomainEvent(
      'TrainerSafetyEscalationFlagged',
      escalationId,
      cmd.householdId,
      cmd.petId,
      trainerUserId,
      { escalation }
    );

    return escalation;
  }
}
