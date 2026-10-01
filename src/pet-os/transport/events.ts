/**
 * Pet OS Sprint 22 — Pet Transport Domain & Integration Events
 */

import {
  TransportTripId,
  TransportStopId,
  TransportDriverProfileId,
  TransportVehicleId,
  TransportCustodyRecordId,
  TransportIncidentId,
  TransportSafetyAlertId,
  TransportHandoverRecordId,
  TransportCompletionEvidenceId,
  BookingId,
  PetId,
  UserId,
  HouseholdId,
} from '../kernel/ids';
import {
  IncidentCategory,
  IncidentSeverity,
  DelayReason,
  RecipientVerificationMethod,
  TransportCustodyStatus,
} from './types';

export interface TransportDomainEventBase {
  eventId: string;
  eventType: string;
  tripId: TransportTripId;
  timestamp: string;
  actorUserId: UserId;
}

export interface TransportTripCreatedEvent extends TransportDomainEventBase {
  eventType: 'TransportTripCreated';
  bookingId: BookingId;
  householdId: HouseholdId;
  petIds: PetId[];
  stopCount: number;
}

export interface TransportDriverAssignedEvent extends TransportDomainEventBase {
  eventType: 'TransportDriverAssigned';
  driverId: TransportDriverProfileId;
}

export interface TransportVehicleAssignedEvent extends TransportDomainEventBase {
  eventType: 'TransportVehicleAssigned';
  vehicleId: TransportVehicleId;
}

export interface TransportPickupCheckedInEvent extends TransportDomainEventBase {
  eventType: 'TransportPickupCheckedIn';
  stopId: TransportStopId;
  driverId: TransportDriverProfileId;
}

export interface PetIdentityConfirmedEvent extends TransportDomainEventBase {
  eventType: 'PetIdentityConfirmed';
  petId: PetId;
  verificationMethod: string;
}

export interface PetTransportCustodyAcceptedEvent extends TransportDomainEventBase {
  eventType: 'PetTransportCustodyAccepted';
  petId: PetId;
  custodyRecordId: TransportCustodyRecordId;
  driverId: TransportDriverProfileId;
}

export interface PetContainmentConfirmedEvent extends TransportDomainEventBase {
  eventType: 'PetContainmentConfirmed';
  petId: PetId;
  vehicleId: TransportVehicleId;
  slotId: string;
  containmentType: string;
}

export interface TransportTripStartedEvent extends TransportDomainEventBase {
  eventType: 'TransportTripStarted';
  trackingSessionId: string;
  routeReference: string;
}

export interface TransportStopArrivedEvent extends TransportDomainEventBase {
  eventType: 'TransportStopArrived';
  stopId: TransportStopId;
  sequence: number;
}

export interface TransportStopCompletedEvent extends TransportDomainEventBase {
  eventType: 'TransportStopCompleted';
  stopId: TransportStopId;
  sequence: number;
}

export interface TransportDelayedEvent extends TransportDomainEventBase {
  eventType: 'TransportDelayed';
  reason: DelayReason;
  delayMinutes: number;
  revisedEta: string;
}

export interface TransportEnvironmentObservationRecordedEvent extends TransportDomainEventBase {
  eventType: 'TransportEnvironmentObservationRecorded';
  vehicleId: TransportVehicleId;
  observationType: string;
  value: number;
  unit: string;
}

export interface TransportSafetyAlertRaisedEvent extends TransportDomainEventBase {
  eventType: 'TransportSafetyAlertRaised';
  alertId: TransportSafetyAlertId;
  alertType: string;
  message: string;
}

export interface TransportIncidentReportedEvent extends TransportDomainEventBase {
  eventType: 'TransportIncidentReported';
  incidentId: TransportIncidentId;
  category: IncidentCategory;
  severity: IncidentSeverity;
  description: string;
}

export interface TransportVehicleReassignedEvent extends TransportDomainEventBase {
  eventType: 'TransportVehicleReassigned';
  previousVehicleId: TransportVehicleId;
  newVehicleId: TransportVehicleId;
  reason: string;
}

