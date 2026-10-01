/**
 * Pet OS Sprint 9 - Activity, Exercise & Daily Care Test Suite
 * Validates domain rules, concurrency guards, duplicate execution prevention,
 * veterinary restriction constraints, daily care aggregation, and auditability.
 */

import {
  asPetId,
  asHouseholdId,
  asUserId,
  asActivitySessionId,
  asActivityOccurrenceId,
  asActivityGoalId,
  asConditionId,
  generateUUIDv7
} from '../kernel/ids';
import { PetStore } from '../pet-core/store';
import { IdentityStore } from '../identity/store';
import { HealthStore } from '../health/store';
import { ActivityStore } from './store';
import { ActivityService } from './service';
import { seedActivityData } from './seed';

export function runActivityTests(): { passed: number; failed: number; errors: string[] } {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
    } catch (err: any) {
      failed++;
      errors.push(`[FAILED] ${name}: ${err.message || String(err)}`);
    }
  }

  // Common IDs from identity/pet-core
  const householdId = asHouseholdId('hh-01951500-0000-7000-8000-000000000001');
  const otherHouseholdId = asHouseholdId('hh-01951500-0000-7000-8000-000000000099');
  const maxPetId = asPetId('pet-01951500-0000-7000-8000-000000000001');
  const seanUserId = asUserId('usr-01951500-0000-7000-8000-000000000001');
  const sarahUserId = asUserId('usr-01951500-0000-7000-8000-000000000002');
  const foreignUserId = asUserId('usr-01951500-0000-7000-8000-000000000099');

  // Setup seed
  ActivityStore.resetForTesting();
  seedActivityData();

  // Test 1: Record Manual Walk
  test('Records manual walk with distance and pacing', () => {
    const record = ActivityService.recordActivity(
      {
        petId: maxPetId,
        householdId,
        activityType: 'WALK',
        sourceType: 'OWNER_RECORDED',
        startedAt: '2026-04-10T09:00:00.000Z',
        endedAt: '2026-04-10T09:30:00.000Z',
        durationSeconds: 1800,
        distanceValue: 2.1,
        distanceUnit: 'KILOMETERS',
        distanceSource: 'GPS_MEASURED',
        intensity: 'MODERATE',
        walkDetails: {
          leashStatus: 'ON_LEASH',
          walkPurpose: 'EXERCISE',
          pacing: 'BRISK'
        }
      },
      seanUserId
    );

    if (!record.activityId) throw new Error('Expected activityId to be generated');
    if (record.durationSeconds !== 1800) throw new Error(`Expected 1800 seconds, got ${record.durationSeconds}`);
    if (record.distanceValue !== 2.1) throw new Error(`Expected 2.1 km, got ${record.distanceValue}`);
  });

  // Test 2: Active Session Concurrency Guard (Only 1 active session per pet)
  test('Enforces concurrency guard: rejects concurrent active sessions for the same pet', () => {
    // 1. Start session 1
    const session1 = ActivityService.startActivitySession(
      {
        petId: maxPetId,
        householdId,
        activityType: 'WALK',
        notes: 'Sean starting morning walk'
      },
      seanUserId
    );

    if (session1.status !== 'ACTIVE') throw new Error('Expected session 1 to be ACTIVE');

    // 2. Sarah attempts to start concurrent session for the same pet
    let threwConflict = false;
    try {
      ActivityService.startActivitySession(
        {
          petId: maxPetId,
          householdId,
          activityType: 'PLAY',
          notes: 'Sarah starting play session concurrently'
        },
        sarahUserId
      );
    } catch (err: any) {
      if (err.message.includes('CONCURRENT_SESSION_CONFLICT')) {
        threwConflict = true;
      }
    }

    if (!threwConflict) {
      throw new Error('Expected CONCURRENT_SESSION_CONFLICT when starting duplicate session for same pet');
    }

    // Clean up session 1
    ActivityService.completeActivitySession(
      {
        activitySessionId: session1.activitySessionId,
        notes: 'Walk completed'
      },
      seanUserId
    );
  });

  // Test 3: Abandoned Session Recovery (> 4 hours requires review)
  test('Flags abandoned session (> 4h) as NEEDS_REVIEW and allows owner recovery', () => {
    // Simulate session started 5 hours ago
    const fiveHoursAgo = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
    const sessionId = asActivitySessionId(generateUUIDv7());

    ActivityStore.saveSession({
      activitySessionId: sessionId,
      petId: maxPetId,
      householdId,
      activityType: 'WALK',
      startedAt: fiveHoursAgo,
      startedBy: seanUserId,
      status: 'ACTIVE',
      pausedDurationSeconds: 0,
      createdAt: fiveHoursAgo,
      updatedAt: fiveHoursAgo
    });

    let flaggedReview = false;
    try {
      ActivityService.completeActivitySession(
        {
          activitySessionId: sessionId
        },
        seanUserId
      );
    } catch (err: any) {
      if (err.message.includes('ABANDONED_SESSION_REVIEW_REQUIRED')) {
        flaggedReview = true;
      }
    }

    if (!flaggedReview) {
      throw new Error('Expected ABANDONED_SESSION_REVIEW_REQUIRED for session running > 4 hours');
    }

    const session = ActivityStore.getSession(sessionId);
    if (session?.status !== 'NEEDS_REVIEW') {
      throw new Error(`Expected status NEEDS_REVIEW, got ${session?.status}`);
    }

    // Owner reviews and enters corrected duration: 30 minutes
    const recovered = ActivityService.recoverAbandonedSession(
      {
        activitySessionId: sessionId,
        actualDurationSeconds: 1800,
        reviewNotes: 'Forgot to stop timer when returning home. Walk was 30 mins.'
      },
      seanUserId
    );

    if (recovered.session.status !== 'COMPLETED') {
      throw new Error('Expected recovered session status to be COMPLETED');
    }
    if (recovered.record.durationSeconds !== 1800) {
      throw new Error(`Expected record duration 1800s, got ${recovered.record.durationSeconds}`);
    }
  });

  // Test 4: Duplicate Care Execution Protection
  test('Prevents duplicate execution on scheduled routine occurrence', () => {
    const routine = ActivityService.createRoutine(
      {
        petId: maxPetId,
        householdId,
        title: 'Midday Stroll',
        activityType: 'WALK',
        targetDurationMinutes: 20,
        targetTimeOfDay: '12:00',
        recurrenceRule: { frequency: 'DAILY', interval: 1 }
      },
      seanUserId
    );

    const occurrences = ActivityStore.getOccurrencesForPet(maxPetId).filter(
      o => o.routineId === routine.routineId
    );
    if (occurrences.length === 0) throw new Error('Expected occurrences to be created');

    const targetOcc = occurrences[0];

    // Sean completes the occurrence
    const comp1 = ActivityService.completeRoutineOccurrence(
      {
        occurrenceId: targetOcc.occurrenceId,
        durationSeconds: 1200,
        notes: 'Completed by Sean'
      },
      seanUserId
    );

    if (comp1.occurrence.status !== 'COMPLETED') {
      throw new Error('Expected occurrence to be COMPLETED');
    }

    // Sarah attempts to complete the same occurrence concurrently
    let threwDuplicateConflict = false;
    try {
      ActivityService.completeRoutineOccurrence(
        {
          occurrenceId: targetOcc.occurrenceId,
          durationSeconds: 1200,
          notes: 'Sarah attempting to log same walk'
        },
        sarahUserId
      );
    } catch (err: any) {
      if (err.message.includes('DUPLICATE_CARE_EXECUTION')) {
        threwDuplicateConflict = true;
      }
    }

    if (!threwDuplicateConflict) {
      throw new Error('Expected DUPLICATE_CARE_EXECUTION conflict error when completing already-completed occurrence');
    }
  });

  // Test 5: Medical Restriction Safety (Constraints on Activity Goals)
  test('Constrains activity goals when pet has active orthopedic condition or rest orders', () => {
    // 1. Create active orthopedic condition in HealthStore for Max
    HealthStore.saveCondition({
      conditionId: asConditionId(generateUUIDv7()),
      petId: maxPetId,
      isDiagnosis: true,
      conditionName: 'Canine Hip Dysplasia - Post Exertion Rest Required',
      category: 'ORTHOPEDIC',
      status: 'ACTIVE',
      onsetDate: '2026-03-01',
      onsetDatePrecision: 'EXACT',
      description: 'Veterinary discharge restriction: limit walks to 15 minutes, no strenuous fetch.',
      chronic: true,
      provenance: 'VETERINARY_PROFESSIONAL',
      verificationStatus: 'VERIFIED',
      recordedBy: seanUserId,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z'
    });

    // 2. Attempt to create high-target activity goal
    const goal = ActivityService.createGoal(
      {
        petId: maxPetId,
        householdId,
        title: 'Intense Endurance Goal',
        metricType: 'ACTIVE_MINUTES',
        targetValue: 120,
        unit: 'MINUTES',
        period: 'DAILY'
      },
      seanUserId
    );

    if (!goal.isMedicallyConstrained) {
      throw new Error('Expected goal to be flagged as isMedicallyConstrained: true');
    }
    if (goal.status !== 'CONSTRAINED') {
      throw new Error(`Expected goal status CONSTRAINED, got ${goal.status}`);
    }
    if (!goal.medicalRestrictionReason?.includes('Canine Hip Dysplasia')) {
      throw new Error(`Expected medical restriction reason to mention condition, got: ${goal.medicalRestrictionReason}`);
    }
  });

  // Test 6: Factual Distance Transparency in Weekly Summary
  test('Transparently reports measured distance vs duration-only walks without synthetic health scores', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const summary = ActivityService.getWeeklyActivitySummary(maxPetId, householdId, todayStr, seanUserId);

    if (typeof summary.totalDistanceRecordedKm !== 'number') {
      throw new Error('Expected totalDistanceRecordedKm to be a number');
    }
    if (!summary.distanceTransparencyNotice) {
      throw new Error('Expected distanceTransparencyNotice explaining measured vs unmeasured walks');
    }
    if (!summary.scientificDisclaimer.includes('does not produce algorithmic health scores')) {
      throw new Error('Expected scientific disclaimer rejecting synthetic health scores');
    }
  });

  // Test 7: Daily Care Aggregator
  test('Aggregates multi-domain daily care responsibilities (Activity + Nutrition + Care)', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const items = ActivityService.getDailyCareItems(maxPetId, householdId, todayStr, seanUserId);

    if (items.length === 0) {
      throw new Error('Expected daily care items to be aggregated for today');
    }

    const activityItem = items.find(i => i.sourceDomain === 'ACTIVITY');
    if (!activityItem) throw new Error('Expected at least one ACTIVITY task');
  });

  // Test 8: Household Care Summary ("Who did what today?")
  test('Generates household execution summary with per-member completed tasks', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const summary = ActivityService.getHouseholdCareSummary(householdId, todayStr, seanUserId);

    if (summary.memberBreakdown.length === 0) {
      throw new Error('Expected memberBreakdown in HouseholdCareSummary');
    }
    if (typeof summary.completionRatePercent !== 'number') {
      throw new Error('Expected completionRatePercent');
    }
  });

  // Test 9: Caregiver Handoff Summary
  test('Generates caregiver handoff summary with active medical restrictions and remaining tasks', () => {
    const handoff = ActivityService.getCaregiverHandoffSummary(maxPetId, householdId, sarahUserId);

    if (!handoff.petName) throw new Error('Expected petName in handoff summary');
    if (handoff.activeMedicalRestrictions.length === 0) {
      throw new Error('Expected active medical restrictions to be listed');
    }
    if (!handoff.emergencyContact.primaryOwnerName) {
      throw new Error('Expected emergency contact');
    }
  });

  // Test 10: Training Session Integration
  test('Idempotently handles TrainingSessionCompleted event to record activity', () => {
    const sessionId = `trn-${generateUUIDv7()}`;
    const record = ActivityService.handleTrainingSessionCompleted({
      sessionId,
      petId: maxPetId,
      householdId,
      actorUserId: seanUserId,
      actualDurationSeconds: 900,
      skillTitle: 'Loose Leash Walking Level 2'
    });

    if (record.activityType !== 'TRAINING') {
      throw new Error(`Expected activityType TRAINING, got ${record.activityType}`);
    }
    if (record.durationSeconds !== 900) {
      throw new Error(`Expected 900 seconds duration, got ${record.durationSeconds}`);
    }

    // Repeat execution should be idempotent (return same record)
    const duplicate = ActivityService.handleTrainingSessionCompleted({
      sessionId,
      petId: maxPetId,
      householdId,
      actorUserId: seanUserId,
      actualDurationSeconds: 900,
      skillTitle: 'Loose Leash Walking Level 2'
    });

    if (duplicate.activityId !== record.activityId) {
      throw new Error('Expected idempotent handling of training session event');
    }
  });

  // Test 11: Error Correction and Audit Trail
  test('Audits entered-in-error mark with immutable amendment record', () => {
    const record = ActivityService.recordActivity(
      {
        petId: maxPetId,
        householdId,
        activityType: 'PLAY',
        startedAt: '2026-04-10T10:00:00.000Z',
        endedAt: '2026-04-10T10:15:00.000Z',
        durationSeconds: 900
      },
      seanUserId
    );

    const amended = ActivityService.markActivityEnteredInError(
      record.activityId,
      'Logged under wrong pet accidentally',
      seanUserId
    );

    if (amended.verificationStatus !== 'ENTERED_IN_ERROR') {
      throw new Error('Expected verificationStatus ENTERED_IN_ERROR');
    }

    const amendments = ActivityStore.getAmendmentsForActivity(record.activityId);
    if (amendments.length === 0) {
      throw new Error('Expected audit amendment record to be created');
    }
    if (amendments[0].action !== 'ENTERED_IN_ERROR') {
      throw new Error(`Expected amendment action ENTERED_IN_ERROR, got ${amendments[0].action}`);
    }
  });

  // Test 12: Cross-household Authorization Isolation (IDOR rejection)
  test('Rejects unauthorized cross-household access', () => {
    let threwAuthError = false;
    try {
      ActivityService.recordActivity(
        {
          petId: maxPetId,
          householdId: otherHouseholdId, // Unauthorized household
          activityType: 'WALK',
          startedAt: '2026-04-10T10:00:00.000Z',
          durationSeconds: 900
        },
        foreignUserId
      );
    } catch (err: any) {
      if (err.message.includes('Access denied') || err.message.includes('Authorization failed')) {
        threwAuthError = true;
      }
    }

    if (!threwAuthError) {
      throw new Error('Expected authorization failure when logging activity for unauthorized household');
    }
  });

  // Re-seed demo data for UI presentation
  seedActivityData();

  return { passed, failed, errors };
}
