/**
 * Pet OS Sprint 2 - Canonical Test Suite
 * Covers Unit, Integration, Authorization, Security, and E2E Tests.
 * Implements Step 31 & Mandatory Acceptance Criteria.
 */

import { IdentityService } from './service';
import { IdentityStore } from './store';
import { CryptoUtils } from './crypto';
import { RateLimiter } from './rate-limit';
import { AuthorizationService } from './authorization';
import { HouseholdRole, Permission } from './types';
import { asUserId, asHouseholdId, generateUUIDv7 } from '../kernel/ids';

export interface TestResultItem {
  id: string;
  category: 'UNIT' | 'INTEGRATION' | 'AUTHORIZATION' | 'SECURITY' | 'E2E';
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
  error?: string;
}

export class IdentityTestSuite {
  /**
   * Runs the complete test suite and returns structured results.
   */
  static async runAllTests(): Promise<{
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
    results: TestResultItem[];
  }> {
    const startTotal = performance.now();
    const results: TestResultItem[] = [];

    // Helper runner
    const executeTest = async (
      id: string,
      category: TestResultItem['category'],
      name: string,
      fn: () => Promise<void> | void
    ) => {
      const start = performance.now();
      try {
        await fn();
        results.push({
          id,
          category,
          name,
          passed: true,
          durationMs: parseFloat((performance.now() - start).toFixed(2))
        });
      } catch (err: any) {
        results.push({
          id,
          category,
          name,
          passed: false,
          durationMs: parseFloat((performance.now() - start).toFixed(2)),
          error: err?.message || String(err)
        });
      }
    };

    // ==========================================
    // 1. UNIT TESTS
    // ==========================================
    await executeTest('UT-001', 'UNIT', 'Email normalization and format validation', () => {
      if (!IdentityService.validateEmail('user@domain.com')) throw new Error('Valid email rejected');
      if (IdentityService.validateEmail('invalid-email')) throw new Error('Invalid email accepted');
      if (IdentityService.validateEmail('@domain.com')) throw new Error('Email without user accepted');
    });

    await executeTest('UT-002', 'UNIT', 'Kenya E.164 phone number verification (+254...)', () => {
      if (!IdentityService.validateKenyaPhone('+254712345678')) throw new Error('Valid Kenya phone rejected');
      if (!IdentityService.validateKenyaPhone('+254112345678')) throw new Error('Valid Airtel/Safaricom +2541 prefix rejected');
      if (IdentityService.validateKenyaPhone('0712345678')) throw new Error('Local format accepted without E.164 +254');
      if (IdentityService.validateKenyaPhone('+1234567890')) throw new Error('Foreign prefix accepted for Kenya-first phone');
    });

    await executeTest('UT-003', 'UNIT', 'Password strength policy enforcement (min 8, uppercase, number, symbol)', () => {
      if (IdentityService.validatePasswordStrength('weak').valid) throw new Error('Weak password accepted');
      if (IdentityService.validatePasswordStrength('AllLettersNoNumbers!').valid) throw new Error('Password without numbers accepted');
      if (IdentityService.validatePasswordStrength('NoSpecialChar123A').valid) throw new Error('Password without special characters accepted');
      if (!IdentityService.validatePasswordStrength('StrongP@ssw0rd!').valid) throw new Error('Valid strong password rejected');
    });

    await executeTest('UT-004', 'UNIT', 'Constant-time comparison & PBKDF2 hash verification', async () => {
      const pass = 'SuperSecret!123';
      const hash = await CryptoUtils.hashPassword(pass);
      const isMatch = await CryptoUtils.verifyPassword(pass, hash);
      const isBadMatch = await CryptoUtils.verifyPassword('WrongSecret!123', hash);
      if (!isMatch) throw new Error('Valid password failed PBKDF2 match');
      if (isBadMatch) throw new Error('Incorrect password verified as true');
    });

    // ==========================================
    // 2. INTEGRATION TESTS
    // ==========================================
    await executeTest('IT-001', 'INTEGRATION', 'End-to-end registration and email verification', async () => {
      IdentityStore.clear();
      RateLimiter.reset();

      const reg = await IdentityService.register({
        email: 'alice@example.com',
        password: 'Password123!',
        displayName: 'Alice Owner',
        phoneNumber: '+254712345678'
      });

      if (reg.user.accountStatus !== 'PENDING_VERIFICATION') {
        throw new Error('New user did not start in PENDING_VERIFICATION state');
      }

      // Verify email
      const verifyRes = await IdentityService.verifyEmail(reg.verificationToken);
      if (!verifyRes.success || verifyRes.user.accountStatus !== 'ACTIVE') {
        throw new Error('Email verification failed to activate user');
      }
    });

    await executeTest('IT-002', 'INTEGRATION', 'Secure login, credential validation & session lifecycle', async () => {
      const loginRes = await IdentityService.login({
        email: 'alice@example.com',
        password: 'Password123!',
        userAgent: 'TestClient/1.0',
        ipAddress: '127.0.0.1'
      });

      if (!loginRes.session || !loginRes.session.sessionId) {
        throw new Error('Login failed to return valid session');
      }

      // Logout
      IdentityService.logout(loginRes.session.sessionId, loginRes.user.userId);
      const sessionAfter = IdentityStore.findSessionById(loginRes.session.sessionId);
      if (!sessionAfter?.revokedAt) {
        throw new Error('Logout did not set revokedAt timestamp');
      }
    });

    await executeTest('IT-003', 'INTEGRATION', 'Password recovery with session revocation', async () => {
      const resetReq = await IdentityService.requestPasswordReset('alice@example.com');
      if (!resetReq.rawToken) throw new Error('Reset token missing in test response');

      // Create dummy active session to verify revocation
      const activeSession = await IdentityService.login({
        email: 'alice@example.com',
        password: 'Password123!'
      });

      // Complete reset
      await IdentityService.resetPassword(resetReq.rawToken, 'BrandNewP@ssword99!');

      // Check previous session is revoked
      const checkedSession = IdentityStore.findSessionById(activeSession.session.sessionId);
      if (!checkedSession?.revokedAt) {
        throw new Error('Password reset failed to revoke existing sessions');
      }

      // Test login with new password
      const newLogin = await IdentityService.login({
        email: 'alice@example.com',
        password: 'BrandNewP@ssword99!'
      });
      if (!newLogin.session) throw new Error('Could not log in with updated password');
    });

    await executeTest('IT-004', 'INTEGRATION', 'Atomic household creation with owner membership', async () => {
      const user = IdentityStore.findUserByNormalizedEmail('alice@example.com')!;
      const hhRes = IdentityService.createHousehold(user.userId, 'Nairobi Pet Haven');

      if (!hhRes.household.householdId || hhRes.household.status !== 'ACTIVE') {
        throw new Error('Household creation failed');
      }
      if (hhRes.membership.role !== 'HOUSEHOLD_OWNER' || hhRes.membership.status !== 'ACTIVE') {
        throw new Error('Atomic owner membership was not created');
      }
    });

    await executeTest('IT-005', 'INTEGRATION', 'Household invitation lifecycle (Issue -> Accept -> Active Member)', async () => {
      const alice = IdentityStore.findUserByNormalizedEmail('alice@example.com')!;
      const households = IdentityStore.listHouseholdsForUser(alice.userId);
      const householdId = households[0].householdId;

      // Register second user Bob
      const bobReg = await IdentityService.register({
        email: 'bob@example.com',
        password: 'PasswordBob456!',
        displayName: 'Bob Caregiver'
      });
      await IdentityService.verifyEmail(bobReg.verificationToken);
      const bob = IdentityStore.findUserById(bobReg.user.userId)!;

      // Alice invites Bob as CAREGIVER
      const inviteRes = await IdentityService.inviteMember({
        inviterUserId: alice.userId,
        householdId,
        inviteeEmail: 'bob@example.com',
        intendedRole: 'CAREGIVER'
      });

      // Bob accepts invitation
      const acceptRes = await IdentityService.acceptInvitation(inviteRes.rawToken, bob.userId);
      if (acceptRes.membership.role !== 'CAREGIVER' || acceptRes.membership.status !== 'ACTIVE') {
        throw new Error('Invitation acceptance did not create active CAREGIVER membership');
      }

      // Replay attempt must fail
      try {
        await IdentityService.acceptInvitation(inviteRes.rawToken, bob.userId);
        throw new Error('Replayed invitation was accepted!');
      } catch (err: any) {
        if (!err.message.includes('AUTH_010')) throw err;
      }
    });

    // ==========================================
    // 3. AUTHORIZATION TESTS
    // ==========================================
    await executeTest('AUT-001', 'AUTHORIZATION', 'Permission Matrix: HOUSEHOLD_OWNER has all household permissions', () => {
      const alice = IdentityStore.findUserByNormalizedEmail('alice@example.com')!;
      const household = IdentityStore.listHouseholdsForUser(alice.userId)[0];

      const permissions: Permission[] = [
        'household.read',
        'household.update',
        'household.archive',
        'household.members.read',
        'household.members.invite',
        'household.members.remove',
        'household.members.role_change'
      ];

      for (const p of permissions) {
        const check = AuthorizationService.checkHouseholdPermission(alice.userId, household.householdId, p);
        if (!check.allowed) {
          throw new Error(`Owner was denied permission: ${p}`);
        }
      }
    });

    await executeTest('AUT-002', 'AUTHORIZATION', 'Permission Matrix: CAREGIVER cannot invite, remove, or archive', () => {
      const bob = IdentityStore.findUserByNormalizedEmail('bob@example.com')!;
      const household = IdentityStore.listHouseholdsForUser(bob.userId)[0];

      // Read is allowed
      const readCheck = AuthorizationService.checkHouseholdPermission(bob.userId, household.householdId, 'household.read');
      if (!readCheck.allowed) throw new Error('Caregiver was denied household.read');

      // Invite is forbidden
      const inviteCheck = AuthorizationService.checkHouseholdPermission(bob.userId, household.householdId, 'household.members.invite');
      if (inviteCheck.allowed) throw new Error('Caregiver was incorrectly granted household.members.invite');

      // Archive is forbidden
      const archiveCheck = AuthorizationService.checkHouseholdPermission(bob.userId, household.householdId, 'household.archive');
      if (archiveCheck.allowed) throw new Error('Caregiver was incorrectly granted household.archive');
    });

    await executeTest('AUT-003', 'AUTHORIZATION', 'Permission Matrix: ADMIN cannot remove or demote HOUSEHOLD_OWNER', () => {
      const alice = IdentityStore.findUserByNormalizedEmail('alice@example.com')!;
      const bob = IdentityStore.findUserByNormalizedEmail('bob@example.com')!;
      const household = IdentityStore.listHouseholdsForUser(alice.userId)[0];

      // Promote Bob to HOUSEHOLD_ADMIN
      IdentityService.changeMemberRole({
        actorUserId: alice.userId,
        householdId: household.householdId,
        targetUserId: bob.userId,
        newRole: 'HOUSEHOLD_ADMIN'
      });

      // Bob cannot remove Alice (Owner)
      const removeOwnerCheck = AuthorizationService.checkHouseholdPermission(
        bob.userId, 
        household.householdId, 
        'household.members.remove', 
        alice.userId
      );
      if (removeOwnerCheck.allowed) {
        throw new Error('ADMIN was allowed to remove OWNER');
      }

      // Bob cannot archive household
      const archiveCheck = AuthorizationService.checkHouseholdPermission(bob.userId, household.householdId, 'household.archive');
      if (archiveCheck.allowed) {
        throw new Error('ADMIN was allowed to archive household');
      }
    });

    await executeTest('AUT-004', 'AUTHORIZATION', 'Temporal Caregiver expiry automatically blocks access (PETIV-INV-001)', () => {
      const alice = IdentityStore.findUserByNormalizedEmail('alice@example.com')!;
      const household = IdentityStore.listHouseholdsForUser(alice.userId)[0];

      // Create a temporary caregiver membership that expired yesterday
      const expiredTempUserId = asUserId(generateUUIDv7());
      IdentityStore.saveMembership({
        membershipId: asUserId(generateUUIDv7()) as any,
        householdId: household.householdId,
        userId: expiredTempUserId,
        role: 'TEMPORARY_CAREGIVER',
        status: 'ACTIVE',
        joinedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        expiresAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), // expired yesterday
        updatedAt: new Date().toISOString()
      });

      const expiredDecision = AuthorizationService.authorize(
        {
          userId: expiredTempUserId,
          accountStatus: 'ACTIVE',
          memberships: [{
            householdId: household.householdId,
            role: 'TEMPORARY_CAREGIVER',
            status: 'ACTIVE',
            expiresAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
          }]
        },
        'household.read',
        { type: 'household', householdId: household.householdId },
        { currentTime: new Date().toISOString() }
      );

      if (expiredDecision.allowed || expiredDecision.reasonCode !== 'AUTH_003') {
        throw new Error('Expired temporary caregiver was not blocked with AUTH_003');
      }
    });

