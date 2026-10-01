/**
 * Pet OS Sprint 8 - Training, Skills & Behavior Automated Test Suite
 * Comprehensive testing covering prerequisite graphs, program versioning,
 * plan aggregates, session execution, proficiency engines, milestones,
 * behavior observation safety boundaries, cross-household isolation,
 * and integration with Care, Nutrition, Timeline, and Passport.
 */

import {
  UserId,
  HouseholdId,
  PetId,
  asUserId,
  asHouseholdId,
  asPetId,
  asSkillId,
  asTrainingProgramId,
  asProgramVersionId,
  asProgramStageId,
  asTrainingExerciseId,
  asTrainingPlanId,
  asCareOccurrenceId,
  generateUUIDv7
} from '../kernel/ids';
import { currentClockUtcNow } from '../kernel/time';
import { PetStore } from '../pet-core/store';
import { IdentityStore } from '../identity/store';
import { CareStore } from '../care/store';
import { NutritionStore } from '../nutrition/store';
import { HealthStore } from '../health/store';
import { TimelineStore } from '../timeline/store';
import { TrainingStore } from './store';
import { TrainingService } from './service';
import { seedTrainingData } from './seed';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

export class Sprint8TrainingTestSuite {
  static async runAllTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    const tests = [
      this.testSkillPrerequisiteCycleDetection,
      this.testProgramVersioningAndImmutability,
      this.testTrainingPlanLifecycleAndSupersession,
      this.testProfessionalPlanProvenanceProtection,
      this.testSessionExecutionConcurrencyGuard,
      this.testExerciseAttemptRecordingAndAssistance,
      this.testDeterministicSkillProficiencyProgression,
      this.testAssessmentProvenancePreservation,
      this.testMilestoneIdempotency,
      this.testBehaviorObservationFactsVsInterpretation,
      this.testHighRiskBehaviorSafetyEscalationWithoutDiagnosis,
      this.testCareOccurrenceCompletionIntegration,
      this.testNutritionTreatRewardIntegration,
      this.testTimelineProjectionIntegration,
      this.testPassportScopedTrainingSnippet,
      this.testTrainerHandoffDossier,
      this.testCrossHouseholdIsolationIDOR,
      this.testTemporaryCaregiverLeastPrivilege,
      this.testDeceasedPetSafetyGuard
    ];

    for (const test of tests) {
      const start = Date.now();
      try {
        await test();
        results.push({
          suite: 'Sprint 8 Training & Behavior',
          name: test.name.replace(/^test/, ''),
          passed: true,
          durationMs: Date.now() - start
        });
      } catch (err: any) {
        results.push({
          suite: 'Sprint 8 Training & Behavior',
          name: test.name.replace(/^test/, ''),
          passed: false,
          durationMs: Date.now() - start,
          error: err?.message || String(err)
        });
      }
    }

