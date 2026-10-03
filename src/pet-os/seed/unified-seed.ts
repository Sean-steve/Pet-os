/**
 * Pet OS Unified Canonical Seed Data & Orchestrator
 * 
 * Implements the single canonical data graph connecting:
 * User → Household → Pet
 * Provider → ServiceOffering → Availability → Booking
 * 
 * Unifies all domains with canonical identities:
 * - Elena Vance (Primary Household Owner)
 * - Sean Miller & Amina Odhiambo (Household Caregiver & Family)
 * - Kibo, Simba, Luna, Max (Canonical Household Pets)
 * - Sarah Mwangi (Vetted Dog Walker)
 * - Dr. Amani Kimani (Vetted Veterinarian)
 * - Juma Ochieng (Vetted Behavioral Trainer)
 * - Brian Outside (Isolated Outsider for RBAC verification)
 */

import {
  UserId,
  HouseholdId,
  PetId,
  asUserId,
  asHouseholdId,
  asPetId,
  asMembershipId,
  asServiceOfferingId,
  asActivityRoutineId,
  asActivityId,
  asTrainingPlanId,
  asSkillProgressId,
  asSkillId,
  generateUUIDv7
} from '../kernel/ids';

// Stores
import { IdentityStore } from '../identity/store';
import { PetStore } from '../pet-core/store';
import { HealthStore } from '../health/store';
import { CareStore } from '../care/store';
import { NutritionStore } from '../nutrition/store';
import { ActivityStore } from '../activity/store';
import { TrainingStore } from '../training/store';
import { ProviderStore } from '../provider/store';
import { BookingStore } from '../booking/store';
import { NotificationStore } from '../notifications/store';
import { TimelineStore } from '../timeline/store';
import { PassportStore } from '../passport/store';
import { DocumentStore } from '../documents/store';
import { TrackingStore } from '../tracking/store';
import { seedTrackingData } from '../tracking/seed';

// Domain Seeds
import { seedSprint5HealthData } from '../health/seed';
import { seedSprint6CareData } from '../care/seed';
import { seedSprint7NutritionData } from '../nutrition/seed';
import { seedActivityData } from '../activity/seed';
import { seedTrainingData } from '../training/seed';
import { seedProviderData, SEED_USERS, SEED_PROVIDERS, SEED_BUSINESSES } from '../provider/seed';
import { seedBookingData } from '../booking/seed';
import { seedSprint18RescueData } from '../rescue/seed';
import { seedVetWorkspace } from '../vet-workspace/seed';
import { TrainerWorkspaceStore } from '../trainer-workspace/store';
import { seedTrainerWorkspaceData } from '../trainer-workspace/seed';
import { seedProfessionalCareData } from '../professional-care/seed';
import { seedTransportData } from '../transport/seed';
import { seedReviewData } from '../reviews/seed';
import { seedSubscriptionData } from '../subscription/seed';
import { seedTrackerSubscriptionData } from '../tracker-service/seed';
import { seedProviderSaaSData } from '../provider-saas/seed';
import { seedCommerceData } from '../commerce/seed';
import { seedAIData } from '../ai/seed';
import { RescueStore } from '../rescue/store';
import { VetWorkspaceStore } from '../vet-workspace/store';
import { ProfessionalCareStore } from '../professional-care/store';
import { TransportStore } from '../transport/store';
import { ReviewStore } from '../reviews/store';
import { SubscriptionStore } from '../subscription/store';
import { TrackerSubscriptionStore } from '../tracker-service/store';
import { ProviderSaaSStore } from '../provider-saas/store';
import { CommerceStore } from '../commerce/store';
import { AIStore } from '../ai/store';

