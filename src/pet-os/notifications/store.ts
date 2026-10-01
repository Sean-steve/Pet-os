/**
 * Pet OS - Notifications Data Store
 * In-memory persistence with indexing and reactive subscriptions.
 */

import {
  UserId,
  NotificationId,
  NotificationPreferenceId,
  asNotificationPreferenceId,
  generateUUIDv7
} from '../kernel/ids';
import {
  NotificationDeliveryRecord,
  UserNotificationPreferences,
  DeliveryAttempt,
  NotificationMetrics
} from './types';

export class NotificationStore {
  private static notifications: Map<string, NotificationDeliveryRecord> = new Map();
  private static preferences: Map<string, UserNotificationPreferences> = new Map();
  private static attempts: DeliveryAttempt[] = [];
  private static processedWebhookEventIds: Set<string> = new Set();
  private static deduplicationIndex: Map<string, string> = new Map(); // deduplicationKey -> notificationId
  private static subscribers: Set<() => void> = new Set();

  private static metrics: NotificationMetrics = {
    totalScheduled: 0,
    totalSent: 0,
    totalDelivered: 0,
    totalFailed: 0,
    totalDeadLetter: 0,
    retriesExecuted: 0,
    quietHoursSuppressed: 0,
    duplicatesDeduplicated: 0
  };

  static subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private static notifySubscribers(): void {
    this.subscribers.forEach(cb => {
      try {
        cb();
      } catch (err) {
        console.error('NotificationStore subscriber error', err);
      }
    });
  }

  // --- Notification CRUD & Query ---

  static saveNotification(record: NotificationDeliveryRecord): void {
    const isNew = !this.notifications.has(record.notificationId);
    this.notifications.set(record.notificationId, { ...record });
    if (record.deduplicationKey) {
      this.deduplicationIndex.set(record.deduplicationKey, record.notificationId);
    }
    if (isNew) {
      this.metrics.totalScheduled++;
    }
    this.notifySubscribers();
  }

  static getNotification(id: NotificationId): NotificationDeliveryRecord | undefined {
    const n = this.notifications.get(id);
    return n ? { ...n } : undefined;
  }

  static findByDeduplicationKey(key: string): NotificationDeliveryRecord | undefined {
    const id = this.deduplicationIndex.get(key);
    if (!id) return undefined;
    return this.getNotification(id as NotificationId);
  }

  static getNotificationsForUser(userId: UserId): NotificationDeliveryRecord[] {
    return Array.from(this.notifications.values())
      .filter(n => n.recipientUserId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static getUnreadNotificationsForUser(userId: UserId): NotificationDeliveryRecord[] {
    return Array.from(this.notifications.values())
      .filter(n => n.recipientUserId === userId && !n.isRead && !n.isDismissed)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static markAsRead(id: NotificationId): void {
    const n = this.notifications.get(id);
    if (n) {
      n.isRead = true;
      n.readAt = new Date().toISOString();
      this.notifications.set(id, n);
      this.notifySubscribers();
    }
  }

  static markAllAsRead(userId: UserId): void {
    const now = new Date().toISOString();
    for (const [id, n] of this.notifications.entries()) {
      if (n.recipientUserId === userId && !n.isRead) {
        n.isRead = true;
        n.readAt = now;
        this.notifications.set(id, n);
      }
    }
    this.notifySubscribers();
  }

  static getPendingDeliveries(currentTimeIso: string): NotificationDeliveryRecord[] {
    const currentMs = new Date(currentTimeIso).getTime();
    return Array.from(this.notifications.values())
      .filter(n => {
        if (n.status !== 'SCHEDULED' && n.status !== 'QUEUED') return false;
        const scheduledMs = new Date(n.scheduledAt).getTime();
        return scheduledMs <= currentMs;
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }

  static getAllNotifications(): NotificationDeliveryRecord[] {
    return Array.from(this.notifications.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // --- Preferences ---

  static getPreferences(userId: UserId): UserNotificationPreferences {
    const existing = this.preferences.get(userId);
    if (existing) {
      return { ...existing };
    }

    // Default canonical preferences
    const defaultPref: UserNotificationPreferences = {
      preferenceId: asNotificationPreferenceId(generateUUIDv7()),
      userId,
      emailEnabled: true,
      smsEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      timezone: 'Africa/Nairobi',
      careRemindersEnabled: true,
      marketingEnabled: false,
      lockScreenPrivacyMask: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.preferences.set(userId, defaultPref);
    return { ...defaultPref };
  }

  static savePreferences(preferences: UserNotificationPreferences): void {
    this.preferences.set(preferences.userId, {
      ...preferences,
      updatedAt: new Date().toISOString()
    });
    this.notifySubscribers();
  }

  // --- Delivery Attempts ---

  static recordAttempt(attempt: DeliveryAttempt): void {
    this.attempts.push(attempt);
    if (attempt.status === 'SUCCESS') {
      this.metrics.totalDelivered++;
    } else if (attempt.status === 'PERMANENT_FAILURE') {
      this.metrics.totalFailed++;
    } else {
      this.metrics.retriesExecuted++;
    }
    this.notifySubscribers();
  }

  static getAttemptsForNotification(notificationId: NotificationId): DeliveryAttempt[] {
    return this.attempts.filter(a => a.notificationId === notificationId);
  }

  // --- Webhook Idempotency ---

  static isWebhookProcessed(eventId: string): boolean {
    return this.processedWebhookEventIds.has(eventId);
  }

  static recordProcessedWebhook(eventId: string): void {
    this.processedWebhookEventIds.add(eventId);
  }

  // --- Metrics ---

  static getMetrics(): NotificationMetrics {
    return { ...this.metrics };
  }

  static recordMetricEvent(event: keyof NotificationMetrics): void {
    this.metrics[event]++;
  }

  static reset(): void {
    this.notifications.clear();
    this.preferences.clear();
    this.attempts = [];
    this.processedWebhookEventIds.clear();
    this.deduplicationIndex.clear();
    this.metrics = {
      totalScheduled: 0,
      totalSent: 0,
      totalDelivered: 0,
      totalFailed: 0,
      totalDeadLetter: 0,
      retriesExecuted: 0,
      quietHoursSuppressed: 0,
      duplicatesDeduplicated: 0
    };
    this.notifySubscribers();
  }
}
