/**
 * Pet OS - Preventive Care Service
 * Implements Volume VIII: Care Obligations, Due-State Management,
 * Care Completion, Snooze, Timeline Projection, and Health Integration.
 */

import {
  UserId,
  HouseholdId,
  PetId,
  CareObligationId,
  CareOccurrenceId,
  CareCompletionRecordId,
  ReminderPolicyId,
  asCareObligationId,
  asCareOccurrenceId,
  asCareCompletionRecordId,
  asReminderPolicyId,
  generateUUIDv7
} from '../kernel/ids';
import { currentClockTime, currentClockUtcNow } from '../kernel/time';
import { InMemoryAuditStore } from '../kernel/audit';
import { PetStore } from '../pet-core/store';
import { IdentityStore } from '../identity/store';
import { AuthorizationService } from '../identity/authorization';
import { TimelineService } from '../timeline/service';
import { NotificationService } from '../notifications/service';
import { NotificationStore } from '../notifications/store';
import {
  CareCategory,
  CareSourceType,
  ScheduleType,
  CarePriority,
  CompletionPolicy,
  RecurrenceRule,
  DueWindow,
  CareObligation,
  CareOccurrence,
  CareCompletionRecord,
  ReminderPolicy,
  CareSummary,
  CareFilterOptions
} from './types';
import { CareStore } from './store';
import { RecurrenceEngine } from './recurrence';
import { DueStateEngine } from './due-state';
import {
  CareObligationCreatedEvent,
  CareOccurrenceCompletedEvent,
  CareOccurrenceSkippedEvent,
  CarePlanCancelledEvent,
  ReminderSnoozedEvent
} from './events';

export interface CreateCareObligationCommand {
  petId: PetId;
  householdId: HouseholdId;
  category: CareCategory;
  careType: string;
  title: string;
  description?: string;
  sourceType: CareSourceType;
  sourceEntityType?: string;
  sourceEntityId?: string;
  assignedToUserId?: UserId;
  scheduleType: ScheduleType;
  startsAt?: string;
  dueAt: string;
  dueWindow?: DueWindow;
  recurrenceRule?: RecurrenceRule;
  timezone?: string;
  priority?: CarePriority;
  completionPolicy?: CompletionPolicy;
  reminderPolicy?: Partial<ReminderPolicy>;
}

export interface CompleteCareOccurrenceCommand {
  completedAt?: string;
  completionSourceType?: 'MANUAL_USER' | 'VACCINATION_RECORD' | 'MEDICATION_ADMINISTRATION' | 'CLINICAL_ENCOUNTER' | 'PROCEDURE_RECORD';
  completionSourceId?: string;
  completionNotes?: string;
  evidenceReference?: string;
}

function recordAudit(action: string, actorId: string, resourceType: string, resourceId: string, metadata?: Record<string, unknown>) {
  InMemoryAuditStore.record({
    actorId,
    actorType: 'USER',
    action,
    resourceType,
    resourceId,
    classification: 'RESTRICTED',
    metadata
  });
}

export class CareService {
  /**
   * Helper: validates actor membership and permissions
   */
  private static checkAccess(
    actorId: UserId,
    householdId: HouseholdId,
    permission: any,
    targetUserId?: UserId
  ): void {
    const decision = AuthorizationService.checkHouseholdPermission(
      actorId,
      householdId,
      permission,
      targetUserId
    );

    if (!decision.allowed) {
      throw new Error(`Authorization Denied: ${decision.message} (Code: ${decision.reasonCode})`);
    }
  }

