import { EventEnvelope, createEventEnvelope } from '../kernel/events';
import { AIRequest, AIResponse, AIRecommendation, AIIncident } from './types';

export type AIDomainEvent =
  | EventEnvelope<{ requestId: string; useCase: string; riskClass: string }>
  | EventEnvelope<{ responseId: string; requestId: string; completionStatus: string }>
  | EventEnvelope<{ recommendationId: string; petId: string; category: string }>
  | EventEnvelope<{ incidentId: string; category: string; severity: string }>;

export const AIEvents = {
  requestCreated(request: AIRequest): AIDomainEvent {
    return createEventEnvelope(
      'AIRequestCreated',
      'AIRequest',
      request.requestId,
      { requestId: request.requestId, useCase: request.useCase, riskClass: request.riskClass },
      1,
      undefined,
      request.userId,
      request.householdId
    );
  },
  responseCompleted(response: AIResponse, householdId?: string): AIDomainEvent {
    return createEventEnvelope(
      'AIResponseCompleted',
      'AIResponse',
      response.responseId,
      { responseId: response.responseId, requestId: response.requestId, completionStatus: response.completionStatus },
      1,
      undefined,
      undefined,
      householdId
    );
  },
  recommendationCreated(rec: AIRecommendation): AIDomainEvent {
    return createEventEnvelope(
      'AIRecommendationCreated',
      'AIRecommendation',
      rec.recommendationId,
      { recommendationId: rec.recommendationId, petId: rec.petId, category: rec.category },
      1,
      undefined,
      undefined,
      rec.householdId
    );
  },
  incidentOpened(incident: AIIncident): AIDomainEvent {
    return createEventEnvelope(
      'AIIncidentOpened',
      'AIIncident',
      incident.incidentId,
      { incidentId: incident.incidentId, category: incident.category, severity: incident.severity }
    );
  },
};
