/**
 * Pet OS Sprint 20 - Trainer Professional Workspace Domain Events
 * 
 * Implements Event-Driven Architecture and Outbox Pattern for the Trainer Workspace.
 */

import {
  UserId,
  HouseholdId,
  PetId,
  EventId,
  CorrelationId,
  asEventId,
  asCorrelationId,
  generateUUIDv7,
} from '../kernel/ids';

import {
  TrainingAccessGrant,
  TrainerConsent,
  ProfessionalTrainingAssessment,
  TrainerSessionExecution,
  TrainerHomeworkAssignment,
  ProfessionalProgressReview,
  TrainerReport,
  TrainerSafetyEscalation,
  TrainerCorrectionRequest,
  TrainerClientRelationship,
} from './types';

export type TrainerEventType =
  | 'TrainingAccessGranted'
  | 'TrainingAccessRevoked'
  | 'TrainerConsentRecorded'
  | 'TrainerRelationshipEstablished'
  | 'ProfessionalAssessmentCreated'
  | 'ProfessionalAssessmentFinalized'
  | 'ProfessionalAssessmentAmended'
  | 'TrainerSessionExecuted'
  | 'TrainerHomeworkAssigned'
  | 'TrainerHomeworkLoggedByCaregiver'
  | 'ProfessionalProgressReviewCompleted'
  | 'TrainerReportFinalized'
  | 'TrainerSafetyEscalationFlagged'
  | 'TrainerVeterinaryReferralRecommended'
  | 'TrainerCorrectionRequestSubmitted'
  | 'TrainerCorrectionRequestHandled'
  | 'TrainerServiceExecutionCompleted';

export interface TrainerDomainEvent<T = Record<string, unknown>> {
  eventId: EventId;
  eventType: TrainerEventType;
  entityId: string;
  householdId: HouseholdId;
  petId: PetId;
  actorUserId: UserId;
  timestamp: string;
  correlationId: CorrelationId;
  payload: T;
}

export function createTrainerDomainEvent<T = Record<string, unknown>>(
  eventType: TrainerEventType,
  entityId: string,
  householdId: HouseholdId,
  petId: PetId,
  actorUserId: UserId,
  payload: T,
  correlationId?: CorrelationId
): TrainerDomainEvent<T> {
  return {
    eventId: asEventId(generateUUIDv7()),
    eventType,
    entityId,
    householdId,
    petId,
    actorUserId,
    timestamp: new Date().toISOString(),
    correlationId: correlationId || asCorrelationId(generateUUIDv7()),
    payload,
  };
}
