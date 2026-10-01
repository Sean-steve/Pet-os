/**
 * Pet OS Sprint 7 - Nutrition, Feeding Plans, Meal Execution, Hydration & Dietary Safety
 * Implements Volume IX (Nutrition & Feeding Architecture), Volume IV, Volume XXVI, Volume XXX, Volume XXXI
 *
 * Safety Principles:
 * - All quantities MUST include units (ServingQuantity).
 * - Incomplete user logs MUST NOT be treated as complete intake.
 * - Unknown ingredient information must be stored as UNKNOWN, never guessed.
 * - Do not invent veterinary diets or diagnose nutritional diseases.
 * - Food recommendations/evaluations MUST strictly respect known allergies.
 * - Never declare a food as "SAFE: TRUE" - only "NO_KNOWN_CONFLICT", "POTENTIAL_CONFLICT", "CONFIRMED_RECORDED_CONFLICT", or "UNKNOWN".
 * - Prevent duplicate feeding via guard window and concurrency check.
 */

import {
  UserId,
  HouseholdId,
  PetId,
  FoodId,
  FeedingPlanId,
  MealScheduleId,
  MealOccurrenceId,
  MealLogId,
  TreatLogId,
  HydrationLogId,
  AppetiteObservationId,
  DietaryRestrictionId,
  FoodTransitionPlanId,
  FoodTransitionStageId
} from '../kernel/ids';

// ==========================================
// FOOD PRODUCT & CATALOGUE MODELS
// ==========================================

export type FoodType =
  | 'COMMERCIAL_DRY'
  | 'COMMERCIAL_WET'
  | 'RAW'
  | 'FRESH_COOKED'
  | 'HOMEMADE'
  | 'VETERINARY_PRESCRIPTION'
  | 'SUPPLEMENT'
  | 'TREAT';

export type FoodSourceType =
  | 'CATALOGUE_VERIFIED'
  | 'MERCHANT_SUPPLIED'
  | 'OWNER_CREATED'
  | 'VETERINARY_DIET'
  | 'IMPORTED'
  | 'SYSTEM_REFERENCE';

export type FoodVerificationStatus =
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'COMMUNITY_CONTRIBUTED'
  | 'CLINICAL_VERIFIED';

export type TargetSpecies = 'CANINE' | 'FELINE' | 'ALL';

export type LifeStageTarget = 'PUPPY' | 'ADULT' | 'SENIOR' | 'ALL_STAGES';

export type FoodForm =
  | 'KIBBLE'
  | 'PATE'
  | 'CHUNKS_IN_GRAVY'
  | 'FREEZE_DRIED'
  | 'RAW_PATTY'
  | 'LIQUID'
  | 'POWDER'
  | 'CUSTOM_MIX';

export type ServingUnit =
  | 'g'
  | 'kg'
  | 'ml'
  | 'cup'
  | 'portion'
  | 'piece'
  | 'can'
  | 'scoop';

export interface ServingQuantity {
  value: number;
  unit: ServingUnit;
}

