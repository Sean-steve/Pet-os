/**
 * Pet OS Sprint 16 - Pet Community, Groups, Events & Recovery Network Types
 * 
 * Implements:
 * - Volume XXII (Pet Community & Social Platform)
 * - Volume XX (Location, Geofencing & Lost-Pet Recovery Architecture)
 * - Volume XXI (QR, NFC, Microchip & Pet Identity Network)
 * - Volume XXIV (AI Safety & Privacy Boundaries)
 * - Volume XXVI (Notification & Engagement Platform)
 * - Volume XXVII (UX/UI & Command Center Community Console)
 * - Volume XXVIII (API & Integration Specification)
 * - Volume XXIX (Event, Command & Outbox Architecture)
 * - Volume XXX (Database Schema & Data Dictionary)
 * - Volume XXXI (Security, Privacy, Trust & Anti-Stalking Protections)
 * - Volume XXXII (Kenyan Data Protection & Community Trust)
 */

import {
  UserId,
  HouseholdId,
  PetId,
  LostPetIncidentId,
  PublicRecoveryProfileId,
  CommunityProfileId,
  CommunityPetProfileId,
  CommunityGroupId,
  GroupMembershipId,
  GroupInvitationId,
  CommunityPostId,
  PostRevisionId,
  PostMediaId,
  CommunityCommentId,
  CommunityReactionId,
  CommunityEventId,
  EventAttendanceId,
  CommunityRecoveryAlertId,
  CommunityRecoveryAlertFollowerId,
  CommunityRecoveryVolunteerId,
  RecoveryConsentId,
  CommunityReportId,
  ModerationActionId,
  ContentFlagId,
  ModerationAppealId,
} from '../kernel/ids';
import { CoarseSearchArea } from '../recovery/types';

// ============================================================================
// PROFILE & IDENTITY
// ============================================================================

export type CommunityVisibility = 'PRIVATE' | 'COMMUNITY_VISIBLE' | 'PUBLIC';
export type CommunityUserStatus = 'ACTIVE' | 'LIMITED' | 'SUSPENDED';
export type ProviderCommunityBadge = 'VETTED_PROVIDER' | 'VETERINARIAN' | 'TRAINER' | 'SHELTER_PARTNER';

