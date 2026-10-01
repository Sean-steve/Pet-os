/**
 * Pet OS Sprint 2 - Identity, Accounts, Households & Access Control Domain Models
 * Implements Volume IV, Volume XXVIII, Volume XXX, Volume XXXI, Volume XLI (ADRs 001-020)
 */

import { UserId, HouseholdId, SessionId, InvitationId, MembershipId } from '../kernel/ids';

export type AccountStatus =
  | 'PENDING_VERIFICATION'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'DEACTIVATED'
  | 'DELETION_PENDING'
  | 'DELETED';

export type HouseholdRole =
  | 'HOUSEHOLD_OWNER'
  | 'HOUSEHOLD_ADMIN'
  | 'CAREGIVER'
  | 'FAMILY_MEMBER'
  | 'TEMPORARY_CAREGIVER';

export type MembershipStatus =
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'REMOVED';

export type InvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'REVOKED'
  | 'EXPIRED';

export interface UserAccount {
  userId: UserId;
  email: string;
  normalizedEmail: string;
  phoneNumber?: string;
  phoneVerifiedAt?: string;
  emailVerifiedAt?: string;
  passwordHash: string;
  accountStatus: AccountStatus;
  failedLoginAttempts: number;
  lockoutUntil?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  deactivatedAt?: string;
  deletedAt?: string;
  deletionScheduledFor?: string;
  policyAcceptedAt: string;
  policyVersion: string;
}

export interface UserProfile {
  userId: UserId;
  displayName: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  locale: string;
  timezone: string;
  communicationPreferences: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    emergencyAlerts: boolean;
  };
  privacyPreferences: {
    profileVisibility: 'HOUSEHOLD_ONLY' | 'PRIVATE';
    shareActivityWithHousehold: boolean;
  };
  updatedAt: string;
}

export interface Session {
  sessionId: SessionId;
  userId: UserId;
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
  revokedAt?: string;
  userAgent?: string;
  ipAddress?: string;
  isCurrent?: boolean;
}

export interface VerificationToken {
  id: string;
  userId: UserId;
  tokenHash: string;
  rawTokenForNotification?: string; // transient for dev/notification mocks
  type: 'EMAIL_VERIFICATION' | 'PHONE_VERIFICATION';
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
  attemptCount: number;
}

export interface PasswordResetToken {
  id: string;
  userId: UserId;
  tokenHash: string;
  rawTokenForNotification?: string;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
  attemptCount: number;
}

