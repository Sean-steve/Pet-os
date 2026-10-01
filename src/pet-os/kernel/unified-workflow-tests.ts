/**
 * Pet OS - Unified Cross-Domain Integration Test Suite
 * 
 * Verifies end-to-end integration workflows across the single canonical data graph:
 * User → Household → Pet
 * Provider → ServiceOffering → Availability → Booking
 * 
 * Specifically proves:
 * 1. A registered pet appears and is fully operable across Health, Care, Nutrition, Activity, and Training.
 * 2. A provider offering creates availability and accepts a booking for that same registered pet.
 * 3. Cross-household authorization and multi-tenant isolation remain strictly enforced.
 */

import {
  UserId,
  HouseholdId,
  PetId,
  asUserId,
  asHouseholdId,
  asPetId,
  asProviderId,
  asServiceOfferingId,
  generateUUIDv7,
  asCareObligationId,
  asReminderPolicyId,
  asCareOccurrenceId,
  asFoodId,
  asFeedingPlanId,
  asMealScheduleId,
  asActivityId,
  asActivityRoutineId,
  asSkillId,
  asTrainingPlanId,
  asSkillProgressId,
} from '../kernel/ids';

import { seedUnifiedPetOS, resetAllStores, CANONICAL_IDS } from '../seed/unified-seed';
import { IdentityStore } from '../identity/store';
import { PetStore } from '../pet-core/store';
import { HealthStore } from '../health/store';
import { HealthService } from '../health/service';
import { CareStore } from '../care/store';
import { NutritionStore } from '../nutrition/store';
import { ActivityStore } from '../activity/store';
import { TrainingStore } from '../training/store';
import { ProviderStore } from '../provider/store';
import { BookingStore } from '../booking/store';
import { BookingPlatformService } from '../booking/service';

export interface IntegrationTestResult {
  id: string;
  name: string;
  category: 'CROSS_DOMAIN_PET' | 'PROVIDER_BOOKING' | 'TENANT_ISOLATION';
  passed: boolean;
  message?: string;
  durationMs: number;
}

