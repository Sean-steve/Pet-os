/**
 * Pet OS Sprint 2 - Identity & Household Domain Service
 * Implements Volumes IV, XXVIII, XXX, XXXI, XXXII, XLI:
 * Central business logic for registration, authentication, verification,
 * session management, account lifecycle, household governance, and audit trails.
 */

import { 
  UserAccount, 
  UserProfile, 
  Session, 
  Household, 
  HouseholdMember, 
  HouseholdInvitation,
  HouseholdRole,
  VerificationToken,
  PasswordResetToken
} from './types';
import { IdentityStore } from './store';
import { CryptoUtils } from './crypto';
import { RateLimiter } from './rate-limit';
import { MockNotificationService } from './notification';
import { AuthorizationService } from './authorization';
import { 
  generateUUIDv7, 
  UserId, 
  HouseholdId, 
  SessionId, 
  InvitationId, 
  MembershipId,
  asUserId,
  asHouseholdId,
  asSessionId,
  asInvitationId,
  asMembershipId
} from '../kernel/ids';
import { InMemoryAuditStore } from '../kernel/audit';
import { utcNow } from '../kernel/time';

export class IdentityService {
  private static notificationService = new MockNotificationService();

  // ==========================================
  // 1. REGISTRATION & INPUT VALIDATION
  // ==========================================

  static validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
    if (!password || password.length < 8) {
      return { valid: false, reason: 'Password must be at least 8 characters long.' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, reason: 'Password must contain at least one uppercase letter.' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, reason: 'Password must contain at least one lowercase letter.' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, reason: 'Password must contain at least one number.' };
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      return { valid: false, reason: 'Password must contain at least one special character.' };
    }
    return { valid: true };
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  static validateKenyaPhone(phone: string): boolean {
    // Volume XXXII: Kenya E.164 (+2547... or +2541...)
    const kePhoneRegex = /^\+254[17][0-9]{8}$/;
    return kePhoneRegex.test(phone.trim());
  }

