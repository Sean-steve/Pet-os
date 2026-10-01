/**
 * Pet OS Sprint 3 - Pet Core Domain & Integration Events
 * Implements Volume XXIX (Event, Command & Asynchronous Architecture) & ADR-016 (Transactional Outbox).
 */

import { EventEnvelope } from '../kernel/events';
import { PetId, HouseholdId, UserId, PetPhotoId, MicrochipId, generateUUIDv7, asEventId, asCorrelationId } from '../kernel/ids';

export type PetEventType =
  | 'pet.created'
  | 'pet.updated'
  | 'pet.archived'
  | 'pet.restored'
  | 'pet.deceased'
  | 'pet.relationship_created'
  | 'pet.relationship_updated'
  | 'pet.relationship_removed'
  | 'pet.microchip_registered'
  | 'pet.microchip_updated'
  | 'pet.photo_uploaded'
  | 'pet.profile_photo_changed'
  | 'pet.photo_deleted';

export class PetEventFactory {
  static createEvent<T extends Record<string, unknown>>(
    eventType: PetEventType,
    aggregateId: PetId,
    payload: T,
    correlationId?: string
  ): EventEnvelope<T> {
    return {
      eventId: asEventId(generateUUIDv7()),
      eventType,
      aggregateType: 'pet',
      aggregateId,
      timestamp: new Date().toISOString(),
      version: 1,
      correlationId: correlationId ? asCorrelationId(correlationId) : asCorrelationId(generateUUIDv7()),
      payload: {
        ...payload,
        aggregateId
      },
      metadata: {
        source: 'pet-os.pet-core'
      }
    };
  }

  static petCreated(petId: PetId, householdId: HouseholdId, name: string, speciesCode: string, breedCode: string, sex: string, createdBy: UserId) {
    return this.createEvent('pet.created', petId, {
      petId,
      householdId,
      name,
      speciesCode,
      breedCode,
      sex,
      createdBy
    });
  }

  static petUpdated(petId: PetId, householdId: HouseholdId, updatedFields: string[], version: number, actorId: UserId) {
    return this.createEvent('pet.updated', petId, {
      petId,
      householdId,
      updatedFields,
      version,
      actorId
    });
  }

  static petArchived(petId: PetId, householdId: HouseholdId, actorId: UserId) {
    return this.createEvent('pet.archived', petId, {
      petId,
      householdId,
      archivedAt: new Date().toISOString(),
      actorId
    });
  }

  static petRestored(petId: PetId, householdId: HouseholdId, actorId: UserId) {
    return this.createEvent('pet.restored', petId, {
      petId,
      householdId,
      restoredAt: new Date().toISOString(),
      actorId
    });
  }

  static petMarkedDeceased(petId: PetId, householdId: HouseholdId, deceasedAt: string, deceasedNote: string | undefined, actorId: UserId) {
    return this.createEvent('pet.deceased', petId, {
      petId,
      householdId,
      deceasedAt,
      deceasedNote,
      actorId
    });
  }

  static petMicrochipRegistered(petId: PetId, microchipId: MicrochipId, microchipNumber: string, actorId: UserId) {
    return this.createEvent('pet.microchip_registered', petId, {
      petId,
      microchipId,
      microchipNumber,
      actorId
    });
  }

  static petPhotoUploaded(petId: PetId, photoId: PetPhotoId, storageKey: string, purpose: string, actorId: UserId) {
    return this.createEvent('pet.photo_uploaded', petId, {
      petId,
      photoId,
      storageKey,
      purpose,
      actorId
    });
  }

  static petProfilePhotoChanged(petId: PetId, newPhotoId: PetPhotoId | undefined, actorId: UserId) {
    return this.createEvent('pet.profile_photo_changed', petId, {
      petId,
      newPhotoId,
      actorId
    });
  }

  static petRelationshipCreated(petId: PetId, userId: UserId, relationshipType: string, isPrimaryContact: boolean) {
    return this.createEvent('pet.relationship_created', petId, {
      petId,
      userId,
      relationshipType,
      isPrimaryContact
    });
  }
}