export interface CommunityProfile {
  profileId: CommunityProfileId;
  userId: UserId;
  handle: string; // unique, e.g. "elena_vance"
  displayName: string;
  bio: string;
  avatarUrl?: string;
  coarseLocation: {
    neighborhood: string;
    city: string;
    county: string;
  };
  visibility: CommunityVisibility;
  status: CommunityUserStatus;
  providerBadge?: ProviderCommunityBadge;
  isVerified: boolean;
  allowsFutureCrowdRecoveryRelay: boolean; // Opt-in consent flag for future mesh/crowd support (no BLE in this sprint)
  followerCount: number;
  followingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityPetProfile {
  petProfileId: CommunityPetProfileId;
  communityProfileId: CommunityProfileId;
  petId: PetId; // Link to canonical PetCore
  displayName: string;
  species: string;
  breed: string;
  avatarUrl?: string;
  bio: string;
  coarseArea: string;
  visibility: CommunityVisibility;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export type FollowStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'BLOCKED';

export interface FollowRelationship {
  followerProfileId: CommunityProfileId;
  followedProfileId: CommunityProfileId;
  status: FollowStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BlockRelationship {
  blockerProfileId: CommunityProfileId;
  blockedProfileId: CommunityProfileId;
  reason?: string;
  createdAt: string;
}

// ============================================================================
// GROUPS DOMAIN
// ============================================================================

export type GroupCategory =
  | 'BREED'
  | 'SPECIES'
  | 'LOCAL_COMMUNITY'
  | 'INTEREST'
  | 'TRAINING_INTEREST'
  | 'PET_ACTIVITY'
  | 'RECOVERY_SUPPORT';

export type GroupPrivacyType = 'PUBLIC' | 'CLOSED' | 'PRIVATE';
export type GroupRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
export type GroupMemberStatus = 'ACTIVE' | 'MUTED' | 'BANNED' | 'LEFT';

export interface CommunityGroup {
  groupId: CommunityGroupId;
  name: string;
  slug: string;
  description: string;
  category: GroupCategory;
  privacyType: GroupPrivacyType;
  coarseLocation?: {
    neighborhood?: string;
    city: string;
    county: string;
  };
  rules: string[];
  createdByProfileId: CommunityProfileId;
  memberCount: number;
  status: 'ACTIVE' | 'RESTRICTED' | 'ARCHIVED';
  avatarUrl?: string;
  coverImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMembership {
  membershipId: GroupMembershipId;
  groupId: CommunityGroupId;
  profileId: CommunityProfileId;
  role: GroupRole;
  status: GroupMemberStatus;
  joinedAt: string;
  updatedAt: string;
}

export interface GroupInvitation {
  invitationId: GroupInvitationId;
  groupId: CommunityGroupId;
  inviterProfileId: CommunityProfileId;
  inviteeProfileId: CommunityProfileId;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED';
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// POSTS, REVISIONS, MEDIA, COMMENTS, REACTIONS
// ============================================================================

export type PostType =
  | 'GENERAL'
  | 'QUESTION'
  | 'PET_UPDATE'
  | 'TIP'
  | 'EVENT_UPDATE'
  | 'RECOVERY_UPDATE'
  | 'RESOURCE';

export type ContentModerationStatus =
  | 'ACTIVE'
  | 'PENDING_REVIEW'
  | 'LIMITED'
  | 'REMOVED'
  | 'USER_DELETED';

export interface PostMedia {
  mediaId: PostMediaId;
  postId: CommunityPostId;
  mediaUrl: string;
  caption?: string;
  exifStripped: boolean;
  isApproved: boolean;
  createdAt: string;
}

export interface PostRevision {
  revisionId: PostRevisionId;
  postId: CommunityPostId;
  previousContent: string;
  editedByProfileId: CommunityProfileId;
  editedAt: string;
  reason?: string;
}

export interface CommunityPost {
  postId: CommunityPostId;
  authorProfileId: CommunityProfileId;
  groupId?: CommunityGroupId;
  petProfileId?: CommunityPetProfileId;
  postType: PostType;
  content: string;
  coarseLocationArea?: string;
  status: ContentModerationStatus;
  revisionCount: number;
  media: PostMedia[];
  reactionCounts: {
    LIKE: number;
    HELPFUL: number;
    SUPPORT: number;
  };
  commentCount: number;
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityComment {
  commentId: CommunityCommentId;
  postId: CommunityPostId;
  parentCommentId?: CommunityCommentId; // 1-level threading
  authorProfileId: CommunityProfileId;
  content: string;
  status: ContentModerationStatus;
  createdAt: string;
  updatedAt: string;
}

export type ReactionType = 'LIKE' | 'HELPFUL' | 'SUPPORT';

export interface CommunityReaction {
  reactionId: CommunityReactionId;
  targetType: 'POST' | 'COMMENT';
  targetId: string;
  profileId: CommunityProfileId;
  reactionType: ReactionType;
  createdAt: string;
}

// ============================================================================
// EVENTS DOMAIN
// ============================================================================

export type CommunityEventType =
  | 'MEETUP'
  | 'TRAINING_WORKSHOP'
  | 'PACK_WALK'
  | 'VOLUNTEER_EVENT'
  | 'RECOVERY_BRIEFING'
  | 'OTHER';

export type EventLocationType = 'PUBLIC_PARK' | 'VERIFIED_VENUE' | 'VIRTUAL';
export type EventRsvpStatus = 'GOING' | 'INTERESTED' | 'NOT_GOING' | 'WAITLISTED';

export interface CommunityEvent {
  eventId: CommunityEventId;
  organizerProfileId: CommunityProfileId;
  groupId?: CommunityGroupId;
  title: string;
  description: string;
  eventType: CommunityEventType;
  startTime: string;
  endTime: string;
  locationType: EventLocationType;
  venueName: string;
  coarseArea: string; // e.g. "Karura Forest, Sigiria Entrance, Nairobi"
  detailedAddressPrivate: boolean; // Protect private residences
  maxAttendees?: number;
  currentAttendeeCount: number;
  petPolicy: {
    allowedSpecies: string[];
    requireVaccinated: boolean;
    leashRequired: boolean;
  };
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}

export interface EventAttendance {
  attendanceId: EventAttendanceId;
  eventId: CommunityEventId;
  profileId: CommunityProfileId;
  petProfileIds: CommunityPetProfileId[];
  rsvpStatus: EventRsvpStatus;
  attendedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// COMMUNITY RECOVERY NETWORK (Sprint 16)
// ============================================================================

export type CommunityAlertStatus = 'ACTIVE' | 'SEARCH_IN_PROGRESS' | 'CLOSED' | 'CANCELLED';

export interface CommunityRecoveryAlert {
  communityAlertId: CommunityRecoveryAlertId;
  lostPetIncidentId: LostPetIncidentId; // Consumed from Sprint 15
  recoveryProfileReference: PublicRecoveryProfileId;
  publicToken: string;
  petDisplayName: string;
  species: string;
  breed: string;
  photoUrl?: string;
  ownerInstructions?: string;
  coarseTargetArea: CoarseSearchArea;
  status: CommunityAlertStatus;
  visibilityScope: 'PUBLIC' | 'LOCAL_COMMUNITY';
  followersCount: number;
  volunteersCount: number;
  requestedAt: string;
  activatedAt: string;
  closedAt?: string;
  closureReason?: 'RECOVERED' | 'CANCELLED' | 'EXPIRED';
  createdAt: string;
  updatedAt: string;
}

export interface CommunityRecoveryAlertFollower {
  followerId: CommunityRecoveryAlertFollowerId;
  communityAlertId: CommunityRecoveryAlertId;
  profileId: CommunityProfileId;
  notifyOnSightings: boolean;
  createdAt: string;
}

export type VolunteerRole =
  | 'SEARCH_PARTICIPANT'
  | 'FLYER_DISTRIBUTION'
  | 'SHELTER_CHECKER'
  | 'TRANSPORT_BACKUP';

export interface CommunityRecoveryVolunteer {
  volunteerId: CommunityRecoveryVolunteerId;
  communityAlertId: CommunityRecoveryAlertId;
  profileId: CommunityProfileId;
  volunteerRole: VolunteerRole;
  notes?: string;
  isCheckedIn: boolean;
  createdAt: string;
}

// ============================================================================
// MODERATION & TRUST DOMAIN
// ============================================================================

export type ReportReasonCategory =
  | 'SPAM'
  | 'HARASSMENT'
  | 'SCAM_OR_EXTORTION'
  | 'IMPERSONATION'
  | 'UNAUTHORIZED_LOCATION_EXPOSURE'
  | 'ANIMAL_WELFARE_CONCERN'
  | 'MISINFORMATION'
  | 'OTHER';

export type CommunityReportStatus = 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';

export interface CommunityReport {
  reportId: CommunityReportId;
  reporterProfileId: CommunityProfileId;
  targetType: 'POST' | 'COMMENT' | 'GROUP' | 'PROFILE' | 'EVENT' | 'RECOVERY_ALERT';
  targetId: string;
  reasonCategory: ReportReasonCategory;
  details?: string;
  status: CommunityReportStatus;
  resolvedByUserId?: UserId;
  resolutionActionId?: ModerationActionId;
  createdAt: string;
  updatedAt: string;
}

export type ModerationActionType =
  | 'CONTENT_REMOVED'
  | 'CONTENT_LIMITED'
  | 'WARNING_ISSUED'
  | 'USER_RESTRICTED'
  | 'USER_SUSPENDED'
  | 'GROUP_RESTRICTED'
  | 'DISMISSED'
  | 'ESCALATED_TO_TRUST_SAFETY';

export interface ModerationAction {
  actionId: ModerationActionId;
  reportId?: CommunityReportId;
  targetType: string;
  targetId: string;
  actionType: ModerationActionType;
  performedByUserId: UserId;
  reason: string;
  timestamp: string;
}

// ============================================================================
// PRIVACY-PRESERVING DATA TRANSFER OBJECTS (DTOs)
// ============================================================================

export interface PublicCommunityProfileDto {
  profileId: CommunityProfileId;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  coarseLocation: {
    neighborhood: string;
    city: string;
    county: string;
  };
  providerBadge?: ProviderCommunityBadge;
  isVerified: boolean;
  followerCount: number;
  followingCount: number;
  createdAt: string;
}

export interface PublicCommunityPetProfileDto {
  petProfileId: CommunityPetProfileId;
  displayName: string;
  species: string;
  breed: string;
  avatarUrl?: string;
  bio: string;
  coarseArea: string;
}

export interface CommunityPostDto {
  postId: CommunityPostId;
  author: PublicCommunityProfileDto;
  pet?: PublicCommunityPetProfileDto;
  groupId?: CommunityGroupId;
  groupName?: string;
  postType: PostType;
  content: string;
  coarseLocationArea?: string;
  media: Array<{ mediaId: PostMediaId; mediaUrl: string; caption?: string }>;
  reactionCounts: { LIKE: number; HELPFUL: number; SUPPORT: number };
  userReaction?: ReactionType;
  commentCount: number;
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}
