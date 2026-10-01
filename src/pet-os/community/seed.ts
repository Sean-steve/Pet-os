/**
 * Pet OS Sprint 16 - Pet Community Canonical Seed Data
 * 
 * Sets up canonical profiles, groups, posts, events, and community recovery network.
 */

import {
  asUserId,
  asHouseholdId,
  asPetId,
  generateUUIDv7,
} from '../kernel/ids';
import { CommunityService } from './service';
import { CommunityStore } from './store';
import { RecoveryService } from '../recovery/service';
import { PetStore } from '../pet-core/store';

export function seedCommunityData(): void {
  const service = CommunityService.getInstance();
  const store = CommunityStore.getInstance();
  const recoveryService = RecoveryService.getInstance();

  // Reset/clean to prevent duplicates on hot reload
  store.clear();

  // Canonical User IDs from unified seed
  const elenaUserId = asUserId('usr-elena-vance-001');
  const sarahUserId = asUserId('usr-sarah-mwangi-002');
  const kimaniUserId = asUserId('usr-amani-kimani-003');
  const jumaUserId = asUserId('usr-juma-ochieng-004');

  // 1. Create Community Profiles
  const elenaProfile = service.createProfile({
    userId: elenaUserId,
    handle: 'elena_vance',
    displayName: 'Elena Vance',
    bio: 'Architect & pet mom to Kibo (Rhodesian Ridgeback) and Simba (Maine Coon). Passionate about canine athletics and local animal welfare.',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
    coarseLocation: {
      neighborhood: 'Kilimani',
      city: 'Nairobi',
      county: 'Nairobi County',
    },
    visibility: 'COMMUNITY_VISIBLE',
    allowsFutureCrowdRecoveryRelay: true,
  });

  const sarahProfile = service.createProfile({
    userId: sarahUserId,
    handle: 'sarah_walks',
    displayName: 'Sarah Mwangi',
    bio: 'Professional certified dog walker & canine fitness advocate in Kilimani/Lavington. Leading safe pack walks since 2019.',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2',
    coarseLocation: {
      neighborhood: 'Lavington',
      city: 'Nairobi',
      county: 'Nairobi County',
    },
    visibility: 'PUBLIC',
  });

  const kimaniProfile = service.createProfile({
    userId: kimaniUserId,
    handle: 'dr_kimani_dvm',
    displayName: 'Dr. Amani Kimani, DVM',
    bio: 'Small animal veterinarian with 12+ years experience in preventive medicine, emergency surgery, and community rabies eradication.',
    avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d',
    coarseLocation: {
      neighborhood: 'Karen',
      city: 'Nairobi',
      county: 'Nairobi County',
    },
    visibility: 'PUBLIC',
  });

  const jumaProfile = service.createProfile({
    userId: jumaUserId,
    handle: 'juma_behavior',
    displayName: 'Juma Ochieng',
    bio: 'Fear-free behavioral consultant & positive-reinforcement agility instructor. Dedicated to strengthening the human-animal bond.',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
    coarseLocation: {
      neighborhood: 'Westlands',
      city: 'Nairobi',
      county: 'Nairobi County',
    },
    visibility: 'PUBLIC',
  });

  // 2. Pet Community Profiles (Projected from Pet Core)
  const kiboPetId = asPetId('pet-kibo-ridgeback-001');
  const simbaPetId = asPetId('pet-simba-mainecoon-002');

  const elenaHouseholdId = asHouseholdId('hh-01951500-0000-7000-8000-000000000001');

  if (!PetStore.findPetById(kiboPetId)) {
    PetStore.savePet({
      petId: kiboPetId,
      householdId: elenaHouseholdId,
      name: 'Kibo',
      speciesCode: 'DOG',
      breedCode: 'RHODESIAN_RIDGEBACK',
      mixedBreed: false,
      unknownBreed: false,
      sex: 'MALE',
      reproductiveStatus: 'STERILIZED',
      dateOfBirth: '2021-06-15',
      birthdatePrecision: 'EXACT',
      estimatedBirthdate: false,
      primaryColor: 'Wheaten',
      sizeClassification: 'LARGE',
      lifecycleStage: 'ADULT',
      status: 'ACTIVE',
      createdBy: elenaUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      metadata: {},
    });
  }

  if (!PetStore.findPetById(simbaPetId)) {
    PetStore.savePet({
      petId: simbaPetId,
      householdId: elenaHouseholdId,
      name: 'Simba',
      speciesCode: 'CAT',
      breedCode: 'MAINE_COON',
      mixedBreed: false,
      unknownBreed: false,
      sex: 'MALE',
      reproductiveStatus: 'STERILIZED',
      dateOfBirth: '2022-04-12',
      birthdatePrecision: 'EXACT',
      estimatedBirthdate: false,
      primaryColor: 'Tabby Golden',
      sizeClassification: 'LARGE',
      lifecycleStage: 'ADULT',
      status: 'ACTIVE',
      createdBy: elenaUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      metadata: {},
    });
  }

  const kiboProfile = service.registerPetCommunityProfile({
    communityProfileId: elenaProfile.profileId,
    petId: kiboPetId,
    bio: 'Energetic Rhodesian Ridgeback who loves morning jogs, scent work, and sunbathing on the terrace.',
    visibility: 'COMMUNITY_VISIBLE',
  });

  service.registerPetCommunityProfile({
    communityProfileId: elenaProfile.profileId,
    petId: simbaPetId,
    bio: 'Gentle Maine Coon explorer who oversees bird watching from high perches.',
    visibility: 'COMMUNITY_VISIBLE',
  });

  // 3. Follow Relationships
  service.followProfile(elenaProfile.profileId, sarahProfile.profileId);
  service.followProfile(elenaProfile.profileId, kimaniProfile.profileId);
  service.followProfile(sarahProfile.profileId, elenaProfile.profileId);
  service.followProfile(jumaProfile.profileId, elenaProfile.profileId);

  // 4. Create Community Groups
  const ridgebackGroup = service.createGroup({
    creatorProfileId: elenaProfile.profileId,
    name: 'Nairobi Ridgebacks & Active Hounds',
    description: 'A community group for sight and scent hounds in Nairobi. We coordinate monthly trail walks, coursing, and breed-specific health tips.',
    category: 'BREED',
    privacyType: 'PUBLIC',
    coarseLocation: { neighborhood: 'Nairobi Westlands / Karura', city: 'Nairobi', county: 'Nairobi County' },
    rules: [
      'Positive reinforcement discussion only.',
      'Always supervise your dog during trail excursions.',
      'Report any health anomalies directly to a qualified veterinarian.',
    ],
  });

  const neighborhoodGroup = service.createGroup({
    creatorProfileId: sarahProfile.profileId,
    name: 'Kilimani & Lavington Pet Neighbors',
    description: 'Local neighborhood collective for sharing safe dog-friendly spots, organizing playdates, and supporting lost pet recoveries.',
    category: 'LOCAL_COMMUNITY',
    privacyType: 'PUBLIC',
    coarseLocation: { neighborhood: 'Kilimani & Lavington', city: 'Nairobi', county: 'Nairobi County' },
  });

  const agilityGroup = service.createGroup({
    creatorProfileId: jumaProfile.profileId,
    name: 'Kenya Canine Agility & Behavior',
    description: 'Sharing obstacle course tips, recall training games, and positive reinforcement conditioning for all breeds.',
    category: 'TRAINING_INTEREST',
    privacyType: 'PUBLIC',
    coarseLocation: { city: 'Nairobi', county: 'Nairobi County' },
  });

  // Join groups
  service.joinGroup(ridgebackGroup.groupId, sarahProfile.profileId);
  service.joinGroup(neighborhoodGroup.groupId, elenaProfile.profileId);
  service.joinGroup(neighborhoodGroup.groupId, kimaniProfile.profileId);
  service.joinGroup(agilityGroup.groupId, elenaProfile.profileId);

  // 5. Create Posts
  const post1 = service.createPost({
    authorProfileId: kimaniProfile.profileId,
    postType: 'TIP',
    content: '🐾 Warm Season Hydration Alert: With mid-day temperatures in Nairobi reaching 28°C+, remember that dogs cannot sweat like humans. Always carry fresh water on mid-day walks, check pavement heat with the back of your hand for 7 seconds, and prioritize early morning or twilight exercise.',
    coarseLocationArea: 'Karen / Langata, Nairobi',
  });

  const post2 = service.createPost({
    authorProfileId: elenaProfile.profileId,
    groupId: ridgebackGroup.groupId,
    petProfileId: kiboProfile.petProfileId,
    postType: 'PET_UPDATE',
    content: 'Kibo completed his first 5K trail run at Karura Forest Sigiria loop today! He stayed calm passing other leashed dogs and loved the stream crossings. Looking forward to meeting everyone at next Sunday’s group pack walk!',
    coarseLocationArea: 'Karura Forest, Nairobi',
    mediaUrls: ['https://images.unsplash.com/photo-1543466835-00a7907e9de1'],
  });

  const post3 = service.createPost({
    authorProfileId: jumaProfile.profileId,
    groupId: agilityGroup.groupId,
    postType: 'QUESTION',
    content: 'Quick training poll for our agility members: When teaching impulse control at doorway thresholds, do you find high-value scent lures or release marker words more effective for adolescent high-drive dogs?',
    coarseLocationArea: 'Westlands, Nairobi',
  });

  // Reactions & Comments
  service.toggleReaction({
    targetType: 'POST',
    targetId: post1.postId,
    profileId: elenaProfile.profileId,
    reactionType: 'HELPFUL',
  });
  service.toggleReaction({
    targetType: 'POST',
    targetId: post2.postId,
    profileId: sarahProfile.profileId,
    reactionType: 'LIKE',
  });

  service.addComment({
    postId: post1.postId,
    authorProfileId: sarahProfile.profileId,
    content: 'Such an essential reminder Dr. Kimani! We shift all client dog walking schedules before 9:30 AM or after 4:30 PM during these hot spells.',
  });

  service.addComment({
    postId: post2.postId,
    authorProfileId: sarahProfile.profileId,
    content: 'Well done Kibo! His leash manners have improved immensely over the past few weeks.',
  });

  // 6. Community Events
  const event1 = service.createEvent({
    organizerProfileId: sarahProfile.profileId,
    groupId: neighborhoodGroup.groupId,
    title: 'Sunday Morning Karura Forest Pack Walk',
    description: 'A relaxed, structured 4km morning walk along the Sigiria trail loop. All vaccinated, leashed dogs welcome. We will pause at the midpoint clearing for a brief hydration and leash reactivity drill.',
    eventType: 'PACK_WALK',
    startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 2 * 3600 * 1000).toISOString(),
    locationType: 'PUBLIC_PARK',
    venueName: 'Karura Forest — Sigiria Gate (Thigiri Ridge Rd)',
    coarseArea: 'Karura Forest / Sigiria, Nairobi',
    maxAttendees: 20,
    petPolicy: {
      allowedSpecies: ['CANINE'],
      requireVaccinated: true,
      leashRequired: true,
    },
  });

  service.rsvpEvent({
    eventId: event1.eventId,
    profileId: elenaProfile.profileId,
    status: 'GOING',
    petProfileIds: [kiboProfile.petProfileId],
  });

  // 7. Community Recovery Alert demonstration
  // Report an active lost pet incident for Simba who briefly slipped out
  const simbaIncident = recoveryService.reportLostPetIncident({
    householdId: asHouseholdId('hsh-elena-vance-001'),
    reportedByUserId: elenaUserId,
    petId: simbaPetId,
    missingSince: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    lastKnownLocation: {
      latitude: -1.286389,
      longitude: 36.817223,
      accuracyMeters: 10,
      coarseDescription: 'Kilimani near Menelik Rd / Chania Ave compound',
    },
    coarseSearchArea: {
      neighborhood: 'Kilimani',
      district: 'Dagoretti North',
      city: 'Nairobi',
      county: 'Nairobi County',
      centerLatitude: -1.286389,
      centerLongitude: 36.817223,
      radiusKm: 2.0,
    },
    ownerInstructions: 'Indoor Maine Coon, may be timid and hiding under bushes or garden sheds. Please do not chase; report sighting immediately.',
    emergencyMedicalNotes: 'Mild food allergy; please do not feed dairy.',
  });

  // Trigger community alert request (which auto-creates CommunityRecoveryAlert via listener)
  recoveryService.activateCommunityAlert(simbaIncident.incident.lostPetIncidentId, elenaUserId);

  // Volunteer & Follower for the alert
  const activeAlert = service.getRecoveryAlertByIncidentId(simbaIncident.incident.lostPetIncidentId);
  if (activeAlert) {
    service.followRecoveryAlert(activeAlert.communityAlertId, sarahProfile.profileId);
    service.volunteerForRecovery({
      alertId: activeAlert.communityAlertId,
      profileId: sarahProfile.profileId,
      volunteerRole: 'SEARCH_PARTICIPANT',
      notes: 'I am walking dogs in Kilimani this morning and will keep eyes open around Chania Ave.',
    });
  }
}
