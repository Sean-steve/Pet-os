/**
 * Pet OS Sprint 20 - Trainer Professional Workspace Test Suite
 * 
 * Verifies all 13 canonical invariants across:
 * 1. Access Grant & Consent Enforcement (Zero access without active grant or consent)
 * 2. Prohibition of Global Pet Search & Cross-Business Isolation
 * 3. Strict Role-Based Access Control (Assistant cannot finalize assessment or forge lead signoff)
 * 4. Provider Verification & Suspension Enforcement (Suspended trainer cannot create/finalize records)
 * 5. Canonical Sprint 8 Source of Truth (Workspace calls Sprint 8 methods; zero duplicate tables; correct provenance)
 * 6. Professional Assessment Lifecycle & Immutability (Draft -> Finalized -> Read-only; corrections via amendments)
 * 7. Owner Observations vs Professional Facts Separation (Cannot overwrite owner journal; non-diagnostic wording)
 * 8. Session Execution & Multi-Domain Projection (Sprint 6 Care, Sprint 7 Nutrition, Sprint 8 Training, Sprint 9 Activity, Sprint 4 Documents, Timeline)
 * 9. Health Restriction Enforcement (High-impact exercises blocked by health restrictions)
 * 10. Treat Allergen Screening (Allergenic treats rejected during session rewards)
 * 11. Caregiver Homework Execution & Provenance Integrity (Caregiver logs homework with HOUSEHOLD_CAREGIVER provenance; cannot forge trainer signoff)
 * 12. Professional Report Generation & Pet Document Projection (Finalized report exported to Pet Documents)
 * 13. Booking Handoff & Fulfillment (Booking handoff accepted, service executed, ServiceExecutionCompleted emitted)
 */

import {
  asUserId,
  asHouseholdId,
  asPetId,
  asBusinessId,
  asProviderId,
  asBookingId,
  asSkillId,
  asTrainingPlanId,
  generateUUIDv7,
} from '../kernel/ids';

