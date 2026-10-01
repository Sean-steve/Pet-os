/**
 * Pet OS Sprint 2 - Central Authorization Service & Permission Matrix
 * Implements Volume IV, Volume XXVIII, Volume XXXI:
 * Evaluates [SUBJECT, ACTION, RESOURCE, CONTEXT] server-side.
 * Enforces cross-household isolation, final-owner protection, and temporal caregiver expiry.
 */

import { 
  HouseholdRole, 
  Permission, 
  AuthorizationSubject, 
  AuthorizationResource, 
  AuthorizationContext, 
  AuthorizationDecision 
} from './types';
import { IdentityStore } from './store';
import { HouseholdId } from '../kernel/ids';

export class AuthorizationService {
  /**
   * Canonical Role Permission Matrix (Volume IV & XXVIII)
   */
  private static readonly ROLE_PERMISSIONS: Record<HouseholdRole, Permission[]> = {
    HOUSEHOLD_OWNER: [
      'household.read',
      'household.update',
      'household.archive',
      'household.members.read',
      'household.members.invite',
      'household.members.remove',
      'household.members.role_change',
      'account.manage_self',
      'pet.create',
      'pet.read',
      'pet.update',
      'pet.archive',
      'pet.restore',
      'pet.delete',
      'pet.relationship.manage',
      'pet.photo.manage',
      'pet.microchip.manage',
      'pet.deceased.mark',
      'pet.timeline.read',
      'pet.timeline.manage_manual',
      'pet.timeline.export',
      'pet.document.read',
      'pet.document.upload',
      'pet.document.update',
      'pet.document.archive',
      'pet.document.download',
      'pet.passport.read',
      'pet.passport.generate',
      'pet.passport.share',
      'pet.passport.revoke_share',
      'pet.passport.export',
      'pet.health.read',
      'pet.health.read_summary',
      'pet.health.create_owner_record',
      'pet.health.update_owner_record',
      'pet.health.manage_condition',
      'pet.health.manage_allergy',
      'pet.health.manage_vaccination',
      'pet.health.manage_medication',
      'pet.health.manage_encounter',
      'pet.health.manage_procedure',
      'pet.health.manage_diagnostic',
      'pet.health.verify_record',
      'pet.health.amend_verified_record',
      'pet.care.read',
      'pet.care.create',
      'pet.care.update',
      'pet.care.assign',
      'pet.care.complete',
      'pet.care.skip',
      'pet.care.cancel',
      'pet.care.manage_clinical_schedule',
      'pet.nutrition.read',
      'pet.nutrition.plan.create',
      'pet.nutrition.plan.update',
      'pet.nutrition.plan.activate',
      'pet.nutrition.plan.cancel',
      'pet.nutrition.meal.complete',
      'pet.nutrition.meal.log',
      'pet.nutrition.treat.log',
      'pet.nutrition.hydration.log',
      'pet.nutrition.restriction.manage',
      'pet.nutrition.professional_plan.manage',
      'pet.training.read',
      'pet.training.plan.create',
      'pet.training.plan.update',
      'pet.training.plan.activate',
      'pet.training.plan.cancel',
      'pet.training.session.start',
      'pet.training.session.complete',
      'pet.training.skill.assess',
      'pet.training.milestone.manage',
      'pet.training.evidence.manage',
      'pet.behavior.read',
      'pet.behavior.record',
      'pet.behavior.update_owner_record',
      'pet.behavior.professional_record.manage',
      'pet.activity.read',
      'pet.activity.log',
      'pet.activity.start',
      'pet.activity.complete',
      'pet.activity.update_owner_record',
      'pet.activity.goal.create',
      'pet.activity.goal.update',
      'pet.activity.routine.create',
      'pet.activity.routine.update',
      'pet.activity.routine.assign',
      'pet.daily_care.read',
      'pet.daily_care.execute',
      'notification.read_self',
      'notification.preferences.manage_self'
    ],
    HOUSEHOLD_ADMIN: [
      'household.read',
      'household.update',
      'household.members.read',
      'household.members.invite',
      'household.members.remove',
      'household.members.role_change',
      'account.manage_self',
      'pet.create',
      'pet.read',
      'pet.update',
      'pet.photo.manage',
      'pet.microchip.manage',
      'pet.relationship.manage',
      'pet.timeline.read',
      'pet.timeline.manage_manual',
      'pet.timeline.export',
      'pet.document.read',
      'pet.document.upload',
      'pet.document.update',
      'pet.document.archive',
      'pet.document.download',
      'pet.passport.read',
      'pet.passport.generate',
      'pet.passport.share',
      'pet.passport.revoke_share',
      'pet.passport.export',
      'pet.health.read',
      'pet.health.read_summary',
      'pet.health.create_owner_record',
      'pet.health.update_owner_record',
      'pet.health.manage_condition',
      'pet.health.manage_allergy',
      'pet.health.manage_vaccination',
      'pet.health.manage_medication',
      'pet.health.manage_encounter',
      'pet.health.manage_procedure',
      'pet.health.manage_diagnostic',
      'pet.care.read',
      'pet.care.create',
      'pet.care.update',
      'pet.care.assign',
      'pet.care.complete',
      'pet.care.skip',
      'pet.care.cancel',
      'pet.care.manage_clinical_schedule',
      'pet.nutrition.read',
      'pet.nutrition.plan.create',
      'pet.nutrition.plan.update',
      'pet.nutrition.plan.activate',
      'pet.nutrition.plan.cancel',
      'pet.nutrition.meal.complete',
      'pet.nutrition.meal.log',
      'pet.nutrition.treat.log',
      'pet.nutrition.hydration.log',
      'pet.nutrition.restriction.manage',
      'pet.training.read',
      'pet.training.plan.create',
      'pet.training.plan.update',
      'pet.training.plan.activate',
      'pet.training.plan.cancel',
      'pet.training.session.start',
      'pet.training.session.complete',
      'pet.training.skill.assess',
      'pet.training.milestone.manage',
      'pet.training.evidence.manage',
      'pet.behavior.read',
      'pet.behavior.record',
      'pet.behavior.update_owner_record',
      'pet.activity.read',
      'pet.activity.log',
      'pet.activity.start',
      'pet.activity.complete',
      'pet.activity.update_owner_record',
      'pet.activity.goal.create',
      'pet.activity.goal.update',
      'pet.activity.routine.create',
      'pet.activity.routine.update',
      'pet.activity.routine.assign',
      'pet.daily_care.read',
      'pet.daily_care.execute',
      'notification.read_self',
      'notification.preferences.manage_self'
    ],
    CAREGIVER: [
      'household.read',
      'household.members.read',
      'account.manage_self',
      'pet.read',
      'pet.photo.manage',
      'pet.timeline.read',
      'pet.timeline.manage_manual',
      'pet.document.read',
      'pet.document.upload',
      'pet.document.download',
      'pet.passport.read',
      'pet.health.read',
      'pet.health.read_summary',
      'pet.health.create_owner_record',
      'pet.health.manage_medication',
      'pet.care.read',
      'pet.care.create',
      'pet.care.assign',
      'pet.care.complete',
      'pet.care.skip',
      'pet.nutrition.read',
      'pet.nutrition.plan.create',
      'pet.nutrition.plan.update',
      'pet.nutrition.meal.complete',
      'pet.nutrition.meal.log',
      'pet.nutrition.treat.log',
      'pet.nutrition.hydration.log',
      'pet.training.read',
      'pet.training.plan.create',
      'pet.training.plan.update',
      'pet.training.session.start',
      'pet.training.session.complete',
      'pet.training.evidence.manage',
      'pet.behavior.read',
      'pet.behavior.record',
      'pet.behavior.update_owner_record',
      'pet.activity.read',
      'pet.activity.log',
      'pet.activity.start',
      'pet.activity.complete',
      'pet.activity.update_owner_record',
      'pet.activity.goal.create',
      'pet.activity.goal.update',
      'pet.activity.routine.create',
      'pet.activity.routine.update',
      'pet.activity.routine.assign',
      'pet.daily_care.read',
      'pet.daily_care.execute',
      'notification.read_self',
      'notification.preferences.manage_self'
    ],
    FAMILY_MEMBER: [
      'household.read',
      'household.members.read',
      'account.manage_self',
      'pet.read',
      'pet.photo.manage',
      'pet.timeline.read',
      'pet.document.read',
      'pet.document.download',
      'pet.passport.read',
      'pet.health.read',
      'pet.health.read_summary',
      'pet.care.read',
      'pet.care.complete',
      'pet.nutrition.read',
      'pet.nutrition.meal.complete',
      'pet.nutrition.meal.log',
      'pet.nutrition.treat.log',
      'pet.nutrition.hydration.log',
      'pet.training.read',
      'pet.training.session.start',
      'pet.training.session.complete',
      'pet.training.evidence.manage',
      'pet.behavior.read',
      'pet.behavior.record',
      'pet.activity.read',
      'pet.activity.log',
      'pet.activity.start',
      'pet.activity.complete',
      'pet.daily_care.read',
      'pet.daily_care.execute',
      'notification.read_self',
      'notification.preferences.manage_self'
    ],
    TEMPORARY_CAREGIVER: [
      'household.read',
      'household.members.read',
      'account.manage_self',
      'pet.read',
      'pet.timeline.read',
      'pet.passport.read',
      'pet.health.read_summary',
      'pet.care.read',
      'pet.care.complete',
      'pet.nutrition.read',
      'pet.nutrition.meal.complete',
      'pet.nutrition.hydration.log',
      'pet.training.read',
      'pet.training.session.start',
      'pet.training.session.complete',
      'pet.activity.read',
      'pet.activity.start',
      'pet.activity.complete',
      'pet.daily_care.read',
      'pet.daily_care.execute',
      'notification.read_self'
    ]
  };

