/**
 * Pet OS Sprint 2 - Notification Service Abstraction
 * Implements Step 7: Testable notification abstraction for email/contact verification and password recovery.
 */

export interface VerificationNotification {
  toEmail: string;
  token: string;
  verificationLink: string;
  expiresAt: string;
  sentAt: string;
}

export interface PasswordResetNotification {
  toEmail: string;
  token: string;
  resetLink: string;
  expiresAt: string;
  sentAt: string;
}

export interface HouseholdInvitationNotification {
  toEmail: string;
  inviterName: string;
  householdName: string;
  role: string;
  token: string;
  invitationLink: string;
  expiresAt: string;
  sentAt: string;
}

export interface INotificationService {
  sendEmailVerification(notification: VerificationNotification): Promise<void>;
  sendPasswordReset(notification: PasswordResetNotification): Promise<void>;
  sendHouseholdInvitation(notification: HouseholdInvitationNotification): Promise<void>;
}

export class MockNotificationService implements INotificationService {
  public static verificationQueue: VerificationNotification[] = [];
  public static passwordResetQueue: PasswordResetNotification[] = [];
  public static invitationQueue: HouseholdInvitationNotification[] = [];

  async sendEmailVerification(notification: VerificationNotification): Promise<void> {
    MockNotificationService.verificationQueue.push(notification);
  }

  async sendPasswordReset(notification: PasswordResetNotification): Promise<void> {
    MockNotificationService.passwordResetQueue.push(notification);
  }

  async sendHouseholdInvitation(notification: HouseholdInvitationNotification): Promise<void> {
    MockNotificationService.invitationQueue.push(notification);
  }

  static getLatestVerification(email: string): VerificationNotification | undefined {
    return this.verificationQueue
      .filter(n => n.toEmail.toLowerCase() === email.toLowerCase())
      .slice(-1)[0];
  }

  static getLatestPasswordReset(email: string): PasswordResetNotification | undefined {
    return this.passwordResetQueue
      .filter(n => n.toEmail.toLowerCase() === email.toLowerCase())
      .slice(-1)[0];
  }

  static getLatestInvitation(email: string): HouseholdInvitationNotification | undefined {
    return this.invitationQueue
      .filter(n => n.toEmail.toLowerCase() === email.toLowerCase())
      .slice(-1)[0];
  }

  static clear(): void {
    this.verificationQueue = [];
    this.passwordResetQueue = [];
    this.invitationQueue = [];
  }
}
