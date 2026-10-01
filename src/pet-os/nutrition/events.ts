/**
 * Pet OS Sprint 7 - Nutrition Domain Events
 * Implements Volume IX, Volume IV, Volume XXVIII
 */

import { EventEnvelope } from '../kernel/events';
import { generateUUIDv7, asCorrelationId, asEventId, PetId, HouseholdId, UserId } from '../kernel/ids';
import { currentClockUtcNow } from '../kernel/time';
import {
  FeedingPlan,
  MealOccurrence,
  TreatLog,
  HydrationLog,
  AppetiteObservation,
  DietaryRestriction,
  FoodTransitionPlan,
  FoodConflictResult
} from './types';

export type NutritionEventType =
  | 'NutritionProfileUpdated'
  | 'FeedingPlanCreated'
  | 'FeedingPlanActivated'
  | 'FeedingPlanPaused'
  | 'FeedingPlanSuperseded'
  | 'FeedingPlanCancelled'
  | 'MealOccurrenceScheduled'
  | 'MealCompleted'
  | 'MealSkipped'
  | 'MealMissed'
  | 'TreatRecorded'
  | 'HydrationRecorded'
  | 'AppetiteObservationRecorded'
  | 'DietaryRestrictionAdded'
  | 'DietaryRestrictionRemoved'
  | 'FoodConflictDetected'
  | 'DietTransitionStarted'
  | 'DietTransitionCompleted';

export interface NutritionEventPayloadMap {
  NutritionProfileUpdated: { petId: PetId; householdId: HouseholdId; reason: string };
  FeedingPlanCreated: { plan: FeedingPlan };
  FeedingPlanActivated: { plan: FeedingPlan; previousPlanId?: string };
  FeedingPlanPaused: { plan: FeedingPlan };
  FeedingPlanSuperseded: { plan: FeedingPlan; supersededByPlanId: string };
  FeedingPlanCancelled: { plan: FeedingPlan; reason?: string };
  MealOccurrenceScheduled: { occurrence: MealOccurrence };
  MealCompleted: { occurrence: MealOccurrence; completedBy: UserId };
  MealSkipped: { occurrence: MealOccurrence; reason: string };
  MealMissed: { occurrence: MealOccurrence };
  TreatRecorded: { treat: TreatLog };
  HydrationRecorded: { hydration: HydrationLog };
  AppetiteObservationRecorded: { observation: AppetiteObservation };
  DietaryRestrictionAdded: { restriction: DietaryRestriction };
  DietaryRestrictionRemoved: { restrictionId: string; petId: PetId };
  FoodConflictDetected: { petId: PetId; foodId: string; conflict: FoodConflictResult };
  DietTransitionStarted: { transition: FoodTransitionPlan };
  DietTransitionCompleted: { transition: FoodTransitionPlan };
}

export class NutritionEventFactory {
  static create<K extends NutritionEventType>(
    type: K,
    aggregateId: string,
    householdId: HouseholdId,
    actorUserId: UserId,
    payload: NutritionEventPayloadMap[K],
    correlationId?: string
  ): EventEnvelope<NutritionEventPayloadMap[K]> {
    return {
      eventId: asEventId(generateUUIDv7()),
      eventType: type,
      aggregateId,
      aggregateType: 'Nutrition',
      timestamp: currentClockUtcNow(),
      correlationId: correlationId ? asCorrelationId(correlationId) : asCorrelationId(generateUUIDv7()),
      version: 1,
      payload,
      metadata: {
        actorId: actorUserId,
        householdId,
        source: 'nutrition-bounded-context'
      }
    };
  }
}