  /**
   * Primary authorization decision engine.
   * Evaluates SUBJECT, ACTION, RESOURCE, CONTEXT.
   */
  static authorize(
    subject: AuthorizationSubject,
    action: Permission,
    resource: AuthorizationResource,
    context: AuthorizationContext
  ): AuthorizationDecision {
    // 1. Account Status Enforcement
    if (subject.accountStatus === 'SUSPENDED') {
      return {
        allowed: false,
        reasonCode: 'AUTH_005',
        message: 'Account is suspended by administrator or risk engine.'
      };
    }

    if (subject.accountStatus === 'DEACTIVATED' || subject.accountStatus === 'DELETED') {
      return {
        allowed: false,
        reasonCode: 'AUTH_005',
        message: 'Account is deactivated or deleted.'
      };
    }

    if (subject.accountStatus === 'PENDING_VERIFICATION' && action !== 'account.manage_self') {
      return {
        allowed: false,
        reasonCode: 'AUTH_006',
        message: 'Account identity requires verification before accessing household resources.'
      };
    }

    // 2. Self-account management check
    if (action === 'account.manage_self') {
      if (resource.type === 'account' && resource.targetUserId && resource.targetUserId !== subject.userId) {
        return {
          allowed: false,
          reasonCode: 'AUTH_002',
          message: 'Users cannot manage other accounts without administrative delegation.'
        };
      }
      return { allowed: true, reasonCode: 'PERMIT_SELF_MANAGEMENT' };
    }

    if (action === 'notification.read_self' || action === 'notification.preferences.manage_self') {
      if (resource.targetUserId && resource.targetUserId !== subject.userId) {
        return {
          allowed: false,
          reasonCode: 'AUTH_002',
          message: 'Cannot access or modify notification preferences for other users.'
        };
      }
      return { allowed: true, reasonCode: 'PERMIT_SELF_NOTIFICATIONS' };
    }

    // 3. Household-bound Resource Authorization & Cross-Household Isolation
    if (resource.householdId) {
      const activeMembership = subject.memberships.find(
        m => m.householdId === resource.householdId && m.status === 'ACTIVE'
      );

      // Cross-Household Isolation check: Actor is not an active member of this household
      if (!activeMembership) {
        return {
          allowed: false,
          reasonCode: 'AUTH_002',
          message: 'Cross-household boundary violation: Actor is not an active member of this household.'
        };
      }

      // Check temporary caregiver expiry
      if (activeMembership.role === 'TEMPORARY_CAREGIVER' && activeMembership.expiresAt) {
        if (context.currentTime > activeMembership.expiresAt) {
          return {
            allowed: false,
            reasonCode: 'AUTH_003',
            evaluatedRole: activeMembership.role,
            message: 'Temporary caregiver access has expired (PETIV-INV-001).'
          };
        }
      }

      // Check role permissions
      const allowedPermissions = this.ROLE_PERMISSIONS[activeMembership.role] || [];
      if (!allowedPermissions.includes(action)) {
        return {
          allowed: false,
          reasonCode: 'AUTH_002',
          evaluatedRole: activeMembership.role,
          message: `Role ${activeMembership.role} lacks required permission ${action}.`
        };
      }

      // 4. Role Hierarchy & Guardrail Invariants
      if (action === 'household.archive' && activeMembership.role !== 'HOUSEHOLD_OWNER') {
        return {
          allowed: false,
          reasonCode: 'AUTH_002',
          evaluatedRole: activeMembership.role,
          message: 'Only a HOUSEHOLD_OWNER may archive a household.'
        };
      }

      // Admin restrictions
      if (activeMembership.role === 'HOUSEHOLD_ADMIN') {
        if (resource.targetUserId) {
          const targetMembership = IdentityStore.findMembership(resource.householdId, resource.targetUserId);
          if (targetMembership && targetMembership.role === 'HOUSEHOLD_OWNER') {
            return {
              allowed: false,
              reasonCode: 'AUTH_002',
              evaluatedRole: activeMembership.role,
              message: 'HOUSEHOLD_ADMIN cannot alter or remove a HOUSEHOLD_OWNER.'
            };
          }
        }
      }

      return {
        allowed: true,
        reasonCode: 'PERMIT_ROLE_POLICY',
        evaluatedRole: activeMembership.role
      };
    }

    return {
      allowed: false,
      reasonCode: 'AUTH_002',
      message: 'Unrecognized resource or missing authorization context.'
    };
  }