  /**
   * Creates a new Care Obligation with deterministic initial occurrence and reminder policy.
   * Step 31 & Step 62: Protects provider-recorded schedules from owner forging.
   */
  static createObligation(
    actorId: UserId,
    command: CreateCareObligationCommand
  ): { obligation: CareObligation; firstOccurrence: CareOccurrence } {
    // 1. Authorization & Cross-Household Isolation
    this.checkAccess(actorId, command.householdId, 'pet.care.create');

    // 2. Protect professional-derived schedules
    if (command.sourceType === 'PROVIDER_RECORDED' || command.sourceType === 'CARE_PLAN') {
      const decision = AuthorizationService.checkHouseholdPermission(
        actorId,
        command.householdId,
        'pet.care.manage_clinical_schedule'
      );
      if (!decision.allowed) {
        throw new Error(
          'Protected Clinical Schedule: Only authorized clinical roles or verified medical ingestion can set provider-derived care schedules.'
        );
      }
    }

    // 3. Verify Pet exists and belongs to household
    const pet = PetStore.findPetById(command.petId);
    if (!pet) {
      throw new Error(`Pet not found: ${command.petId}`);
    }
    if (pet.householdId !== command.householdId) {
      throw new Error('Cross-household isolation violation: Pet does not belong to specified household.');
    }

    const clockNow = currentClockTime();
    const obligationId = asCareObligationId(generateUUIDv7());
    const startsAt = command.startsAt || command.dueAt;
    const dueAt = command.dueAt;

    // Due window: default to 24h grace window if not provided
    const dueWindow: DueWindow = command.dueWindow || {
      dueWindowStart: dueAt,
      dueWindowEnd: new Date(new Date(dueAt).getTime() + 24 * 3600 * 1000).toISOString()
    };

    // 4. Create Reminder Policy
    const policyId = asReminderPolicyId(generateUUIDv7());
    const reminderPolicy: ReminderPolicy = {
      policyId,
      careObligationId: obligationId,
      remindBeforeDays: command.reminderPolicy?.remindBeforeDays ?? [7, 1],
      remindAtDue: command.reminderPolicy?.remindAtDue ?? true,
      overdueReminderDays: command.reminderPolicy?.overdueReminderDays ?? [1, 3, 7],
      repeatFrequencyHours: command.reminderPolicy?.repeatFrequencyHours,
      maxRepetitions: command.reminderPolicy?.maxRepetitions ?? 5,
      preferredChannels: command.reminderPolicy?.preferredChannels ?? ['IN_APP', 'EMAIL'],
      quietHoursRespect: command.reminderPolicy?.quietHoursRespect ?? true,
      createdAt: clockNow.toISOString(),
      updatedAt: clockNow.toISOString()
    };
    CareStore.saveReminderPolicy(reminderPolicy);

    // 5. Create Care Obligation Aggregate
    const obligation: CareObligation = {
      careObligationId: obligationId,
      petId: command.petId,
      householdId: command.householdId,
      category: command.category,
      careType: command.careType,
      title: command.title,
      description: command.description,
      sourceType: command.sourceType,
      sourceEntityType: command.sourceEntityType,
      sourceEntityId: command.sourceEntityId,
      createdBy: actorId,
      assignedToUserId: command.assignedToUserId,
      scheduleType: command.scheduleType,
      startsAt,
      dueAt,
      dueWindow,
      recurrenceRule: command.recurrenceRule,
      timezone: command.timezone || 'Africa/Nairobi',
      priority: command.priority || 'MEDIUM',
      status: 'ACTIVE',
      completionPolicy: command.completionPolicy || 'MANUAL_ACKNOWLEDGEMENT',
      reminderPolicyId: policyId,
      createdAt: clockNow.toISOString(),
      updatedAt: clockNow.toISOString()
    };
    CareStore.saveObligation(obligation);

    // 6. Generate initial Care Occurrence
    const firstOccurrence: CareOccurrence = {
      occurrenceId: asCareOccurrenceId(generateUUIDv7()),
      careObligationId: obligationId,
      petId: command.petId,
      householdId: command.householdId,
      occurrenceNumber: 1,
      title: command.title,
      category: command.category,
      scheduledFor: dueAt,
      dueWindowStart: dueWindow.dueWindowStart,
      dueWindowEnd: dueWindow.dueWindowEnd,
      status: DueStateEngine.evaluateStatus(
        {
          occurrenceId: asCareOccurrenceId(''),
          careObligationId: obligationId,
          petId: command.petId,
          householdId: command.householdId,
          occurrenceNumber: 1,
          title: command.title,
          category: command.category,
          scheduledFor: dueAt,
          dueWindowStart: dueWindow.dueWindowStart,
          dueWindowEnd: dueWindow.dueWindowEnd,
          status: 'SCHEDULED',
          snoozeCount: 0,
          createdAt: clockNow.toISOString(),
          updatedAt: clockNow.toISOString()
        },
        obligation,
        clockNow
      ),
      assignedToUserId: command.assignedToUserId,
      snoozeCount: 0,
      createdAt: clockNow.toISOString(),
      updatedAt: clockNow.toISOString()
    };
    CareStore.saveOccurrence(firstOccurrence);

    // 7. Audit & Domain Event
    recordAudit('CARE_OBLIGATION_CREATED', actorId, 'CareObligation', obligationId, {
      petId: command.petId,
      category: command.category,
      title: command.title,
      scheduleType: command.scheduleType,
      sourceType: command.sourceType
    });

    const event: CareObligationCreatedEvent = {
      eventType: 'CareObligationCreated',
      careObligationId: obligationId,
      petId: command.petId,
      householdId: command.householdId,
      category: command.category,
      title: command.title,
      sourceType: command.sourceType,
      createdBy: actorId,
      dueAt,
      timestamp: clockNow.toISOString()
    };

    // If caregiver was assigned at creation, notify them
    if (command.assignedToUserId) {
      NotificationService.schedule({
        recipientUserId: command.assignedToUserId,
        petId: command.petId,
        careObligationId: obligationId,
        occurrenceId: firstOccurrence.occurrenceId,
        notificationType: 'CARE_ASSIGNED',
        sourceType: 'CARE_OBLIGATION',
        sourceId: obligationId,
        title: `Care Task Assigned: ${command.title}`,
        body: `You have been assigned to care for ${pet.name} (${command.title}) due on ${new Date(dueAt).toLocaleDateString()}.`,
        priority: 'NORMAL'
      }).catch(err => console.error('Notification dispatch error:', err));
    }

    return { obligation, firstOccurrence };
  }

