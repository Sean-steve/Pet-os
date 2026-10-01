/**
 * Pet OS Sprint 7 - Nutrition Domain Service
 * Implements Volume IX (Nutrition & Feeding Architecture), Volume IV, Volume VII, Volume XXVI, Volume XXX, Volume XXXI
 */

import {
  UserId,
  HouseholdId,
  PetId,
  FoodId,
  FeedingPlanId,
  MealScheduleId,
  MealOccurrenceId,
  TreatLogId,
  HydrationLogId,
  AppetiteObservationId,
  DietaryRestrictionId,
  FoodTransitionPlanId,
  asFoodId,
  asFeedingPlanId,
  asMealScheduleId,
  asMealOccurrenceId,
  asTreatLogId,
  asHydrationLogId,
  asAppetiteObservationId,
  asDietaryRestrictionId,
  asFoodTransitionPlanId,
  generateUUIDv7,
  asHouseholdId
} from '../kernel/ids';
import { currentClockUtcNow, currentClockTime } from '../kernel/time';
import { InMemoryAuditStore } from '../kernel/audit';
import { PetStore } from '../pet-core/store';
import { HealthStore } from '../health/store';
import { TimelineService } from '../timeline/service';
import { AuthorizationService } from '../identity/authorization';
import { IdentityStore } from '../identity/store';
import { NutritionStore } from './store';
import { NutritionEventFactory } from './events';
import {
  FoodItem,
  FeedingPlan,
  MealSchedule,
  MealOccurrence,
  TreatLog,
  HydrationLog,
  AppetiteObservation,
  DietaryRestriction,
  FoodTransitionPlan,
  FoodTransitionStage,
  FoodConflictResult,
  PetNutritionProfile,
  CaregiverQuickView,
  ServingQuantity,
  ServingUnit,
  CreateFoodItemCommand,
  CreateFeedingPlanCommand,
  CompleteMealCommand,
  SkipMealCommand,
  LogUnscheduledMealCommand,
  LogTreatCommand,
  LogHydrationCommand,
  RecordAppetiteObservationCommand,
  CreateDietaryRestrictionCommand,
  CreateFoodTransitionPlanCommand
} from './types';

export class NutritionService {
  // ==========================================
  // UNIT CONVERSION & SERVING QUANTITY
  // ==========================================

  /**
   * Safe unit conversion.
   * Weight to weight (g <-> kg) is strictly supported.
   * Cross-dimensional conversion (volume <-> weight) is strictly rejected
   * unless explicit density is provided.
   */
  static convertServingQuantity(
    qty: ServingQuantity,
    targetUnit: ServingUnit,
    densityKcalPerGram?: number
  ): number {
    if (qty.unit === targetUnit) {
      return qty.value;
    }

    // Weight to weight
    if (qty.unit === 'g' && targetUnit === 'kg') {
      return qty.value / 1000;
    }
    if (qty.unit === 'kg' && targetUnit === 'g') {
      return qty.value * 1000;
    }

    // Cross-dimension without density is forbidden
    throw new Error(
      `CANNOT_CONVERT_UNIT_WITHOUT_DENSITY: Cannot convert ${qty.unit} to ${targetUnit} without measured substance density.`
    );
  }

  // ==========================================
  // FOOD PRODUCT & CATALOGUE MANAGEMENT
  // ==========================================

  static createFoodItem(cmd: CreateFoodItemCommand): FoodItem {
    const foodId = asFoodId(generateUUIDv7());
    const now = currentClockUtcNow();

    // Volume IX Invariant: Unknown ingredients must remain UNKNOWN, never guessed.
    const food: FoodItem = {
      foodId,
      name: cmd.name.trim(),
      brand: cmd.brand.trim(),
      foodType: cmd.foodType,
      sourceType: cmd.sourceType,
      verificationStatus: cmd.sourceType === 'CATALOGUE_VERIFIED' ? 'VERIFIED' : 'UNVERIFIED',
      speciesTarget: cmd.speciesTarget,
      lifeStageTarget: cmd.lifeStageTarget,
      form: cmd.form,
      manufacturer: cmd.manufacturer,
      ingredients: cmd.ingredientsKnown ? (cmd.ingredients || []) : undefined,
      ingredientsKnown: cmd.ingredientsKnown,
      energyDensityKcalPerGram: cmd.energyDensityKcalPerGram,
      servingUnitDefault: cmd.servingUnitDefault,
      householdId: cmd.householdId,
      createdBy: cmd.userId,
      createdAt: now,
      updatedAt: now
    };

    NutritionStore.saveFood(food);

    InMemoryAuditStore.record({
      actorId: cmd.userId,
      actorType: 'USER',
      action: 'NUTRITION_FOOD_ITEM_CREATED',
      resourceType: 'food',
      resourceId: foodId,
      classification: 'INTERNAL',
      metadata: { name: food.name, brand: food.brand, sourceType: food.sourceType }
    });

    return food;
  }

  static getFoodById(foodId: FoodId): FoodItem | undefined {
    return NutritionStore.findFoodById(foodId);
  }

  static listFoods(householdId?: HouseholdId): FoodItem[] {
    return NutritionStore.listFoods(householdId);
  }

  // ==========================================
  // FEEDING PLANS LIFECYCLE
  // ==========================================

