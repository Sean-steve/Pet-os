/**
 * Pet OS Sprint 4 - Canonical Longitudinal Pet Timeline Service
 * Implements Volume III (Pet Care Lifecycle), Volume V (Pet Identity), Volume XXVIII & XXXI.
 * Key invariants:
 * - occurred_at vs recorded_at separation
 * - Append-only immutability & supersession
 * - Idempotency through deterministic deduplication keys
 * - Cross-household isolation on queries and modifications
 */

import { 
  TimelineEvent, 
  RecordTimelineEventCommand, 
  SupersedeTimelineEventCommand, 
  RetractTimelineEventCommand, 
  TimelineQueryOptions, 
  TimelineQueryResult 
} from './types';
import { TimelineStore } from './store';
import { TimelineEventFactory } from './events';
import { PetStore } from '../pet-core/store';
import { AuthorizationService } from '../identity/authorization';
import { InMemoryAuditStore } from '../kernel/audit';
import { EventEnvelope } from '../kernel/events';
import { 
  PetId, 
  TimelineEventId, 
  asTimelineEventId, 
  generateUUIDv7, 
  asCorrelationId, 
  asHouseholdId 
} from '../kernel/ids';

export class TimelineService {
  static {
    PetStore.subscribe((event) => {
      try {
        TimelineService.handleDomainEvent(event);
      } catch (err) {
        console.error('Error handling domain event in TimelineService:', err);
      }
    });
  }

  /**
   * Records a new timeline event.
   * Enforces idempotency via deduplication key.
   */
  static recordEvent(command: RecordTimelineEventCommand): TimelineEvent {
    // 1. Verify Pet Existence
    const pet = PetStore.findPetById(command.petId);
    if (!pet) {
      throw new Error(`Pet with ID ${command.petId} not found.`);
    }

    // 2. Formulate or check Deduplication Key
    const dedupeKey =
      command.deduplicationKey ||
      `${command.sourceDomain}:${command.sourceEntityType}:${command.sourceEntityId}:${command.eventType}`;

    const existing = TimelineStore.findByDeduplicationKey(dedupeKey);
    if (existing) {
      // Idempotency: Return existing projection without creating duplicate
      return existing;
    }

    // 3. Timestamps
    const now = new Date().toISOString();
    const occurredAt = command.occurredAt || now;
    const recordedAt = command.recordedAt || now;

    // 4. Construct Aggregate
    const timelineEventId = asTimelineEventId(generateUUIDv7());
    const correlationId = command.correlationId ? asCorrelationId(command.correlationId) : asCorrelationId(generateUUIDv7());

    const event: TimelineEvent = {
      timelineEventId,
      petId: command.petId,
      householdId: command.householdId || pet.householdId,
      eventType: command.eventType,
      eventCategory: command.eventCategory,
      occurredAt,
      recordedAt,
      sourceDomain: command.sourceDomain,
      sourceEntityType: command.sourceEntityType,
      sourceEntityId: command.sourceEntityId,
      sourceActorType: command.sourceActorType,
      sourceActorId: command.sourceActorId,
      provenanceType: command.provenanceType,
      title: command.title.trim(),
      summary: command.summary.trim(),
      structuredPayload: command.structuredPayload,
      visibility: command.visibility || 'HOUSEHOLD',
      status: 'ACTIVE',
      correlationId,
      deduplicationKey: dedupeKey,
      createdAt: now,
      updatedAt: now
    };

    TimelineStore.save(event);

    // 5. Compliance Audit Record
    InMemoryAuditStore.record({
      actorId: command.sourceActorId,
      actorType: command.sourceActorType,
      action: 'TIMELINE_EVENT_RECORDED',
      resourceType: 'pet_timeline',
      resourceId: timelineEventId,
      classification: event.visibility === 'RESTRICTED' ? 'RESTRICTED' : 'CONFIDENTIAL',
      reasonCode: 'TIMELINE_APPEND',
      metadata: {
        petId: command.petId,
        eventCategory: command.eventCategory,
        eventType: command.eventType,
        occurredAt,
        provenanceType: command.provenanceType
      }
    });

    // 6. Outbox Domain Event
    PetStore.recordOutboxEvent(TimelineEventFactory.eventRecorded(event, correlationId));

    return event;
  }

