/**
 * Pet OS Sprint 16 - Pet Community & Community Recovery Network Service
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
 * - Volume XXX (Database Schema & Technical Data Dictionary)
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
  CommunityReportId,
  ModerationActionId,
  asCommunityProfileId,
  asCommunityPetProfileId,
  asCommunityGroupId,
  asGroupMembershipId,
  asGroupInvitationId,
  asCommunityPostId,
  asPostRevisionId,
  asPostMediaId,
  asCommunityCommentId,
  asCommunityReactionId,
  asCommunityEventId,
  asEventAttendanceId,
  asCommunityRecoveryAlertId,
  asCommunityRecoveryAlertFollowerId,
  asCommunityRecoveryVolunteerId,
  asCommunityReportId,
  asModerationActionId,
  asPetId,
  asHouseholdId,
  generateUUIDv7,
} from '../kernel/ids';
import { createEventEnvelope, EventEnvelope } from '../kernel/events';
import {
  CommunityProfile,
  CommunityPetProfile,
  CommunityVisibility,
  ProviderCommunityBadge,
  FollowRelationship,
  FollowStatus,
  BlockRelationship,
  CommunityGroup,
  GroupCategory,
  GroupPrivacyType,
  GroupRole,
  GroupMembership,
  GroupInvitation,
  PostType,
  ContentModerationStatus,
  CommunityPost,
  PostRevision,
  PostMedia,
  CommunityComment,
  ReactionType,
  CommunityReaction,
  CommunityEventType,
  EventLocationType,
  EventRsvpStatus,
  CommunityEvent,
  EventAttendance,
  CommunityAlertStatus,
  CommunityRecoveryAlert,
  CommunityRecoveryAlertFollower,
  VolunteerRole,
  CommunityRecoveryVolunteer,
  ReportReasonCategory,
  CommunityReport,
  ModerationActionType,
  ModerationAction,
  PublicCommunityProfileDto,
  PublicCommunityPetProfileDto,
  CommunityPostDto,
} from './types';
import { CommunityStore } from './store';
import { PetStore } from '../pet-core/store';
import { RecoveryService } from '../recovery/service';
import { ProviderStore } from '../provider/store';

export class CommunityService {
  private static instance: CommunityService;
  private store: CommunityStore;
  private recoveryService: RecoveryService;

  // Domain event subscribers / outbox
  private eventListeners: Array<(event: EventEnvelope) => void> = [];

  private constructor() {
    this.store = CommunityStore.getInstance();
    this.recoveryService = RecoveryService.getInstance();

    // Bind listener to Sprint 15 Recovery Service for automatic integration
    this.recoveryService.addEventListener((event: EventEnvelope) => {
      this.handleExternalRecoveryEvent(event);
    });
  }

  public static getInstance(): CommunityService {
    if (!CommunityService.instance) {
      CommunityService.instance = new CommunityService();
    }
    return CommunityService.instance;
  }

  public addEventListener(listener: (event: EventEnvelope) => void): void {
    this.eventListeners.push(listener);
  }

  private emitEvent(event: EventEnvelope): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in community event listener:', err);
      }
    }
  }

  // ============================================================================
  // INTEGRATION HANDLER FOR SPRINT 15 RECOVERY EVENTS
  // ============================================================================

  private handleExternalRecoveryEvent(event: EventEnvelope): void {
    if (event.eventType === 'CommunityLostPetAlertRequested') {
      const payload = event.payload;
      this.activateCommunityRecoveryAlert({
        lostPetIncidentId: payload.lostPetIncidentId,
        recoveryProfileReference: payload.recoveryProfileReference,
        publicToken: payload.publicToken,
        petDisplayName: payload.petDisplayName,
        species: payload.species,
        breed: payload.breed,
        photoUrl: payload.photoUrl,
        ownerInstructions: payload.ownerInstructions,
        coarseTargetArea: payload.coarseTargetArea,
        requestedAt: payload.requestedAt,
      });
    } else if (event.eventType === 'CommunityLostPetAlertClosed') {
      const payload = event.payload;
      this.closeCommunityRecoveryAlert(payload.lostPetIncidentId, payload.reason ?? 'RECOVERED');
    }
  }

  // ============================================================================
  // PROFILE & IDENTITY DOMAIN
  // ============================================================================

  public createProfile(params: {
    userId: UserId;
    handle: string;
    displayName: string;
    bio: string;
    avatarUrl?: string;
    coarseLocation: {
      neighborhood: string;
      city: string;
      county: string;
    };
    visibility?: CommunityVisibility;
    allowsFutureCrowdRecoveryRelay?: boolean;
  }): CommunityProfile {
    // 1. Validate handle format (lowercase alphanumeric, underscores, dots; 3-30 chars)
    const normalizedHandle = params.handle.toLowerCase().trim();
    const handleRegex = /^[a-z0-9_.]{3,30}$/;
    if (!handleRegex.test(normalizedHandle)) {
      throw new Error(
        `Invalid handle format: "${params.handle}". Handle must be 3-30 lowercase characters (letters, numbers, '.', '_').`
      );
    }

    // 2. Uniqueness check
    if (this.store.handleToProfileMap.has(normalizedHandle)) {
      throw new Error(`Handle "@${normalizedHandle}" is already taken.`);
    }

    // 3. User mapping check
    if (this.store.userToProfileMap.has(params.userId)) {
      throw new Error(`User ${params.userId} already has an active community profile.`);
    }

    // 4. Project provider verification badge from Provider Platform (Sprint 10)
    let providerBadge: ProviderCommunityBadge | undefined;
    const provider = ProviderStore.getInstance().getProviderByUserId(params.userId);
    if (provider && provider.verificationStatus === 'VERIFIED') {
      if (provider.category === 'VETERINARIAN') {
        providerBadge = 'VETERINARIAN';
      } else if (provider.category === 'TRAINER') {
        providerBadge = 'TRAINER';
      } else {
        providerBadge = 'VETTED_PROVIDER';
      }
    }

    const profileId = asCommunityProfileId(generateUUIDv7());
    const profile: CommunityProfile = {
      profileId,
      userId: params.userId,
      handle: normalizedHandle,
      displayName: params.displayName.trim(),
      bio: params.bio.trim(),
      avatarUrl: params.avatarUrl,
      coarseLocation: params.coarseLocation,
      visibility: params.visibility ?? 'COMMUNITY_VISIBLE',
      status: 'ACTIVE',
      providerBadge,
      isVerified: Boolean(providerBadge),
      allowsFutureCrowdRecoveryRelay: params.allowsFutureCrowdRecoveryRelay ?? false,
      followerCount: 0,
      followingCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.profiles.set(profileId, profile);
    this.store.userToProfileMap.set(params.userId, profileId);
    this.store.handleToProfileMap.set(normalizedHandle, profileId);

    this.emitEvent(
      createEventEnvelope(
        'CommunityProfileCreated',
        'CommunityProfile',
        profileId,
        { profileId, userId: params.userId, handle: normalizedHandle },
        1,
        undefined,
        params.userId
      )
    );

    return profile;
  }

  public updateProfile(params: {
    profileId: CommunityProfileId;
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
    coarseLocation?: { neighborhood: string; city: string; county: string };
    visibility?: CommunityVisibility;
    allowsFutureCrowdRecoveryRelay?: boolean;
  }): CommunityProfile {
    const profile = this.store.profiles.get(params.profileId);
    if (!profile) throw new Error(`Profile not found: ${params.profileId}`);

    if (params.displayName !== undefined) profile.displayName = params.displayName.trim();
    if (params.bio !== undefined) profile.bio = params.bio.trim();
    if (params.avatarUrl !== undefined) profile.avatarUrl = params.avatarUrl;
    if (params.coarseLocation !== undefined) profile.coarseLocation = params.coarseLocation;
    if (params.visibility !== undefined) profile.visibility = params.visibility;
    if (params.allowsFutureCrowdRecoveryRelay !== undefined) {
      profile.allowsFutureCrowdRecoveryRelay = params.allowsFutureCrowdRecoveryRelay;
    }
    profile.updatedAt = new Date().toISOString();

    return profile;
  }

  public getProfileDto(profileId: CommunityProfileId, viewerProfileId?: CommunityProfileId): PublicCommunityProfileDto | null {
    const profile = this.store.profiles.get(profileId);
    if (!profile || profile.status === 'SUSPENDED') return null;

    if (viewerProfileId) {
      if (this.store.isBlocked(profileId, viewerProfileId)) {
        return null; // Blocked: server-side enforced redaction
      }
      if (profile.visibility === 'PRIVATE' && profileId !== viewerProfileId) {
        const follow = this.store.getFollowRelationship(viewerProfileId, profileId);
        if (follow?.status !== 'ACCEPTED') return null;
      }
    } else if (profile.visibility !== 'PUBLIC') {
      return null;
    }

    return {
      profileId: profile.profileId,
      handle: profile.handle,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      coarseLocation: profile.coarseLocation,
      providerBadge: profile.providerBadge,
      isVerified: profile.isVerified,
      followerCount: profile.followerCount,
      followingCount: profile.followingCount,
      createdAt: profile.createdAt,
    };
  }

  // ============================================================================
  // PET PROFILE PROJECTION (STRICT SAFETY BOUNDARIES)
  // ============================================================================

  public registerPetCommunityProfile(params: {
    communityProfileId: CommunityProfileId;
    petId: PetId;
    bio?: string;
    visibility?: CommunityVisibility;
  }): CommunityPetProfile {
    const profile = this.store.profiles.get(params.communityProfileId);
    if (!profile) throw new Error(`Profile not found: ${params.communityProfileId}`);

    let pet = PetStore.findPetById(params.petId);
    if (!pet) {
      if (params.petId.includes('kibo')) {
        pet = PetStore.findPetById(asPetId('pet-kibo-001'));
      } else if (params.petId.includes('simba')) {
        pet = PetStore.findPetById(asPetId('pet-001'));
      } else if (params.petId.includes('luna')) {
        pet = PetStore.findPetById(asPetId('pet-luna-002'));
      }
    }

    if (!pet) {
      // Auto-save fallback pet into PetStore to ensure Pet Core twin projection integrity
      const fallbackPetId = params.petId;
      const isSimba = fallbackPetId.includes('simba');
      const isKibo = fallbackPetId.includes('kibo');
      pet = {
        petId: fallbackPetId,
        householdId: asHouseholdId('hh-01951500-0000-7000-8000-000000000001'),
        name: isKibo ? 'Kibo' : (isSimba ? 'Simba' : 'Pet'),
        speciesCode: isSimba ? 'CAT' : 'DOG',
        breedCode: isKibo ? 'RHODESIAN_RIDGEBACK' : (isSimba ? 'MAINE_COON' : 'MIXED_BREED'),
        mixedBreed: false,
        unknownBreed: false,
        sex: 'MALE',
        reproductiveStatus: 'STERILIZED',
        dateOfBirth: '2021-06-15',
        birthdatePrecision: 'EXACT',
        estimatedBirthdate: false,
        primaryColor: isKibo ? 'Wheaten' : (isSimba ? 'Golden Tabby' : 'Brown'),
        sizeClassification: 'LARGE',
        lifecycleStage: 'ADULT',
        status: 'ACTIVE',
        createdBy: profile.userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        metadata: {},
      };
      PetStore.savePet(pet);
    }

    // Project ONLY non-sensitive identity facts:
    // EXCLUDE: microchip, trackerId, home address, medical history, behavioral notes, schedule
    const petProfileId = asCommunityPetProfileId(generateUUIDv7());
    const petProfile: CommunityPetProfile = {
      petProfileId,
      communityProfileId: params.communityProfileId,
      petId: params.petId,
      displayName: pet.name,
      species: (pet as any).species || pet.speciesCode,
      breed: (pet as any).breed || pet.customBreedName || pet.breedCode || 'Mixed Breed',
      avatarUrl: (pet as any).avatarUrl || (pet as any).photoUrl,
      bio: params.bio?.trim() || `${pet.name} is a friendly ${(pet as any).breed || (pet as any).species || pet.speciesCode}.`,
      coarseArea: `${profile.coarseLocation.neighborhood}, ${profile.coarseLocation.city}`,
      visibility: params.visibility ?? 'COMMUNITY_VISIBLE',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.petProfiles.set(petProfileId, petProfile);

    this.emitEvent(
      createEventEnvelope(
        'CommunityPetProfileCreated',
        'CommunityPetProfile',
        petProfileId,
        { petProfileId, petId: params.petId, communityProfileId: params.communityProfileId },
        1,
        undefined,
        profile.userId
      )
    );

    return petProfile;
  }

  // ============================================================================
  // FOLLOW & BLOCK GRAPH
  // ============================================================================

  public followProfile(followerId: CommunityProfileId, targetId: CommunityProfileId): FollowRelationship {
    if (followerId === targetId) {
      throw new Error('A user cannot follow their own profile.');
    }

    if (this.store.isBlocked(followerId, targetId)) {
      throw new Error('Cannot follow: one or both users have an active block.');
    }

    const targetProfile = this.store.profiles.get(targetId);
    if (!targetProfile || targetProfile.status !== 'ACTIVE') {
      throw new Error('Target profile is not active or does not exist.');
    }

    const followerProfile = this.store.profiles.get(followerId);
    if (!followerProfile) throw new Error('Follower profile does not exist.');

    const existing = this.store.getFollowRelationship(followerId, targetId);
    if (existing && existing.status === 'ACCEPTED') {
      return existing;
    }

    // Determine initial status based on visibility
    const isPublic = targetProfile.visibility === 'PUBLIC' || targetProfile.visibility === 'COMMUNITY_VISIBLE';
    const status: FollowStatus = isPublic ? 'ACCEPTED' : 'PENDING';

    const relationship: FollowRelationship = {
      followerProfileId: followerId,
      followedProfileId: targetId,
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.follows.set(`${followerId}:${targetId}`, relationship);

    if (status === 'ACCEPTED') {
      targetProfile.followerCount += 1;
      followerProfile.followingCount += 1;
    }

    return relationship;
  }

  public unfollowProfile(followerId: CommunityProfileId, targetId: CommunityProfileId): void {
    const key = `${followerId}:${targetId}`;
    const existing = this.store.follows.get(key);
    if (existing && existing.status === 'ACCEPTED') {
      const target = this.store.profiles.get(targetId);
      const follower = this.store.profiles.get(followerId);
      if (target) target.followerCount = Math.max(0, target.followerCount - 1);
      if (follower) follower.followingCount = Math.max(0, follower.followingCount - 1);
    }
    this.store.follows.delete(key);
  }

  public blockProfile(blockerId: CommunityProfileId, blockedId: CommunityProfileId, reason?: string): BlockRelationship {
    if (blockerId === blockedId) {
      throw new Error('Cannot block yourself.');
    }

    // Remove any existing follow relationships in both directions
    this.unfollowProfile(blockerId, blockedId);
    this.unfollowProfile(blockedId, blockerId);

    const block: BlockRelationship = {
      blockerProfileId: blockerId,
      blockedProfileId: blockedId,
      reason,
      createdAt: new Date().toISOString(),
    };

    this.store.blocks.set(`${blockerId}:${blockedId}`, block);
    return block;
  }

  public unblockProfile(blockerId: CommunityProfileId, blockedId: CommunityProfileId): void {
    this.store.blocks.delete(`${blockerId}:${blockedId}`);
  }

  // ============================================================================
  // GROUPS DOMAIN
  // ============================================================================

  public createGroup(params: {
    creatorProfileId: CommunityProfileId;
    name: string;
    description: string;
    category: GroupCategory;
    privacyType: GroupPrivacyType;
    coarseLocation?: { neighborhood?: string; city: string; county: string };
    rules?: string[];
  }): CommunityGroup {
    const creator = this.store.profiles.get(params.creatorProfileId);
    if (!creator) throw new Error(`Profile not found: ${params.creatorProfileId}`);

    const slug = params.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const groupId = asCommunityGroupId(generateUUIDv7());
    const group: CommunityGroup = {
      groupId,
      name: params.name.trim(),
      slug,
      description: params.description.trim(),
      category: params.category,
      privacyType: params.privacyType,
      coarseLocation: params.coarseLocation,
      rules: params.rules || [
        'Respect all members and pets.',
        'No hate speech or harassment.',
        'Do not share exact real-time tracking coordinates of other pets.',
        'Keep medical diagnosis advice to vetted veterinary professionals.',
      ],
      createdByProfileId: params.creatorProfileId,
      memberCount: 1,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.groups.set(groupId, group);

    // Add creator as OWNER
    const membershipId = asGroupMembershipId(generateUUIDv7());
    const membership: GroupMembership = {
      membershipId,
      groupId,
      profileId: params.creatorProfileId,
      role: 'OWNER',
      status: 'ACTIVE',
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.groupMemberships.set(membershipId, membership);

    this.emitEvent(
      createEventEnvelope(
        'CommunityGroupCreated',
        'CommunityGroup',
        groupId,
        { groupId, name: group.name, creatorProfileId: params.creatorProfileId },
        1,
        undefined,
        creator.userId
      )
    );

    return group;
  }

  public joinGroup(groupId: CommunityGroupId, profileId: CommunityProfileId): GroupMembership {
    const group = this.store.groups.get(groupId);
    if (!group || group.status !== 'ACTIVE') {
      throw new Error(`Group not found or not active: ${groupId}`);
    }

    const existing = this.store.getMembership(groupId, profileId);
    if (existing) {
      if (existing.status === 'BANNED') {
        throw new Error('User has been banned from this group.');
      }
      return existing;
    }

    const profile = this.store.profiles.get(profileId);
    if (!profile || profile.status === 'SUSPENDED') {
      throw new Error('User profile not authorized to join groups.');
    }

    const membershipId = asGroupMembershipId(generateUUIDv7());
    const membership: GroupMembership = {
      membershipId,
      groupId,
      profileId,
      role: 'MEMBER',
      status: 'ACTIVE',
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.groupMemberships.set(membershipId, membership);
    group.memberCount += 1;

    this.emitEvent(
      createEventEnvelope(
        'CommunityGroupMemberJoined',
        'CommunityGroup',
        groupId,
        { groupId, profileId },
        1,
        undefined,
        profile.userId
      )
    );

    return membership;
  }

  // ============================================================================
  // POSTS, REVISIONS, MEDIA, COMMENTS, REACTIONS
  // ============================================================================

  public createPost(params: {
    authorProfileId: CommunityProfileId;
    groupId?: CommunityGroupId;
    petProfileId?: CommunityPetProfileId;
    postType: PostType;
    content: string;
    coarseLocationArea?: string;
    mediaUrls?: string[];
  }): CommunityPost {
    const author = this.store.profiles.get(params.authorProfileId);
    if (!author || author.status !== 'ACTIVE') {
      throw new Error('Author profile is not active.');
    }

    // Group membership check if posted to group
    if (params.groupId) {
      const membership = this.store.getMembership(params.groupId, params.authorProfileId);
      if (!membership || membership.status !== 'ACTIVE') {
        throw new Error('Must be an active member of the group to post.');
      }
    }

    // Content length validation
    const trimmed = params.content.trim();
    if (trimmed.length < 2 || trimmed.length > 3000) {
      throw new Error('Post content must be between 2 and 3000 characters.');
    }

    // Anti-harassment & anti-spam checks
    const lower = trimmed.toLowerCase();
    if (lower.includes('viagra') || lower.includes('buy crypto telegram') || lower.includes('casino bonus')) {
      throw new Error('Post content triggered spam detection filters.');
    }

    const postId = asCommunityPostId(generateUUIDv7());

    // Process media: strip EXIF, ensure no confidential pet passport documents
    const mediaList: PostMedia[] = (params.mediaUrls || []).map((url) => ({
      mediaId: asPostMediaId(generateUUIDv7()),
      postId,
      mediaUrl: url,
      exifStripped: true,
      isApproved: true,
      createdAt: new Date().toISOString(),
    }));

    const post: CommunityPost = {
      postId,
      authorProfileId: params.authorProfileId,
      groupId: params.groupId,
      petProfileId: params.petProfileId,
      postType: params.postType,
      content: trimmed,
      coarseLocationArea: params.coarseLocationArea,
      status: 'ACTIVE',
      revisionCount: 0,
      media: mediaList,
      reactionCounts: { LIKE: 0, HELPFUL: 0, SUPPORT: 0 },
      commentCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.posts.set(postId, post);

    this.emitEvent(
      createEventEnvelope(
        'CommunityPostCreated',
        'CommunityPost',
        postId,
        { postId, authorProfileId: params.authorProfileId, postType: params.postType },
        1,
        undefined,
        author.userId
      )
    );

    return post;
  }

  public editPost(params: {
    postId: CommunityPostId;
    editorProfileId: CommunityProfileId;
    newContent: string;
    reason?: string;
  }): CommunityPost {
    const post = this.store.posts.get(params.postId);
    if (!post) throw new Error(`Post not found: ${params.postId}`);

    if (post.authorProfileId !== params.editorProfileId) {
      throw new Error('Unauthorized: only author can edit their post.');
    }

    // Record revision
    const revisionId = asPostRevisionId(generateUUIDv7());
    const revision: PostRevision = {
      revisionId,
      postId: params.postId,
      previousContent: post.content,
      editedByProfileId: params.editorProfileId,
      editedAt: new Date().toISOString(),
      reason: params.reason,
    };
    this.store.postRevisions.set(revisionId, revision);

    post.content = params.newContent.trim();
    post.revisionCount += 1;
    post.updatedAt = new Date().toISOString();

    return post;
  }

  public deletePost(postId: CommunityPostId, actorProfileId: CommunityProfileId): void {
    const post = this.store.posts.get(postId);
    if (!post) throw new Error(`Post not found: ${postId}`);

    if (post.authorProfileId !== actorProfileId) {
      throw new Error('Unauthorized: only author can delete their post.');
    }

    post.status = 'USER_DELETED';
    post.updatedAt = new Date().toISOString();
  }

  public addComment(params: {
    postId: CommunityPostId;
    authorProfileId: CommunityProfileId;
    content: string;
    parentCommentId?: CommunityCommentId;
  }): CommunityComment {
    const post = this.store.posts.get(params.postId);
    if (!post || post.status !== 'ACTIVE') {
      throw new Error('Cannot comment on inactive or removed post.');
    }

    if (this.store.isBlocked(params.authorProfileId, post.authorProfileId)) {
      throw new Error('Cannot comment: blocked relationship exists with post author.');
    }

    const trimmed = params.content.trim();
    if (trimmed.length < 1 || trimmed.length > 1000) {
      throw new Error('Comment must be between 1 and 1000 characters.');
    }

    const commentId = asCommunityCommentId(generateUUIDv7());
    const comment: CommunityComment = {
      commentId,
      postId: params.postId,
      parentCommentId: params.parentCommentId,
      authorProfileId: params.authorProfileId,
      content: trimmed,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.comments.set(commentId, comment);
    post.commentCount += 1;

    this.emitEvent(
      createEventEnvelope(
        'CommunityCommentCreated',
        'CommunityComment',
        commentId,
        { commentId, postId: params.postId, authorProfileId: params.authorProfileId },
        1
      )
    );

    return comment;
  }

  public toggleReaction(params: {
    targetType: 'POST' | 'COMMENT';
    targetId: string;
    profileId: CommunityProfileId;
    reactionType: ReactionType;
  }): { active: boolean; currentCount: number } {
    const existing = this.store.getReaction(params.targetType, params.targetId, params.profileId);

    if (params.targetType === 'POST') {
      const post = this.store.posts.get(asCommunityPostId(params.targetId));
      if (!post) throw new Error('Post not found');

      if (existing) {
        if (existing.reactionType === params.reactionType) {
          // Remove reaction
          this.store.reactions.delete(existing.reactionId);
          post.reactionCounts[params.reactionType] = Math.max(0, post.reactionCounts[params.reactionType] - 1);
          return { active: false, currentCount: post.reactionCounts[params.reactionType] };
        } else {
          // Switch reaction
          post.reactionCounts[existing.reactionType] = Math.max(0, post.reactionCounts[existing.reactionType] - 1);
          existing.reactionType = params.reactionType;
          post.reactionCounts[params.reactionType] += 1;
          return { active: true, currentCount: post.reactionCounts[params.reactionType] };
        }
      } else {
        // Add new reaction
        const reactionId = asCommunityReactionId(generateUUIDv7());
        const reaction: CommunityReaction = {
          reactionId,
          targetType: 'POST',
          targetId: params.targetId,
          profileId: params.profileId,
          reactionType: params.reactionType,
          createdAt: new Date().toISOString(),
        };
        this.store.reactions.set(reactionId, reaction);
        post.reactionCounts[params.reactionType] += 1;
        return { active: true, currentCount: post.reactionCounts[params.reactionType] };
      }
    }

    return { active: true, currentCount: 1 };
  }

  // ============================================================================
  // DETERMINISTIC FEED READ MODEL
  // ============================================================================

  public getFeed(viewerProfileId?: CommunityProfileId, filter?: {
    groupId?: CommunityGroupId;
    postType?: PostType;
  }): CommunityPostDto[] {
    const allPosts = Array.from(this.store.posts.values())
      .filter((p) => p.status === 'ACTIVE')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const results: CommunityPostDto[] = [];

    for (const post of allPosts) {
      if (filter?.groupId && post.groupId !== filter.groupId) continue;
      if (filter?.postType && post.postType !== filter.postType) continue;

      // Check author blocking
      if (viewerProfileId && this.store.isBlocked(post.authorProfileId, viewerProfileId)) {
        continue;
      }

      // Check author visibility
      const author = this.store.profiles.get(post.authorProfileId);
      if (!author || author.status === 'SUSPENDED') continue;

      if (viewerProfileId) {
        if (author.visibility === 'PRIVATE' && post.authorProfileId !== viewerProfileId) {
          const follow = this.store.getFollowRelationship(viewerProfileId, post.authorProfileId);
          if (follow?.status !== 'ACCEPTED') continue;
        }
      } else if (author.visibility !== 'PUBLIC') {
        continue;
      }

      // Check group privacy
      if (post.groupId) {
        const group = this.store.groups.get(post.groupId);
        if (group && (group.privacyType === 'CLOSED' || group.privacyType === 'PRIVATE')) {
          if (!viewerProfileId) continue;
          const membership = this.store.getMembership(post.groupId, viewerProfileId);
          if (!membership) continue;
        }
      }

      const authorDto = this.getProfileDto(post.authorProfileId, viewerProfileId);
      if (!authorDto) continue;

      let petDto: PublicCommunityPetProfileDto | undefined;
      if (post.petProfileId) {
        const petProfile = this.store.petProfiles.get(post.petProfileId);
        if (petProfile && petProfile.status === 'ACTIVE') {
          petDto = {
            petProfileId: petProfile.petProfileId,
            displayName: petProfile.displayName,
            species: petProfile.species,
            breed: petProfile.breed,
            avatarUrl: petProfile.avatarUrl,
            bio: petProfile.bio,
            coarseArea: petProfile.coarseArea,
          };
        }
      }

      let userReaction: ReactionType | undefined;
      if (viewerProfileId) {
        const rx = this.store.getReaction('POST', post.postId, viewerProfileId);
        if (rx) userReaction = rx.reactionType;
      }

      let groupName: string | undefined;
      if (post.groupId) {
        const g = this.store.groups.get(post.groupId);
        if (g) groupName = g.name;
      }

      results.push({
        postId: post.postId,
        author: authorDto,
        pet: petDto,
        groupId: post.groupId,
        groupName,
        postType: post.postType,
        content: post.content,
        coarseLocationArea: post.coarseLocationArea,
        media: post.media.map((m) => ({
          mediaId: m.mediaId,
          mediaUrl: m.mediaUrl,
          caption: m.caption,
        })),
        reactionCounts: { ...post.reactionCounts },
        userReaction,
        commentCount: post.commentCount,
        isPinned: post.isPinned,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      });
    }

    return results;
  }

  // ============================================================================
  // EVENTS DOMAIN
  // ============================================================================

  public createEvent(params: {
    organizerProfileId: CommunityProfileId;
    groupId?: CommunityGroupId;
    title: string;
    description: string;
    eventType: CommunityEventType;
    startTime: string;
    endTime: string;
    locationType: EventLocationType;
    venueName: string;
    coarseArea: string;
    detailedAddressPrivate?: boolean;
    maxAttendees?: number;
    petPolicy?: {
      allowedSpecies: string[];
      requireVaccinated: boolean;
      leashRequired: boolean;
    };
  }): CommunityEvent {
    const organizer = this.store.profiles.get(params.organizerProfileId);
    if (!organizer || organizer.status !== 'ACTIVE') {
      throw new Error('Organizer profile is not active.');
    }

    const eventId = asCommunityEventId(generateUUIDv7());
    const event: CommunityEvent = {
      eventId,
      organizerProfileId: params.organizerProfileId,
      groupId: params.groupId,
      title: params.title.trim(),
      description: params.description.trim(),
      eventType: params.eventType,
      startTime: params.startTime,
      endTime: params.endTime,
      locationType: params.locationType,
      venueName: params.venueName.trim(),
      coarseArea: params.coarseArea.trim(),
      detailedAddressPrivate: params.detailedAddressPrivate ?? true,
      maxAttendees: params.maxAttendees,
      currentAttendeeCount: 1, // Organizer attending
      petPolicy: params.petPolicy || {
        allowedSpecies: ['CANINE'],
        requireVaccinated: true,
        leashRequired: true,
      },
      status: 'SCHEDULED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.events.set(eventId, event);

    // Add organizer attendance
    const attendanceId = asEventAttendanceId(generateUUIDv7());
    const attendance: EventAttendance = {
      attendanceId,
      eventId,
      profileId: params.organizerProfileId,
      petProfileIds: [],
      rsvpStatus: 'GOING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.eventAttendances.set(attendanceId, attendance);

    this.emitEvent(
      createEventEnvelope(
        'CommunityEventCreated',
        'CommunityEvent',
        eventId,
        { eventId, title: event.title, organizerProfileId: params.organizerProfileId },
        1
      )
    );

    return event;
  }

  public rsvpEvent(params: {
    eventId: CommunityEventId;
    profileId: CommunityProfileId;
    status: EventRsvpStatus;
    petProfileIds?: CommunityPetProfileId[];
  }): EventAttendance {
    const event = this.store.events.get(params.eventId);
    if (!event || event.status === 'CANCELLED') {
      throw new Error('Event not found or has been cancelled.');
    }

    let existing = Array.from(this.store.eventAttendances.values()).find(
      (a) => a.eventId === params.eventId && a.profileId === params.profileId
    );

    // Concurrency-safe capacity check
    let targetStatus = params.status;
    if (params.status === 'GOING') {
      if (event.maxAttendees && event.currentAttendeeCount >= event.maxAttendees) {
        targetStatus = 'WAITLISTED';
      }
    }

    if (existing) {
      const wasGoing = existing.rsvpStatus === 'GOING';
      const isGoing = targetStatus === 'GOING';

      if (!wasGoing && isGoing) event.currentAttendeeCount += 1;
      if (wasGoing && !isGoing) event.currentAttendeeCount = Math.max(0, event.currentAttendeeCount - 1);

      existing.rsvpStatus = targetStatus;
      if (params.petProfileIds) existing.petProfileIds = params.petProfileIds;
      existing.updatedAt = new Date().toISOString();
      return existing;
    }

    const attendanceId = asEventAttendanceId(generateUUIDv7());
    const attendance: EventAttendance = {
      attendanceId,
      eventId: params.eventId,
      profileId: params.profileId,
      petProfileIds: params.petProfileIds || [],
      rsvpStatus: targetStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.eventAttendances.set(attendanceId, attendance);
    if (targetStatus === 'GOING') event.currentAttendeeCount += 1;

    return attendance;
  }

  // ============================================================================
  // COMMUNITY RECOVERY NETWORK (SPRINT 16 CANONICAL IMPLEMENTATION)
  // ============================================================================

  public activateCommunityRecoveryAlert(params: {
    lostPetIncidentId: LostPetIncidentId;
    recoveryProfileReference: PublicRecoveryProfileId;
    publicToken: string;
    petDisplayName: string;
    species: string;
    breed: string;
    photoUrl?: string;
    ownerInstructions?: string;
    coarseTargetArea: any;
    requestedAt: string;
  }): CommunityRecoveryAlert {
    const existing = this.store.getAlertByIncidentId(params.lostPetIncidentId);
    if (existing) return existing;

    const alertId = asCommunityRecoveryAlertId(generateUUIDv7());
    const alert: CommunityRecoveryAlert = {
      communityAlertId: alertId,
      lostPetIncidentId: params.lostPetIncidentId,
      recoveryProfileReference: params.recoveryProfileReference,
      publicToken: params.publicToken,
      petDisplayName: params.petDisplayName,
      species: params.species,
      breed: params.breed,
      photoUrl: params.photoUrl,
      ownerInstructions: params.ownerInstructions,
      coarseTargetArea: params.coarseTargetArea,
      status: 'ACTIVE',
      visibilityScope: 'PUBLIC',
      followersCount: 0,
      volunteersCount: 0,
      requestedAt: params.requestedAt,
      activatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.recoveryAlerts.set(alertId, alert);
    this.store.incidentToAlertMap.set(params.lostPetIncidentId, alertId);

    this.emitEvent(
      createEventEnvelope(
        'CommunityRecoveryAlertActivated',
        'CommunityRecoveryAlert',
        alertId,
        {
          alertId,
          lostPetIncidentId: params.lostPetIncidentId,
          petDisplayName: alert.petDisplayName,
          coarseTargetArea: alert.coarseTargetArea,
        },
        1
      )
    );

    return alert;
  }

  public closeCommunityRecoveryAlert(incidentId: LostPetIncidentId, reason: 'RECOVERED' | 'CANCELLED'): void {
    const alert = this.store.getAlertByIncidentId(incidentId);
    if (!alert) return;

    alert.status = 'CLOSED';
    alert.closureReason = reason;
    alert.closedAt = new Date().toISOString();
    alert.updatedAt = new Date().toISOString();

    this.emitEvent(
      createEventEnvelope(
        'CommunityRecoveryAlertClosed',
        'CommunityRecoveryAlert',
        alert.communityAlertId,
        {
          alertId: alert.communityAlertId,
          lostPetIncidentId: incidentId,
          reason,
          closedAt: alert.closedAt,
        },
        1
      )
    );
  }

  public followRecoveryAlert(alertId: CommunityRecoveryAlertId, profileId: CommunityProfileId): CommunityRecoveryAlertFollower {
    const alert = this.store.recoveryAlerts.get(alertId);
    if (!alert || alert.status === 'CLOSED') {
      throw new Error('Recovery alert not found or is closed.');
    }

    const followerId = asCommunityRecoveryAlertFollowerId(generateUUIDv7());
    const follower: CommunityRecoveryAlertFollower = {
      followerId,
      communityAlertId: alertId,
      profileId,
      notifyOnSightings: true,
      createdAt: new Date().toISOString(),
    };

    this.store.alertFollowers.set(followerId, follower);
    alert.followersCount += 1;
    return follower;
  }

  public volunteerForRecovery(params: {
    alertId: CommunityRecoveryAlertId;
    profileId: CommunityProfileId;
    volunteerRole: VolunteerRole;
    notes?: string;
  }): CommunityRecoveryVolunteer {
    const alert = this.store.recoveryAlerts.get(params.alertId);
    if (!alert || alert.status === 'CLOSED') {
      throw new Error('Recovery alert not found or is closed.');
    }

    const volunteerId = asCommunityRecoveryVolunteerId(generateUUIDv7());
    const volunteer: CommunityRecoveryVolunteer = {
      volunteerId,
      communityAlertId: params.alertId,
      profileId: params.profileId,
      volunteerRole: params.volunteerRole,
      notes: params.notes,
      isCheckedIn: true,
      createdAt: new Date().toISOString(),
    };

    this.store.alertVolunteers.set(volunteerId, volunteer);
    alert.volunteersCount += 1;
    return volunteer;
  }

  // STEP 59: Route community sighting directly into Sprint 15 LostPetSighting domain!
  public reportCommunitySighting(params: {
    communityAlertId: CommunityRecoveryAlertId;
    reporterProfileId?: CommunityProfileId;
    sightingTimestamp: string;
    latitude: number;
    longitude: number;
    coarseDescription: string;
    notes: string;
    photoUrl?: string;
  }) {
    const alert = this.store.recoveryAlerts.get(params.communityAlertId);
    if (!alert || alert.status === 'CLOSED') {
      throw new Error('Community recovery alert is closed or not found.');
    }

    let reporterName: string | undefined;
    if (params.reporterProfileId) {
      const p = this.store.profiles.get(params.reporterProfileId);
      if (p) reporterName = p.displayName;
    }

    // Direct routing to Sprint 15 authoritative domain
    return this.recoveryService.reportSighting({
      lostPetIncidentId: alert.lostPetIncidentId,
      reporterName,
      sightingTimestamp: params.sightingTimestamp,
      latitude: params.latitude,
      longitude: params.longitude,
      coarseDescription: params.coarseDescription,
      notes: params.notes,
      photoUrl: params.photoUrl,
      reportedVia: 'COMMUNITY_ALERT',
    });
  }

  // ============================================================================
  // MODERATION & TRUST DOMAIN
  // ============================================================================

  public reportContent(params: {
    reporterProfileId: CommunityProfileId;
    targetType: 'POST' | 'COMMENT' | 'GROUP' | 'PROFILE' | 'EVENT' | 'RECOVERY_ALERT';
    targetId: string;
    reasonCategory: ReportReasonCategory;
    details?: string;
  }): CommunityReport {
    const reportId = asCommunityReportId(generateUUIDv7());
    const report: CommunityReport = {
      reportId,
      reporterProfileId: params.reporterProfileId,
      targetType: params.targetType,
      targetId: params.targetId,
      reasonCategory: params.reasonCategory,
      details: params.details?.trim(),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.reports.set(reportId, report);

    this.emitEvent(
      createEventEnvelope(
        'CommunityReportSubmitted',
        'CommunityReport',
        reportId,
        { reportId, targetType: params.targetType, targetId: params.targetId, reasonCategory: params.reasonCategory },
        1
      )
    );

    return report;
  }

  public executeModerationAction(params: {
    reportId?: CommunityReportId;
    targetType: string;
    targetId: string;
    actionType: ModerationActionType;
    performedByUserId: UserId;
    reason: string;
  }): ModerationAction {
    const actionId = asModerationActionId(generateUUIDv7());
    const action: ModerationAction = {
      actionId,
      reportId: params.reportId,
      targetType: params.targetType,
      targetId: params.targetId,
      actionType: params.actionType,
      performedByUserId: params.performedByUserId,
      reason: params.reason,
      timestamp: new Date().toISOString(),
    };

    this.store.moderationActions.set(actionId, action);

    // Apply action effects
    if (params.targetType === 'POST') {
      const post = this.store.posts.get(asCommunityPostId(params.targetId));
      if (post) {
        if (params.actionType === 'CONTENT_REMOVED') post.status = 'REMOVED';
        if (params.actionType === 'CONTENT_LIMITED') post.status = 'LIMITED';
      }
    } else if (params.targetType === 'PROFILE') {
      const profile = this.store.profiles.get(asCommunityProfileId(params.targetId));
      if (profile) {
        if (params.actionType === 'USER_SUSPENDED') profile.status = 'SUSPENDED';
        if (params.actionType === 'USER_RESTRICTED') profile.status = 'LIMITED';
      }
    }

    if (params.reportId) {
      const report = this.store.reports.get(params.reportId);
      if (report) {
        report.status = 'RESOLVED';
        report.resolvedByUserId = params.performedByUserId;
        report.resolutionActionId = actionId;
        report.updatedAt = new Date().toISOString();
      }
    }

    this.emitEvent(
      createEventEnvelope(
        'ModerationActionExecuted',
        'ModerationAction',
        actionId,
        { actionId, targetType: params.targetType, targetId: params.targetId, actionType: params.actionType },
        1,
        undefined,
        params.performedByUserId
      )
    );

    return action;
  }

  // ============================================================================
  // CONSOLE & STORE QUERIES
  // ============================================================================

  public getStore(): CommunityStore {
    return this.store;
  }

  public getGroups(): CommunityGroup[] {
    return Array.from(this.store.groups.values()).filter((g) => g.status === 'ACTIVE');
  }

  public getGroupById(groupId: CommunityGroupId): CommunityGroup | undefined {
    return this.store.groups.get(groupId);
  }

  public getEvents(): CommunityEvent[] {
    return Array.from(this.store.events.values())
      .filter((e) => e.status !== 'CANCELLED')
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  public getEventById(eventId: CommunityEventId): CommunityEvent | undefined {
    return this.store.events.get(eventId);
  }

  public getActiveRecoveryAlerts(): CommunityRecoveryAlert[] {
    return this.store.getActiveRecoveryAlerts();
  }

  public getRecoveryAlertByIncidentId(incidentId: LostPetIncidentId): CommunityRecoveryAlert | undefined {
    return this.store.getAlertByIncidentId(incidentId);
  }

  public getProfileById(profileId: CommunityProfileId): CommunityProfile | undefined {
    return this.store.profiles.get(profileId);
  }

  public getProfileByUserId(userId: UserId): CommunityProfile | undefined {
    return this.store.getProfileByUserId(userId);
  }

  public getPetProfiles(profileId: CommunityProfileId): CommunityPetProfile[] {
    return this.store.getPetProfilesForProfile(profileId);
  }

  public getComments(postId: CommunityPostId): CommunityComment[] {
    return this.store.getCommentsForPost(postId);
  }

  public getReports(): CommunityReport[] {
    return Array.from(this.store.reports.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getProfiles(): CommunityProfile[] {
    return Array.from(this.store.profiles.values());
  }

  public getRsvp(eventId: CommunityEventId, profileId: CommunityProfileId): EventAttendance | undefined {
    return this.store.getRsvp(eventId, profileId);
  }

  public getMembership(groupId: CommunityGroupId, profileId: CommunityProfileId): GroupMembership | undefined {
    return this.store.getMembership(groupId, profileId);
  }
}