// Canonical Identifiers
export const CANONICAL_IDS = {
  // Households
  MAIN_HOUSEHOLD: asHouseholdId('hh-01951500-0000-7000-8000-000000000001'),
  BOOKING_HOUSEHOLD: asHouseholdId('hh-01955000-0001-7000-8000-000000000001'),
  LEGACY_HOUSEHOLD_001: asHouseholdId('household-001'),
  LEGACY_HOUSEHOLD_SPRINT4: asHouseholdId('hh-sprint4-main'),
  OUTSIDER_HOUSEHOLD: asHouseholdId('hh-01951500-0000-7000-8000-000000000099'),
  OUTSIDER_HOUSEHOLD_LEGACY: asHouseholdId('household-002'),

  // Users
  OWNER_ELENA: asUserId('usr-01951500-0000-7000-8000-000000000001'),
  CAREGIVER_SEAN: asUserId('usr-01951500-0000-7000-8000-000000000002'),
  MEMBER_AMINA: asUserId('usr-01951500-0000-7000-8000-000000000003'),
  ADMIN_CHARLES: asUserId('usr-01951500-0000-7000-8000-000000000099'),
  OUTSIDER_BRIAN: asUserId('usr-01951500-0000-7000-8000-000000000088'),

  // Legacy user ID aliases
  LEGACY_OWNER_USER: asUserId('user-owner-001'),
  LEGACY_ALICE_OWNER: asUserId('usr-alice-owner'),
  LEGACY_BOB_CAREGIVER: asUserId('usr-bob-caregiver'),
  LEGACY_CHARLIE_OUTSIDER: asUserId('usr-charlie-outsider'),

  // Providers
  VET_DR_KIMANI: SEED_PROVIDERS.DR_KIMANI, // prv-kimani-vet-001
  WALKER_SARAH: SEED_PROVIDERS.SARAH_MWANGI, // prv-sarah-walker-001
  WALKER_SARAH_USER: SEED_USERS.WALKER_SARAH, // usr-01951500-0000-7000-8000-000000000102
  TRAINER_JUMA: SEED_PROVIDERS.JUMA_OCHIENG, // prv-juma-trainer-001

  // Service Offerings
  OFFERING_DOG_WALK: asServiceOfferingId('sro-dog-walk-01'),
  OFFERING_VET_CONSULT: asServiceOfferingId('sro-vet-consult-01'),
  OFFERING_TRAINING: asServiceOfferingId('sro-behavior-training-01'),

  // Pets
  PET_KIBO: asPetId('pet-kibo-001'),
  PET_SIMBA: asPetId('pet-001'),
  PET_LUNA: asPetId('pet-luna-002'),
  PET_LUNA_ALIAS: asPetId('pet-01951500-0000-7000-8000-000000000002'),
  PET_MAX: asPetId('pet-01951500-0000-7000-8000-000000000001'),
};

/**
 * Resets all stores across all Pet OS domains.
 */
export function resetAllStores(): void {
  IdentityStore.reset();
  PetStore.reset();
  HealthStore.clear();
  CareStore.reset();
  NutritionStore.clear();
  ActivityStore.resetForTesting();
  TrainingStore.clear();
  ProviderStore.getInstance().reset();
  BookingStore.getInstance().reset();
  NotificationStore.reset();
  TimelineStore.reset();
  PassportStore.reset();
  DocumentStore.reset();
  TrackingStore.reset();
  TrainerWorkspaceStore.getInstance().reset();
  RescueStore.getInstance().reset();
  VetWorkspaceStore.getInstance().reset();
  ProfessionalCareStore.getInstance().reset();
  TransportStore.getInstance().reset();
  ReviewStore.getInstance().clear();
  SubscriptionStore.reset();
  TrackerSubscriptionStore.getInstance().reset();
  ProviderSaaSStore.getInstance().reset();
  CommerceStore.getInstance().reset();
  AIStore.getInstance().reset();
}

/**
 * Seeds the entire unified Pet OS platform with canonical entities and relationships.
 * Idempotent: can be called multiple times without generating conflicting duplicates.
 */