  /**
   * Records an owner observation / journal note manually with strict OWNER_ENTERED provenance.
   */
  static recordManualObservation(
    actorId: string,
    petId: PetId,
    title: string,
    summary: string,
    category: TimelineEvent['eventCategory'] = 'ACTIVITY',
    occurredAt?: string,
    structuredPayload?: Record<string, unknown>
  ): TimelineEvent {
    const pet = PetStore.findPetById(petId);
    if (!pet) {
      throw new Error(`Pet with ID ${petId} not found.`);
    }

    // Check authorization: must have pet.timeline.manage_manual
    const auth = AuthorizationService.checkPetPermission(
      actorId,
      pet.householdId,
      petId,
      'pet.timeline.manage_manual'
    );
    if (!auth.allowed) {
      throw new Error(auth.message || 'Unauthorized to add timeline observation.');
    }

    const manualId = generateUUIDv7();
    return this.recordEvent({
      petId,
      householdId: pet.householdId,
      eventType: 'manual.observation',
      eventCategory: category,
      occurredAt: occurredAt || new Date().toISOString(),
      sourceDomain: 'OBSERVATION',
      sourceEntityType: 'manual_observation',
      sourceEntityId: manualId,
      sourceActorType: 'USER',
      sourceActorId: actorId,
      provenanceType: 'OWNER_ENTERED',
      title,
      summary,
      structuredPayload,
      visibility: 'HOUSEHOLD',
      deduplicationKey: `OBSERVATION:manual_observation:${manualId}:manual.observation`
    });
  }

  /**
   * Corrects a historical event via supersession (append-only immutability).
   */
  static supersedeEvent(command: SupersedeTimelineEventCommand): TimelineEvent {
    const oldEvent = TimelineStore.findById(command.oldEventId);
    if (!oldEvent) {
      throw new Error(`Timeline event with ID ${command.oldEventId} not found.`);
    }

    if (oldEvent.status !== 'ACTIVE') {
      throw new Error(`Cannot supersede event with status ${oldEvent.status}.`);
    }

    // Authorization
    const auth = AuthorizationService.checkPetPermission(
      command.actorId,
      oldEvent.householdId,
      oldEvent.petId,
      'pet.timeline.manage_manual'
    );
    if (!auth.allowed) {
      throw new Error(auth.message || 'Unauthorized to modify timeline event.');
    }

    const now = new Date().toISOString();
    const newEventId = asTimelineEventId(generateUUIDv7());
    const correlationId = command.correlationId ? asCorrelationId(command.correlationId) : asCorrelationId(generateUUIDv7());

    // 1. Mark old event as superseded
    oldEvent.status = 'SUPERSEDED';
    oldEvent.supersededBy = newEventId;
    oldEvent.updatedAt = now;
    TimelineStore.save(oldEvent);

    // 2. Create replacement event
    const newEvent: TimelineEvent = {
      ...oldEvent,
      ...command.updatedData,
      timelineEventId: newEventId,
      supersedes: oldEvent.timelineEventId,
      supersededBy: undefined,
      status: 'ACTIVE',
      recordedAt: now,
      correlationId,
      deduplicationKey: `SUPERSEDED:${oldEvent.timelineEventId}:${newEventId}`,
      createdAt: now,
      updatedAt: now
    };

    TimelineStore.save(newEvent);

    // 3. Audit
    InMemoryAuditStore.record({
      actorId: command.actorId,
      actorType: 'USER',
      action: 'TIMELINE_EVENT_SUPERSEDED',
      resourceType: 'pet_timeline',
      resourceId: newEventId,
      classification: 'CONFIDENTIAL',
      reasonCode: 'TIMELINE_SUPERSEDED',
      metadata: {
        oldEventId: oldEvent.timelineEventId,
        reason: command.reason
      }
    });

    // 4. Outbox
    PetStore.recordOutboxEvent(
      TimelineEventFactory.eventSuperseded(
        oldEvent.petId,
        oldEvent.timelineEventId,
        newEventId,
        command.actorId,
        command.reason,
        correlationId
      )
    );

    return newEvent;
  }

  /**
   * Retracts an erroneously recorded timeline event.
   */
  static retractEvent(command: RetractTimelineEventCommand): TimelineEvent {
    const event = TimelineStore.findById(command.eventId);
    if (!event) {
      throw new Error(`Timeline event with ID ${command.eventId} not found.`);
    }

    if (event.status !== 'ACTIVE') {
      throw new Error(`Cannot retract event with status ${event.status}.`);
    }

    // Authorization
    const auth = AuthorizationService.checkPetPermission(
      command.actorId,
      event.householdId,
      event.petId,
      'pet.timeline.manage_manual'
    );
    if (!auth.allowed) {
      throw new Error(auth.message || 'Unauthorized to retract timeline event.');
    }

    const now = new Date().toISOString();
    event.status = 'RETRACTED';
    event.retractedAt = now;
    event.retractedReason = command.reason;
    event.updatedAt = now;

    TimelineStore.save(event);

    // Audit
    InMemoryAuditStore.record({
      actorId: command.actorId,
      actorType: 'USER',
      action: 'TIMELINE_EVENT_RETRACTED',
      resourceType: 'pet_timeline',
      resourceId: event.timelineEventId,
      classification: 'CONFIDENTIAL',
      reasonCode: 'TIMELINE_RETRACTED',
      metadata: {
        reason: command.reason
      }
    });

    // Outbox
    PetStore.recordOutboxEvent(
      TimelineEventFactory.eventRetracted(
        event.petId,
        event.timelineEventId,
        command.actorId,
        command.reason,
        command.correlationId
      )
    );

    return event;
  }