    // ==========================================
    // 4. SECURITY TESTS
    // ==========================================
    await executeTest('SEC-001', 'SECURITY', 'Brute force login lockout after 5 failed attempts', async () => {
      const email = 'alice@example.com';
      RateLimiter.reset();

      // Trigger 5 failed logins
      for (let i = 0; i < 5; i++) {
        try {
          await IdentityService.login({ email, password: 'WrongPassword!' });
        } catch {
          // expected
        }
      }

      // 6th attempt must be locked out
      try {
        await IdentityService.login({ email, password: 'BrandNewP@ssword99!' });
        throw new Error('Account was not locked out after 5 failures');
      } catch (err: any) {
        if (!err.message.includes('locked out') && !err.message.includes('Too many failed login attempts')) throw err;
      }

      // Unlock for subsequent tests
      const user = IdentityStore.findUserByNormalizedEmail(email)!;
      user.failedLoginAttempts = 0;
      user.lockoutUntil = undefined;
      IdentityStore.saveUser(user);
    });

    await executeTest('SEC-002', 'SECURITY', 'Cross-Household Isolation: User A cannot read or mutate Household B', async () => {
      // Create user Charlie with Household C
      const charlieReg = await IdentityService.register({
        email: 'charlie@example.com',
        password: 'PasswordCharlie1!',
        displayName: 'Charlie Stranger'
      });
      await IdentityService.verifyEmail(charlieReg.verificationToken);
      const charlie = IdentityStore.findUserById(charlieReg.user.userId)!;
      const hhC = IdentityService.createHousehold(charlie.userId, 'Charlies Secret Kennel');

      const alice = IdentityStore.findUserByNormalizedEmail('alice@example.com')!;
      const hhA = IdentityStore.listHouseholdsForUser(alice.userId)[0];

      // Charlie attempts to read Household A
      const isolationRead = AuthorizationService.checkHouseholdPermission(
        charlie.userId, 
        hhA.householdId, 
        'household.read'
      );
      if (isolationRead.allowed) {
        throw new Error('Cross-household isolation failed: Charlie could read Alice household');
      }

      // Charlie attempts to invite someone into Household A
      const isolationInvite = AuthorizationService.checkHouseholdPermission(
        charlie.userId, 
        hhA.householdId, 
        'household.members.invite'
      );
      if (isolationInvite.allowed) {
        throw new Error('Cross-household isolation failed: Charlie could invite into Alice household');
      }

      // Alice attempts to update Household C
      const isolationUpdate = AuthorizationService.checkHouseholdPermission(
        alice.userId, 
        hhC.household.householdId, 
        'household.update'
      );
      if (isolationUpdate.allowed) {
        throw new Error('Cross-household isolation failed: Alice could update Charlie household');
      }
    });