  static createFeedingPlan(cmd: CreateFeedingPlanCommand): FeedingPlan {
    const pet = PetStore.findPetById(cmd.petId);
    if (!pet) {
      throw new Error(`Pet with ID ${cmd.petId} does not exist.`);
    }

    // Invariant: Deceased pets cannot have new feeding plans
    if (pet.status === 'DECEASED') {
      throw new Error(`Cannot create feeding plan: Pet ${pet.name} is deceased.`);
    }

    // Authorization check
    this.assertAuthorized(cmd.userId, cmd.householdId, 'pet.nutrition.plan.create');

    const planId = asFeedingPlanId(generateUUIDv7());
    const now = currentClockUtcNow();

    // Provenance check: Normal users cannot set VETERINARIAN_DEFINED provenance
    const isProfessional =
      cmd.provenance === 'VETERINARIAN_DEFINED' ||
      cmd.provenance === 'NUTRITION_PROFESSIONAL' ||
      !!cmd.isProfessionalPlan;

    const plan: FeedingPlan = {
      feedingPlanId: planId,
      petId: cmd.petId,
      householdId: cmd.householdId,
      title: cmd.title.trim(),
      planType: cmd.planType,
      provenance: cmd.provenance,
      status: 'ACTIVE', // Automatically activate newly created plan
      isProfessionalPlan: isProfessional,
      prescribedByProviderId: cmd.prescribedByProviderId,
      prescribedByProviderName: cmd.prescribedByProviderName,
      startsAt: cmd.startsAt || now,
      endsAt: cmd.endsAt,
      timezone: cmd.timezone || 'Africa/Nairobi',
      generalInstructions: cmd.generalInstructions,
      clinicalNotes: cmd.clinicalNotes,
      reason: cmd.reason,
      supersedesPlanId: cmd.supersedesPlanId,
      createdBy: cmd.userId,
      createdAt: now,
      updatedAt: now,
      version: 1
    };

    // If active primary diet already exists, supersede it
    if (plan.planType === 'PRIMARY_DIET') {
      const existingActive = NutritionStore.findActivePlanForPet(cmd.petId);
      if (existingActive && existingActive.feedingPlanId !== planId) {
        existingActive.status = 'SUPERSEDED';
        existingActive.supersededBy = planId;
        existingActive.updatedAt = now;
        NutritionStore.saveFeedingPlan(existingActive);

        NutritionStore.publishDomainEvent(
          NutritionEventFactory.create(
            'FeedingPlanSuperseded',
            existingActive.feedingPlanId,
            cmd.householdId,
            cmd.userId,
            { plan: existingActive, supersededByPlanId: planId }
          )
        );
      }
    }

    NutritionStore.saveFeedingPlan(plan);

    // Save Schedules
    if (cmd.schedules && cmd.schedules.length > 0) {
      cmd.schedules.forEach((s, idx) => {
        const scheduleId = asMealScheduleId(generateUUIDv7());
        const schedule: MealSchedule = {
          mealScheduleId: scheduleId,
          feedingPlanId: planId,
          label: s.label,
          localTime: s.localTime,
          targetFoodId: s.targetFoodId,
          plannedQuantity: s.plannedQuantity,
          instructions: s.instructions,
          assignedUserId: s.assignedUserId,
          active: true,
          sortOrder: idx + 1,
          createdAt: now,
          updatedAt: now
        };
        NutritionStore.saveMealSchedule(schedule);
      });
    }

    // Audit record
    InMemoryAuditStore.record({
      actorId: cmd.userId,
      actorType: 'USER',
      action: 'FEEDING_PLAN_CREATED',
      resourceType: 'nutrition_plan',
      resourceId: planId,
      classification: 'INTERNAL',
      metadata: { petId: cmd.petId, title: plan.title, provenance: plan.provenance }
    });

    // Domain event
    NutritionStore.publishDomainEvent(
      NutritionEventFactory.create('FeedingPlanCreated', planId, cmd.householdId, cmd.userId, { plan })
    );

    // Timeline integration
    try {
      TimelineService.recordEvent({
        petId: cmd.petId,
        householdId: cmd.householdId,
        eventType: 'FEEDING_PLAN_ACTIVATED',
        eventCategory: 'NUTRITION',
        sourceDomain: 'NUTRITION',
        sourceEntityType: 'FEEDING_PLAN',
        sourceEntityId: planId,
        sourceActorType: 'USER',
        sourceActorId: cmd.userId,
        title: `Feeding Plan Activated: ${plan.title}`,
        summary: `New ${plan.planType.toLowerCase().replace('_', ' ')} plan started with ${cmd.schedules?.length || 0} scheduled daily meals.`,
        occurredAt: now,
        provenanceType: isProfessional ? 'PROVIDER_ENTERED' : 'OWNER_ENTERED'
      });
    } catch (e) {
      console.warn('Timeline recording skipped for FeedingPlanCreated:', e);
    }

    return plan;
  }

