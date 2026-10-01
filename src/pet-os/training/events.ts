/**
 * Pet OS Sprint 8 - Training & Behavior Domain Events
 * Implements Volume X, Volume VI, Volume XXIX
 */

import { EventEnvelope, createEventEnvelope } from '../kernel/events';
import { generateUUIDv7, asCorrelationId, asEventId, PetId, HouseholdId, UserId } from '../kernel/ids';
import { currentClockUtcNow } from '../kernel/time';
import {
  TrainingPlan,
  TrainingSession,
  PetSkillProgress,
  TrainingMilestone,
  TrainingEvidence,
  BehaviorObservation
} from './types';

export type TrainingEventType =
  | 'TrainingPlanCreated'
  | 'TrainingPlanActivated'
  | 'TrainingPlanPaused'
  | 'TrainingPlanCompleted'
  | 'TrainingPlanCancelled'
  | 'TrainingSessionStarted'
  | 'TrainingSessionCompleted'
  | 'TrainingSessionAbandoned'
  | 'SkillProgressUpdated'
  | 'SkillMilestoneAchieved'
  | 'TrainingEvidenceAdded'
  | 'BehaviorObservationRecorded'
  | 'BehaviorObservationAmended'
  | 'HighRiskBehaviorObservationFlagged';

export interface TrainingEventPayloadMap {
  TrainingPlanCreated: { plan: TrainingPlan };
  TrainingPlanActivated: { plan: TrainingPlan; previousPlanId?: string };
  TrainingPlanPaused: { plan: TrainingPlan; reason?: string };
  TrainingPlanCompleted: { plan: TrainingPlan };
  TrainingPlanCancelled: { plan: TrainingPlan; reason?: string };
  TrainingSessionStarted: { session: TrainingSession };
  TrainingSessionCompleted: { session: TrainingSession };
  TrainingSessionAbandoned: { session: TrainingSession; reason?: string };
  SkillProgressUpdated: { progress: PetSkillProgress; previousLevel?: string };
  SkillMilestoneAchieved: { milestone: TrainingMilestone };
  TrainingEvidenceAdded: { evidence: TrainingEvidence };
  BehaviorObservationRecorded: { observation: BehaviorObservation };
  BehaviorObservationAmended: { observation: BehaviorObservation; amendmentId: string };
  HighRiskBehaviorObservationFlagged: { observation: BehaviorObservation; guidance: string };
}

export function createTrainingDomainEvent<K extends TrainingEventType>(
  eventType: K,
  aggregateId: string,
  householdId: HouseholdId,
  petId: PetId,
  userId: UserId,
  payload: TrainingEventPayloadMap[K],
  correlationId?: string
): EventEnvelope<TrainingEventPayloadMap[K]> {
  return createEventEnvelope(
    eventType,
    'PET_TRAINING',
    aggregateId,
    payload,
    1,
    correlationId ? asCorrelationId(correlationId) : undefined,
    userId,
    householdId
  );
}

