/**
 * Pet OS Sprint 21 - Groomer, Pet Sitter & Boarding Professional Workspaces Domain Events
 */

import {
  CareEngagementId,
  CareInstructionSnapshotId,
  CareAccessGrantId,
  CareHandoverId,
  CareAccessSecretId,
  CareServiceIncidentId,
  CareCompletionEvidenceId,
  CareShiftHandoverId,
  CareServiceObservationId,
  GroomingSessionId,
  SitterVisitId,
  BoardingStayId,
  PetId,
  UserId,
  HouseholdId,
  BookingId,
} from '../kernel/ids';

import {
  CareServiceType,
  CareEngagementStatus,
  CareCustodyStatus,
  CareIncidentCategory,
  CareIncidentSeverity,
  ObservationCategory,
} from './types';

export interface CareDomainEventBase {
  eventId: string;
  occurredAt: string;
  aggregateId: string;
}

export interface CareEngagementCreatedEvent extends CareDomainEventBase {
  eventType: 'CareEngagementCreated';
  engagementId: CareEngagementId;
  bookingId: BookingId;
  serviceType: CareServiceType;
  householdId: HouseholdId;
  petIds: PetId[];
  providerId: string;
}

export interface CareInstructionSnapshotCapturedEvent extends CareDomainEventBase {
  eventType: 'CareInstructionSnapshotCaptured';
  snapshotId: CareInstructionSnapshotId;
  engagementId: CareEngagementId;
  petId: PetId;
  capturedBy: UserId;
}

export interface CareInstructionAmendedEvent extends CareDomainEventBase {
  eventType: 'CareInstructionAmended';
  snapshotId: CareInstructionSnapshotId;
  amendedBy: UserId;
  category: string;
  changeSummary: string;
}

export interface CareAccessSecretRevealedEvent extends CareDomainEventBase {
  eventType: 'CareAccessSecretRevealed';
  secretId: CareAccessSecretId;
  engagementId: CareEngagementId;
  revealedBy: UserId;
  reason: string;
}

export interface CareHandoverExecutedEvent extends CareDomainEventBase {
  eventType: 'CareHandoverExecuted';
  handoverId: CareHandoverId;
  engagementId: CareEngagementId;
  petId: PetId;
  fromActorId: UserId;
  toActorId: UserId;
  resultingCustody: CareCustodyStatus;
}

export interface CareObservationRecordedEvent extends CareDomainEventBase {
  eventType: 'CareObservationRecorded';
  observationId: CareServiceObservationId;
  engagementId: CareEngagementId;
  petId: PetId;
  category: ObservationCategory;
  recordedBy: UserId;
}

export interface CareIncidentReportedEvent extends CareDomainEventBase {
  eventType: 'CareIncidentReported';
  incidentId: CareServiceIncidentId;
  engagementId: CareEngagementId;
  petId: PetId;
  category: CareIncidentCategory;
  severity: CareIncidentSeverity;
  reportedBy: UserId;
}

export interface CareIncidentEscalatedEvent extends CareDomainEventBase {
  eventType: 'CareIncidentEscalated';
  incidentId: CareServiceIncidentId;
  emergencyEscalated: boolean;
  lostPetAlertEmitted: boolean;
}

export interface GroomingSafetyStopTriggeredEvent extends CareDomainEventBase {
  eventType: 'GroomingSafetyStopTriggered';
  sessionId: GroomingSessionId;
  engagementId: CareEngagementId;
  petId: PetId;
  reason: string;
}

export interface SitterVisitCompletedEvent extends CareDomainEventBase {
  eventType: 'SitterVisitCompleted';
  visitId: SitterVisitId;
  engagementId: CareEngagementId;
  visitNumber: number;
}

export interface BoardingShiftHandoverExecutedEvent extends CareDomainEventBase {
  eventType: 'BoardingShiftHandoverExecuted';
  shiftHandoverId: CareShiftHandoverId;
  outgoingStaffId: UserId;
  incomingStaffId: UserId;
}

export interface CareExecutionCompletedEvent extends CareDomainEventBase {
  eventType: 'CareExecutionCompleted';
  engagementId: CareEngagementId;
  bookingId: BookingId;
  evidenceId: CareCompletionEvidenceId;
  petIds: PetId[];
  serviceType: CareServiceType;
  outcome: 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'ABORTED';
}

export type CareWorkspaceDomainEvent =
  | CareEngagementCreatedEvent
  | CareInstructionSnapshotCapturedEvent
  | CareInstructionAmendedEvent
  | CareAccessSecretRevealedEvent
  | CareHandoverExecutedEvent
  | CareObservationRecordedEvent
  | CareIncidentReportedEvent
  | CareIncidentEscalatedEvent
  | GroomingSafetyStopTriggeredEvent
  | SitterVisitCompletedEvent
  | BoardingShiftHandoverExecutedEvent
  | CareExecutionCompletedEvent;