  static pauseFeedingPlan(planId: FeedingPlanId, userId: UserId, reason?: string): FeedingPlan {
    const plan = NutritionStore.findFeedingPlanById(planId);
    if (!plan) {
      throw new Error(`Feeding plan ${planId} not found.`);
    }

    this.assertAuthorized(userId, plan.householdId, 'pet.nutrition.plan.update');

    // Invariant: Professional plan protection
    if (plan.isProfessionalPlan) {
      this.assertAuthorized(userId, plan.householdId, 'pet.nutrition.professional_plan.manage');
    }

    plan.status = 'PAUSED';
    plan.updatedAt = currentClockUtcNow();
    if (reason) plan.clinicalNotes = (plan.clinicalNotes ? plan.clinicalNotes + '\n' : '') + `Paused: ${reason}`;

    NutritionStore.saveFeedingPlan(plan);

    NutritionStore.publishDomainEvent(
      NutritionEventFactory.create('FeedingPlanPaused', planId, plan.householdId, userId, { plan })
    );

    return plan;
  }

  static activateFeedingPlan(planId: FeedingPlanId, userId: UserId): FeedingPlan {
    const plan = NutritionStore.findFeedingPlanById(planId);
    if (!plan) {
      throw new Error(`Feeding plan ${planId} not found.`);
    }

    this.assertAuthorized(userId, plan.householdId, 'pet.nutrition.plan.activate');

    if (plan.isProfessionalPlan) {
      this.assertAuthorized(userId, plan.householdId, 'pet.nutrition.professional_plan.manage');
    }

    const now = currentClockUtcNow();

    // Supersede other active primary plan if this is primary
    if (plan.planType === 'PRIMARY_DIET') {
      const existingActive = NutritionStore.findActivePlanForPet(plan.petId);
      if (existingActive && existingActive.feedingPlanId !== planId) {
        existingActive.status = 'SUPERSEDED';
        existingActive.supersededBy = planId;
        existingActive.updatedAt = now;
        NutritionStore.saveFeedingPlan(existingActive);
      }
    }

    plan.status = 'ACTIVE';
    plan.updatedAt = now;
    NutritionStore.saveFeedingPlan(plan);

    NutritionStore.publishDomainEvent(
      NutritionEventFactory.create('FeedingPlanActivated', planId, plan.householdId, userId, { plan })
    );

    return plan;
  }

  // ==========================================
  // MEAL OCCURRENCE GENERATION & SCHEDULE
  // ==========================================

  /**
   * Generates or retrieves meal occurrences for a specific date (YYYY-MM-DD).
   * Safe and idempotent: does not duplicate existing occurrences.
   */
  static generateOccurrencesForDate(petId: PetId, dateStr: string): MealOccurrence[] {
    const pet = PetStore.findPetById(petId);
    if (!pet || pet.status === 'DECEASED') {
      return [];
    }

    const activePlan = NutritionStore.findActivePlanForPet(petId);
    if (!activePlan) {
      return NutritionStore.listOccurrencesForPetOnDate(petId, dateStr);
    }

    const existingOccurrences = NutritionStore.listOccurrencesForPetOnDate(petId, dateStr);
    const schedules = NutritionStore.listSchedulesForPlan(activePlan.feedingPlanId);

    const now = currentClockUtcNow();
    const created: MealOccurrence[] = [...existingOccurrences];

    for (const schedule of schedules) {
      if (!schedule.active) continue;

      const alreadyExists = existingOccurrences.some(
        (o) => o.mealScheduleId === schedule.mealScheduleId
      );

      if (!alreadyExists) {
        const occurrenceId = asMealOccurrenceId(generateUUIDv7());
        const scheduledUtc = `${dateStr}T${schedule.localTime}:00Z`;

        const occurrence: MealOccurrence = {
          occurrenceId,
          petId,
          householdId: activePlan.householdId,
          feedingPlanId: activePlan.feedingPlanId,
          mealScheduleId: schedule.mealScheduleId,
          label: schedule.label,
          scheduledFor: scheduledUtc,
          scheduledLocalTime: schedule.localTime,
          foodId: schedule.targetFoodId,
          plannedQuantity: schedule.plannedQuantity,
          status: 'SCHEDULED',
          isUnscheduled: false,
          assignedToUserId: schedule.assignedUserId,
          concurrencyVersion: 1,
          createdAt: now,
          updatedAt: now
        };

        NutritionStore.saveMealOccurrence(occurrence);
        created.push(occurrence);

        NutritionStore.publishDomainEvent(
          NutritionEventFactory.create(
            'MealOccurrenceScheduled',
            occurrenceId,
            activePlan.householdId,
            activePlan.createdBy,
            { occurrence }
          )
        );
      }
    }

    return created.sort((a, b) => a.scheduledLocalTime.localeCompare(b.scheduledLocalTime));
  }

  // ==========================================
  // MEAL EXECUTION & CONCURRENCY CONTROL
  // ==========================================

