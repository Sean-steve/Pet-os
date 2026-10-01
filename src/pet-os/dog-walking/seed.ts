/**
 * Pet OS Sprint 13 - Dog Walking Canonical Seed Data
 * 
 * Sets up realistic, verified walk session data for:
 * - Walker: Sarah Mwangi (prv-sarah-walker-001)
 * - Owner: Elena Vance (usr-01951500-0000-7000-8000-000000000001)
 * - Pets: Kibo (pet-kibo-001) & Simba (pet-001)
 * - Location: Nairobi (Kilimani / Karura Trail route)
 */

import {
  asBookingId,
  asWalkSessionId,
  asHandoverId,
  asWalkCompletionReportId,
  asWalkMediaId,
  asWalkTelemetryId,
  asActivityId,
  asTimelineEventId,
  generateUUIDv7,
} from '../kernel/ids';
import { currentClockUtcNow } from '../kernel/time';
import { DogWalkingStore } from './store';
import { DogWalkSession, HandoverRecord, WalkCompletionReport, WalkTelemetryWaypoint, WalkPottyEvent, WalkBehaviorObservation, WalkMedia } from './types';
import { CANONICAL_IDS } from '../seed/unified-seed';
import { BookingStore } from '../booking/store';
import { ActivityStore } from '../activity/store';
import { TimelineStore } from '../timeline/store';
import { ActivityRecord } from '../activity/types';

export const SEED_WALK_SESSION_ID = asWalkSessionId('wlk-01956000-0001-7000-8000-000000000001');
export const SEED_ACTIVE_WALK_SESSION_ID = asWalkSessionId('wlk-01956000-0002-7000-8000-000000000002');