  /**
   * Queries the unified timeline for a pet with strict cross-household authorization.
   */
  static listPetTimeline(
    actorId: string,
    petId: PetId,
    options: TimelineQueryOptions = {}
  ): TimelineQueryResult {
    const pet = PetStore.findPetById(petId);
    if (!pet) {
      throw new Error(`Pet with ID ${petId} not found.`);
    }

    // Enforce cross-household boundary
    const auth = AuthorizationService.checkPetPermission(
      actorId,
      pet.householdId,
      petId,
      'pet.timeline.read'
    );
    if (!auth.allowed) {
      throw new Error(auth.message || 'Unauthorized access to pet timeline.');
    }

    return TimelineStore.query(petId, options);
  }

  /**
   * Retrieves a single timeline event by ID with authorization check.
   */
  static getEventById(actorId: string, petId: PetId, eventId: TimelineEventId): TimelineEvent {
    const pet = PetStore.findPetById(petId);
    if (!pet) {
      throw new Error(`Pet with ID ${petId} not found.`);
    }

    const auth = AuthorizationService.checkPetPermission(
      actorId,
      pet.householdId,
      petId,
      'pet.timeline.read'
    );
    if (!auth.allowed) {
      throw new Error(auth.message || 'Unauthorized access to pet timeline.');
    }

    const ev = TimelineStore.findById(eventId);
    if (!ev || ev.petId !== petId) {
      throw new Error(`Timeline event ${eventId} not found for this pet.`);
    }

    return ev;
  }

