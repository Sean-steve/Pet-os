/**
 * Pet OS - Notification Orchestration Service
 * Implements Volume XXVI: Delivery Orchestration, Quiet Hours, Deduplication & Webhooks.
 */

import {
  UserId,
  PetId,
  CareObligationId,
  CareOccurrenceId,
  NotificationId,
  asNotificationId,
  asDeliveryAttemptId,
  generateUUIDv7
} from '../kernel/ids';
import { currentClockTime, currentClockUtcNow } from '../kernel/time';
import {
  NotificationChannel,
  NotificationPriority,
  NotificationType,
  NotificationDeliveryRecord,
  UserNotificationPreferences,
  ProviderWebhookPayload
} from './types';
import { NotificationStore } from './store';
import { TransportRegistry } from './transports';

export interface ScheduleNotificationCommand {
  recipientUserId: UserId;
  petId?: PetId;
  careObligationId?: CareObligationId;
  occurrenceId?: CareOccurrenceId;
  notificationType: NotificationType;
  sourceType: string;
  sourceId: string;
  title: string;
  body: string;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  scheduledAt?: string; // ISO 8601 UTC
  deduplicationKey?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export class NotificationService {
  /**
   * Evaluates if a given time is within a user's quiet hours window.
   */
  static isWithinQuietHours(currentTime: Date, prefs: UserNotificationPreferences): boolean {
    if (!prefs.quietHoursEnabled) return false;

    try {
      // Format current time in user's timezone
      const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: prefs.timezone || 'Africa/Nairobi',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      const parts = timeFormatter.formatToParts(currentTime);
      const hourPart = parts.find(p => p.type === 'hour')?.value ?? '00';
      const minutePart = parts.find(p => p.type === 'minute')?.value ?? '00';
      const currentMinutes = parseInt(hourPart, 10) * 60 + parseInt(minutePart, 10);

      const [startH, startM] = prefs.quietHoursStart.split(':').map(n => parseInt(n, 10));
      const [endH, endM] = prefs.quietHoursEnd.split(':').map(n => parseInt(n, 10));
      const startMinutes = startH * 60 + (startM || 0);
      const endMinutes = endH * 60 + (endM || 0);

      if (startMinutes > endMinutes) {
        // Window spans midnight (e.g. 22:00 to 07:00)
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      } else {
        // Window is within the same calendar day (e.g. 13:00 to 15:00)
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      }
    } catch {
      return false;
    }
  }

  /**
   * Computes the end of quiet hours as a Date for rescheduling.
   */
  static getQuietHoursEnd(currentTime: Date, prefs: UserNotificationPreferences): Date {
    const [endH, endM] = prefs.quietHoursEnd.split(':').map(n => parseInt(n, 10));
    const nextEnd = new Date(currentTime);
    nextEnd.setUTCHours(endH, endM, 0, 0);
    if (nextEnd.getTime() <= currentTime.getTime()) {
      nextEnd.setDate(nextEnd.getDate() + 1);
    }
    return nextEnd;
  }

  /**
   * Schedules one or more channel deliveries with deduplication and quiet-hours enforcement.
   */
  static async schedule(command: ScheduleNotificationCommand): Promise<NotificationDeliveryRecord[]> {
    const prefs = NotificationStore.getPreferences(command.recipientUserId);
    const channels = command.channels || ['IN_APP', 'EMAIL'];
    const priority = command.priority || 'NORMAL';
    const clockNow = currentClockTime();
    let scheduledAt = command.scheduledAt ? new Date(command.scheduledAt) : clockNow;

    // Quiet hours check for non-critical notifications
    if (priority !== 'CRITICAL' && this.isWithinQuietHours(clockNow, prefs)) {
      scheduledAt = this.getQuietHoursEnd(clockNow, prefs);
      NotificationStore.recordMetricEvent('quietHoursSuppressed');
    }

    const createdRecords: NotificationDeliveryRecord[] = [];

    for (const channel of channels) {
      // Channel preference check
      if (channel === 'EMAIL' && !prefs.emailEnabled) continue;
      if (channel === 'SMS' && !prefs.smsEnabled) continue;
      if (channel === 'PUSH' && !prefs.pushEnabled) continue;
      if (channel === 'IN_APP' && !prefs.inAppEnabled) continue;

      // Deduplication key generation (idempotency)
      const deduplicationKey = command.deduplicationKey
        ? `${command.deduplicationKey}:${channel}`
        : `${command.recipientUserId}:${command.sourceType}:${command.sourceId}:${command.notificationType}:${channel}:${scheduledAt.toISOString().slice(0, 13)}`;

      const existing = NotificationStore.findByDeduplicationKey(deduplicationKey);
      if (existing) {
        NotificationStore.recordMetricEvent('duplicatesDeduplicated');
        createdRecords.push(existing);
        continue;
      }

      const record: NotificationDeliveryRecord = {
        notificationId: asNotificationId(generateUUIDv7()),
        recipientUserId: command.recipientUserId,
        petId: command.petId,
        careObligationId: command.careObligationId,
        occurrenceId: command.occurrenceId,
        notificationType: command.notificationType,
        sourceType: command.sourceType,
        sourceId: command.sourceId,
        title: command.title,
        body: command.body,
        channel,
        priority,
        scheduledAt: scheduledAt.toISOString(),
        status: scheduledAt.getTime() <= clockNow.getTime() ? 'QUEUED' : 'SCHEDULED',
        attemptCount: 0,
        maxAttempts: 3,
        deduplicationKey,
        isRead: false,
        isDismissed: false,
        actionUrl: command.actionUrl,
        metadata: command.metadata,
        createdAt: clockNow.toISOString(),
        updatedAt: clockNow.toISOString()
      };

      NotificationStore.saveNotification(record);
      createdRecords.push(record);
    }

    return createdRecords;
  }

  /**
   * Processes the pending notification queue (called by scheduler or background tick).
   */
  static async processPendingQueue(currentTime = currentClockTime()): Promise<{
    processed: number;
    delivered: number;
    failed: number;
    deadLetter: number;
  }> {
    const pending = NotificationStore.getPendingDeliveries(currentTime.toISOString());
    let delivered = 0;
    let failed = 0;
    let deadLetter = 0;

    for (const notification of pending) {
      const prefs = NotificationStore.getPreferences(notification.recipientUserId);

      // Verify quiet hours haven't re-engaged
      if (notification.priority !== 'CRITICAL' && this.isWithinQuietHours(currentTime, prefs)) {
        notification.scheduledAt = this.getQuietHoursEnd(currentTime, prefs).toISOString();
        notification.status = 'SCHEDULED';
        NotificationStore.saveNotification(notification);
        NotificationStore.recordMetricEvent('quietHoursSuppressed');
        continue;
      }

      notification.status = 'SENDING';
      notification.attemptCount++;
      NotificationStore.saveNotification(notification);

      try {
        const transport = TransportRegistry.getTransport(notification.channel);
        const result = await transport.send(notification, prefs);

        if (result.success) {
          notification.status = 'DELIVERED';
          notification.sentAt = currentTime.toISOString();
          notification.deliveredAt = currentTime.toISOString();
          notification.updatedAt = currentTime.toISOString();
          NotificationStore.saveNotification(notification);
          delivered++;

          NotificationStore.recordAttempt({
            attemptId: asDeliveryAttemptId(generateUUIDv7()),
            notificationId: notification.notificationId,
            channel: notification.channel,
            attemptedAt: currentTime.toISOString(),
            status: 'SUCCESS',
            provider: result.provider,
            providerResponse: result.externalMessageId
          });
        } else {
          // Failure handling
          failed++;
          const isPermanent = result.isPermanentFailure || notification.attemptCount >= notification.maxAttempts;

          NotificationStore.recordAttempt({
            attemptId: asDeliveryAttemptId(generateUUIDv7()),
            notificationId: notification.notificationId,
            channel: notification.channel,
            attemptedAt: currentTime.toISOString(),
            status: isPermanent ? 'PERMANENT_FAILURE' : 'TEMPORARY_FAILURE',
            provider: result.provider,
            errorMessage: result.error
          });

          if (isPermanent) {
            notification.status = 'DEAD_LETTER';
            notification.failedAt = currentTime.toISOString();
            notification.failureReason = result.error || 'Exceeded maximum delivery attempts';
            notification.updatedAt = currentTime.toISOString();
            NotificationStore.saveNotification(notification);
            NotificationStore.recordMetricEvent('totalDeadLetter');
            deadLetter++;
          } else {
            // Exponential backoff: 5m, 15m, 1h
            const backoffMinutes = Math.pow(3, notification.attemptCount) * 5;
            const nextAttempt = new Date(currentTime.getTime() + backoffMinutes * 60 * 1000);
            notification.scheduledAt = nextAttempt.toISOString();
            notification.status = 'QUEUED';
            notification.updatedAt = currentTime.toISOString();
            NotificationStore.saveNotification(notification);
          }
        }
      } catch (err: any) {
        failed++;
        notification.status = 'FAILED';
        notification.failureReason = err.message || 'Transport exception';
        notification.updatedAt = currentTime.toISOString();
        NotificationStore.saveNotification(notification);
      }
    }

    return { processed: pending.length, delivered, failed, deadLetter };
  }

  // --- In-App Actions ---

  static markAsRead(userId: UserId, notificationId: NotificationId): boolean {
    const notification = NotificationStore.getNotification(notificationId);
    if (!notification || notification.recipientUserId !== userId) {
      return false;
    }
    notification.isRead = true;
    notification.readAt = currentClockUtcNow();
    notification.updatedAt = currentClockUtcNow();
    NotificationStore.saveNotification(notification);
    return true;
  }

  static markAllAsRead(userId: UserId): number {
    const unread = NotificationStore.getUnreadNotificationsForUser(userId);
    const now = currentClockUtcNow();
    for (const n of unread) {
      n.isRead = true;
      n.readAt = now;
      n.updatedAt = now;
      NotificationStore.saveNotification(n);
    }
    return unread.length;
  }

  static dismissNotification(userId: UserId, notificationId: NotificationId): boolean {
    const notification = NotificationStore.getNotification(notificationId);
    if (!notification || notification.recipientUserId !== userId) {
      return false;
    }
    notification.isDismissed = true;
    notification.dismissedAt = currentClockUtcNow();
    notification.updatedAt = currentClockUtcNow();
    NotificationStore.saveNotification(notification);
    return true;
  }

  // --- Preferences ---

  static updatePreferences(userId: UserId, updates: Partial<UserNotificationPreferences>): UserNotificationPreferences {
    const current = NotificationStore.getPreferences(userId);
    const updated: UserNotificationPreferences = {
      ...current,
      ...updates,
      userId,
      updatedAt: currentClockUtcNow()
    };
    NotificationStore.savePreferences(updated);
    return updated;
  }

  // --- Provider Webhooks (Idempotency & Signature Verification) ---

  static handleProviderWebhook(payload: ProviderWebhookPayload): {
    success: boolean;
    status: 'PROCESSED' | 'IGNORED_DUPLICATE' | 'INVALID_SIGNATURE';
    message: string;
  } {
    // 1. Replay attack & duplicate prevention
    if (NotificationStore.isWebhookProcessed(payload.eventId)) {
      return {
        success: true,
        status: 'IGNORED_DUPLICATE',
        message: 'Webhook event already processed (idempotency confirmed).'
      };
    }

    // 2. Simulated cryptographic signature verification
    // Valid signature must start with "sig_valid_"
    if (!payload.signature || !payload.signature.startsWith('sig_valid_')) {
      return {
        success: false,
        status: 'INVALID_SIGNATURE',
        message: 'Invalid webhook HMAC signature. Request rejected.'
      };
    }

    // 3. Mark event processed
    NotificationStore.recordProcessedWebhook(payload.eventId);

    // 4. Update corresponding notification if present
    if (payload.notificationId) {
      const notification = NotificationStore.getNotification(payload.notificationId);
      if (notification) {
        if (payload.eventStatus === 'DELIVERED') {
          notification.status = 'DELIVERED';
          notification.deliveredAt = payload.timestamp;
        } else if (payload.eventStatus === 'BOUNCED' || payload.eventStatus === 'FAILED') {
          notification.status = 'FAILED';
          notification.failedAt = payload.timestamp;
          notification.failureReason = `Provider delivery failed: ${payload.eventStatus}`;
        }
        notification.updatedAt = currentClockUtcNow();
        NotificationStore.saveNotification(notification);
      }
    }

    return {
      success: true,
      status: 'PROCESSED',
      message: 'Webhook processed successfully.'
    };
  }
}
