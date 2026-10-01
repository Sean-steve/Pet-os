/**
 * Pet OS Sprint 14 - Tracking & Location Platform Domain Events
 * Implements privacy-first data minimization: coordinates are NOT leaked on general domain bus.
 */

import {
  DeviceId,
  PetId,
  HouseholdId,
  UserId,
  TrackingSessionId,
  TrackingDeviceAssignmentId,
  LocationObservationId,
  RouteId,
  asEventId,
  generateUUIDv7,
} from '../kernel/ids';
import {
  DeviceType,
  BatteryStatus,
  DeviceConnectivityStatus,
  LocationQuality,
  LocationFreshness,
  DistanceReliability,
} from './types';

export interface BaseTrackingDomainEvent {
  eventId: string;
  eventType: string;
  occurredAt: string;
  aggregateId: string;
  actorUserId?: UserId;
}

export interface TrackingDeviceRegisteredEvent extends BaseTrackingDomainEvent {
  eventType: 'TrackingDeviceRegistered';
  deviceId: DeviceId;
  deviceType: DeviceType;
  provider: string;
  displayName: string;
}

export interface TrackingDeviceClaimedEvent extends BaseTrackingDomainEvent {
  eventType: 'TrackingDeviceClaimed';
  deviceId: DeviceId;
  householdId: HouseholdId;
  claimedBy: UserId;
}

export interface TrackingDeviceAssignedEvent extends BaseTrackingDomainEvent {
  eventType: 'TrackingDeviceAssigned';
  assignmentId: TrackingDeviceAssignmentId;
  deviceId: DeviceId;
  petId: PetId;
  householdId: HouseholdId;
  assignedBy: UserId;
}

export interface TrackingDeviceUnassignedEvent extends BaseTrackingDomainEvent {
  eventType: 'TrackingDeviceUnassigned';
  assignmentId: TrackingDeviceAssignmentId;
  deviceId: DeviceId;
  petId: PetId;
  unassignedBy: UserId;
  reason?: string;
}

export interface TrackingSessionStartedEvent extends BaseTrackingDomainEvent {
  eventType: 'TrackingSessionStarted';
  trackingSessionId: TrackingSessionId;
  petId: PetId;
  sourceType: string;
  sourceContextType: string;
  sourceContextId?: string;
  routeReference: string;
}

export interface TrackingSessionCompletedEvent extends BaseTrackingDomainEvent {
  eventType: 'TrackingSessionCompleted';
  trackingSessionId: TrackingSessionId;
  petId: PetId;
  routeReference: string;
  durationSeconds: number;
  distanceMeters: number;
  distanceReliability: DistanceReliability;
}

export interface LocationObservationRecordedEvent extends BaseTrackingDomainEvent {
  eventType: 'LocationObservationRecorded';
  locationObservationId: LocationObservationId;
  petId: PetId;
  deviceId: DeviceId;
  trackingSessionId?: TrackingSessionId;
  observedAt: string;
  quality: LocationQuality;
  hasAnomalies: boolean;
  // NOTE: Exact latitude/longitude excluded for data minimization
}

export interface PetLiveLocationUpdatedEvent extends BaseTrackingDomainEvent {
  eventType: 'PetLiveLocationUpdated';
  petId: PetId;
  deviceId: DeviceId;
  latestObservationId: LocationObservationId;
  observedAt: string;
  freshness: LocationFreshness;
  quality: LocationQuality;
  // NOTE: Exact latitude/longitude excluded for data minimization
}

export interface RouteCompletedEvent extends BaseTrackingDomainEvent {
  eventType: 'RouteCompleted';
  routeId: RouteId;
  petId: PetId;
  trackingSessionId: TrackingSessionId;
  routeReference: string;
  distanceMeters: number;
  durationSeconds: number;
  distanceReliability: DistanceReliability;
}

export interface DeviceConnectivityChangedEvent extends BaseTrackingDomainEvent {
  eventType: 'DeviceConnectivityChanged';
  deviceId: DeviceId;
  previousStatus: DeviceConnectivityStatus;
  currentStatus: DeviceConnectivityStatus;
}

export interface DeviceBatteryLowEvent extends BaseTrackingDomainEvent {
  eventType: 'DeviceBatteryLow';
  deviceId: DeviceId;
  batteryPercent: number;
  batteryStatus: BatteryStatus;
  householdId?: HouseholdId;
}

export interface DeviceBatteryCriticalEvent extends BaseTrackingDomainEvent {
  eventType: 'DeviceBatteryCritical';
  deviceId: DeviceId;
  batteryPercent: number;
  householdId?: HouseholdId;
}

export interface TrackingIntegrationDisconnectedEvent extends BaseTrackingDomainEvent {
  eventType: 'TrackingIntegrationDisconnected';
  provider: string;
  householdId: HouseholdId;
  reason?: string;
}

export type TrackingDomainEvent =
  | TrackingDeviceRegisteredEvent
  | TrackingDeviceClaimedEvent
  | TrackingDeviceAssignedEvent
  | TrackingDeviceUnassignedEvent
  | TrackingSessionStartedEvent
  | TrackingSessionCompletedEvent
  | LocationObservationRecordedEvent
  | PetLiveLocationUpdatedEvent
  | RouteCompletedEvent
  | DeviceConnectivityChangedEvent
  | DeviceBatteryLowEvent
  | DeviceBatteryCriticalEvent
  | TrackingIntegrationDisconnectedEvent;

export class TrackingEventBus {
  private static instance: TrackingEventBus;
  private listeners: ((event: TrackingDomainEvent) => void)[] = [];

  static getInstance(): TrackingEventBus {
    if (!TrackingEventBus.instance) {
      TrackingEventBus.instance = new TrackingEventBus();
    }
    return TrackingEventBus.instance;
  }

  subscribe(listener: (event: TrackingDomainEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  publish(event: TrackingDomainEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error handling tracking domain event:', err);
      }
    }
  }
}