export function seedDogWalkingData(): void {
  const store = DogWalkingStore.getInstance();
  store.reset();

  const now = currentClockUtcNow();
  const earlierToday = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  const startToday = new Date(Date.now() - 2.5 * 3600 * 1000).toISOString();
  const finishToday = new Date(Date.now() - 1.8 * 3600 * 1000).toISOString();

  // Dedicated bookings for seeded completed and live active sessions
  const bookingStore = BookingStore.getInstance();
  const completedBookingId = asBookingId('bk-01955000-0001-7000-8000-000000000099');
  const activeBookingId = asBookingId('bk-01955000-0001-7000-8000-000000000098');
  const completedAccessGrantId = generateUUIDv7() as any;
  const activeAccessGrantId = generateUUIDv7() as any;

  if (!bookingStore.findBookingById(completedBookingId)) {
    bookingStore.saveBooking({
      bookingId: completedBookingId,
      ownerUserId: CANONICAL_IDS.OWNER_ELENA,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      providerId: CANONICAL_IDS.WALKER_SARAH,
      serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
      status: 'COMPLETED',
      confirmationMode: 'INSTANT_CONFIRM',
      startAt: startToday,
      endAt: finishToday,
      serviceDurationMinutes: 45,
      timezone: 'Africa/Nairobi',
      petCount: 2,
      petIds: [CANONICAL_IDS.PET_KIBO, CANONICAL_IDS.PET_SIMBA],
      accessGrantId: completedAccessGrantId,
      petSnapshots: [],
      serviceSnapshot: {
        serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
        title: 'Dog Walk - Karura Trail',
        category: 'DOG_WALKER',
        serviceDescription: 'Professional dog walking on Karura Forest nature trail',
        defaultDurationMinutes: 45,
        locationType: 'CLIENT_LOCATION',
        confirmationMode: 'INSTANT_CONFIRM',
        snapshotTimestamp: earlierToday,
      },
      priceSnapshot: {
        amountMinorUnits: 200000,
        currency: 'KES',
        pricingModel: 'FIXED',
        baseAmountMinorUnits: 150000,
        perPetAddonMinorUnits: 50000,
        petCount: 2,
        taxIncluded: true,
        feeBasisReference: 'FEE-01',
      },
      cancellationPolicySnapshot: {
        policyTier: 'STANDARD',
        freeCancellationCutoffHours: 24,
        lateCancellationNotice: 'Standard 24-hour notice',
        description: 'Standard',
      },
      instructions: {
        emergencyContactName: 'Elena Vance',
        emergencyContactPhone: '+254700000001',
      },
      requestedAt: earlierToday,
      concurrencyVersion: 1,
      createdAt: earlierToday,
      updatedAt: finishToday,
    });
  }

  if (!bookingStore.findBookingById(activeBookingId)) {
    bookingStore.saveBooking({
      bookingId: activeBookingId,
      ownerUserId: CANONICAL_IDS.OWNER_ELENA,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      providerId: CANONICAL_IDS.WALKER_SARAH,
      serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
      status: 'IN_PROGRESS',
      confirmationMode: 'INSTANT_CONFIRM',
      startAt: now,
      endAt: new Date(Date.now() + 30 * 60000).toISOString(),
      serviceDurationMinutes: 30,
      timezone: 'Africa/Nairobi',
      petCount: 1,
      petIds: [CANONICAL_IDS.PET_KIBO],
      accessGrantId: activeAccessGrantId,
      petSnapshots: [],
      serviceSnapshot: {
        serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
        title: 'Morning Arboretum Walk',
        category: 'DOG_WALKER',
        serviceDescription: 'Morning scenic dog walk in Nairobi Arboretum',
        defaultDurationMinutes: 30,
        locationType: 'CLIENT_LOCATION',
        confirmationMode: 'INSTANT_CONFIRM',
        snapshotTimestamp: now,
      },
      priceSnapshot: {
        amountMinorUnits: 150000,
        currency: 'KES',
        pricingModel: 'FIXED',
        baseAmountMinorUnits: 150000,
        perPetAddonMinorUnits: 0,
        petCount: 1,
        taxIncluded: true,
        feeBasisReference: 'FEE-01',
      },
      cancellationPolicySnapshot: {
        policyTier: 'STANDARD',
        freeCancellationCutoffHours: 24,
        lateCancellationNotice: 'Standard 24-hour notice',
        description: 'Standard',
      },
      instructions: {
        emergencyContactName: 'Elena Vance',
        emergencyContactPhone: '+254700000001',
      },
      requestedAt: now,
      concurrencyVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 1. COMPLETED CANONICAL WALK SESSION
  const completedPickupHandoverId = asHandoverId('hnd-pickup-001');
  const completedReturnHandoverId = asHandoverId('hnd-return-001');
  const completionReportId = asWalkCompletionReportId('wcr-report-001');
  const activityRecordId = asActivityId('act-walk-001');

  const completedSession: DogWalkSession = {
    walkSessionId: SEED_WALK_SESSION_ID,
    bookingId: completedBookingId,
    providerId: CANONICAL_IDS.WALKER_SARAH,
    walkerUserId: CANONICAL_IDS.OWNER_ELENA, // Sarah's user link
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    petIds: [CANONICAL_IDS.PET_KIBO, CANONICAL_IDS.PET_SIMBA],
    status: 'COMPLETED',
    activeCustodyState: 'CUSTODY_WITH_HOUSEHOLD',
    scheduledStartAt: earlierToday,
    scheduledEndAt: startToday,
    scheduledDurationMinutes: 45,
    actualStartedAt: startToday,
    actualEndedAt: finishToday,
    totalElapsedDurationSeconds: 2700, // 45 mins
    totalPausedDurationSeconds: 180,  // 3 mins water break
    routeReference: 'rt-ref-nairobi-karura-loop-01',
    totalDistanceMeters: 3420, // 3.42 km
    stepCount: 4620,
    averagePaceMinPerKm: 13.1,
    pickupHandoverId: completedPickupHandoverId,
    returnHandoverId: completedReturnHandoverId,
    completionReportId,
    activityRecordId,
    accessGrantId: completedAccessGrantId,
    concurrencyVersion: 5,
    createdAt: earlierToday,
    updatedAt: finishToday,
  };
  store.saveSession(completedSession);

  // Pickup Handover Record
  const pickupHandover: HandoverRecord = {
    handoverId: completedPickupHandoverId,
    walkSessionId: SEED_WALK_SESSION_ID,
    type: 'PICKUP',
    verificationMethod: 'SECURE_OTP',
    verificationCode: '582914',
    verificationStatus: 'VERIFIED',
    transferredAt: startToday,
    releasingActorId: CANONICAL_IDS.OWNER_ELENA,
    acceptingActorId: CANONICAL_IDS.OWNER_ELENA,
    checklistConfirmed: {
      leashAndHarnessSecure: true,
      collarTagVerified: true,
      temperamentAssessed: true,
      waterHydrationConfirmed: true,
    },
    custodyFrom: 'CUSTODY_WITH_HOUSEHOLD',
    custodyTo: 'CUSTODY_WITH_PROVIDER',
    locationMaskedReference: '14 Elgon Court, Kilimani (Pickup Zone)',
    createdAt: earlierToday,
  };
  store.saveHandover(pickupHandover);

  // Return Handover Record
  const returnHandover: HandoverRecord = {
    handoverId: completedReturnHandoverId,
    walkSessionId: SEED_WALK_SESSION_ID,
    type: 'RETURN',
    verificationMethod: 'SECURE_OTP',
    verificationCode: '741295',
    verificationStatus: 'VERIFIED',
    transferredAt: finishToday,
    releasingActorId: CANONICAL_IDS.OWNER_ELENA,
    acceptingActorId: CANONICAL_IDS.OWNER_ELENA,
    checklistConfirmed: {
      leashAndHarnessSecure: true,
      collarTagVerified: true,
      temperamentAssessed: true,
      waterHydrationConfirmed: true,
      pawsInspectedAndCleaned: true,
      feedingAdministered: false,
      keysReturnedOrSecured: true,
    },
    custodyFrom: 'CUSTODY_WITH_PROVIDER',
    custodyTo: 'CUSTODY_WITH_HOUSEHOLD',
    locationMaskedReference: '14 Elgon Court, Kilimani (Return Gate)',
    createdAt: finishToday,
  };
  store.saveHandover(returnHandover);

  // Telemetry Waypoints (Karura trail path in Nairobi: Lat -1.240, Lon 36.825)
  const waypoints: WalkTelemetryWaypoint[] = [
    {
      telemetryId: asWalkTelemetryId('tlm-001'),
      walkSessionId: SEED_WALK_SESSION_ID,
      sequenceNumber: 1,
      timestamp: startToday,
      latitude: -1.2415,
      longitude: 36.8262,
      accuracyMeters: 4.2,
      speedMps: 1.2,
      isSignificantWaypoint: true,
    },
    {
      telemetryId: asWalkTelemetryId('tlm-002'),
      walkSessionId: SEED_WALK_SESSION_ID,
      sequenceNumber: 2,
      timestamp: new Date(new Date(startToday).getTime() + 600000).toISOString(),
      latitude: -1.2435,
      longitude: 36.8285,
      accuracyMeters: 3.8,
      speedMps: 1.4,
      isSignificantWaypoint: true,
    },
    {
      telemetryId: asWalkTelemetryId('tlm-003'),
      walkSessionId: SEED_WALK_SESSION_ID,
      sequenceNumber: 3,
      timestamp: new Date(new Date(startToday).getTime() + 1500000).toISOString(),
      latitude: -1.2468,
      longitude: 36.8312,
      accuracyMeters: 4.0,
      speedMps: 1.3,
      isSignificantWaypoint: true,
    },
    {
      telemetryId: asWalkTelemetryId('tlm-004'),
      walkSessionId: SEED_WALK_SESSION_ID,
      sequenceNumber: 4,
      timestamp: finishToday,
      latitude: -1.2415,
      longitude: 36.8262,
      accuracyMeters: 4.1,
      speedMps: 1.1,
      isSignificantWaypoint: true,
    },
  ];
  waypoints.forEach(w => store.addWaypoint(w));

  // Potty Events
  store.addPottyEvent({
    eventId: 'pty-001',
    walkSessionId: SEED_WALK_SESSION_ID,
    petId: CANONICAL_IDS.PET_KIBO,
    timestamp: new Date(new Date(startToday).getTime() + 300000).toISOString(),
    type: 'PEE',
    hydrationGiven: false,
    notes: 'Hydrant sniffing, standard marking',
  });
  store.addPottyEvent({
    eventId: 'pty-002',
    walkSessionId: SEED_WALK_SESSION_ID,
    petId: CANONICAL_IDS.PET_SIMBA,
    timestamp: new Date(new Date(startToday).getTime() + 900000).toISOString(),
    type: 'POOP',
    poopConsistency: 'NORMAL_FIRM',
    hydrationGiven: true,
    notes: 'Cleaned and bagged promptly. Hydrated at shading bench.',
  });

  // Behaviors
  store.addBehaviorObservation({
    observationId: 'beh-001',
    walkSessionId: SEED_WALK_SESSION_ID,
    petId: CANONICAL_IDS.PET_KIBO,
    timestamp: new Date(new Date(startToday).getTime() + 1200000).toISOString(),
    tag: 'CALM_LOOSE_LEASH',
    notes: 'Excellent walking manners, loose leash through shaded pine trail.',
  });
  store.addBehaviorObservation({
    observationId: 'beh-002',
    walkSessionId: SEED_WALK_SESSION_ID,
    petId: CANONICAL_IDS.PET_SIMBA,
    timestamp: new Date(new Date(startToday).getTime() + 1400000).toISOString(),
    tag: 'PLAYFUL_AND_CURIOUS',
    notes: 'Alert and engaged, friendly greeting with passing Golden Retriever.',
  });

  // Media
  const mediaItem: WalkMedia = {
    mediaId: asWalkMediaId('med-001'),
    walkSessionId: SEED_WALK_SESSION_ID,
    petId: CANONICAL_IDS.PET_KIBO,
    url: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=800&q=80',
    caption: 'Kibo & Simba enjoying the Karura pine trail shade',
    timestamp: new Date(new Date(startToday).getTime() + 1200000).toISOString(),
    isWatermarked: true,
    gpsReferenceOpaque: completedSession.routeReference,
  };
  store.addMedia(mediaItem);

  // Completion Report
  const report: WalkCompletionReport = {
    reportId: completionReportId,
    walkSessionId: SEED_WALK_SESSION_ID,
    bookingId: completedBookingId,
    providerId: CANONICAL_IDS.WALKER_SARAH,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    petIds: [CANONICAL_IDS.PET_KIBO, CANONICAL_IDS.PET_SIMBA],
    completedAt: finishToday,
    totalDurationMinutes: 45,
    totalDistanceKm: 3.42,
    summaryText: 'Vibrant afternoon loop along Karura shaded trail. Both dogs walked in sync with calm loose-leash focus. Water break completed at midpoint, paws wiped and fresh water refilled upon return.',
    pottySummary: {
      peeCount: 2,
      poopCount: 1,
      hydrationProvided: true,
      consistencyNotes: 'NORMAL_FIRM',
    },
    behaviorNotes: 'Exceptional focus and relaxed body language throughout the session.',
    mediaCount: 1,
    mediaEvidence: [mediaItem],
    returnInspectionPassed: true,
    ownerRating: 5,
    ownerFeedback: 'Sarah is wonderful as always! Kibo and Simba are relaxed and happy.',
  };
  store.saveCompletionReport(report);

  // Activity Record Projection (Ensures Activity domain matches walk)
  const activityRecord: ActivityRecord = {
    activityId: activityRecordId,
    petId: CANONICAL_IDS.PET_KIBO,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    activityType: 'WALK',
    sourceType: 'SERVICE_PROVIDER',
    sourceActorId: CANONICAL_IDS.OWNER_ELENA,
    providerId: CANONICAL_IDS.WALKER_SARAH,
    startedAt: startToday,
    endedAt: finishToday,
    durationSeconds: 2700,
    distanceValue: 3.42,
    distanceUnit: 'KILOMETERS',
    distanceSource: 'GPS_MEASURED',
    stepCount: 4620,
    intensity: 'MODERATE',
    locationContext: 'OUTDOOR',
    walkDetails: {
      leashStatus: 'ON_LEASH',
      walkPurpose: 'EXERCISE',
      weatherConditions: 'Sunny, 22°C',
      pacing: 'BRISK',
    },
    notes: report.summaryText,
    sourceEntityId: SEED_WALK_SESSION_ID,
    routeReference: completedSession.routeReference,
    recordedAt: finishToday,
    createdBy: CANONICAL_IDS.OWNER_ELENA,
    createdAt: finishToday,
    updatedAt: finishToday,
    verificationStatus: 'VERIFIED',
  };
  ActivityStore.saveRecord(activityRecord);

  // 2. LIVE ACTIVE WALK SESSION (FOR REAL-TIME OPERATIONAL OBSERVABILITY)
  const activeSession: DogWalkSession = {
    walkSessionId: SEED_ACTIVE_WALK_SESSION_ID,
    bookingId: activeBookingId,
    providerId: CANONICAL_IDS.WALKER_SARAH,
    walkerUserId: CANONICAL_IDS.WALKER_SARAH_USER,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    petIds: [CANONICAL_IDS.PET_KIBO],
    status: 'IN_PROGRESS',
    activeCustodyState: 'CUSTODY_WITH_PROVIDER',
    scheduledStartAt: now,
    scheduledEndAt: new Date(Date.now() + 30 * 60000).toISOString(),
    scheduledDurationMinutes: 30,
    actualStartedAt: now,
    totalElapsedDurationSeconds: 745, // ~12 mins in
    totalPausedDurationSeconds: 0,
    routeReference: 'rt-ref-live-arboretum-02',
    totalDistanceMeters: 980,
    stepCount: 1320,
    accessGrantId: activeAccessGrantId,
    concurrencyVersion: 3,
    createdAt: now,
    updatedAt: now,
  };
  store.saveSession(activeSession);

  store.addWaypoint({
    telemetryId: asWalkTelemetryId('tlm-live-01'),
    walkSessionId: SEED_ACTIVE_WALK_SESSION_ID,
    sequenceNumber: 1,
    timestamp: now,
    latitude: -1.2785,
    longitude: 36.8042,
    accuracyMeters: 3.5,
    speedMps: 1.3,
    isSignificantWaypoint: true,
  });

  store.addPottyEvent({
    eventId: 'pty-live-01',
    walkSessionId: SEED_ACTIVE_WALK_SESSION_ID,
    petId: CANONICAL_IDS.PET_KIBO,
    timestamp: now,
    type: 'PEE',
    hydrationGiven: false,
    notes: 'Morning potty break at arboretum entrance',
  });
}