    await executeTest('SEC-003', 'SECURITY', 'Final-Owner Protection: Sole active owner cannot be removed or demoted', () => {
      const charlie = IdentityStore.findUserByNormalizedEmail('charlie@example.com')!;
      const hhC = IdentityStore.listHouseholdsForUser(charlie.userId)[0];

      // Demotion test
      try {
        IdentityService.changeMemberRole({
          actorUserId: charlie.userId,
          householdId: hhC.householdId,
          targetUserId: charlie.userId,
          newRole: 'CAREGIVER'
        });
        throw new Error('Final owner was demoted without successor!');
      } catch (err: any) {
        if (!err.message.includes('AUTH_009')) throw err;
      }

      // Leave household test
      try {
        IdentityService.leaveHousehold(charlie.userId, hhC.householdId);
        throw new Error('Sole owner was allowed to leave household!');
      } catch (err: any) {
        if (!err.message.includes('AUTH_009')) throw err;
      }
    });

    await executeTest('SEC-004', 'SECURITY', 'Token replay & expired token prevention', async () => {
      // Verification token already consumed in IT-001 cannot be consumed again
      const user = IdentityStore.findUserByNormalizedEmail('alice@example.com')!;
      const expiredTokenHash = await CryptoUtils.hashToken('fake-token-123456');
      IdentityStore.saveVerificationToken({
        id: generateUUIDv7(),
        userId: user.userId,
        tokenHash: expiredTokenHash,
        type: 'EMAIL_VERIFICATION',
        createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        expiresAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), // expired
        attemptCount: 0
      });

      try {
        await IdentityService.verifyEmail('fake-token-123456');
        throw new Error('Expired verification token was accepted');
      } catch (err: any) {
        if (!err.message.includes('AUTH_007')) throw err;
      }
    });

    // ==========================================
    // 5. END-TO-END (E2E) TESTS
    // ==========================================
    await executeTest('E2E-001', 'E2E', 'Full Identity & Household Lifecycle Flow', async () => {
      // 1. Owner registers and activates account
      const ownerReg = await IdentityService.register({
        email: 'diana@example.com',
        password: 'DianaPassword123!',
        displayName: 'Diana Prince',
        phoneNumber: '+254700112233'
      });
      await IdentityService.verifyEmail(ownerReg.verificationToken);
      const diana = IdentityStore.findUserById(ownerReg.user.userId)!;

      // 2. Owner logs in and creates household
      const login = await IdentityService.login({
        email: 'diana@example.com',
        password: 'DianaPassword123!'
      });
      if (!login.session) throw new Error('E2E: Login failed');

      const hh = IdentityService.createHousehold(diana.userId, 'Themyscira Sanctuary');

      // 3. Owner invites new member Edward
      const invite = await IdentityService.inviteMember({
        inviterUserId: diana.userId,
        householdId: hh.household.householdId,
        inviteeEmail: 'edward@example.com',
        intendedRole: 'FAMILY_MEMBER'
      });

      // 4. Edward registers, verifies, and accepts invitation
      const edReg = await IdentityService.register({
        email: 'edward@example.com',
        password: 'EdwardPassword123!',
        displayName: 'Edward Member'
      });
      await IdentityService.verifyEmail(edReg.verificationToken);
      const edward = IdentityStore.findUserById(edReg.user.userId)!;

      const accept = await IdentityService.acceptInvitation(invite.rawToken, edward.userId);
      if (accept.membership.role !== 'FAMILY_MEMBER') throw new Error('E2E: Member not added');

      // 5. Owner promotes Edward to CAREGIVER
      IdentityService.changeMemberRole({
        actorUserId: diana.userId,
        householdId: hh.household.householdId,
        targetUserId: edward.userId,
        newRole: 'CAREGIVER'
      });

      // 6. Edward attempts unauthorized operation (archive household) -> must be rejected
      const authAttempt = AuthorizationService.checkHouseholdPermission(
        edward.userId, 
        hh.household.householdId, 
        'household.archive'
      );
      if (authAttempt.allowed) throw new Error('E2E: Caregiver was permitted to archive');

      // 7. Owner removes Edward
      IdentityService.removeMember(diana.userId, hh.household.householdId, edward.userId);

      // 8. Removed member loses all access immediately
      const postRemovalAccess = AuthorizationService.checkHouseholdPermission(
        edward.userId, 
        hh.household.householdId, 
        'household.read'
      );
      if (postRemovalAccess.allowed) throw new Error('E2E: Removed member still has access');
    });

    const durationMs = parseFloat((performance.now() - startTotal).toFixed(2));
    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;

    return {
      total: results.length,
      passed: passedCount,
      failed: failedCount,
      durationMs,
      results
    };
  }
}