export async function seedUnifiedPetOS(options: { forceReset?: boolean } = {}): Promise<void> {
  const { forceReset = false } = options;

  if (forceReset) {
    resetAllStores();
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // ==========================================================================
  // 1. IDENTITY DOMAIN (Users, Profiles, Households, Memberships)
  // ==========================================================================

  const usersToSeed = [
    {
      id: CANONICAL_IDS.OWNER_ELENA,
      email: 'elena.vance@petos.internal',
      firstName: 'Elena',
      lastName: 'Vance',
      displayName: 'Elena Vance (Household Owner)',
      phone: '+254700000001',
    },
    {
      id: CANONICAL_IDS.CAREGIVER_SEAN,
      email: 'sean.miller@petos.internal',
      firstName: 'Sean',
      lastName: 'Miller',
      displayName: 'Sean Miller (Caregiver)',
      phone: '+254700000002',
    },
    {
      id: CANONICAL_IDS.MEMBER_AMINA,
      email: 'amina.odhiambo@petos.internal',
      firstName: 'Amina',
      lastName: 'Odhiambo',
      displayName: 'Amina Odhiambo (Family Member)',
      phone: '+254700000003',
    },
    {
      id: CANONICAL_IDS.ADMIN_CHARLES,
      email: 'trust.admin@petos.internal',
      firstName: 'Dr. Charles',
      lastName: 'Maina',
      displayName: 'Dr. Charles Maina (Trust Officer)',
      phone: '+254700000099',
    },
    {
      id: CANONICAL_IDS.OUTSIDER_BRIAN,
      email: 'brian.outside@outsider.internal',
      firstName: 'Brian',
      lastName: 'Outside',
      displayName: 'Brian Outside (Foreign Tenant)',
      phone: '+254700000088',
    },
    // Legacy user aliases
    {
      id: CANONICAL_IDS.LEGACY_OWNER_USER,
      email: 'user-owner-001@petos.internal',
      firstName: 'Elena',
      lastName: 'Owner',
      displayName: 'Elena Vance [Legacy Owner]',
      phone: '+254700000001',
    },
    {
      id: CANONICAL_IDS.LEGACY_ALICE_OWNER,
      email: 'alice@wambuipets.co.ke',
      firstName: 'Alice',
      lastName: 'Wambui',
      displayName: 'Alice Wambui [Legacy Health]',
      phone: '+254712345678',
    },
    {
      id: CANONICAL_IDS.LEGACY_BOB_CAREGIVER,
      email: 'bob@caregiving.co.ke',
      firstName: 'Bob',
      lastName: 'Caregiver',
      displayName: 'Bob Caregiver [Legacy Care]',
      phone: '+254712345679',
    },
    {
      id: CANONICAL_IDS.LEGACY_CHARLIE_OUTSIDER,
      email: 'charlie@external.co.ke',
      firstName: 'Charlie',
      lastName: 'Outsider',
      displayName: 'Charlie Outsider [Legacy Outsider]',
      phone: '+254712345680',
    },
  ];

  for (const u of usersToSeed) {
    if (!IdentityStore.findUserById(u.id)) {
      IdentityStore.saveUser({
        userId: u.id,
        email: u.email,
        normalizedEmail: u.email.toLowerCase().trim(),
        phoneNumber: u.phone,
        passwordHash: 'hash-petos-secure',
        accountStatus: 'ACTIVE',
        failedLoginAttempts: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
        policyAcceptedAt: nowIso,
        policyVersion: '1.0',
      });

      IdentityStore.saveProfile({
        userId: u.id,
        displayName: u.displayName,
        firstName: u.firstName,
        lastName: u.lastName,
        locale: 'en-KE',
        timezone: 'Africa/Nairobi',
        communicationPreferences: { emailNotifications: true, smsNotifications: true, emergencyAlerts: true },
        privacyPreferences: { profileVisibility: 'HOUSEHOLD_ONLY', shareActivityWithHousehold: true },
        updatedAt: nowIso,
      });
    }
  }

  // Households: Canonical Main Household & Aliases
  const householdsToSeed = [
    {
      id: CANONICAL_IDS.MAIN_HOUSEHOLD,
      name: 'Vance & Kamau Household (Kilimani, Nairobi)',
      ownerUserId: CANONICAL_IDS.OWNER_ELENA,
    },
    {
      id: CANONICAL_IDS.BOOKING_HOUSEHOLD,
      name: 'Vance & Kamau Household [Booking Household]',
      ownerUserId: CANONICAL_IDS.OWNER_ELENA,
    },
    {
      id: CANONICAL_IDS.LEGACY_HOUSEHOLD_001,
      name: 'Vance & Kamau Household [household-001]',
      ownerUserId: CANONICAL_IDS.OWNER_ELENA,
    },
    {
      id: CANONICAL_IDS.LEGACY_HOUSEHOLD_SPRINT4,
      name: 'Vance & Kamau Household [hh-sprint4-main]',
      ownerUserId: CANONICAL_IDS.OWNER_ELENA,
    },
    {
      id: CANONICAL_IDS.OUTSIDER_HOUSEHOLD,
      name: 'Mombasa Coastal Villa (Outsider Tenant)',
      ownerUserId: CANONICAL_IDS.OUTSIDER_BRIAN,
    },
    {
      id: CANONICAL_IDS.OUTSIDER_HOUSEHOLD_LEGACY,
      name: 'Outsider Household 2 (Legacy)',
      ownerUserId: CANONICAL_IDS.OUTSIDER_BRIAN,
    },
  ];

  for (const hh of householdsToSeed) {
    if (!IdentityStore.findHouseholdById(hh.id)) {
      IdentityStore.saveHousehold({
        householdId: hh.id,
        name: hh.name,
        ownerUserId: hh.ownerUserId,
        status: 'ACTIVE',
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      // Add owner membership
      IdentityStore.saveMembership({
        membershipId: asMembershipId(generateUUIDv7()),
        householdId: hh.id,
        userId: hh.ownerUserId,
        role: 'HOUSEHOLD_ADMIN',
        status: 'ACTIVE',
        joinedAt: nowIso,
        updatedAt: nowIso,
      });

      // If main household or alias, also add Sean, Amina, and legacy owner
      if (hh.ownerUserId === CANONICAL_IDS.OWNER_ELENA) {
        IdentityStore.saveMembership({
          membershipId: asMembershipId(generateUUIDv7()),
          householdId: hh.id,
          userId: CANONICAL_IDS.CAREGIVER_SEAN,
          role: 'CAREGIVER',
          status: 'ACTIVE',
          joinedAt: nowIso,
          updatedAt: nowIso,
        });

        IdentityStore.saveMembership({
          membershipId: asMembershipId(generateUUIDv7()),
          householdId: hh.id,
          userId: CANONICAL_IDS.MEMBER_AMINA,
          role: 'FAMILY_MEMBER',
          status: 'ACTIVE',
          joinedAt: nowIso,
          updatedAt: nowIso,
        });

        IdentityStore.saveMembership({
          membershipId: asMembershipId(generateUUIDv7()),
          householdId: hh.id,
          userId: CANONICAL_IDS.LEGACY_OWNER_USER,
          role: 'HOUSEHOLD_ADMIN',
          status: 'ACTIVE',
          joinedAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }
  }

  // ==========================================================================
  // 2. PET CORE DOMAIN (Canonical Registered Pets)
  // ==========================================================================

  const petsToSeed = [
    {
      petId: CANONICAL_IDS.PET_KIBO,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      name: 'Kibo',
      speciesCode: 'DOG',
      breedCode: 'RHODESIAN_RIDGEBACK',
      mixedBreed: false,
      unknownBreed: false,
      sex: 'MALE' as const,
      reproductiveStatus: 'STERILIZED' as const,
      dateOfBirth: '2021-06-15',
      birthdatePrecision: 'EXACT' as const,
      estimatedBirthdate: false,
      primaryColor: 'Wheaten',
      sizeClassification: 'LARGE' as const,
      lifecycleStage: 'ADULT' as const,
    },
    {
      petId: CANONICAL_IDS.PET_SIMBA,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      name: 'Simba',
      speciesCode: 'SPECIES_DOG',
      breedCode: 'BREED_DOG_GOLDEN_RETRIEVER',
      mixedBreed: false,
      unknownBreed: false,
      sex: 'MALE' as const,
      reproductiveStatus: 'STERILIZED' as const,
      dateOfBirth: '2022-04-12',
      birthdatePrecision: 'EXACT' as const,
      estimatedBirthdate: false,
      primaryColor: 'Golden',
      sizeClassification: 'LARGE' as const,
      lifecycleStage: 'ADULT' as const,
    },
    {
      petId: CANONICAL_IDS.PET_LUNA,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      name: 'Luna',
      speciesCode: 'CAT',
      breedCode: 'DOMESTIC_SHORTHAIR',
      mixedBreed: true,
      unknownBreed: false,
      sex: 'FEMALE' as const,
      reproductiveStatus: 'STERILIZED' as const,
      dateOfBirth: '2022-03-10',
      birthdatePrecision: 'EXACT' as const,
      estimatedBirthdate: false,
      primaryColor: 'Calico',
      sizeClassification: 'SMALL' as const,
      lifecycleStage: 'ADULT' as const,
    },
    {
      petId: CANONICAL_IDS.PET_MAX,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      name: 'Max',
      speciesCode: 'DOG',
      breedCode: 'GERMAN_SHEPHERD',
      mixedBreed: false,
      unknownBreed: false,
      sex: 'MALE' as const,
      reproductiveStatus: 'STERILIZED' as const,
      dateOfBirth: '2020-11-03',
      birthdatePrecision: 'EXACT' as const,
      estimatedBirthdate: false,
      primaryColor: 'Black & Tan',
      sizeClassification: 'LARGE' as const,
      lifecycleStage: 'ADULT' as const,
    },
  ];

  for (const p of petsToSeed) {
    if (!PetStore.findPetById(p.petId)) {
      PetStore.savePet({
        petId: p.petId,
        householdId: p.householdId,
        name: p.name,
        speciesCode: p.speciesCode,
        breedCode: p.breedCode,
        mixedBreed: p.mixedBreed,
        unknownBreed: p.unknownBreed,
        sex: p.sex,
        reproductiveStatus: p.reproductiveStatus,
        dateOfBirth: p.dateOfBirth,
        birthdatePrecision: p.birthdatePrecision,
        estimatedBirthdate: p.estimatedBirthdate,
        primaryColor: p.primaryColor,
        sizeClassification: p.sizeClassification,
        lifecycleStage: p.lifecycleStage,
        status: 'ACTIVE',
        createdBy: CANONICAL_IDS.OWNER_ELENA,
        createdAt: nowIso,
        updatedAt: nowIso,
        version: 1,
        metadata: {},
      });
    }
  }

  // Alias Luna for Sprint 9 activity backwards compatibility
  if (!PetStore.findPetById(CANONICAL_IDS.PET_LUNA_ALIAS)) {
    PetStore.savePet({
      petId: CANONICAL_IDS.PET_LUNA_ALIAS,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      name: 'Luna',
      speciesCode: 'CAT',
      breedCode: 'DOMESTIC_SHORTHAIR',
      mixedBreed: true,
      unknownBreed: false,
      sex: 'FEMALE',
      reproductiveStatus: 'STERILIZED',
      dateOfBirth: '2022-03-10',
      birthdatePrecision: 'EXACT',
      estimatedBirthdate: false,
      primaryColor: 'Calico',
      sizeClassification: 'SMALL',
      lifecycleStage: 'ADULT',
      status: 'ACTIVE',
      createdBy: CANONICAL_IDS.OWNER_ELENA,
      createdAt: nowIso,
      updatedAt: nowIso,
      version: 1,
      metadata: {},
    });
  }

  // Alias Kibo and Simba for Sprint 15 and 16 recovery & community compatibility
  const kiboAlias = asPetId('pet-kibo-ridgeback-001');
  if (!PetStore.findPetById(kiboAlias)) {
    PetStore.savePet({
      petId: kiboAlias,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      name: 'Kibo',
      speciesCode: 'DOG',
      breedCode: 'RHODESIAN_RIDGEBACK',
      mixedBreed: false,
      unknownBreed: false,
      sex: 'MALE',
      reproductiveStatus: 'STERILIZED',
      dateOfBirth: '2021-06-15',
      birthdatePrecision: 'EXACT',
      estimatedBirthdate: false,
      primaryColor: 'Wheaten',
      sizeClassification: 'LARGE',
      lifecycleStage: 'ADULT',
      status: 'ACTIVE',
      createdBy: CANONICAL_IDS.OWNER_ELENA,
      createdAt: nowIso,
      updatedAt: nowIso,
      version: 1,
      metadata: {},
    });
  }

  const simbaAlias = asPetId('pet-simba-mainecoon-002');
  if (!PetStore.findPetById(simbaAlias)) {
    PetStore.savePet({
      petId: simbaAlias,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      name: 'Simba',
      speciesCode: 'CAT',
      breedCode: 'MAINE_COON',
      mixedBreed: false,
      unknownBreed: false,
      sex: 'MALE',
      reproductiveStatus: 'STERILIZED',
      dateOfBirth: '2022-04-12',
      birthdatePrecision: 'EXACT',
      estimatedBirthdate: false,
      primaryColor: 'Tabby Golden',
      sizeClassification: 'LARGE',
      lifecycleStage: 'ADULT',
      status: 'ACTIVE',
      createdBy: CANONICAL_IDS.OWNER_ELENA,
      createdAt: nowIso,
      updatedAt: nowIso,
      version: 1,
      metadata: {},
    });
  }

  // ==========================================================================
  // 3. SEED DOMAINS: Activity, Training, Provider Platform
  // ==========================================================================
  seedActivityData();
  seedTrainingData();
  seedProviderData(ProviderStore.getInstance());

  // Ensure canonical service offering IDs are registered in ProviderStore
  const pStore = ProviderStore.getInstance();
  const vetOff = pStore.getServiceOffering(asServiceOfferingId('sro-vet-consult-01'));
  if (vetOff) {
    pStore.saveServiceOffering({ ...vetOff, serviceOfferingId: CANONICAL_IDS.OFFERING_VET_CONSULT });
  }
  const trainOff = pStore.getServiceOffering(asServiceOfferingId('sro-behavior-training-01'));
  if (trainOff) {
    pStore.saveServiceOffering({ ...trainOff, serviceOfferingId: CANONICAL_IDS.OFFERING_TRAINING });
  }
  const walkOff = pStore.getServiceOffering(asServiceOfferingId('sro-dog-walk-01'));
  if (walkOff) {
    pStore.saveServiceOffering({ ...walkOff, serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK });
  }

  // Ensure Kibo has Activity Routines and Records
  if (ActivityStore.getRoutinesForPet(CANONICAL_IDS.PET_KIBO).length === 0) {
    ActivityStore.saveRoutine({
      routineId: asActivityRoutineId('routine-kibo-daily-walk'),
      petId: CANONICAL_IDS.PET_KIBO,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      title: 'Morning Forest Trail Walk',
      activityType: 'WALK',
      targetDurationMinutes: 45,
      recurrenceRule: { frequency: 'DAILY', interval: 1 },
      status: 'ACTIVE',
      createdBy: CANONICAL_IDS.OWNER_ELENA,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }
  if (ActivityStore.getRecordsForPet(CANONICAL_IDS.PET_KIBO).length === 0) {
    ActivityStore.saveRecord({
      activityId: asActivityId('act-kibo-morning-walk-001'),
      petId: CANONICAL_IDS.PET_KIBO,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      activityType: 'WALK',
      sourceType: 'OWNER_RECORDED',
      sourceActorId: CANONICAL_IDS.OWNER_ELENA,
      startedAt: `${nowIso.split('T')[0]}T07:00:00.000Z`,
      endedAt: `${nowIso.split('T')[0]}T07:45:00.000Z`,
      durationSeconds: 2700,
      distanceValue: 3.2,
      distanceUnit: 'KILOMETERS',
      distanceSource: 'GPS_MEASURED',
      intensity: 'MODERATE',
      locationContext: 'TRAIL',
      notes: 'Morning trail loop. Exceptional leash focus and energy.',
      recordedAt: nowIso,
      createdBy: CANONICAL_IDS.OWNER_ELENA,
      createdAt: nowIso,
      updatedAt: nowIso,
      verificationStatus: 'VERIFIED',
    });
  }

  // Ensure Kibo has Training Plans and Skill Progress
  if (TrainingStore.listPlansForPet(CANONICAL_IDS.PET_KIBO).length === 0) {
    TrainingStore.savePlan({
      trainingPlanId: asTrainingPlanId('plan-kibo-advanced-obedience'),
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      petId: CANONICAL_IDS.PET_KIBO,
      title: 'Kibo Advanced Urban Canine Plan',
      description: 'Comprehensive obedience, emergency drop on recall, and calm greeting manners.',
      planType: 'CUSTOM_HOUSEHOLD',
      sourceType: 'OWNER_CREATED',
      sourceActorId: CANONICAL_IDS.OWNER_ELENA,
      trainerVerificationStatus: 'UNVERIFIED',
      status: 'ACTIVE',
      startsAt: nowIso,
      timezone: 'Africa/Nairobi',
      createdBy: CANONICAL_IDS.OWNER_ELENA,
      concurrencyVersion: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }
  if (TrainingStore.listSkillProgressForPet(CANONICAL_IDS.PET_KIBO).length === 0) {
    TrainingStore.saveSkillProgress({
      skillProgressId: asSkillProgressId('prog-kibo-sit-001'),
      petId: CANONICAL_IDS.PET_KIBO,
      skillId: asSkillId('skill-sit-001'),
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      currentProficiency: 'RELIABLE',
      assessmentProvenance: 'OWNER_ASSESSED',
      lastAssessedAt: nowIso,
      assessedByUserId: CANONICAL_IDS.OWNER_ELENA,
      sessionCount: 5,
      successfulRepetitionsTotal: 30,
      notes: 'Mastered reliable duration and distance sits.',
      updatedAt: nowIso,
    });
  }

  // ==========================================================================
  // 4. SEED CLINICAL HEALTH RECORDS (Kibo, Simba, Luna)
  // ==========================================================================
  await seedSprint5HealthData(CANONICAL_IDS.OWNER_ELENA, CANONICAL_IDS.PET_KIBO);
  await seedSprint5HealthData(CANONICAL_IDS.OWNER_ELENA, CANONICAL_IDS.PET_SIMBA);
  await seedSprint5HealthData(CANONICAL_IDS.OWNER_ELENA, CANONICAL_IDS.PET_LUNA);

  // ==========================================================================
  // 5. SEED PREVENTIVE CARE OBLIGATIONS & REMINDERS (Kibo, Simba, Luna)
  // ==========================================================================
  await seedSprint6CareData(CANONICAL_IDS.OWNER_ELENA, CANONICAL_IDS.PET_KIBO);
  await seedSprint6CareData(CANONICAL_IDS.OWNER_ELENA, CANONICAL_IDS.PET_SIMBA);
  await seedSprint6CareData(CANONICAL_IDS.OWNER_ELENA, CANONICAL_IDS.PET_LUNA);

  // ==========================================================================
  // 6. SEED NUTRITION, FEEDING PLANS & DIETS (Kibo, Simba, Luna)
  // ==========================================================================
  await seedSprint7NutritionData(CANONICAL_IDS.OWNER_ELENA, CANONICAL_IDS.PET_KIBO);
  await seedSprint7NutritionData(CANONICAL_IDS.OWNER_ELENA, CANONICAL_IDS.PET_SIMBA);
  await seedSprint7NutritionData(CANONICAL_IDS.OWNER_ELENA, CANONICAL_IDS.PET_LUNA);

  // ==========================================================================
  // 7. SEED BOOKING & RESERVATION ENGINE
  // ==========================================================================
  seedBookingData();

  // ==========================================================================
  // 8. SEED TRACKING & LOCATION PLATFORM (Sprint 14)
  // ==========================================================================
  seedTrackingData();

  // ==========================================================================
  // 9. SEED RESCUE, SHELTER, FOSTER & WELFARE PLATFORM (Sprint 18)
  // ==========================================================================
  seedSprint18RescueData();

  // ==========================================================================
  // 10. SEED VETERINARY PROFESSIONAL WORKSPACE PLATFORM (Sprint 19)
  // ==========================================================================
  seedVetWorkspace();

  // ==========================================================================
  // 11. SEED TRAINER PROFESSIONAL WORKSPACE PLATFORM (Sprint 20)
  // ==========================================================================
  seedTrainerWorkspaceData();

  // ==========================================================================
  // 12. SEED PROFESSIONAL CARE WORKSPACES (Sprint 21)
  // ==========================================================================
  seedProfessionalCareData();

  // ==========================================================================
  // 13. SEED PET TRANSPORT PROFESSIONAL WORKSPACE (Sprint 22)
  // ==========================================================================
  seedTransportData();

  // ==========================================================================
  // 14. SEED PROVIDER REVIEWS, REPUTATION & TRUST ENGINE (Sprint 23)
  // ==========================================================================
  seedReviewData();

  // ==========================================================================
  // 15. SEED CONSUMER SUBSCRIPTION & PREMIUM ENTITLEMENTS (Sprint 24)
  // ==========================================================================
  seedSubscriptionData();

  // ==========================================================================
  // 16. SEED TRACKER CONNECTIVITY SUBSCRIPTION & DEVICE PLANS (Sprint 25)
  // ==========================================================================
  seedTrackerSubscriptionData();

  // ==========================================================================
  // 17. SEED PROVIDER BUSINESS SAAS & PROFESSIONAL SUBSCRIPTIONS (Sprint 26)
  // ==========================================================================
  seedProviderSaaSData();

  // ==========================================================================
  // 18. SEED MARKETPLACE COMMERCE, SELLERS & INVENTORY (Sprint 27)
  // ==========================================================================
  seedCommerceData();

  // ==========================================================================
  // 19. SEED PET INTELLIGENCE & AI GOVERNANCE PLATFORM (Sprint 28)
  // ==========================================================================
  seedAIData();
}


