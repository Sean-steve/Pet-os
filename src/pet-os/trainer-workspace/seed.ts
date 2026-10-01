/**
 * Pet OS Sprint 20 - Trainer Professional Workspace Canonical Seed Data
 * 
 * Sets up Apex K9 Academy, Juma Ochieng (Lead Trainer), Assistant Trainers,
 * active client relationships, finalized assessments, completed training sessions
 * with household handoffs, active homework tasks, and work queue items.
 */

import {
  UserId,
  asUserId,
  asHouseholdId,
  asMembershipId,
  asPetId,
  asBusinessId,
  asProviderId,
  asBookingId,
  asTrainingAccessGrantId,
  asTrainerConsentId,
  asTrainerClientRelationshipId,
  asTrainerWorkQueueItemId,
  asProfessionalTrainingAssessmentId,
  asTrainerSessionAssignmentId,
  asTrainerHomeworkHandoffId,
  asTrainerReportId,
  asSkillId,
  asTrainingProgramId,
  asProgramVersionId,
  asProgramStageId,
  generateUUIDv7,
} from '../kernel/ids';

import { CANONICAL_IDS } from '../kernel/canonical-ids';
import { SEED_USERS, SEED_PROVIDERS, SEED_BUSINESSES } from '../provider/seed';
import { TrainerWorkspaceStore } from './store';
import { TrainerWorkspaceService } from './service';
import { TrainingStore } from '../training/store';
import { IdentityStore } from '../identity/store';
import { PetStore } from '../pet-core/store';

export const SEED_TRAINER_IDS = {
  APEX_K9_ACADEMY: SEED_BUSINESSES.APEX_K9_ACADEMY, // biz-apex-k9-academy
  LEAD_TRAINER_JUMA: SEED_USERS.TRAINER_JUMA, // usr-01951500-0000-7000-8000-000000000103
  ASSISTANT_TRAINER_SARAH: asUserId('usr-01951500-0000-7000-8000-000000000104'),
  SUSPENDED_TRAINER_KEVIN: SEED_USERS.SUSPENDED_KEVIN, // usr-01951500-0000-7000-8000-000000000105
  CLIENT_OWNER_ELENA: SEED_USERS.OWNER_ELENA,
  PET_KIBO: CANONICAL_IDS.PET_KIBO,
  PET_SIMBA: CANONICAL_IDS.PET_SIMBA,
};

