/**
 * Pet OS Sprint 7 - Nutrition Domain Canonical Seed Data
 * Implements Volume IX & Volume XXX
 * Populates realistic foods, feeding plans, meal schedules, occurrences,
 * treat logs, hydration logs, appetite history, and food transition plans.
 */

import {
  UserId,
  PetId,
  HouseholdId,
  asFoodId,
  asFeedingPlanId,
  asMealScheduleId,
  asMealOccurrenceId,
  asTreatLogId,
  asHydrationLogId,
  asAppetiteObservationId,
  asDietaryRestrictionId,
  asFoodTransitionPlanId,
  generateUUIDv7
} from '../kernel/ids';
import { currentClockTime, currentClockUtcNow } from '../kernel/time';
import { PetStore } from '../pet-core/store';
import { IdentityStore } from '../identity/store';
import { NutritionStore } from './store';
import {
  FoodItem,
  FeedingPlan,
  MealSchedule,
  MealOccurrence,
  TreatLog,
  HydrationLog,
  AppetiteObservation,
  DietaryRestriction,
  FoodTransitionPlan
} from './types';

export async function seedSprint7NutritionData(ownerUserId: UserId, petId: PetId): Promise<void> {
  // If already seeded for this pet, skip
  if (NutritionStore.listFeedingPlansForPet(petId).length > 0) {
    return;
  }

  const pet = PetStore.findPetById(petId);
  if (!pet) return;

  const householdId = pet.householdId;
  const clockNow = currentClockTime();
  const nowMs = clockNow.getTime();
  const nowIso = currentClockUtcNow();
  const todayDateStr = nowIso.split('T')[0];

  const daysAgo = (days: number) => new Date(nowMs - days * 86400 * 1000).toISOString();
  const hoursAgo = (hours: number) => new Date(nowMs - hours * 3600 * 1000).toISOString();

  // Find members
  const members = IdentityStore.listMembersForHousehold(householdId);
  const caregiverMember = members.find((m) => m.role === 'CAREGIVER')?.userId || ownerUserId;

  // ==========================================
  // 1. FOOD CATALOGUE
  // ==========================================

  const royalCaninFoodId = asFoodId('food-royal-canin-maxi-adult');
  const royalCaninFood: FoodItem = {
    foodId: royalCaninFoodId,
    name: 'Royal Canin Maxi Adult Dry Dog Food',
    brand: 'Royal Canin',
    foodType: 'COMMERCIAL_DRY',
    sourceType: 'CATALOGUE_VERIFIED',
    verificationStatus: 'VERIFIED',
    speciesTarget: 'CANINE',
    lifeStageTarget: 'ADULT',
    form: 'KIBBLE',
    manufacturer: 'Royal Canin SAS',
    ingredients: [
      'Dehydrated poultry protein',
      'Maize',
      'Maize flour',
      'Animal fats',
      'Wheat',
      'Hydrolysed animal proteins',
      'Beet pulp',
      'Fish oil',
      'Soya oil'
    ],
    ingredientsKnown: true,
    energyDensityKcalPerGram: 3.76,
    servingUnitDefault: 'g',
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60)
  };
  NutritionStore.saveFood(royalCaninFood);

  const hillsDigestiveFoodId = asFoodId('food-hills-prescription-id');
  const hillsDigestiveFood: FoodItem = {
    foodId: hillsDigestiveFoodId,
    name: "Hill's Prescription Diet i/d Digestive Care",
    brand: "Hill's",
    foodType: 'VETERINARY_PRESCRIPTION',
    sourceType: 'VETERINARY_DIET',
    verificationStatus: 'CLINICAL_VERIFIED',
    speciesTarget: 'CANINE',
    lifeStageTarget: 'ALL_STAGES',
    form: 'PATE',
    manufacturer: 'Hill’s Pet Nutrition',
    ingredients: [
      'Turkey',
      'Pork liver',
      'Rice',
      'Pork protein isolate',
      'Whole grain corn',
      'Egg product',
      'Chicken liver flavour',
      'Flaxseed',
      'Dried beet pulp'
    ],
    ingredientsKnown: true,
    energyDensityKcalPerGram: 1.02,
    servingUnitDefault: 'can',
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60)
  };
  NutritionStore.saveFood(hillsDigestiveFood);

  const orijenFoodId = asFoodId('food-orijen-regional-red');
  const orijenFood: FoodItem = {
    foodId: orijenFoodId,
    name: 'Orijen Regional Red Grain-Free',
    brand: 'Orijen',
    foodType: 'COMMERCIAL_DRY',
    sourceType: 'CATALOGUE_VERIFIED',
    verificationStatus: 'VERIFIED',
    speciesTarget: 'CANINE',
    lifeStageTarget: 'ALL_STAGES',
    form: 'KIBBLE',
    manufacturer: 'Champion Petfoods',
    ingredients: [
      'Beef',
      'Wild boar',
      'Lamb',
      'Pork',
      'Beef liver',
      'Salmon',
      'Whole red lentils',
      'Pinto beans'
    ],
    ingredientsKnown: true,
    energyDensityKcalPerGram: 3.86,
    servingUnitDefault: 'g',
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60)
  };
  NutritionStore.saveFood(orijenFood);

  const homemadeFoodId = asFoodId('food-custom-chicken-pumpkin');
  const homemadeFood: FoodItem = {
    foodId: homemadeFoodId,
    name: 'Gentle Boiled Chicken & Pumpkin Mash',
    brand: 'Home Kitchen',
    foodType: 'HOMEMADE',
    sourceType: 'OWNER_CREATED',
    verificationStatus: 'UNVERIFIED',
    speciesTarget: 'CANINE',
    lifeStageTarget: 'ADULT',
    form: 'CUSTOM_MIX',
    ingredients: ['Chicken breast', 'Pumpkin puree', 'White rice', 'Bone broth'],
    ingredientsKnown: true,
    servingUnitDefault: 'g',
    householdId,
    createdBy: ownerUserId,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30)
  };
  NutritionStore.saveFood(homemadeFood);

  const unknownMarketFoodId = asFoodId('food-unbranded-local-market-kibble');
  const unknownMarketFood: FoodItem = {
    foodId: unknownMarketFoodId,
    name: 'Local Bulk Kibble (Unbranded)',
    brand: 'Local Agrovet',
    foodType: 'COMMERCIAL_DRY',
    sourceType: 'OWNER_CREATED',
    verificationStatus: 'UNVERIFIED',
    speciesTarget: 'CANINE',
    form: 'KIBBLE',
    ingredients: undefined,
    ingredientsKnown: false, // Mandatory test case: Unknown ingredients preserved as unknown
    servingUnitDefault: 'g',
    householdId,
    createdBy: ownerUserId,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(10)
  };
  NutritionStore.saveFood(unknownMarketFood);

  // ==========================================
  // 2. PRIMARY FEEDING PLAN FOR SIMBA
  // ==========================================

  const isPet001 = (petId as string) === 'pet-001';
  const planId = isPet001 ? asFeedingPlanId('plan-simba-standard-diet') : asFeedingPlanId(`plan-${petId}-standard-diet`);
  const petName = pet.name;
  const feedingPlan: FeedingPlan = {
    feedingPlanId: planId,
    petId,
    householdId,
    title: `${petName} Maintenance Adult Diet`,
    planType: 'PRIMARY_DIET',
    provenance: 'OWNER_DEFINED',
    status: 'ACTIVE',
    isProfessionalPlan: false,
    startsAt: daysAgo(30),
    timezone: 'Africa/Nairobi',
    generalInstructions:
      'Feed twice daily. Clean and refill fresh water bowl after each meal. Store kibble in airtight container.',
    createdBy: ownerUserId,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30),
    version: 1
  };
  NutritionStore.saveFeedingPlan(feedingPlan);

  // Meal Schedules
  const schedBreakfastId = isPet001 ? asMealScheduleId('sched-simba-breakfast') : asMealScheduleId(`sched-${petId}-breakfast`);
  const schedBreakfast: MealSchedule = {
    mealScheduleId: schedBreakfastId,
    feedingPlanId: planId,
    label: 'Morning Breakfast',
    localTime: '07:00',
    targetFoodId: royalCaninFoodId,
    plannedQuantity: { value: 220, unit: 'g' },
    instructions: 'Serve in stainless steel bowl.',
    assignedUserId: caregiverMember,
    active: true,
    sortOrder: 1,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30)
  };
  NutritionStore.saveMealSchedule(schedBreakfast);

  const schedDinnerId = isPet001 ? asMealScheduleId('sched-simba-dinner') : asMealScheduleId(`sched-${petId}-dinner`);
  const schedDinner: MealSchedule = {
    mealScheduleId: schedDinnerId,
    feedingPlanId: planId,
    label: 'Evening Dinner',
    localTime: '19:00',
    targetFoodId: royalCaninFoodId,
    plannedQuantity: { value: 220, unit: 'g' },
    instructions: 'Mix with 50ml warm water.',
    assignedUserId: ownerUserId,
    active: true,
    sortOrder: 2,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30)
  };
  NutritionStore.saveMealSchedule(schedDinner);

  // ==========================================
  // 3. TODAY'S MEAL OCCURRENCES
  // ==========================================

  // Today's breakfast: Completed earlier today
  const occBreakfastId = asMealOccurrenceId(generateUUIDv7());
  const occBreakfast: MealOccurrence = {
    occurrenceId: occBreakfastId,
    petId,
    householdId,
    feedingPlanId: planId,
    mealScheduleId: schedBreakfastId,
    label: 'Morning Breakfast',
    scheduledFor: `${todayDateStr}T07:00:00Z`,
    scheduledLocalTime: '07:00',
    foodId: royalCaninFoodId,
    plannedQuantity: { value: 220, unit: 'g' },
    actualQuantity: { value: 220, unit: 'g' },
    consumedQuantity: { value: 220, unit: 'g' },
    status: 'COMPLETED',
    isUnscheduled: false,
    assignedToUserId: caregiverMember,
    completedByUserId: caregiverMember,
    completedAt: `${todayDateStr}T07:06:22Z`,
    appetiteObservation: 'NORMAL',
    notes: 'Ate enthusiastically within 5 minutes.',
    concurrencyVersion: 2,
    createdAt: `${todayDateStr}T00:01:00Z`,
    updatedAt: `${todayDateStr}T07:06:22Z`
  };
  NutritionStore.saveMealOccurrence(occBreakfast);

  // Today's dinner: Scheduled for this evening
  const occDinnerId = asMealOccurrenceId(generateUUIDv7());
  const occDinner: MealOccurrence = {
    occurrenceId: occDinnerId,
    petId,
    householdId,
    feedingPlanId: planId,
    mealScheduleId: schedDinnerId,
    label: 'Evening Dinner',
    scheduledFor: `${todayDateStr}T19:00:00Z`,
    scheduledLocalTime: '19:00',
    foodId: royalCaninFoodId,
    plannedQuantity: { value: 220, unit: 'g' },
    status: 'SCHEDULED',
    isUnscheduled: false,
    assignedToUserId: ownerUserId,
    concurrencyVersion: 1,
    createdAt: `${todayDateStr}T00:01:00Z`,
    updatedAt: `${todayDateStr}T00:01:00Z`
  };
  NutritionStore.saveMealOccurrence(occDinner);

  // Past 2 days completed occurrences
  for (let i = 1; i <= 2; i++) {
    const pastDate = daysAgo(i).split('T')[0];

    const pastBf: MealOccurrence = {
      occurrenceId: asMealOccurrenceId(generateUUIDv7()),
      petId,
      householdId,
      feedingPlanId: planId,
      mealScheduleId: schedBreakfastId,
      label: 'Morning Breakfast',
      scheduledFor: `${pastDate}T07:00:00Z`,
      scheduledLocalTime: '07:00',
      foodId: royalCaninFoodId,
      plannedQuantity: { value: 220, unit: 'g' },
      actualQuantity: { value: 220, unit: 'g' },
      consumedQuantity: { value: 220, unit: 'g' },
      status: 'COMPLETED',
      isUnscheduled: false,
      completedByUserId: caregiverMember,
      completedAt: `${pastDate}T07:12:00Z`,
      appetiteObservation: 'NORMAL',
      concurrencyVersion: 2,
      createdAt: `${pastDate}T00:00:00Z`,
      updatedAt: `${pastDate}T07:12:00Z`
    };
    NutritionStore.saveMealOccurrence(pastBf);

    const pastDin: MealOccurrence = {
      occurrenceId: asMealOccurrenceId(generateUUIDv7()),
      petId,
      householdId,
      feedingPlanId: planId,
      mealScheduleId: schedDinnerId,
      label: 'Evening Dinner',
      scheduledFor: `${pastDate}T19:00:00Z`,
      scheduledLocalTime: '19:00',
      foodId: royalCaninFoodId,
      plannedQuantity: { value: 220, unit: 'g' },
      actualQuantity: { value: 220, unit: 'g' },
      consumedQuantity: { value: 220, unit: 'g' },
      status: 'COMPLETED',
      isUnscheduled: false,
      completedByUserId: ownerUserId,
      completedAt: `${pastDate}T19:15:00Z`,
      appetiteObservation: 'NORMAL',
      concurrencyVersion: 2,
      createdAt: `${pastDate}T00:00:00Z`,
      updatedAt: `${pastDate}T19:15:00Z`
    };
    NutritionStore.saveMealOccurrence(pastDin);
  }

  // ==========================================
  // 4. TREAT LOGS
  // ==========================================

  const treat1: TreatLog = {
    treatLogId: asTreatLogId(generateUUIDv7()),
    petId,
    householdId,
    treatName: "Zuke's Mini Naturals Beef Training Treats",
    quantity: { value: 4, unit: 'piece' },
    context: 'TRAINING',
    occurredAt: hoursAgo(3),
    givenBy: ownerUserId,
    notes: 'Recall practice in back garden.',
    createdAt: hoursAgo(3)
  };
  NutritionStore.saveTreatLog(treat1);

  const treat2: TreatLog = {
    treatLogId: asTreatLogId(generateUUIDv7()),
    petId,
    householdId,
    treatName: 'Greenies Dental Bone Regular',
    quantity: { value: 1, unit: 'piece' },
    context: 'DENTAL_CHEW',
    occurredAt: daysAgo(1),
    givenBy: caregiverMember,
    notes: 'Post-walk dental reward.',
    createdAt: daysAgo(1)
  };
  NutritionStore.saveTreatLog(treat2);

  // ==========================================
  // 5. HYDRATION LOGS
  // ==========================================

  const hydration1: HydrationLog = {
    hydrationLogId: asHydrationLogId(generateUUIDv7()),
    petId,
    householdId,
    volumeMl: 1200,
    measurementType: 'OFFERED_REFILL',
    waterSource: 'Filtered Kitchen Tap',
    occurredAt: hoursAgo(6),
    recordedBy: caregiverMember,
    notes: 'Filled large clean ceramic bowl.',
    createdAt: hoursAgo(6)
  };
  NutritionStore.saveHydrationLog(hydration1);

  const hydration2: HydrationLog = {
    hydrationLogId: asHydrationLogId(generateUUIDv7()),
    petId,
    householdId,
    volumeMl: 450,
    measurementType: 'MEASURED_CONSUMPTION',
    waterSource: 'Ceramic Bowl',
    occurredAt: hoursAgo(2),
    recordedBy: ownerUserId,
    notes: 'Drank heavily after 45-minute afternoon walk.',
    createdAt: hoursAgo(2)
  };
  NutritionStore.saveHydrationLog(hydration2);

  // ==========================================
  // 6. APPETITE OBSERVATIONS
  // ==========================================

  const app1: AppetiteObservation = {
    observationId: asAppetiteObservationId(generateUUIDv7()),
    petId,
    householdId,
    status: 'NORMAL',
    mealOccurrenceId: occBreakfastId,
    portionConsumedPercentage: 100,
    observedAt: `${todayDateStr}T07:06:22Z`,
    observedBy: caregiverMember,
    notes: 'Normal healthy appetite.',
    createdAt: `${todayDateStr}T07:06:22Z`
  };
  NutritionStore.saveAppetiteObservation(app1);

  const app2: AppetiteObservation = {
    observationId: asAppetiteObservationId(generateUUIDv7()),
    petId,
    householdId,
    status: 'NORMAL',
    portionConsumedPercentage: 100,
    observedAt: daysAgo(1),
    observedBy: ownerUserId,
    notes: 'Finished all food.',
    createdAt: daysAgo(1)
  };
  NutritionStore.saveAppetiteObservation(app2);

  // ==========================================
  // 7. DIETARY RESTRICTIONS
  // ==========================================

  const restriction1: DietaryRestriction = {
    restrictionId: asDietaryRestrictionId('restr-chicken-allergen'),
    petId,
    householdId,
    restrictionType: 'AVOID_INGREDIENT',
    source: 'CLINICAL_ALLERGY_SYNC',
    targetIngredient: 'Poultry',
    description: 'Avoid concentrated poultry by-products due to verified seasonal dermatitis sensitivity.',
    active: true,
    createdAt: daysAgo(40),
    updatedAt: daysAgo(40)
  };
  NutritionStore.saveDietaryRestriction(restriction1);

  // ==========================================
  // 8. DIET TRANSITION PLAN
  // ==========================================

  const transitionPlanId = isPet001 ? asFoodTransitionPlanId('trans-simba-diet-change') : asFoodTransitionPlanId(`trans-${petId}-diet-change`);
  const transitionPlan: FoodTransitionPlan = {
    transitionPlanId,
    petId,
    householdId,
    previousFoodId: orijenFoodId,
    targetFoodId: royalCaninFoodId,
    startDate: daysAgo(3).split('T')[0],
    endDate: new Date(nowMs + 4 * 86400 * 1000).toISOString().split('T')[0],
    status: 'ACTIVE',
    stages: [
      {
        stageNumber: 1,
        label: 'Day 1-2',
        startDayOffset: 0,
        durationDays: 2,
        previousFoodPercentage: 75,
        targetFoodPercentage: 25,
        instructions: 'Introduce 25% Royal Canin mixed with 75% Orijen.'
      },
      {
        stageNumber: 2,
        label: 'Day 3-4',
        startDayOffset: 2,
        durationDays: 2,
        previousFoodPercentage: 50,
        targetFoodPercentage: 50,
        instructions: 'Equal parts Royal Canin and Orijen.'
      },
      {
        stageNumber: 3,
        label: 'Day 5-6',
        startDayOffset: 4,
        durationDays: 2,
        previousFoodPercentage: 25,
        targetFoodPercentage: 75,
        instructions: 'Transitioning to 75% Royal Canin.'
      },
      {
        stageNumber: 4,
        label: 'Day 7+',
        startDayOffset: 6,
        durationDays: 1,
        previousFoodPercentage: 0,
        targetFoodPercentage: 100,
        instructions: '100% Royal Canin.'
      }
    ],
    provenance: 'OWNER_DEFINED',
    createdBy: ownerUserId,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3)
  };
  NutritionStore.saveTransitionPlan(transitionPlan);
}
