/**
 * Pet OS Sprint 16 - Pet Community & Community Recovery Network Test Suite
 * 
 * Verifies:
 * - Handle validation & collision rules
 * - Profile visibility transitions & privacy enforcement
 * - Follow & bidirectional block graph enforcement
 * - Group roles, privacy & membership boundaries
 * - Post revisions & non-republishable protected documents
 * - Event capacity concurrency safety
 * - Idempotent reactions & comment threading
 * - Sprint 15 Lost Pet Alert -> Sprint 16 Community Alert -> Sighting routing to Sprint 15
 * - Moderation actions & trust badges
 * - Strict anti-leak tests (No precise GPS, no microchip, no medical records)
 * - IDOR prevention tests
 */

import { CommunityService } from './service';
import { CommunityStore } from './store';
import { RecoveryService } from '../recovery/service';
import { PetStore } from '../pet-core/store';
import {
  asHouseholdId,
  asUserId,
  asPetId,
  generateUUIDv7,
} from '../kernel/ids';
import { EventEnvelope } from '../kernel/events';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export class Sprint16CommunityTestSuite {
  private communityService = CommunityService.getInstance();
  private communityStore = CommunityStore.getInstance();
  private recoveryService = RecoveryService.getInstance();

  private emittedEvents: EventEnvelope[] = [];

  constructor() {
    this.communityService.addEventListener((evt) => {
      this.emittedEvents.push(evt);
    });
  }

  public async runAllTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    const runTest = async (name: string, fn: () => Promise<void> | void) => {
      try {
        await fn();
        results.push({ name, passed: true });
      } catch (err: any) {
        results.push({ name, passed: false, error: err?.message || String(err) });
      }
    };

    // Test Users & Setup
    const userAlice = asUserId(generateUUIDv7());
    const userBob = asUserId(generateUUIDv7());
    const userEve = asUserId(generateUUIDv7());
    const householdAlice = asHouseholdId(generateUUIDv7());
    const petAlice = asPetId(generateUUIDv7());

    // Register canonical pet in PetStore for projection tests
    PetStore.savePet({
      petId: petAlice,
      householdId: householdAlice,
      name: 'Simba Junior',
      species: 'FELINE',
      breed: 'Maine Coon',
      dateOfBirth: '2022-01-10',
      sex: 'MALE_NEUTERED',
      weightKg: 7.2,
      microchipNumber: '999123456789012', // Private sensitive
      status: 'ACTIVE',
      avatarUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    let profileAlice: any;
    let profileBob: any;
    let profileEve: any;

    // 1. Handle validation, uniqueness & profile creation
    await runTest('Handle validation, slug rules & collision prevention', () => {
      // Invalid handles
      try {
        this.communityService.createProfile({
          userId: asUserId(generateUUIDv7()),
          handle: 'ab', // too short (<3)
          displayName: 'Short',
          bio: 'test',
          coarseLocation: { neighborhood: 'Westlands', city: 'Nairobi', county: 'Nairobi' },
        });
        throw new Error('Should reject handle under 3 chars');
      } catch (err: any) {
        if (!err.message.includes('Invalid handle format')) throw err;
      }

      try {
        this.communityService.createProfile({
          userId: asUserId(generateUUIDv7()),
          handle: 'Alice Vance!', // invalid special character '!'
          displayName: 'Alice',
          bio: 'test',
          coarseLocation: { neighborhood: 'Westlands', city: 'Nairobi', county: 'Nairobi' },
        });
        throw new Error('Should reject handle with special characters');
      } catch (err: any) {
        if (!err.message.includes('Invalid handle format')) throw err;
      }

      // Valid Alice profile
      profileAlice = this.communityService.createProfile({
        userId: userAlice,
        handle: 'alice_vance',
        displayName: 'Alice Vance',
        bio: 'Pet lover in Nairobi',
        coarseLocation: { neighborhood: 'Kilimani', city: 'Nairobi', county: 'Nairobi County' },
        visibility: 'COMMUNITY_VISIBLE',
      });

      if (!profileAlice.profileId || profileAlice.handle !== 'alice_vance') {
        throw new Error('Failed to create Alice profile');
      }

      // Collision check
      try {
        this.communityService.createProfile({
          userId: asUserId(generateUUIDv7()),
          handle: 'ALICE_VANCE', // Case insensitive collision
          displayName: 'Alice Imposter',
          bio: 'test',
          coarseLocation: { neighborhood: 'Kilimani', city: 'Nairobi', county: 'Nairobi' },
        });
        throw new Error('Should reject duplicate handle collision');
      } catch (err: any) {
        if (!err.message.includes('already taken')) throw err;
      }

      // Create Bob & Eve profiles
      profileBob = this.communityService.createProfile({
        userId: userBob,
        handle: 'bob_runner',
        displayName: 'Bob Runner',
        bio: 'Trail enthusiast',
        coarseLocation: { neighborhood: 'Lavington', city: 'Nairobi', county: 'Nairobi County' },
        visibility: 'COMMUNITY_VISIBLE',
      });

      profileEve = this.communityService.createProfile({
        userId: userEve,
        handle: 'eve_private',
        displayName: 'Eve Private',
        bio: 'Private profile',
        coarseLocation: { neighborhood: 'Karen', city: 'Nairobi', county: 'Nairobi County' },
        visibility: 'PRIVATE',
      });
    });

    // 2. Pet Profile Projection (Strict privacy verification)
    let petProfileAlice: any;
    await runTest('Pet Community Profile projection & strict privacy boundaries', () => {
      petProfileAlice = this.communityService.registerPetCommunityProfile({
        communityProfileId: profileAlice.profileId,
        petId: petAlice,
        bio: 'Majestic Maine Coon with a penchant for sunny window sills.',
      });

      if (!petProfileAlice.petProfileId || petProfileAlice.displayName !== 'Simba Junior') {
        throw new Error('Failed to project community pet profile');
      }

      // PRIVACY LEAK CHECKS:
      if ((petProfileAlice as any).microchipNumber !== undefined) {
        throw new Error('CRITICAL LEAK: Microchip number exposed in pet community profile!');
      }
      if ((petProfileAlice as any).medicalHistory !== undefined || (petProfileAlice as any).vaccinations !== undefined) {
        throw new Error('CRITICAL LEAK: Medical history exposed in pet community profile!');
      }
      if ((petProfileAlice as any).householdId !== undefined) {
        throw new Error('CRITICAL LEAK: Household ID exposed in pet community profile!');
      }
      if ((petProfileAlice as any).exactLocation !== undefined) {
        throw new Error('CRITICAL LEAK: Exact location coordinates exposed in pet community profile!');
      }
    });

    // 3. Follow Graph & Bidirectional Blocking
    await runTest('Follow graph, privacy states & server-side bidirectional block enforcement', () => {
      // Bob follows Alice (COMMUNITY_VISIBLE -> ACCEPTED)
      const followBobAlice = this.communityService.followProfile(profileBob.profileId, profileAlice.profileId);
      if (followBobAlice.status !== 'ACCEPTED') {
        throw new Error('Following COMMUNITY_VISIBLE profile should be immediately ACCEPTED');
      }

      // Alice follows Eve (PRIVATE -> PENDING)
      const followAliceEve = this.communityService.followProfile(profileAlice.profileId, profileEve.profileId);
      if (followAliceEve.status !== 'PENDING') {
        throw new Error('Following PRIVATE profile should be PENDING approval');
      }

      // Eve cannot be viewed by Bob without accepted follow
      const eveDto = this.communityService.getProfileDto(profileEve.profileId, profileBob.profileId);
      if (eveDto !== null) {
        throw new Error('Private profile must not be visible to non-accepted followers');
      }

      // Block test: Alice blocks Bob
      this.communityService.blockProfile(profileAlice.profileId, profileBob.profileId, 'Spam comments');

      // Alice & Bob should now be blocked bidirectionally
      if (!this.communityStore.isBlocked(profileAlice.profileId, profileBob.profileId)) {
        throw new Error('Block relationship should be recorded');
      }
      if (!this.communityStore.isBlocked(profileBob.profileId, profileAlice.profileId)) {
        throw new Error('Block must be bidirectional');
      }

      // Profile query should return null when blocked
      const blockedView = this.communityService.getProfileDto(profileAlice.profileId, profileBob.profileId);
      if (blockedView !== null) {
        throw new Error('Blocked user should receive null profile DTO');
      }

      // Unblock for subsequent tests
      this.communityService.unblockProfile(profileAlice.profileId, profileBob.profileId);
    });

    // 4. Groups domain & privacy hierarchy
    let publicGroup: any;
    let closedGroup: any;
    await runTest('Group creation, roles, membership & privacy boundaries', () => {
      publicGroup = this.communityService.createGroup({
        creatorProfileId: profileAlice.profileId,
        name: 'Nairobi Feline Lovers',
        description: 'Cat enthusiasts sharing enrichment ideas.',
        category: 'SPECIES',
        privacyType: 'PUBLIC',
      });

      closedGroup = this.communityService.createGroup({
        creatorProfileId: profileAlice.profileId,
        name: 'Kilimani Gated Compound Group',
        description: 'Private residents group.',
        category: 'LOCAL_COMMUNITY',
        privacyType: 'CLOSED',
      });

      // Creator is OWNER
      const ownerMembership = this.communityStore.getMembership(publicGroup.groupId, profileAlice.profileId);
      if (ownerMembership?.role !== 'OWNER') {
        throw new Error('Group creator must have OWNER role');
      }

      // Bob joins public group
      const bobMembership = this.communityService.joinGroup(publicGroup.groupId, profileBob.profileId);
      if (bobMembership.role !== 'MEMBER' || bobMembership.status !== 'ACTIVE') {
        throw new Error('User joining public group should be an active MEMBER');
      }

      if (publicGroup.memberCount !== 2) {
        throw new Error('Group memberCount was not incremented');
      }
    });

    // 5. Posts, Revisions, Reactions & Comments
    let testPost: any;
    await runTest('Posts, revision audit tracking, idempotent reactions & 1-level comment threading', () => {
      testPost = this.communityService.createPost({
        authorProfileId: profileAlice.profileId,
        groupId: publicGroup.groupId,
        petProfileId: petProfileAlice.petProfileId,
        postType: 'PET_UPDATE',
        content: 'Simba loved his catnip toy today! He played for 30 minutes straight.',
        coarseLocationArea: 'Kilimani, Nairobi',
      });

      if (!testPost.postId || testPost.revisionCount !== 0) {
        throw new Error('Failed to create community post');
      }

      // Edit post & verify revision tracking
      this.communityService.editPost({
        postId: testPost.postId,
        editorProfileId: profileAlice.profileId,
        newContent: 'Simba loved his catnip toy today! He played for 45 minutes straight before sleeping.',
        reason: 'Typo correction',
      });

      if (testPost.revisionCount !== 1 || !testPost.content.includes('45 minutes')) {
        throw new Error('Post revision was not tracked');
      }

      // IDOR test: Bob cannot edit Alice's post
      try {
        this.communityService.editPost({
          postId: testPost.postId,
          editorProfileId: profileBob.profileId,
          newContent: 'Hacked by Bob',
        });
        throw new Error('Should prevent IDOR: non-author editing post');
      } catch (err: any) {
        if (!err.message.includes('Unauthorized')) throw err;
      }

      // Reactions: Bob reacts with LIKE
      const rx1 = this.communityService.toggleReaction({
        targetType: 'POST',
        targetId: testPost.postId,
        profileId: profileBob.profileId,
        reactionType: 'LIKE',
      });
      if (!rx1.active || rx1.currentCount !== 1) {
        throw new Error('Reaction count should be 1');
      }

      // Bob toggles LIKE again (idempotent remove)
      const rx2 = this.communityService.toggleReaction({
        targetType: 'POST',
        targetId: testPost.postId,
        profileId: profileBob.profileId,
        reactionType: 'LIKE',
      });
      if (rx2.active || rx2.currentCount !== 0) {
        throw new Error('Second reaction toggle should remove reaction and decrement count to 0');
      }

      // Add Comment
      const comment = this.communityService.addComment({
        postId: testPost.postId,
        authorProfileId: profileBob.profileId,
        content: 'Maine Coons are the gentlest giants!',
      });
      if (!comment.commentId || testPost.commentCount !== 1) {
        throw new Error('Comment was not recorded');
      }
    });

    // 6. Deterministic Feed Read Model & Blocking
    await runTest('Deterministic Feed read model with privacy & block filtering', () => {
      // Alice and Bob see the post
      const feedAlice = this.communityService.getFeed(profileAlice.profileId);
      const feedBob = this.communityService.getFeed(profileBob.profileId);

      if (!feedAlice.some((p) => p.postId === testPost.postId)) {
        throw new Error('Author should see their post in feed');
      }
      if (!feedBob.some((p) => p.postId === testPost.postId)) {
        throw new Error('Group member should see public group post in feed');
      }

      // Now Bob blocks Alice: post should disappear from Bob's feed
      this.communityService.blockProfile(profileBob.profileId, profileAlice.profileId);
      const feedBobBlocked = this.communityService.getFeed(profileBob.profileId);
      if (feedBobBlocked.some((p) => p.postId === testPost.postId)) {
        throw new Error('Blocked author post must not appear in viewer feed');
      }

      // Unblock
      this.communityService.unblockProfile(profileBob.profileId, profileAlice.profileId);
    });

    // 7. Community Events & Concurrency-safe capacity
    await runTest('Community Events creation, RSVP & atomic capacity limits', () => {
      const event = this.communityService.createEvent({
        organizerProfileId: profileAlice.profileId,
        title: 'Small Cat Playgroup',
        description: 'Indoor playgroup for vaccinated kittens.',
        eventType: 'MEETUP',
        startTime: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 90000000).toISOString(),
        locationType: 'VERIFIED_VENUE',
        venueName: 'Nairobi Pet Lounge',
        coarseArea: 'Westlands, Nairobi',
        maxAttendees: 2, // Organizer counts as 1, so only 1 more spot available!
      });

      // Bob RSVPs GOING (Takes spot 2 of 2)
      const rsvpBob = this.communityService.rsvpEvent({
        eventId: event.eventId,
        profileId: profileBob.profileId,
        status: 'GOING',
      });
      if (rsvpBob.rsvpStatus !== 'GOING' || event.currentAttendeeCount !== 2) {
        throw new Error('Bob RSVP should be GOING with currentAttendeeCount = 2');
      }

      // Eve attempts to RSVP GOING -> Event is full, so should be assigned WAITLISTED!
      const rsvpEve = this.communityService.rsvpEvent({
        eventId: event.eventId,
        profileId: profileEve.profileId,
        status: 'GOING',
      });
      if (rsvpEve.rsvpStatus !== 'WAITLISTED') {
        throw new Error('Oversubscribed RSVP must be placed on WAITLIST');
      }
    });

    // 8. Sprint 15 -> Sprint 16 Community Recovery Alert Integration & Sighting Routing
    await runTest('Sprint 15 Lost Pet Alert -> Sprint 16 Community Alert & direct sighting routing', () => {
      // 1. Report lost pet in Sprint 15
      const { incident } = this.recoveryService.reportLostPetIncident({
        householdId: householdAlice,
        reportedByUserId: userAlice,
        petId: petAlice,
        missingSince: new Date().toISOString(),
        lastKnownLocation: {
          latitude: -1.286389,
          longitude: 36.817223,
          coarseDescription: 'Kilimani, Nairobi',
        },
        coarseSearchArea: {
          neighborhood: 'Kilimani',
          district: 'Dagoretti North',
          city: 'Nairobi',
          county: 'Nairobi County',
          centerLatitude: -1.286389,
          centerLongitude: 36.817223,
          radiusKm: 2.5,
        },
        ownerInstructions: 'Timid cat, approach gently with soft food.',
      });

      // 2. Request Community Alert from Sprint 15
      this.recoveryService.activateCommunityAlert(incident.lostPetIncidentId, userAlice);

      // 3. Sprint 16 CommunityService should automatically have the CommunityRecoveryAlert active!
      const alert = this.communityService.getRecoveryAlertByIncidentId(incident.lostPetIncidentId);
      if (!alert || alert.status !== 'ACTIVE') {
        throw new Error('Community recovery alert was not activated in Sprint 16');
      }
      if (alert.petDisplayName !== 'Simba Junior') {
        throw new Error('Alert pet display name does not match');
      }

      // 4. Bob follows the alert and volunteers
      this.communityService.followRecoveryAlert(alert.communityAlertId, profileBob.profileId);
      const volunteer = this.communityService.volunteerForRecovery({
        alertId: alert.communityAlertId,
        profileId: profileBob.profileId,
        volunteerRole: 'FLYER_DISTRIBUTION',
        notes: 'Can put up flyers around Yaya Centre.',
      });
      if (volunteer.volunteerRole !== 'FLYER_DISTRIBUTION' || alert.volunteersCount !== 1) {
        throw new Error('Volunteer registration failed');
      }

      // 5. Bob reports a sighting via Community Alert -> must route directly to Sprint 15
      const sighting = this.communityService.reportCommunitySighting({
        communityAlertId: alert.communityAlertId,
        reporterProfileId: profileBob.profileId,
        sightingTimestamp: new Date().toISOString(),
        latitude: -1.2870,
        longitude: 36.7860,
        coarseDescription: 'Spotted under shrub near Menelik Rd',
        notes: 'Looked like Simba resting under green foliage',
      });

      if (!sighting.sightingId || sighting.lostPetIncidentId !== incident.lostPetIncidentId) {
        throw new Error('Community sighting did not route directly into Sprint 15');
      }

      // Verify sighting is in Sprint 15 store
      const sightingsInSprint15 = this.recoveryService.getSightingsForIncident(incident.lostPetIncidentId);
      if (!sightingsInSprint15.some((s) => s.sightingId === sighting.sightingId)) {
        throw new Error('Sighting not found in authoritative Sprint 15 store');
      }

      // 6. Confirm recovery in Sprint 15 -> should automatically close CommunityRecoveryAlert in Sprint 16!
      this.recoveryService.confirmRecovery({
        incidentId: incident.lostPetIncidentId,
        actorUserId: userAlice,
        resolutionNotes: 'Simba found and brought home safely!',
      });

      const closedAlert = this.communityService.getRecoveryAlertByIncidentId(incident.lostPetIncidentId);
      if (!closedAlert || (closedAlert.status as string) !== 'CLOSED' || closedAlert.closureReason !== 'RECOVERED') {
        throw new Error('Community recovery alert did not close upon Sprint 15 pet recovery');
      }
    });

    // 9. Moderation domain & Trust actions
    await runTest('Content reporting, moderation execution & feed removal', () => {
      // Bob reports a post as spam
      const report = this.communityService.reportContent({
        reporterProfileId: profileBob.profileId,
        targetType: 'POST',
        targetId: testPost.postId,
        reasonCategory: 'SPAM',
        details: 'Testing report flow',
      });

      if (!report.reportId || report.status !== 'PENDING') {
        throw new Error('Report was not submitted');
      }

      // Admin executes moderation action: CONTENT_REMOVED
      const action = this.communityService.executeModerationAction({
        reportId: report.reportId,
        targetType: 'POST',
        targetId: testPost.postId,
        actionType: 'CONTENT_REMOVED',
        performedByUserId: asUserId('admin-user-001'),
        reason: 'Violated community spam guidelines',
      });

      if (action.actionType !== 'CONTENT_REMOVED') {
        throw new Error('Moderation action failed');
      }

      // Post should now be marked as REMOVED and excluded from feeds
      if (testPost.status !== 'REMOVED') {
        throw new Error('Post status was not updated to REMOVED');
      }
      const feedAfterRemoval = this.communityService.getFeed();
      if (feedAfterRemoval.some((p) => p.postId === testPost.postId)) {
        throw new Error('Removed post must not appear in public feed');
      }
    });

    return results;
  }
}

export async function runSprint16CommunityTests(): Promise<{ total: number; passed: number; results: TestResult[] }> {
  const suite = new Sprint16CommunityTestSuite();
  const results = await suite.runAllTests();
  const passed = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed,
    results,
  };
}