export interface FoodItem {
  foodId: FoodId;
  name: string;
  brand: string;
  foodType: FoodType;
  sourceType: FoodSourceType;
  verificationStatus: FoodVerificationStatus;
  speciesTarget: TargetSpecies;
  lifeStageTarget?: LifeStageTarget;
  form: FoodForm;
  manufacturer?: string;
  /** Explicit ingredients list. If unknown, ingredientsKnown must be false. */
  ingredients?: string[];
  ingredientsKnown: boolean;
  /** Energy density in kcal per gram. If unknown, undefined. NEVER guessed from name. */
  energyDensityKcalPerGram?: number;
  servingUnitDefault: ServingUnit;
  /** If household-specific custom food, householdId is set */
  householdId?: HouseholdId;
  createdBy?: UserId;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// FEEDING PLANS & SCHEDULES
// ==========================================

export type FeedingPlanType =
  | 'PRIMARY_DIET'
  | 'SUPPLEMENT_PLAN'
  | 'TEMPORARY_RECOVERY';

export type FeedingPlanProvenance =
  | 'OWNER_DEFINED'
  | 'VETERINARIAN_DEFINED'
  | 'NUTRITION_PROFESSIONAL'
  | 'IMPORTED'
  | 'SYSTEM_TEMPLATE';

export type FeedingPlanStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'SUPERSEDED'
  | 'CANCELLED';

export interface FeedingPlan {
  feedingPlanId: FeedingPlanId;
  petId: PetId;
  householdId: HouseholdId;
  title: string;
  planType: FeedingPlanType;
  provenance: FeedingPlanProvenance;
  status: FeedingPlanStatus;
  isProfessionalPlan: boolean;
  prescribedByProviderId?: string;
  prescribedByProviderName?: string;
  startsAt: string; // ISO 8601 UTC
  endsAt?: string; // ISO 8601 UTC
  timezone: string;
  generalInstructions?: string;
  clinicalNotes?: string;
  reason?: string;
  supersededBy?: FeedingPlanId;
  supersedesPlanId?: FeedingPlanId;
  createdBy: UserId;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface MealSchedule {
  mealScheduleId: MealScheduleId;
  feedingPlanId: FeedingPlanId;
  label: string; // e.g., "Breakfast", "Lunch", "Dinner"
  localTime: string; // "HH:mm", e.g. "07:00", "19:00"
  targetFoodId: FoodId;
  plannedQuantity: ServingQuantity;
  instructions?: string;
  assignedUserId?: UserId;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// MEAL EXECUTION & OCCURRENCES
// ==========================================

export type MealOccurrenceStatus =
  | 'SCHEDULED'
  | 'DUE'
  | 'COMPLETED'
  | 'PARTIALLY_COMPLETED'
  | 'SKIPPED'
  | 'MISSED'
  | 'CANCELLED';

export type AppetiteStatus =
  | 'NORMAL'
  | 'INCREASED'
  | 'REDUCED'
  | 'REFUSED_MEAL'
  | 'UNKNOWN';

export interface MealOccurrence {
  occurrenceId: MealOccurrenceId;
  petId: PetId;
  householdId: HouseholdId;
  feedingPlanId: FeedingPlanId;
  mealScheduleId?: MealScheduleId;
  label: string;
  scheduledFor: string; // ISO 8601 UTC
  scheduledLocalTime: string; // "07:00"
  foodId: FoodId;
  plannedQuantity: ServingQuantity;
  actualQuantity?: ServingQuantity;
  status: MealOccurrenceStatus;
  isUnscheduled: boolean;
  assignedToUserId?: UserId;
  completedByUserId?: UserId;
  completedAt?: string; // ISO 8601 UTC
  consumedQuantity?: ServingQuantity;
  appetiteObservation?: AppetiteStatus;
  notes?: string;
  skipReason?: string;
  concurrencyVersion: number;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// TREATS & HYDRATION
// ==========================================

export type TreatContext =
  | 'TRAINING'
  | 'REWARD'
  | 'GENERAL'
  | 'MEDICATION_ADMINISTRATION'
  | 'DENTAL_CHEW';

export interface TreatLog {
  treatLogId: TreatLogId;
  petId: PetId;
  householdId: HouseholdId;
  foodId?: FoodId;
  treatName: string;
  quantity: ServingQuantity;
  context: TreatContext;
  occurredAt: string; // ISO 8601 UTC
  givenBy: UserId;
  notes?: string;
  createdAt: string;
}

export type HydrationMeasurementType =
  | 'OFFERED_REFILL'
  | 'MEASURED_CONSUMPTION'
  | 'ESTIMATED_CONSUMPTION'
  | 'OBSERVED_DRINKING'
  | 'DEVICE_RECORDED';

export interface HydrationLog {
  hydrationLogId: HydrationLogId;
  petId: PetId;
  householdId: HouseholdId;
  volumeMl: number;
  measurementType: HydrationMeasurementType;
  waterSource?: string;
  occurredAt: string; // ISO 8601 UTC
  recordedBy: UserId;
  notes?: string;
  createdAt: string;
}

// ==========================================
// APPETITE OBSERVATIONS
// ==========================================

export interface AppetiteObservation {
  observationId: AppetiteObservationId;
  petId: PetId;
  householdId: HouseholdId;
  status: AppetiteStatus;
  mealOccurrenceId?: MealOccurrenceId;
  portionConsumedPercentage?: number; // 0 to 100
  observedAt: string; // ISO 8601 UTC
  observedBy: UserId;
  notes?: string;
  createdAt: string;
}

// ==========================================
// DIETARY RESTRICTIONS
// ==========================================

export type DietaryRestrictionType =
  | 'AVOID_INGREDIENT'
  | 'VETERINARY_DIET_ONLY'
  | 'FOOD_FORM_RESTRICTION'
  | 'OWNER_PREFERENCE'
  | 'OTHER';

export type DietaryRestrictionSource =
  | 'VETERINARY_PRESCRIPTION'
  | 'CLINICAL_ALLERGY_SYNC'
  | 'OWNER_PREFERENCE'
  | 'SYSTEM';

export interface DietaryRestriction {
  restrictionId: DietaryRestrictionId;
  petId: PetId;
  householdId: HouseholdId;
  restrictionType: DietaryRestrictionType;
  source: DietaryRestrictionSource;
  targetIngredient?: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// FOOD TRANSITION PLANS
// ==========================================

export interface FoodTransitionStage {
  stageNumber: number;
  label: string; // "Day 1-2"
  startDayOffset: number; // 0 for day 1
  durationDays: number; // e.g. 2
  previousFoodPercentage: number; // e.g. 75
  targetFoodPercentage: number; // e.g. 25
  instructions?: string;
}

export type TransitionStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface FoodTransitionPlan {
  transitionPlanId: FoodTransitionPlanId;
  petId: PetId;
  householdId: HouseholdId;
  previousFoodId: FoodId;
  targetFoodId: FoodId;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: TransitionStatus;
  stages: FoodTransitionStage[];
  provenance: 'OWNER_DEFINED' | 'VETERINARIAN_DEFINED' | 'SYSTEM_TEMPLATE';
  createdBy: UserId;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// FOOD CONFLICT EVALUATOR
// ==========================================

export type FoodConflictClassification =
  | 'NO_KNOWN_CONFLICT'
  | 'POTENTIAL_CONFLICT'
  | 'CONFIRMED_RECORDED_CONFLICT'
  | 'UNKNOWN';

export interface FoodConflictResult {
  classification: FoodConflictClassification;
  matchedRestrictions: string[];
  matchedAllergies: string[];
  message: string;
  /** Invariant: Pet OS NEVER certifies absolute safety. Always false. */
  isSafe: false;
  ingredientDataAvailable: boolean;
}

// ==========================================
// READ MODELS & AGGREGATE PROJECTIONS
// ==========================================

export interface PetNutritionProfile {
  petId: PetId;
  activeFeedingPlan?: FeedingPlan;
  activeSchedules: MealSchedule[];
  primaryFood?: FoodItem;
  todayOccurrences: MealOccurrence[];
  activeTransition?: FoodTransitionPlan;
  currentTransitionStage?: FoodTransitionStage;
  activeRestrictions: DietaryRestriction[];
  knownFoodAllergies: Array<{
    allergen: string;
    severity: string;
    provenance: string;
    verificationStatus: string;
  }>;
  recentAppetiteSummary: {
    lastObservedStatus: AppetiteStatus;
    lastObservedAt?: string;
    refusedCountLast7Days: number;
  };
  recentHydrationSummary: {
    totalOfferedLast24h: number;
    totalMeasuredConsumedLast24h: number;
    lastLogAt?: string;
  };
  caregiverInstructions: string[];
  lastUpdated: string;
}

export interface CaregiverQuickView {
  petId: PetId;
  petName: string;
  nextMeal?: {
    occurrenceId: MealOccurrenceId;
    label: string;
    scheduledTime: string;
    foodName: string;
    quantity: string;
    instructions?: string;
    status: MealOccurrenceStatus;
  };
  todayMeals: Array<{
    occurrenceId: MealOccurrenceId;
    label: string;
    scheduledTime: string;
    status: MealOccurrenceStatus;
    completedBy?: string;
    completedAt?: string;
    foodName: string;
    plannedQuantity: string;
  }>;
  criticalAllergyWarnings: string[];
  essentialFeedingInstructions: string[];
  lastWaterOffered?: string;
}

// ==========================================
// COMMAND INTERFACES
// ==========================================

export interface CreateFoodItemCommand {
  name: string;
  brand: string;
  foodType: FoodType;
  sourceType: FoodSourceType;
  speciesTarget: TargetSpecies;
  lifeStageTarget?: LifeStageTarget;
  form: FoodForm;
  manufacturer?: string;
  ingredients?: string[];
  ingredientsKnown: boolean;
  energyDensityKcalPerGram?: number;
  servingUnitDefault: ServingUnit;
  householdId?: HouseholdId;
  userId: UserId;
}

export interface CreateFeedingPlanCommand {
  petId: PetId;
  householdId: HouseholdId;
  title: string;
  planType: FeedingPlanType;
  provenance: FeedingPlanProvenance;
  isProfessionalPlan?: boolean;
  prescribedByProviderId?: string;
  prescribedByProviderName?: string;
  startsAt?: string;
  endsAt?: string;
  timezone?: string;
  generalInstructions?: string;
  clinicalNotes?: string;
  reason?: string;
  supersedesPlanId?: FeedingPlanId;
  schedules?: Array<{
    label: string;
    localTime: string;
    targetFoodId: FoodId;
    plannedQuantity: ServingQuantity;
    instructions?: string;
    assignedUserId?: UserId;
  }>;
  userId: UserId;
}

export interface CompleteMealCommand {
  occurrenceId: MealOccurrenceId;
  userId: UserId;
  actualQuantity?: ServingQuantity;
  consumedQuantity?: ServingQuantity;
  appetiteObservation?: AppetiteStatus;
  notes?: string;
  concurrencyVersion: number;
  allowDuplicateOverride?: boolean;
}

export interface SkipMealCommand {
  occurrenceId: MealOccurrenceId;
  userId: UserId;
  reason: string;
  concurrencyVersion: number;
}

export interface LogUnscheduledMealCommand {
  petId: PetId;
  householdId: HouseholdId;
  label: string;
  foodId: FoodId;
  quantity: ServingQuantity;
  userId: UserId;
  notes?: string;
  appetiteObservation?: AppetiteStatus;
}

export interface LogTreatCommand {
  petId: PetId;
  householdId: HouseholdId;
  foodId?: FoodId;
  treatName: string;
  quantity: ServingQuantity;
  context: TreatContext;
  occurredAt?: string;
  userId: UserId;
  notes?: string;
}

export interface LogHydrationCommand {
  petId: PetId;
  householdId: HouseholdId;
  volumeMl: number;
  measurementType: HydrationMeasurementType;
  waterSource?: string;
  occurredAt?: string;
  userId: UserId;
  notes?: string;
}

export interface RecordAppetiteObservationCommand {
  petId: PetId;
  householdId: HouseholdId;
  status: AppetiteStatus;
  mealOccurrenceId?: MealOccurrenceId;
  portionConsumedPercentage?: number;
  observedAt?: string;
  userId: UserId;
  notes?: string;
}

export interface CreateDietaryRestrictionCommand {
  petId: PetId;
  householdId: HouseholdId;
  restrictionType: DietaryRestrictionType;
  source: DietaryRestrictionSource;
  targetIngredient?: string;
  description: string;
  userId: UserId;
}

export interface CreateFoodTransitionPlanCommand {
  petId: PetId;
  householdId: HouseholdId;
  previousFoodId: FoodId;
  targetFoodId: FoodId;
  startDate: string; // YYYY-MM-DD
  durationDays?: number; // default 7
  customStages?: FoodTransitionStage[];
  userId: UserId;
}