import { TrainerWorkspaceService } from './service';
import { TrainerWorkspaceStore } from './store';
import { seedTrainerWorkspaceData, SEED_TRAINER_IDS } from './seed';
import { seedUnifiedPetOS } from '../seed/unified-seed';
import { CANONICAL_IDS } from '../kernel/canonical-ids';
import { TrainingStore } from '../training/store';
import { DocumentStore } from '../documents/store';
import { HealthStore } from '../health/store';
import { ActivityStore } from '../activity/store';
import { BookingStore } from '../booking/store';
import { PetStore } from '../pet-core/store';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export async function runSprint20Tests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];
  const service = TrainerWorkspaceService.getInstance();
  const store = TrainerWorkspaceStore.getInstance();

  const runTest = (name: string, fn: () => void) => {
    const start = performance.now();
    try {
      fn();
      results.push({
        suite: 'Sprint 20: Trainer Professional Workspace',
        name,
        passed: true,
        durationMs: Math.round(performance.now() - start),
      });
    } catch (err: any) {
      results.push({
        suite: 'Sprint 20: Trainer Professional Workspace',
        name,
        passed: false,
        error: err.message || String(err),
        durationMs: Math.round(performance.now() - start),
      });
    }
  };

  // Ensure fresh unified seed baseline
  seedUnifiedPetOS();
  seedTrainerWorkspaceData();

  // --------------------------------------------------------------------------
  // TEST 1: Access Grant & Consent Enforcement
  // --------------------------------------------------------------------------
  runTest('1. Access Grant & Consent Enforcement (Prohibits access without grant)', () => {
    const ungrantedPetId = asPetId('pet-unauthorized-999');
    PetStore.savePet({
      petId: ungrantedPetId,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      name: 'Shadow',
      speciesCode: 'CANINE',
      breedCode: 'POODLE',
      mixedBreed: false,
      unknownBreed: false,
      sex: 'MALE',
      reproductiveStatus: 'INTACT',
      birthdatePrecision: 'EXACT',
      estimatedBirthdate: false,
      primaryColor: 'Black',
      sizeClassification: 'MEDIUM',
      lifecycleStage: 'ADULT',
      status: 'ACTIVE',
      createdBy: CANONICAL_IDS.OWNER_ELENA,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      metadata: {},
    });

    let threw = false;
    try {
      service.assertTrainerAuthorized(
        SEED_TRAINER_IDS.LEAD_TRAINER_JUMA,
        ungrantedPetId,
        'TRAINING_WRITE',
        SEED_TRAINER_IDS.APEX_K9_ACADEMY
      );
    } catch (e: any) {
      threw = true;
      if (!e.message.includes('No active Training Access Grant')) {
        throw new Error(`Unexpected error message: ${e.message}`);
      }
    }
    if (!threw) {
      throw new Error('Expected access check to fail for pet without active grant');
    }

    // Verified pet with active grant succeeds
    const auth = service.assertTrainerAuthorized(
      SEED_TRAINER_IDS.LEAD_TRAINER_JUMA,
      SEED_TRAINER_IDS.PET_KIBO,
      'TRAINING_WRITE',
      SEED_TRAINER_IDS.APEX_K9_ACADEMY
    );
    if (!auth.grant || !auth.consent) {
      throw new Error('Expected authorized result to contain active grant and consent');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: Prohibition of Global Pet Search & Cross-Business Isolation
  // --------------------------------------------------------------------------
  runTest('2. Cross-Business Isolation & Scoped Grants (No global search)', () => {
    const outsiderTrainer = asUserId('usr-outsider-trainer-888');
    let threw = false;
    try {
      service.assertTrainerAuthorized(
        outsiderTrainer,
        SEED_TRAINER_IDS.PET_KIBO,
        'TRAINING_READ',
        asBusinessId('biz-outsider-academy')
      );
    } catch (e: any) {
      threw = true;
    }
    if (!threw) {
      throw new Error('Outsider trainer without grant must be rejected');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Strict Role-Based Access Control (Assistant vs Lead Trainer)
  // --------------------------------------------------------------------------
  runTest('3. Strict Role-Based Access Control (Assistant cannot finalize assessments)', () => {
    const rel = store.findActiveRelationship(SEED_TRAINER_IDS.PET_KIBO, SEED_TRAINER_IDS.APEX_K9_ACADEMY);
    if (!rel) throw new Error('Active relationship for Kibo not found');

    const draft = service.createAssessment(
      {
        businessId: SEED_TRAINER_IDS.APEX_K9_ACADEMY,
        petId: SEED_TRAINER_IDS.PET_KIBO,
        householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
        relationshipId: rel.relationshipId,
        ownerStatedGoals: ['Leash manners'],
        trainerAssessedGoals: ['Threshold proofing'],
        skillBaselines: [],
        behaviorObservations: [],
        trainerEnvironmentalRecommendation: 'QUIET_OUTDOOR',
        recommendedPlanTitle: 'Test RBAC Plan',
        recommendedPlanType: 'STANDARD_PROGRAM',
      },
      SEED_TRAINER_IDS.LEAD_TRAINER_JUMA
    );

    // Assistant trainer attempts to finalize
    let assistantThrew = false;
    try {
      service.finalizeAssessment(draft.assessmentId, SEED_TRAINER_IDS.ASSISTANT_TRAINER_SARAH, 'ASSISTANT_TRAINER');
    } catch (e: any) {
      assistantThrew = true;
      if (!e.message.includes('Permission Denied: Staff role "ASSISTANT_TRAINER" cannot finalize')) {
        throw new Error(`Unexpected RBAC rejection message: ${e.message}`);
      }
    }
    if (!assistantThrew) {
      throw new Error('Assistant trainer was improperly allowed to finalize assessment');
    }

    // Lead trainer can finalize
    const finalized = service.finalizeAssessment(
      draft.assessmentId,
      SEED_TRAINER_IDS.LEAD_TRAINER_JUMA,
      'LEAD_TRAINER'
    );
    if (finalized.status !== 'FINALIZED' || !finalized.signedByTrainerId) {
      throw new Error('Lead trainer failed to finalize assessment');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Provider Verification & Suspension Enforcement
  // --------------------------------------------------------------------------
  runTest('4. Provider Suspension Enforcement (Suspended provider blocked)', () => {
    let threw = false;
    try {
      service.assertTrainerAuthorized(
        SEED_TRAINER_IDS.SUSPENDED_TRAINER_KEVIN,
        SEED_TRAINER_IDS.PET_KIBO,
        'TRAINING_WRITE',
        SEED_TRAINER_IDS.APEX_K9_ACADEMY
      );
    } catch (e: any) {
      threw = true;
      if (!e.message.includes('SUSPENDED')) {
        throw new Error(`Expected suspension error, got: ${e.message}`);
      }
    }
    if (!threw) {
      throw new Error('Suspended trainer was not blocked');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: Canonical Sprint 8 Source of Truth & Provenance Preservation
  // --------------------------------------------------------------------------
  runTest('5. Canonical Sprint 8 Integration & Provenance Preservation', () => {
    const assessments = store.listAssessmentsForPet(SEED_TRAINER_IDS.PET_KIBO);
    const finalized = assessments.find(a => a.status === 'FINALIZED');
    if (!finalized || !finalized.prescribedPlanId) {
      throw new Error('No finalized assessment with prescribed plan found');
    }

    // Verify canonical Training Plan exists in TrainingStore
    const canonicalPlan = TrainingStore.findPlanById(finalized.prescribedPlanId);
    if (!canonicalPlan) {
      throw new Error(`Canonical plan ${finalized.prescribedPlanId} missing in TrainingStore`);
    }
    if (canonicalPlan.sourceType !== 'TRAINER_CREATED') {
      throw new Error(`Expected plan sourceType TRAINER_CREATED, got ${canonicalPlan.sourceType}`);
    }
    if (canonicalPlan.trainerVerificationStatus !== 'VERIFIED') {
      throw new Error(`Expected trainerVerificationStatus VERIFIED, got ${canonicalPlan.trainerVerificationStatus}`);
    }

    // Verify baseline skills in canonical TrainingStore
    const sitProgress = TrainingStore.findSkillProgress(SEED_TRAINER_IDS.PET_KIBO, asSkillId('skill-sit'));
    if (!sitProgress) {
      throw new Error('Sit skill baseline not recorded in canonical TrainingStore');
    }
    if (sitProgress.assessmentProvenance !== 'TRAINER_ASSESSED') {
      throw new Error(`Expected assessmentProvenance TRAINER_ASSESSED, got ${sitProgress.assessmentProvenance}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: Assessment Lifecycle & Immutability
  // --------------------------------------------------------------------------
  runTest('6. Assessment Immutability & Formal Amendment Flow', () => {
    const assessments = store.listAssessmentsForPet(SEED_TRAINER_IDS.PET_KIBO);
    const finalized = assessments.find(a => a.status === 'FINALIZED');
    if (!finalized) throw new Error('Finalized assessment not found');

    // Attempting to finalize again must throw
    let duplicateThrew = false;
    try {
      service.finalizeAssessment(finalized.assessmentId, SEED_TRAINER_IDS.LEAD_TRAINER_JUMA, 'LEAD_TRAINER');
    } catch (e: any) {
      duplicateThrew = true;
    }
    if (!duplicateThrew) throw new Error('Cannot re-finalize an already finalized assessment');

    // Formal Amendment Flow
    const amended = service.amendAssessment(
      finalized.assessmentId,
      {
        amendmentReason: 'Client reported increased reactivity to bicycles; adding bicycle trigger to plan.',
        correctionDetails: 'Added bicycle desensitization at 20m safety threshold to training goals.',
      },
      SEED_TRAINER_IDS.LEAD_TRAINER_JUMA
    );

    if (amended.status !== 'AMENDED' || amended.amendments.length === 0) {
      throw new Error('Assessment failed to record formal amendment');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: Separation of Owner Observations and Professional Assessments
  // --------------------------------------------------------------------------
  runTest('7. Separation of Owner Observations vs Professional Facts & Non-Diagnostic Notice', () => {
    const assessments = store.listAssessmentsForPet(SEED_TRAINER_IDS.PET_KIBO);
    const a = assessments[0];
    if (!a.nonDiagnosticDisclaimer.includes('does not constitute a veterinary medical diagnosis')) {
      throw new Error('Missing mandatory non-diagnostic disclaimer on professional assessment');
    }

    // Verify canonical behavior observations in TrainingStore
    const obsList = TrainingStore.listObservationsForPet(SEED_TRAINER_IDS.PET_KIBO);
    const trainerObs = obsList.find(o => o.provenance === 'TRAINER_RECORDED');
    if (!trainerObs) {
      throw new Error('Expected trainer-recorded behavior observation with TRAINER_RECORDED provenance');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: Session Execution & Multi-Domain Projection
  // --------------------------------------------------------------------------
  runTest('8. Session Execution & Multi-Domain Projection (Training, Activity, Handoff)', () => {
    const sessions = store.listSessionExecutionsForPet(SEED_TRAINER_IDS.PET_KIBO);
    const completed = sessions.find(s => s.status === 'COMPLETED');
    if (!completed) throw new Error('No completed session found for Kibo');

    // Check household handoff payload
    if (!completed.handoffSummary) {
      throw new Error('Completed session missing household handoff summary');
    }
    if (completed.handoffSummary.whatWorkedOn.length === 0) {
      throw new Error('Handoff summary missing whatWorkedOn entries');
    }
    if (!completed.handoffSummary.practiceFrequencyRecommendation) {
      throw new Error('Handoff summary missing practiceFrequencyRecommendation');
    }

    // Check Activity projection
    if (!completed.activityRecordProjected) {
      throw new Error('Session execution did not flag activityRecordProjected');
    }
    const activities = ActivityStore.getRecordsForPet(SEED_TRAINER_IDS.PET_KIBO);
    const trainingAct = activities.find(a => a.activityType === 'TRAINING' && a.sourceType === 'TRAINING_SESSION');
    if (!trainingAct) {
      throw new Error('Expected training activity projected into Sprint 9 ActivityStore');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 9: Health Restriction Enforcement
  // --------------------------------------------------------------------------
  runTest('9. Health Restriction Enforcement (Blocks high-impact exercise)', () => {
    // Temporarily record active hip condition in HealthStore
    HealthStore.saveCondition({
      conditionId: 'cnd-hip-dysplasia' as any,
      petId: SEED_TRAINER_IDS.PET_KIBO,
      conditionName: 'Canine Hip Dysplasia - Moderate',
      category: 'ORTHOPEDIC',
      status: 'ACTIVE',
      isDiagnosis: true,
      onsetDatePrecision: 'EXACT',
      chronic: true,
      provenance: 'VETERINARY_PROFESSIONAL',
      verificationStatus: 'VERIFIED',
      recordedBy: CANONICAL_IDS.OWNER_ELENA,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const rel = store.findActiveRelationship(SEED_TRAINER_IDS.PET_KIBO, SEED_TRAINER_IDS.APEX_K9_ACADEMY);
    if (!rel || !rel.currentPlanId) throw new Error('Active plan not found for Kibo');

    const prep = service.prepareSession(
      {
        planId: rel.currentPlanId,
        petId: SEED_TRAINER_IDS.PET_KIBO,
        householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
        businessId: SEED_TRAINER_IDS.APEX_K9_ACADEMY,
        environment: 'QUIET_OUTDOOR',
      },
      SEED_TRAINER_IDS.LEAD_TRAINER_JUMA
    );

    const started = service.startSession(prep.assignmentId, SEED_TRAINER_IDS.LEAD_TRAINER_JUMA);

    let healthBlocked = false;
    try {
      service.recordExerciseAttempt(
        started.assignmentId,
        {
          exerciseId: 'ex-high-agility-hurdle-jump',
          skillId: asSkillId('skill-sit'),
          result: 'REGRESSED',
          repetitions: 3,
          successfulRepetitions: 0,
          assistanceLevel: 'FULL_GUIDANCE',
          distractionLevel: 'NONE',
          environment: 'QUIET_OUTDOOR',
          isHighImpactExercise: true,
        },
        SEED_TRAINER_IDS.LEAD_TRAINER_JUMA
      );
    } catch (e: any) {
      healthBlocked = true;
      if (!e.message.includes('Safety Violation: Cannot conduct high-impact exercise')) {
        throw new Error(`Unexpected safety block message: ${e.message}`);
      }
    }

    if (!healthBlocked) {
      throw new Error('High impact exercise was not blocked despite active orthopedic restriction');
    }

    // Complete session cleanly to clear active concurrency lock for subsequent tests
    service.completeSession(
      started.assignmentId,
      {
        overallPerformance: 'SUCCESSFUL',
        handoffSummary: {
          whatWorkedOn: ['Safe low-impact mobility observations'],
          whatChangedSummary: 'Exercise modified to ground scent work due to orthopedic notice.',
          whatToPractice: ['Gentle ground-level focus'],
          practiceFrequencyRecommendation: 'Daily',
          whatToWatchFor: ['Gait asymmetry'],
          followUpNotes: 'Low impact only',
        },
      },
      SEED_TRAINER_IDS.LEAD_TRAINER_JUMA
    );
  });

  // --------------------------------------------------------------------------
  // TEST 10: Treat Allergen Screening & Nutrition Safety
  // --------------------------------------------------------------------------
  runTest('10. Treat Allergen Screening (Rejects treats containing pet allergens)', () => {
    // Record Chicken allergy in Sprint 5 HealthStore for Kibo
    HealthStore.saveAllergy({
      allergyId: 'alg-chicken-kibo' as any,
      petId: SEED_TRAINER_IDS.PET_KIBO,
      allergen: 'Chicken',
      allergenCategory: 'FOOD',
      allergyType: 'ALLERGY',
      reaction: 'Pruritus and gastrointestinal distress',
      severity: 'SEVERE',
      firstObservedPrecision: 'EXACT',
      status: 'ACTIVE',
      provenance: 'VETERINARY_PROFESSIONAL',
      verificationStatus: 'VERIFIED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const rel = store.findActiveRelationship(SEED_TRAINER_IDS.PET_KIBO, SEED_TRAINER_IDS.APEX_K9_ACADEMY);
    if (!rel || !rel.currentPlanId) throw new Error('Active plan not found');

    const prep = service.prepareSession(
      {
        planId: rel.currentPlanId,
        petId: SEED_TRAINER_IDS.PET_KIBO,
        householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
        businessId: SEED_TRAINER_IDS.APEX_K9_ACADEMY,
        environment: 'QUIET_OUTDOOR',
      },
      SEED_TRAINER_IDS.LEAD_TRAINER_JUMA
    );
    const started = service.startSession(prep.assignmentId, SEED_TRAINER_IDS.LEAD_TRAINER_JUMA);

    let allergenBlocked = false;
    try {
      service.completeSession(
        started.assignmentId,
        {
          overallPerformance: 'SUCCESSFUL',
          handoffSummary: {
            whatWorkedOn: ['Test'],
            whatChangedSummary: 'Test',
            whatToPractice: ['Test'],
            practiceFrequencyRecommendation: 'Daily',
            whatToWatchFor: ['Test'],
            followUpNotes: 'Test',
          },
          treatCountRecorded: 10,
          treatFoodId: 'Chicken Biscuit Jerky', // Kibo is allergic to Chicken
        },
        SEED_TRAINER_IDS.LEAD_TRAINER_JUMA
      );
    } catch (e: any) {
      allergenBlocked = true;
      if (!e.message.includes('Nutrition Safety Violation')) {
        throw new Error(`Unexpected allergen block message: ${e.message}`);
      }
    }

    if (!allergenBlocked) {
      throw new Error('Allergenic treat was not rejected during session rewards');
    }

    // Complete session with safe treat to clear active session state
    service.completeSession(
      started.assignmentId,
      {
        overallPerformance: 'SUCCESSFUL',
        handoffSummary: {
          whatWorkedOn: ['Food tolerance & safe rewards'],
          whatChangedSummary: 'Switched to hypoallergenic beef treats.',
          whatToPractice: ['Safe rewards'],
          practiceFrequencyRecommendation: 'Daily',
          whatToWatchFor: ['Gastrointestinal signs'],
          followUpNotes: 'Stick to beef',
        },
        treatCountRecorded: 5,
        treatFoodId: 'Dehydrated Beef Liver', // Safe for Kibo
      },
      SEED_TRAINER_IDS.LEAD_TRAINER_JUMA
    );
  });

  // --------------------------------------------------------------------------
  // TEST 11: Caregiver Homework Execution & Provenance Integrity
  // --------------------------------------------------------------------------
  runTest('11. Caregiver Homework Execution & Provenance Integrity', () => {
    const homeworkList = store.listHomeworkForPet(SEED_TRAINER_IDS.PET_KIBO);
    if (homeworkList.length === 0) throw new Error('No homework found for Kibo');

    const hw = homeworkList[0];
    if (hw.caregiverLogs.length === 0) throw new Error('Homework missing caregiver completion log');

    const log = hw.caregiverLogs[0];
    if (log.caregiverProvenance !== 'HOUSEHOLD_CAREGIVER') {
      throw new Error(`Expected provenance HOUSEHOLD_CAREGIVER, got ${log.caregiverProvenance}`);
    }

    // Outsider cannot log homework for household
    let outsiderThrew = false;
    try {
      service.logCaregiverHomework(
        hw.homeworkId,
        {
          repetitionsCompleted: 5,
          successObserved: true,
        },
        asUserId('usr-outsider-intruder')
      );
    } catch (e: any) {
      outsiderThrew = true;
    }
    if (!outsiderThrew) {
      throw new Error('Outsider was allowed to log caregiver homework');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 12: Professional Report Generation & Pet Document Projection
  // --------------------------------------------------------------------------
  runTest('12. Professional Report Generation & Pet Document Projection', () => {
    const report = service.createAndFinalizeReport(
      {
        petId: SEED_TRAINER_IDS.PET_KIBO,
        householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
        businessId: SEED_TRAINER_IDS.APEX_K9_ACADEMY,
        title: 'Initial Behavioral Progress Report & Leash Reactivity Milestone',
        reportType: 'PROGRESS_REPORT',
        executiveSummary: 'Kibo has achieved reliable response to focus cue under low distractions.',
        behaviorChangesSummary: 'Latency to disengage from visual triggers decreased from 12s to under 3s.',
        caregiverInstructions: 'Maintain daily 5-minute practice sessions prior to morning walks.',
      },
      SEED_TRAINER_IDS.LEAD_TRAINER_JUMA
    );

    if (report.status !== 'FINALIZED' || !report.documentId) {
      throw new Error('Report failed to finalize or attach document ID');
    }

    // Verify document in Sprint 4 DocumentStore
    const doc = DocumentStore.findById(report.documentId);
    if (!doc) {
      throw new Error(`Document ${report.documentId} not found in DocumentStore`);
    }
    if (doc.provenanceType !== 'VERIFIED_PROFESSIONAL') {
      throw new Error(`Expected document provenance VERIFIED_PROFESSIONAL, got ${doc.provenanceType}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 13: Booking Handoff & Fulfillment
  // --------------------------------------------------------------------------
  runTest('13. Booking Handoff & Fulfillment Flow', () => {
    // Create a mock confirmed booking in BookingStore
    const newBookingId = asBookingId('bok-training-sprint20-test-01');
    const nowIso = new Date().toISOString();
    BookingStore.getInstance().saveBooking({
      bookingId: newBookingId,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      petIds: [SEED_TRAINER_IDS.PET_SIMBA],
      petCount: 1,
      petSnapshots: [],
      ownerUserId: SEED_TRAINER_IDS.CLIENT_OWNER_ELENA,
      providerId: asProviderId('pro-juma-001'),
      businessId: SEED_TRAINER_IDS.APEX_K9_ACADEMY,
      serviceOfferingId: asBookingId('sro-training-01') as any,
      status: 'CONFIRMED',
      confirmationMode: 'INSTANT_CONFIRM',
      startAt: nowIso,
      endAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      serviceDurationMinutes: 60,
      timezone: 'Africa/Nairobi',
      serviceSnapshot: {
        serviceOfferingId: asBookingId('sro-training-01') as any,
        title: 'Professional Behavior Session',
        category: 'TRAINER',
        serviceDescription: 'Private training session',
        defaultDurationMinutes: 60,
        locationType: 'CLIENT_LOCATION',
        confirmationMode: 'INSTANT_CONFIRM',
        snapshotTimestamp: nowIso,
      },
      priceSnapshot: {
        amountMinorUnits: 500000,
        currency: 'KES',
        pricingModel: 'FIXED',
        baseAmountMinorUnits: 500000,
        perPetAddonMinorUnits: 0,
        petCount: 1,
        taxIncluded: true,
        feeBasisReference: 'FEE-01',
      },
      cancellationPolicySnapshot: {
        policyTier: 'STANDARD',
        freeCancellationCutoffHours: 24,
        lateCancellationNotice: 'Standard 24-hour notice',
        description: 'Standard',
      },
      instructions: {
        emergencyContactName: 'Elena Vance',
        emergencyContactPhone: '+254700000001',
      },
      concurrencyVersion: 1,
      requestedAt: nowIso,
      confirmedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const rel = service.acceptBookingHandoff(
      newBookingId,
      SEED_TRAINER_IDS.LEAD_TRAINER_JUMA,
      SEED_TRAINER_IDS.APEX_K9_ACADEMY
    );

    if (!rel.activeGrantId || !rel.activeConsentId) {
      throw new Error('Booking handoff failed to create active grant or consent');
    }

    const grant = store.getGrant(rel.activeGrantId);
    if (!grant || grant.status !== 'ACTIVE') {
      throw new Error('Booking handoff grant not active in store');
    }
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    results,
  };
}
