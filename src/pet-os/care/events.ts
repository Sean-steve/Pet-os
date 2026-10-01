/**
 * Pet OS - Preventive Care Domain Events
 * Implements canonical event contracts for asynchronous projection,
 * timeline integration, and audit logging.
 */

import {
  UserId,
  HouseholdId,
  PetId,
  CareObligationId,
  CareOccurrenceId,
  CareCompletionRecordId
} from '../kernel/ids';
import { CareCategory, CareOccurrenceStatus } from './types';

export interface CareObligationCreatedEvent {
  eventType: 'CareObligationCreated';
  careObligationId: CareObligationId;
  petId: PetId;
  householdId: HouseholdId;
  category: CareCategory;
  title: string;
  sourceType: string;
  createdBy: UserId;
  dueAt: string;
  timestamp: string;
}

export interface CareOccurrenceCompletedEvent {
  eventType: 'CareOccurrenceCompleted';
  occurrenceId: CareOccurrenceId;
  careObligationId: CareObligationId;
  completionId: CareCompletionRecordId;
  petId: PetId;
  householdId: HouseholdId;
  title: string;
  category: CareCategory;
  completedAt: string;
  completedBy: UserId;
  completionSourceType: string;
  completionNotes?: string;
  nextOccurrenceId?: CareOccurrenceId;
  nextDueAt?: string;
  timestamp: string;
}

export interface CareOccurrenceSkippedEvent {
  eventType: 'CareOccurrenceSkipped';
  occurrenceId: CareOccurrenceId;
  careObligationId: CareObligationId;
  petId: PetId;
  householdId: HouseholdId;
  skippedAt: string;
  skippedBy: UserId;
  skipReason: string;
  timestamp: string;
}

export interface CarePlanCancelledEvent {
  eventType: 'CarePlanCancelled';
  careObligationId: CareObligationId;
  petId: PetId;
  householdId: HouseholdId;
  cancelledAt: string;
  cancelledBy: UserId;
  reason: string;
  timestamp: string;
}

export interface ReminderSnoozedEvent {
  eventType: 'ReminderSnoozed';
  occurrenceId: CareOccurrenceId;
  careObligationId: CareObligationId;
  petId: PetId;
  snoozedBy: UserId;
  snoozedUntil: string;
  snoozeReason?: string;
  snoozeCount: number;
  timestamp: string;
}

export type CareDomainEvent =
  | CareObligationCreatedEvent
  | CareOccurrenceCompletedEvent
  | CareOccurrenceSkippedEvent
  | CarePlanCancelledEvent
  | ReminderSnoozedEvent;
