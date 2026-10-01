/**
 * Pet OS Shared Kernel - Canonical Event Envelope
 * Implements Volume XXI (Event-Driven Architecture & Outbox Pattern) and ADR-014
 * Enforces structured schema for all domain events and outbox persistence.
 */

import { EventId, CorrelationId, generateUUIDv7, asEventId, asCorrelationId } from './ids';

export interface EventEnvelope<T = any> {
  eventId: EventId;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  timestamp: string;
  correlationId: CorrelationId;
  causationId?: string;
  version: number;
  payload: T;
  metadata?: {
    actorId?: string;
    householdId?: string;
    ipAddress?: string;
    userAgent?: string;
    source?: string;
  };
}

export function createEventEnvelope<T>(
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  payload: T,
  version: number = 1,
  correlationId?: CorrelationId,
  actorId?: string,
  householdId?: string
): EventEnvelope<T> {
  return {
    eventId: asEventId(generateUUIDv7()),
    eventType,
    aggregateType,
    aggregateId,
    timestamp: new Date().toISOString(),
    correlationId: correlationId || asCorrelationId(generateUUIDv7()),
    version,
    payload,
    metadata: {
      actorId,
      householdId,
      source: 'pet-os-monolith'
    }
  };
}
