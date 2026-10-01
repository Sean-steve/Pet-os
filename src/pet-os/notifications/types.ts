/**
 * Pet OS - Notifications Bounded Context Types
 * Implements Volume XXVI: Notification Orchestration, Delivery & Communication Platform
 */

import {
  UserId,
  PetId,
  CareObligationId,
  CareOccurrenceId,
  NotificationId,
  NotificationPreferenceId,
  DeliveryAttemptId
} from '../kernel/ids';

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'PUSH' | 'SMS';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export type NotificationStatus =
  | 'SCHEDULED'
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'CANCELLED'
  | 'DEAD_LETTER';

export type NotificationType =
  | 'CARE_DUE'
  | 'CARE_UPCOMING'
  | 'CARE_OVERDUE'
  | 'CARE_ASSIGNED'
  | 'CARE_COMPLETED'
  | 'MEDICATION_DOSE'
  | 'HEALTH_RECORD_VERIFIED'
  | 'SECURITY_ALERT'
  | 'MEAL_DUE'
  | 'MEAL_UPCOMING'
  | 'MEAL_OVERDUE'
  | 'MEAL_ASSIGNED'
  | 'MEAL_COMPLETED'
  | 'BOOKING_REQUESTED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_ACCEPTED'
  | 'BOOKING_DECLINED'
  | 'BOOKING_EXPIRED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_RESCHEDULE_REQUESTED'
  | 'BOOKING_RESCHEDULED'
  | 'BOOKING_REMINDER';

export interface NotificationDeliveryRecord {
  notificationId: NotificationId;
  recipientUserId: UserId;
  petId?: PetId;
  careObligationId?: CareObligationId;
  occurrenceId?: CareOccurrenceId;
  notificationType: NotificationType;
  sourceType: string;
  sourceId: string;
  title: string;
  body: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  scheduledAt: string; // ISO 8601 UTC
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  failureReason?: string;
  status: NotificationStatus;
  attemptCount: number;
  maxAttempts: number;
  deduplicationKey: string;
  isRead: boolean;
  readAt?: string;
  isDismissed: boolean;
  dismissedAt?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface UserNotificationPreferences {
  preferenceId: NotificationPreferenceId;
  userId: UserId;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "HH:MM", e.g. "22:00"
  quietHoursEnd: string;   // "HH:MM", e.g. "07:00"
  timezone: string;        // e.g. "Africa/Nairobi", "UTC", "America/New_York"
  careRemindersEnabled: boolean;
  marketingEnabled: boolean;
  lockScreenPrivacyMask: boolean; // Hide clinical/medical text on lock-screen push
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryAttempt {
  attemptId: DeliveryAttemptId;
  notificationId: NotificationId;
  channel: NotificationChannel;
  attemptedAt: string;
  status: 'SUCCESS' | 'TEMPORARY_FAILURE' | 'PERMANENT_FAILURE';
  provider: string;
  providerResponse?: string;
  errorMessage?: string;
}

export interface ProviderWebhookPayload {
  eventId: string;
  provider: 'TWILIO' | 'SENDGRID' | 'FIREBASE_MESSAGING' | 'AFRICAS_TALKING';
  externalMessageId: string;
  notificationId?: NotificationId;
  eventStatus: 'DELIVERED' | 'BOUNCED' | 'FAILED' | 'OPENED' | 'CLICKED';
  signature: string;
  timestamp: string;
}

export interface NotificationMetrics {
  totalScheduled: number;
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalDeadLetter: number;
  retriesExecuted: number;
  quietHoursSuppressed: number;
  duplicatesDeduplicated: number;
}
