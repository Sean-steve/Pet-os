/**
 * Pet OS - Notification Channel Transports
 * Implements Volume XXVI multi-channel delivery abstractions.
 */

import { NotificationChannel, NotificationDeliveryRecord, UserNotificationPreferences } from './types';

export interface TransportResult {
  success: boolean;
  provider: string;
  externalMessageId: string;
  error?: string;
  isPermanentFailure?: boolean;
}

export interface INotificationTransport {
  readonly channel: NotificationChannel;
  send(notification: NotificationDeliveryRecord, preferences?: UserNotificationPreferences): Promise<TransportResult>;
}

export class InAppTransport implements INotificationTransport {
  readonly channel: NotificationChannel = 'IN_APP';

  async send(notification: NotificationDeliveryRecord): Promise<TransportResult> {
    // In-app notifications are stored directly in the notification inbox store
    return {
      success: true,
      provider: 'PET_OS_IN_APP_DISPATCHER',
      externalMessageId: `inapp-${notification.notificationId}`
    };
  }
}

export class MockEmailTransport implements INotificationTransport {
  readonly channel: NotificationChannel = 'EMAIL';
  public shouldSimulateFailure = false;

  async send(notification: NotificationDeliveryRecord): Promise<TransportResult> {
    if (this.shouldSimulateFailure) {
      return {
        success: false,
        provider: 'SANDBOXED_SENDGRID_MOCK',
        externalMessageId: `fail-${Date.now()}`,
        error: 'SMTP connection timeout to recipient gateway',
        isPermanentFailure: false
      };
    }

    return {
      success: true,
      provider: 'SANDBOXED_SENDGRID_MOCK',
      externalMessageId: `msg-${Date.now()}-${notification.notificationId.slice(0, 8)}`
    };
  }
}

export class MockPushTransport implements INotificationTransport {
  readonly channel: NotificationChannel = 'PUSH';
  public shouldSimulateFailure = false;

  async send(notification: NotificationDeliveryRecord, preferences?: UserNotificationPreferences): Promise<TransportResult> {
    if (this.shouldSimulateFailure) {
      return {
        success: false,
        provider: 'FIREBASE_CLOUD_MESSAGING_MOCK',
        externalMessageId: `fail-fcm-${Date.now()}`,
        error: 'FCM device token expired (UNREGISTERED)',
        isPermanentFailure: true
      };
    }

    // Step 49: Lock-screen privacy mask
    // If privacy mask is enabled, sanitize the push notification body
    const privacyMaskEnabled = preferences?.lockScreenPrivacyMask ?? true;
    const deliveredBody = privacyMaskEnabled && notification.notificationType.includes('CARE')
      ? 'Pet Care Reminder: An obligation requires attention.'
      : notification.body;

    return {
      success: true,
      provider: 'FIREBASE_CLOUD_MESSAGING_MOCK',
      externalMessageId: `fcm-${Date.now()}-${notification.notificationId.slice(0, 8)}`
    };
  }
}

export class MockSmsTransport implements INotificationTransport {
  readonly channel: NotificationChannel = 'SMS';
  public shouldSimulateFailure = false;

  async send(notification: NotificationDeliveryRecord): Promise<TransportResult> {
    if (this.shouldSimulateFailure) {
      return {
        success: false,
        provider: 'AFRICAS_TALKING_SMS_GATEWAY',
        externalMessageId: `fail-sms-${Date.now()}`,
        error: 'Network route unavailable or phone unreachable',
        isPermanentFailure: false
      };
    }

    return {
      success: true,
      provider: 'AFRICAS_TALKING_SMS_GATEWAY',
      externalMessageId: `AT-SMS-${Date.now()}-${notification.notificationId.slice(0, 8)}`
    };
  }
}

export class TransportRegistry {
  private static transports: Map<NotificationChannel, INotificationTransport> = new Map([
    ['IN_APP', new InAppTransport()],
    ['EMAIL', new MockEmailTransport()],
    ['PUSH', new MockPushTransport()],
    ['SMS', new MockSmsTransport()]
  ]);

  static getTransport(channel: NotificationChannel): INotificationTransport {
    const transport = this.transports.get(channel);
    if (!transport) {
      throw new Error(`No transport registered for channel: ${channel}`);
    }
    return transport;
  }

  static registerTransport(channel: NotificationChannel, transport: INotificationTransport): void {
    this.transports.set(channel, transport);
  }

  static getEmailTransport(): MockEmailTransport {
    return this.transports.get('EMAIL') as MockEmailTransport;
  }

  static getPushTransport(): MockPushTransport {
    return this.transports.get('PUSH') as MockPushTransport;
  }

  static getSmsTransport(): MockSmsTransport {
    return this.transports.get('SMS') as MockSmsTransport;
  }
}