  /**
   * Assigns a caregiver to an occurrence (or obligation).
   * Verifies least-privilege and household membership.
   */
  static assignCaregiver(
    actorId: UserId,
    occurrenceId: CareOccurrenceId,
    assignedToUserId: UserId
  ): CareOccurrence {
    const occurrence = CareStore.getOccurrence(occurrenceId);
    if (!occurrence) {
      throw new Error(`Occurrence not found: ${occurrenceId}`);
    }

    this.checkAccess(actorId, occurrence.householdId, 'pet.care.assign');

    // Verify assigned user belongs to this household
    const assignedMembership = IdentityStore.findMembership(occurrence.householdId, assignedToUserId);
    if (!assignedMembership || assignedMembership.status !== 'ACTIVE') {
      throw new Error('Assignee must be an active member of the pet household.');
    }

    occurrence.assignedToUserId = assignedToUserId;
    occurrence.updatedAt = currentClockUtcNow();
    CareStore.saveOccurrence(occurrence);

    // Update parent obligation default assignee as well
    const obligation = CareStore.getObligation(occurrence.careObligationId);
    if (obligation) {
      obligation.assignedToUserId = assignedToUserId;
      obligation.updatedAt = currentClockUtcNow();
      CareStore.saveObligation(obligation);
    }

    const pet = PetStore.findPetById(occurrence.petId);

    // Dispatch assignment notification to the assigned member
    NotificationService.schedule({
      recipientUserId: assignedToUserId,
      petId: occurrence.petId,
      careObligationId: occurrence.careObligationId,
      occurrenceId: occurrence.occurrenceId,
      notificationType: 'CARE_ASSIGNED',
      sourceType: 'CARE_OCCURRENCE',
      sourceId: occurrence.occurrenceId,
      title: `Care Task Assigned: ${occurrence.title}`,
      body: `You have been assigned to complete ${occurrence.title} for ${pet?.name || 'your pet'}.`,
      priority: 'NORMAL'
    }).catch(err => console.error('Notification dispatch error:', err));

    recordAudit('CARE_ASSIGNED', actorId, 'CareOccurrence', occurrenceId, { assignedToUserId });

    return occurrence;
  }

  /**
   * Snoozes a reminder for a care occurrence.
   * CRITICAL INVARIANT (Step 36):
   * Snooze modifies the notification timing, NOT the clinical due date!
   * The care occurrence remains clinically DUE or OVERDUE.
   */
  static snoozeReminder(
    actorId: UserId,
    occurrenceId: CareOccurrenceId,
    snoozedUntil: string,
    reason?: string
  ): CareOccurrence {
    const occurrence = CareStore.getOccurrence(occurrenceId);
    if (!occurrence) {
      throw new Error(`Occurrence not found: ${occurrenceId}`);
    }

    this.checkAccess(actorId, occurrence.householdId, 'pet.care.complete');

    const clockNow = currentClockTime();
    if (new Date(snoozedUntil).getTime() <= clockNow.getTime()) {
      throw new Error('Snooze time must be in the future.');
    }

    occurrence.snoozedUntil = snoozedUntil;
    occurrence.snoozedBy = actorId;
    occurrence.snoozeReason = reason;
    occurrence.snoozeCount = (occurrence.snoozeCount || 0) + 1;
    occurrence.updatedAt = clockNow.toISOString();

    CareStore.saveOccurrence(occurrence);

    recordAudit('REMINDER_SNOOZED', actorId, 'CareOccurrence', occurrenceId, {
      snoozedUntil,
      snoozeCount: occurrence.snoozeCount,
      reason
    });

    return occurrence;
  }

