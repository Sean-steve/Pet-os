/**
 * Pet OS Sprint 19 - Veterinary Professional Workspace Domain Events
 * 
 * Follows CloudEvents / EventEnvelope standard from shared kernel.
 */

import { EventEnvelope, createEventEnvelope } from '../kernel/events';
import {
  generateUUIDv7,
  asEventId,
  asCorrelationId,
  UserId,
  HouseholdId,
  PetId,
  BusinessId,
  EncounterId,
  ClinicalAccessGrantId,
  ClinicalBreakGlassAccessId,
  PrescriptionId,
  CarePlanId,
  VeterinaryReferralId,
} from '../kernel/ids';

export function createVetWorkspaceEvent<T>(
  type: string,
  aggregateId: string,
  aggregateType: string,
  payload: T,
  actorUserId?: UserId,
  correlationId?: string
): EventEnvelope<T> {
  return createEventEnvelope(
    type,
    aggregateType,
    aggregateId,
    payload,
    1,
    correlationId ? asCorrelationId(correlationId) : undefined,
    actorUserId
  );
}
