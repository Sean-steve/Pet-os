/**
 * Pet OS - Preventive Care & Scheduling Canonical Seed Data
 * Implements Volume VIII & Volume XXVI: Realistic care obligations,
 * occurrences across DUE, OVERDUE, UPCOMING states, reminder policies,
 * assigned household members, and pre-populated notification inbox.
 */

import {
  UserId,
  PetId,
  HouseholdId,
  asCareObligationId,
  asCareOccurrenceId,
  asReminderPolicyId,
  asNotificationId,
  generateUUIDv7
} from '../kernel/ids';
import { currentClockTime } from '../kernel/time';
import { CareStore } from './store';
import { NotificationStore } from '../notifications/store';
import { CareObligation, CareOccurrence, ReminderPolicy } from './types';
import { NotificationDeliveryRecord } from '../notifications/types';
import { PetStore } from '../pet-core/store';
import { IdentityStore } from '../identity/store';

export async function seedSprint6CareData(ownerUserId: UserId, petId: PetId): Promise<void> {
  // If already seeded for this pet, skip
  if (CareStore.getObligationsForPet(petId).length > 0) {
    return;
  }

  const pet = PetStore.findPetById(petId);
  if (!pet) return;

  const householdId = pet.householdId;
  const clockNow = currentClockTime();
  const nowMs = clockNow.getTime();

  // Helper date generators relative to current clock time
  const daysAgo = (days: number) => new Date(nowMs - days * 86400 * 1000).toISOString();
  const daysAhead = (days: number) => new Date(nowMs + days * 86400 * 1000).toISOString();
  const today = clockNow.toISOString();

  // Find other household members for realistic task delegation
  const members = IdentityStore.listMembersForHousehold(householdId);
  const adminMember = members.find(m => m.role === 'HOUSEHOLD_ADMIN')?.userId || ownerUserId;
  const caregiverMember = members.find(m => m.role === 'CAREGIVER')?.userId || ownerUserId;

  // --------------------------------------------------------------------------
  // 1. OVERDUE ITEM: Bordetella (Kennel Cough) Vaccination Booster
  // Provider-recorded, due 14 days ago (mirrors expired vaccine from Sprint 5)
  // --------------------------------------------------------------------------
  const bordetellaObId = asCareObligationId(generateUUIDv7());
  const bordetellaPolicyId = asReminderPolicyId(generateUUIDv7());
  const bordetellaDue = daysAgo(14);

  const bordetellaPolicy: ReminderPolicy = {
    policyId: bordetellaPolicyId,
    careObligationId: bordetellaObId,
    remindBeforeDays: [7, 1],
    remindAtDue: true,
    overdueReminderDays: [1, 3, 7, 14],
    maxRepetitions: 5,
    preferredChannels: ['IN_APP', 'EMAIL', 'PUSH'],
    quietHoursRespect: true,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30)
  };
  CareStore.saveReminderPolicy(bordetellaPolicy);

  const bordetellaObligation: CareObligation = {
    careObligationId: bordetellaObId,
    petId,
    householdId,
    category: 'VACCINATION',
    careType: 'CANINE_BORDETELLA',
    title: 'Bordetella (Kennel Cough) Booster',
    description: 'Annual intranasal immunization required for daycare and boarding at Karen Kennels.',
    sourceType: 'PROVIDER_RECORDED',
    sourceEntityType: 'VACCINATION',
    createdBy: ownerUserId,
    assignedToUserId: ownerUserId,
    scheduleType: 'PROVIDER_DEFINED',
    startsAt: daysAgo(365),
    dueAt: bordetellaDue,
    dueWindow: {
      dueWindowStart: bordetellaDue,
      dueWindowEnd: daysAgo(13) // Expired 13 days ago
    },
    timezone: 'Africa/Nairobi',
    priority: 'HIGH',
    status: 'ACTIVE',
    completionPolicy: 'AUTO_ON_RECORD',
    reminderPolicyId: bordetellaPolicyId,
    createdAt: daysAgo(30),
    updatedAt: today
  };
  CareStore.saveObligation(bordetellaObligation);

  const bordetellaOcc: CareOccurrence = {
    occurrenceId: asCareOccurrenceId(generateUUIDv7()),
    careObligationId: bordetellaObId,
    petId,
    householdId,
    occurrenceNumber: 1,
    title: 'Bordetella (Kennel Cough) Booster',
    category: 'VACCINATION',
    scheduledFor: bordetellaDue,
    dueWindowStart: bordetellaDue,
    dueWindowEnd: daysAgo(13),
    status: 'OVERDUE',
    assignedToUserId: ownerUserId,
    snoozeCount: 0,
    createdAt: daysAgo(30),
    updatedAt: today
  };
  CareStore.saveOccurrence(bordetellaOcc);

  // --------------------------------------------------------------------------
  // 2. DUE TODAY: Monthly Simparica Trio (Heartworm, Tick & Flea Chewable)
  // Recurring monthly, assigned to Admin/Sarah
  // --------------------------------------------------------------------------
  const simparicaObId = asCareObligationId(generateUUIDv7());
  const simparicaPolicyId = asReminderPolicyId(generateUUIDv7());

  const simparicaPolicy: ReminderPolicy = {
    policyId: simparicaPolicyId,
    careObligationId: simparicaObId,
    remindBeforeDays: [2, 0],
    remindAtDue: true,
    overdueReminderDays: [1, 3],
    maxRepetitions: 3,
    preferredChannels: ['IN_APP', 'PUSH'],
    quietHoursRespect: true,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60)
  };
  CareStore.saveReminderPolicy(simparicaPolicy);

  const simparicaObligation: CareObligation = {
    careObligationId: simparicaObId,
    petId,
    householdId,
    category: 'PARASITE_PREVENTION',
    careType: 'SIMPARICA_TRIO',
    title: 'Simparica Trio Chewable (44-88 lbs)',
    description: 'Triple protection monthly chewable against heartworm, ticks, fleas, roundworms, and hookworms.',
    sourceType: 'CARE_PLAN',
    createdBy: ownerUserId,
    assignedToUserId: adminMember,
    scheduleType: 'CALENDAR_RECURRENCE',
    startsAt: daysAgo(60),
    dueAt: today,
    dueWindow: {
      dueWindowStart: daysAgo(0.5),
      dueWindowEnd: daysAhead(1)
    },
    recurrenceRule: {
      frequency: 'MONTHLY',
      interval: 1,
      dayOfMonth: clockNow.getUTCDate()
    },
    timezone: 'Africa/Nairobi',
    priority: 'HIGH',
    status: 'ACTIVE',
    completionPolicy: 'MANUAL_ACKNOWLEDGEMENT',
    lastCompletedAt: daysAgo(30),
    nextDueAt: today,
    reminderPolicyId: simparicaPolicyId,
    createdAt: daysAgo(60),
    updatedAt: today
  };
  CareStore.saveObligation(simparicaObligation);

  const simparicaOcc: CareOccurrence = {
    occurrenceId: asCareOccurrenceId(generateUUIDv7()),
    careObligationId: simparicaObId,
    petId,
    householdId,
    occurrenceNumber: 3,
    title: 'Simparica Trio Chewable (Month 3)',
    category: 'PARASITE_PREVENTION',
    scheduledFor: today,
    dueWindowStart: daysAgo(0.5),
    dueWindowEnd: daysAhead(1),
    status: 'DUE',
    assignedToUserId: adminMember,
    snoozeCount: 0,
    createdAt: daysAgo(30),
    updatedAt: today
  };
  CareStore.saveOccurrence(simparicaOcc);

  // --------------------------------------------------------------------------
  // 3. UPCOMING (Next 3 Days): Bi-weekly Medicated Chlorhexidine Bath & Nail Trim
  // Owner-created recurring task, assigned to Caregiver (Alex)
  // --------------------------------------------------------------------------
  const groomingObId = asCareObligationId(generateUUIDv7());
  const groomingPolicyId = asReminderPolicyId(generateUUIDv7());
  const groomingDue = daysAhead(3);

  const groomingPolicy: ReminderPolicy = {
    policyId: groomingPolicyId,
    careObligationId: groomingObId,
    remindBeforeDays: [1],
    remindAtDue: true,
    overdueReminderDays: [1],
    maxRepetitions: 2,
    preferredChannels: ['IN_APP'],
    quietHoursRespect: true,
    createdAt: daysAgo(28),
    updatedAt: daysAgo(28)
  };
  CareStore.saveReminderPolicy(groomingPolicy);

  const groomingObligation: CareObligation = {
    careObligationId: groomingObId,
    petId,
    householdId,
    category: 'GROOMING',
    careType: 'MEDICATED_BATH_AND_NAILS',
    title: 'Medicated Chlorhexidine Bath & Nail Trim',
    description: '10-minute contact time for medicated shampoo to control atopic dermatitis flare-ups. Check paw pads.',
    sourceType: 'OWNER_CREATED',
    createdBy: ownerUserId,
    assignedToUserId: caregiverMember,
    scheduleType: 'FIXED_INTERVAL',
    startsAt: daysAgo(14),
    dueAt: groomingDue,
    dueWindow: {
      dueWindowStart: groomingDue,
      dueWindowEnd: daysAhead(4)
    },
    recurrenceRule: {
      frequency: 'EVERY_N_DAYS',
      interval: 14
    },
    timezone: 'Africa/Nairobi',
    priority: 'MEDIUM',
    status: 'ACTIVE',
    completionPolicy: 'MANUAL_ACKNOWLEDGEMENT',
    lastCompletedAt: daysAgo(11),
    nextDueAt: groomingDue,
    reminderPolicyId: groomingPolicyId,
    createdAt: daysAgo(28),
    updatedAt: today
  };
  CareStore.saveObligation(groomingObligation);

  const groomingOcc: CareOccurrence = {
    occurrenceId: asCareOccurrenceId(generateUUIDv7()),
    careObligationId: groomingObId,
    petId,
    householdId,
    occurrenceNumber: 2,
    title: 'Medicated Chlorhexidine Bath & Nail Trim',
    category: 'GROOMING',
    scheduledFor: groomingDue,
    dueWindowStart: groomingDue,
    dueWindowEnd: daysAhead(4),
    status: 'UPCOMING',
    assignedToUserId: caregiverMember,
    snoozeCount: 0,
    createdAt: daysAgo(11),
    updatedAt: today
  };
  CareStore.saveOccurrence(groomingOcc);

  // --------------------------------------------------------------------------
  // 4. FUTURE SCHEDULED: Annual Comprehensive Physical & Dental Review
  // Provider-defined follow-up from Dr. Kiprono Mutai (due in 6 months)
  // --------------------------------------------------------------------------
  const vetCheckupObId = asCareObligationId(generateUUIDv7());
  const vetCheckupPolicyId = asReminderPolicyId(generateUUIDv7());
  const vetCheckupDue = daysAhead(180);

  const vetCheckupPolicy: ReminderPolicy = {
    policyId: vetCheckupPolicyId,
    careObligationId: vetCheckupObId,
    remindBeforeDays: [14, 3],
    remindAtDue: true,
    overdueReminderDays: [2, 7],
    maxRepetitions: 4,
    preferredChannels: ['IN_APP', 'EMAIL'],
    quietHoursRespect: true,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(10)
  };
  CareStore.saveReminderPolicy(vetCheckupPolicy);

  const vetCheckupObligation: CareObligation = {
    careObligationId: vetCheckupObId,
    petId,
    householdId,
    category: 'VET_CHECKUP',
    careType: 'ANNUAL_COMPREHENSIVE_EXAM',
    title: 'Annual Comprehensive Veterinary Checkup & Dental Exam',
    description: 'Follow-up exam recommended by Dr. Kiprono Mutai at Nairobi Veterinary Hospital. Re-evaluate grade 1 molar tartar.',
    sourceType: 'PROVIDER_RECORDED',
    sourceEntityType: 'ENCOUNTER',
    createdBy: ownerUserId,
    assignedToUserId: ownerUserId,
    scheduleType: 'PROVIDER_DEFINED',
    startsAt: daysAgo(180),
    dueAt: vetCheckupDue,
    dueWindow: {
      dueWindowStart: vetCheckupDue,
      dueWindowEnd: daysAhead(194)
    },
    timezone: 'Africa/Nairobi',
    priority: 'MEDIUM',
    status: 'ACTIVE',
    completionPolicy: 'EVIDENCE_REQUIRED',
    reminderPolicyId: vetCheckupPolicyId,
    createdAt: daysAgo(10),
    updatedAt: today
  };
  CareStore.saveObligation(vetCheckupObligation);

  const vetCheckupOcc: CareOccurrence = {
    occurrenceId: asCareOccurrenceId(generateUUIDv7()),
    careObligationId: vetCheckupObId,
    petId,
    householdId,
    occurrenceNumber: 1,
    title: 'Annual Comprehensive Veterinary Checkup & Dental Exam',
    category: 'VET_CHECKUP',
    scheduledFor: vetCheckupDue,
    dueWindowStart: vetCheckupDue,
    dueWindowEnd: daysAhead(194),
    status: 'SCHEDULED',
    assignedToUserId: ownerUserId,
    snoozeCount: 0,
    createdAt: daysAgo(10),
    updatedAt: today
  };
  CareStore.saveOccurrence(vetCheckupOcc);

  // --------------------------------------------------------------------------
  // 5. COMPLETED HISTORICAL CARE: Rabies Vaccination
  // Demonstrates verified completion audit and provenance
  // --------------------------------------------------------------------------
  const rabiesObId = asCareObligationId(generateUUIDv7());
  const rabiesObligation: CareObligation = {
    careObligationId: rabiesObId,
    petId,
    householdId,
    category: 'VACCINATION',
    careType: 'CANINE_RABIES',
    title: 'Nobivac Rabies Virus Vaccine Booster',
    description: '3-year rabies booster administered at Nairobi Veterinary Hospital.',
    sourceType: 'PROVIDER_RECORDED',
    createdBy: ownerUserId,
    assignedToUserId: ownerUserId,
    scheduleType: 'PROVIDER_DEFINED',
    startsAt: daysAgo(180),
    dueAt: daysAgo(180),
    timezone: 'Africa/Nairobi',
    priority: 'HIGH',
    status: 'COMPLETED',
    completionPolicy: 'AUTO_ON_RECORD',
    lastCompletedAt: daysAgo(180),
    nextDueAt: daysAhead(730),
    createdAt: daysAgo(180),
    updatedAt: daysAgo(180)
  };
  CareStore.saveObligation(rabiesObligation);

  const rabiesOcc: CareOccurrence = {
    occurrenceId: asCareOccurrenceId(generateUUIDv7()),
    careObligationId: rabiesObId,
    petId,
    householdId,
    occurrenceNumber: 1,
    title: 'Nobivac Rabies Virus Vaccine Booster',
    category: 'VACCINATION',
    scheduledFor: daysAgo(180),
    dueWindowStart: daysAgo(180),
    dueWindowEnd: daysAgo(150),
    status: 'COMPLETED',
    assignedToUserId: ownerUserId,
    completedAt: daysAgo(180),
    completedBy: ownerUserId,
    completionSourceType: 'VACCINATION_RECORD',
    completionSourceId: 'KVB-RB-9981',
    completionNotes: 'Administered 1.0 mL SubQ by Dr. Kiprono Mutai (KVB #7821). Batch KVB-RB-9981.',
    evidenceReference: 'DOC-VERIFIED-VACC-001',
    snoozeCount: 0,
    createdAt: daysAgo(180),
    updatedAt: daysAgo(180)
  };
  CareStore.saveOccurrence(rabiesOcc);

  // --------------------------------------------------------------------------
  // 6. Pre-populate Notification Inbox (Volume XXVI)
  // --------------------------------------------------------------------------
  const notificationsToSeed: NotificationDeliveryRecord[] = [
    {
      notificationId: asNotificationId(generateUUIDv7()),
      recipientUserId: ownerUserId,
      petId,
      careObligationId: bordetellaObId,
      occurrenceId: bordetellaOcc.occurrenceId,
      notificationType: 'CARE_OVERDUE',
      sourceType: 'CARE_OCCURRENCE',
      sourceId: bordetellaOcc.occurrenceId,
      title: 'CRITICAL: Bordetella Booster is Overdue',
      body: `${pet.name}'s Bordetella vaccination booster was due on ${new Date(bordetellaDue).toLocaleDateString()}. Please schedule with your veterinarian.`,
      channel: 'IN_APP',
      priority: 'HIGH',
      scheduledAt: daysAgo(13),
      sentAt: daysAgo(13),
      deliveredAt: daysAgo(13),
      status: 'DELIVERED',
      attemptCount: 1,
      maxAttempts: 3,
      deduplicationKey: `seed-overdue-${bordetellaObId}`,
      isRead: false,
      isDismissed: false,
      actionUrl: '#care-bordetella',
      createdAt: daysAgo(13),
      updatedAt: daysAgo(13)
    },
    {
      notificationId: asNotificationId(generateUUIDv7()),
      recipientUserId: adminMember,
      petId,
      careObligationId: simparicaObId,
      occurrenceId: simparicaOcc.occurrenceId,
      notificationType: 'CARE_DUE',
      sourceType: 'CARE_OCCURRENCE',
      sourceId: simparicaOcc.occurrenceId,
      title: 'Care Due Today: Simparica Trio',
      body: `Monthly parasite prevention (heartworm/flea/tick) is due today for ${pet.name}.`,
      channel: 'IN_APP',
      priority: 'HIGH',
      scheduledAt: today,
      sentAt: today,
      deliveredAt: today,
      status: 'DELIVERED',
      attemptCount: 1,
      maxAttempts: 3,
      deduplicationKey: `seed-due-${simparicaObId}`,
      isRead: false,
      isDismissed: false,
      actionUrl: '#care-simparica',
      createdAt: today,
      updatedAt: today
    },
    {
      notificationId: asNotificationId(generateUUIDv7()),
      recipientUserId: caregiverMember,
      petId,
      careObligationId: groomingObId,
      occurrenceId: groomingOcc.occurrenceId,
      notificationType: 'CARE_ASSIGNED',
      sourceType: 'CARE_OCCURRENCE',
      sourceId: groomingOcc.occurrenceId,
      title: 'Task Assigned: Medicated Bath & Nail Trim',
      body: `You have been assigned to assist with ${pet.name}'s medicated bath scheduled for ${new Date(groomingDue).toLocaleDateString()}.`,
      channel: 'IN_APP',
      priority: 'NORMAL',
      scheduledAt: daysAgo(2),
      sentAt: daysAgo(2),
      deliveredAt: daysAgo(2),
      status: 'DELIVERED',
      attemptCount: 1,
      maxAttempts: 3,
      deduplicationKey: `seed-assigned-${groomingObId}`,
      isRead: true,
      readAt: daysAgo(1),
      isDismissed: false,
      actionUrl: '#care-grooming',
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1)
    }
  ];

  for (const notif of notificationsToSeed) {
    NotificationStore.saveNotification(notif);
  }

  // Ensure default preferences are created
  NotificationStore.getPreferences(ownerUserId);
  NotificationStore.getPreferences(adminMember);
  NotificationStore.getPreferences(caregiverMember);
}