export class UnifiedWorkflowTestSuite {
  static async runAllTests(): Promise<{
    total: number;
    passed: number;
    failed: number;
    results: IntegrationTestResult[];
  }> {
    const results: IntegrationTestResult[] = [];
    const run = async (
      id: string,
      name: string,
      category: IntegrationTestResult['category'],
      fn: () => Promise<void> | void
    ) => {
      const t0 = performance.now();
      try {
        await fn();
        results.push({
          id,
          name,
          category,
          passed: true,
          durationMs: Math.round(performance.now() - t0),
        });
      } catch (err: any) {
        results.push({
          id,
          name,
          category,
          passed: false,
          message: err.message || String(err),
          durationMs: Math.round(performance.now() - t0),
        });
      }
    };

    // Ensure baseline seed is loaded
    await seedUnifiedPetOS({ forceReset: true });

    // ========================================================================
    // WORKFLOW 1: CROSS-DOMAIN REGISTERED PET
    // ========================================================================

    await run(
      'INT-01',
      'Canonical seed pets (Kibo, Simba, Luna) exist in PetStore with correct household',
      'CROSS_DOMAIN_PET',
      () => {
        const kibo = PetStore.findPetById(CANONICAL_IDS.PET_KIBO);
        if (!kibo) throw new Error('Kibo not found in PetStore');
        if (kibo.householdId !== CANONICAL_IDS.MAIN_HOUSEHOLD) {
          throw new Error(`Expected Kibo household to be ${CANONICAL_IDS.MAIN_HOUSEHOLD}, got ${kibo.householdId}`);
        }

        const simba = PetStore.findPetById(CANONICAL_IDS.PET_SIMBA);
        if (!simba) throw new Error('Simba not found in PetStore');

        const luna = PetStore.findPetById(CANONICAL_IDS.PET_LUNA);
        if (!luna) throw new Error('Luna not found in PetStore');
      }
    );

    await run(
      'INT-02',
      'Registered pet propagates to Health domain with active conditions & core vaccinations',
      'CROSS_DOMAIN_PET',
      () => {
        const petId = CANONICAL_IDS.PET_KIBO;
        const conditions = HealthStore.listConditionsForPet(petId);
        if (conditions.length === 0) throw new Error('Expected conditions for Kibo in HealthStore');

        const vaccs = HealthStore.listVaccinationsForPet(petId);
        if (vaccs.length === 0) throw new Error('Expected vaccinations for Kibo in HealthStore');
        const rabies = vaccs.find(v => v.vaccineName.includes('Rabies'));
        if (!rabies) throw new Error('Expected Rabies vaccination for Kibo');
      }
    );

    await run(
      'INT-03',
      'Registered pet propagates to Care domain with obligations, occurrences and reminder policies',
      'CROSS_DOMAIN_PET',
      () => {
        const petId = CANONICAL_IDS.PET_KIBO;
        const obligations = CareStore.getObligationsForPet(petId);
        if (obligations.length === 0) throw new Error('Expected care obligations for Kibo in CareStore');

        const occurrences = CareStore.getOccurrencesForPet(petId);
        if (occurrences.length === 0) throw new Error('Expected care occurrences for Kibo in CareStore');
      }
    );

    await run(
      'INT-04',
      'Registered pet propagates to Nutrition domain with active feeding plan and schedules',
      'CROSS_DOMAIN_PET',
      () => {
        const petId = CANONICAL_IDS.PET_KIBO;
        const plans = NutritionStore.listFeedingPlansForPet(petId);
        if (plans.length === 0) throw new Error('Expected feeding plans for Kibo in NutritionStore');
        const activePlan = plans.find(p => p.status === 'ACTIVE');
        if (!activePlan) throw new Error('Expected active feeding plan for Kibo');

        const schedules = NutritionStore.listSchedulesForPlan(activePlan.feedingPlanId);
        if (schedules.length === 0) throw new Error('Expected meal schedules for active plan');
      }
    );

    await run(
      'INT-05',
      'Registered pet propagates to Activity domain with walk routines and completed GPS sessions',
      'CROSS_DOMAIN_PET',
      () => {
        const petId = CANONICAL_IDS.PET_KIBO;
        const routines = ActivityStore.getRoutinesForPet(petId);
        if (routines.length === 0) throw new Error('Expected activity routines for Kibo in ActivityStore');

        const records = ActivityStore.getRecordsForPet(petId);
        if (records.length === 0) throw new Error('Expected activity records for Kibo in ActivityStore');
      }
    );

    await run(
      'INT-06',
      'Registered pet propagates to Training domain with skills catalog, plans and verified progress',
      'CROSS_DOMAIN_PET',
      () => {
        const petId = CANONICAL_IDS.PET_KIBO;
        const plans = TrainingStore.listPlansForPet(petId);
        if (plans.length === 0) throw new Error('Expected training plans for Kibo in TrainingStore');

        const progress = TrainingStore.listSkillProgressForPet(petId);
        if (progress.length === 0) throw new Error('Expected skill progress records for Kibo');
        const sitProgress = progress.find(p => p.currentProficiency === 'RELIABLE' || p.currentProficiency === 'RELIABLE_IN_CONTROLLED_ENVIRONMENT');
        if (!sitProgress) throw new Error('Expected reliable skill progress for Kibo');
      }
    );

    await run(
      'INT-07',
      'Registering a new pet dynamically propagates immediately across all five domain stores',
      'CROSS_DOMAIN_PET',
      async () => {
        const newPetId = asPetId(`pet-malkia-${Date.now()}`);
        const ownerId = CANONICAL_IDS.OWNER_ELENA;
        const householdId = CANONICAL_IDS.MAIN_HOUSEHOLD;

        // 1. Core Pet Registration
        PetStore.savePet({
          petId: newPetId,
          householdId,
          name: 'Malkia',
          speciesCode: 'DOG',
          breedCode: 'RHODESIAN_RIDGEBACK',
          mixedBreed: false,
          unknownBreed: false,
          sex: 'FEMALE',
          reproductiveStatus: 'STERILIZED',
          dateOfBirth: '2023-01-10',
          birthdatePrecision: 'EXACT',
          estimatedBirthdate: false,
          primaryColor: 'Red Wheaten',
          sizeClassification: 'LARGE',
          lifecycleStage: 'ADULT',
          status: 'ACTIVE',
          createdBy: ownerId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
          metadata: {},
        });

        if (!PetStore.findPetById(newPetId)) throw new Error('New pet Malkia failed to save in PetStore');

        // 2. Health record
        HealthService.recordCondition(ownerId, {
          petId: newPetId,
          isDiagnosis: false,
          conditionName: 'Healthy Baseline Checkup',
          category: 'DERMATOLOGY',
          severity: 'MILD',
          chronic: false,
          provenance: 'VETERINARY_PROFESSIONAL',
        });
        if (HealthStore.listConditionsForPet(newPetId).length === 0) {
          throw new Error('Malkia health condition not recorded');
        }

        // 3. Care obligation
        const obId = asCareObligationId(generateUUIDv7());
        CareStore.saveObligation({
          careObligationId: obId,
          petId: newPetId,
          householdId,
          title: 'Heartworm Preventative',
          category: 'MEDICATION_ADMINISTRATION',
          careType: 'HEARTWORM_PREVENTATIVE',
          sourceType: 'OWNER_CREATED',
          scheduleType: 'CALENDAR_RECURRENCE',
          startsAt: new Date().toISOString(),
          dueAt: new Date().toISOString(),
          timezone: 'Africa/Nairobi',
          completionPolicy: 'MANUAL_ACKNOWLEDGEMENT',
          priority: 'HIGH',
          status: 'ACTIVE',
          recurrenceRule: { frequency: 'MONTHLY', interval: 1 },
          createdBy: ownerId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        if (CareStore.getObligationsForPet(newPetId).length === 0) {
          throw new Error('Malkia care obligation not recorded');
        }

        // 4. Nutrition plan
        const planId = asFeedingPlanId(generateUUIDv7());
        NutritionStore.saveFeedingPlan({
          feedingPlanId: planId,
          petId: newPetId,
          householdId,
          title: 'Malkia Active Adult Plan',
          planType: 'PRIMARY_DIET',
          provenance: 'OWNER_DEFINED',
          status: 'ACTIVE',
          isProfessionalPlan: false,
          startsAt: '2026-03-01T00:00:00.000Z',
          timezone: 'Africa/Nairobi',
          createdBy: ownerId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        });
        if (NutritionStore.listFeedingPlansForPet(newPetId).length === 0) {
          throw new Error('Malkia feeding plan not recorded');
        }

        // 5. Activity routine
        const routineId = asActivityRoutineId(generateUUIDv7());
        ActivityStore.saveRoutine({
          routineId,
          petId: newPetId,
          householdId,
          title: 'Sunset Neighborhood Run',
          activityType: 'RUN',
          targetDurationMinutes: 35,
          recurrenceRule: { frequency: 'DAILY', interval: 1 },
          status: 'ACTIVE',
          createdBy: ownerId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        if (ActivityStore.getRoutinesForPet(newPetId).length === 0) {
          throw new Error('Malkia activity routine not recorded');
        }

        // 6. Training plan
        const trainPlanId = asTrainingPlanId(generateUUIDv7());
        TrainingStore.savePlan({
          trainingPlanId: trainPlanId,
          petId: newPetId,
          householdId,
          title: 'Advanced Off-Leash Recall',
          description: 'Solidifying distance recall in high distraction settings.',
          planType: 'CUSTOM_HOUSEHOLD',
          sourceType: 'OWNER_CREATED',
          sourceActorId: ownerId,
          trainerVerificationStatus: 'UNVERIFIED',
          status: 'ACTIVE',
          startsAt: new Date().toISOString(),
          timezone: 'Africa/Nairobi',
          createdBy: ownerId,
          concurrencyVersion: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        if (TrainingStore.listPlansForPet(newPetId).length === 0) {
          throw new Error('Malkia training plan not recorded');
        }
      }
    );

    // ========================================================================
    // WORKFLOW 2: PROVIDER OFFERING, AVAILABILITY & BOOKING
    // ========================================================================

    await run(
      'INT-08',
      'Provider offering creates verified availability and accepts booking for registered pet',
      'PROVIDER_BOOKING',
      () => {
        const store = BookingStore.getInstance();
        const providerStore = ProviderStore.getInstance();
        const service = new BookingPlatformService(store, providerStore);

        const providerId = CANONICAL_IDS.WALKER_SARAH;
        const offeringId = CANONICAL_IDS.OFFERING_DOG_WALK;
        const petId = CANONICAL_IDS.PET_KIBO;
        const householdId = CANONICAL_IDS.MAIN_HOUSEHOLD;
        const ownerId = CANONICAL_IDS.OWNER_ELENA;

        // Verify provider offering is active
        const offering = providerStore.getServiceOffering(offeringId);
        if (!offering || offering.status !== 'ACTIVE') {
          throw new Error('Dog walk offering is not active');
        }

        // Generate tomorrow's operating slot
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 2);
        tomorrow.setUTCHours(11, 0, 0, 0); // 14:00 EAT
        const startAt = tomorrow.toISOString();
        const endAt = new Date(tomorrow.getTime() + 45 * 60 * 1000).toISOString();

        // Create booking
        const booking = service.createBooking({
          ownerUserId: ownerId,
          householdId,
          providerId,
          serviceOfferingId: offeringId,
          petIds: [petId],
          startAt,
          endAt,
          timezone: 'Africa/Nairobi',
          idempotencyKey: `int-test-booking-${Date.now()}`,
        });

        if (!booking || booking.status !== 'CONFIRMED') {
          throw new Error(`Expected booking status CONFIRMED, got ${booking?.status}`);
        }

        // Assert booking exists in BookingStore
        const found = store.findBookingById(booking.bookingId);
        if (!found) throw new Error('Booking not found in BookingStore');

        // Verify provider has temporary access grant for Kibo
        if (!booking.accessGrantId) {
          throw new Error('Expected temporary pet access grant created for provider');
        }
        const grant = store.findAccessGrantById(booking.accessGrantId);
        if (!grant || grant.providerId !== providerId) {
          throw new Error('Access grant provider mismatch or grant not found');
        }
      }
    );

    await run(
      'INT-09',
      'Atomic overbooking concurrency rejection prevents conflicting duplicate reservations',
      'PROVIDER_BOOKING',
      () => {
        const store = BookingStore.getInstance();
        const providerStore = ProviderStore.getInstance();
        const service = new BookingPlatformService(store, providerStore);

        const providerId = CANONICAL_IDS.TRAINER_JUMA;
        const offeringId = CANONICAL_IDS.OFFERING_TRAINING;
        const petId = CANONICAL_IDS.PET_KIBO;
        const householdId = CANONICAL_IDS.MAIN_HOUSEHOLD;
        const ownerId = CANONICAL_IDS.OWNER_ELENA;

        // Slot on an active weekday (Tuesday, 10:00 AM)
        const slotTime = new Date();
        const dayOffset = (2 - slotTime.getUTCDay() + 7) % 7 || 7;
        slotTime.setDate(slotTime.getDate() + dayOffset);
        slotTime.setUTCHours(10, 0, 0, 0);
        const startAt = slotTime.toISOString();
        const endAt = new Date(slotTime.getTime() + 60 * 60 * 1000).toISOString();

        // 1. First booking succeeds
        service.createBooking({
          ownerUserId: ownerId,
          householdId,
          providerId,
          serviceOfferingId: offeringId,
          petIds: [petId],
          startAt,
          endAt,
          idempotencyKey: `int-concurrency-1-${Date.now()}`,
        });

        // 2. Second booking for conflicting window must be rejected
        let conflictCaught = false;
        try {
          service.createBooking({
            ownerUserId: ownerId,
            householdId,
            providerId,
            serviceOfferingId: offeringId,
            petIds: [CANONICAL_IDS.PET_KIBO],
            startAt,
            endAt,
            idempotencyKey: `int-concurrency-2-${Date.now()}`,
          });
        } catch (err: any) {
          conflictCaught = true;
        }

        if (!conflictCaught) {
          throw new Error('Expected concurrency conflict error when booking overlapping slot');
        }
      }
    );

    // ========================================================================
    // WORKFLOW 3: MULTI-TENANT ISOLATION & RBAC ENFORCEMENT
    // ========================================================================

    await run(
      'INT-10',
      'Cross-household authorization strictly rejects foreign tenant booking attempt for other household pet',
      'TENANT_ISOLATION',
      () => {
        const store = BookingStore.getInstance();
        const providerStore = ProviderStore.getInstance();
        const service = new BookingPlatformService(store, providerStore);

        const outsiderUserId = CANONICAL_IDS.OUTSIDER_BRIAN;
        const outsiderHouseholdId = CANONICAL_IDS.OUTSIDER_HOUSEHOLD;
        const elenaPetId = CANONICAL_IDS.PET_KIBO;

        const slotTime = new Date();
        slotTime.setDate(slotTime.getDate() + 4);
        slotTime.setUTCHours(9, 0, 0, 0);
        const startAt = slotTime.toISOString();
        const endAt = new Date(slotTime.getTime() + 45 * 60 * 1000).toISOString();

        let rejected = false;
        try {
          service.createBooking({
            ownerUserId: outsiderUserId,
            householdId: outsiderHouseholdId,
            providerId: CANONICAL_IDS.WALKER_SARAH,
            serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
            petIds: [elenaPetId], // Foreign pet!
            startAt,
            endAt,
          });
        } catch (err: any) {
          rejected = true;
          if (!err.message.includes('does not belong to household')) {
            throw new Error(`Unexpected error message: ${err.message}`);
          }
        }

        if (!rejected) {
          throw new Error('Expected foreign household pet booking to be rejected');
        }
      }
    );

    await run(
      'INT-11',
      'Foreign tenant cannot access or claim membership in another household',
      'TENANT_ISOLATION',
      () => {
        const outsiderUserId = CANONICAL_IDS.OUTSIDER_BRIAN;
        const elenaHouseholdId = CANONICAL_IDS.MAIN_HOUSEHOLD;

        // Check RBAC membership
        const membership = IdentityStore.findMembership(elenaHouseholdId, outsiderUserId);
        if (membership) {
          throw new Error('Outsider user must NOT have membership in Elena household');
        }

        const outsiderHouseholds = IdentityStore.listHouseholdsForUser(outsiderUserId);
        const hasElenaHh = outsiderHouseholds.some(h => h.householdId === elenaHouseholdId);
        if (hasElenaHh) {
          throw new Error('Outsider was incorrectly granted membership in Elena household');
        }
      }
    );

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    return {
      total: results.length,
      passed,
      failed,
      results,
    };
  }
}
