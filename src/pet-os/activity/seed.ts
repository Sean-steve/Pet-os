/**
 * Pet OS Sprint 9 - Activity, Exercise & Daily Care Canonical Seed Data
 * Generates comprehensive records, routines, occurrences, and goals for demo & testing.
 */

import {
  PetId,
  HouseholdId,
  UserId,
  asPetId,
  asHouseholdId,
  asUserId,
  asActivityId,
  asActivityRoutineId,
  asActivityOccurrenceId,
  asActivityGoalId,
  asMembershipId,
  generateUUIDv7
} from '../kernel/ids';
import { currentClockUtcNow } from '../kernel/time';
import { IdentityStore } from '../identity/store';
import { PetStore } from '../pet-core/store';
import { ActivityStore } from './store';
import { ActivityRecord, ActivityRoutine, ActivityOccurrence, ActivityGoal } from './types';

export function seedBaselineIdentityAndPets(): void {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const householdId = asHouseholdId('hh-01951500-0000-7000-8000-000000000001');
  const otherHouseholdId = asHouseholdId('hh-01951500-0000-7000-8000-000000000099');
  const maxPetId = asPetId('pet-01951500-0000-7000-8000-000000000001');
  const lunaPetId = asPetId('pet-01951500-0000-7000-8000-000000000002');
  const seanUserId = asUserId('usr-01951500-0000-7000-8000-000000000001');
  const sarahUserId = asUserId('usr-01951500-0000-7000-8000-000000000002');
  const foreignUserId = asUserId('usr-01951500-0000-7000-8000-000000000099');

  // 1. Users
  if (!IdentityStore.findUserById(seanUserId)) {
    IdentityStore.saveUser({
      userId: seanUserId,
      email: 'sean.miller@petos.local',
      normalizedEmail: 'sean.miller@petos.local',
      passwordHash: 'hash-sean-123',
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      createdAt: `${todayStr}T00:00:00.000Z`,
      updatedAt: `${todayStr}T00:00:00.000Z`,
      policyAcceptedAt: `${todayStr}T00:00:00.000Z`,
      policyVersion: '1.0'
    });
    IdentityStore.saveProfile({
      userId: seanUserId,
      displayName: 'Sean Miller',
      firstName: 'Sean',
      lastName: 'Miller',
      locale: 'en-US',
      timezone: 'America/Los_Angeles',
      communicationPreferences: { emailNotifications: true, smsNotifications: true, emergencyAlerts: true },
      privacyPreferences: { profileVisibility: 'HOUSEHOLD_ONLY', shareActivityWithHousehold: true },
      updatedAt: `${todayStr}T00:00:00.000Z`
    });
  }

  if (!IdentityStore.findUserById(sarahUserId)) {
    IdentityStore.saveUser({
      userId: sarahUserId,
      email: 'sarah.miller@petos.local',
      normalizedEmail: 'sarah.miller@petos.local',
      passwordHash: 'hash-sarah-123',
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      createdAt: `${todayStr}T00:00:00.000Z`,
      updatedAt: `${todayStr}T00:00:00.000Z`,
      policyAcceptedAt: `${todayStr}T00:00:00.000Z`,
      policyVersion: '1.0'
    });
    IdentityStore.saveProfile({
      userId: sarahUserId,
      displayName: 'Sarah Miller',
      firstName: 'Sarah',
      lastName: 'Miller',
      locale: 'en-US',
      timezone: 'America/Los_Angeles',
      communicationPreferences: { emailNotifications: true, smsNotifications: true, emergencyAlerts: true },
      privacyPreferences: { profileVisibility: 'HOUSEHOLD_ONLY', shareActivityWithHousehold: true },
      updatedAt: `${todayStr}T00:00:00.000Z`
    });
  }

  if (!IdentityStore.findUserById(foreignUserId)) {
    IdentityStore.saveUser({
      userId: foreignUserId,
      email: 'foreign.user@petos.local',
      normalizedEmail: 'foreign.user@petos.local',
      passwordHash: 'hash-foreign-123',
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      createdAt: `${todayStr}T00:00:00.000Z`,
      updatedAt: `${todayStr}T00:00:00.000Z`,
      policyAcceptedAt: `${todayStr}T00:00:00.000Z`,
      policyVersion: '1.0'
    });
    IdentityStore.saveProfile({
      userId: foreignUserId,
      displayName: 'Foreign Visitor',
      firstName: 'Foreign',
      lastName: 'Visitor',
      locale: 'en-US',
      timezone: 'America/Los_Angeles',
      communicationPreferences: { emailNotifications: true, smsNotifications: true, emergencyAlerts: true },
      privacyPreferences: { profileVisibility: 'PRIVATE', shareActivityWithHousehold: false },
      updatedAt: `${todayStr}T00:00:00.000Z`
    });
  }

  // 2. Households
  if (!IdentityStore.findHouseholdById(householdId)) {
    IdentityStore.saveHousehold({
      householdId,
      name: 'Miller Family Residence',
      status: 'ACTIVE',
      ownerUserId: seanUserId,
      createdAt: `${todayStr}T00:00:00.000Z`,
      updatedAt: `${todayStr}T00:00:00.000Z`
    });
  }

  if (!IdentityStore.findHouseholdById(otherHouseholdId)) {
    IdentityStore.saveHousehold({
      householdId: otherHouseholdId,
      name: 'Other Family Residence',
      status: 'ACTIVE',
      ownerUserId: foreignUserId,
      createdAt: `${todayStr}T00:00:00.000Z`,
      updatedAt: `${todayStr}T00:00:00.000Z`
    });
  }

  // 3. Memberships
  const members = IdentityStore.listMembersForHousehold(householdId);
  if (!members.some(m => m.userId === seanUserId)) {
    IdentityStore.saveMembership({
      membershipId: asMembershipId('mem-01951500-0000-7000-8000-000000000001'),
      householdId,
      userId: seanUserId,
      role: 'HOUSEHOLD_OWNER',
      status: 'ACTIVE',
      joinedAt: `${todayStr}T00:00:00.000Z`,
      updatedAt: `${todayStr}T00:00:00.000Z`
    });
  }

  if (!members.some(m => m.userId === sarahUserId)) {
    IdentityStore.saveMembership({
      membershipId: asMembershipId('mem-01951500-0000-7000-8000-000000000002'),
      householdId,
      userId: sarahUserId,
      role: 'CAREGIVER',
      status: 'ACTIVE',
      joinedAt: `${todayStr}T00:00:00.000Z`,
      updatedAt: `${todayStr}T00:00:00.000Z`
    });
  }

  const otherMembers = IdentityStore.listMembersForHousehold(otherHouseholdId);
  if (!otherMembers.some(m => m.userId === foreignUserId)) {
    IdentityStore.saveMembership({
      membershipId: asMembershipId('mem-01951500-0000-7000-8000-000000000099'),
      householdId: otherHouseholdId,
      userId: foreignUserId,
      role: 'HOUSEHOLD_OWNER',
      status: 'ACTIVE',
      joinedAt: `${todayStr}T00:00:00.000Z`,
      updatedAt: `${todayStr}T00:00:00.000Z`
    });
  }

  // 4. Pets
  if (!PetStore.findPetById(maxPetId)) {
    PetStore.savePet({
      petId: maxPetId,
      householdId,
      name: 'Max',
      speciesCode: 'CANIS_LUPUS_FAMILIARIS',
      breedCode: 'GOLDEN_RETRIEVER',
      mixedBreed: false,
      unknownBreed: false,
      sex: 'MALE',
      reproductiveStatus: 'STERILIZED',
      dateOfBirth: '2021-06-15',
      birthdatePrecision: 'EXACT',
      estimatedBirthdate: false,
      primaryColor: 'Golden',
      sizeClassification: 'LARGE',
      lifecycleStage: 'ADULT',
      status: 'ACTIVE',
      createdBy: seanUserId,
      createdAt: `${todayStr}T00:00:00.000Z`,
      updatedAt: `${todayStr}T00:00:00.000Z`,
      version: 1,
      metadata: {}
    });
  }

  if (!PetStore.findPetById(lunaPetId)) {
    PetStore.savePet({
      petId: lunaPetId,
      householdId,
      name: 'Luna',
      speciesCode: 'FELIS_CATUS',
      breedCode: 'DOMESTIC_SHORTHAIR',
      mixedBreed: false,
      unknownBreed: false,
      sex: 'FEMALE',
      reproductiveStatus: 'STERILIZED',
      dateOfBirth: '2022-04-10',
      birthdatePrecision: 'EXACT',
      estimatedBirthdate: false,
      primaryColor: 'Tuxedo Black & White',
      sizeClassification: 'SMALL',
      lifecycleStage: 'ADULT',
      status: 'ACTIVE',
      createdBy: seanUserId,
      createdAt: `${todayStr}T00:00:00.000Z`,
      updatedAt: `${todayStr}T00:00:00.000Z`,
      version: 1,
      metadata: {}
    });
  }
}