  /**
   * Marks a meal occurrence as completed or partially completed.
   * Enforces optimistic concurrency control and 60-minute duplicate feeding prevention.
   */
  static completeMeal(cmd: CompleteMealCommand): MealOccurrence {
    const occurrence = NutritionStore.findMealOccurrenceById(cmd.occurrenceId);
    if (!occurrence) {
      throw new Error(`Meal occurrence ${cmd.occurrenceId} not found.`);
    }

    // Authorization
    this.assertAuthorized(cmd.userId, occurrence.householdId, 'pet.nutrition.meal.complete');

    // 1. Concurrency Check: If already completed or version mismatch
    if (occurrence.status === 'COMPLETED' || occurrence.status === 'PARTIALLY_COMPLETED') {
      throw new Error(
        `ALREADY_COMPLETED: Meal occurrence "${occurrence.label}" has already been completed by user ${occurrence.completedByUserId || 'another caregiver'}.`
      );
    }

    if (cmd.concurrencyVersion !== occurrence.concurrencyVersion) {
      throw new Error(
        `CONCURRENCY_CONFLICT: Meal state changed concurrently. Expected version ${occurrence.concurrencyVersion}, got ${cmd.concurrencyVersion}.`
      );
    }

    const now = currentClockUtcNow();
    const nowTime = currentClockTime().getTime();

    // 2. Duplicate Feeding Guard: Check if another meal was completed within the past 60 minutes
    const recentOccurrences = NutritionStore.listOccurrencesForPet(occurrence.petId);
    const recentCompleted = recentOccurrences.find((o) => {
      if (o.occurrenceId === occurrence.occurrenceId) return false;
      if (o.status !== 'COMPLETED' && o.status !== 'PARTIALLY_COMPLETED') return false;
      if (!o.completedAt) return false;
      const completedTime = new Date(o.completedAt).getTime();
      const diffMinutes = (nowTime - completedTime) / (1000 * 60);
      return diffMinutes >= 0 && diffMinutes < 60;
    });

    if (recentCompleted && !cmd.allowDuplicateOverride) {
      throw new Error(
        `DUPLICATE_FEEDING_GUARD: A meal ("${recentCompleted.label}") was already fed ${Math.round((nowTime - new Date(recentCompleted.completedAt!).getTime()) / 60000)} minutes ago. To confirm additional feeding, acknowledge duplicate override.`
      );
    }

    // Determine status
    const actualQty = cmd.actualQuantity || occurrence.plannedQuantity;
    const isPartial =
      cmd.consumedQuantity &&
      cmd.consumedQuantity.value < actualQty.value;

    occurrence.status = isPartial ? 'PARTIALLY_COMPLETED' : 'COMPLETED';
    occurrence.actualQuantity = actualQty;
    occurrence.consumedQuantity = cmd.consumedQuantity || actualQty;
    occurrence.completedByUserId = cmd.userId;
    occurrence.completedAt = now;
    occurrence.appetiteObservation = cmd.appetiteObservation || 'NORMAL';
    occurrence.notes = cmd.notes;
    occurrence.concurrencyVersion += 1;
    occurrence.updatedAt = now;

    NutritionStore.saveMealOccurrence(occurrence);

    // If appetite was recorded, save formal AppetiteObservation
    if (cmd.appetiteObservation) {
      this.recordAppetiteObservation({
        petId: occurrence.petId,
        householdId: occurrence.householdId,
        status: cmd.appetiteObservation,
        mealOccurrenceId: occurrence.occurrenceId,
        portionConsumedPercentage: cmd.consumedQuantity
          ? Math.min(100, Math.round((cmd.consumedQuantity.value / actualQty.value) * 100))
          : 100,
        observedAt: now,
        userId: cmd.userId,
        notes: cmd.notes
      });
    }

    // Audit log
    InMemoryAuditStore.record({
      actorId: cmd.userId,
      actorType: 'USER',
      action: 'MEAL_COMPLETED',
      resourceType: 'meal_occurrence',
      resourceId: occurrence.occurrenceId,
      classification: 'INTERNAL',
      metadata: {
        petId: occurrence.petId,
        label: occurrence.label,
        status: occurrence.status,
        quantity: occurrence.actualQuantity
      }
    });

    // Domain event
    NutritionStore.publishDomainEvent(
      NutritionEventFactory.create('MealCompleted', occurrence.occurrenceId, occurrence.householdId, cmd.userId, {
        occurrence,
        completedBy: cmd.userId
      })
    );

    return occurrence;
  }

  static skipMeal(cmd: SkipMealCommand): MealOccurrence {
    const occurrence = NutritionStore.findMealOccurrenceById(cmd.occurrenceId);
    if (!occurrence) {
      throw new Error(`Meal occurrence ${cmd.occurrenceId} not found.`);
    }

    this.assertAuthorized(cmd.userId, occurrence.householdId, 'pet.nutrition.meal.complete');

    if (occurrence.status === 'COMPLETED' || occurrence.status === 'PARTIALLY_COMPLETED') {
      throw new Error(`Cannot skip meal: Occurrence "${occurrence.label}" is already completed.`);
    }

    if (cmd.concurrencyVersion !== occurrence.concurrencyVersion) {
      throw new Error(`CONCURRENCY_CONFLICT: Version mismatch.`);
    }

    occurrence.status = 'SKIPPED';
    occurrence.skipReason = cmd.reason;
    occurrence.concurrencyVersion += 1;
    occurrence.updatedAt = currentClockUtcNow();

    NutritionStore.saveMealOccurrence(occurrence);

    NutritionStore.publishDomainEvent(
      NutritionEventFactory.create('MealSkipped', occurrence.occurrenceId, occurrence.householdId, cmd.userId, {
        occurrence,
        reason: cmd.reason
      })
    );

    return occurrence;
  }

