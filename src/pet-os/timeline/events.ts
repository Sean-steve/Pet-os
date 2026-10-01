/**
 * Pet OS Sprint 4 - Timeline Domain & Outbox Events
 * Implements Volume XXIX (Event, Command & Asynchronous Architecture)
 */

import { EventEnvelope } from '../kernel/events';
import { PetId, TimelineEventId, generateUUIDv7, asEventId, asCorrelationId } from '../kernel/ids';
import { TimelineEvent } from './types';

export type TimelineDomainEventType =
  | 'timeline.event_recorded'
  | 'timeline.event_superseded'
  | 'timeline.event_retracted';

export class TimelineEventFactory {
  static eventRecorded(event: TimelineEvent, correlationId?: string): EventEnvelope<TimelineEvent> {
    return {
      eventId: asEventId(generateUUIDv7()),
      eventType: 'timeline.event_recorded',
      aggregateType: 'pet_timeline',
      aggregateId: event.petId,
      timestamp: new Date().toISOString(),
      version: 1,
      correlationId: correlationId ? asCorrelationId(correlationId) : event.correlationId,
      payload: { ...event },
      metadata: {
        source: 'pet-os.timeline',
        householdId: event.householdId,
        actorId: event.sourceActorId
      }
    };
  }

  static eventSuperseded(
    petId: PetId,
    oldEventId: TimelineEventId,
    newEventId: TimelineEventId,
    actorId: string,
    reason: string,
    correlationId?: string
  ): EventEnvelope<Record<string, unknown>> {
    return {
      eventId: asEventId(generateUUIDv7()),
      eventType: 'timeline.event_superseded',
      aggregateType: 'pet_timeline',
      aggregateId: petId,
      timestamp: new Date().toISOString(),
      version: 1,
      correlationId: correlationId ? asCorrelationId(correlationId) : asCorrelationId(generateUUIDv7()),
      payload: {
        petId,
        oldEventId,
        newEventId,
        actorId,
        reason
      },
      metadata: {
        source: 'pet-os.timeline'
      }
    };
  }

  static eventRetracted(
    petId: PetId,
    eventId: TimelineEventId,
    actorId: string,
    reason: string,
    correlationId?: string
  ): EventEnvelope<Record<string, unknown>> {
    return {
      eventId: asEventId(generateUUIDv7()),
      eventType: 'timeline.event_retracted',
      aggregateType: 'pet_timeline',
      aggregateId: petId,
      timestamp: new Date().toISOString(),
      version: 1,
      correlationId: correlationId ? asCorrelationId(correlationId) : asCorrelationId(generateUUIDv7()),
      payload: {
        petId,
        eventId,
        actorId,
        reason
      },
      metadata: {
        source: 'pet-os.timeline'
      }
    };
  }
}
