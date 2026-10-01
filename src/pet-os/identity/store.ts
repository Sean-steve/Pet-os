/**
 * Pet OS Sprint 2 - Identity & Household Data Store
 * Implements Volume XXX (Database Schema & Technical Data Dictionary) & Volume XXXI:
 * Structured in-memory repository modeling canonical SQL relations, constraints, and indexes.
 */

import { 
  UserAccount, 
  UserProfile, 
  Session, 
  VerificationToken, 
  PasswordResetToken, 
  Household, 
  HouseholdMember, 
  HouseholdInvitation 
} from './types';
import { UserId, HouseholdId, SessionId, InvitationId, MembershipId } from '../kernel/ids';

export class IdentityStore {
  private static users = new Map<UserId, UserAccount>();
  private static userProfiles = new Map<UserId, UserProfile>();
  private static sessions = new Map<SessionId, Session>();
  private static verificationTokens = new Map<string, VerificationToken>();
  private static passwordResetTokens = new Map<string, PasswordResetToken>();
  private static households = new Map<HouseholdId, Household>();
  private static householdMembers = new Map<MembershipId, HouseholdMember>();
  private static householdInvitations = new Map<InvitationId, HouseholdInvitation>();

  // Secondary index lookups
  private static emailToUserId = new Map<string, UserId>();

  // User methods
  static saveUser(user: UserAccount): void {
    this.users.set(user.userId, { ...user });
    this.emailToUserId.set(user.normalizedEmail, user.userId);
  }

  static findUserById(userId: UserId): UserAccount | undefined {
    const u = this.users.get(userId);
    return u ? { ...u } : undefined;
  }

  static findUserByNormalizedEmail(email: string): UserAccount | undefined {
    const userId = this.emailToUserId.get(email.toLowerCase().trim());
    if (!userId) return undefined;
    return this.findUserById(userId);
  }

  static listAllUsers(): UserAccount[] {
    return Array.from(this.users.values()).map(u => ({ ...u }));
  }

  // Profile methods
  static saveProfile(profile: UserProfile): void {
    this.userProfiles.set(profile.userId, { ...profile });
  }

  static findProfileByUserId(userId: UserId): UserProfile | undefined {
    const p = this.userProfiles.get(userId);
    return p ? { ...p } : undefined;
  }

  // Session methods
  static saveSession(session: Session): void {
    this.sessions.set(session.sessionId, { ...session });
  }

  static findSessionById(sessionId: SessionId): Session | undefined {
    const s = this.sessions.get(sessionId);
    return s ? { ...s } : undefined;
  }

  static listActiveSessionsForUser(userId: UserId): Session[] {
    const now = new Date().toISOString();
    return Array.from(this.sessions.values())
      .filter(s => s.userId === userId && !s.revokedAt && s.expiresAt > now)
      .map(s => ({ ...s }));
  }

  static revokeSession(sessionId: SessionId, revokedAt: string): void {
    const s = this.sessions.get(sessionId);
    if (s) {
      s.revokedAt = revokedAt;
      this.sessions.set(sessionId, s);
    }
  }

  static revokeAllSessionsForUser(userId: UserId, revokedAt: string): number {
    let count = 0;
    for (const [id, s] of this.sessions.entries()) {
      if (s.userId === userId && !s.revokedAt) {
        s.revokedAt = revokedAt;
        this.sessions.set(id, s);
        count++;
      }
    }
    return count;
  }

  // Verification Token methods
  static saveVerificationToken(token: VerificationToken): void {
    this.verificationTokens.set(token.id, { ...token });
  }

  static findVerificationTokenByHash(tokenHash: string): VerificationToken | undefined {
    return Array.from(this.verificationTokens.values()).find(t => t.tokenHash === tokenHash);
  }

  static invalidateUserVerificationTokens(userId: UserId): void {
    for (const [id, t] of this.verificationTokens.entries()) {
      if (t.userId === userId && !t.consumedAt) {
        t.consumedAt = new Date().toISOString();
        this.verificationTokens.set(id, t);
      }
    }
  }

