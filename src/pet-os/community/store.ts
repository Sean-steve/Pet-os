/**
 * Pet OS Sprint 16 - Pet Community In-Memory Store & Repository
 * 
 * Implements:
 * - Volume XXII (Pet Community & Social Platform)
 * - Volume XXX (Database Schema & Technical Data Dictionary)
 */

import {
  UserId,
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
  CommunityCommentId,
  CommunityReactionId,
  CommunityEventId,
  EventAttendanceId,
  CommunityRecoveryAlertId,
  CommunityRecoveryAlertFollowerId,
  CommunityRecoveryVolunteerId,
  CommunityReportId,
  ModerationActionId,
} from '../kernel/ids';
import {
  CommunityProfile,
  CommunityPetProfile,
  FollowRelationship,
  BlockRelationship,
  CommunityGroup,
  GroupMembership,
  GroupInvitation,
  CommunityPost,
  PostRevision,
  CommunityComment,
  CommunityReaction,
  CommunityEvent,
  EventAttendance,
  CommunityRecoveryAlert,
  CommunityRecoveryAlertFollower,
  CommunityRecoveryVolunteer,
  CommunityReport,
  ModerationAction,
} from './types';

export class CommunityStore {
  private static instance: CommunityStore;

  // Profiles
  public profiles = new Map<CommunityProfileId, CommunityProfile>();
  public userToProfileMap = new Map<UserId, CommunityProfileId>();
  public handleToProfileMap = new Map<string, CommunityProfileId>();

  // Pet Profiles
  public petProfiles = new Map<CommunityPetProfileId, CommunityPetProfile>();

  // Follows & Blocks
  public follows = new Map<string, FollowRelationship>(); // key: `${follower}:${followed}`
  public blocks = new Map<string, BlockRelationship>(); // key: `${blocker}:${blocked}`

  // Groups
  public groups = new Map<CommunityGroupId, CommunityGroup>();
  public groupMemberships = new Map<GroupMembershipId, GroupMembership>();
  public groupInvitations = new Map<GroupInvitationId, GroupInvitation>();

  // Content
  public posts = new Map<CommunityPostId, CommunityPost>();
  public postRevisions = new Map<PostRevisionId, PostRevision>();
  public comments = new Map<CommunityCommentId, CommunityComment>();
  public reactions = new Map<CommunityReactionId, CommunityReaction>();

  // Events
  public events = new Map<CommunityEventId, CommunityEvent>();
  public eventAttendances = new Map<EventAttendanceId, EventAttendance>();

  // Recovery Network
  public recoveryAlerts = new Map<CommunityRecoveryAlertId, CommunityRecoveryAlert>();
  public incidentToAlertMap = new Map<LostPetIncidentId, CommunityRecoveryAlertId>();
  public alertFollowers = new Map<CommunityRecoveryAlertFollowerId, CommunityRecoveryAlertFollower>();
  public alertVolunteers = new Map<CommunityRecoveryVolunteerId, CommunityRecoveryVolunteer>();

  // Moderation
  public reports = new Map<CommunityReportId, CommunityReport>();
  public moderationActions = new Map<ModerationActionId, ModerationAction>();

  private constructor() {}

  public static getInstance(): CommunityStore {
    if (!CommunityStore.instance) {
      CommunityStore.instance = new CommunityStore();
    }
    return CommunityStore.instance;
  }

  public clear(): void {
    this.profiles.clear();
    this.userToProfileMap.clear();
    this.handleToProfileMap.clear();
    this.petProfiles.clear();
    this.follows.clear();
    this.blocks.clear();
    this.groups.clear();
    this.groupMemberships.clear();
    this.groupInvitations.clear();
    this.posts.clear();
    this.postRevisions.clear();
    this.comments.clear();
    this.reactions.clear();
    this.events.clear();
    this.eventAttendances.clear();
    this.recoveryAlerts.clear();
    this.incidentToAlertMap.clear();
    this.alertFollowers.clear();
    this.alertVolunteers.clear();
    this.reports.clear();
    this.moderationActions.clear();
  }

  // --- Profile Queries ---
  public getProfileByUserId(userId: UserId): CommunityProfile | undefined {
    const profileId = this.userToProfileMap.get(userId);
    return profileId ? this.profiles.get(profileId) : undefined;
  }

  public getProfileByHandle(handle: string): CommunityProfile | undefined {
    const profileId = this.handleToProfileMap.get(handle.toLowerCase());
    return profileId ? this.profiles.get(profileId) : undefined;
  }

  public getPetProfilesForProfile(profileId: CommunityProfileId): CommunityPetProfile[] {
    return Array.from(this.petProfiles.values()).filter(p => p.communityProfileId === profileId && p.status === 'ACTIVE');
  }

  // --- Blocking & Relationship Queries ---
  public isBlocked(profileA: CommunityProfileId, profileB: CommunityProfileId): boolean {
    const aBlocksB = this.blocks.has(`${profileA}:${profileB}`);
    const bBlocksA = this.blocks.has(`${profileB}:${profileA}`);
    return aBlocksB || bBlocksA;
  }

  public getFollowRelationship(follower: CommunityProfileId, followed: CommunityProfileId): FollowRelationship | undefined {
    return this.follows.get(`${follower}:${followed}`);
  }

  // --- Group Queries ---
  public getMembership(groupId: CommunityGroupId, profileId: CommunityProfileId): GroupMembership | undefined {
    return Array.from(this.groupMemberships.values()).find(
      m => m.groupId === groupId && m.profileId === profileId && m.status === 'ACTIVE'
    );
  }

  public getGroupMembers(groupId: CommunityGroupId): GroupMembership[] {
    return Array.from(this.groupMemberships.values()).filter(
      m => m.groupId === groupId && m.status === 'ACTIVE'
    );
  }

  // --- Post & Comment Queries ---
  public getCommentsForPost(postId: CommunityPostId): CommunityComment[] {
    return Array.from(this.comments.values())
      .filter(c => c.postId === postId && c.status !== 'REMOVED')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  public getReaction(targetType: 'POST' | 'COMMENT', targetId: string, profileId: CommunityProfileId): CommunityReaction | undefined {
    return Array.from(this.reactions.values()).find(
      r => r.targetType === targetType && r.targetId === targetId && r.profileId === profileId
    );
  }

  // --- Event Queries ---
  public getAttendancesForEvent(eventId: CommunityEventId): EventAttendance[] {
    return Array.from(this.eventAttendances.values()).filter(
      a => a.eventId === eventId && (a.rsvpStatus === 'GOING' || a.rsvpStatus === 'INTERESTED')
    );
  }

  public getRsvp(eventId: CommunityEventId, profileId: CommunityProfileId): EventAttendance | undefined {
    return Array.from(this.eventAttendances.values()).find(
      a => a.eventId === eventId && a.profileId === profileId
    );
  }

  // --- Recovery Alert Queries ---
  public getAlertByIncidentId(incidentId: LostPetIncidentId): CommunityRecoveryAlert | undefined {
    const alertId = this.incidentToAlertMap.get(incidentId);
    return alertId ? this.recoveryAlerts.get(alertId) : undefined;
  }

  public getActiveRecoveryAlerts(): CommunityRecoveryAlert[] {
    return Array.from(this.recoveryAlerts.values())
      .filter(a => a.status === 'ACTIVE' || a.status === 'SEARCH_IN_PROGRESS')
      .sort((a, b) => new Date(b.activatedAt).getTime() - new Date(a.activatedAt).getTime());
  }
}