export interface Household {
  householdId: HouseholdId;
  name: string;
  status: 'ACTIVE' | 'ARCHIVED';
  ownerUserId: UserId;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface HouseholdMember {
  membershipId: MembershipId;
  householdId: HouseholdId;
  userId: UserId;
  role: HouseholdRole;
  status: MembershipStatus;
  joinedAt: string;
  invitedBy?: UserId;
  expiresAt?: string; // mandatory for TEMPORARY_CAREGIVER
  removedAt?: string;
  updatedAt: string;
}

export interface HouseholdInvitation {
  invitationId: InvitationId;
  householdId: HouseholdId;
  inviterUserId: UserId;
  inviteeEmail: string;
  intendedRole: HouseholdRole;
  tokenHash: string;
  rawTokenForNotification?: string;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  respondedAt?: string;
  temporaryAccessDurationDays?: number;
}

// Canonical Permission Strings
export type Permission =
  | 'household.read'
  | 'household.update'
  | 'household.archive'
  | 'household.members.read'
  | 'household.members.invite'
  | 'household.members.remove'
  | 'household.members.role_change'
  | 'account.manage_self'
  | 'pet.create'
  | 'pet.read'
  | 'pet.update'
  | 'pet.archive'
  | 'pet.restore'
  | 'pet.delete'
  | 'pet.relationship.manage'
  | 'pet.photo.manage'
  | 'pet.microchip.manage'
  | 'pet.deceased.mark'
  | 'pet.timeline.read'
  | 'pet.timeline.manage_manual'
  | 'pet.timeline.export'
  | 'pet.document.read'
  | 'pet.document.upload'
  | 'pet.document.update'
  | 'pet.document.archive'
  | 'pet.document.download'
  | 'pet.passport.read'
  | 'pet.passport.generate'
  | 'pet.passport.share'
  | 'pet.passport.revoke_share'
  | 'pet.passport.export'
  | 'pet.health.read'
  | 'pet.health.read_summary'
  | 'pet.health.create_owner_record'
  | 'pet.health.update_owner_record'
  | 'pet.health.manage_condition'
  | 'pet.health.manage_allergy'
  | 'pet.health.manage_vaccination'
  | 'pet.health.manage_medication'
  | 'pet.health.manage_encounter'
  | 'pet.health.manage_procedure'
  | 'pet.health.manage_diagnostic'
  | 'pet.health.verify_record'
  | 'pet.health.amend_verified_record'
  | 'pet.care.read'
  | 'pet.care.create'
  | 'pet.care.update'
  | 'pet.care.assign'
  | 'pet.care.complete'
  | 'pet.care.skip'
  | 'pet.care.cancel'
  | 'pet.care.manage_clinical_schedule'
  | 'pet.nutrition.read'
  | 'pet.nutrition.plan.create'
  | 'pet.nutrition.plan.update'
  | 'pet.nutrition.plan.activate'
  | 'pet.nutrition.plan.cancel'
  | 'pet.nutrition.meal.complete'
  | 'pet.nutrition.meal.log'
  | 'pet.nutrition.treat.log'
  | 'pet.nutrition.hydration.log'
  | 'pet.nutrition.restriction.manage'
  | 'pet.nutrition.professional_plan.manage'
  | 'pet.training.read'
  | 'pet.training.plan.create'
  | 'pet.training.plan.update'
  | 'pet.training.plan.activate'
  | 'pet.training.plan.cancel'
  | 'pet.training.session.start'
  | 'pet.training.session.complete'
  | 'pet.training.skill.assess'
  | 'pet.training.milestone.manage'
  | 'pet.training.evidence.manage'
  | 'pet.behavior.read'
  | 'pet.behavior.record'
  | 'pet.behavior.update_owner_record'
  | 'pet.behavior.professional_record.manage'
  | 'pet.activity.read'
  | 'pet.activity.log'
  | 'pet.activity.start'
  | 'pet.activity.complete'
  | 'pet.activity.update_owner_record'
  | 'pet.activity.goal.create'
  | 'pet.activity.goal.update'
  | 'pet.activity.routine.create'
  | 'pet.activity.routine.update'
  | 'pet.activity.routine.assign'
  | 'pet.daily_care.read'
  | 'pet.daily_care.execute'
  | 'notification.read_self'
  | 'notification.preferences.manage_self'
  | 'provider.profile.read_self'
  | 'provider.profile.update_self'
  | 'provider.verification.submit'
  | 'provider.credentials.manage_self'
  | 'provider.services.read_self'
  | 'provider.services.manage_self'
  | 'provider.availability.manage_self'
  | 'provider.locations.manage_self'
  | 'business.read'
  | 'business.update'
  | 'business.team.manage'
  | 'business.services.manage'
  | 'business.locations.manage'
  | 'business.verification.submit'
  | 'provider.verification.review'
  | 'provider.verification.approve'
  | 'provider.verification.reject'
  | 'provider.suspend'
  | 'business.verify'
  | 'provider.report.review';

export interface AuthorizationSubject {
  userId: UserId;
  accountStatus: AccountStatus;
  memberships: Array<{
    householdId: HouseholdId;
    role: HouseholdRole;
    status: MembershipStatus;
    expiresAt?: string;
  }>;
  isPlatformAdmin?: boolean;
}

export interface AuthorizationResource {
  type: 'household' | 'membership' | 'invitation' | 'account' | 'pet' | 'pet_photo' | 'pet_microchip' | 'pet_relationship' | 'timeline' | 'document' | 'passport' | 'passport_share' | 'health_record' | 'care_obligation' | 'care_occurrence' | 'notification' | 'nutrition_plan' | 'meal_occurrence' | 'food' | 'activity_record' | 'activity_session' | 'activity_routine' | 'activity_occurrence' | 'activity_goal' | 'daily_care' | 'provider_profile' | 'service_business' | 'service_offering' | 'verification_case' | 'provider_report';
  householdId?: HouseholdId;
  petId?: string;
  targetUserId?: UserId;
  ownerUserId?: UserId;
  providerId?: string;
  businessId?: string;
}

export interface AuthorizationContext {
  currentTime: string;
  clientIp?: string;
}

export interface AuthorizationDecision {
  allowed: boolean;
  reasonCode: string;
  evaluatedRole?: HouseholdRole;
  message?: string;
}