  /**
   * Skips an occurrence with reason and audit.
   * If the care obligation is recurring, generates the next occurrence.
   */
  static skipOccurrence(
    actorId: UserId,
    occurrenceId: CareOccurrenceId,
    reason: string
  ): { occurrence: CareOccurrence; nextOccurrence?: CareOccurrence } {
    const occurrence = CareStore.getOccurrence(occurrenceId);
    if (!occurrence) {
      throw new Error(`Occurrence not found: ${occurrenceId}`);
    }

    this.checkAccess(actorId, occurrence.householdId, 'pet.care.skip');

    const clockNow = currentClockTime();
    occurrence.status = 'SKIPPED';
    occurrence.skippedAt = clockNow.toISOString();
    occurrence.skippedBy = actorId;
    occurrence.skipReason = reason;
    occurrence.updatedAt = clockNow.toISOString();
    CareStore.saveOccurrence(occurrence);

    let nextOccurrence: CareOccurrence | undefined;

    const obligation = CareStore.getObligation(occurrence.careObligationId);
    if (obligation && obligation.recurrenceRule && obligation.status === 'ACTIVE') {
      nextOccurrence = RecurrenceEngine.generateNextOccurrence(
        obligation,
        occurrence.occurrenceNumber,
        new Date(occurrence.scheduledFor)
      );
      CareStore.saveOccurrence(nextOccurrence);
      obligation.nextDueAt = nextOccurrence.scheduledFor;
      obligation.updatedAt = clockNow.toISOString();
      CareStore.saveObligation(obligation);
    }

    recordAudit('CARE_OCCURRENCE_SKIPPED', actorId, 'CareOccurrence', occurrenceId, { reason });

    return { occurrence, nextOccurrence };
  }

