/**
 * Pet OS Sprint 9 - Activity Domain Events & Event Bus
 * Implements ADR-016: Domain Events & Event Publisher
 */

import {
  EventId,
  CorrelationId,
  PetId,
  HouseholdId,
  UserId,
  ActivityId,
  ActivitySessionId,
  ActivityRoutineId,
  ActivityOccurrenceId,
  ActivityGoalId,
  generateUUIDv7,
  asEventId
} from '../kernel/ids';
import {
  ActivityType,
  ActivitySourceType,
  GoalMetricType,
  CareDomain
} from './types';

export interface BaseActivityDomainEvent {
  eventId: EventId;
  correlationId: CorrelationId;
  occurredAt: string; // ISO 8601 UTC
  petId: PetId;
  householdId: HouseholdId;
  actorUserId: UserId;
}

export interface ActivityRecordedEvent extends BaseActivityDomainEvent {
  eventType: 'ACTIVITY_RECORDED';
  activityId: ActivityId;
  activityType: ActivityType;
  durationSeconds: number;
  sourceType: ActivitySourceType;
  distanceKm?: number;
}

export interface WalkRecordedEvent extends BaseActivityDomainEvent {
  eventType: 'WALK_RECORDED';
  activityId: ActivityId;
  durationSeconds: number;
  distanceKm?: number;
  leashStatus?: string;
  walkPurpose?: string;
}

export interface PlaySessionRecordedEvent extends BaseActivityDomainEvent {
  eventType: 'PLAY_SESSION_RECORDED';
  activityId: ActivityId;
  playType?: string;
  durationSeconds: number;
}

export interface RestObservationRecordedEvent extends BaseActivityDomainEvent {
  eventType: 'REST_OBSERVATION_RECORDED';
  activityId: ActivityId;
  restType: string;
  durationSeconds: number;
  isCrateRest: boolean;
}

export interface ActivitySessionStartedEvent extends BaseActivityDomainEvent {
  eventType: 'ACTIVITY_SESSION_STARTED';
  activitySessionId: ActivitySessionId;
  activityType: ActivityType;
}

export interface ActivitySessionCompletedEvent extends BaseActivityDomainEvent {
  eventType: 'ACTIVITY_SESSION_COMPLETED';
  activitySessionId: ActivitySessionId;
  activityId: ActivityId;
  durationSeconds: number;
}

export interface ActivitySessionAbandonedEvent extends BaseActivityDomainEvent {
  eventType: 'ACTIVITY_SESSION_ABANDONED';
  activitySessionId: ActivitySessionId;
  elapsedSeconds: number;
  thresholdHours: number;
}

export interface ActivityRoutineCreatedEvent extends BaseActivityDomainEvent {
  eventType: 'ACTIVITY_ROUTINE_CREATED';
  routineId: ActivityRoutineId;
  title: string;
  activityType: ActivityType;
}

export interface ActivityOccurrenceCompletedEvent extends BaseActivityDomainEvent {
  eventType: 'ACTIVITY_OCCURRENCE_COMPLETED';
  occurrenceId: ActivityOccurrenceId;
  routineId: ActivityRoutineId;
  activityRecordId: ActivityId;
}

export interface ActivityOccurrenceConflictEvent extends BaseActivityDomainEvent {
  eventType: 'ACTIVITY_OCCURRENCE_CONFLICT';
  occurrenceId: ActivityOccurrenceId;
  conflictReason: string;
  attemptedBy: UserId;
}

export interface ActivityGoalCreatedEvent extends BaseActivityDomainEvent {
  eventType: 'ACTIVITY_GOAL_CREATED';
  goalId: ActivityGoalId;
  title: string;
  metricType: GoalMetricType;
  targetValue: number;
}

export interface ActivityGoalConstrainedEvent extends BaseActivityDomainEvent {
  eventType: 'ACTIVITY_GOAL_CONSTRAINED';
  goalId: ActivityGoalId;
  reason: string;
  linkedConditionId?: string;
}

export interface ActivityGoalAchievedEvent extends BaseActivityDomainEvent {
  eventType: 'ACTIVITY_GOAL_ACHIEVED';
  goalId: ActivityGoalId;
  metricType: GoalMetricType;
  achievedValue: number;
  targetValue: number;
  period: string;
}

export interface DailyCareTaskCompletedEvent extends BaseActivityDomainEvent {
  eventType: 'DAILY_CARE_TASK_COMPLETED';
  taskId: string;
  sourceDomain: CareDomain;
  title: string;
}

export type ActivityDomainEvent =
  | ActivityRecordedEvent
  | WalkRecordedEvent
  | PlaySessionRecordedEvent
  | RestObservationRecordedEvent
  | ActivitySessionStartedEvent
  | ActivitySessionCompletedEvent
  | ActivitySessionAbandonedEvent
  | ActivityRoutineCreatedEvent
  | ActivityOccurrenceCompletedEvent
  | ActivityOccurrenceConflictEvent
  | ActivityGoalCreatedEvent
  | ActivityGoalConstrainedEvent
  | ActivityGoalAchievedEvent
  | DailyCareTaskCompletedEvent;

export type ActivityEventHandler<T extends ActivityDomainEvent = ActivityDomainEvent> = (event: T) => void | Promise<void>;

export class ActivityEventBus {
  private static handlers: Map<string, Set<ActivityEventHandler<any>>> = new Map();
  private static globalHandlers: Set<ActivityEventHandler<any>> = new Set();

  static subscribe<T extends ActivityDomainEvent>(
    eventType: T['eventType'],
    handler: ActivityEventHandler<T>
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    const set = this.handlers.get(eventType)!;
    set.add(handler);
    return () => set.delete(handler);
  }

  static subscribeAll(handler: ActivityEventHandler): () => void {
    this.globalHandlers.add(handler);
    return () => this.globalHandlers.delete(handler);
  }

  static publish<T extends ActivityDomainEvent>(event: T): void {
    const specificHandlers = this.handlers.get(event.eventType);
    if (specificHandlers) {
      specificHandlers.forEach(h => {
        try {
          h(event);
        } catch (err) {
          console.error(`[ActivityEventBus] Handler error for ${event.eventType}`, err);
        }
      });
    }

    this.globalHandlers.forEach(h => {
      try {
        h(event);
      } catch (err) {
        console.error(`[ActivityEventBus] Global handler error for ${event.eventType}`, err);
      }
    });
  }

  static resetForTesting(): void {
    this.handlers.clear();
    this.globalHandlers.clear();
  }
}