export interface TransportDriverReassignedEvent extends TransportDomainEventBase {
  eventType: 'TransportDriverReassigned';
  previousDriverId: TransportDriverProfileId;
  newDriverId: TransportDriverProfileId;
  reason: string;
}

export interface PetTransportCustodyTransferredEvent extends TransportDomainEventBase {
  eventType: 'PetTransportCustodyTransferred';
  petId: PetId;
  custodyRecordId: TransportCustodyRecordId;
  fromRole: string;
  toRole: string;
  newCustodyStatus: TransportCustodyStatus;
}

export interface PetTransportHandoverCompletedEvent extends TransportDomainEventBase {
  eventType: 'PetTransportHandoverCompleted';
  handoverId: TransportHandoverRecordId;
  petId: PetId;
  recipientName: string;
  verificationMethod: RecipientVerificationMethod;
}

export interface TransportTripCompletedEvent extends TransportDomainEventBase {
  eventType: 'TransportTripCompleted';
  completionEvidenceId: TransportCompletionEvidenceId;
  bookingId: BookingId;
  durationMinutes: number;
}

export interface TransportTripAbortedEvent extends TransportDomainEventBase {
  eventType: 'TransportTripAborted';
  bookingId: BookingId;
  reason: string;
}

// Integration Events emitted to other Pet OS domains
export interface TrackingSessionRequestedEvent extends TransportDomainEventBase {
  eventType: 'TrackingSessionRequested';
  purpose: 'PET_TRANSPORT';
  source: 'DRIVER_MOBILE' | 'VEHICLE_TRACKER';
}

export interface TrackingSessionCompletedEvent extends TransportDomainEventBase {
  eventType: 'TrackingSessionCompleted';
  trackingSessionId: string;
}

export interface LostPetIncidentRequestedEvent extends TransportDomainEventBase {
  eventType: 'LostPetIncidentRequested';
  petId: PetId;
  householdId: HouseholdId;
  lastKnownTrackingReference: string;
  custodianAtTimeOfEscape: string;
  incidentId: TransportIncidentId;
}

export interface ServiceExecutionCompletedEvent {
  eventId: string;
  eventType: 'ServiceExecutionCompleted';
  bookingId: BookingId;
  serviceCategory: 'PET_TRANSPORT';
  completedAt: string;
  evidenceId: string;
}

export interface ServiceExecutionAbortedEvent {
  eventId: string;
  eventType: 'ServiceExecutionAborted';
  bookingId: BookingId;
  serviceCategory: 'PET_TRANSPORT';
  abortedAt: string;
  reason: string;
}

export interface BookingReviewEligibleEvent {
  eventId: string;
  eventType: 'BookingReviewEligible';
  bookingId: BookingId;
  tripId: TransportTripId;
  completedAt: string;
}

export type TransportEvent =
  | TransportTripCreatedEvent
  | TransportDriverAssignedEvent
  | TransportVehicleAssignedEvent
  | TransportPickupCheckedInEvent
  | PetIdentityConfirmedEvent
  | PetTransportCustodyAcceptedEvent
  | PetContainmentConfirmedEvent
  | TransportTripStartedEvent
  | TransportStopArrivedEvent
  | TransportStopCompletedEvent
  | TransportDelayedEvent
  | TransportEnvironmentObservationRecordedEvent
  | TransportSafetyAlertRaisedEvent
  | TransportIncidentReportedEvent
  | TransportVehicleReassignedEvent
  | TransportDriverReassignedEvent
  | PetTransportCustodyTransferredEvent
  | PetTransportHandoverCompletedEvent
  | TransportTripCompletedEvent
  | TransportTripAbortedEvent
  | TrackingSessionRequestedEvent
  | TrackingSessionCompletedEvent
  | LostPetIncidentRequestedEvent
  | ServiceExecutionCompletedEvent
  | ServiceExecutionAbortedEvent
  | BookingReviewEligibleEvent;