  /**
   * Ingests asynchronous domain events and projects them into timeline entries idempotently.
   */
  static handleDomainEvent(envelope: EventEnvelope<any>): TimelineEvent | null {
    const petId = envelope.aggregateId as PetId;
    const pet = PetStore.findPetById(petId);
    if (!pet) {
      return null;
    }

    const dedupeKey = `DOMAIN_EVENT:${envelope.eventType}:${envelope.eventId}`;
    const existing = TimelineStore.findByDeduplicationKey(dedupeKey);
    if (existing) {
      return existing;
    }

    const p = envelope.payload;
    const actorId = p.actorId || p.createdBy || p.uploadedBy || 'SYSTEM';

    switch (envelope.eventType) {
      case 'pet.created': {
        return this.recordEvent({
          petId,
          householdId: pet.householdId,
          eventType: 'pet.created',
          eventCategory: 'LIFECYCLE',
          occurredAt: pet.createdAt,
          sourceDomain: 'PET_CORE',
          sourceEntityType: 'pet',
          sourceEntityId: petId,
          sourceActorType: actorId === 'SYSTEM' ? 'SYSTEM' : 'USER',
          sourceActorId: actorId,
          provenanceType: 'SYSTEM_GENERATED',
          title: `${pet.name} Registered in Pet OS`,
          summary: `Official digital twin created for ${pet.name} (${pet.breedCode}, ${pet.sex}).`,
          structuredPayload: { name: pet.name, species: pet.speciesCode, breed: pet.breedCode },
          deduplicationKey: dedupeKey,
          correlationId: envelope.correlationId
        });
      }

      case 'pet.updated': {
        const fields = Array.isArray(p.updatedFields) ? p.updatedFields.join(', ') : 'Profile details';
        return this.recordEvent({
          petId,
          householdId: pet.householdId,
          eventType: 'pet.updated',
          eventCategory: 'IDENTITY',
          occurredAt: envelope.timestamp,
          sourceDomain: 'PET_CORE',
          sourceEntityType: 'pet',
          sourceEntityId: petId,
          sourceActorType: 'USER',
          sourceActorId: actorId,
          provenanceType: 'OWNER_ENTERED',
          title: `Pet Profile Updated`,
          summary: `Updated identity fields: ${fields}.`,
          structuredPayload: { updatedFields: p.updatedFields, version: p.version },
          deduplicationKey: dedupeKey,
          correlationId: envelope.correlationId
        });
      }

      case 'pet.archived': {
        return this.recordEvent({
          petId,
          householdId: pet.householdId,
          eventType: 'pet.archived',
          eventCategory: 'LIFECYCLE',
          occurredAt: envelope.timestamp,
          sourceDomain: 'PET_CORE',
          sourceEntityType: 'pet',
          sourceEntityId: petId,
          sourceActorType: 'USER',
          sourceActorId: actorId,
          provenanceType: 'OWNER_ENTERED',
          title: `Pet Profile Archived`,
          summary: `${pet.name} was archived by household caregiver.`,
          deduplicationKey: dedupeKey,
          correlationId: envelope.correlationId
        });
      }

      case 'pet.restored': {
        return this.recordEvent({
          petId,
          householdId: pet.householdId,
          eventType: 'pet.restored',
          eventCategory: 'LIFECYCLE',
          occurredAt: envelope.timestamp,
          sourceDomain: 'PET_CORE',
          sourceEntityType: 'pet',
          sourceEntityId: petId,
          sourceActorType: 'USER',
          sourceActorId: actorId,
          provenanceType: 'OWNER_ENTERED',
          title: `Pet Profile Restored`,
          summary: `${pet.name} was restored to active status.`,
          deduplicationKey: dedupeKey,
          correlationId: envelope.correlationId
        });
      }

      case 'pet.deceased': {
        return this.recordEvent({
          petId,
          householdId: pet.householdId,
          eventType: 'pet.deceased',
          eventCategory: 'LIFECYCLE',
          occurredAt: p.deceasedAt || envelope.timestamp,
          sourceDomain: 'PET_CORE',
          sourceEntityType: 'pet',
          sourceEntityId: petId,
          sourceActorType: 'USER',
          sourceActorId: actorId,
          provenanceType: 'OWNER_ENTERED',
          title: `Memorial - Passed Away`,
          summary: p.deceasedNote ? `Note: ${p.deceasedNote}` : `${pet.name} marked deceased. May they rest peacefully.`,
          structuredPayload: { deceasedAt: p.deceasedAt, note: p.deceasedNote },
          deduplicationKey: dedupeKey,
          correlationId: envelope.correlationId
        });
      }

      case 'pet.microchip_registered': {
        return this.recordEvent({
          petId,
          householdId: pet.householdId,
          eventType: 'pet.microchip_registered',
          eventCategory: 'IDENTITY',
          occurredAt: envelope.timestamp,
          sourceDomain: 'PET_CORE',
          sourceEntityType: 'pet_microchip',
          sourceEntityId: p.microchipId,
          sourceActorType: 'USER',
          sourceActorId: actorId,
          provenanceType: 'OWNER_ENTERED',
          title: `Microchip Registered`,
          summary: `Microchip RFID tag #${p.microchipNumber} registered. Note: Passive RFID scanning only (not GPS tracker).`,
          structuredPayload: { microchipNumber: p.microchipNumber },
          deduplicationKey: dedupeKey,
          correlationId: envelope.correlationId
        });
      }

      case 'pet.profile_photo_changed': {
        return this.recordEvent({
          petId,
          householdId: pet.householdId,
          eventType: 'pet.profile_photo_changed',
          eventCategory: 'IDENTITY',
          occurredAt: envelope.timestamp,
          sourceDomain: 'PET_CORE',
          sourceEntityType: 'pet_photo',
          sourceEntityId: p.newPhotoId || 'DEFAULT',
          sourceActorType: 'USER',
          sourceActorId: actorId,
          provenanceType: 'OWNER_ENTERED',
          title: `Primary Profile Photo Updated`,
          summary: `A new primary avatar photo was set for ${pet.name}.`,
          deduplicationKey: dedupeKey,
          correlationId: envelope.correlationId
        });
      }

      case 'pet.relationship_created': {
        return this.recordEvent({
          petId,
          householdId: pet.householdId,
          eventType: 'pet.relationship_created',
          eventCategory: 'IDENTITY',
          occurredAt: envelope.timestamp,
          sourceDomain: 'PET_CORE',
          sourceEntityType: 'pet_relationship',
          sourceEntityId: p.userId,
          sourceActorType: 'USER',
          sourceActorId: actorId,
          provenanceType: 'SYSTEM_GENERATED',
          title: `Caregiver Assigned`,
          summary: `Caregiver assigned as ${p.relationshipType} (${p.isPrimaryContact ? 'Primary Contact' : 'Secondary'}).`,
          structuredPayload: { userId: p.userId, relationshipType: p.relationshipType },
          deduplicationKey: dedupeKey,
          correlationId: envelope.correlationId
        });
      }

      default:
        return null;
    }
  }
}
