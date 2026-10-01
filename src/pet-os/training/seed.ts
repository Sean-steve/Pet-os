/**
 * Pet OS Sprint 8 - Training & Behavior Canonical Seed Data
 * Implements Volume X (Training & Behavior Architecture)
 */

import {
  asSkillId,
  asTrainingProgramId,
  asProgramVersionId,
  asProgramStageId,
  asTrainingExerciseId,
  asTrainingPlanId,
  asTrainingSessionId,
  asExerciseAttemptId,
  asSkillProgressId,
  asTrainingMilestoneId,
  asBehaviorObservationId,
  asPetId,
  asHouseholdId,
  asUserId
} from '../kernel/ids';
import { TrainingStore } from './store';
import {
  Skill,
  TrainingProgram,
  ProgramVersion,
  TrainingPlan,
  TrainingSession,
  ExerciseAttempt,
  PetSkillProgress,
  TrainingMilestone,
  BehaviorObservation
} from './types';

export function seedTrainingData(): void {
  // Clear first for idempotency
  TrainingStore.clear();

  const householdId = asHouseholdId('household-001');
  const petId = asPetId('pet-001'); // Simba
  const ownerUserId = asUserId('user-owner-001');
  const trainerUserId = asUserId('user-trainer-001');

  // ==========================================
  // 1. SKILL CATALOGUE
  // ==========================================

  const skillSitId = asSkillId('skill-sit-001');
  const skillDownId = asSkillId('skill-down-002');
  const skillStayId = asSkillId('skill-stay-003');
  const skillRecallId = asSkillId('skill-recall-004');
  const skillLeashId = asSkillId('skill-leash-005');
  const skillCrateId = asSkillId('skill-crate-006');
  const skillDoorId = asSkillId('skill-door-007');
  const skillHandlingId = asSkillId('skill-handling-008');
  const skillLeaveItId = asSkillId('skill-leaveit-009');

  const skills: Skill[] = [
    {
      skillId: skillSitId,
      skillCode: 'FOUND_SIT',
      name: 'Sit on Cue',
      description: 'Pet lowers hindquarters to floor promptly upon verbal or hand cue without physical pressure.',
      category: 'FOUNDATION',
      speciesScope: 'CANIS_LUPUS_FAMILIARIS',
      lifecycleStageScope: 'ALL_STAGES',
      prerequisiteSkillIds: [],
      difficultyLevel: 'BEGINNER',
      active: true,
      version: 1,
      createdAt: '2026-08-01T08:00:00Z',
      updatedAt: '2026-08-01T08:00:00Z'
    },
    {
      skillId: skillDownId,
      skillCode: 'FOUND_DOWN',
      name: 'Lie Down (Down)',
      description: 'Pet transitions from sit or stand to flat down position with elbows touching floor.',
      category: 'FOUNDATION',
      speciesScope: 'CANIS_LUPUS_FAMILIARIS',
      lifecycleStageScope: 'ALL_STAGES',
      prerequisiteSkillIds: [skillSitId],
      difficultyLevel: 'BEGINNER',
      active: true,
      version: 1,
      createdAt: '2026-08-01T08:00:00Z',
      updatedAt: '2026-08-01T08:00:00Z'
    },
    {
      skillId: skillStayId,
      skillCode: 'IMP_STAY',
      name: 'Stay / Wait',
      description: 'Pet maintains designated position until release marker ("Free" or "Okay") is spoken.',
      category: 'IMPULSE_CONTROL',
      speciesScope: 'CANIS_LUPUS_FAMILIARIS',
      lifecycleStageScope: 'ALL_STAGES',
      prerequisiteSkillIds: [skillSitId],
      difficultyLevel: 'INTERMEDIATE',
      active: true,
      version: 1,
      createdAt: '2026-08-01T08:00:00Z',
      updatedAt: '2026-08-01T08:00:00Z'
    },
    {
      skillId: skillRecallId,
      skillCode: 'REC_RECALL',
      name: 'Reliable Recall ("Come")',
      description: 'Pet immediately turns and sprints to handler across open distances upon hearing recall cue.',
      category: 'RECALL',
      speciesScope: 'CANIS_LUPUS_FAMILIARIS',
      lifecycleStageScope: 'ALL_STAGES',
      prerequisiteSkillIds: [skillSitId],
      difficultyLevel: 'ADVANCED',
      active: true,
      version: 1,
      createdAt: '2026-08-01T08:00:00Z',
      updatedAt: '2026-08-01T08:00:00Z'
    },
    {
      skillId: skillLeashId,
      skillCode: 'LEASH_WALK',
      name: 'Loose-Leash Walking',
      description: 'Pet walks alongside handler with J-loop slack in leash without pulling or lunging.',
      category: 'LEASH',
      speciesScope: 'CANIS_LUPUS_FAMILIARIS',
      lifecycleStageScope: 'ALL_STAGES',
      prerequisiteSkillIds: [skillSitId],
      difficultyLevel: 'INTERMEDIATE',
      active: true,
      version: 1,
      createdAt: '2026-08-01T08:00:00Z',
      updatedAt: '2026-08-01T08:00:00Z'
    },
    {
      skillId: skillCrateId,
      skillCode: 'HOUSE_CRATE',
      name: 'Crate Comfort & Settle',
      description: 'Pet enters crate voluntarily and rests calmly with door closed for designated duration.',
      category: 'HOUSEHOLD',
      speciesScope: 'CANIS_LUPUS_FAMILIARIS',
      lifecycleStageScope: 'PUPPY',
      prerequisiteSkillIds: [],
      difficultyLevel: 'BEGINNER',
      active: true,
      version: 1,
      createdAt: '2026-08-01T08:00:00Z',
      updatedAt: '2026-08-01T08:00:00Z'
    },
    {
      skillId: skillDoorId,
      skillCode: 'IMP_DOOR',
      name: 'Doorway Manners / Threshold Wait',
      description: 'Pet sits and waits at open doorways until explicitly invited to cross threshold.',
      category: 'IMPULSE_CONTROL',
      speciesScope: 'CANIS_LUPUS_FAMILIARIS',
      lifecycleStageScope: 'ALL_STAGES',
      prerequisiteSkillIds: [skillStayId],
      difficultyLevel: 'INTERMEDIATE',
      active: true,
      version: 1,
      createdAt: '2026-08-01T08:00:00Z',
      updatedAt: '2026-08-01T08:00:00Z'
    },
    {
      skillId: skillHandlingId,
      skillCode: 'HAND_CARE',
      name: 'Cooperative Handling & Grooming',
      description: 'Pet calmly allows inspection of paws, ears, teeth, and body without pulling away.',
      category: 'HANDLING',
      speciesScope: 'ALL',
      lifecycleStageScope: 'ALL_STAGES',
      prerequisiteSkillIds: [],
      difficultyLevel: 'BEGINNER',
      active: true,
      version: 1,
      createdAt: '2026-08-01T08:00:00Z',
      updatedAt: '2026-08-01T08:00:00Z'
    },
    {
      skillId: skillLeaveItId,
      skillCode: 'SAFE_LEAVEIT',
      name: 'Leave It / Drop Item',
      description: 'Pet abruptly disengages attention from food item or dropped object upon cue.',
      category: 'SAFETY',
      speciesScope: 'CANIS_LUPUS_FAMILIARIS',
      lifecycleStageScope: 'ALL_STAGES',
      prerequisiteSkillIds: [skillSitId],
      difficultyLevel: 'INTERMEDIATE',
      active: true,
      version: 1,
      createdAt: '2026-08-01T08:00:00Z',
      updatedAt: '2026-08-01T08:00:00Z'
    }
  ];

  skills.forEach(s => TrainingStore.saveSkill(s));

  // ==========================================
  // 2. TRAINING PROGRAMS & VERSIONS
  // ==========================================

  const puppyProgId = asTrainingProgramId('prog-puppy-001');
  const puppyProgV1Id = asProgramVersionId('ver-puppy-001-v1');
  const puppyProgV2Id = asProgramVersionId('ver-puppy-001-v2');

  const puppyProgram: TrainingProgram = {
    programId: puppyProgId,
    code: 'PUPPY_FOUNDATIONS',
    title: 'Puppy Foundations & Socialization',
    description: 'Core 6-week developmental curriculum establishing marker words, basic cues, and environmental confidence.',
    speciesScope: 'CANIS_LUPUS_FAMILIARIS',
    lifecycleStageScope: 'PUPPY',
    category: 'FOUNDATION',
    status: 'PUBLISHED',
    currentVersionNumber: 2,
    createdAt: '2026-08-01T08:00:00Z',
    updatedAt: '2026-08-15T08:00:00Z'
  };
  TrainingStore.saveProgram(puppyProgram);

  const stage1Id = asProgramStageId('stage-puppy-s1');
  const stage2Id = asProgramStageId('stage-puppy-s2');
  const stage3Id = asProgramStageId('stage-puppy-s3');

  const v1Stages = [
    {
      stageId: stage1Id,
      programVersionId: puppyProgV1Id,
      sequence: 1,
      title: 'Marker Word & Engagement',
      description: 'Charge the verbal marker ("Yes!") and reward eye contact.',
      entryCriteria: 'Pet is settled in home environment with no acute medical distress.',
      completionCriteria: 'Pet responds with head turn to marker word within 1 second for 10 consecutive trials.',
      exercises: [
        {
          exerciseId: asTrainingExerciseId('ex-p1-01'),
          programVersionId: puppyProgV1Id,
          stageId: stage1Id,
          skillId: skillSitId,
          title: 'Charging the Marker ("Yes")',
          instructions: 'Say marker word "Yes!" in upbeat tone, immediately deliver small soft treat within 1 second. Repeat.',
          environment: 'HOME' as const,
          recommendedDurationMinutes: 5,
          repetitionTarget: 10,
          difficulty: 'BEGINNER' as const,
          successCriteria: 'Pet immediately turns head toward treat delivery upon marker.',
          sequence: 1
        }
      ]
    },
    {
      stageId: stage2Id,
      programVersionId: puppyProgV1Id,
      sequence: 2,
      title: 'Foundation Positions (Sit, Down, Stay)',
      description: 'Introduce luring and hand cues for sit, down, and short stay durations.',
      entryCriteria: 'Stage 1 completed with marker fluency.',
      completionCriteria: 'Independent sit and down execution with 80% success rate across 2 separate sessions.',
      exercises: [
        {
          exerciseId: asTrainingExerciseId('ex-p2-01'),
          programVersionId: puppyProgV1Id,
          stageId: stage2Id,
          skillId: skillSitId,
          title: 'Lure to Sit',
          instructions: 'Hold treat at nose height, slowly lift over forehead. Mark "Yes!" the instant rear touches floor.',
          environment: 'HOME' as const,
          recommendedDurationMinutes: 10,
          repetitionTarget: 10,
          difficulty: 'BEGINNER' as const,
          successCriteria: 'Rear sits without handler touching dog.',
          sequence: 1
        },
        {
          exerciseId: asTrainingExerciseId('ex-p2-02'),
          programVersionId: puppyProgV1Id,
          stageId: stage2Id,
          skillId: skillDownId,
          title: 'Lure to Down from Sit',
          instructions: 'From sit, lower treat straight down to floor between front paws, then pull slightly outward.',
          environment: 'HOME' as const,
          recommendedDurationMinutes: 10,
          repetitionTarget: 8,
          difficulty: 'BEGINNER' as const,
          successCriteria: 'Chest and elbows rest on floor.',
          sequence: 2
        }
      ]
    },
    {
      stageId: stage3Id,
      programVersionId: puppyProgV1Id,
      sequence: 3,
      title: 'Loose Leash Basics & Boundary Manners',
      description: 'Gentle leash manners indoors and quiet backyard environment.',
      entryCriteria: 'Stage 2 completed.',
      completionCriteria: 'Walking 20 paces with loose leash in backyard.',
      exercises: [
        {
          exerciseId: asTrainingExerciseId('ex-p3-01'),
          programVersionId: puppyProgV1Id,
          stageId: stage3Id,
          skillId: skillLeashId,
          title: 'Follow the Leader Loose Leash',
          instructions: 'Change direction when puppy reaches end of leash. Reward generously at handler hip.',
          environment: 'YARD' as const,
          recommendedDurationMinutes: 15,
          repetitionTarget: 15,
          difficulty: 'INTERMEDIATE' as const,
          successCriteria: 'No tension on leash for 15 paces.',
          sequence: 1
        }
      ]
    }
  ];

  const version1: ProgramVersion = {
    programVersionId: puppyProgV1Id,
    programId: puppyProgId,
    versionNumber: 1,
    title: 'Puppy Foundations v1.0',
    summary: 'Original 3-stage foundation curriculum.',
    status: 'PUBLISHED',
    stages: v1Stages,
    createdAt: '2026-08-01T08:00:00Z',
    publishedAt: '2026-08-01T08:00:00Z'
  };
  TrainingStore.saveProgramVersion(version1);

  const version2: ProgramVersion = {
    programVersionId: puppyProgV2Id,
    programId: puppyProgId,
    versionNumber: 2,
    title: 'Puppy Foundations v2.0 (Enhanced Cooperative Care)',
    summary: 'Updated curriculum with cooperative care and handling exercises embedded in Stage 1.',
    status: 'PUBLISHED',
    stages: v1Stages.map(s => ({ ...s, programVersionId: puppyProgV2Id })),
    createdAt: '2026-08-15T08:00:00Z',
    publishedAt: '2026-08-15T08:00:00Z'
  };
  TrainingStore.saveProgramVersion(version2);

  // ==========================================
  // 3. ACTIVE TRAINING PLAN FOR SIMBA
  // ==========================================

  const planId = asTrainingPlanId('plan-simba-001');
  const activePlan: TrainingPlan = {
    trainingPlanId: planId,
    householdId,
    petId,
    title: 'Simba Puppy Foundations',
    description: 'Prescribed early learning plan focusing on reliable sit, down, and polite greetings.',
    planType: 'STANDARD_PROGRAM',
    sourceType: 'TRAINER_CREATED',
    sourceActorId: trainerUserId,
    trainerId: trainerUserId,
    trainerName: 'Sarah Jenkins, CPDT-KA',
    trainerOrganization: 'Pacific Paws Academy',
    trainerVerificationStatus: 'VERIFIED',
    status: 'ACTIVE',
    programId: puppyProgId,
    programVersionId: puppyProgV1Id,
    currentStageId: stage2Id,
    startsAt: '2026-08-20T09:00:00Z',
    targetEndAt: '2026-10-01T09:00:00Z',
    timezone: 'America/Los_Angeles',
    notes: 'Simba is food-motivated. Use pea-sized freeze-dried beef liver.',
    createdBy: trainerUserId,
    createdAt: '2026-08-20T08:30:00Z',
    updatedAt: '2026-08-20T08:30:00Z',
    concurrencyVersion: 1
  };
  TrainingStore.savePlan(activePlan);

  // ==========================================
  // 4. HISTORICAL SESSIONS & ATTEMPTS
  // ==========================================

  const session1Id = asTrainingSessionId('sess-simba-001');
  const attempt1Id = asExerciseAttemptId('att-simba-001');
  const session1: TrainingSession = {
    trainingSessionId: session1Id,
    householdId,
    petId,
    planId,
    stageId: stage1Id,
    status: 'COMPLETED',
    conductedByUserId: ownerUserId,
    environment: 'HOME',
    startedAt: '2026-08-21T10:00:00Z',
    endedAt: '2026-08-21T10:12:00Z',
    durationSeconds: 720,
    overallPerformance: 'SUCCESSFUL',
    notes: 'Simba picked up marker word very quickly! Wagging tail throughout.',
    treatCountRecorded: 10,
    attempts: [
      {
        attemptId: attempt1Id,
        sessionId: session1Id,
        exerciseId: asTrainingExerciseId('ex-p1-01'),
        skillId: skillSitId,
        sequence: 1,
        startedAt: '2026-08-21T10:02:00Z',
        result: 'SUCCESSFUL',
        repetitions: 10,
        successfulRepetitions: 9,
        assistanceLevel: 'PROMPTED',
        distractionLevel: 'NONE',
        environment: 'HOME',
        notes: '9 out of 10 clean responses to marker.',
        recordedByUserId: ownerUserId
      }
    ],
    createdAt: '2026-08-21T10:00:00Z',
    updatedAt: '2026-08-21T10:12:00Z',
    concurrencyVersion: 2
  };
  TrainingStore.saveSession(session1);
  TrainingStore.saveAttempt(session1.attempts[0]);

  const session2Id = asTrainingSessionId('sess-simba-002');
  const attempt2Id = asExerciseAttemptId('att-simba-002');
  const session2: TrainingSession = {
    trainingSessionId: session2Id,
    householdId,
    petId,
    planId,
    stageId: stage2Id,
    status: 'COMPLETED',
    conductedByUserId: ownerUserId,
    trainerId: trainerUserId,
    environment: 'HOME',
    startedAt: '2026-08-23T14:00:00Z',
    endedAt: '2026-08-23T14:15:00Z',
    durationSeconds: 900,
    overallPerformance: 'SUCCESSFUL',
    notes: 'Moved to Stage 2 lure to sit. Completed 10 independent repetitions.',
    treatCountRecorded: 12,
    attempts: [
      {
        attemptId: attempt2Id,
        sessionId: session2Id,
        exerciseId: asTrainingExerciseId('ex-p2-01'),
        skillId: skillSitId,
        sequence: 1,
        startedAt: '2026-08-23T14:03:00Z',
        result: 'SUCCESSFUL',
        repetitions: 12,
        successfulRepetitions: 10,
        assistanceLevel: 'INDEPENDENT',
        distractionLevel: 'LOW',
        environment: 'HOME',
        notes: 'Responsive sit cue without touching.',
        recordedByUserId: ownerUserId
      }
    ],
    createdAt: '2026-08-23T14:00:00Z',
    updatedAt: '2026-08-23T14:15:00Z',
    concurrencyVersion: 2
  };
  TrainingStore.saveSession(session2);
  TrainingStore.saveAttempt(session2.attempts[0]);

  // ==========================================
  // 5. SKILL PROFICIENCY
  // ==========================================

  const progressSit: PetSkillProgress = {
    skillProgressId: asSkillProgressId('prog-simba-sit'),
    petId,
    householdId,
    skillId: skillSitId,
    currentProficiency: 'DEVELOPING',
    assessmentProvenance: 'SYSTEM_DERIVED',
    lastAssessedAt: '2026-08-23T14:15:00Z',
    assessedByUserId: ownerUserId,
    assessedByTrainerId: trainerUserId,
    trainerVerificationStatus: 'VERIFIED',
    sessionCount: 2,
    successfulRepetitionsTotal: 19,
    notes: 'Consistently sits on cue with minimal prompting.',
    updatedAt: '2026-08-23T14:15:00Z'
  };
  TrainingStore.saveSkillProgress(progressSit);

  const progressDown: PetSkillProgress = {
    skillProgressId: asSkillProgressId('prog-simba-down'),
    petId,
    householdId,
    skillId: skillDownId,
    currentProficiency: 'INTRODUCED',
    assessmentProvenance: 'TRAINER_ASSESSED',
    lastAssessedAt: '2026-08-23T14:15:00Z',
    assessedByUserId: trainerUserId,
    assessedByTrainerId: trainerUserId,
    trainerVerificationStatus: 'VERIFIED',
    sessionCount: 1,
    successfulRepetitionsTotal: 6,
    notes: 'Introduced down lure. Needs slight hand guidance.',
    updatedAt: '2026-08-23T14:15:00Z'
  };
  TrainingStore.saveSkillProgress(progressDown);

  // ==========================================
  // 6. MILESTONES
  // ==========================================

  const milestone1: TrainingMilestone = {
    milestoneId: asTrainingMilestoneId('ms-simba-001'),
    householdId,
    petId,
    planId,
    skillId: skillSitId,
    milestoneType: 'FIRST_SUCCESSFUL_EXECUTION',
    title: 'First Success: Sit on Cue',
    description: 'Simba successfully completed first independent sit during training session.',
    achievedAt: '2026-08-21T10:05:00Z',
    source: 'SESSION_AUTOMATED',
    idempotencyKey: `${petId}_FIRST_SUCCESS_${skillSitId}`,
    createdAt: '2026-08-21T10:05:00Z'
  };
  TrainingStore.saveMilestone(milestone1);

  const milestone2: TrainingMilestone = {
    milestoneId: asTrainingMilestoneId('ms-simba-002'),
    householdId,
    petId,
    planId,
    milestoneType: 'STAGE_COMPLETED',
    title: 'Stage 1 Completed: Marker & Engagement',
    description: 'Mastered criteria for Stage 1 Marker Word & Engagement.',
    achievedAt: '2026-08-21T10:12:00Z',
    source: 'SESSION_AUTOMATED',
    idempotencyKey: `${petId}_STAGE_${stage1Id}`,
    createdAt: '2026-08-21T10:12:00Z'
  };
  TrainingStore.saveMilestone(milestone2);

  // ==========================================
  // 7. BEHAVIOR OBSERVATIONS
  // ==========================================

  const obs1: BehaviorObservation = {
    observationId: asBehaviorObservationId('obs-simba-001'),
    householdId,
    petId,
    observedAt: '2026-08-22T16:45:00Z',
    recordedAt: '2026-08-22T17:00:00Z',
    category: 'BARKING',
    behaviorDescription: 'Barked 3 times at front door when courier rang the doorbell and dropped package.',
    context: 'Resting in living room, courier walked up steps.',
    trigger: 'DOORBELL',
    durationMinutes: 1,
    frequency: 'OCCASIONAL',
    intensity: 3,
    locationContext: 'Living Room front entryway',
    peoplePresent: 'Owner, Delivery Courier outside',
    precedingEvent: 'Doorbell chime',
    ownerResponse: 'Called Simba to kitchen and asked for sit, rewarded with treat when quiet.',
    outcome: 'Stopped barking within 45 seconds and remained in kitchen.',
    ownerInterpretation: 'Simba was alerting us to a visitor at the door.',
    provenance: 'OWNER_OBSERVED',
    recordedByUserId: ownerUserId,
    highRiskCategory: 'NONE',
    amendments: [],
    createdAt: '2026-08-22T17:00:00Z',
    updatedAt: '2026-08-22T17:00:00Z'
  };
  TrainingStore.saveBehaviorObservation(obs1);

  const obs2: BehaviorObservation = {
    observationId: asBehaviorObservationId('obs-simba-002'),
    householdId,
    petId,
    observedAt: '2026-08-24T18:30:00Z',
    recordedAt: '2026-08-24T18:45:00Z',
    category: 'JUMPING',
    behaviorDescription: 'Jumped up placing front paws on guest knees when neighbor arrived to visit.',
    context: 'Front entryway greeting.',
    trigger: 'STRANGER',
    durationMinutes: 1,
    frequency: 'OCCASIONAL',
    intensity: 2,
    locationContext: 'Front Foyer',
    peoplePresent: 'Owner, Neighbor (guest)',
    precedingEvent: 'Front door opened',
    ownerResponse: 'Instructed guest to fold arms and look away until four paws were on floor.',
    outcome: 'Simba sat down after 10 seconds and was greeted calmly.',
    ownerInterpretation: 'Excited greeting enthusiasm, needs practice on boundary sit.',
    provenance: 'OWNER_OBSERVED',
    recordedByUserId: ownerUserId,
    highRiskCategory: 'NONE',
    amendments: [],
    createdAt: '2026-08-24T18:45:00Z',
    updatedAt: '2026-08-24T18:45:00Z'
  };
  TrainingStore.saveBehaviorObservation(obs2);

  // Observation 3: High-Risk Incident with Non-Diagnostic Safety Escalation
  const obs3: BehaviorObservation = {
    observationId: asBehaviorObservationId('obs-simba-003'),
    householdId,
    petId,
    observedAt: '2026-08-25T12:30:00Z',
    recordedAt: '2026-08-25T13:00:00Z',
    category: 'RESOURCE_GUARDING_OBSERVATION',
    behaviorDescription: 'Growled with stiff posture and snapped at another dog attempting to sniff his chew toy at outdoor park; air snap missed, no physical contact made.',
    context: 'Resting on grass with high-value bully stick.',
    trigger: 'OTHER_DOG',
    durationMinutes: 2,
    frequency: 'ONCE',
    intensity: 4,
    locationContext: 'Public park grass area',
    animalsPresent: 'Off-leash approaching golden retriever',
    precedingEvent: 'Other dog ran into Simba personal space toward chew',
    ownerResponse: 'Body blocked other dog, calmly traded bully stick for high-value chicken, left area.',
    outcome: 'Chew toy safely retrieved, no physical fight or injury occurred.',
    ownerInterpretation: 'Possessive guarding of chew toy when startled in public.',
    provenance: 'OWNER_OBSERVED',
    recordedByUserId: ownerUserId,
    highRiskCategory: 'BITE_ATTEMPT',
    safetyEscalationMessage: 'Safety Notice: An attempted bite indicates high distress or escalation. For the safety of your household and pet, avoid triggering situations and consider consulting a qualified veterinary behaviorist or certified trainer (e.g., IAABC, KPA).',
    amendments: [],
    createdAt: '2026-08-25T13:00:00Z',
    updatedAt: '2026-08-25T13:00:00Z'
  };
  TrainingStore.saveBehaviorObservation(obs3);
}