  static logUnscheduledMeal(cmd: LogUnscheduledMealCommand): MealOccurrence {
    this.assertAuthorized(cmd.userId, cmd.householdId, 'pet.nutrition.meal.log');

    const pet = PetStore.findPetById(cmd.petId);
    if (!pet || pet.status === 'DECEASED') {
      throw new Error(`Cannot log meal: Pet is deceased or not found.`);
    }

    const activePlan = NutritionStore.findActivePlanForPet(cmd.petId);
    const planId = activePlan?.feedingPlanId || asFeedingPlanId(generateUUIDv7());

    const occurrenceId = asMealOccurrenceId(generateUUIDv7());
    const now = currentClockUtcNow();
    const localTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Nairobi',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(currentClockTime());

    const occurrence: MealOccurrence = {
      occurrenceId,
      petId: cmd.petId,
      householdId: cmd.householdId,
      feedingPlanId: planId,
      label: cmd.label || 'Additional Feeding',
      scheduledFor: now,
      scheduledLocalTime: localTime,
      foodId: cmd.foodId,
      plannedQuantity: cmd.quantity,
      actualQuantity: cmd.quantity,
      consumedQuantity: cmd.quantity,
      status: 'COMPLETED',
      isUnscheduled: true,
      completedByUserId: cmd.userId,
      completedAt: now,
      appetiteObservation: cmd.appetiteObservation || 'NORMAL',
      notes: cmd.notes,
      concurrencyVersion: 1,
      createdAt: now,
      updatedAt: now
    };

    NutritionStore.saveMealOccurrence(occurrence);

    NutritionStore.publishDomainEvent(
      NutritionEventFactory.create('MealCompleted', occurrenceId, cmd.householdId, cmd.userId, {
        occurrence,
        completedBy: cmd.userId
      })
    );

    return occurrence;
  }

  // ==========================================
  // TREATS & HYDRATION
  // ==========================================

  static logTreat(cmd: LogTreatCommand): TreatLog {
    this.assertAuthorized(cmd.userId, cmd.householdId, 'pet.nutrition.treat.log');

    const pet = PetStore.findPetById(cmd.petId);
    if (!pet || pet.status === 'DECEASED') {
      throw new Error(`Cannot log treat: Pet is deceased or not found.`);
    }

    const treatLogId = asTreatLogId(generateUUIDv7());
    const now = currentClockUtcNow();

    const treat: TreatLog = {
      treatLogId,
      petId: cmd.petId,
      householdId: cmd.householdId,
      foodId: cmd.foodId,
      treatName: cmd.treatName.trim(),
      quantity: cmd.quantity,
      context: cmd.context,
      occurredAt: cmd.occurredAt || now,
      givenBy: cmd.userId,
      notes: cmd.notes,
      createdAt: now
    };

    NutritionStore.saveTreatLog(treat);

    NutritionStore.publishDomainEvent(
      NutritionEventFactory.create('TreatRecorded', treatLogId, cmd.householdId, cmd.userId, { treat })
    );

    return treat;
  }

  static logHydration(cmd: LogHydrationCommand): HydrationLog {
    this.assertAuthorized(cmd.userId, cmd.householdId, 'pet.nutrition.hydration.log');

    const pet = PetStore.findPetById(cmd.petId);
    if (!pet || pet.status === 'DECEASED') {
      throw new Error(`Cannot log hydration: Pet is deceased or not found.`);
    }

    const hydrationLogId = asHydrationLogId(generateUUIDv7());
    const now = currentClockUtcNow();

    const hydration: HydrationLog = {
      hydrationLogId,
      petId: cmd.petId,
      householdId: cmd.householdId,
      volumeMl: cmd.volumeMl,
      measurementType: cmd.measurementType,
      waterSource: cmd.waterSource,
      occurredAt: cmd.occurredAt || now,
      recordedBy: cmd.userId,
      notes: cmd.notes,
      createdAt: now
    };

    NutritionStore.saveHydrationLog(hydration);

    NutritionStore.publishDomainEvent(
      NutritionEventFactory.create('HydrationRecorded', hydrationLogId, cmd.householdId, cmd.userId, { hydration })
    );

    return hydration;
  }

  // ==========================================
  // APPETITE OBSERVATIONS
  // ==========================================

  static recordAppetiteObservation(cmd: RecordAppetiteObservationCommand): AppetiteObservation {
    const observationId = asAppetiteObservationId(generateUUIDv7());
    const now = currentClockUtcNow();

    const observation: AppetiteObservation = {
      observationId,
      petId: cmd.petId,
      householdId: cmd.householdId,
      status: cmd.status,
      mealOccurrenceId: cmd.mealOccurrenceId,
      portionConsumedPercentage: cmd.portionConsumedPercentage,
      observedAt: cmd.observedAt || now,
      observedBy: cmd.userId,
      notes: cmd.notes,
      createdAt: now
    };

    NutritionStore.saveAppetiteObservation(observation);

    NutritionStore.publishDomainEvent(
      NutritionEventFactory.create(
        'AppetiteObservationRecorded',
        observationId,
        cmd.householdId,
        cmd.userId,
        { observation }
      )
    );

    return observation;
  }

  // ==========================================
  // DIETARY RESTRICTIONS
  // ==========================================