  /**
   * Completes a care occurrence, records completion provenance,
   * projects to Timeline, and generates next occurrence if recurring.
   */
  static completeOccurrence(
    actorId: UserId,
    occurrenceId: CareOccurrenceId,
    command: CompleteCareOccurrenceCommand = {}
  ): {
    occurrence: CareOccurrence;
    completionRecord: CareCompletionRecord;
    nextOccurrence?: CareOccurrence;
  } {
    const occurrence = CareStore.getOccurrence(occurrenceId);
    if (!occurrence) {
      throw new Error(`Occurrence not found: ${occurrenceId}`);
    }

    // Authorization: pet.care.complete (available to CAREGIVER and TEMPORARY_CAREGIVER)
    this.checkAccess(actorId, occurrence.householdId, 'pet.care.complete');

    const clockNow = currentClockTime();
    const completedAt = command.completedAt || clockNow.toISOString();

    // 1. Update occurrence status
    occurrence.status = 'COMPLETED';
    occurrence.completedAt = completedAt;
    occurrence.completedBy = actorId;
    occurrence.completionSourceType = command.completionSourceType || 'MANUAL_USER';
    occurrence.completionSourceId = command.completionSourceId;
    occurrence.completionNotes = command.completionNotes;
    occurrence.evidenceReference = command.evidenceReference;
    occurrence.updatedAt = clockNow.toISOString();
    CareStore.saveOccurrence(occurrence);

    // 2. Create CareCompletionRecord
    const completionId = asCareCompletionRecordId(generateUUIDv7());
    const completionRecord: CareCompletionRecord = {
      completionId,
      occurrenceId,
      careObligationId: occurrence.careObligationId,
      petId: occurrence.petId,
      completedAt,
      completedBy: actorId,
      sourceType: occurrence.completionSourceType,
      sourceId: occurrence.completionSourceId,
      notes: command.completionNotes,
      evidenceReference: command.evidenceReference,
      createdAt: clockNow.toISOString()
    };
    CareStore.saveCompletion(completionRecord);

    // 3. Update obligation & generate next occurrence if recurring
    const obligation = CareStore.getObligation(occurrence.careObligationId);
    let nextOccurrence: CareOccurrence | undefined;

    if (obligation) {
      obligation.lastCompletedAt = completedAt;

      if (obligation.recurrenceRule && obligation.status === 'ACTIVE') {
        nextOccurrence = RecurrenceEngine.generateNextOccurrence(
          obligation,
          occurrence.occurrenceNumber,
          new Date(occurrence.scheduledFor)
        );
        CareStore.saveOccurrence(nextOccurrence);
        obligation.nextDueAt = nextOccurrence.scheduledFor;
      } else if (obligation.scheduleType === 'ONE_TIME') {
        obligation.status = 'COMPLETED';
      }

      obligation.updatedAt = clockNow.toISOString();
      CareStore.saveObligation(obligation);
    }

    // 4. Project to Pet Timeline under PREVENTIVE_CARE domain
    try {
      const pet = PetStore.findPetById(occurrence.petId);
      TimelineService.recordEvent({
        petId: occurrence.petId,
        householdId: occurrence.householdId,
        eventType: 'CARE_OCCURRENCE_COMPLETED',
        eventCategory: 'PREVENTIVE_CARE',
        sourceDomain: 'PREVENTIVE_CARE',
        sourceEntityType: 'CareOccurrence',
        sourceEntityId: occurrence.occurrenceId,
        sourceActorType: 'USER',
        sourceActorId: actorId,
        provenanceType: 'OWNER_ENTERED',
        title: `Care Completed: ${occurrence.title}`,
        summary: command.completionNotes || `Preventive care (${occurrence.category}) recorded as complete for ${pet?.name || 'pet'}.`,
        occurredAt: completedAt,
        structuredPayload: {
          category: occurrence.category,
          occurrenceNumber: occurrence.occurrenceNumber,
          completionSourceType: occurrence.completionSourceType,
          evidenceReference: command.evidenceReference
        }
      });
    } catch (err) {
      console.error('Timeline projection error:', err);
    }

    // 5. Audit log
    recordAudit('CARE_OCCURRENCE_COMPLETED', actorId, 'CareOccurrence', occurrenceId, {
      category: occurrence.category,
      completionId,
      completedAt,
      nextDueAt: nextOccurrence?.scheduledFor
    });

    return { occurrence, completionRecord, nextOccurrence };
  }

  /**
   * Cancels a care obligation and all remaining future scheduled occurrences.
   * Elevated permission required if cancelling a provider-recorded clinical obligation.
   */
  static cancelObligation(
    actorId: UserId,
    obligationId: CareObligationId,
    reason: string
  ): CareObligation {
    const obligation = CareStore.getObligation(obligationId);
    if (!obligation) {
      throw new Error(`Obligation not found: ${obligationId}`);
    }

    this.checkAccess(actorId, obligation.householdId, 'pet.care.cancel');

    // Step 62: Professional-derived schedule protection
    if (obligation.sourceType === 'PROVIDER_RECORDED' || obligation.sourceType === 'CARE_PLAN') {
      const decision = AuthorizationService.checkHouseholdPermission(
        actorId,
        obligation.householdId,
        'pet.care.manage_clinical_schedule'
      );
      if (!decision.allowed) {
        throw new Error(
          'Protected Clinical Schedule: Cancelling a provider-recorded clinical obligation requires elevated clinical authority.'
        );
      }
    }

    const clockNow = currentClockTime();
    obligation.status = 'CANCELLED';
    obligation.cancelledAt = clockNow.toISOString();
    obligation.cancellationReason = reason;
    obligation.updatedAt = clockNow.toISOString();
    CareStore.saveObligation(obligation);

    // Cancel any scheduled/upcoming future occurrences
    const occurrences = CareStore.getOccurrencesForObligation(obligationId);
    for (const occ of occurrences) {
      if (occ.status === 'SCHEDULED' || occ.status === 'UPCOMING' || occ.status === 'DUE') {
        occ.status = 'CANCELLED';
        occ.updatedAt = clockNow.toISOString();
        CareStore.saveOccurrence(occ);
      }
    }

    recordAudit('CARE_PLAN_CANCELLED', actorId, 'CareObligation', obligationId, { reason });

    return obligation;
  }

  // --- Veterinary Health Domain Integration ---