  static async register(params: {
    email: string;
    password: string;
    displayName: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    clientIp?: string;
  }): Promise<{ user: Omit<UserAccount, 'passwordHash'>; profile: UserProfile; verificationToken: string }> {
    // 1. Rate Limit
    const rateKey = `reg:${params.clientIp || 'default'}`;
    const rateCheck = RateLimiter.check(rateKey, RateLimiter.CONFIGS.REGISTRATION);
    if (!rateCheck.allowed) {
      throw new Error(`RATE_LIMITED: Registration limit exceeded. Retry in ${rateCheck.retryAfterSeconds}s`);
    }

    // 2. Validate input
    if (!this.validateEmail(params.email)) {
      throw new Error('VALIDATION_001: Invalid email address format.');
    }

    const passwordCheck = this.validatePasswordStrength(params.password);
    if (!passwordCheck.valid) {
      throw new Error(`VALIDATION_001: ${passwordCheck.reason}`);
    }

    if (params.phoneNumber && !this.validateKenyaPhone(params.phoneNumber)) {
      throw new Error('VALIDATION_001: Invalid Kenya phone number. Must conform to E.164 format (e.g. +254712345678).');
    }

    const normalizedEmail = params.email.toLowerCase().trim();

    // 3. Ensure uniqueness
    const existing = IdentityStore.findUserByNormalizedEmail(normalizedEmail);
    if (existing) {
      throw new Error('AUTH_008: An account with this email address already exists.');
    }

    // 4. Hash password
    const passwordHash = await CryptoUtils.hashPassword(params.password);
    const userId = asUserId(generateUUIDv7());
    const now = utcNow();

    // 5. Create user record
    const user: UserAccount = {
      userId,
      email: params.email.trim(),
      normalizedEmail,
      phoneNumber: params.phoneNumber?.trim(),
      passwordHash,
      accountStatus: 'PENDING_VERIFICATION',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
      policyAcceptedAt: now,
      policyVersion: '2026.1-ke'
    };

    // 6. Create profile record
    const profile: UserProfile = {
      userId,
      displayName: params.displayName.trim() || params.email.split('@')[0],
      firstName: params.firstName?.trim() || '',
      lastName: params.lastName?.trim() || '',
      locale: 'en-KE',
      timezone: 'Africa/Nairobi',
      communicationPreferences: {
        emailNotifications: true,
        smsNotifications: !!params.phoneNumber,
        emergencyAlerts: true
      },
      privacyPreferences: {
        profileVisibility: 'HOUSEHOLD_ONLY',
        shareActivityWithHousehold: true
      },
      updatedAt: now
    };

    // 7. Persist atomically
    IdentityStore.saveUser(user);
    IdentityStore.saveProfile(profile);

    // 8. Generate verification token
    const rawToken = CryptoUtils.generateSecureToken(32);
    const tokenHash = await CryptoUtils.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const verificationRecord: VerificationToken = {
      id: generateUUIDv7(),
      userId,
      tokenHash,
      rawTokenForNotification: rawToken,
      type: 'EMAIL_VERIFICATION',
      createdAt: now,
      expiresAt,
      attemptCount: 0
    };
    IdentityStore.saveVerificationToken(verificationRecord);

    // 9. Send notification
    await this.notificationService.sendEmailVerification({
      toEmail: user.email,
      token: rawToken,
      verificationLink: `/auth/verify?token=${rawToken}`,
      expiresAt,
      sentAt: now
    });

    // 10. Audit event
    InMemoryAuditStore.record({
      actorId: userId,
      actorType: 'USER',
      action: 'USER_REGISTERED',
      resourceType: 'UserAccount',
      resourceId: userId,
      classification: 'CONFIDENTIAL',
      metadata: { email: user.normalizedEmail, status: user.accountStatus }
    });

    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, profile, verificationToken: rawToken };
  }

  // ==========================================
  // 2. EMAIL VERIFICATION
  // ==========================================

  static async verifyEmail(token: string): Promise<{ success: boolean; message: string; user: Omit<UserAccount, 'passwordHash'> }> {
    const tokenHash = await CryptoUtils.hashToken(token);
    const record = IdentityStore.findVerificationTokenByHash(tokenHash);

    if (!record) {
      throw new Error('AUTH_007: Verification token is invalid or does not exist.');
    }

    if (record.consumedAt) {
      throw new Error('AUTH_007: Verification token has already been consumed.');
    }

    const now = utcNow();
    if (now > record.expiresAt) {
      throw new Error('AUTH_007: Verification token has expired. Please request a new one.');
    }

    const user = IdentityStore.findUserById(record.userId);
    if (!user) {
      throw new Error('AUTH_001: User not found.');
    }

    // Mark verified
    user.emailVerifiedAt = now;
    if (user.accountStatus === 'PENDING_VERIFICATION') {
      user.accountStatus = 'ACTIVE';
    }
    user.updatedAt = now;
    IdentityStore.saveUser(user);

    // Invalidate token
    record.consumedAt = now;
    IdentityStore.saveVerificationToken(record);

    InMemoryAuditStore.record({
      actorId: user.userId,
      actorType: 'USER',
      action: 'EMAIL_VERIFIED',
      resourceType: 'UserAccount',
      resourceId: user.userId,
      classification: 'INTERNAL',
      metadata: { email: user.normalizedEmail }
    });

    const { passwordHash: _, ...safeUser } = user;
    return { success: true, message: 'Email verified successfully. Account is now active.', user: safeUser };
  }

  static async resendVerification(email: string, clientIp?: string): Promise<{ success: boolean; message: string; rawToken?: string }> {
    const rateKey = `resend:${email.toLowerCase().trim()}`;
    const rateCheck = RateLimiter.check(rateKey, RateLimiter.CONFIGS.VERIFY_RESEND);
    if (!rateCheck.allowed) {
      throw new Error(`RATE_LIMITED: Too many verification requests. Retry in ${rateCheck.retryAfterSeconds}s`);
    }

    const user = IdentityStore.findUserByNormalizedEmail(email);
    // Generic response to avoid account enumeration
    if (!user || user.emailVerifiedAt) {
      return { success: true, message: 'If an unverified account exists with that email, a verification link has been sent.' };
    }

    // Invalidate prior tokens
    IdentityStore.invalidateUserVerificationTokens(user.userId);

    // Create new token
    const rawToken = CryptoUtils.generateSecureToken(32);
    const tokenHash = await CryptoUtils.hashToken(rawToken);
    const now = utcNow();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const verificationRecord: VerificationToken = {
      id: generateUUIDv7(),
      userId: user.userId,
      tokenHash,
      rawTokenForNotification: rawToken,
      type: 'EMAIL_VERIFICATION',
      createdAt: now,
      expiresAt,
      attemptCount: 0
    };
    IdentityStore.saveVerificationToken(verificationRecord);

    await this.notificationService.sendEmailVerification({
      toEmail: user.email,
      token: rawToken,
      verificationLink: `/auth/verify?token=${rawToken}`,
      expiresAt,
      sentAt: now
    });

    return { 
      success: true, 
      message: 'If an unverified account exists with that email, a verification link has been sent.',
      rawToken // provided for testing
    };
  }

  // ==========================================
  // 3. LOGIN & SESSION MANAGEMENT
  // ==========================================

  static async login(params: {
    email: string;
    password: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<{ session: Session; user: Omit<UserAccount, 'passwordHash'>; profile: UserProfile }> {
    const normalizedEmail = params.email.toLowerCase().trim();
    const rateKey = `login:${normalizedEmail}`;
    const rateCheck = RateLimiter.check(rateKey, RateLimiter.CONFIGS.LOGIN);
    if (!rateCheck.allowed) {
      throw new Error(`RATE_LIMITED: Too many failed login attempts. Retry in ${rateCheck.retryAfterSeconds}s`);
    }

    const user = IdentityStore.findUserByNormalizedEmail(normalizedEmail);
    // Generic invalid credential response
    if (!user) {
      throw new Error('AUTH_004: Invalid credentials provided.');
    }

    // Lockout check
    if (user.lockoutUntil && user.lockoutUntil > utcNow()) {
      throw new Error('AUTH_004: Account temporarily locked out due to multiple failed login attempts. Try again later.');
    }

    // Account status check
    if (user.accountStatus === 'SUSPENDED') {
      throw new Error('AUTH_005: Account is suspended. Please contact Pet OS trust and safety support.');
    }
    if (user.accountStatus === 'DEACTIVATED' || user.accountStatus === 'DELETED') {
      throw new Error('AUTH_005: Account has been deactivated.');
    }

    // Constant-time password verification
    const isPasswordValid = await CryptoUtils.verifyPassword(params.password, user.passwordHash);
    if (!isPasswordValid) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= 5) {
        // Lockout for 15 minutes
        user.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
      user.updatedAt = utcNow();
      IdentityStore.saveUser(user);

      InMemoryAuditStore.record({
        actorId: user.userId,
        actorType: 'USER',
        action: 'AUTH_LOGIN_FAILED',
        resourceType: 'UserAccount',
        resourceId: user.userId,
        classification: 'CONFIDENTIAL',
        metadata: { attempts: user.failedLoginAttempts, ip: params.ipAddress }
      });

      throw new Error('AUTH_004: Invalid credentials provided.');
    }

    // Success: reset failed attempts
    user.failedLoginAttempts = 0;
    user.lockoutUntil = undefined;
    const now = utcNow();
    user.lastLoginAt = now;
    user.updatedAt = now;
    IdentityStore.saveUser(user);

    // Create session (30-day expiry)
    const sessionId = asSessionId(generateUUIDv7());
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const session: Session = {
      sessionId,
      userId: user.userId,
      createdAt: now,
      expiresAt,
      lastActivityAt: now,
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
      isCurrent: true
    };
    IdentityStore.saveSession(session);

    const profile = IdentityStore.findProfileByUserId(user.userId)!;

    InMemoryAuditStore.record({
      actorId: user.userId,
      actorType: 'USER',
      action: 'AUTH_LOGIN_SUCCESS',
      resourceType: 'Session',
      resourceId: sessionId,
      classification: 'CONFIDENTIAL',
      metadata: { ip: params.ipAddress }
    });

    const { passwordHash: _, ...safeUser } = user;
    return { session, user: safeUser, profile };
  }

  static logout(sessionId: SessionId, userId: UserId): { success: boolean } {
    const session = IdentityStore.findSessionById(sessionId);
    if (session && session.userId === userId) {
      IdentityStore.revokeSession(sessionId, utcNow());
      InMemoryAuditStore.record({
        actorId: userId,
        actorType: 'USER',
        action: 'AUTH_LOGOUT',
        resourceType: 'Session',
        resourceId: sessionId,
        classification: 'INTERNAL'
      });
    }
    return { success: true };
  }

  static logoutAllSessions(userId: UserId): { count: number } {
    const revokedCount = IdentityStore.revokeAllSessionsForUser(userId, utcNow());
    InMemoryAuditStore.record({
      actorId: userId,
      actorType: 'USER',
      action: 'AUTH_LOGOUT_ALL',
      resourceType: 'UserAccount',
      resourceId: userId,
      classification: 'CONFIDENTIAL',
      metadata: { revokedCount }
    });
    return { count: revokedCount };
  }

  // ==========================================
  // 4. PASSWORD RESET WORKFLOW
  // ==========================================

  static async requestPasswordReset(email: string, clientIp?: string): Promise<{ success: boolean; message: string; rawToken?: string }> {
    const rateKey = `reset:${email.toLowerCase().trim()}`;
    const rateCheck = RateLimiter.check(rateKey, RateLimiter.CONFIGS.PASSWORD_RESET);
    if (!rateCheck.allowed) {
      throw new Error(`RATE_LIMITED: Too many password reset requests. Retry in ${rateCheck.retryAfterSeconds}s`);
    }

    const user = IdentityStore.findUserByNormalizedEmail(email);
    // Anti-enumeration: always return generic success message
    if (!user || user.accountStatus === 'DELETED') {
      return { 
        success: true, 
        message: 'If an account exists with this email, password recovery instructions have been sent.' 
      };
    }

    // Invalidate existing reset tokens
    IdentityStore.invalidateUserPasswordResetTokens(user.userId);

    const rawToken = CryptoUtils.generateSecureToken(32);
    const tokenHash = await CryptoUtils.hashToken(rawToken);
    const now = utcNow();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    const resetTokenRecord: PasswordResetToken = {
      id: generateUUIDv7(),
      userId: user.userId,
      tokenHash,
      rawTokenForNotification: rawToken,
      createdAt: now,
      expiresAt,
      attemptCount: 0
    };
    IdentityStore.savePasswordResetToken(resetTokenRecord);

    await this.notificationService.sendPasswordReset({
      toEmail: user.email,
      token: rawToken,
      resetLink: `/auth/reset-password?token=${rawToken}`,
      expiresAt,
      sentAt: now
    });

    InMemoryAuditStore.record({
      actorId: user.userId,
      actorType: 'USER',
      action: 'PASSWORD_RESET_REQUESTED',
      resourceType: 'UserAccount',
      resourceId: user.userId,
      classification: 'CONFIDENTIAL'
    });

    return { 
      success: true, 
      message: 'If an account exists with this email, password recovery instructions have been sent.',
      rawToken // returned for testing/developer simulation
    };
  }

  static async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const passwordCheck = this.validatePasswordStrength(newPassword);
    if (!passwordCheck.valid) {
      throw new Error(`VALIDATION_001: ${passwordCheck.reason}`);
    }

    const tokenHash = await CryptoUtils.hashToken(token);
    const record = IdentityStore.findPasswordResetTokenByHash(tokenHash);

    if (!record) {
      throw new Error('AUTH_007: Password reset token is invalid or has expired.');
    }

    if (record.consumedAt) {
      throw new Error('AUTH_007: Password reset token has already been consumed.');
    }

    const now = utcNow();
    if (now > record.expiresAt) {
      throw new Error('AUTH_007: Password reset token has expired.');
    }

    const user = IdentityStore.findUserById(record.userId);
    if (!user) {
      throw new Error('AUTH_001: User not found.');
    }

    // Update password hash
    user.passwordHash = await CryptoUtils.hashPassword(newPassword);
    user.updatedAt = now;
    IdentityStore.saveUser(user);

    // Consume token
    record.consumedAt = now;
    IdentityStore.savePasswordResetToken(record);

    // Security invariant: Revoke all existing active sessions upon password reset
    const revokedSessions = IdentityStore.revokeAllSessionsForUser(user.userId, now);

    InMemoryAuditStore.record({
      actorId: user.userId,
      actorType: 'USER',
      action: 'PASSWORD_RESET_COMPLETED',
      resourceType: 'UserAccount',
      resourceId: user.userId,
      classification: 'CONFIDENTIAL',
      metadata: { revokedSessions }
    });

    return { success: true, message: 'Password has been reset successfully. Please log in with your new password.' };
  }

  // ==========================================
  // 5. PROFILE & ACCOUNT LIFECYCLE
  // ==========================================

  static updateProfile(userId: UserId, updates: Partial<UserProfile>): UserProfile {
    const profile = IdentityStore.findProfileByUserId(userId);
    if (!profile) {
      throw new Error('AUTH_001: Profile not found.');
    }

    if (updates.displayName !== undefined) profile.displayName = updates.displayName.trim();
    if (updates.firstName !== undefined) profile.firstName = updates.firstName.trim();
    if (updates.lastName !== undefined) profile.lastName = updates.lastName.trim();
    if (updates.avatarUrl !== undefined) profile.avatarUrl = updates.avatarUrl;
    if (updates.locale !== undefined) profile.locale = updates.locale;
    if (updates.timezone !== undefined) profile.timezone = updates.timezone;
    if (updates.communicationPreferences) {
      profile.communicationPreferences = { ...profile.communicationPreferences, ...updates.communicationPreferences };
    }
    if (updates.privacyPreferences) {
      profile.privacyPreferences = { ...profile.privacyPreferences, ...updates.privacyPreferences };
    }

    profile.updatedAt = utcNow();
    IdentityStore.saveProfile(profile);

    InMemoryAuditStore.record({
      actorId: userId,
      actorType: 'USER',
      action: 'USER_PROFILE_UPDATED',
      resourceType: 'UserProfile',
      resourceId: userId,
      classification: 'INTERNAL'
    });

    return profile;
  }

  static deactivateAccount(userId: UserId): { success: boolean; message: string } {
    const user = IdentityStore.findUserById(userId);
    if (!user) throw new Error('AUTH_001: User not found.');

    const now = utcNow();
    user.accountStatus = 'DEACTIVATED';
    user.deactivatedAt = now;
    user.updatedAt = now;
    IdentityStore.saveUser(user);

    // Revoke all sessions
    IdentityStore.revokeAllSessionsForUser(userId, now);

    InMemoryAuditStore.record({
      actorId: userId,
      actorType: 'USER',
      action: 'ACCOUNT_DEACTIVATED',
      resourceType: 'UserAccount',
      resourceId: userId,
      classification: 'CONFIDENTIAL'
    });

    return { success: true, message: 'Account deactivated successfully.' };
  }

  static requestAccountDeletion(userId: UserId): { success: boolean; scheduledDeletionDate: string } {
    const user = IdentityStore.findUserById(userId);
    if (!user) throw new Error('AUTH_001: User not found.');

    const now = utcNow();
    // 30-day retention window for legal/audit consistency
    const scheduled = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    user.accountStatus = 'DELETION_PENDING';
    user.deletionScheduledFor = scheduled;
    user.updatedAt = now;
    IdentityStore.saveUser(user);

    IdentityStore.revokeAllSessionsForUser(userId, now);

    InMemoryAuditStore.record({
      actorId: userId,
      actorType: 'USER',
      action: 'ACCOUNT_DELETION_REQUESTED',
      resourceType: 'UserAccount',
      resourceId: userId,
      classification: 'CONFIDENTIAL',
      metadata: { scheduledDeletionDate: scheduled }
    });

    return { success: true, scheduledDeletionDate: scheduled };
  }

  // ==========================================
  // 6. HOUSEHOLD DOMAIN & GOVERNANCE
  // ==========================================

  static createHousehold(ownerUserId: UserId, name: string): { household: Household; membership: HouseholdMember } {
    const user = IdentityStore.findUserById(ownerUserId);
    if (!user) throw new Error('AUTH_001: Authenticated user not found.');

    if (user.accountStatus !== 'ACTIVE') {
      throw new Error('AUTH_006: Verified active account required to create a household.');
    }

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      throw new Error('VALIDATION_001: Household name must be at least 2 characters long.');
    }

    const householdId = asHouseholdId(generateUUIDv7());
    const membershipId = asMembershipId(generateUUIDv7());
    const now = utcNow();

    // Create household entity
    const household: Household = {
      householdId,
      name: trimmedName,
      status: 'ACTIVE',
      ownerUserId,
      createdAt: now,
      updatedAt: now
    };

    // Create atomic owner membership
    const membership: HouseholdMember = {
      membershipId,
      householdId,
      userId: ownerUserId,
      role: 'HOUSEHOLD_OWNER',
      status: 'ACTIVE',
      joinedAt: now,
      updatedAt: now
    };

    // Atomic persistence
    IdentityStore.saveHousehold(household);
    IdentityStore.saveMembership(membership);

    InMemoryAuditStore.record({
      actorId: ownerUserId,
      actorType: 'USER',
      action: 'HOUSEHOLD_CREATED',
      resourceType: 'Household',
      resourceId: householdId,
      classification: 'INTERNAL',
      metadata: { name: household.name, ownerUserId }
    });

    return { household, membership };
  }

  static updateHousehold(actorUserId: UserId, householdId: HouseholdId, name: string): Household {
    const auth = AuthorizationService.checkHouseholdPermission(actorUserId, householdId, 'household.update');
    if (!auth.allowed) {
      throw new Error(`${auth.reasonCode}: ${auth.message}`);
    }

    const household = IdentityStore.findHouseholdById(householdId);
    if (!household || household.status !== 'ACTIVE') {
      throw new Error('AUTH_002: Household not found or archived.');
    }

    household.name = name.trim();
    household.updatedAt = utcNow();
    IdentityStore.saveHousehold(household);

    InMemoryAuditStore.record({
      actorId: actorUserId,
      actorType: 'USER',
      action: 'HOUSEHOLD_UPDATED',
      resourceType: 'Household',
      resourceId: householdId,
      classification: 'INTERNAL',
      metadata: { name: household.name }
    });

    return household;
  }

  static archiveHousehold(actorUserId: UserId, householdId: HouseholdId): Household {
    const auth = AuthorizationService.checkHouseholdPermission(actorUserId, householdId, 'household.archive');
    if (!auth.allowed) {
      throw new Error(`${auth.reasonCode}: ${auth.message}`);
    }

    const household = IdentityStore.findHouseholdById(householdId);
    if (!household) throw new Error('AUTH_002: Household not found.');

    const now = utcNow();
    household.status = 'ARCHIVED';
    household.archivedAt = now;
    household.updatedAt = now;
    IdentityStore.saveHousehold(household);

    InMemoryAuditStore.record({
      actorId: actorUserId,
      actorType: 'USER',
      action: 'HOUSEHOLD_ARCHIVED',
      resourceType: 'Household',
      resourceId: householdId,
      classification: 'CONFIDENTIAL'
    });

    return household;
  }

  // ==========================================
  // 7. INVITATION LIFECYCLE
  // ==========================================

  static async inviteMember(params: {
    inviterUserId: UserId;
    householdId: HouseholdId;
    inviteeEmail: string;
    intendedRole: HouseholdRole;
    durationDays?: number; // for TEMPORARY_CAREGIVER
  }): Promise<{ invitation: HouseholdInvitation; rawToken: string }> {
    const auth = AuthorizationService.checkHouseholdPermission(
      params.inviterUserId, 
      params.householdId, 
      'household.members.invite'
    );
    if (!auth.allowed) {
      throw new Error(`${auth.reasonCode}: ${auth.message}`);
    }

    if (!this.validateEmail(params.inviteeEmail)) {
      throw new Error('VALIDATION_001: Invalid email address format.');
    }

    const normalizedEmail = params.inviteeEmail.toLowerCase().trim();

    // Check rate limit on invitation creation
    const rateKey = `invite:${params.householdId}`;
    const rateCheck = RateLimiter.check(rateKey, RateLimiter.CONFIGS.INVITE_CREATE);
    if (!rateCheck.allowed) {
      throw new Error(`RATE_LIMITED: Invitation limit exceeded. Retry in ${rateCheck.retryAfterSeconds}s`);
    }

    // Check if invitee is already an active member
    const existingUser = IdentityStore.findUserByNormalizedEmail(normalizedEmail);
    if (existingUser) {
      const existingMember = IdentityStore.findMembership(params.householdId, existingUser.userId);
      if (existingMember && existingMember.status === 'ACTIVE') {
        throw new Error('AUTH_008: User is already an active member of this household.');
      }
    }

    const household = IdentityStore.findHouseholdById(params.householdId);
    if (!household || household.status !== 'ACTIVE') {
      throw new Error('AUTH_002: Household not found or inactive.');
    }

    const inviterProfile = IdentityStore.findProfileByUserId(params.inviterUserId);
    const rawToken = CryptoUtils.generateSecureToken(32);
    const tokenHash = await CryptoUtils.hashToken(rawToken);
    const now = utcNow();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7-day expiry

    const invitation: HouseholdInvitation = {
      invitationId: asInvitationId(generateUUIDv7()),
      householdId: params.householdId,
      inviterUserId: params.inviterUserId,
      inviteeEmail: normalizedEmail,
      intendedRole: params.intendedRole,
      tokenHash,
      rawTokenForNotification: rawToken,
      status: 'PENDING',
      createdAt: now,
      expiresAt,
      temporaryAccessDurationDays: params.durationDays
    };

    IdentityStore.saveInvitation(invitation);

    await this.notificationService.sendHouseholdInvitation({
      toEmail: normalizedEmail,
      inviterName: inviterProfile?.displayName || 'Household Member',
      householdName: household.name,
      role: params.intendedRole,
      token: rawToken,
      invitationLink: `/households/invitations/accept?token=${rawToken}`,
      expiresAt,
      sentAt: now
    });

    InMemoryAuditStore.record({
      actorId: params.inviterUserId,
      actorType: 'USER',
      action: 'HOUSEHOLD_INVITATION_ISSUED',
      resourceType: 'HouseholdInvitation',
      resourceId: invitation.invitationId,
      classification: 'INTERNAL',
      metadata: { householdId: params.householdId, inviteeEmail: normalizedEmail, role: params.intendedRole }
    });

    return { invitation, rawToken };
  }

  static async acceptInvitation(token: string, acceptingUserId: UserId): Promise<{ membership: HouseholdMember; household: Household }> {
    const tokenHash = await CryptoUtils.hashToken(token);
    const invitation = IdentityStore.findInvitationByTokenHash(tokenHash);

    if (!invitation) {
      throw new Error('AUTH_010: Household invitation is invalid or does not exist.');
    }

    if (invitation.status !== 'PENDING') {
      throw new Error(`AUTH_010: Invitation cannot be accepted because it is ${invitation.status}.`);
    }

    const now = utcNow();
    if (now > invitation.expiresAt) {
      invitation.status = 'EXPIRED';
      IdentityStore.saveInvitation(invitation);
      throw new Error('AUTH_010: Invitation has expired.');
    }

    const acceptingUser = IdentityStore.findUserById(acceptingUserId);
    if (!acceptingUser) throw new Error('AUTH_001: Authenticated user not found.');

    const household = IdentityStore.findHouseholdById(invitation.householdId);
    if (!household || household.status !== 'ACTIVE') {
      throw new Error('AUTH_002: Household is no longer active.');
    }

    // Check duplicate membership
    const existingMember = IdentityStore.findMembership(invitation.householdId, acceptingUserId);
    if (existingMember && existingMember.status === 'ACTIVE') {
      throw new Error('AUTH_008: You are already an active member of this household.');
    }

    // Calculate temporary caregiver expiration if applicable
    let expiresAt: string | undefined;
    if (invitation.intendedRole === 'TEMPORARY_CAREGIVER' && invitation.temporaryAccessDurationDays) {
      expiresAt = new Date(Date.now() + invitation.temporaryAccessDurationDays * 24 * 60 * 60 * 1000).toISOString();
    }

    // Atomic membership creation
    const membership: HouseholdMember = {
      membershipId: asMembershipId(generateUUIDv7()),
      householdId: invitation.householdId,
      userId: acceptingUserId,
      role: invitation.intendedRole,
      status: 'ACTIVE',
      joinedAt: now,
      invitedBy: invitation.inviterUserId,
      expiresAt,
      updatedAt: now
    };

    IdentityStore.saveMembership(membership);

    // Mark invitation accepted
    invitation.status = 'ACCEPTED';
    invitation.respondedAt = now;
    IdentityStore.saveInvitation(invitation);

    InMemoryAuditStore.record({
      actorId: acceptingUserId,
      actorType: 'USER',
      action: 'HOUSEHOLD_INVITATION_ACCEPTED',
      resourceType: 'HouseholdMember',
      resourceId: membership.membershipId,
      classification: 'INTERNAL',
      metadata: { householdId: invitation.householdId, role: membership.role }
    });

    return { membership, household };
  }

  static async declineInvitation(token: string): Promise<{ success: boolean; message: string }> {
    const tokenHash = await CryptoUtils.hashToken(token);
    const invitation = IdentityStore.findInvitationByTokenHash(tokenHash);

    if (!invitation || invitation.status !== 'PENDING') {
      throw new Error('AUTH_010: Invitation is invalid or no longer pending.');
    }

    invitation.status = 'DECLINED';
    invitation.respondedAt = utcNow();
    IdentityStore.saveInvitation(invitation);

    InMemoryAuditStore.record({
      actorId: 'ANONYMOUS',
      actorType: 'USER',
      action: 'HOUSEHOLD_INVITATION_DECLINED',
      resourceType: 'HouseholdInvitation',
      resourceId: invitation.invitationId,
      classification: 'INTERNAL',
      metadata: { householdId: invitation.householdId }
    });

    return { success: true, message: 'Invitation declined.' };
  }

  static revokeInvitation(actorUserId: UserId, invitationId: InvitationId): HouseholdInvitation {
    const invitation = IdentityStore.findInvitationById(invitationId);
    if (!invitation) throw new Error('AUTH_010: Invitation not found.');

    const auth = AuthorizationService.checkHouseholdPermission(actorUserId, invitation.householdId, 'household.members.invite');
    if (!auth.allowed) {
      throw new Error(`${auth.reasonCode}: ${auth.message}`);
    }

    invitation.status = 'REVOKED';
    invitation.respondedAt = utcNow();
    IdentityStore.saveInvitation(invitation);

    InMemoryAuditStore.record({
      actorId: actorUserId,
      actorType: 'USER',
      action: 'HOUSEHOLD_INVITATION_REVOKED',
      resourceType: 'HouseholdInvitation',
      resourceId: invitationId,
      classification: 'INTERNAL',
      metadata: { householdId: invitation.householdId }
    });

    return invitation;
  }

  // ==========================================
  // 8. MEMBERSHIP OPERATIONS & FINAL OWNER PROTECTION
  // ==========================================

  static changeMemberRole(params: {
    actorUserId: UserId;
    householdId: HouseholdId;
    targetUserId: UserId;
    newRole: HouseholdRole;
  }): HouseholdMember {
    const auth = AuthorizationService.checkHouseholdPermission(
      params.actorUserId, 
      params.householdId, 
      'household.members.role_change',
      params.targetUserId
    );
    if (!auth.allowed) {
      throw new Error(`${auth.reasonCode}: ${auth.message}`);
    }

    const member = IdentityStore.findMembership(params.householdId, params.targetUserId);
    if (!member) throw new Error('AUTH_002: Member not found in this household.');

    // Final Owner Protection Invariant (Volume IV):
    // If the member is currently the sole active OWNER and their role is changed to non-owner, block it!
    if (member.role === 'HOUSEHOLD_OWNER' && params.newRole !== 'HOUSEHOLD_OWNER') {
      const activeOwners = IdentityStore.countActiveOwners(params.householdId);
      if (activeOwners <= 1) {
        throw new Error('AUTH_009: Cannot demote the sole active owner of a household. Transfer ownership first.');
      }
    }

    member.role = params.newRole;
    member.updatedAt = utcNow();
    IdentityStore.saveMembership(member);

    InMemoryAuditStore.record({
      actorId: params.actorUserId,
      actorType: 'USER',
      action: 'HOUSEHOLD_ROLE_CHANGED',
      resourceType: 'HouseholdMember',
      resourceId: member.membershipId,
      classification: 'INTERNAL',
      metadata: { householdId: params.householdId, targetUserId: params.targetUserId, newRole: params.newRole }
    });

    return member;
  }

  static removeMember(actorUserId: UserId, householdId: HouseholdId, targetUserId: UserId): { success: boolean; message: string } {
    const auth = AuthorizationService.checkHouseholdPermission(
      actorUserId, 
      householdId, 
      'household.members.remove',
      targetUserId
    );
    if (!auth.allowed) {
      throw new Error(`${auth.reasonCode}: ${auth.message}`);
    }

    const member = IdentityStore.findMembership(householdId, targetUserId);
    if (!member) throw new Error('AUTH_002: Member not found.');

    // Final Owner Protection
    if (member.role === 'HOUSEHOLD_OWNER') {
      const activeOwners = IdentityStore.countActiveOwners(householdId);
      if (activeOwners <= 1) {
        throw new Error('AUTH_009: Cannot remove the sole active owner of a household. Transfer ownership or archive household.');
      }
    }

    const now = utcNow();
    member.status = 'REMOVED';
    member.removedAt = now;
    member.updatedAt = now;
    IdentityStore.saveMembership(member);

    InMemoryAuditStore.record({
      actorId: actorUserId,
      actorType: 'USER',
      action: 'HOUSEHOLD_MEMBER_REMOVED',
      resourceType: 'HouseholdMember',
      resourceId: member.membershipId,
      classification: 'INTERNAL',
      metadata: { householdId, targetUserId }
    });

    return { success: true, message: 'Member removed successfully.' };
  }

  static leaveHousehold(userId: UserId, householdId: HouseholdId): { success: boolean; message: string } {
    const member = IdentityStore.findMembership(householdId, userId);
    if (!member) throw new Error('AUTH_002: You are not a member of this household.');

    // Final Owner Protection
    if (member.role === 'HOUSEHOLD_OWNER') {
      const activeOwners = IdentityStore.countActiveOwners(householdId);
      if (activeOwners <= 1) {
        throw new Error('AUTH_009: You cannot leave the household because you are the sole active owner. Transfer ownership or archive first.');
      }
    }

    const now = utcNow();
    member.status = 'REMOVED';
    member.removedAt = now;
    member.updatedAt = now;
    IdentityStore.saveMembership(member);

    InMemoryAuditStore.record({
      actorId: userId,
      actorType: 'USER',
      action: 'HOUSEHOLD_MEMBER_LEFT',
      resourceType: 'HouseholdMember',
      resourceId: member.membershipId,
      classification: 'INTERNAL',
      metadata: { householdId, userId }
    });

    return { success: true, message: 'You have left the household.' };
  }
}