export function seedActivityData(): void {
  seedBaselineIdentityAndPets();

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Canonical IDs from existing sprints
  const householdId = asHouseholdId('hh-01951500-0000-7000-8000-000000000001');
  const maxPetId = asPetId('pet-01951500-0000-7000-8000-000000000001'); // Max (Golden Retriever)
  const lunaPetId = asPetId('pet-01951500-0000-7000-8000-000000000002'); // Luna (Cat)
  const seanUserId = asUserId('usr-01951500-0000-7000-8000-000000000001'); // Sean (Owner)
  const sarahUserId = asUserId('usr-01951500-0000-7000-8000-000000000002'); // Sarah (Caregiver)

  // Skip seeding activity events if already populated
  if (ActivityStore.getRecordsForPet(maxPetId).length > 0) {
    return;
  }

  // 1. Activity Records (Historical & Today)
  const records: ActivityRecord[] = [
    {
      activityId: asActivityId(generateUUIDv7()),
      petId: maxPetId,
      householdId,
      activityType: 'WALK',
      sourceType: 'OWNER_RECORDED',
      sourceActorId: seanUserId,
      startedAt: `${todayStr}T07:15:00.000Z`,
      endedAt: `${todayStr}T07:50:00.000Z`,
      durationSeconds: 2100, // 35 mins
      distanceValue: 2.4,
      distanceUnit: 'KILOMETERS',
      distanceSource: 'GPS_MEASURED',
      intensity: 'MODERATE',
      locationContext: 'URBAN',
      walkDetails: {
        leashStatus: 'ON_LEASH',
        walkPurpose: 'EXERCISE',
        weatherConditions: 'Sunny, 18°C',
        pacing: 'BRISK'
      },
      notes: 'Morning neighborhood loop around the park. Great leash manners.',
      recordedAt: `${todayStr}T07:51:00.000Z`,
      createdBy: seanUserId,
      createdAt: `${todayStr}T07:51:00.000Z`,
      updatedAt: `${todayStr}T07:51:00.000Z`,
      verificationStatus: 'VERIFIED'
    },
    {
      activityId: asActivityId(generateUUIDv7()),
      petId: maxPetId,
      householdId,
      activityType: 'PLAY',
      sourceType: 'HOUSEHOLD_CAREGIVER',
      sourceActorId: sarahUserId,
      startedAt: `${todayStr}T12:30:00.000Z`,
      endedAt: `${todayStr}T12:50:00.000Z`,
      durationSeconds: 1200, // 20 mins
      intensity: 'HIGH',
      locationContext: 'HOME',
      playDetails: {
        playType: 'FETCH',
        toysUsed: ['Chuckit Ball', 'Rope Tug'],
        participants: ['Sarah']
      },
      notes: 'Backyard fetch session. Very enthusiastic retrieval.',
      recordedAt: `${todayStr}T12:51:00.000Z`,
      createdBy: sarahUserId,
      createdAt: `${todayStr}T12:51:00.000Z`,
      updatedAt: `${todayStr}T12:51:00.000Z`,
      verificationStatus: 'VERIFIED'
    },
    {
      activityId: asActivityId(generateUUIDv7()),
      petId: maxPetId,
      householdId,
      activityType: 'ENRICHMENT',
      sourceType: 'OWNER_RECORDED',
      sourceActorId: seanUserId,
      startedAt: `${todayStr}T15:00:00.000Z`,
      endedAt: `${todayStr}T15:25:00.000Z`,
      durationSeconds: 1500, // 25 mins
      intensity: 'LIGHT',
      locationContext: 'INDOOR',
      playDetails: {
        enrichmentType: 'PUZZLE_FEEDER',
        mentalChallengeLevel: 'MODERATE'
      },
      notes: 'KONG Wobbler and frozen lick mat. Calm and focused.',
      recordedAt: `${todayStr}T15:26:00.000Z`,
      createdBy: seanUserId,
      createdAt: `${todayStr}T15:26:00.000Z`,
      updatedAt: `${todayStr}T15:26:00.000Z`,
      verificationStatus: 'VERIFIED'
    },
    {
      activityId: asActivityId(generateUUIDv7()),
      petId: maxPetId,
      householdId,
      activityType: 'REST',
      sourceType: 'OWNER_RECORDED',
      sourceActorId: seanUserId,
      startedAt: `${todayStr}T13:00:00.000Z`,
      endedAt: `${todayStr}T14:45:00.000Z`,
      durationSeconds: 6300, // 105 mins
      intensity: 'LIGHT',
      locationContext: 'INDOOR',
      restDetails: {
        restType: 'SLEEP_CONFIRMED',
        environment: 'DOG_BED',
        isCrateRest: false,
        qualityNotes: 'Deep post-play sleep, relaxed breathing.'
      },
      notes: 'Afternoon post-exercise snooze.',
      recordedAt: `${todayStr}T14:46:00.000Z`,
      createdBy: seanUserId,
      createdAt: `${todayStr}T14:46:00.000Z`,
      updatedAt: `${todayStr}T14:46:00.000Z`,
      verificationStatus: 'VERIFIED'
    },
    {
      activityId: asActivityId(generateUUIDv7()),
      petId: lunaPetId,
      householdId,
      activityType: 'PLAY',
      sourceType: 'OWNER_RECORDED',
      sourceActorId: seanUserId,
      startedAt: `${todayStr}T08:30:00.000Z`,
      endedAt: `${todayStr}T08:45:00.000Z`,
      durationSeconds: 900, // 15 mins
      intensity: 'MODERATE',
      locationContext: 'INDOOR',
      playDetails: {
        playType: 'CHASE',
        toysUsed: ['Feather Wand'],
        enrichmentType: 'COGNITIVE'
      },
      notes: 'Interactive feather wand play. Agile leaps and stalking.',
      recordedAt: `${todayStr}T08:46:00.000Z`,
      createdBy: seanUserId,
      createdAt: `${todayStr}T08:46:00.000Z`,
      updatedAt: `${todayStr}T08:46:00.000Z`,
      verificationStatus: 'VERIFIED'
    }
  ];

  records.forEach(r => ActivityStore.saveRecord(r));

  // 2. Activity Routines
  const morningWalkRoutine: ActivityRoutine = {
    routineId: asActivityRoutineId('rtn-01951500-0000-7000-8000-000000000001'),
    petId: maxPetId,
    householdId,
    title: 'Morning Neighborhood Walk',
    activityType: 'WALK',
    description: '30-minute brisk morning stroll before breakfast.',
    targetDurationMinutes: 30,
    targetTimeOfDay: '07:30',
    assignedToUserId: seanUserId,
    recurrenceRule: { frequency: 'DAILY', interval: 1 },
    instructions: 'Use front-clip harness. Allow sniffing at designated grass verge.',
    instructionSource: 'OWNER_PREFERENCE',
    status: 'ACTIVE',
    createdBy: seanUserId,
    createdAt: `${todayStr}T06:00:00.000Z`,
    updatedAt: `${todayStr}T06:00:00.000Z`
  };

  const eveningWalkRoutine: ActivityRoutine = {
    routineId: asActivityRoutineId('rtn-01951500-0000-7000-8000-000000000002'),
    petId: maxPetId,
    householdId,
    title: 'Evening Sniffari & Leisure Walk',
    activityType: 'WALK',
    description: 'Decompressing evening stroll with loose leash exploration.',
    targetDurationMinutes: 35,
    targetTimeOfDay: '18:00',
    assignedToUserId: sarahUserId,
    recurrenceRule: { frequency: 'DAILY', interval: 1 },
    instructions: 'Leisurely pace. Avoid walking along busy high street during rush hour.',
    instructionSource: 'OWNER_PREFERENCE',
    status: 'ACTIVE',
    createdBy: seanUserId,
    createdAt: `${todayStr}T06:00:00.000Z`,
    updatedAt: `${todayStr}T06:00:00.000Z`
  };

  const middayEnrichmentRoutine: ActivityRoutine = {
    routineId: asActivityRoutineId('rtn-01951500-0000-7000-8000-000000000003'),
    petId: maxPetId,
    householdId,
    title: 'Midday Mental Enrichment',
    activityType: 'ENRICHMENT',
    description: 'Puzzle toys or scent work in the garden to satisfy working drive.',
    targetDurationMinutes: 20,
    targetTimeOfDay: '13:00',
    assignedToUserId: sarahUserId,
    recurrenceRule: { frequency: 'DAILY', interval: 1 },
    instructions: 'Hide kibble in snuffle mat or dispense frozen Kong.',
    instructionSource: 'OWNER_PREFERENCE',
    status: 'ACTIVE',
    createdBy: seanUserId,
    createdAt: `${todayStr}T06:00:00.000Z`,
    updatedAt: `${todayStr}T06:00:00.000Z`
  };

  [morningWalkRoutine, eveningWalkRoutine, middayEnrichmentRoutine].forEach(r =>
    ActivityStore.saveRoutine(r)
  );

  // 3. Occurrences for Today
  const occurrences: ActivityOccurrence[] = [
    {
      occurrenceId: asActivityOccurrenceId('occ-01951500-0000-7000-8000-000000000001'),
      routineId: morningWalkRoutine.routineId,
      petId: maxPetId,
      householdId,
      title: morningWalkRoutine.title,
      activityType: 'WALK',
      scheduledFor: `${todayStr}T07:30:00.000Z`,
      targetTimeOfDay: '07:30',
      targetDurationMinutes: 30,
      status: 'COMPLETED',
      assignedToUserId: seanUserId,
      completedAt: `${todayStr}T07:50:00.000Z`,
      completedBy: seanUserId,
      completedActivityRecordId: records[0].activityId,
      instructions: morningWalkRoutine.instructions,
      createdAt: `${todayStr}T06:00:00.000Z`,
      updatedAt: `${todayStr}T07:51:00.000Z`
    },
    {
      occurrenceId: asActivityOccurrenceId('occ-01951500-0000-7000-8000-000000000002'),
      routineId: middayEnrichmentRoutine.routineId,
      petId: maxPetId,
      householdId,
      title: middayEnrichmentRoutine.title,
      activityType: 'ENRICHMENT',
      scheduledFor: `${todayStr}T13:00:00.000Z`,
      targetTimeOfDay: '13:00',
      targetDurationMinutes: 20,
      status: 'COMPLETED',
      assignedToUserId: sarahUserId,
      completedAt: `${todayStr}T15:25:00.000Z`,
      completedBy: seanUserId,
      completedActivityRecordId: records[2].activityId,
      instructions: middayEnrichmentRoutine.instructions,
      createdAt: `${todayStr}T06:00:00.000Z`,
      updatedAt: `${todayStr}T15:26:00.000Z`
    },
    {
      occurrenceId: asActivityOccurrenceId('occ-01951500-0000-7000-8000-000000000003'),
      routineId: eveningWalkRoutine.routineId,
      petId: maxPetId,
      householdId,
      title: eveningWalkRoutine.title,
      activityType: 'WALK',
      scheduledFor: `${todayStr}T18:00:00.000Z`,
      targetTimeOfDay: '18:00',
      targetDurationMinutes: 35,
      status: 'SCHEDULED',
      assignedToUserId: sarahUserId,
      instructions: eveningWalkRoutine.instructions,
      createdAt: `${todayStr}T06:00:00.000Z`,
      updatedAt: `${todayStr}T06:00:00.000Z`
    }
  ];

  occurrences.forEach(o => ActivityStore.saveOccurrence(o));

  // 4. Activity Goals
  const dailyWalkGoal: ActivityGoal = {
    goalId: asActivityGoalId('gol-01951500-0000-7000-8000-000000000001'),
    petId: maxPetId,
    householdId,
    title: 'Daily Walks Target',
    metricType: 'WALK_COUNT',
    targetValue: 2,
    unit: 'COUNT',
    period: 'DAILY',
    sourceType: 'OWNER_DEFINED',
    sourceActorId: seanUserId,
    startsAt: `${todayStr}T00:00:00.000Z`,
    status: 'ACTIVE',
    isMedicallyConstrained: false,
    createdBy: seanUserId,
    createdAt: `${todayStr}T06:00:00.000Z`,
    updatedAt: `${todayStr}T06:00:00.000Z`
  };

  const activeMinutesGoal: ActivityGoal = {
    goalId: asActivityGoalId('gol-01951500-0000-7000-8000-000000000002'),
    petId: maxPetId,
    householdId,
    title: 'Active Exercise Target',
    metricType: 'ACTIVE_MINUTES',
    targetValue: 60,
    unit: 'MINUTES',
    period: 'DAILY',
    sourceType: 'OWNER_DEFINED',
    sourceActorId: seanUserId,
    startsAt: `${todayStr}T00:00:00.000Z`,
    status: 'ACTIVE',
    isMedicallyConstrained: false,
    createdBy: seanUserId,
    createdAt: `${todayStr}T06:00:00.000Z`,
    updatedAt: `${todayStr}T06:00:00.000Z`
  };

  [dailyWalkGoal, activeMinutesGoal].forEach(g => ActivityStore.saveGoal(g));
}
