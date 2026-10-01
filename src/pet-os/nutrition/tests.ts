/**
 * Pet OS Sprint 7 - Nutrition & Feeding Test Suite
 * Comprehensive automated testing covering unit invariants, state machines,
 * concurrency protections, safety evaluators, authorization, and end-to-end flows.
 */

import {
  UserId,
  HouseholdId,
  PetId,
  FoodId,
  asUserId,
  asHouseholdId,
  asPetId,
  asFoodId,
  asFeedingPlanId,
  asMealOccurrenceId,
  generateUUIDv7
} from '../kernel/ids';
import { currentClockUtcNow, ClockRegistry } from '../kernel/time';
import { PetStore } from '../pet-core/store';
import { IdentityStore } from '../identity/store';
import { HealthStore } from '../health/store';
import { NutritionStore } from './store';
import { NutritionService } from './service';
import { seedSprint7NutritionData } from './seed';
import {
  FoodItem,
  ServingQuantity,
  FeedingPlan,
  MealOccurrence
} from './types';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

export class Sprint7NutritionTestSuite {
  static async runAllTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    const suites = [
      this.testUnitServingQuantitiesAndConversions,
      this.testUnitFoodCatalogueAndUnknownComposition,
      this.testUnitFeedingPlanLifecycleAndSupersession,
      this.testUnitProfessionalPlanProtection,
      this.testUnitMealOccurrenceGeneration,
      this.testUnitMealCompletionAndConcurrency,
      this.testUnitDuplicateFeedingGuardWindow,
      this.testUnitMealSkipAndUnscheduledMeal,
      this.testUnitTreatAndHydrationLogging,
      this.testUnitAppetiteObservations,
      this.testUnitFoodConflictEvaluatorAndAllergies,
      this.testUnitDietTransitionPlanStageEvaluation,
      this.testUnitCaregiverQuickViewLeastPrivilege,
      this.testUnitDeceasedPetBehavior,
      this.testSecurityCrossHouseholdIsolation,
      this.testSecurityTemporaryCaregiverPermissions,
      this.testIntegrationCompleteNutritionLifecycle
    ];

    for (const testFn of suites) {
      const start = performance.now();
      try {
        await testFn.call(this);
        results.push({
          suite: 'Sprint 7: Nutrition & Feeding',
          name: testFn.name.replace(/^test/, ''),
          passed: true,
          durationMs: Math.round(performance.now() - start)
        });
      } catch (err: any) {
        results.push({
          suite: 'Sprint 7: Nutrition & Feeding',
          name: testFn.name.replace(/^test/, ''),
          passed: false,
          durationMs: Math.round(performance.now() - start),
          error: err?.message || String(err)
        });
      }
    }

