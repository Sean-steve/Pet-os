/**
 * Pet OS Sprint 4 - Digital Pet Passport Domain Events
 * Implements Volume XXIX (Event, Command & Asynchronous Architecture)
 */

import { EventEnvelope } from '../kernel/events';
import { PetId, PassportShareId, PassportExportId, UserId, generateUUIDv7, asEventId, asCorrelationId } from '../kernel/ids';
import { PassportShareScope } from './types';

export type PassportDomainEventType =
  | 'passport.generated'
  | 'passport.share_created'
  | 'passport.share_accessed'
  | 'passport.share_revoked'
  | 'passport.exported';

export class PassportEventFactory {
  static passportGenerated(petId: PetId, scope: PassportShareScope, actorId: UserId, correlationId?: string): EventEnvelope<Record<string, unknown>> {
    return {
      eventId: asEventId(generateUUIDv7()),
      eventType: 'passport.generated',
      aggregateType: 'pet_passport',
      aggregateId: petId,
      timestamp: new Date().toISOString(),
      version: 1,
      correlationId: correlationId ? asCorrelationId(correlationId) : asCorrelationId(generateUUIDv7()),
      payload: { petId, scope, actorId },
      metadata: { source: 'pet-os.passport' }
    };
  }

  static shareCreated(
    petId: PetId,
    shareId: PassportShareId,
    scope: PassportShareScope,
    recipientLabel: string | undefined,
    expiresAt: string,
    actorId: UserId,
    correlationId?: string
  ): EventEnvelope<Record<string, unknown>> {
    return {
      eventId: asEventId(generateUUIDv7()),
      eventType: 'passport.share_created',
      aggregateType: 'pet_passport_share',
      aggregateId: shareId,
      timestamp: new Date().toISOString(),
      version: 1,
      correlationId: correlationId ? asCorrelationId(correlationId) : asCorrelationId(generateUUIDv7()),
      payload: { petId, shareId, scope, recipientLabel, expiresAt, actorId },
      metadata: { source: 'pet-os.passport' }
    };
  }

  static shareAccessed(
    petId: PetId,
    shareId: PassportShareId,
    scope: PassportShareScope,
    accessCount: number,
    correlationId?: string
  ): EventEnvelope<Record<string, unknown>> {
    return {
      eventId: asEventId(generateUUIDv7()),
      eventType: 'passport.share_accessed',
      aggregateType: 'pet_passport_share',
      aggregateId: shareId,
      timestamp: new Date().toISOString(),
      version: 1,
      correlationId: correlationId ? asCorrelationId(correlationId) : asCorrelationId(generateUUIDv7()),
      payload: { petId, shareId, scope, accessCount },
      metadata: { source: 'pet-os.passport' }
    };
  }

  static shareRevoked(
    petId: PetId,
    shareId: PassportShareId,
    actorId: UserId,
    correlationId?: string
  ): EventEnvelope<Record<string, unknown>> {
    return {
      eventId: asEventId(generateUUIDv7()),
      eventType: 'passport.share_revoked',
      aggregateType: 'pet_passport_share',
      aggregateId: shareId,
      timestamp: new Date().toISOString(),
      version: 1,
      correlationId: correlationId ? asCorrelationId(correlationId) : asCorrelationId(generateUUIDv7()),
      payload: { petId, shareId, actorId },
      metadata: { source: 'pet-os.passport' }
    };
  }

  static exported(
    petId: PetId,
    exportId: PassportExportId,
    scope: PassportShareScope,
    format: string,
    actorId: UserId,
    correlationId?: string
  ): EventEnvelope<Record<string, unknown>> {
    return {
      eventId: asEventId(generateUUIDv7()),
      eventType: 'passport.exported',
      aggregateType: 'pet_passport_export',
      aggregateId: exportId,
      timestamp: new Date().toISOString(),
      version: 1,
      correlationId: correlationId ? asCorrelationId(correlationId) : asCorrelationId(generateUUIDv7()),
      payload: { petId, exportId, scope, format, actorId },
      metadata: { source: 'pet-os.passport' }
    };
  }
}
