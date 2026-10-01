/**
 * Pet OS Sprint 26 - Provider Business SaaS Domain Events
 * Volume XXIX: Event, Command & Asynchronous Architecture
 */

import { EventId, UserId, generateUUIDv7 } from '../kernel/ids';

export type ProviderSaaSEventType =
  | 'PROVIDER_SAAS_SUBSCRIPTION_CREATED'
  | 'PROVIDER_SAAS_SUBSCRIPTION_ACTIVATED'
  | 'PROVIDER_SAAS_SUBSCRIPTION_RENEWED'
  | 'PROVIDER_SAAS_PAYMENT_FAILED'
  | 'PROVIDER_SAAS_GRACE_PERIOD_STARTED'
  | 'PROVIDER_SAAS_RESTRICTION_STARTED'
  | 'PROVIDER_SAAS_CANCELLATION_SCHEDULED'
  | 'PROVIDER_SAAS_CANCELLED'
  | 'PROVIDER_SAAS_EXPIRED'
  | 'PROVIDER_SAAS_REACTIVATED'
  | 'PROVIDER_SAAS_PLAN_CHANGED'
  | 'PROVIDER_SEAT_LIMIT_REACHED'
  | 'PROVIDER_LOCATION_LIMIT_REACHED'
  | 'PROVIDER_SAAS_CONTINUITY_GRANTED'
  | 'PROVIDER_SAAS_CONTINUITY_ENDED'
  | 'PROVIDER_SAAS_ENTITLEMENTS_RECONCILED';

export interface ProviderSaaSDomainEvent<T = any> {
  eventId: EventId;
  eventType: ProviderSaaSEventType;
  occurredAt: string;
  aggregateId: string;
  payload: T;
  metadata: {
    actorId?: UserId;
    correlationId: string;
  };
}

export class ProviderSaaSEventFactory {
  public static create<T>(
    eventType: ProviderSaaSEventType,
    aggregateId: string,
    payload: T,
    metadata?: { actorId?: UserId; correlationId?: string }
  ): ProviderSaaSDomainEvent<T> {
    return {
      eventId: generateUUIDv7() as EventId,
      eventType,
      occurredAt: new Date().toISOString(),
      aggregateId,
      payload,
      metadata: {
        actorId: metadata?.actorId,
        correlationId: metadata?.correlationId || generateUUIDv7(),
      },
    };
  }
}