    return results;
  }

  // ==========================================================================
  // 1. UNIT: SERVING QUANTITIES & CONVERSIONS
  // ==========================================================================
  private static async testUnitServingQuantitiesAndConversions(): Promise<void> {
    const qtyGrams: ServingQuantity = { value: 500, unit: 'g' };

    // Same unit
    const same = NutritionService.convertServingQuantity(qtyGrams, 'g');
    if (same !== 500) throw new Error(`Expected 500g, got ${same}`);

    // Grams to Kilograms (1000g = 1kg)
    const kg = NutritionService.convertServingQuantity(qtyGrams, 'kg');
    if (kg !== 0.5) throw new Error(`Expected 0.5kg, got ${kg}`);

    // Kilograms to Grams
    const fromKg = NutritionService.convertServingQuantity({ value: 1.5, unit: 'kg' }, 'g');
    if (fromKg !== 1500) throw new Error(`Expected 1500g, got ${fromKg}`);

    // Invalid cross-dimensional conversion (volume to weight without density)
    let caught = false;
    try {
      NutritionService.convertServingQuantity({ value: 1, unit: 'cup' }, 'g');
    } catch (e: any) {
      if (e.message.includes('CANNOT_CONVERT_UNIT_WITHOUT_DENSITY')) {
        caught = true;
      }
    }
    if (!caught) {
      throw new Error('Expected CANNOT_CONVERT_UNIT_WITHOUT_DENSITY error when converting cups to grams');
    }
  }

  // ==========================================================================
  // 2. UNIT: FOOD CATALOGUE & UNKNOWN COMPOSITION
  // ==========================================================================
  private static async testUnitFoodCatalogueAndUnknownComposition(): Promise<void> {
    const userId = asUserId('test-owner-id');

    // Case 1: Food with known ingredients
    const knownFood = NutritionService.createFoodItem({
      name: 'Purina Pro Plan Adult',
      brand: 'Purina',
      foodType: 'COMMERCIAL_DRY',
      sourceType: 'CATALOGUE_VERIFIED',
      speciesTarget: 'CANINE',
      form: 'KIBBLE',
      ingredientsKnown: true,
      ingredients: ['Salmon', 'Rice', 'Barley', 'Fish meal'],
      energyDensityKcalPerGram: 3.9,
      servingUnitDefault: 'g',
      userId
    });

    if (!knownFood.ingredientsKnown || !knownFood.ingredients || knownFood.ingredients.length !== 4) {
      throw new Error('Known food ingredients were not preserved correctly');
    }

    // Case 2: Unknown ingredient food (Volume IX invariant: must be stored as UNKNOWN, never guessed)
    const unknownFood = NutritionService.createFoodItem({
      name: 'Unlabeled Bulk Dog Biscuits',
      brand: 'Local Bakery',
      foodType: 'TREAT',
      sourceType: 'OWNER_CREATED',
      speciesTarget: 'CANINE',
      form: 'POWDER',
      ingredientsKnown: false,
      ingredients: undefined,
      servingUnitDefault: 'piece',
      userId
    });

    if (unknownFood.ingredientsKnown !== false || unknownFood.ingredients !== undefined) {
      throw new Error('Unknown ingredient food must have ingredientsKnown: false and undefined ingredients');
    }
  }

  // ==========================================================================
  // 3. UNIT: FEEDING PLAN LIFECYCLE & SUPERSESSION
  // ==========================================================================
  private static async testUnitFeedingPlanLifecycleAndSupersession(): Promise<void> {
    const owner = this.setupTestContext();
    const petId = owner.petId;
    const householdId = owner.householdId;
    const userId = owner.userId;

    // Create First Primary Plan
    const plan1 = NutritionService.createFeedingPlan({
      petId,
      householdId,
      title: 'Initial Puppy Diet',
      planType: 'PRIMARY_DIET',
      provenance: 'OWNER_DEFINED',
      userId,
      schedules: [
        {
          label: 'Morning',
          localTime: '08:00',
          targetFoodId: asFoodId('food-royal-canin-maxi-adult'),
          plannedQuantity: { value: 150, unit: 'g' }
        }
      ]
    });

    if (plan1.status !== 'ACTIVE') {
      throw new Error('Newly created plan should be ACTIVE');
    }

    const activePlan = NutritionStore.findActivePlanForPet(petId);
    if (!activePlan || activePlan.feedingPlanId !== plan1.feedingPlanId) {
      throw new Error('Active plan lookup failed for plan 1');
    }

    // Create Second Primary Plan: Must supersede plan 1 automatically
    const plan2 = NutritionService.createFeedingPlan({
      petId,
      householdId,
      title: 'Upgraded Adult Diet',
      planType: 'PRIMARY_DIET',
      provenance: 'OWNER_DEFINED',
      userId,
      supersedesPlanId: plan1.feedingPlanId,
      schedules: [
        {
          label: 'Morning',
          localTime: '07:30',
          targetFoodId: asFoodId('food-royal-canin-maxi-adult'),
          plannedQuantity: { value: 200, unit: 'g' }
        }
      ]
    });

    const supersededPlan1 = NutritionStore.findFeedingPlanById(plan1.feedingPlanId);
    if (!supersededPlan1 || supersededPlan1.status !== 'SUPERSEDED') {
      throw new Error('Plan 1 was not superseded when Plan 2 was activated');
    }
    if (supersededPlan1.supersededBy !== plan2.feedingPlanId) {
      throw new Error('Superseded link was not recorded correctly on Plan 1');
    }

    const currentActive = NutritionStore.findActivePlanForPet(petId);
    if (!currentActive || currentActive.feedingPlanId !== plan2.feedingPlanId) {
      throw new Error('Plan 2 is not the active plan');
    }
  }

  // ==========================================================================
  // 4. UNIT: PROFESSIONAL PLAN PROTECTION
  // ==========================================================================
  private static async testUnitProfessionalPlanProtection(): Promise<void> {
    const owner = this.setupTestContext();

    // Create a veterinary-defined plan
    const vetPlan = NutritionService.createFeedingPlan({
      petId: owner.petId,
      householdId: owner.householdId,
      title: 'Veterinary Renal Support Diet',
      planType: 'PRIMARY_DIET',
      provenance: 'VETERINARIAN_DEFINED',
      isProfessionalPlan: true,
      prescribedByProviderId: 'vet-provider-001',
      prescribedByProviderName: 'Dr. Sarah Gitau, DVM',
      userId: owner.userId
    });

    if (!vetPlan.isProfessionalPlan) {
      throw new Error('Plan must be flagged as isProfessionalPlan: true');
    }

    // Attempt to pause/alter without professional manage permission:
    // Create a normal caregiver member who lacks 'pet.nutrition.professional_plan.manage'
    const caregiverId = asUserId('temp-caregiver-user');
    IdentityStore.saveUser({
      userId: caregiverId,
      email: 'caregiver@example.com',
      normalizedEmail: 'caregiver@example.com',
      passwordHash: 'dummy',
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      createdAt: currentClockUtcNow(),
      updatedAt: currentClockUtcNow(),
      policyAcceptedAt: currentClockUtcNow(),
      policyVersion: '1.0'
    });
    IdentityStore.saveMembership({
      membershipId: generateUUIDv7() as any,
      householdId: owner.householdId,
      userId: caregiverId,
      role: 'CAREGIVER',
      status: 'ACTIVE',
      joinedAt: currentClockUtcNow(),
      updatedAt: currentClockUtcNow()
    });

    let rejected = false;
    try {
      NutritionService.pauseFeedingPlan(vetPlan.feedingPlanId, caregiverId, 'Caregiver wanting to change diet');
    } catch (e: any) {
      if (e.message.includes('AUTHORIZATION_FAILED')) {
        rejected = true;
      }
    }

    if (!rejected) {
      throw new Error('Caregiver without professional_plan.manage permission was able to pause professional plan');
    }
  }

  // ==========================================================================
  // 5. UNIT: MEAL OCCURRENCE GENERATION
  // ==========================================================================
  private static async testUnitMealOccurrenceGeneration(): Promise<void> {
    const owner = this.setupTestContext();
    const today = currentClockUtcNow().split('T')[0];

    // Create plan with 2 schedules
    NutritionService.createFeedingPlan({
      petId: owner.petId,
      householdId: owner.householdId,
      title: 'Daily Feeding Plan',
      planType: 'PRIMARY_DIET',
      provenance: 'OWNER_DEFINED',
      userId: owner.userId,
      schedules: [
        {
          label: 'Breakfast',
          localTime: '07:00',
          targetFoodId: asFoodId('food-royal-canin-maxi-adult'),
          plannedQuantity: { value: 100, unit: 'g' }
        },
        {
          label: 'Dinner',
          localTime: '19:00',
          targetFoodId: asFoodId('food-royal-canin-maxi-adult'),
          plannedQuantity: { value: 100, unit: 'g' }
        }
      ]
    });

    const occs = NutritionService.generateOccurrencesForDate(owner.petId, today);
    if (occs.length !== 2) {
      throw new Error(`Expected 2 meal occurrences generated for today, got ${occs.length}`);
    }

    // Idempotency check: Generating again should return the exact same 2 occurrences
    const occsSecondCall = NutritionService.generateOccurrencesForDate(owner.petId, today);
    if (occsSecondCall.length !== 2) {
      throw new Error(`Idempotency check failed: expected 2 occurrences, got ${occsSecondCall.length}`);
    }
  }

  // ==========================================================================
  // 6. UNIT: MEAL COMPLETION & CONCURRENCY
  // ==========================================================================
  private static async testUnitMealCompletionAndConcurrency(): Promise<void> {
    const owner = this.setupTestContext();
    const today = currentClockUtcNow().split('T')[0];

    NutritionService.createFeedingPlan({
      petId: owner.petId,
      householdId: owner.householdId,
      title: 'Concurrency Test Plan',
      planType: 'PRIMARY_DIET',
      provenance: 'OWNER_DEFINED',
      userId: owner.userId,
      schedules: [
        {
          label: 'Breakfast',
          localTime: '08:00',
          targetFoodId: asFoodId('food-royal-canin-maxi-adult'),
          plannedQuantity: { value: 150, unit: 'g' }
        }
      ]
    });

    const occs = NutritionService.generateOccurrencesForDate(owner.petId, today);
    const occurrence = occs[0];

    // User A completes the meal
    const completed = NutritionService.completeMeal({
      occurrenceId: occurrence.occurrenceId,
      userId: owner.userId,
      actualQuantity: { value: 150, unit: 'g' },
      consumedQuantity: { value: 150, unit: 'g' },
      appetiteObservation: 'NORMAL',
      concurrencyVersion: occurrence.concurrencyVersion
    });

    if (completed.status !== 'COMPLETED') {
      throw new Error('Occurrence status should be COMPLETED');
    }
    if (completed.concurrencyVersion !== occurrence.concurrencyVersion + 1) {
      throw new Error('Concurrency version was not incremented');
    }

    // User B attempts to complete the same meal concurrently
    let caughtAlreadyCompleted = false;
    try {
      NutritionService.completeMeal({
        occurrenceId: occurrence.occurrenceId,
        userId: owner.userId,
        concurrencyVersion: occurrence.concurrencyVersion
      });
    } catch (e: any) {
      if (e.message.includes('ALREADY_COMPLETED')) {
        caughtAlreadyCompleted = true;
      }
    }

    if (!caughtAlreadyCompleted) {
      throw new Error('Concurrent completion did not throw ALREADY_COMPLETED error');
    }
  }

  // ==========================================================================
  // 7. UNIT: DUPLICATE FEEDING GUARD WINDOW
  // ==========================================================================
  private static async testUnitDuplicateFeedingGuardWindow(): Promise<void> {
    const owner = this.setupTestContext();
    const today = currentClockUtcNow().split('T')[0];

    NutritionService.createFeedingPlan({
      petId: owner.petId,
      householdId: owner.householdId,
      title: 'Duplicate Guard Plan',
      planType: 'PRIMARY_DIET',
      provenance: 'OWNER_DEFINED',
      userId: owner.userId,
      schedules: [
        {
          label: 'Meal 1',
          localTime: '09:00',
          targetFoodId: asFoodId('food-royal-canin-maxi-adult'),
          plannedQuantity: { value: 100, unit: 'g' }
        },
        {
          label: 'Meal 2',
          localTime: '09:30',
          targetFoodId: asFoodId('food-royal-canin-maxi-adult'),
          plannedQuantity: { value: 100, unit: 'g' }
        }
      ]
    });

    const occs = NutritionService.generateOccurrencesForDate(owner.petId, today);
    const meal1 = occs[0];
    const meal2 = occs[1];

    // Complete Meal 1
    NutritionService.completeMeal({
      occurrenceId: meal1.occurrenceId,
      userId: owner.userId,
      concurrencyVersion: meal1.concurrencyVersion
    });

    // Attempt to complete Meal 2 right away (within 60 min guard window) without override:
    let guardTriggered = false;
    try {
      NutritionService.completeMeal({
        occurrenceId: meal2.occurrenceId,
        userId: owner.userId,
        concurrencyVersion: meal2.concurrencyVersion,
        allowDuplicateOverride: false
      });
    } catch (e: any) {
      if (e.message.includes('DUPLICATE_FEEDING_GUARD')) {
        guardTriggered = true;
      }
    }

    if (!guardTriggered) {
      throw new Error('Duplicate feeding guard did not trigger within 60 minutes');
    }

    // With explicit duplicate override, it should succeed
    const overridden = NutritionService.completeMeal({
      occurrenceId: meal2.occurrenceId,
      userId: owner.userId,
      concurrencyVersion: meal2.concurrencyVersion,
      allowDuplicateOverride: true
    });

    if (overridden.status !== 'COMPLETED') {
      throw new Error('Meal 2 should be COMPLETED after duplicate override');
    }
  }

  // ==========================================================================
  // 8. UNIT: MEAL SKIP & UNSCHEDULED MEAL
  // ==========================================================================
  private static async testUnitMealSkipAndUnscheduledMeal(): Promise<void> {
    const owner = this.setupTestContext();
    const today = currentClockUtcNow().split('T')[0];

    NutritionService.createFeedingPlan({
      petId: owner.petId,
      householdId: owner.householdId,
      title: 'Skip Test Plan',
      planType: 'PRIMARY_DIET',
      provenance: 'OWNER_DEFINED',
      userId: owner.userId,
      schedules: [
        {
          label: 'Lunch',
          localTime: '13:00',
          targetFoodId: asFoodId('food-royal-canin-maxi-adult'),
          plannedQuantity: { value: 100, unit: 'g' }
        }
      ]
    });

    const occs = NutritionService.generateOccurrencesForDate(owner.petId, today);
    const meal = occs[0];

    // Skip meal
    const skipped = NutritionService.skipMeal({
      occurrenceId: meal.occurrenceId,
      userId: owner.userId,
      reason: 'Pet fasting prior to scheduled afternoon dental cleaning',
      concurrencyVersion: meal.concurrencyVersion
    });

    if (skipped.status !== 'SKIPPED' || !skipped.skipReason) {
      throw new Error('Skipped meal did not set status or reason');
    }

    // Log Unscheduled Meal
    const unscheduled = NutritionService.logUnscheduledMeal({
      petId: owner.petId,
      householdId: owner.householdId,
      label: 'Post-walk extra snack',
      foodId: asFoodId('food-royal-canin-maxi-adult'),
      quantity: { value: 50, unit: 'g' },
      userId: owner.userId,
      notes: 'Calorie top-up after long hike'
    });

    if (!unscheduled.isUnscheduled || unscheduled.status !== 'COMPLETED') {
      throw new Error('Unscheduled meal was not recorded correctly');
    }
  }

  // ==========================================================================
  // 9. UNIT: TREAT & HYDRATION LOGGING
  // ==========================================================================
  private static async testUnitTreatAndHydrationLogging(): Promise<void> {
    const owner = this.setupTestContext();

    // Log Treat
    const treat = NutritionService.logTreat({
      petId: owner.petId,
      householdId: owner.householdId,
      treatName: 'Freeze Dried Beef Liver',
      quantity: { value: 3, unit: 'piece' },
      context: 'TRAINING',
      userId: owner.userId,
      notes: 'High value reward'
    });

    if (!treat.treatLogId || treat.quantity.value !== 3) {
      throw new Error('Treat log was not saved properly');
    }

    // Log Hydration: Refill (Offered)
    const refill = NutritionService.logHydration({
      petId: owner.petId,
      householdId: owner.householdId,
      volumeMl: 1000,
      measurementType: 'OFFERED_REFILL',
      waterSource: 'Filtered Tap',
      userId: owner.userId
    });

    if (refill.measurementType !== 'OFFERED_REFILL') {
      throw new Error('Hydration refill type mismatch');
    }

    // Log Hydration: Measured Consumption
    const drunk = NutritionService.logHydration({
      petId: owner.petId,
      householdId: owner.householdId,
      volumeMl: 300,
      measurementType: 'MEASURED_CONSUMPTION',
      userId: owner.userId
    });

    if (drunk.measurementType !== 'MEASURED_CONSUMPTION') {
      throw new Error('Hydration consumed type mismatch');
    }
  }

  // ==========================================================================
  // 10. UNIT: APPETITE OBSERVATIONS
  // ==========================================================================
  private static async testUnitAppetiteObservations(): Promise<void> {
    const owner = this.setupTestContext();

    const obs = NutritionService.recordAppetiteObservation({
      petId: owner.petId,
      householdId: owner.householdId,
      status: 'REDUCED',
      portionConsumedPercentage: 50,
      userId: owner.userId,
      notes: 'Ate slowly, left half portion'
    });

    if (obs.status !== 'REDUCED' || obs.portionConsumedPercentage !== 50) {
      throw new Error('Appetite observation was not stored properly');
    }

    const allObs = NutritionStore.listAppetiteObservationsForPet(owner.petId);
    if (allObs.length === 0) {
      throw new Error('No appetite observations found for pet');
    }
  }

  // ==========================================================================
  // 11. UNIT: FOOD CONFLICT EVALUATOR & ALLERGIES
  // ==========================================================================
  private static async testUnitFoodConflictEvaluatorAndAllergies(): Promise<void> {
    const owner = this.setupTestContext();

    // 1. Record an allergy in HealthStore for Chicken
    HealthStore.saveAllergy({
      allergyId: generateUUIDv7() as any,
      petId: owner.petId,
      allergen: 'Chicken',
      allergenCategory: 'FOOD',
      allergyType: 'ALLERGY',
      reaction: 'Pruritus and erythema',
      severity: 'MODERATE',
      firstObservedPrecision: 'EXACT',
      status: 'ACTIVE',
      provenance: 'VETERINARY_PROFESSIONAL',
      verificationStatus: 'VERIFIED',
      createdAt: currentClockUtcNow(),
      updatedAt: currentClockUtcNow()
    });

    // 2. Test food containing Chicken -> Must return CONFIRMED_RECORDED_CONFLICT
    const chickenFood = NutritionService.createFoodItem({
      name: 'Chicken Rice Formula',
      brand: 'BrandX',
      foodType: 'COMMERCIAL_DRY',
      sourceType: 'CATALOGUE_VERIFIED',
      speciesTarget: 'CANINE',
      form: 'KIBBLE',
      ingredientsKnown: true,
      ingredients: ['Chicken', 'Brown Rice', 'Flaxseed'],
      servingUnitDefault: 'g',
      userId: owner.userId
    });

    const conflict1 = NutritionService.evaluateFoodConflict(owner.petId, chickenFood.foodId);
    if (conflict1.classification !== 'CONFIRMED_RECORDED_CONFLICT') {
      throw new Error(`Expected CONFIRMED_RECORDED_CONFLICT, got ${conflict1.classification}`);
    }
    if (conflict1.isSafe !== false) {
      throw new Error('Invariant violation: isSafe must ALWAYS be false');
    }

    // 3. Test food with unknown ingredients -> Must return UNKNOWN (never assume safe!)
    const unknownFood = NutritionService.createFoodItem({
      name: 'Mystery Agrovet Kibble',
      brand: 'Unknown',
      foodType: 'COMMERCIAL_DRY',
      sourceType: 'OWNER_CREATED',
      speciesTarget: 'CANINE',
      form: 'KIBBLE',
      ingredientsKnown: false,
      ingredients: undefined,
      servingUnitDefault: 'g',
      userId: owner.userId
    });

    const conflict2 = NutritionService.evaluateFoodConflict(owner.petId, unknownFood.foodId);
    if (conflict2.classification !== 'UNKNOWN') {
      throw new Error(`Expected UNKNOWN for unlisted ingredients, got ${conflict2.classification}`);
    }
    if (conflict2.isSafe !== false) {
      throw new Error('Invariant violation: isSafe must be false even for unknown');
    }

    // 4. Test food without chicken -> Must return NO_KNOWN_CONFLICT (and still isSafe: false)
    const beefFood = NutritionService.createFoodItem({
      name: 'Pure Beef & Oats',
      brand: 'BrandY',
      foodType: 'COMMERCIAL_DRY',
      sourceType: 'CATALOGUE_VERIFIED',
      speciesTarget: 'CANINE',
      form: 'KIBBLE',
      ingredientsKnown: true,
      ingredients: ['Beef', 'Oats', 'Salmon oil'],
      servingUnitDefault: 'g',
      userId: owner.userId
    });

    const conflict3 = NutritionService.evaluateFoodConflict(owner.petId, beefFood.foodId);
    if (conflict3.classification !== 'NO_KNOWN_CONFLICT') {
      throw new Error(`Expected NO_KNOWN_CONFLICT, got ${conflict3.classification}`);
    }
    if (conflict3.isSafe !== false) {
      throw new Error('Invariant violation: Pet OS must never output SAFE: true');
    }
  }

  // ==========================================================================
  // 12. UNIT: DIET TRANSITION PLAN STAGE EVALUATION
  // ==========================================================================
  private static async testUnitDietTransitionPlanStageEvaluation(): Promise<void> {
    const owner = this.setupTestContext();
    const todayStr = currentClockUtcNow().split('T')[0];

    const plan = NutritionService.createFoodTransitionPlan({
      petId: owner.petId,
      householdId: owner.householdId,
      previousFoodId: asFoodId('food-royal-canin-maxi-adult'),
      targetFoodId: asFoodId('food-orijen-regional-red'),
      startDate: todayStr,
      durationDays: 7,
      userId: owner.userId
    });

    if (plan.stages.length !== 4) {
      throw new Error(`Expected 4 standard transition stages, got ${plan.stages.length}`);
    }

    const currentStage = NutritionService.getActiveTransitionStage(plan);
    if (currentStage.stageNumber !== 1 || currentStage.previousFoodPercentage !== 75) {
      throw new Error(`Expected Stage 1 (75% old / 25% new) on start date, got Stage ${currentStage.stageNumber}`);
    }
  }

  // ==========================================================================
  // 13. UNIT: CAREGIVER QUICK VIEW (LEAST PRIVILEGE)
  // ==========================================================================
  private static async testUnitCaregiverQuickViewLeastPrivilege(): Promise<void> {
    const owner = this.setupTestContext();
    await seedSprint7NutritionData(owner.userId, owner.petId);

    const quickView = NutritionService.getCaregiverQuickView(owner.petId);

    if (!quickView.petName || quickView.petName.length === 0) {
      throw new Error('Quick view should include pet name');
    }
    if (!quickView.todayMeals || quickView.todayMeals.length === 0) {
      throw new Error('Quick view should include today meals');
    }
    if (!quickView.essentialFeedingInstructions) {
      throw new Error('Quick view should include instructions');
    }
  }

  // ==========================================================================
  // 14. UNIT: DECEASED PET BEHAVIOR
  // ==========================================================================
  private static async testUnitDeceasedPetBehavior(): Promise<void> {
    const owner = this.setupTestContext();

    // Mark pet as deceased in PetStore
    const pet = PetStore.findPetById(owner.petId);
    if (pet) {
      pet.status = 'DECEASED';
      PetStore.savePet(pet);
    }

    // Try to create feeding plan -> must reject
    let planRejected = false;
    try {
      NutritionService.createFeedingPlan({
        petId: owner.petId,
        householdId: owner.householdId,
        title: 'Diet for Deceased Pet',
        planType: 'PRIMARY_DIET',
        provenance: 'OWNER_DEFINED',
        userId: owner.userId
      });
    } catch (e: any) {
      if (e.message.includes('deceased')) {
        planRejected = true;
      }
    }

    if (!planRejected) {
      throw new Error('Deceased pet was allowed to create a feeding plan');
    }
  }

  // ==========================================================================
  // 15. SECURITY: CROSS-HOUSEHOLD ISOLATION
  // ==========================================================================
  private static async testSecurityCrossHouseholdIsolation(): Promise<void> {
    const householdA = asHouseholdId('household-alpha');
    const householdB = asHouseholdId('household-beta');

    const userB = asUserId('user-beta');
    IdentityStore.saveUser({
      userId: userB,
      email: 'userb@example.com',
      normalizedEmail: 'userb@example.com',
      passwordHash: 'dummy',
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      createdAt: currentClockUtcNow(),
      updatedAt: currentClockUtcNow(),
      policyAcceptedAt: currentClockUtcNow(),
      policyVersion: '1.0'
    });
    IdentityStore.saveMembership({
      membershipId: generateUUIDv7() as any,
      householdId: householdB,
      userId: userB,
      role: 'HOUSEHOLD_OWNER',
      status: 'ACTIVE',
      joinedAt: currentClockUtcNow(),
      updatedAt: currentClockUtcNow()
    });

    const petA = asPetId('pet-alpha');
    PetStore.savePet({
      petId: petA,
      householdId: householdA,
      name: 'Alpha Dog',
      speciesCode: 'CANIS_LUPUS_FAMILIARIS',
      breedCode: 'GERMAN_SHEPHERD',
      mixedBreed: false,
      unknownBreed: false,
      sex: 'MALE',
      reproductiveStatus: 'INTACT',
      dateOfBirth: '2022-01-01',
      birthdatePrecision: 'EXACT',
      estimatedBirthdate: false,
      primaryColor: 'Black & Tan',
      sizeClassification: 'LARGE',
      lifecycleStage: 'ADULT',
      status: 'ACTIVE',
      createdBy: userB,
      createdAt: currentClockUtcNow(),
      updatedAt: currentClockUtcNow(),
      version: 1,
      metadata: {}
    });

    // User B attempts to create feeding plan for Pet A in Household A -> Must be denied
    let denied = false;
    try {
      NutritionService.createFeedingPlan({
        petId: petA,
        householdId: householdA,
        title: 'Unauthorized Diet',
        planType: 'PRIMARY_DIET',
        provenance: 'OWNER_DEFINED',
        userId: userB
      });
    } catch (e: any) {
      if (e.message.includes('AUTHORIZATION_FAILED')) {
        denied = true;
      }
    }

    if (!denied) {
      throw new Error('Cross-household feeding plan creation was not rejected by authorization engine');
    }
  }

  // ==========================================================================
  // 16. SECURITY: TEMPORARY CAREGIVER PERMISSIONS
  // ==========================================================================
  private static async testSecurityTemporaryCaregiverPermissions(): Promise<void> {
    const owner = this.setupTestContext();

    const tempCaregiverId = asUserId('temp-caregiver-user-2');
    IdentityStore.saveUser({
      userId: tempCaregiverId,
      email: 'temp@example.com',
      normalizedEmail: 'temp@example.com',
      passwordHash: 'dummy',
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      createdAt: currentClockUtcNow(),
      updatedAt: currentClockUtcNow(),
      policyAcceptedAt: currentClockUtcNow(),
      policyVersion: '1.0'
    });
    IdentityStore.saveMembership({
      membershipId: generateUUIDv7() as any,
      householdId: owner.householdId,
      userId: tempCaregiverId,
      role: 'TEMPORARY_CAREGIVER',
      status: 'ACTIVE',
      joinedAt: currentClockUtcNow(),
      updatedAt: currentClockUtcNow()
    });

    // Temporary caregiver CANNOT create feeding plan
    let planCreationDenied = false;
    try {
      NutritionService.createFeedingPlan({
        petId: owner.petId,
        householdId: owner.householdId,
        title: 'Temp Walker Feeding Plan',
        planType: 'PRIMARY_DIET',
        provenance: 'OWNER_DEFINED',
        userId: tempCaregiverId
      });
    } catch (e: any) {
      if (e.message.includes('AUTHORIZATION_FAILED')) {
        planCreationDenied = true;
      }
    }

    if (!planCreationDenied) {
      throw new Error('TEMPORARY_CAREGIVER was allowed to create a feeding plan');
    }
  }

  // ==========================================================================
  // 17. INTEGRATION: COMPLETE NUTRITION LIFECYCLE
  // ==========================================================================
  private static async testIntegrationCompleteNutritionLifecycle(): Promise<void> {
    const owner = this.setupTestContext();
    const todayStr = currentClockUtcNow().split('T')[0];

    // 1. Food creation
    const food = NutritionService.createFoodItem({
      name: 'Lifecycle Lamb & Rice',
      brand: 'TestBrand',
      foodType: 'COMMERCIAL_DRY',
      sourceType: 'CATALOGUE_VERIFIED',
      speciesTarget: 'CANINE',
      form: 'KIBBLE',
      ingredientsKnown: true,
      ingredients: ['Lamb', 'Brown Rice', 'Carrots'],
      servingUnitDefault: 'g',
      userId: owner.userId
    });

    // 2. Plan creation
    const plan = NutritionService.createFeedingPlan({
      petId: owner.petId,
      householdId: owner.householdId,
      title: 'Lifecycle Integration Plan',
      planType: 'PRIMARY_DIET',
      provenance: 'OWNER_DEFINED',
      userId: owner.userId,
      schedules: [
        {
          label: 'Morning Meal',
          localTime: '08:00',
          targetFoodId: food.foodId,
          plannedQuantity: { value: 180, unit: 'g' }
        }
      ]
    });

    // 3. Occurrence generation
    const occs = NutritionService.generateOccurrencesForDate(owner.petId, todayStr);
    if (occs.length === 0) throw new Error('No occurrences generated');

    // 4. Meal completion
    const completed = NutritionService.completeMeal({
      occurrenceId: occs[0].occurrenceId,
      userId: owner.userId,
      concurrencyVersion: occs[0].concurrencyVersion,
      appetiteObservation: 'NORMAL'
    });

    if (completed.status !== 'COMPLETED') throw new Error('Meal completion failed');

    // 5. Check Profile Read Model
    const profile = NutritionService.getNutritionProfile(owner.petId);
    if (!profile.activeFeedingPlan || profile.activeFeedingPlan.feedingPlanId !== plan.feedingPlanId) {
      throw new Error('Profile active plan did not match created plan');
    }
    if (profile.recentAppetiteSummary.lastObservedStatus !== 'NORMAL') {
      throw new Error('Appetite summary did not reflect completed meal observation');
    }
  }

  // ==========================================================================
  // HELPER: SETUP CLEAN TEST CONTEXT
  // ==========================================================================
  private static setupTestContext(): {
    userId: UserId;
    householdId: HouseholdId;
    petId: PetId;
  } {
    NutritionStore.clear();

    const userId = asUserId(`test-user-${generateUUIDv7()}`);
    const householdId = asHouseholdId(`test-hh-${generateUUIDv7()}`);
    const petId = asPetId(`test-pet-${generateUUIDv7()}`);

    IdentityStore.saveUser({
      userId,
      email: 'owner@example.com',
      normalizedEmail: 'owner@example.com',
      passwordHash: 'dummy',
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      createdAt: currentClockUtcNow(),
      updatedAt: currentClockUtcNow(),
      policyAcceptedAt: currentClockUtcNow(),
      policyVersion: '1.0'
    });

    IdentityStore.saveMembership({
      membershipId: generateUUIDv7() as any,
      householdId,
      userId,
      role: 'HOUSEHOLD_OWNER',
      status: 'ACTIVE',
      joinedAt: currentClockUtcNow(),
      updatedAt: currentClockUtcNow()
    });

    PetStore.savePet({
      petId,
      householdId,
      name: 'Simba',
      speciesCode: 'CANIS_LUPUS_FAMILIARIS',
      breedCode: 'RHODESIAN_RIDGEBACK',
      mixedBreed: false,
      unknownBreed: false,
      sex: 'MALE',
      reproductiveStatus: 'STERILIZED',
      dateOfBirth: '2021-04-12',
      birthdatePrecision: 'EXACT',
      estimatedBirthdate: false,
      primaryColor: 'Golden',
      sizeClassification: 'LARGE',
      lifecycleStage: 'ADULT',
      status: 'ACTIVE',
      createdBy: userId,
      createdAt: currentClockUtcNow(),
      updatedAt: currentClockUtcNow(),
      version: 1,
      metadata: {}
    });

    return { userId, householdId, petId };
  }
}
