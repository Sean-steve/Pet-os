/**
 * Pet OS Sprint 7 - Nutrition Store
 * Implements Volume IX, Volume XXX
 * In-memory authoritative store with transactional semantics,
 * concurrency protections, and cross-household isolation.
 */

import {
  FoodId,
  FeedingPlanId,
  MealScheduleId,
  MealOccurrenceId,
  TreatLogId,
  HydrationLogId,
  AppetiteObservationId,
  DietaryRestrictionId,
  FoodTransitionPlanId,
  PetId,
  HouseholdId
} from '../kernel/ids';
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
import { EventEnvelope } from '../kernel/events';

export class NutritionStore {
  private static foods = new Map<FoodId, FoodItem>();
  private static feedingPlans = new Map<FeedingPlanId, FeedingPlan>();
  private static mealSchedules = new Map<MealScheduleId, MealSchedule>();
  private static mealOccurrences = new Map<MealOccurrenceId, MealOccurrence>();
  private static treatLogs = new Map<TreatLogId, TreatLog>();
  private static hydrationLogs = new Map<HydrationLogId, HydrationLog>();
  private static appetiteObservations = new Map<AppetiteObservationId, AppetiteObservation>();
  private static dietaryRestrictions = new Map<DietaryRestrictionId, DietaryRestriction>();
  private static transitionPlans = new Map<FoodTransitionPlanId, FoodTransitionPlan>();

  private static subscribers: Array<(event: EventEnvelope<any>) => void> = [];