  static createDietaryRestriction(cmd: CreateDietaryRestrictionCommand): DietaryRestriction {
    this.assertAuthorized(cmd.userId, cmd.householdId, 'pet.nutrition.restriction.manage');

    const restrictionId = asDietaryRestrictionId(generateUUIDv7());
    const now = currentClockUtcNow();

    const restriction: DietaryRestriction = {
      restrictionId,
      petId: cmd.petId,
      householdId: cmd.householdId,
      restrictionType: cmd.restrictionType,
      source: cmd.source,
      targetIngredient: cmd.targetIngredient?.trim(),
      description: cmd.description.trim(),
      active: true,
      createdAt: now,
      updatedAt: now
    };

    NutritionStore.saveDietaryRestriction(restriction);

    NutritionStore.publishDomainEvent(
      NutritionEventFactory.create(
        'DietaryRestrictionAdded',
        restrictionId,
        cmd.householdId,
        cmd.userId,
        { restriction }
      )
    );

    return restriction;
  }

  static removeDietaryRestriction(
    restrictionId: DietaryRestrictionId,
    householdId: HouseholdId,
    userId: UserId
  ): void {
    this.assertAuthorized(userId, householdId, 'pet.nutrition.restriction.manage');

    const restriction = NutritionStore.findDietaryRestrictionById(restrictionId);
    if (!restriction) return;

    restriction.active = false;
    restriction.updatedAt = currentClockUtcNow();
    NutritionStore.saveDietaryRestriction(restriction);

    NutritionStore.publishDomainEvent(
      NutritionEventFactory.create('DietaryRestrictionRemoved', restrictionId, householdId, userId, {
        restrictionId,
        petId: restriction.petId
      })
    );
  }

  // ==========================================
  // FOOD CONFLICT EVALUATOR & ALLERGY INTEGRATION
  // ==========================================

  /**
   * Evaluates dietary safety against active clinical allergies and dietary restrictions.
   * Invariant: Never outputs "SAFE: true". Always classifies as NO_KNOWN_CONFLICT,
   * POTENTIAL_CONFLICT, CONFIRMED_RECORDED_CONFLICT, or UNKNOWN.
   */
  static evaluateFoodConflict(petId: PetId, foodId: FoodId): FoodConflictResult {
    const food = NutritionStore.findFoodById(foodId);
    if (!food) {
      return {
        classification: 'UNKNOWN',
        matchedRestrictions: [],
        matchedAllergies: [],
        message: 'Food record not found in system catalogue.',
        isSafe: false,
        ingredientDataAvailable: false
      };
    }

    // 1. Fetch active clinical allergies from HealthStore
    const clinicalAllergies = HealthStore.listAllergiesForPet(petId).filter(
      (a) => a.status === 'ACTIVE' && a.verificationStatus !== 'REJECTED'
    );

    // 2. Fetch active dietary restrictions
    const activeRestrictions = NutritionStore.listDietaryRestrictionsForPet(petId, true);

    // Invariant: If ingredient composition is unknown, we cannot guarantee absence of allergens
    if (!food.ingredientsKnown || !food.ingredients || food.ingredients.length === 0) {
      return {
        classification: 'UNKNOWN',
        matchedRestrictions: [],
        matchedAllergies: clinicalAllergies.map((a) => a.allergen),
        message:
          'Ingredient composition is unlisted/unknown. Potential allergens cannot be verified.',
        isSafe: false,
        ingredientDataAvailable: false
      };
    }

    const normalizedIngredients = food.ingredients.map((i) => i.toLowerCase().trim());
    const matchedAllergies: string[] = [];
    const matchedRestrictions: string[] = [];

    // Check clinical allergies
    for (const allergy of clinicalAllergies) {
      const allergenLower = allergy.allergen.toLowerCase().trim();
      const match = normalizedIngredients.some(
        (ing) => ing.includes(allergenLower) || allergenLower.includes(ing)
      );
      if (match) {
        matchedAllergies.push(`${allergy.allergen} (${allergy.severity})`);
      }
    }

    // Check dietary restrictions
    for (const restriction of activeRestrictions) {
      if (restriction.targetIngredient) {
        const targetLower = restriction.targetIngredient.toLowerCase().trim();
        const match = normalizedIngredients.some(
          (ing) => ing.includes(targetLower) || targetLower.includes(ing)
        );
        if (match) {
          matchedRestrictions.push(restriction.description);
        }
      }
    }

    if (matchedAllergies.length > 0) {
      return {
        classification: 'CONFIRMED_RECORDED_CONFLICT',
        matchedRestrictions,
        matchedAllergies,
        message: `Conflict detected with recorded medical allergy: ${matchedAllergies.join(', ')}.`,
        isSafe: false,
        ingredientDataAvailable: true
      };
    }

    if (matchedRestrictions.length > 0) {
      return {
        classification: 'POTENTIAL_CONFLICT',
        matchedRestrictions,
        matchedAllergies,
        message: `Conflict detected with dietary restriction: ${matchedRestrictions.join(', ')}.`,
        isSafe: false,
        ingredientDataAvailable: true
      };
    }

    return {
      classification: 'NO_KNOWN_CONFLICT',
      matchedRestrictions: [],
      matchedAllergies: [],
      message: 'No recorded allergen or dietary restriction conflicts identified in known ingredients.',
      isSafe: false,
      ingredientDataAvailable: true
    };
  }