  /**
   * Ingests a verified vaccination from Sprint 5.
   * If nextDueAt is specified: creates/updates a clinical care obligation.
   * If a matching due occurrence exists: completes it automatically!
   */
  static handleVaccinationRecorded(event: {
    petId: PetId;
    householdId: HouseholdId;
    vaccinationId: string;
    vaccineName: string;
    administeredDate: string;
    nextDueAt?: string;
    providerId?: string;
    verifiedBy?: UserId;
  }): void {
    const clockNow = currentClockTime();

    // 1. Auto-complete any active pending occurrence for this vaccine
    const activeOccurrences = CareStore.getOccurrencesForPet(event.petId);
    const matchingOcc = activeOccurrences.find(
      occ =>
        occ.category === 'VACCINATION' &&
        occ.title.toLowerCase().includes(event.vaccineName.toLowerCase().slice(0, 5)) &&
        (occ.status === 'DUE' || occ.status === 'OVERDUE' || occ.status === 'UPCOMING')
    );

    if (matchingOcc) {
      matchingOcc.status = 'COMPLETED';
      matchingOcc.completedAt = event.administeredDate;
      matchingOcc.completedBy = (event.verifiedBy || 'system') as UserId;
      matchingOcc.completionSourceType = 'VACCINATION_RECORD';
      matchingOcc.completionSourceId = event.vaccinationId;
      matchingOcc.completionNotes = `Completed via administered vaccine record (${event.vaccineName}).`;
      matchingOcc.updatedAt = clockNow.toISOString();
      CareStore.saveOccurrence(matchingOcc);

      CareStore.saveCompletion({
        completionId: asCareCompletionRecordId(generateUUIDv7()),
        occurrenceId: matchingOcc.occurrenceId,
        careObligationId: matchingOcc.careObligationId,
        petId: event.petId,
        completedAt: event.administeredDate,
        completedBy: (event.verifiedBy || 'system') as UserId,
        sourceType: 'VACCINATION_RECORD',
        sourceId: event.vaccinationId,
        notes: `Clinical verification from vaccination ID: ${event.vaccinationId}`,
        createdAt: clockNow.toISOString()
      });
    }

    // 2. If professional nextDueAt is present, establish next clinical obligation
    if (event.nextDueAt) {
      const existingObligations = CareStore.getObligationsForPet(event.petId);
      const existingVaccineObligation = existingObligations.find(
        o =>
          o.category === 'VACCINATION' &&
          o.title.toLowerCase().includes(event.vaccineName.toLowerCase().slice(0, 5)) &&
          o.status === 'ACTIVE'
      );

      if (existingVaccineObligation) {
        existingVaccineObligation.dueAt = event.nextDueAt;
        existingVaccineObligation.dueWindow = {
          dueWindowStart: event.nextDueAt,
          dueWindowEnd: new Date(new Date(event.nextDueAt).getTime() + 30 * 24 * 3600 * 1000).toISOString()
        };
        existingVaccineObligation.sourceType = 'PROVIDER_RECORDED';
        existingVaccineObligation.sourceEntityId = event.vaccinationId;
        existingVaccineObligation.updatedAt = clockNow.toISOString();
        CareStore.saveObligation(existingVaccineObligation);

        // Add next occurrence
        const nextOcc: CareOccurrence = {
          occurrenceId: asCareOccurrenceId(generateUUIDv7()),
          careObligationId: existingVaccineObligation.careObligationId,
          petId: event.petId,
          householdId: event.householdId,
          occurrenceNumber: (matchingOcc?.occurrenceNumber || 1) + 1,
          title: `${event.vaccineName} Booster`,
          category: 'VACCINATION',
          scheduledFor: event.nextDueAt,
          dueWindowStart: event.nextDueAt,
          dueWindowEnd: new Date(new Date(event.nextDueAt).getTime() + 30 * 24 * 3600 * 1000).toISOString(),
          status: 'SCHEDULED',
          snoozeCount: 0,
          createdAt: clockNow.toISOString(),
          updatedAt: clockNow.toISOString()
        };
        CareStore.saveOccurrence(nextOcc);
      } else {
        // Create new obligation
        const obId = asCareObligationId(generateUUIDv7());
        const ob: CareObligation = {
          careObligationId: obId,
          petId: event.petId,
          householdId: event.householdId,
          category: 'VACCINATION',
          careType: event.vaccineName.toUpperCase().replace(/\s+/g, '_'),
          title: `${event.vaccineName} Booster`,
          sourceType: 'PROVIDER_RECORDED',
          sourceEntityType: 'VACCINATION',
          sourceEntityId: event.vaccinationId,
          createdBy: (event.verifiedBy || 'system') as UserId,
          scheduleType: 'PROVIDER_DEFINED',
          startsAt: event.administeredDate,
          dueAt: event.nextDueAt,
          dueWindow: {
            dueWindowStart: event.nextDueAt,
            dueWindowEnd: new Date(new Date(event.nextDueAt).getTime() + 30 * 24 * 3600 * 1000).toISOString()
          },
          timezone: 'Africa/Nairobi',
          priority: 'HIGH',
          status: 'ACTIVE',
          completionPolicy: 'AUTO_ON_RECORD',
          createdAt: clockNow.toISOString(),
          updatedAt: clockNow.toISOString()
        };
        CareStore.saveObligation(ob);

        const occ: CareOccurrence = {
          occurrenceId: asCareOccurrenceId(generateUUIDv7()),
          careObligationId: obId,
          petId: event.petId,
          householdId: event.householdId,
          occurrenceNumber: 1,
          title: `${event.vaccineName} Booster`,
          category: 'VACCINATION',
          scheduledFor: event.nextDueAt,
          dueWindowStart: event.nextDueAt,
          dueWindowEnd: new Date(new Date(event.nextDueAt).getTime() + 30 * 24 * 3600 * 1000).toISOString(),
          status: 'SCHEDULED',
          snoozeCount: 0,
          createdAt: clockNow.toISOString(),
          updatedAt: clockNow.toISOString()
        };
        CareStore.saveOccurrence(occ);
      }
    }
  }