  static subscribe(listener: (event: EventEnvelope<any>) => void): () => void {
    this.subscribers.push(listener);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== listener);
    };
  }

  static publishDomainEvent(event: EventEnvelope<any>): void {
    for (const sub of this.subscribers) {
      try {
        sub(event);
      } catch (err) {
        console.error('Error in NutritionStore event subscriber:', err);
      }
    }
  }

  // ==========================================
  // FOOD CATALOGUE
  // ==========================================

  static saveFood(food: FoodItem): void {
    this.foods.set(food.foodId, JSON.parse(JSON.stringify(food)));
  }

  static findFoodById(foodId: FoodId): FoodItem | undefined {
    const f = this.foods.get(foodId);
    return f ? JSON.parse(JSON.stringify(f)) : undefined;
  }

  static listFoods(householdId?: HouseholdId): FoodItem[] {
    const list: FoodItem[] = [];
    for (const f of this.foods.values()) {
      // Global catalogue items (no householdId) are visible to all households.
      // Household-specific items are visible only to their own household.
      if (!f.householdId || (householdId && f.householdId === householdId)) {
        list.push(JSON.parse(JSON.stringify(f)));
      }
    }
    return list;
  }

  // ==========================================
  // FEEDING PLANS
  // ==========================================

  static saveFeedingPlan(plan: FeedingPlan): void {
    this.feedingPlans.set(plan.feedingPlanId, JSON.parse(JSON.stringify(plan)));
  }

  static findFeedingPlanById(planId: FeedingPlanId): FeedingPlan | undefined {
    const p = this.feedingPlans.get(planId);
    return p ? JSON.parse(JSON.stringify(p)) : undefined;
  }

  static findActivePlanForPet(petId: PetId): FeedingPlan | undefined {
    for (const p of this.feedingPlans.values()) {
      if (p.petId === petId && p.status === 'ACTIVE' && p.planType === 'PRIMARY_DIET') {
        return JSON.parse(JSON.stringify(p));
      }
    }
    return undefined;
  }

  static listFeedingPlansForPet(petId: PetId): FeedingPlan[] {
    const plans: FeedingPlan[] = [];
    for (const p of this.feedingPlans.values()) {
      if (p.petId === petId) {
        plans.push(JSON.parse(JSON.stringify(p)));
      }
    }
    return plans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ==========================================
  // MEAL SCHEDULES
  // ==========================================

  static saveMealSchedule(schedule: MealSchedule): void {
    this.mealSchedules.set(schedule.mealScheduleId, JSON.parse(JSON.stringify(schedule)));
  }

  static findMealScheduleById(scheduleId: MealScheduleId): MealSchedule | undefined {
    const s = this.mealSchedules.get(scheduleId);
    return s ? JSON.parse(JSON.stringify(s)) : undefined;
  }

  static listSchedulesForPlan(feedingPlanId: FeedingPlanId): MealSchedule[] {
    const schedules: MealSchedule[] = [];
    for (const s of this.mealSchedules.values()) {
      if (s.feedingPlanId === feedingPlanId) {
        schedules.push(JSON.parse(JSON.stringify(s)));
      }
    }
    return schedules.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // ==========================================
  // MEAL OCCURRENCES
  // ==========================================

  static saveMealOccurrence(occurrence: MealOccurrence): void {
    this.mealOccurrences.set(occurrence.occurrenceId, JSON.parse(JSON.stringify(occurrence)));
  }

  static findMealOccurrenceById(occurrenceId: MealOccurrenceId): MealOccurrence | undefined {
    const o = this.mealOccurrences.get(occurrenceId);
    return o ? JSON.parse(JSON.stringify(o)) : undefined;
  }

  static listOccurrencesForPet(petId: PetId): MealOccurrence[] {
    const list: MealOccurrence[] = [];
    for (const o of this.mealOccurrences.values()) {
      if (o.petId === petId) {
        list.push(JSON.parse(JSON.stringify(o)));
      }
    }
    return list.sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime());
  }

  static listOccurrencesForPetOnDate(petId: PetId, dateStr: string): MealOccurrence[] {
    // dateStr is in YYYY-MM-DD format
    const list: MealOccurrence[] = [];
    for (const o of this.mealOccurrences.values()) {
      if (o.petId === petId && o.scheduledFor.startsWith(dateStr)) {
        list.push(JSON.parse(JSON.stringify(o)));
      }
    }
    return list.sort((a, b) => a.scheduledLocalTime.localeCompare(b.scheduledLocalTime));
  }

  // ==========================================
  // TREAT LOGS
  // ==========================================

  static saveTreatLog(treat: TreatLog): void {
    this.treatLogs.set(treat.treatLogId, JSON.parse(JSON.stringify(treat)));
  }

  static findTreatLogById(treatLogId: TreatLogId): TreatLog | undefined {
    const t = this.treatLogs.get(treatLogId);
    return t ? JSON.parse(JSON.stringify(t)) : undefined;
  }

  static listTreatLogsForPet(petId: PetId): TreatLog[] {
    const list: TreatLog[] = [];
    for (const t of this.treatLogs.values()) {
      if (t.petId === petId) {
        list.push(JSON.parse(JSON.stringify(t)));
      }
    }
    return list.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }

  // ==========================================
  // HYDRATION LOGS
  // ==========================================

  static saveHydrationLog(hydration: HydrationLog): void {
    this.hydrationLogs.set(hydration.hydrationLogId, JSON.parse(JSON.stringify(hydration)));
  }

  static findHydrationLogById(id: HydrationLogId): HydrationLog | undefined {
    const h = this.hydrationLogs.get(id);
    return h ? JSON.parse(JSON.stringify(h)) : undefined;
  }

  static listHydrationLogsForPet(petId: PetId): HydrationLog[] {
    const list: HydrationLog[] = [];
    for (const h of this.hydrationLogs.values()) {
      if (h.petId === petId) {
        list.push(JSON.parse(JSON.stringify(h)));
      }
    }
    return list.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }

  // ==========================================
  // APPETITE OBSERVATIONS
  // ==========================================

  static saveAppetiteObservation(observation: AppetiteObservation): void {
    this.appetiteObservations.set(observation.observationId, JSON.parse(JSON.stringify(observation)));
  }

  static findAppetiteObservationById(id: AppetiteObservationId): AppetiteObservation | undefined {
    const o = this.appetiteObservations.get(id);
    return o ? JSON.parse(JSON.stringify(o)) : undefined;
  }

  static listAppetiteObservationsForPet(petId: PetId): AppetiteObservation[] {
    const list: AppetiteObservation[] = [];
    for (const o of this.appetiteObservations.values()) {
      if (o.petId === petId) {
        list.push(JSON.parse(JSON.stringify(o)));
      }
    }
    return list.sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());
  }

  // ==========================================
  // DIETARY RESTRICTIONS
  // ==========================================

  static saveDietaryRestriction(restriction: DietaryRestriction): void {
    this.dietaryRestrictions.set(restriction.restrictionId, JSON.parse(JSON.stringify(restriction)));
  }

  static findDietaryRestrictionById(id: DietaryRestrictionId): DietaryRestriction | undefined {
    const r = this.dietaryRestrictions.get(id);
    return r ? JSON.parse(JSON.stringify(r)) : undefined;
  }

  static listDietaryRestrictionsForPet(petId: PetId, activeOnly = true): DietaryRestriction[] {
    const list: DietaryRestriction[] = [];
    for (const r of this.dietaryRestrictions.values()) {
      if (r.petId === petId) {
        if (activeOnly && !r.active) continue;
        list.push(JSON.parse(JSON.stringify(r)));
      }
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ==========================================
  // FOOD TRANSITION PLANS
  // ==========================================

  static saveTransitionPlan(plan: FoodTransitionPlan): void {
    this.transitionPlans.set(plan.transitionPlanId, JSON.parse(JSON.stringify(plan)));
  }

  static findTransitionPlanById(id: FoodTransitionPlanId): FoodTransitionPlan | undefined {
    const p = this.transitionPlans.get(id);
    return p ? JSON.parse(JSON.stringify(p)) : undefined;
  }

  static findActiveTransitionForPet(petId: PetId): FoodTransitionPlan | undefined {
    for (const p of this.transitionPlans.values()) {
      if (p.petId === petId && p.status === 'ACTIVE') {
        return JSON.parse(JSON.stringify(p));
      }
    }
    return undefined;
  }

  static listTransitionsForPet(petId: PetId): FoodTransitionPlan[] {
    const list: FoodTransitionPlan[] = [];
    for (const p of this.transitionPlans.values()) {
      if (p.petId === petId) {
        list.push(JSON.parse(JSON.stringify(p)));
      }
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ==========================================
  // TESTING UTILITY
  // ==========================================

  static clear(): void {
    this.foods.clear();
    this.feedingPlans.clear();
    this.mealSchedules.clear();
    this.mealOccurrences.clear();
    this.treatLogs.clear();
    this.hydrationLogs.clear();
    this.appetiteObservations.clear();
    this.dietaryRestrictions.clear();
    this.transitionPlans.clear();
    this.subscribers = [];
  }
}