  // ==========================================
  // FOOD TRANSITION PLANS
  // ==========================================

  static createFoodTransitionPlan(cmd: CreateFoodTransitionPlanCommand): FoodTransitionPlan {
    this.assertAuthorized(cmd.userId, cmd.householdId, 'pet.nutrition.plan.create');

    const transitionPlanId = asFoodTransitionPlanId(generateUUIDv7());
    const now = currentClockUtcNow();
    const duration = cmd.durationDays || 7;

    // Standard 7-day veterinary gradual transition default
    const stages: FoodTransitionStage[] = cmd.customStages || [
      {
        stageNumber: 1,
        label: 'Day 1-2',
        startDayOffset: 0,
        durationDays: 2,
        previousFoodPercentage: 75,
        targetFoodPercentage: 25,
        instructions: 'Introduce 25% new food mixed thoroughly with 75% current food.'
      },
      {
        stageNumber: 2,
        label: 'Day 3-4',
        startDayOffset: 2,
        durationDays: 2,
        previousFoodPercentage: 50,
        targetFoodPercentage: 50,
        instructions: 'Equal parts current and new food. Monitor stool consistency.'
      },
      {
        stageNumber: 3,
        label: 'Day 5-6',
        startDayOffset: 4,
        durationDays: 2,
        previousFoodPercentage: 25,
        targetFoodPercentage: 75,
        instructions: 'Transition to majority 75% new food.'
      },
      {
        stageNumber: 4,
        label: 'Day 7+',
        startDayOffset: 6,
        durationDays: 1,
        previousFoodPercentage: 0,
        targetFoodPercentage: 100,
        instructions: '100% new food diet completed.'
      }
    ];

    const endDate = new Date(new Date(cmd.startDate).getTime() + duration * 24 * 3600 * 1000)
      .toISOString()
      .split('T')[0];

    const plan: FoodTransitionPlan = {
      transitionPlanId,
      petId: cmd.petId,
      householdId: cmd.householdId,
      previousFoodId: cmd.previousFoodId,
      targetFoodId: cmd.targetFoodId,
      startDate: cmd.startDate,
      endDate,
      status: 'ACTIVE',
      stages,
      provenance: 'OWNER_DEFINED',
      createdBy: cmd.userId,
      createdAt: now,
      updatedAt: now
    };

    NutritionStore.saveTransitionPlan(plan);

    NutritionStore.publishDomainEvent(
      NutritionEventFactory.create(
        'DietTransitionStarted',
        transitionPlanId,
        cmd.householdId,
        cmd.userId,
        { transition: plan }
      )
    );

    return plan;
  }

  static getActiveTransitionStage(plan: FoodTransitionPlan): FoodTransitionStage {
    const start = new Date(plan.startDate).getTime();
    const today = currentClockTime().getTime();
    const diffDays = Math.max(0, Math.floor((today - start) / (1000 * 3600 * 24)));

    for (let i = plan.stages.length - 1; i >= 0; i--) {
      const stage = plan.stages[i];
      if (diffDays >= stage.startDayOffset) {
        return stage;
      }
    }
    return plan.stages[0];
  }

  // ==========================================
  // READ MODELS & AGGREGATE PROJECTIONS
  // ==========================================

  static getNutritionProfile(petId: PetId): PetNutritionProfile {
    const activePlan = NutritionStore.findActivePlanForPet(petId);
    const schedules = activePlan
      ? NutritionStore.listSchedulesForPlan(activePlan.feedingPlanId)
      : [];

    const primaryFood = activePlan && schedules.length > 0
      ? NutritionStore.findFoodById(schedules[0].targetFoodId)
      : undefined;

    const todayStr = currentClockUtcNow().split('T')[0];
    const todayOccurrences = this.generateOccurrencesForDate(petId, todayStr);

    const activeTransition = NutritionStore.findActiveTransitionForPet(petId);
    const currentTransitionStage = activeTransition
      ? this.getActiveTransitionStage(activeTransition)
      : undefined;

    const activeRestrictions = NutritionStore.listDietaryRestrictionsForPet(petId, true);

    const clinicalAllergies = HealthStore.listAllergiesForPet(petId)
      .filter((a) => a.status === 'ACTIVE')
      .map((a) => ({
        allergen: a.allergen,
        severity: a.severity,
        provenance: a.provenance,
        verificationStatus: a.verificationStatus
      }));

    // Appetite history calculation
    const appetiteObservations = NutritionStore.listAppetiteObservationsForPet(petId);
    const lastAppetite = appetiteObservations[0];
    const sevenDaysAgo = currentClockTime().getTime() - 7 * 24 * 3600 * 1000;
    const refusedCount = appetiteObservations.filter(
      (a) => a.status === 'REFUSED_MEAL' && new Date(a.observedAt).getTime() >= sevenDaysAgo
    ).length;

    // Hydration summary
    const hydrationLogs = NutritionStore.listHydrationLogsForPet(petId);
    const oneDayAgo = currentClockTime().getTime() - 24 * 3600 * 1000;
    let totalOffered = 0;
    let totalMeasuredConsumed = 0;

    for (const h of hydrationLogs) {
      if (new Date(h.occurredAt).getTime() >= oneDayAgo) {
        if (h.measurementType === 'OFFERED_REFILL') {
          totalOffered += h.volumeMl;
        } else if (
          h.measurementType === 'MEASURED_CONSUMPTION' ||
          h.measurementType === 'DEVICE_RECORDED'
        ) {
          totalMeasuredConsumed += h.volumeMl;
        }
      }
    }

    const caregiverInstructions: string[] = [];
    if (activePlan?.generalInstructions) {
      caregiverInstructions.push(activePlan.generalInstructions);
    }
    if (activePlan?.clinicalNotes) {
      caregiverInstructions.push(`[Clinical]: ${activePlan.clinicalNotes}`);
    }
    if (currentTransitionStage) {
      caregiverInstructions.push(
        `Transition in progress (${currentTransitionStage.label}): ${currentTransitionStage.targetFoodPercentage}% new food, ${currentTransitionStage.previousFoodPercentage}% old food.`
      );
    }

    return {
      petId,
      activeFeedingPlan: activePlan,
      activeSchedules: schedules,
      primaryFood,
      todayOccurrences,
      activeTransition,
      currentTransitionStage,
      activeRestrictions,
      knownFoodAllergies: clinicalAllergies,
      recentAppetiteSummary: {
        lastObservedStatus: lastAppetite ? lastAppetite.status : 'NORMAL',
        lastObservedAt: lastAppetite?.observedAt,
        refusedCountLast7Days: refusedCount
      },
      recentHydrationSummary: {
        totalOfferedLast24h: totalOffered,
        totalMeasuredConsumedLast24h: totalMeasuredConsumed,
        lastLogAt: hydrationLogs[0]?.occurredAt
      },
      caregiverInstructions,
      lastUpdated: currentClockUtcNow()
    };
  }