  /**
   * Step 54: Deceased Pet Handling
   * Automatically cancels/suppresses all future scheduled routine care occurrences and reminders.
   * Retains all historical completed care records and audit entries intact.
   */
  static handlePetMarkedDeceased(petId: PetId): void {
    const clockNow = currentClockTime();
    const obligations = CareStore.getObligationsForPet(petId);

    for (const ob of obligations) {
      if (ob.status === 'ACTIVE') {
        ob.status = 'CANCELLED';
        ob.cancelledAt = clockNow.toISOString();
        ob.cancellationReason = 'Pet marked deceased. Routine care obligations suspended.';
        ob.updatedAt = clockNow.toISOString();
        CareStore.saveObligation(ob);
      }
    }

    const occurrences = CareStore.getOccurrencesForPet(petId);
    for (const occ of occurrences) {
      if (occ.status === 'SCHEDULED' || occ.status === 'UPCOMING' || occ.status === 'DUE') {
        occ.status = 'CANCELLED';
        occ.updatedAt = clockNow.toISOString();
        CareStore.saveOccurrence(occ);
      }
    }

    recordAudit('DECEASED_PET_CARE_SUPPRESSED', 'system', 'Pet', petId, { petId });
  }

  // --- Summary & Metrics ---

  static getCareSummary(petId: PetId, currentTime = currentClockTime()): CareSummary {
    const occurrences = CareStore.getOccurrencesForPet(petId);
    const obligations = CareStore.getObligationsForPet(petId);

    let dueTodayCount = 0;
    let upcomingCount = 0;
    let overdueCount = 0;
    let completedCount = 0;

    let nextUpcomingOccurrence: CareOccurrence | undefined;

    for (const occ of occurrences) {
      if (occ.status === 'COMPLETED') {
        completedCount++;
        continue;
      }

      const parentObligation = CareStore.getObligation(occ.careObligationId);
      if (!parentObligation || parentObligation.status !== 'ACTIVE') continue;

      const evalStatus = DueStateEngine.evaluateStatus(occ, parentObligation, currentTime);

      if (evalStatus === 'DUE') {
        dueTodayCount++;
      } else if (evalStatus === 'UPCOMING') {
        upcomingCount++;
        if (!nextUpcomingOccurrence) nextUpcomingOccurrence = occ;
      } else if (evalStatus === 'OVERDUE') {
        overdueCount++;
      }
    }

    return {
      petId,
      totalObligations: obligations.filter(o => o.status === 'ACTIVE').length,
      dueTodayCount,
      upcomingCount,
      overdueCount,
      completedCount,
      nextUpcomingOccurrence
    };
  }
}
