/**
 * Pet OS Sprint 4 - Pet Documents Domain Events
 * Implements Volume XXIX (Event, Command & Asynchronous Architecture)
 */

import { EventEnvelope } from '../kernel/events';
import { PetId, PetDocumentId, UserId, generateUUIDv7, asEventId, asCorrelationId } from '../kernel/ids';
import { PetDocument } from './types';

export type DocumentDomainEventType =
  | 'document.uploaded'
  | 'document.replaced'
  | 'document.archived'
  | 'document.downloaded';

export class DocumentEventFactory {
  static documentUploaded(doc: PetDocument, correlationId?: string): EventEnvelope<PetDocument> {
    return {
      eventId: asEventId(generateUUIDv7()),
      eventType: 'document.uploaded',
      aggregateType: 'pet_document',
      aggregateId: doc.documentId,
      timestamp: new Date().toISOString(),
      version: 1,
      correlationId: correlationId ? asCorrelationId(correlationId) : asCorrelationId(generateUUIDv7()),
      payload: { ...doc },
      metadata: {
        source: 'pet-os.documents',
        householdId: doc.householdId,
        actorId: doc.uploadedBy
      }
    };
  }

  static documentReplaced(
    petId: PetId,
    oldDocId: PetDocumentId,
    newDocId: PetDocumentId,
    actorId: UserId,
    reason?: string,
    correlationId?: string
  ): EventEnvelope<Record<string, unknown>> {
    return {
      eventId: asEventId(generateUUIDv7()),
      eventType: 'document.replaced',
      aggregateType: 'pet_document',
      aggregateId: newDocId,
      timestamp: new Date().toISOString(),
      version: 1,
      correlationId: correlationId ? asCorrelationId(correlationId) : asCorrelationId(generateUUIDv7()),
      payload: {
        petId,
        oldDocumentId: oldDocId,
        newDocumentId: newDocId,
        actorId,
        reason
      },
      metadata: {
        source: 'pet-os.documents'
      }
    };
  }

  static documentArchived(
    petId: PetId,
    documentId: PetDocumentId,
    actorId: UserId,
    correlationId?: string
  ): EventEnvelope<Record<string, unknown>> {
    return {
      eventId: asEventId(generateUUIDv7()),
      eventType: 'document.archived',
      aggregateType: 'pet_document',
      aggregateId: documentId,
      timestamp: new Date().toISOString(),
      version: 1,
      correlationId: correlationId ? asCorrelationId(correlationId) : asCorrelationId(generateUUIDv7()),
      payload: {
        petId,
        documentId,
        actorId
      },
      metadata: {
        source: 'pet-os.documents'
      }
    };
  }

  static documentDownloaded(
    petId: PetId,
    documentId: PetDocumentId,
    actorId: UserId,
    correlationId?: string
  ): EventEnvelope<Record<string, unknown>> {
    return {
      eventId: asEventId(generateUUIDv7()),
      eventType: 'document.downloaded',
      aggregateType: 'pet_document',
      aggregateId: documentId,
      timestamp: new Date().toISOString(),
      version: 1,
      correlationId: correlationId ? asCorrelationId(correlationId) : asCorrelationId(generateUUIDv7()),
      payload: {
        petId,
        documentId,
        actorId
      },
      metadata: {
        source: 'pet-os.documents'
      }
    };
  }
}
