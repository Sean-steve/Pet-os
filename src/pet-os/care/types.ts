/**
 * Pet OS - Preventive Care & Scheduling Bounded Context Types
 * Implements Volume VIII: Preventive Care, Due Engine & Reminders
 */

import {
  UserId,
  HouseholdId,
  PetId,
  CareObligationId,
  CareOccurrenceId,
  CareCompletionRecordId,
  ReminderPolicyId
} from '../kernel/ids';
import { NotificationChannel } from '../notifications/types';

export type CareCategory =
  | 'VACCINATION'
  | 'PARASITE_PREVENTION'
  | 'DEWORMING'
  | 'VET_CHECKUP'
  | 'DENTAL_CARE'
  | 'MEDICATION_ADMINISTRATION'
  | 'GROOMING'
  | 'WEIGHT_CHECK'
  | 'GENERAL_CARE';

export type CareSourceType =
  | 'PROVIDER_RECORDED'
  | 'SYSTEM_RULE'
  | 'OWNER_CREATED'
  | 'IMPORTED'
  | 'MEDICATION_REGIMEN'
  | 'VACCINATION_RECORD'
  | 'CARE_PLAN';

export type ScheduleType =
  | 'ONE_TIME'
  | 'FIXED_INTERVAL'
  | 'CALENDAR_RECURRENCE'
  | 'PROVIDER_DEFINED'
  | 'RULE_DERIVED'
  | 'MANUAL';

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'EVERY_N_DAYS';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number; // e.g. 1 (every month), 14 (every 14 days), 1 (every 1 year)
  daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday ... 6 = Saturday
  dayOfMonth?: number;   // 1 to 31 (month-end safely clamped, e.g. 31st becomes 28/29th in Feb)
  monthOfYear?: number;  // 1 to 12 for yearly
  endDate?: string;      // ISO 8601 UTC
  maxOccurrences?: number;
}

export type CarePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type CareObligationStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export type CareOccurrenceStatus =
  | 'SCHEDULED'
  | 'UPCOMING'
  | 'DUE'
  | 'OVERDUE'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'CANCELLED';

export type CompletionPolicy = 'AUTO_ON_RECORD' | 'MANUAL_ACKNOWLEDGEMENT' | 'EVIDENCE_REQUIRED';

export interface DueWindow {
  dueWindowStart: string; // ISO 8601 UTC
  dueWindowEnd: string;   // ISO 8601 UTC (after this, state is OVERDUE)
}

/**
 * CareObligation Aggregate Root: The overarching care requirement or regimen definition.
 */
export interface CareObligation {
  careObligationId: CareObligationId;
  petId: PetId;
  householdId: HouseholdId;
  category: CareCategory;
  careType: string; // e.g. 'RABIES_VACCINE', 'SIMPARICA_TRIO', 'CLAVAMOX_DOSE', 'NAIL_TRIM'
  title: string;
  description?: string;
  sourceType: CareSourceType;
  sourceEntityType?: string; // e.g. 'VACCINATION', 'MEDICATION', 'ENCOUNTER'
  sourceEntityId?: string;   // e.g. vaccinationId or medicationId
  createdBy: UserId;
  assignedToUserId?: UserId; // Default household member assigned
  scheduleType: ScheduleType;
  startsAt: string;          // ISO 8601 UTC
  dueAt: string;             // Current/Next Clinical Due Date (ISO 8601 UTC)
  dueWindow?: DueWindow;
  recurrenceRule?: RecurrenceRule;
  timezone: string;          // Household / pet timezone (e.g. 'Africa/Nairobi')
  priority: CarePriority;
  status: CareObligationStatus;
  completionPolicy: CompletionPolicy;
  lastCompletedAt?: string;
  nextDueAt?: string;
  snoozedUntil?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  reminderPolicyId?: ReminderPolicyId;
  createdAt: string;
  updatedAt: string;
}

/**
 * CareOccurrence: An individual, actionable instance of a care obligation.
 */
export interface CareOccurrence {
  occurrenceId: CareOccurrenceId;
  careObligationId: CareObligationId;
  petId: PetId;
  householdId: HouseholdId;
  occurrenceNumber: number;
  title: string;
  category: CareCategory;
  scheduledFor: string;     // Target clinical date (ISO 8601 UTC)
  dueWindowStart: string;   // When it becomes DUE (ISO 8601 UTC)
  dueWindowEnd: string;     // When it becomes OVERDUE (ISO 8601 UTC)
  status: CareOccurrenceStatus;
  assignedToUserId?: UserId;
  
  // Step 36: Snooze fields (preserves clinical scheduledFor / due dates)
  snoozedUntil?: string;
  snoozedBy?: UserId;
  snoozeReason?: string;
  snoozeCount: number;

  // Completion fields
  completedAt?: string;
  completedBy?: UserId;
  completionSourceType?: 'MANUAL_USER' | 'VACCINATION_RECORD' | 'MEDICATION_ADMINISTRATION' | 'CLINICAL_ENCOUNTER' | 'PROCEDURE_RECORD';
  completionSourceId?: string;
  completionNotes?: string;
  evidenceReference?: string;

  // Skip fields
  skippedAt?: string;
  skippedBy?: UserId;
  skipReason?: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * CareCompletionRecord: Explicit audit record of completion with provenance.
 */
export interface CareCompletionRecord {
  completionId: CareCompletionRecordId;
  occurrenceId: CareOccurrenceId;
  careObligationId: CareObligationId;
  petId: PetId;
  completedAt: string; // ISO 8601 UTC
  completedBy: UserId;
  sourceType: string;
  sourceId?: string;
  notes?: string;
  evidenceReference?: string;
  createdAt: string;
}

/**
 * ReminderPolicy: Defines reminder lead-times, repeats, and escalation channels.
 */
export interface ReminderPolicy {
  policyId: ReminderPolicyId;
  careObligationId: CareObligationId;
  remindBeforeDays: number[]; // e.g. [7, 1] (7 days before, 1 day before)
  remindAtDue: boolean;       // Remind on due day
  overdueReminderDays: number[]; // e.g. [1, 3, 7] (1 day overdue, 3 days overdue, etc.)
  repeatFrequencyHours?: number;
  maxRepetitions: number;
  preferredChannels: NotificationChannel[];
  quietHoursRespect: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CareSummary {
  petId: PetId;
  totalObligations: number;
  dueTodayCount: number;
  upcomingCount: number;
  overdueCount: number;
  completedCount: number;
  nextUpcomingOccurrence?: CareOccurrence;
}

export interface CareFilterOptions {
  petId?: PetId;
  householdId?: HouseholdId;
  assignedToUserId?: UserId;
  category?: CareCategory;
  status?: CareOccurrenceStatus;
  fromDate?: string;
  toDate?: string;
}
