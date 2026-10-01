/**
 * Pet OS Sprint 25 - Tracker Connectivity Subscription Domain Events
 * Volume XXIX: Event, Command & Asynchronous Architecture
 */

import {
  EventId,
  UserId,
  HouseholdId,
  DeviceId,
  IncidentId,
  TrackerSubscriptionId,
  TrackerServicePlanId,
  TrackerDeviceTransferRecordId,
  generateUUIDv7,
} from '../kernel/ids';
import { TrackerSubscriptionStatus, CarrierVendor, CarrierProvisioningStatus } from './types';

export type TrackerEventType =
  | 'TRACKER_SUBSCRIPTION_ACTIVATED'
  | 'TRACKER_SUBSCRIPTION_RENEWED'
  | 'TRACKER_SUBSCRIPTION_PAST_DUE'
  | 'TRACKER_SUBSCRIPTION_GRACE_PERIOD_STARTED'
  | 'TRACKER_CONNECTIVITY_SUSPENDED'
  | 'TRACKER_CONNECTIVITY_RESTORED'
  | 'TRACKER_SUBSCRIPTION_CANCELLED'
  | 'TRACKER_HARDWARE_TRANSFERRED'
  | 'TRACKER_SAFETY_OVERRIDE_ACTIVATED'
  | 'TRACKER_SAFETY_OVERRIDE_EXPIRED'
  | 'CARRIER_SIM_PROVISIONED'
  | 'CARRIER_SIM_STATE_CHANGED'
  | 'CARRIER_OUTAGE_STATUS_CHANGED'
  | 'TRACKER_DATA_QUOTA_ALERT';

export interface TrackerDomainEvent<T = any> {
  eventId: EventId;
  eventType: TrackerEventType;
  occurredAt: string;
  aggregateId: string;
  payload: T;
  metadata: {
    actorId?: UserId;
    householdId?: HouseholdId;
    correlationId: string;
  };
}

export class TrackerEventFactory {
  public static create<T>(
    eventType: TrackerEventType,
    aggregateId: string,
    payload: T,
    metadata?: { actorId?: UserId; householdId?: HouseholdId; correlationId?: string }
  ): TrackerDomainEvent<T> {
    return {
      eventId: generateUUIDv7() as EventId,
      eventType,
      occurredAt: new Date().toISOString(),
      aggregateId,
      payload,
      metadata: {
        actorId: metadata?.actorId,
        householdId: metadata?.householdId,
        correlationId: metadata?.correlationId || generateUUIDv7(),
      },
    };
  }
}