  static getCaregiverQuickView(petId: PetId): CaregiverQuickView {
    const pet = PetStore.findPetById(petId);
    const petName = pet ? pet.name : 'Pet';

    const profile = this.getNutritionProfile(petId);

    // Find next upcoming or due meal
    const nextMealOcc = profile.todayOccurrences.find(
      (o) => o.status === 'SCHEDULED' || o.status === 'DUE'
    );

    const nextFood = nextMealOcc ? NutritionStore.findFoodById(nextMealOcc.foodId) : undefined;

    const criticalAllergyWarnings = profile.knownFoodAllergies.map(
      (a) => `ALLERGY: ${a.allergen.toUpperCase()} (${a.severity})`
    );

    const hydrationLogs = NutritionStore.listHydrationLogsForPet(petId);
    const lastWater = hydrationLogs.find((h) => h.measurementType === 'OFFERED_REFILL');

    return {
      petId,
      petName,
      nextMeal: nextMealOcc
        ? {
            occurrenceId: nextMealOcc.occurrenceId,
            label: nextMealOcc.label,
            scheduledTime: nextMealOcc.scheduledLocalTime,
            foodName: nextFood ? nextFood.name : 'Scheduled Diet',
            quantity: `${nextMealOcc.plannedQuantity.value} ${nextMealOcc.plannedQuantity.unit}`,
            instructions: profile.activeFeedingPlan?.generalInstructions,
            status: nextMealOcc.status
          }
        : undefined,
      todayMeals: profile.todayOccurrences.map((o) => {
        const food = NutritionStore.findFoodById(o.foodId);
        const completedUser = o.completedByUserId
          ? IdentityStore.findUserById(o.completedByUserId)
          : undefined;

        return {
          occurrenceId: o.occurrenceId,
          label: o.label,
          scheduledTime: o.scheduledLocalTime,
          status: o.status,
          completedBy: completedUser
            ? IdentityStore.findProfileByUserId(completedUser.userId)?.displayName || completedUser.email
            : undefined,
          completedAt: o.completedAt,
          foodName: food ? food.name : 'Diet',
          plannedQuantity: `${o.plannedQuantity.value} ${o.plannedQuantity.unit}`
        };
      }),
      criticalAllergyWarnings,
      essentialFeedingInstructions: profile.caregiverInstructions,
      lastWaterOffered: lastWater
        ? `${lastWater.volumeMl}ml at ${lastWater.occurredAt.split('T')[1].slice(0, 5)} UTC`
        : 'None recorded today'
    };
  }

  // ==========================================
  // AUTHORIZATION HELPER
  // ==========================================

  private static assertAuthorized(
    userId: UserId,
    householdId: HouseholdId,
    permission: any
  ): void {
    const user = IdentityStore.findUserById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found.`);
    }

    const member = IdentityStore.findMembership(householdId, userId);
    const memberships = member
      ? [
          {
            householdId: member.householdId,
            role: member.role,
            status: member.status,
            expiresAt: member.expiresAt
          }
        ]
      : [];

    const decision = AuthorizationService.authorize(
      {
        userId,
        accountStatus: user.accountStatus,
        memberships
      },
      permission,
      {
        type: 'nutrition_plan',
        householdId
      },
      {
        currentTime: currentClockUtcNow()
      }
    );

    if (!decision.allowed) {
      throw new Error(`AUTHORIZATION_FAILED [${decision.reasonCode}]: ${decision.message || 'Access denied.'}`);
    }
  }
}