  // Password Reset Token methods
  static savePasswordResetToken(token: PasswordResetToken): void {
    this.passwordResetTokens.set(token.id, { ...token });
  }

  static findPasswordResetTokenByHash(tokenHash: string): PasswordResetToken | undefined {
    return Array.from(this.passwordResetTokens.values()).find(t => t.tokenHash === tokenHash);
  }

  static invalidateUserPasswordResetTokens(userId: UserId): void {
    for (const [id, t] of this.passwordResetTokens.entries()) {
      if (t.userId === userId && !t.consumedAt) {
        t.consumedAt = new Date().toISOString();
        this.passwordResetTokens.set(id, t);
      }
    }
  }

  // Household methods
  static saveHousehold(household: Household): void {
    this.households.set(household.householdId, { ...household });
  }

  static findHouseholdById(householdId: HouseholdId): Household | undefined {
    const h = this.households.get(householdId);
    return h ? { ...h } : undefined;
  }

  static listHouseholdsForUser(userId: UserId): Household[] {
    const activeMemberships = Array.from(this.householdMembers.values()).filter(
      m => m.userId === userId && m.status === 'ACTIVE'
    );
    const householdIds = new Set(activeMemberships.map(m => m.householdId));
    return Array.from(this.households.values())
      .filter(h => householdIds.has(h.householdId) && h.status === 'ACTIVE')
      .map(h => ({ ...h }));
  }

  static listAllHouseholds(): Household[] {
    return Array.from(this.households.values()).map(h => ({ ...h }));
  }

  // Membership methods
  static saveMembership(member: HouseholdMember): void {
    this.householdMembers.set(member.membershipId, { ...member });
  }

  static findMembership(householdId: HouseholdId, userId: UserId): HouseholdMember | undefined {
    return Array.from(this.householdMembers.values()).find(
      m => m.householdId === householdId && m.userId === userId && m.status === 'ACTIVE'
    );
  }

  static listMembersForHousehold(householdId: HouseholdId): HouseholdMember[] {
    return Array.from(this.householdMembers.values())
      .filter(m => m.householdId === householdId && m.status === 'ACTIVE')
      .map(m => ({ ...m }));
  }

  static countActiveOwners(householdId: HouseholdId): number {
    return Array.from(this.householdMembers.values()).filter(
      m => m.householdId === householdId && m.role === 'HOUSEHOLD_OWNER' && m.status === 'ACTIVE'
    ).length;
  }

  // Invitation methods
  static saveInvitation(invitation: HouseholdInvitation): void {
    this.householdInvitations.set(invitation.invitationId, { ...invitation });
  }

  static findInvitationById(invitationId: InvitationId): HouseholdInvitation | undefined {
    const inv = this.householdInvitations.get(invitationId);
    return inv ? { ...inv } : undefined;
  }

  static findInvitationByTokenHash(tokenHash: string): HouseholdInvitation | undefined {
    return Array.from(this.householdInvitations.values()).find(inv => inv.tokenHash === tokenHash);
  }

  static listInvitationsForHousehold(householdId: HouseholdId): HouseholdInvitation[] {
    return Array.from(this.householdInvitations.values())
      .filter(inv => inv.householdId === householdId)
      .map(inv => ({ ...inv }));
  }

  static listPendingInvitationsForEmail(email: string): HouseholdInvitation[] {
    const normalized = email.toLowerCase().trim();
    const now = new Date().toISOString();
    return Array.from(this.householdInvitations.values())
      .filter(inv => inv.inviteeEmail.toLowerCase().trim() === normalized && inv.status === 'PENDING' && inv.expiresAt > now)
      .map(inv => ({ ...inv }));
  }

  // Reset/Clear for testing
  static clear(): void {
    this.users.clear();
    this.userProfiles.clear();
    this.sessions.clear();
    this.verificationTokens.clear();
    this.passwordResetTokens.clear();
    this.households.clear();
    this.householdMembers.clear();
    this.householdInvitations.clear();
    this.emailToUserId.clear();
  }

  static reset(): void {
    this.clear();
  }
}