  /**
   * Helper to verify if an action can be performed by an authenticated user on a household
   */
  static checkHouseholdPermission(
    userId: string,
    householdId: HouseholdId,
    action: Permission,
    targetUserId?: string
  ): AuthorizationDecision {
    const user = IdentityStore.findUserById(userId as any);
    if (!user) {
      return { allowed: false, reasonCode: 'AUTH_001', message: 'User not found' };
    }

    const members = IdentityStore.listMembersForHousehold(householdId);
    const membership = members.find(m => m.userId === userId);

    const subject: AuthorizationSubject = {
      userId: user.userId,
      accountStatus: user.accountStatus,
      memberships: membership ? [{
        householdId,
        role: membership.role,
        status: membership.status,
        expiresAt: membership.expiresAt
      }] : []
    };

    const resource: AuthorizationResource = {
      type: targetUserId ? 'membership' : 'household',
      householdId,
      targetUserId: targetUserId as any
    };

    const context: AuthorizationContext = {
      currentTime: new Date().toISOString()
    };

    return this.authorize(subject, action, resource, context);
  }

  /**
   * Helper to verify if an action can be performed by an authenticated user on a pet
   */
  static checkPetPermission(
    userId: string,
    householdId: HouseholdId,
    petId: string,
    action: Permission
  ): AuthorizationDecision {
    const user = IdentityStore.findUserById(userId as any);
    if (!user) {
      return { allowed: false, reasonCode: 'AUTH_001', message: 'User not found' };
    }

    const members = IdentityStore.listMembersForHousehold(householdId);
    const membership = members.find(m => m.userId === userId);

    const subject: AuthorizationSubject = {
      userId: user.userId,
      accountStatus: user.accountStatus,
      memberships: membership ? [{
        householdId,
        role: membership.role,
        status: membership.status,
        expiresAt: membership.expiresAt
      }] : []
    };

    const resource: AuthorizationResource = {
      type: 'pet',
      householdId,
      petId
    };

    const context: AuthorizationContext = {
      currentTime: new Date().toISOString()
    };

    return this.authorize(subject, action, resource, context);
  }
}
