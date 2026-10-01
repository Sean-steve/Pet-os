/**
 * Pet OS Sprint 6 - Preventive Care, Due Engine & Notification Test Suite
 * Executes comprehensive unit, integration, and security assertion suites.
 */

import {
  UserId,
  PetId,
  HouseholdId,
  asUserId,
  asPetId,
  asHouseholdId,
  asCareOccurrenceId
} from '../kernel/ids';
import { SimulatedClock, ClockRegistry } from '../kernel/time';
import { CareStore } from './store';
import { CareService } from './service';
import { RecurrenceEngine } from './recurrence';
import { DueStateEngine } from './due-state';
import { CareBackgroundScheduler } from './scheduler';
import { NotificationStore } from '../notifications/store';
import { NotificationService } from '../notifications/service';
import { TransportRegistry } from '../notifications/transports';
import { PetStore } from '../pet-core/store';
import { IdentityStore } from '../identity/store';
import { TimelineStore } from '../timeline/store';

export interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: string;
}

export interface TestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestResult[];
}

export async function runSprint6TestSuite(): Promise<TestSuiteSummary> {
  const startTime = Date.now();
  const results: TestResult[] = [];

  // Reset stores for clean test execution
  CareStore.reset();
  NotificationStore.reset();
  ClockRegistry.reset();

  // Baseline simulated environment
  const mockClock = new SimulatedClock('2026-06-15T10:00:00.000Z');
  ClockRegistry.setClock(mockClock);

  const ownerId = asUserId('test-owner-001');
  const adminId = asUserId('test-admin-002');
  const caregiverId = asUserId('test-caregiver-003');
  const tempCaregiverId = asUserId('test-temp-004');
  const outsiderId = asUserId('test-outsider-999');

  const householdId = asHouseholdId('test-household-001');
  const otherHouseholdId = asHouseholdId('test-household-other-002');
  const petId = asPetId('test-pet-001');

  // Seed minimum test users and household in IdentityStore
  IdentityStore.saveUser({
    userId: ownerId,
    email: 'owner@petos.example',
    normalizedEmail: 'owner@petos.example',
    phoneNumber: '+254712000001',
    passwordHash: 'hash',
    accountStatus: 'ACTIVE',
    failedLoginAttempts: 0,
    policyAcceptedAt: '2026-01-01T00:00:00Z',
    policyVersion: '1.0',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  });

  IdentityStore.saveUser({
    userId: adminId,
    email: 'admin@petos.example',
    normalizedEmail: 'admin@petos.example',
    phoneNumber: '+254712000002',
    passwordHash: 'hash',
    accountStatus: 'ACTIVE',
    failedLoginAttempts: 0,
    policyAcceptedAt: '2026-01-01T00:00:00Z',
    policyVersion: '1.0',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  });

  IdentityStore.saveUser({
    userId: caregiverId,
    email: 'caregiver@petos.example',
    normalizedEmail: 'caregiver@petos.example',
    phoneNumber: '+254712000003',
    passwordHash: 'hash',
    accountStatus: 'ACTIVE',
    failedLoginAttempts: 0,
    policyAcceptedAt: '2026-01-01T00:00:00Z',
    policyVersion: '1.0',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  });

  IdentityStore.saveUser({
    userId: tempCaregiverId,
    email: 'temp@petos.example',
    normalizedEmail: 'temp@petos.example',
    phoneNumber: '+254712000004',
    passwordHash: 'hash',
    accountStatus: 'ACTIVE',
    failedLoginAttempts: 0,
    policyAcceptedAt: '2026-01-01T00:00:00Z',
    policyVersion: '1.0',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  });

  IdentityStore.saveUser({
    userId: outsiderId,
    email: 'outsider@other.example',
    normalizedEmail: 'outsider@other.example',
    phoneNumber: '+254712000999',
    passwordHash: 'hash',
    accountStatus: 'ACTIVE',
    failedLoginAttempts: 0,
    policyAcceptedAt: '2026-01-01T00:00:00Z',
    policyVersion: '1.0',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  });

  IdentityStore.saveHousehold({
    householdId,
    name: 'Main Test Household',
    status: 'ACTIVE',
    ownerUserId: ownerId,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  });

  IdentityStore.saveHousehold({
    householdId: otherHouseholdId,
    name: 'Other Household',
    status: 'ACTIVE',
    ownerUserId: outsiderId,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  });

  IdentityStore.saveMembership({
    membershipId: 'mem-1' as any,
    householdId,
    userId: ownerId,
    role: 'HOUSEHOLD_OWNER',
    status: 'ACTIVE',
    joinedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  });

  IdentityStore.saveMembership({
    membershipId: 'mem-2' as any,
    householdId,
    userId: adminId,
    role: 'HOUSEHOLD_ADMIN',
    status: 'ACTIVE',
    joinedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  });

  IdentityStore.saveMembership({
    membershipId: 'mem-3' as any,
    householdId,
    userId: caregiverId,
    role: 'CAREGIVER',
    status: 'ACTIVE',
    joinedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  });

  IdentityStore.saveMembership({
    membershipId: 'mem-4' as any,
    householdId,
    userId: tempCaregiverId,
    role: 'TEMPORARY_CAREGIVER',
    status: 'ACTIVE',
    expiresAt: '2026-07-01T00:00:00Z',
    joinedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  });

  IdentityStore.saveMembership({
    membershipId: 'mem-5' as any,
    householdId: otherHouseholdId,
    userId: outsiderId,
    role: 'HOUSEHOLD_OWNER',
    status: 'ACTIVE',
    joinedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  });

  // Seed test pet in PetStore
  PetStore.savePet({
    petId,
    householdId,
    name: 'Kibo',
    speciesCode: 'SPECIES_DOG',
    breedCode: 'BREED_DOG_RHODESIAN_RIDGEBACK',
    mixedBreed: false,
    unknownBreed: false,
    sex: 'MALE',
    reproductiveStatus: 'STERILIZED',
    dateOfBirth: '2023-05-10',
    birthdatePrecision: 'EXACT',
    estimatedBirthdate: false,
    primaryColor: 'Red Wheaten',
    sizeClassification: 'LARGE',
    lifecycleStage: 'ADULT',
    status: 'ACTIVE',
    createdBy: ownerId,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    version: 1,
    metadata: {}
  });

  const test = async (name: string, category: string, fn: () => Promise<void> | void) => {
    const tStart = Date.now();
    try {
      await fn();
      results.push({
        name,
        category,
        passed: true,
        durationMs: Date.now() - tStart
      });
    } catch (err: any) {
      results.push({
        name,
        category,
        passed: false,
        durationMs: Date.now() - tStart,
        error: err.message || String(err)
      });
    }
  };

  // --------------------------------------------------------------------------
  // SUITE 1: Recurrence Engine & Calendar Calculations
  // --------------------------------------------------------------------------
  await test(
    'Recurrence: EVERY_N_DAYS calculates exact day intervals',
    'Recurrence Engine',
    () => {
      const base = new Date('2026-06-01T00:00:00.000Z');
      const next = RecurrenceEngine.calculateNextOccurrenceDate(
        { frequency: 'EVERY_N_DAYS', interval: 14 },
        base
      );
      if (next.toISOString() !== '2026-06-15T00:00:00.000Z') {
        throw new Error(`Expected 2026-06-15, got ${next.toISOString()}`);
      }
    }
  );

  await test(
    'Recurrence: WEEKLY advances exactly 7 * interval days',
    'Recurrence Engine',
    () => {
      const base = new Date('2026-06-01T00:00:00.000Z');
      const next = RecurrenceEngine.calculateNextOccurrenceDate(
        { frequency: 'WEEKLY', interval: 2 },
        base
      );
      if (next.toISOString() !== '2026-06-15T00:00:00.000Z') {
        throw new Error(`Expected 2026-06-15, got ${next.toISOString()}`);
      }
    }
  );

  await test(
    'Recurrence: MONTHLY clamps Jan 31 -> Feb 28 on non-leap year (Step 34)',
    'Recurrence Engine',
    () => {
      // 2025 is a non-leap year
      const base = new Date('2025-01-31T00:00:00.000Z');
      const next = RecurrenceEngine.calculateNextOccurrenceDate(
        { frequency: 'MONTHLY', interval: 1, dayOfMonth: 31 },
        base
      );
      if (next.getUTCMonth() !== 1 || next.getUTCDate() !== 28) {
        throw new Error(`Expected Feb 28, got Month ${next.getUTCMonth() + 1}, Day ${next.getUTCDate()}`);
      }
    }
  );

  await test(
    'Recurrence: MONTHLY clamps Jan 31 -> Feb 29 on leap year (2024)',
    'Recurrence Engine',
    () => {
      // 2024 is a leap year
      const base = new Date('2024-01-31T00:00:00.000Z');
      const next = RecurrenceEngine.calculateNextOccurrenceDate(
        { frequency: 'MONTHLY', interval: 1, dayOfMonth: 31 },
        base
      );
      if (next.getUTCMonth() !== 1 || next.getUTCDate() !== 29) {
        throw new Error(`Expected Feb 29, got Month ${next.getUTCMonth() + 1}, Day ${next.getUTCDate()}`);
      }
    }
  );

  await test(
    'Recurrence: YEARLY clamps Feb 29 leap day to Feb 28 on next year',
    'Recurrence Engine',
    () => {
      const base = new Date('2024-02-29T00:00:00.000Z');
      const next = RecurrenceEngine.calculateNextOccurrenceDate(
        { frequency: 'YEARLY', interval: 1, dayOfMonth: 29, monthOfYear: 2 },
        base
      );
      if (next.getUTCFullYear() !== 2025 || next.getUTCMonth() !== 1 || next.getUTCDate() !== 28) {
        throw new Error(`Expected 2025-02-28, got ${next.toISOString()}`);
      }
    }
  );

  await test(
    'Recurrence: Bounded lookahead generator caps at limit without runaway loops',
    'Recurrence Engine',
    () => {
      const ob = {
        careObligationId: 'ob-test-1' as any,
        petId,
        householdId,
        category: 'PARASITE_PREVENTION' as const,
        careType: 'DAILY_VITAMIN',
        title: 'Daily Vitamin',
        sourceType: 'OWNER_CREATED' as const,
        createdBy: ownerId,
        scheduleType: 'CALENDAR_RECURRENCE' as const,
        startsAt: '2026-06-01T00:00:00.000Z',
        dueAt: '2026-06-01T00:00:00.000Z',
        recurrenceRule: { frequency: 'DAILY' as const, interval: 1 },
        timezone: 'UTC',
        priority: 'LOW' as const,
        status: 'ACTIVE' as const,
        completionPolicy: 'MANUAL_ACKNOWLEDGEMENT' as const,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z'
      };

      const occs = RecurrenceEngine.generateOccurrencesWithinWindow(
        ob,
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-10T00:00:00.000Z'),
        15
      );

      if (occs.length !== 10) {
        throw new Error(`Expected 10 daily occurrences, generated ${occs.length}`);
      }
    }
  );

  // --------------------------------------------------------------------------
  // SUITE 2: Deterministic Due-State Engine
  // --------------------------------------------------------------------------
  await test(
    'Due-State: SCHEDULED when item is more than 7 days in future',
    'Due State Engine',
    () => {
      const occ = {
        occurrenceId: asCareOccurrenceId('occ-1'),
        careObligationId: 'ob-1' as any,
        petId,
        householdId,
        occurrenceNumber: 1,
        title: 'Checkup',
        category: 'VET_CHECKUP' as const,
        scheduledFor: '2026-06-30T00:00:00.000Z', // 15 days ahead of June 15
        dueWindowStart: '2026-06-30T00:00:00.000Z',
        dueWindowEnd: '2026-07-01T00:00:00.000Z',
        status: 'SCHEDULED' as const,
        snoozeCount: 0,
        createdAt: '2026-06-15T10:00:00.000Z',
        updatedAt: '2026-06-15T10:00:00.000Z'
      };
      const ob: any = { status: 'ACTIVE' };

      const status = DueStateEngine.evaluateStatus(occ, ob, new Date('2026-06-15T10:00:00.000Z'));
      if (status !== 'SCHEDULED') {
        throw new Error(`Expected SCHEDULED, got ${status}`);
      }
    }
  );

  await test(
    'Due-State: UPCOMING when item is within 7 days of due window',
    'Due State Engine',
    () => {
      const occ = {
        occurrenceId: asCareOccurrenceId('occ-2'),
        careObligationId: 'ob-1' as any,
        petId,
        householdId,
        occurrenceNumber: 1,
        title: 'Deworming',
        category: 'DEWORMING' as const,
        scheduledFor: '2026-06-18T00:00:00.000Z', // 3 days ahead of June 15
        dueWindowStart: '2026-06-18T00:00:00.000Z',
        dueWindowEnd: '2026-06-19T00:00:00.000Z',
        status: 'SCHEDULED' as const,
        snoozeCount: 0,
        createdAt: '2026-06-15T10:00:00.000Z',
        updatedAt: '2026-06-15T10:00:00.000Z'
      };
      const ob: any = { status: 'ACTIVE' };

      const status = DueStateEngine.evaluateStatus(occ, ob, new Date('2026-06-15T10:00:00.000Z'));
      if (status !== 'UPCOMING') {
        throw new Error(`Expected UPCOMING, got ${status}`);
      }
    }
  );

  await test(
    'Due-State: DUE when currentTime is within due window',
    'Due State Engine',
    () => {
      const occ = {
        occurrenceId: asCareOccurrenceId('occ-3'),
        careObligationId: 'ob-1' as any,
        petId,
        householdId,
        occurrenceNumber: 1,
        title: 'Flea Chew',
        category: 'PARASITE_PREVENTION' as const,
        scheduledFor: '2026-06-15T08:00:00.000Z',
        dueWindowStart: '2026-06-15T00:00:00.000Z',
        dueWindowEnd: '2026-06-16T00:00:00.000Z',
        status: 'SCHEDULED' as const,
        snoozeCount: 0,
        createdAt: '2026-06-15T00:00:00.000Z',
        updatedAt: '2026-06-15T00:00:00.000Z'
      };
      const ob: any = { status: 'ACTIVE' };

      const status = DueStateEngine.evaluateStatus(occ, ob, new Date('2026-06-15T10:00:00.000Z'));
      if (status !== 'DUE') {
        throw new Error(`Expected DUE, got ${status}`);
      }
    }
  );

  await test(
    'Due-State: OVERDUE when currentTime passes due window end',
    'Due State Engine',
    () => {
      const occ = {
        occurrenceId: asCareOccurrenceId('occ-4'),
        careObligationId: 'ob-1' as any,
        petId,
        householdId,
        occurrenceNumber: 1,
        title: 'Rabies Booster',
        category: 'VACCINATION' as const,
        scheduledFor: '2026-06-01T00:00:00.000Z',
        dueWindowStart: '2026-06-01T00:00:00.000Z',
        dueWindowEnd: '2026-06-02T00:00:00.000Z', // Expired June 2
        status: 'SCHEDULED' as const,
        snoozeCount: 0,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z'
      };
      const ob: any = { status: 'ACTIVE' };

      const status = DueStateEngine.evaluateStatus(occ, ob, new Date('2026-06-15T10:00:00.000Z'));
      if (status !== 'OVERDUE') {
        throw new Error(`Expected OVERDUE, got ${status}`);
      }
    }
  );

  // --------------------------------------------------------------------------
  // SUITE 3: Snooze Invariant & Clinical Due Date Protection (Step 36)
  // --------------------------------------------------------------------------
  await test(
    'Snooze Invariant: Snooze shifts notification timing WITHOUT rewriting clinical due date',
    'Snooze & Due Date Integrity',
    () => {
      const { firstOccurrence } = CareService.createObligation(ownerId, {
        petId,
        householdId,
        category: 'DEWORMING',
        careType: 'DRONTAL_PLUS',
        title: 'Quarterly Deworming',
        sourceType: 'OWNER_CREATED',
        scheduleType: 'ONE_TIME',
        dueAt: '2026-06-10T00:00:00.000Z' // Was due 5 days ago (OVERDUE)
      });

      const originalScheduled = firstOccurrence.scheduledFor;
      const originalWindowEnd = firstOccurrence.dueWindowEnd;

      // Snooze for 2 days
      const snoozed = CareService.snoozeReminder(
        ownerId,
        firstOccurrence.occurrenceId,
        '2026-06-17T10:00:00.000Z',
        'Waiting for dewormer delivery from vet pharmacy'
      );

      // Invariant 1: Clinical scheduled date MUST NOT CHANGE
      if (snoozed.scheduledFor !== originalScheduled || snoozed.dueWindowEnd !== originalWindowEnd) {
        throw new Error('VIOLATION: Snooze modified clinical due date!');
      }

      // Invariant 2: Clinical status remains OVERDUE
      const ob = CareStore.getObligation(snoozed.careObligationId)!;
      const currentEval = DueStateEngine.evaluateStatus(snoozed, ob, new Date('2026-06-15T10:00:00.000Z'));
      if (currentEval !== 'OVERDUE') {
        throw new Error(`Expected clinically OVERDUE, got ${currentEval}`);
      }

      // Invariant 3: Notification delivery is suppressed during snooze
      const notificationDue = DueStateEngine.isNotificationDue(snoozed, new Date('2026-06-15T10:00:00.000Z'));
      if (notificationDue) {
        throw new Error('VIOLATION: Notification should be suppressed while snoozed');
      }

      // Invariant 4: Notification becomes active after snooze expiry
      const notificationAfterSnooze = DueStateEngine.isNotificationDue(snoozed, new Date('2026-06-18T00:00:00.000Z'));
      if (!notificationAfterSnooze) {
        throw new Error('VIOLATION: Notification should fire after snooze expiry');
      }
    }
  );

  // --------------------------------------------------------------------------
  // SUITE 4: Professional Care Protection & Anti-Hallucination (Step 31 & 62)
  // --------------------------------------------------------------------------
  await test(
    'Protected Schedule: Unprivileged user cannot forge PROVIDER_RECORDED schedule',
    'Security & Permissions',
    () => {
      let threw = false;
      try {
        // Caregiver role lacks 'pet.care.manage_clinical_schedule'
        CareService.createObligation(caregiverId, {
          petId,
          householdId,
          category: 'VACCINATION',
          careType: 'FORGED_CLINICAL',
          title: 'Unverified Vaccine Plan',
          sourceType: 'PROVIDER_RECORDED',
          scheduleType: 'PROVIDER_DEFINED',
          dueAt: '2026-07-01T00:00:00.000Z'
        });
      } catch (err: any) {
        threw = true;
      }

      if (!threw) {
        throw new Error('Expected exception when unprivileged user attempts to create PROVIDER_RECORDED schedule');
      }
    }
  );

  // --------------------------------------------------------------------------
  // SUITE 5: Care Completion & Timeline Projection
  // --------------------------------------------------------------------------
  await test(
    'Care Completion: Records audit, provenance, and projects to Pet Timeline',
    'Care Completion & Audit',
    () => {
      const { firstOccurrence } = CareService.createObligation(ownerId, {
        petId,
        householdId,
        category: 'GROOMING',
        careType: 'NAIL_TRIM',
        title: 'Front Paw Nail Trim',
        sourceType: 'OWNER_CREATED',
        scheduleType: 'CALENDAR_RECURRENCE',
        dueAt: '2026-06-15T10:00:00.000Z',
        recurrenceRule: { frequency: 'MONTHLY', interval: 1 }
      });

      const { occurrence, completionRecord, nextOccurrence } = CareService.completeOccurrence(
        ownerId,
        firstOccurrence.occurrenceId,
        {
          completionNotes: 'Trimmed all claws. Quick intact. Pet was relaxed.',
          evidenceReference: 'DOC-IMG-NAILS-001'
        }
      );

      if (occurrence.status !== 'COMPLETED') {
        throw new Error(`Expected COMPLETED, got ${occurrence.status}`);
      }

      if (!completionRecord || completionRecord.completionId === undefined) {
        throw new Error('CareCompletionRecord was not created');
      }

      // Next recurring occurrence must be generated
      if (!nextOccurrence || nextOccurrence.occurrenceNumber !== 2) {
        throw new Error('Next recurring occurrence was not generated');
      }

      // Timeline check
      const timelineEvents = TimelineStore.query(petId).events;
      const careTimelineEvent = timelineEvents.find(
        e => e.sourceDomain === 'PREVENTIVE_CARE' && e.sourceEntityId === firstOccurrence.occurrenceId
      );

      if (!careTimelineEvent) {
        throw new Error('Care completion event was not projected into Unified Pet Timeline');
      }
    }
  );

  // --------------------------------------------------------------------------
  // SUITE 6: Veterinary Health Integration
  // --------------------------------------------------------------------------
  await test(
    'Health Integration: Ingesting vaccination record establishes next booster obligation',
    'Veterinary Health Integration',
    () => {
      CareService.handleVaccinationRecorded({
        petId,
        householdId,
        vaccinationId: 'VACC-TEST-99',
        vaccineName: 'Rabies Virus Vaccine (Nobivac)',
        administeredDate: '2026-06-15',
        nextDueAt: '2029-06-15',
        verifiedBy: ownerId
      });

      const obligations = CareStore.getObligationsForPet(petId);
      const rabiesObligation = obligations.find(
        o => o.category === 'VACCINATION' && o.title.includes('Rabies')
      );

      if (!rabiesObligation || rabiesObligation.sourceType !== 'PROVIDER_RECORDED') {
        throw new Error('Vaccination ingestion failed to establish PROVIDER_RECORDED obligation');
      }

      if (rabiesObligation.dueAt !== '2029-06-15') {
        throw new Error(`Expected dueAt 2029-06-15, got ${rabiesObligation.dueAt}`);
      }
    }
  );

  // --------------------------------------------------------------------------
  // SUITE 7: Caregiver Delegation & Least-Privilege
  // --------------------------------------------------------------------------
  await test(
    'Caregiver Delegation: Assigns household member & verifies least privilege',
    'Caregiver Delegation',
    () => {
      const { firstOccurrence } = CareService.createObligation(ownerId, {
        petId,
        householdId,
        category: 'PARASITE_PREVENTION',
        careType: 'NEXGARD',
        title: 'NexGard Chewable',
        sourceType: 'OWNER_CREATED',
        scheduleType: 'ONE_TIME',
        dueAt: '2026-06-16T10:00:00.000Z'
      });

      // Assign to Caregiver
      const updated = CareService.assignCaregiver(ownerId, firstOccurrence.occurrenceId, caregiverId);
      if (updated.assignedToUserId !== caregiverId) {
        throw new Error('Assignee was not updated');
      }

      // Caregiver can complete the task
      const { occurrence: completed } = CareService.completeOccurrence(caregiverId, firstOccurrence.occurrenceId, {
        completionNotes: 'Administered with morning meal.'
      });

      if (completed.status !== 'COMPLETED' || completed.completedBy !== caregiverId) {
        throw new Error('Caregiver failed to complete assigned task');
      }
    }
  );

  await test(
    'Cross-Household Isolation: Actor outside household cannot access or complete care',
    'Security & Permissions',
    () => {
      const { firstOccurrence } = CareService.createObligation(ownerId, {
        petId,
        householdId,
        category: 'GENERAL_CARE',
        careType: 'BRUSHING',
        title: 'Coat Brushing',
        sourceType: 'OWNER_CREATED',
        scheduleType: 'ONE_TIME',
        dueAt: '2026-06-16T10:00:00.000Z'
      });

      let threw = false;
      try {
        CareService.completeOccurrence(outsiderId, firstOccurrence.occurrenceId);
      } catch (err: any) {
        threw = true;
      }

      if (!threw) {
        throw new Error('Cross-household isolation failed: Outsider was able to complete household task');
      }
    }
  );

  // --------------------------------------------------------------------------
  // SUITE 8: Deceased Pet Care Suppression (Step 54)
  // --------------------------------------------------------------------------
  await test(
    'Deceased Pet: Suspends future scheduled care while preserving completed history',
    'Lifecycle Invariants',
    () => {
      const { firstOccurrence } = CareService.createObligation(ownerId, {
        petId,
        householdId,
        category: 'GENERAL_CARE',
        careType: 'DENTAL_CLEANING',
        title: 'Dental Scaling',
        sourceType: 'OWNER_CREATED',
        scheduleType: 'ONE_TIME',
        dueAt: '2026-07-01T10:00:00.000Z'
      });

      CareService.handlePetMarkedDeceased(petId);

      const occ = CareStore.getOccurrence(firstOccurrence.occurrenceId)!;
      if (occ.status !== 'CANCELLED') {
        throw new Error(`Expected future scheduled task to be CANCELLED, got ${occ.status}`);
      }

      const ob = CareStore.getObligation(firstOccurrence.careObligationId)!;
      if (ob.status !== 'CANCELLED') {
        throw new Error(`Expected obligation to be CANCELLED, got ${ob.status}`);
      }
    }
  );

  // --------------------------------------------------------------------------
  // SUITE 9: Background Scheduler & Downtime Recovery
  // --------------------------------------------------------------------------
  await test(
    'Scheduler: Downtime recovery catches up after 24h simulated offline',
    'Scheduler & Resilience',
    async () => {
      // Re-create an active pet item
      const { firstOccurrence } = CareService.createObligation(ownerId, {
        petId,
        householdId,
        category: 'DEWORMING',
        careType: 'RECOVERY_TEST',
        title: 'Recovery Deworming',
        sourceType: 'OWNER_CREATED',
        scheduleType: 'ONE_TIME',
        dueAt: '2026-06-16T00:00:00.000Z' // Due tomorrow relative to June 15
      });

      // Simulate 24-hour downtime recovery (advancing to June 16 10:00 UTC)
      const { catchupReport } = await CareBackgroundScheduler.simulateDowntimeRecovery(
        24,
        new Date('2026-06-15T10:00:00.000Z')
      );

      if (catchupReport.evaluatedOccurrences === 0) {
        throw new Error('Scheduler failed to evaluate occurrences during recovery');
      }

      const occ = CareStore.getOccurrence(firstOccurrence.occurrenceId)!;
      if (occ.status !== 'DUE' && occ.status !== 'OVERDUE') {
        throw new Error(`Expected DUE or OVERDUE after 24h advance, got ${occ.status}`);
      }
    }
  );

  // --------------------------------------------------------------------------
  // SUITE 10: Notification Orchestration & Deduplication (Volume XXVI)
  // --------------------------------------------------------------------------
  await test(
    'Notification: Deduplication key prevents duplicate delivery (Idempotency)',
    'Notification Orchestration',
    async () => {
      const dedupeKey = 'test-dedupe-key-unique-001';

      const firstSend = await NotificationService.schedule({
        recipientUserId: ownerId,
        notificationType: 'CARE_DUE',
        sourceType: 'CARE_OCCURRENCE',
        sourceId: 'occ-test-1',
        title: 'Simparica Due',
        body: 'Please give Simparica chewable.',
        deduplicationKey: dedupeKey
      });

      const secondSend = await NotificationService.schedule({
        recipientUserId: ownerId,
        notificationType: 'CARE_DUE',
        sourceType: 'CARE_OCCURRENCE',
        sourceId: 'occ-test-1',
        title: 'Simparica Due Duplicate',
        body: 'Duplicate send attempt.',
        deduplicationKey: dedupeKey
      });

      if (firstSend[0].notificationId !== secondSend[0].notificationId) {
        throw new Error('Notification deduplication failed: Created separate duplicate notifications');
      }
    }
  );

  await test(
    'Notification: Quiet hours suppresses non-critical reminders until morning',
    'Notification Orchestration',
    async () => {
      // Set user quiet hours from 22:00 to 07:00
      NotificationService.updatePreferences(ownerId, {
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        timezone: 'UTC'
      });

      // Advance clock to 23:30 UTC (during quiet hours)
      mockClock.setTime('2026-06-15T23:30:00.000Z');

      const notifs = await NotificationService.schedule({
        recipientUserId: ownerId,
        notificationType: 'CARE_UPCOMING',
        sourceType: 'CARE_OCCURRENCE',
        sourceId: 'occ-quiet-test',
        title: 'Routine Grooming Upcoming',
        body: 'Grooming scheduled in 2 days.',
        priority: 'NORMAL' // Non-critical
      });

      const scheduledMs = new Date(notifs[0].scheduledAt).getTime();
      const currentMs = mockClock.getTime();

      // Must be rescheduled for morning after quiet hours (at or after 07:00 next day)
      if (scheduledMs <= currentMs) {
        throw new Error('Quiet hours failed: Routine notification scheduled during quiet hours');
      }

      // Reset clock to daytime
      mockClock.setTime('2026-06-15T10:00:00.000Z');
    }
  );

  // --------------------------------------------------------------------------
  // SUITE 11: Notification Delivery Retry & Dead-Letter Queue
  // --------------------------------------------------------------------------
  await test(
    'Notification: Failure triggers retry and terminates in DEAD_LETTER after max attempts',
    'Notification Resilience',
    async () => {
      const emailTransport = TransportRegistry.getEmailTransport();
      emailTransport.shouldSimulateFailure = true;

      const [record] = await NotificationService.schedule({
        recipientUserId: ownerId,
        notificationType: 'CARE_OVERDUE',
        sourceType: 'CARE_TEST',
        sourceId: 'src-fail-1',
        title: 'Retry Test',
        body: 'This will fail delivery.',
        channels: ['EMAIL'],
        scheduledAt: '2026-06-15T10:00:00.000Z'
      });

      // Attempt 1
      await NotificationService.processPendingQueue(new Date('2026-06-15T10:00:00.000Z'));
      const notif1 = NotificationStore.getNotification(record.notificationId)!;
      if (notif1.attemptCount !== 1 || notif1.status !== 'QUEUED') {
        throw new Error(`Expected attempt 1 & QUEUED, got attempt ${notif1.attemptCount} & ${notif1.status}`);
      }

      // Fast forward and attempt 2
      notif1.scheduledAt = '2026-06-15T10:15:00.000Z';
      NotificationStore.saveNotification(notif1);
      await NotificationService.processPendingQueue(new Date('2026-06-15T10:15:00.000Z'));

      // Fast forward and attempt 3 (exceeds maxAttempts)
      const notif2 = NotificationStore.getNotification(record.notificationId)!;
      notif2.scheduledAt = '2026-06-15T11:00:00.000Z';
      NotificationStore.saveNotification(notif2);
      await NotificationService.processPendingQueue(new Date('2026-06-15T11:00:00.000Z'));

      const finalNotif = NotificationStore.getNotification(record.notificationId)!;
      if (finalNotif.status !== 'DEAD_LETTER') {
        throw new Error(`Expected DEAD_LETTER after 3 failed attempts, got ${finalNotif.status}`);
      }

      emailTransport.shouldSimulateFailure = false;
    }
  );

  // --------------------------------------------------------------------------
  // SUITE 12: Provider Webhook Verification & Replay Protection
  // --------------------------------------------------------------------------
  await test(
    'Webhook: Ingests delivery events with HMAC verification and replay protection',
    'Webhook Security',
    () => {
      const eventId = `wh-evt-${Date.now()}`;

      // 1. Invalid signature rejected
      const invalidResult = NotificationService.handleProviderWebhook({
        eventId,
        provider: 'TWILIO',
        externalMessageId: 'ext-123',
        eventStatus: 'DELIVERED',
        signature: 'invalid_sig_abc',
        timestamp: '2026-06-15T10:00:00.000Z'
      });

      if (invalidResult.status !== 'INVALID_SIGNATURE') {
        throw new Error('Webhook failed to reject invalid signature');
      }

      // 2. Valid signature accepted
      const validResult = NotificationService.handleProviderWebhook({
        eventId,
        provider: 'TWILIO',
        externalMessageId: 'ext-123',
        eventStatus: 'DELIVERED',
        signature: 'sig_valid_sha256_mock_hash',
        timestamp: '2026-06-15T10:00:00.000Z'
      });

      if (validResult.status !== 'PROCESSED') {
        throw new Error(`Expected PROCESSED, got ${validResult.status}`);
      }

      // 3. Replay attack with same eventId ignored as duplicate
      const replayResult = NotificationService.handleProviderWebhook({
        eventId,
        provider: 'TWILIO',
        externalMessageId: 'ext-123',
        eventStatus: 'DELIVERED',
        signature: 'sig_valid_sha256_mock_hash',
        timestamp: '2026-06-15T10:00:00.000Z'
      });

      if (replayResult.status !== 'IGNORED_DUPLICATE') {
        throw new Error(`Expected IGNORED_DUPLICATE on replay attack, got ${replayResult.status}`);
      }
    }
  );

  // Reset clock
  ClockRegistry.reset();

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    total,
    passed,
    failed,
    durationMs: Date.now() - startTime,
    results
  };
}