    return results;
  }

  private static setupBaselineContext(): {
    householdId: HouseholdId;
    otherHouseholdId: HouseholdId;
    petId: PetId;
    ownerUserId: UserId;
    trainerUserId: UserId;
    caregiverUserId: UserId;
    strangerUserId: UserId;
  } {
    // Reset and seed base data
    seedTrainingData();

    const householdId = asHouseholdId('household-001');
    const otherHouseholdId = asHouseholdId('household-002');
    const petId = asPetId('pet-001');

    const ownerUserId = asUserId('user-owner-001');
    const trainerUserId = asUserId('user-trainer-001');
    const caregiverUserId = asUserId('user-caregiver-001');
    const strangerUserId = asUserId('user-stranger-002');

    // Ensure users and memberships in IdentityStore
    if (!IdentityStore.findUserById(ownerUserId)) {
      IdentityStore.saveUser({
        userId: ownerUserId,
        email: 'owner@example.com',
        normalizedEmail: 'owner@example.com',
        phoneNumber: '+15550000001',
        passwordHash: 'hash',
        accountStatus: 'ACTIVE',
        failedLoginAttempts: 0,
        policyAcceptedAt: '2026-08-01T00:00:00Z',
        policyVersion: '1.0',
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      });
    }

    if (!IdentityStore.findUserById(trainerUserId)) {
      IdentityStore.saveUser({
        userId: trainerUserId,
        email: 'trainer@example.com',
        normalizedEmail: 'trainer@example.com',
        phoneNumber: '+15550000002',
        passwordHash: 'hash',
        accountStatus: 'ACTIVE',
        failedLoginAttempts: 0,
        policyAcceptedAt: '2026-08-01T00:00:00Z',
        policyVersion: '1.0',
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      });
    }

    if (!IdentityStore.findUserById(caregiverUserId)) {
      IdentityStore.saveUser({
        userId: caregiverUserId,
        email: 'caregiver@example.com',
        normalizedEmail: 'caregiver@example.com',
        phoneNumber: '+15550000003',
        passwordHash: 'hash',
        accountStatus: 'ACTIVE',
        failedLoginAttempts: 0,
        policyAcceptedAt: '2026-08-01T00:00:00Z',
        policyVersion: '1.0',
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      });
    }

    if (!IdentityStore.findUserById(strangerUserId)) {
      IdentityStore.saveUser({
        userId: strangerUserId,
        email: 'stranger@example.com',
        normalizedEmail: 'stranger@example.com',
        phoneNumber: '+15550000099',
        passwordHash: 'hash',
        accountStatus: 'ACTIVE',
        failedLoginAttempts: 0,
        policyAcceptedAt: '2026-08-01T00:00:00Z',
        policyVersion: '1.0',
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      });
    }

    // Ensure memberships exist
    const ensureMembership = (userId: UserId, hid: HouseholdId, role: any, expiresAt?: string) => {
      const existing = IdentityStore.listMembersForHousehold(hid).find(m => m.userId === userId);
      if (!existing) {
        IdentityStore.saveMembership({
          membershipId: generateUUIDv7() as any,
          householdId: hid,
          userId,
          role,
          status: 'ACTIVE',
          joinedAt: '2026-08-01T00:00:00Z',
          expiresAt,
          updatedAt: '2026-08-01T00:00:00Z'
        });
      }
    };

    ensureMembership(ownerUserId, householdId, 'HOUSEHOLD_OWNER');
    ensureMembership(trainerUserId, householdId, 'HOUSEHOLD_ADMIN');
    ensureMembership(caregiverUserId, householdId, 'TEMPORARY_CAREGIVER', '2026-12-31T23:59:59Z');
    ensureMembership(strangerUserId, otherHouseholdId, 'HOUSEHOLD_OWNER');

    // Ensure pet exists in PetStore
    if (!PetStore.findPetById(petId)) {
      PetStore.savePet({
        petId,
        householdId,
        name: 'Simba',
        speciesCode: 'CANIS_LUPUS_FAMILIARIS',
        breedCode: 'GOLDEN_RETRIEVER',
        mixedBreed: false,
        unknownBreed: false,
        sex: 'MALE',
        reproductiveStatus: 'STERILIZED',
        dateOfBirth: '2024-05-15',
        birthdatePrecision: 'EXACT',
        estimatedBirthdate: false,
        primaryColor: 'Golden',
        sizeClassification: 'LARGE',
        lifecycleStage: 'ADULT',
        status: 'ACTIVE',
        createdBy: ownerUserId,
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
        version: 1,
        metadata: {}
      });
    }

    return {
      householdId,
      otherHouseholdId,
      petId,
      ownerUserId,
      trainerUserId,
      caregiverUserId,
      strangerUserId
    };
  }

  // ==========================================
  // TEST SUITES
  // ==========================================

  static async testSkillPrerequisiteCycleDetection(): Promise<void> {
    const ctx = Sprint8TrainingTestSuite.setupBaselineContext();

    const skillA = TrainingService.createSkill(
      {
        skillCode: 'TEST_SKILL_A',
        name: 'Skill Alpha',
        description: 'Test Alpha',
        category: 'FOUNDATION',
        speciesScope: 'ALL',
        lifecycleStageScope: 'ALL_STAGES',
        prerequisiteSkillIds: [],
        difficultyLevel: 'BEGINNER',
        active: true
      },
      ctx.ownerUserId,
      ctx.householdId
    );

    const skillB = TrainingService.createSkill(
      {
        skillCode: 'TEST_SKILL_B',
        name: 'Skill Beta',
        description: 'Test Beta depends on Alpha',
        category: 'FOUNDATION',
        speciesScope: 'ALL',
        lifecycleStageScope: 'ALL_STAGES',
        prerequisiteSkillIds: [skillA.skillId],
        difficultyLevel: 'INTERMEDIATE',
        active: true
      },
      ctx.ownerUserId,
      ctx.householdId
    );

    // Now try to update Skill A to depend on Skill B, which creates a cycle: A -> B -> A
    let cycleCaught = false;
    try {
      TrainingStore.saveSkill({
        ...skillA,
        prerequisiteSkillIds: [skillB.skillId]
      });
    } catch (err: any) {
      if (err.message.includes('Prerequisite cycle detected')) {
        cycleCaught = true;
      }
    }

    if (!cycleCaught) {
      throw new Error('Cycle detection failed: circular prerequisite graph was erroneously allowed.');
    }
  }

  static async testProgramVersioningAndImmutability(): Promise<void> {
    const ctx = Sprint8TrainingTestSuite.setupBaselineContext();

    const program = TrainingService.createProgram(
      {
        code: 'IMMUTABLE_PROG',
        title: 'Immutability Verification Program',
        description: 'Verifies published version immutability',
        speciesScope: 'CANIS_LUPUS_FAMILIARIS',
        lifecycleStageScope: 'ALL_STAGES',
        category: 'OBEDIENCE',
        status: 'DRAFT'
      },
      ctx.ownerUserId,
      ctx.householdId
    );

    const version1 = TrainingService.publishProgramVersion(
      {
        programId: program.programId,
        versionNumber: 1,
        title: 'Version 1.0',
        summary: 'Initial release',
        status: 'PUBLISHED',
        stages: []
      },
      ctx.ownerUserId,
      ctx.householdId
    );

    // Attempting to mutate published version stages must be rejected
    let rejected = false;
    try {
      TrainingStore.saveProgramVersion({
        ...version1,
        stages: [
          {
            stageId: asProgramStageId('tampered-stage'),
            programVersionId: version1.programVersionId,
            sequence: 1,
            title: 'Tampered Stage',
            description: 'Illegally modified stage',
            entryCriteria: 'None',
            completionCriteria: 'None',
            exercises: []
          }
        ]
      });
    } catch (err: any) {
      if (err.message.includes('Cannot mutate published program version')) {
        rejected = true;
      }
    }

    if (!rejected) {
      throw new Error('Immutability violation: published program version was altered without version bump.');
    }
  }

  static async testTrainingPlanLifecycleAndSupersession(): Promise<void> {
    const ctx = Sprint8TrainingTestSuite.setupBaselineContext();

    // Create DRAFT plan 1
    const plan1 = TrainingService.createPlan(
      {
        householdId: ctx.householdId,
        petId: ctx.petId,
        title: 'Original Obedience Plan',
        description: 'First plan',
        planType: 'CUSTOM_HOUSEHOLD',
        sourceType: 'OWNER_CREATED'
      },
      ctx.ownerUserId
    );

    if (plan1.status !== 'DRAFT') {
      throw new Error(`Plan expected DRAFT, got ${plan1.status}`);
    }

    // Activate Plan 1
    const active1 = TrainingService.activatePlan(plan1.trainingPlanId, ctx.ownerUserId, ctx.householdId);
    if (active1.status !== 'ACTIVE') {
      throw new Error(`Plan expected ACTIVE, got ${active1.status}`);
    }

    // Create Plan 2 and activate it. Plan 1 must be automatically SUPERSEDED
    const plan2 = TrainingService.createPlan(
      {
        householdId: ctx.householdId,
        petId: ctx.petId,
        title: 'Advanced Obedience Plan',
        description: 'Second plan superseding first',
        planType: 'CUSTOM_HOUSEHOLD',
        sourceType: 'OWNER_CREATED'
      },
      ctx.ownerUserId
    );

    const active2 = TrainingService.activatePlan(plan2.trainingPlanId, ctx.ownerUserId, ctx.householdId);
    if (active2.status !== 'ACTIVE') {
      throw new Error(`Plan 2 expected ACTIVE, got ${active2.status}`);
    }

    const reloadedPlan1 = TrainingService.getPlan(plan1.trainingPlanId);
    if (reloadedPlan1?.status !== 'SUPERSEDED') {
      throw new Error(`Plan 1 expected SUPERSEDED, got ${reloadedPlan1?.status}`);
    }
    if (reloadedPlan1?.supersededBy !== plan2.trainingPlanId) {
      throw new Error(`Plan 1 supersededBy pointer expected ${plan2.trainingPlanId}, got ${reloadedPlan1?.supersededBy}`);
    }
  }

  static async testProfessionalPlanProvenanceProtection(): Promise<void> {
    const ctx = Sprint8TrainingTestSuite.setupBaselineContext();

    // Certified Trainer creates verified plan
    const trainerPlan = TrainingService.createPlan(
      {
        householdId: ctx.householdId,
        petId: ctx.petId,
        title: 'Clinical Separation Anxiety Protocol',
        description: 'Trainer-prescribed behavioral modification plan',
        planType: 'BEHAVIORAL_MODIFICATION',
        sourceType: 'TRAINER_CREATED',
        trainerId: ctx.trainerUserId,
        trainerName: 'Dr. Emily Vance, DVM, DACVB',
        trainerVerificationStatus: 'VERIFIED'
      },
      ctx.trainerUserId
    );

    TrainingService.activatePlan(trainerPlan.trainingPlanId, ctx.ownerUserId, ctx.householdId);

    // Temporary Caregiver attempts to cancel trainer plan -> Must be REJECTED
    let cancelBlocked = false;
    try {
      TrainingService.cancelPlan(
        trainerPlan.trainingPlanId,
        'Caregiver decided to cancel',
        ctx.caregiverUserId,
        ctx.householdId
      );
    } catch (err: any) {
      cancelBlocked = true;
    }

    if (!cancelBlocked) {
      throw new Error('Provenance protection failure: Caregiver cancelled trainer-prescribed plan.');
    }
  }

  static async testSessionExecutionConcurrencyGuard(): Promise<void> {
    const ctx = Sprint8TrainingTestSuite.setupBaselineContext();
    const activePlan = TrainingService.getActivePlanForPet(ctx.petId, ctx.ownerUserId, ctx.householdId);
    if (!activePlan) throw new Error('Active plan missing');

    // Start Session 1
    const sess1 = TrainingService.startSession(
      {
        householdId: ctx.householdId,
        petId: ctx.petId,
        planId: activePlan.trainingPlanId,
        environment: 'HOME'
      },
      ctx.ownerUserId
    );

    // Attempt to start a second session concurrently for same pet -> Must fail
    let duplicateBlocked = false;
    try {
      TrainingService.startSession(
        {
          householdId: ctx.householdId,
          petId: ctx.petId,
          planId: activePlan.trainingPlanId,
          environment: 'YARD'
        },
        ctx.trainerUserId
      );
    } catch (err: any) {
      if (err.message.includes('already has an active training session in progress')) {
        duplicateBlocked = true;
      }
    }

    // Clean up
    TrainingService.abandonSession(sess1.trainingSessionId, 'Test teardown', ctx.ownerUserId, ctx.householdId);

    if (!duplicateBlocked) {
      throw new Error('Concurrency guard failed: concurrent training sessions allowed for same pet.');
    }
  }

  static async testExerciseAttemptRecordingAndAssistance(): Promise<void> {
    const ctx = Sprint8TrainingTestSuite.setupBaselineContext();
    const activePlan = TrainingService.getActivePlanForPet(ctx.petId, ctx.ownerUserId, ctx.householdId);
    if (!activePlan) throw new Error('Active plan missing');

    const session = TrainingService.startSession(
      {
        householdId: ctx.householdId,
        petId: ctx.petId,
        planId: activePlan.trainingPlanId,
        environment: 'HOME'
      },
      ctx.ownerUserId
    );

    const sitSkill = TrainingStore.findSkillByCode('FOUND_SIT')!;
    const attempt = TrainingService.recordAttempt(
      {
        sessionId: session.trainingSessionId,
        exerciseId: asTrainingExerciseId('ex-test-001'),
        skillId: sitSkill.skillId,
        result: 'SUCCESSFUL',
        repetitions: 10,
        successfulRepetitions: 9,
        assistanceLevel: 'INDEPENDENT',
        distractionLevel: 'LOW',
        environment: 'HOME',
        notes: 'Great eye contact'
      },
      ctx.ownerUserId,
      ctx.householdId
    );

    if (attempt.successfulRepetitions !== 9 || attempt.assistanceLevel !== 'INDEPENDENT') {
      throw new Error('Attempt failed to record assistance or success metrics accurately.');
    }

    TrainingService.abandonSession(session.trainingSessionId, 'Test complete', ctx.ownerUserId, ctx.householdId);
  }

  static async testDeterministicSkillProficiencyProgression(): Promise<void> {
    const ctx = Sprint8TrainingTestSuite.setupBaselineContext();
    const activePlan = TrainingService.getActivePlanForPet(ctx.petId, ctx.ownerUserId, ctx.householdId);
    if (!activePlan) throw new Error('Active plan missing');

    const recallSkill = TrainingStore.findSkillByCode('REC_RECALL')!;

    // Initial state: recall is not started
    const initialProgress = TrainingStore.findSkillProgress(ctx.petId, recallSkill.skillId);
    if (initialProgress && initialProgress.currentProficiency === 'RELIABLE') {
      throw new Error('Recall skill cannot start as RELIABLE');
    }

    // Session 1: Run 1 attempt with 5 repetitions
    const session = TrainingService.startSession(
      {
        householdId: ctx.householdId,
        petId: ctx.petId,
        planId: activePlan.trainingPlanId,
        environment: 'QUIET_OUTDOOR'
      },
      ctx.ownerUserId
    );

    TrainingService.recordAttempt(
      {
        sessionId: session.trainingSessionId,
        exerciseId: asTrainingExerciseId('ex-rec-01'),
        skillId: recallSkill.skillId,
        result: 'SUCCESSFUL',
        repetitions: 5,
        successfulRepetitions: 5,
        assistanceLevel: 'FULL_GUIDANCE',
        distractionLevel: 'NONE',
        environment: 'QUIET_OUTDOOR'
      },
      ctx.ownerUserId,
      ctx.householdId
    );

    TrainingService.completeSession(
      {
        sessionId: session.trainingSessionId,
        overallPerformance: 'SUCCESSFUL'
      },
      ctx.ownerUserId,
      ctx.householdId
    );

    const progressAfter1 = TrainingStore.findSkillProgress(ctx.petId, recallSkill.skillId);
    if (progressAfter1?.currentProficiency === 'RELIABLE') {
      throw new Error('Anti-slop violation: single session jumped skill directly to RELIABLE.');
    }
    if (progressAfter1?.currentProficiency !== 'INTRODUCED') {
      throw new Error(`Expected INTRODUCED after 1 session, got ${progressAfter1?.currentProficiency}`);
    }
  }

  static async testAssessmentProvenancePreservation(): Promise<void> {
    const ctx = Sprint8TrainingTestSuite.setupBaselineContext();
    const sitSkill = TrainingStore.findSkillByCode('FOUND_SIT')!;

    // Professional assessment by certified trainer
    TrainingService.assessSkill(
      {
        petId: ctx.petId,
        householdId: ctx.householdId,
        skillId: sitSkill.skillId,
        proficiency: 'RELIABLE_IN_CONTROLLED_ENVIRONMENT',
        provenance: 'TRAINER_ASSESSED',
        trainerId: ctx.trainerUserId,
        trainerVerificationStatus: 'VERIFIED',
        notes: 'Passed Level 1 testing at facility'
      },
      ctx.trainerUserId
    );

    const afterTrainer = TrainingStore.findSkillProgress(ctx.petId, sitSkill.skillId);
    if (afterTrainer?.assessmentProvenance !== 'TRAINER_ASSESSED') {
      throw new Error('Provenance failed to record TRAINER_ASSESSED');
    }

    // Owner later updates skill assessment with notes
    TrainingService.assessSkill(
      {
        petId: ctx.petId,
        householdId: ctx.householdId,
        skillId: sitSkill.skillId,
        proficiency: 'GENERALIZING',
        provenance: 'OWNER_ASSESSED',
        notes: 'Tried at the park yesterday'
      },
      ctx.ownerUserId
    );

    const history = TrainingStore.listProgressHistoryForSkill(ctx.petId, sitSkill.skillId);
    if (history.length < 2) {
      throw new Error('Audit trail missing: progress history was not preserved across assessments.');
    }

    const trainerEntry = history.find(h => h.provenance === 'TRAINER_ASSESSED');
    const ownerEntry = history.find(h => h.provenance === 'OWNER_ASSESSED');
    if (!trainerEntry || !ownerEntry) {
      throw new Error('Audit trail lost distinct provenance entries for trainer and owner.');
    }
  }

  static async testMilestoneIdempotency(): Promise<void> {
    const ctx = Sprint8TrainingTestSuite.setupBaselineContext();
    const sitSkill = TrainingStore.findSkillByCode('FOUND_SIT')!;

    const idempotencyKey = `${ctx.petId}_TEST_MILESTONE_${sitSkill.skillId}`;
    const milestone1 = {
      milestoneId: generateUUIDv7() as any,
      householdId: ctx.householdId,
      petId: ctx.petId,
      skillId: sitSkill.skillId,
      milestoneType: 'FIRST_SUCCESSFUL_EXECUTION' as const,
      title: 'First Sit',
      description: 'First test sit',
      achievedAt: currentClockUtcNow(),
      source: 'SESSION_AUTOMATED' as const,
      idempotencyKey,
      createdAt: currentClockUtcNow()
    };

    const firstSave = TrainingStore.saveMilestone(milestone1);
    if (!firstSave) throw new Error('Initial milestone save failed');

    // Attempt duplicate save with same idempotencyKey
    const secondSave = TrainingStore.saveMilestone({
      ...milestone1,
      milestoneId: generateUUIDv7() as any
    });

    if (secondSave) {
      throw new Error('Milestone idempotency violated: duplicate milestone was saved with same idempotencyKey.');
    }
  }

  static async testBehaviorObservationFactsVsInterpretation(): Promise<void> {
    const ctx = Sprint8TrainingTestSuite.setupBaselineContext();

    const obs = TrainingService.recordBehaviorObservation(
      {
        householdId: ctx.householdId,
        petId: ctx.petId,
        category: 'CHEWING',
        behaviorDescription: 'Chewed corner of wooden coffee table leg for 4 minutes while owner was in kitchen.',
        context: 'Quiet evening, television off.',
        trigger: 'LEFT_ALONE',
        durationMinutes: 4,
        frequency: 'OCCASIONAL',
        intensity: 2,
        locationContext: 'Living Room',
        ownerResponse: 'Redirected to rubber Kong chew toy stuffed with kibble.',
        outcome: 'Accepted Kong and chewed peacefully for 20 minutes.',
        ownerInterpretation: 'Believes Simba is teething or bored',
        provenance: 'OWNER_OBSERVED'
      },
      ctx.ownerUserId
    );

    if (!obs.behaviorDescription.includes('Chewed corner')) {
      throw new Error('Factual behavior description was corrupted or lost.');
    }
    if (!obs.ownerInterpretation?.includes('teething or bored')) {
      throw new Error('Owner interpretation was not preserved distinctly from factual description.');
    }
    if (obs.highRiskCategory !== 'NONE') {
      throw new Error('Chewing table should not be flagged as high risk.');
    }
  }

  static async testHighRiskBehaviorSafetyEscalationWithoutDiagnosis(): Promise<void> {
    const ctx = Sprint8TrainingTestSuite.setupBaselineContext();

    const obs = TrainingService.recordBehaviorObservation(
      {
        householdId: ctx.householdId,
        petId: ctx.petId,
        category: 'REACTIVITY_OBSERVATION',
        behaviorDescription: 'Simba broke skin and bit the veterinary technician forearm when thermometer was inserted.',
        context: 'Exam room table during routine checkup.',
        trigger: 'HANDLING',
        durationMinutes: 1,
        frequency: 'ONCE',
        intensity: 5,
        locationContext: 'Clinic Exam Room 2',
        ownerResponse: 'Muzzled dog immediately with basket muzzle.',
        outcome: 'Exam paused and rescheduled under sedation.',
        ownerInterpretation: 'Vet tech moved too fast',
        provenance: 'OWNER_OBSERVED'
      },
      ctx.ownerUserId
    );

    // Must be classified as CONFIRMED_BITE
    if (obs.highRiskCategory !== 'CONFIRMED_BITE') {
      throw new Error(`Expected CONFIRMED_BITE, got ${obs.highRiskCategory}`);
    }

    // Must attach neutral, calm safety guidance without clinical diagnosis (e.g. no "diagnosed as aggressive")
    if (!obs.safetyEscalationMessage) {
      throw new Error('High-risk safety escalation message was missing.');
    }
    const messageLower = obs.safetyEscalationMessage.toLowerCase();
    if (
      messageLower.includes('diagnos') ||
      messageLower.includes('has aggression disorder') ||
      messageLower.includes('vicious')
    ) {
      throw new Error('Safety notice violated boundary: attempted psychiatric diagnosis of dog.');
    }
  }

  static async testCareOccurrenceCompletionIntegration(): Promise<void> {
    const ctx = Sprint8TrainingTestSuite.setupBaselineContext();
    const activePlan = TrainingService.getActivePlanForPet(ctx.petId, ctx.ownerUserId, ctx.householdId);
    if (!activePlan) throw new Error('Active plan missing');

    // Create a mock Sprint 6 Care Occurrence
    const occurrenceId = asCareOccurrenceId('occ-train-001');
    CareStore.saveOccurrence({
      occurrenceId,
      careObligationId: generateUUIDv7() as any,
      petId: ctx.petId,
      householdId: ctx.householdId,
      assignedToUserId: ctx.ownerUserId,
      category: 'GENERAL_CARE',
      title: 'Daily Sit & Down Practice',
      scheduledFor: currentClockUtcNow(),
      dueWindowStart: currentClockUtcNow(),
      dueWindowEnd: currentClockUtcNow(),
      status: 'DUE',
      occurrenceNumber: 1,
      snoozeCount: 0,
      createdAt: currentClockUtcNow(),
      updatedAt: currentClockUtcNow()
    });

    // Start and complete training session linked to this occurrence
    const session = TrainingService.startSession(
      {
        householdId: ctx.householdId,
        petId: ctx.petId,
        planId: activePlan.trainingPlanId,
        scheduledOccurrenceId: occurrenceId,
        environment: 'HOME'
      },
      ctx.ownerUserId
    );

    TrainingService.completeSession(
      {
        sessionId: session.trainingSessionId,
        overallPerformance: 'SUCCESSFUL'
      },
      ctx.ownerUserId,
      ctx.householdId
    );

    const updatedOccurrence = CareStore.getOccurrence(occurrenceId);
    if (updatedOccurrence?.status !== 'COMPLETED') {
      throw new Error(`Expected Care Occurrence to be COMPLETED, got ${updatedOccurrence?.status}`);
    }
  }

  static async testNutritionTreatRewardIntegration(): Promise<void> {
    const ctx = Sprint8TrainingTestSuite.setupBaselineContext();
    const activePlan = TrainingService.getActivePlanForPet(ctx.petId, ctx.ownerUserId, ctx.householdId);
    if (!activePlan) throw new Error('Active plan missing');

    const session = TrainingService.startSession(
      {
        householdId: ctx.householdId,
        petId: ctx.petId,
        planId: activePlan.trainingPlanId,
        environment: 'HOME'
      },
      ctx.ownerUserId
    );

    TrainingService.completeSession(
      {
        sessionId: session.trainingSessionId,
        overallPerformance: 'SUCCESSFUL',
        treatCountRecorded: 15
      },
      ctx.ownerUserId,
      ctx.householdId
    );

    const treats = NutritionStore.listTreatLogsForPet(ctx.petId);
    const sessionTreat = treats.find(t => t.notes?.includes(session.trainingSessionId));
    if (!sessionTreat || sessionTreat.quantity.value !== 15) {
      throw new Error('Nutrition treat reward was not automatically logged to Nutrition Store.');
    }
  }

  static async testTimelineProjectionIntegration(): Promise<void> {
    const ctx = Sprint8TrainingTestSuite.setupBaselineContext();

    const plan = TrainingService.createPlan(
      {
        householdId: ctx.householdId,
        petId: ctx.petId,
        title: 'Timeline Projection Plan',
        description: 'Testing timeline integration',
        planType: 'CUSTOM_HOUSEHOLD',
        sourceType: 'OWNER_CREATED'
      },
      ctx.ownerUserId
    );

    TrainingService.activatePlan(plan.trainingPlanId, ctx.ownerUserId, ctx.householdId);

    const timelineEvents = TimelineStore.query(ctx.petId, { category: 'TRAINING' });
    const match = timelineEvents.events.find(
      e => e.sourceEntityId === plan.trainingPlanId && e.eventType === 'TRAINING_PLAN_ACTIVATED'
    );

    if (!match) {
      throw new Error('Training plan activation failed to project to canonical longitudinal timeline.');
    }
  }

  static async testPassportScopedTrainingSnippet(): Promise<void> {
    const ctx = Sprint8TrainingTestSuite.setupBaselineContext();

    const passportSnippet = TrainingService.getPassportTrainingSnippet(
      ctx.petId,
      ctx.ownerUserId,
      ctx.householdId
    );

    if (!passportSnippet.knownCues || passportSnippet.knownCues.length === 0) {
      throw new Error('Passport snippet missing known cues.');
    }

    // Privacy boundary: Private behavior journal entries MUST NOT be exposed in passport snippet
    const snippetString = JSON.stringify(passportSnippet);
    if (snippetString.includes('ownerInterpretation') || snippetString.includes('Chewed corner')) {
      throw new Error('Passport privacy violation: private behavior journal was leaked in passport snippet.');
    }
  }

  static async testTrainerHandoffDossier(): Promise<void> {
    const ctx = Sprint8TrainingTestSuite.setupBaselineContext();

    // Add health condition
    HealthStore.saveCondition({
      conditionId: generateUUIDv7() as any,
      petId: ctx.petId,
      isDiagnosis: true,
      conditionName: 'Mild Hip Dysplasia',
      category: 'ORTHOPEDIC',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      severity: 'MILD',
      chronic: true,
      onsetDatePrecision: 'EXACT',
      provenance: 'VETERINARY_PROFESSIONAL',
      recordedBy: ctx.trainerUserId,
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z'
    });

    const handoff = TrainingService.getTrainerHandoffSummary(
      ctx.petId,
      ctx.trainerUserId,
      ctx.householdId
    );

    if (!handoff.petName || handoff.petName !== 'Simba') {
      throw new Error('Handoff dossier failed to populate Pet Core demographics.');
    }
    if (handoff.healthConstraints.length === 0) {
      throw new Error('Handoff dossier failed to cross-reference health mobility restrictions.');
    }
  }

  static async testCrossHouseholdIsolationIDOR(): Promise<void> {
    const ctx = Sprint8TrainingTestSuite.setupBaselineContext();

    let idorBlocked = false;
    try {
      // Stranger user from household-002 attempts to view Simba's training plan in household-001
      TrainingService.listPlansForPet(ctx.petId, ctx.strangerUserId, ctx.householdId);
    } catch (err: any) {
      idorBlocked = true;
    }

    if (!idorBlocked) {
      throw new Error('IDOR security violation: user from outside household accessed pet training data.');
    }
  }

  static async testTemporaryCaregiverLeastPrivilege(): Promise<void> {
    const ctx = Sprint8TrainingTestSuite.setupBaselineContext();

    // Temporary caregiver CAN execute a session
    const activePlan = TrainingService.getActivePlanForPet(ctx.petId, ctx.ownerUserId, ctx.householdId);
    if (!activePlan) throw new Error('Active plan missing');

    const session = TrainingService.startSession(
      {
        householdId: ctx.householdId,
        petId: ctx.petId,
        planId: activePlan.trainingPlanId,
        environment: 'HOME'
      },
      ctx.caregiverUserId
    );

    TrainingService.completeSession(
      {
        sessionId: session.trainingSessionId,
        overallPerformance: 'SUCCESSFUL'
      },
      ctx.caregiverUserId,
      ctx.householdId
    );

    // Temporary caregiver CANNOT create a training plan
    let planCreationBlocked = false;
    try {
      TrainingService.createPlan(
        {
          householdId: ctx.householdId,
          petId: ctx.petId,
          title: 'Caregiver Rogue Plan',
          description: 'Should be rejected',
          planType: 'CUSTOM_HOUSEHOLD',
          sourceType: 'OWNER_CREATED'
        },
        ctx.caregiverUserId
      );
    } catch (err: any) {
      planCreationBlocked = true;
    }

    if (!planCreationBlocked) {
      throw new Error('Least privilege violated: temporary caregiver was able to create training plan.');
    }
  }

  static async testDeceasedPetSafetyGuard(): Promise<void> {
    const ctx = Sprint8TrainingTestSuite.setupBaselineContext();

    // Create deceased pet
    const deceasedPetId = asPetId('pet-deceased-001');
    PetStore.savePet({
      petId: deceasedPetId,
      householdId: ctx.householdId,
      name: 'Old Rover',
      speciesCode: 'CANIS_LUPUS_FAMILIARIS',
      breedCode: 'HOUND',
      mixedBreed: false,
      unknownBreed: false,
      sex: 'MALE',
      reproductiveStatus: 'STERILIZED',
      dateOfBirth: '2010-01-01',
      birthdatePrecision: 'EXACT',
      estimatedBirthdate: false,
      primaryColor: 'Brown',
      sizeClassification: 'LARGE',
      lifecycleStage: 'SENIOR',
      status: 'DECEASED',
      createdBy: ctx.ownerUserId,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
      version: 1,
      metadata: {}
    });

    let deceasedGuardTripped = false;
    try {
      TrainingService.createPlan(
        {
          householdId: ctx.householdId,
          petId: deceasedPetId,
          title: 'Posthumous Plan',
          description: 'Should fail immediately',
          planType: 'CUSTOM_HOUSEHOLD',
          sourceType: 'OWNER_CREATED'
        },
        ctx.ownerUserId
      );
    } catch (err: any) {
      if (err.message.includes('deceased pet')) {
        deceasedGuardTripped = true;
      }
    }

    if (!deceasedGuardTripped) {
      throw new Error('Deceased pet safety guard failed: training plan created for deceased pet.');
    }
  }
}