export function seedTrainerWorkspaceData(
  store: TrainerWorkspaceStore = TrainerWorkspaceStore.getInstance()
): void {
  store.reset();
  const service = TrainerWorkspaceService.getInstance();
  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const nextWeek = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  // 1. Ensure assistant trainer identity exists in IdentityStore
  if (!IdentityStore.findUserById(SEED_TRAINER_IDS.ASSISTANT_TRAINER_SARAH)) {
    IdentityStore.saveUser({
      userId: SEED_TRAINER_IDS.ASSISTANT_TRAINER_SARAH,
      email: 'sarah.nderitu@apexk9.ke',
      normalizedEmail: 'sarah.nderitu@apexk9.ke',
      phoneNumber: '+254733112233',
      passwordHash: 'argon2id_mock_hash_seed',
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      policyAcceptedAt: threeDaysAgo,
      policyVersion: '1.0',
      createdAt: threeDaysAgo,
      updatedAt: now,
    });

    IdentityStore.saveProfile({
      userId: SEED_TRAINER_IDS.ASSISTANT_TRAINER_SARAH,
      displayName: 'Sarah Nderitu',
      firstName: 'Sarah',
      lastName: 'Nderitu',
      locale: 'en-KE',
      timezone: 'Africa/Nairobi',
      communicationPreferences: {
        emailNotifications: true,
        smsNotifications: true,
        emergencyAlerts: true,
      },
      privacyPreferences: {
        profileVisibility: 'HOUSEHOLD_ONLY',
        shareActivityWithHousehold: true,
      },
      updatedAt: now,
    });
  }

  // Ensure authorized trainer memberships in IdentityStore for Sprint 8 Training domain operations
  const ensureTrainerMembership = (userId: UserId) => {
    const existing = IdentityStore.listMembersForHousehold(CANONICAL_IDS.MAIN_HOUSEHOLD)
      .find(m => m.userId === userId);
    if (!existing) {
      IdentityStore.saveMembership({
        membershipId: asMembershipId(generateUUIDv7()),
        householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
        userId,
        role: 'HOUSEHOLD_ADMIN',
        status: 'ACTIVE',
        joinedAt: threeDaysAgo,
        updatedAt: now,
      });
    }
  };
  ensureTrainerMembership(SEED_TRAINER_IDS.LEAD_TRAINER_JUMA);
  ensureTrainerMembership(SEED_TRAINER_IDS.ASSISTANT_TRAINER_SARAH);

  // 2. Client Relationship for Kibo (German Shepherd - Adolescent Reactivity Program)
  const kiboGrantId = asTrainingAccessGrantId('tag-01952000-0000-7000-8000-000000000001');
  const kiboConsentId = asTrainerConsentId('tcn-01952000-0000-7000-8000-000000000001');
  const kiboRelId = asTrainerClientRelationshipId('rel-01952000-0000-7000-8000-000000000001');
  const kiboBookingId = asBookingId('bok-training-kibo-001');

  store.saveGrant({
    grantId: kiboGrantId,
    petId: SEED_TRAINER_IDS.PET_KIBO,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    grantedByUserId: SEED_TRAINER_IDS.CLIENT_OWNER_ELENA,
    businessId: SEED_TRAINER_IDS.APEX_K9_ACADEMY,
    trainerId: SEED_TRAINER_IDS.LEAD_TRAINER_JUMA,
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
    relationshipType: 'BEHAVIOR_CONSULTATION',
    validFrom: threeDaysAgo,
    validTo: nextWeek,
    bookingId: kiboBookingId,
    consentId: kiboConsentId,
    reason: 'Adolescent leash reactivity and recall rehabilitation package',
    createdAt: threeDaysAgo,
    updatedAt: now,
  });

  store.saveConsent({
    consentId: kiboConsentId,
    petId: SEED_TRAINER_IDS.PET_KIBO,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    consentedByUserId: SEED_TRAINER_IDS.CLIENT_OWNER_ELENA,
    trainerId: SEED_TRAINER_IDS.LEAD_TRAINER_JUMA,
    businessId: SEED_TRAINER_IDS.APEX_K9_ACADEMY,
    trainingRelationship: 'BEHAVIOR_CONSULTATION',
    consentedAt: threeDaysAgo,
    handlingRestrictions: ['No choke chains or prong collars', 'Use front-clip harness only'],
    treatAllergenExclusions: ['Chicken', 'Wheat'],
    allowOffLeashControlledArea: false,
    emergencyVetCareAuthorized: true,
    designatedEmergencyVet: 'Nairobi West Veterinary Clinic (Dr. Amani Kimani)',
    photoVideoEvidenceConsent: true,
    marketingMediaConsent: false,
    status: 'ACTIVE',
    signatureText: 'Elena Vance - Electronic Signature on file',
    createdAt: threeDaysAgo,
    updatedAt: now,
  });

  store.saveRelationship({
    relationshipId: kiboRelId,
    businessId: SEED_TRAINER_IDS.APEX_K9_ACADEMY,
    primaryTrainerId: SEED_TRAINER_IDS.LEAD_TRAINER_JUMA,
    assignedAssistantTrainerIds: [SEED_TRAINER_IDS.ASSISTANT_TRAINER_SARAH],
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    petId: SEED_TRAINER_IDS.PET_KIBO,
    status: 'ACTIVE',
    relationshipType: 'BEHAVIOR_CONSULTATION',
    activeGrantId: kiboGrantId,
    activeConsentId: kiboConsentId,
    bookingId: kiboBookingId,
    startDate: threeDaysAgo,
    createdAt: threeDaysAgo,
    updatedAt: now,
  });

  // 3. Finalized Professional Assessment for Kibo
  const assessmentId = asProfessionalTrainingAssessmentId('pta-01952000-0000-7000-8000-000000000001');
  const sitSkillId = asSkillId('skill-sit');
  const recallSkillId = asSkillId('skill-recall');
  const looseLeashSkillId = asSkillId('skill-loose-leash');

  const assessment = service.createAssessment(
    {
      businessId: SEED_TRAINER_IDS.APEX_K9_ACADEMY,
      petId: SEED_TRAINER_IDS.PET_KIBO,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      relationshipId: kiboRelId,
      bookingId: kiboBookingId,
      ownerStatedGoals: [
        'Stop lunging and barking at other dogs on walks',
        'Build reliable recall in open park settings',
        'Learn to relax when guests arrive at the house',
      ],
      trainerAssessedGoals: [
        'Establish loose-leash foundation with zero barrier frustration',
        'Condition alternate focus cue ("Watch Me") at 15-meter threshold',
        'Proof recall across minor outdoor distractions',
      ],
      skillBaselines: [
        {
          skillId: sitSkillId,
          skillName: 'Sit',
          baselineProficiency: 'DEVELOPING',
          notes: 'High reliability in quiet indoor environment; falters under outdoor arousal.',
        },
        {
          skillId: recallSkillId,
          skillName: 'Emergency Recall',
          baselineProficiency: 'INTRODUCED',
          notes: 'Responds within 3 meters indoors; requires 10-meter long-line foundation.',
        },
        {
          skillId: looseLeashSkillId,
          skillName: 'Loose Leash Walking',
          baselineProficiency: 'LEARNING',
          notes: 'Pulls forward when seeing movement; responds well to treat luring.',
        },
      ],
      behaviorObservations: [
        {
          category: 'REACTIVITY_OBSERVATION',
          trigger: 'OTHER_DOG',
          frequency: 'REPEATED_IN_SESSION',
          intensity: 4,
          description: 'Observed stiff posture, fixation, and vocalizing when encountering unfamiliar dogs at 10m distance.',
          handlerSafetyRisk: false,
        },
      ],
      healthRestrictionsNoted: ['Mild hip sensitivity noted in records; avoid steep jumps'],
      trainerEnvironmentalRecommendation: 'QUIET_OUTDOOR',
      handlerSafetyPrecautions: ['Maintain 15-meter safety threshold', 'Use 2-meter biothane leash with safety lock'],
      recommendedPlanTitle: 'Adolescent Reactive Dog Foundation & Desensitization',
      recommendedPlanType: 'BEHAVIORAL_MODIFICATION',
      veterinaryReferralRecommended: false,
    },
    SEED_TRAINER_IDS.LEAD_TRAINER_JUMA
  );

  // Finalize Kibo's assessment (creates canonical Sprint 8 plan & baselines)
  const finalizedAssessment = service.finalizeAssessment(
    assessment.assessmentId,
    SEED_TRAINER_IDS.LEAD_TRAINER_JUMA,
    'LEAD_TRAINER'
  );

  // 4. Record Completed Session 1 for Kibo with Handoff Summary & Homework
  const sessionAssignment = service.prepareSession(
    {
      planId: finalizedAssessment.prescribedPlanId!,
      petId: SEED_TRAINER_IDS.PET_KIBO,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      businessId: SEED_TRAINER_IDS.APEX_K9_ACADEMY,
      bookingId: kiboBookingId,
      environment: 'QUIET_OUTDOOR',
    },
    SEED_TRAINER_IDS.LEAD_TRAINER_JUMA
  );

  service.startSession(sessionAssignment.assignmentId, SEED_TRAINER_IDS.LEAD_TRAINER_JUMA);

  // Record attempts
  service.recordExerciseAttempt(
    sessionAssignment.assignmentId,
    {
      exerciseId: 'ex-focus-cue',
      skillId: sitSkillId,
      result: 'SUCCESSFUL',
      repetitions: 8,
      successfulRepetitions: 8,
      assistanceLevel: 'INDEPENDENT',
      distractionLevel: 'LOW',
      environment: 'QUIET_OUTDOOR',
      notes: 'Prompt eye contact held for 3 seconds before reward release.',
    },
    SEED_TRAINER_IDS.LEAD_TRAINER_JUMA
  );

  service.recordExerciseAttempt(
    sessionAssignment.assignmentId,
    {
      exerciseId: 'ex-loose-leash-u-turn',
      skillId: looseLeashSkillId,
      result: 'SUCCESSFUL_WITH_ASSISTANCE',
      repetitions: 10,
      successfulRepetitions: 7,
      assistanceLevel: 'PROMPTED',
      distractionLevel: 'MODERATE',
      environment: 'QUIET_OUTDOOR',
      notes: 'Completed U-turns when dog started forging ahead. Re-engaged nicely.',
    },
    SEED_TRAINER_IDS.LEAD_TRAINER_JUMA
  );

  // Complete session with household handoff & homework
  const completedSession = service.completeSession(
    sessionAssignment.assignmentId,
    {
      overallPerformance: 'SUCCESSFUL',
      handoffSummary: {
        whatWorkedOn: [
          'Conditioned "Watch Me" attention cue with high-value treats',
          'Taught directional change U-turn game on loose leash',
          'Practiced stationary calm sits when other dogs walked past at 20 meters',
        ],
        whatChangedSummary:
          'Kibo demonstrated significantly reduced latency to re-orient toward the handler when prompted with the focus cue.',
        whatToPractice: [
          'Watch Me focus cue (5 reps twice daily before feeding)',
          'U-turn walking game during quiet morning neighborhood walks',
        ],
        practiceFrequencyRecommendation: '2 short 5-minute sessions daily',
        whatToWatchFor: [
          'Stiffening of tail and hyper-fixation at distances under 15m; create space immediately if triggered.',
        ],
        followUpNotes:
          'Elena practiced handling during the last 15 minutes of the session with excellent leash tension control.',
      },
      treatCountRecorded: 15,
      homeworkTasks: [
        {
          exerciseId: 'hw-watch-me-daily',
          exerciseName: 'Watch Me Attention Cue',
          skillId: sitSkillId,
          targetRepetitions: 10,
          targetFrequencyPerDay: 2,
          instructions: 'Say "Watch", wait for eye contact, mark with "Yes!" and reward immediately.',
        },
      ],
      homeworkInstructions: 'Practice in the backyard before attempting on street walks.',
    },
    SEED_TRAINER_IDS.LEAD_TRAINER_JUMA
  );

  // Caregiver logs 1 homework completion
  if (completedSession.homeworkAssignedId) {
    service.logCaregiverHomework(
      completedSession.homeworkAssignedId,
      {
        repetitionsCompleted: 10,
        successObserved: true,
        notes: 'Practiced in backyard before dinner. Kibo caught on quickly!',
      },
      SEED_TRAINER_IDS.CLIENT_OWNER_ELENA
    );
  }

  // 5. Work Queue items for Apex K9
  store.saveQueueItem({
    queueItemId: asTrainerWorkQueueItemId('tqi-01952000-0000-7000-8000-000000000001'),
    businessId: SEED_TRAINER_IDS.APEX_K9_ACADEMY,
    assignedTrainerId: SEED_TRAINER_IDS.LEAD_TRAINER_JUMA,
    petId: SEED_TRAINER_IDS.PET_KIBO,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    clientName: 'Elena Vance',
    petName: 'Kibo',
    itemType: 'SESSION_SCHEDULED',
    status: 'PENDING',
    priority: 'HIGH',
    scheduledAt: nextWeek,
    notes: 'Session 2: Leash Reactivity Desensitization & 15m Distance Threshold Proofing',
    createdAt: now,
    updatedAt: now,
  });

  store.saveQueueItem({
    queueItemId: asTrainerWorkQueueItemId('tqi-01952000-0000-7000-8000-000000000002'),
    businessId: SEED_TRAINER_IDS.APEX_K9_ACADEMY,
    assignedTrainerId: SEED_TRAINER_IDS.ASSISTANT_TRAINER_SARAH,
    petId: SEED_TRAINER_IDS.PET_KIBO,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    clientName: 'Elena Vance',
    petName: 'Kibo',
    itemType: 'HOMEWORK_FOLLOW_UP',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    dueAt: nextWeek,
    notes: 'Follow up with Elena on morning U-turn walking consistency and treat value.',
    createdAt: now,
    updatedAt: now,
  });

  // Client Relationship for Simba (Golden Retriever - Therapy Dog Intake)
  const simbaGrantId = asTrainingAccessGrantId('tag-01952000-0000-7000-8000-000000000002');
  const simbaConsentId = asTrainerConsentId('tcn-01952000-0000-7000-8000-000000000002');
  const simbaRelId = asTrainerClientRelationshipId('rel-01952000-0000-7000-8000-000000000002');

  store.saveGrant({
    grantId: simbaGrantId,
    petId: SEED_TRAINER_IDS.PET_SIMBA,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    grantedByUserId: SEED_TRAINER_IDS.CLIENT_OWNER_ELENA,
    businessId: SEED_TRAINER_IDS.APEX_K9_ACADEMY,
    trainerId: SEED_TRAINER_IDS.LEAD_TRAINER_JUMA,
    scopes: [
      'PET_IDENTITY_SUMMARY',
      'TRAINING_READ',
      'TRAINING_WRITE',
      'BEHAVIOR_READ',
      'BEHAVIOR_WRITE',
      'TRAINING_EVIDENCE_READ',
      'TRAINING_EVIDENCE_WRITE',
    ],
    status: 'ACTIVE',
    relationshipType: 'ONE_ON_ONE_COACHING',
    validFrom: yesterday,
    validTo: nextWeek,
    reason: 'Therapy dog foundation assessment and temperament evaluation',
    createdAt: yesterday,
    updatedAt: now,
  });

  store.saveConsent({
    consentId: simbaConsentId,
    petId: SEED_TRAINER_IDS.PET_SIMBA,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    consentedByUserId: SEED_TRAINER_IDS.CLIENT_OWNER_ELENA,
    trainerId: SEED_TRAINER_IDS.LEAD_TRAINER_JUMA,
    businessId: SEED_TRAINER_IDS.APEX_K9_ACADEMY,
    trainingRelationship: 'ONE_ON_ONE_COACHING',
    consentedAt: yesterday,
    handlingRestrictions: [],
    treatAllergenExclusions: [],
    allowOffLeashControlledArea: true,
    emergencyVetCareAuthorized: true,
    photoVideoEvidenceConsent: true,
    marketingMediaConsent: false,
    status: 'ACTIVE',
    signatureText: 'Elena Vance - Electronic Signature',
    createdAt: yesterday,
    updatedAt: now,
  });

  store.saveRelationship({
    relationshipId: simbaRelId,
    businessId: SEED_TRAINER_IDS.APEX_K9_ACADEMY,
    primaryTrainerId: SEED_TRAINER_IDS.LEAD_TRAINER_JUMA,
    assignedAssistantTrainerIds: [],
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    petId: SEED_TRAINER_IDS.PET_SIMBA,
    status: 'ACTIVE',
    relationshipType: 'ONE_ON_ONE_COACHING',
    activeGrantId: simbaGrantId,
    activeConsentId: simbaConsentId,
    startDate: yesterday,
    createdAt: yesterday,
    updatedAt: now,
  });

  store.saveQueueItem({
    queueItemId: asTrainerWorkQueueItemId('tqi-01952000-0000-7000-8000-000000000003'),
    businessId: SEED_TRAINER_IDS.APEX_K9_ACADEMY,
    assignedTrainerId: SEED_TRAINER_IDS.LEAD_TRAINER_JUMA,
    petId: SEED_TRAINER_IDS.PET_SIMBA,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    clientName: 'Elena Vance',
    petName: 'Simba',
    itemType: 'ASSESSMENT_DUE',
    status: 'PENDING',
    priority: 'HIGH',
    dueAt: nextWeek,
    notes: 'Initial temperament test and therapy foundation assessment due.',
    createdAt: yesterday,
    updatedAt: now,
  });
}
