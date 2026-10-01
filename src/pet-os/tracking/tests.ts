/**
 * Pet OS Sprint 14 - Tracking & Location Platform Comprehensive Test Suite
 * 
 * Verifies all 17 core domain capabilities:
 * 1. Device Registry & Masked Serial Numbers
 * 2. Device Claiming & Takeover Protection
 * 3. Single Active Assignment & History Preservation
 * 4. Device Reassignment & Historical Attribution Isolation
 * 5. Webhook Telemetry Ingestion & Signature Verification
 * 6. Telemetry Deduplication Idempotency
 * 7. Coordinate Bounds Validation & Dead Letter Routing
 * 8. Clock Skew Detection & Quality Classification
 * 9. Speed & Jump Anomaly Filtering
 * 10. Monotonic Live Location (Out-of-Order Packet Defense)
 * 11. Active Tracking Session & Filtered Route Accumulation
 * 12. Dog Walking & Activity Cross-Domain Projection (ADR-008 Opaque Route Reference)
 * 13. Mobile Phone Location Source & Active Walk Session Scoping
 * 14. Device Health & Battery Alert Deduplication
 * 15. Location Authorization Policy & Anti-Stalking Protections
 * 16. Dead Letter Replay & Reprocessing
 * 17. Future Contracts (Tracking Modes & Last Known Location)
 */

import {
  asDeviceId,
  asPetId,
  asHouseholdId,
  asUserId,
  asWalkSessionId,
  asTrackingSessionId,
  generateUUIDv7,
} from '../kernel/ids';
import { TrackingStore } from './store';
import { TrackingService } from './service';
import { seedTrackingData, TRACKING_SEED_IDS, KILIMANI_HOME_COORDINATES } from './seed';
import { CANONICAL_IDS, seedUnifiedPetOS } from '../seed/unified-seed';
import { haversineDistanceMeters } from './geospatial';
import { ActivityStore } from '../activity/store';
import { DogWalkingStore } from '../dog-walking/store';
import { NotificationStore } from '../notifications/store';
import { seedDogWalkingData } from '../dog-walking/seed';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export async function runSprint14TrackingTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  const runTest = async (name: string, fn: () => void | Promise<void>) => {
    const start = Date.now();
    try {
      await fn();
      results.push({ name, passed: true, durationMs: Date.now() - start });
    } catch (err) {
      results.push({
        name,
        passed: false,
        error: (err as Error).message,
        durationMs: Date.now() - start,
      });
    }
  };

  // Helper setup
  const setupFresh = async () => {
    await seedUnifiedPetOS({ forceReset: true });
    seedDogWalkingData();
    seedTrackingData();
  };

  // --------------------------------------------------------------------------
  // TEST 1: Device Registry & Masked Serial Numbers
  // --------------------------------------------------------------------------
  await runTest('1. Device Registry & Masked Serial Numbers', async () => {
    await setupFresh();
    const service = TrackingService.getInstance();
    const store = TrackingStore.getInstance();

    const dev = service.registerDevice({
      deviceType: 'GPS_CELLULAR_TRACKER',
      provider: 'TRACTIVE',
      externalDeviceReference: 'TEST-DEV-REF-9988',
      serialNumber: 'SN-99882211',
      displayName: 'Test Tractive Device',
      model: 'Tractive 4 LTE',
      hardwareVersion: 'v2.0',
      firmwareVersion: '1.0.4',
    });

    if (!dev.deviceId.startsWith('dev-')) {
      throw new Error(`Expected deviceId prefix 'dev-', got: ${dev.deviceId}`);
    }
    if (dev.serialNumberMasked.includes('99882211')) {
      throw new Error(`Sensitive serial number was not masked: ${dev.serialNumberMasked}`);
    }
    if (dev.operationalStatus !== 'UNCLAIMED') {
      throw new Error(`Expected newly registered device to be UNCLAIMED, got: ${dev.operationalStatus}`);
    }

    const fetched = store.getDevice(dev.deviceId);
    if (!fetched || fetched.displayName !== 'Test Tractive Device') {
      throw new Error('Device not found in registry store');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: Device Claiming & Takeover Protection
  // --------------------------------------------------------------------------
  await runTest('2. Device Claiming & Takeover Protection', async () => {
    await setupFresh();
    const service = TrackingService.getInstance();
    const store = TrackingStore.getInstance();

    const dev = service.registerDevice({
      deviceType: 'GPS_CELLULAR_TRACKER',
      provider: 'FI',
      externalDeviceReference: 'FI-CLAIM-TEST-01',
      serialNumber: 'FI-991188',
      displayName: 'Claim Test Collar',
      model: 'Series 3',
    });

    // Elena claims the device
    service.claimDevice({
      deviceId: dev.deviceId,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      actorUserId: CANONICAL_IDS.OWNER_ELENA,
    });

    const claimedDev = store.getDevice(dev.deviceId);
    if (claimedDev?.operationalStatus !== 'CLAIMED' || claimedDev.householdId !== CANONICAL_IDS.MAIN_HOUSEHOLD) {
      throw new Error('Device claim failed to update status and household');
    }

    // Brian Outside attempts unauthorized takeover of Elena's device
    let takeoverBlocked = false;
    try {
      service.claimDevice({
        deviceId: dev.deviceId,
        householdId: CANONICAL_IDS.OUTSIDER_HOUSEHOLD,
        actorUserId: CANONICAL_IDS.OUTSIDER_BRIAN,
      });
    } catch {
      takeoverBlocked = true;
    }

    if (!takeoverBlocked) {
      throw new Error('Device takeover by outsider household was NOT blocked!');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Single Active Assignment & History Preservation
  // --------------------------------------------------------------------------
  await runTest('3. Single Active Assignment & History Preservation', async () => {
    await setupFresh();
    const service = TrackingService.getInstance();
    const store = TrackingStore.getInstance();

    // Check pre-seeded assignment for Kibo
    const activeKibo = store.getActiveAssignmentForPet(CANONICAL_IDS.PET_KIBO);
    if (!activeKibo || activeKibo.deviceId !== TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO) {
      throw new Error('Expected active assignment for Kibo with Tractive GPS');
    }

    // Unassign device
    service.unassignDeviceFromPet({
      deviceId: TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO,
      petId: CANONICAL_IDS.PET_KIBO,
      actorUserId: CANONICAL_IDS.OWNER_ELENA,
      reason: 'Collar maintenance',
    });

    const afterUnassign = store.getActiveAssignmentForPet(CANONICAL_IDS.PET_KIBO);
    if (afterUnassign !== undefined) {
      throw new Error('Expected no active assignment after unassignment');
    }

    // Check assignment history was preserved
    const history = store.getAssignmentsForPet(CANONICAL_IDS.PET_KIBO);
    if (history.length === 0 || history[0].status !== 'TERMINATED') {
      throw new Error('Assignment history was not preserved with TERMINATED state');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Device Reassignment & Historical Attribution Isolation
  // --------------------------------------------------------------------------
  await runTest('4. Device Reassignment & Historical Attribution Isolation', async () => {
    await setupFresh();
    const service = TrackingService.getInstance();
    const store = TrackingStore.getInstance();

    // Tractive device was assigned to Kibo 30 days ago
    const historicalTime = new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString();
    const resolvedOldPet = store.resolveAssignmentAtTime(
      TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO,
      historicalTime
    );

    if (resolvedOldPet?.petId !== CANONICAL_IDS.PET_KIBO) {
      throw new Error(`Historical resolution expected Kibo, got: ${resolvedOldPet?.petId}`);
    }

    // Now reassign device from Kibo to Luna
    service.assignDeviceToPet({
      deviceId: TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO,
      petId: CANONICAL_IDS.PET_LUNA,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      actorUserId: CANONICAL_IDS.OWNER_ELENA,
      reason: 'Pass collar to Luna',
    });

    // Active assignment now resolves to Luna
    const currentAssignment = store.getActiveAssignmentForDevice(
      TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO
    );
    if (currentAssignment?.petId !== CANONICAL_IDS.PET_LUNA) {
      throw new Error('Reassignment failed to switch active pet to Luna');
    }

    // Historical resolution at older time STILL resolves to Kibo!
    const resolvedAgain = store.resolveAssignmentAtTime(
      TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO,
      historicalTime
    );
    if (resolvedAgain?.petId !== CANONICAL_IDS.PET_KIBO) {
      throw new Error('Historical telemetry attribution was mutated by reassignment!');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: Webhook Telemetry Ingestion & Signature Verification
  // --------------------------------------------------------------------------
  await runTest('5. Webhook Telemetry Ingestion & Signature Verification', async () => {
    await setupFresh();
    const service = TrackingService.getInstance();
    const store = TrackingStore.getInstance();

    // Valid webhook
    const validRes = service.ingestWebhook({
      provider: 'TRACTIVE',
      signature: 'simulated_sig_valid',
      rawPayload: {
        tracker_id: 'TRK-EA-90821-X',
        lat: -1.2895,
        lon: 36.7868,
        accuracy: 8,
        time: new Date().toISOString(),
        battery_level: 80,
      },
    });

    if (validRes.processedCount !== 1) {
      throw new Error(`Expected 1 processed point, got: ${validRes.processedCount} (errors: ${validRes.errors.join(', ')})`);
    }

    // Invalid signature
    const invalidRes = service.ingestWebhook({
      provider: 'TRACTIVE',
      signature: 'bad_signature_tampered',
      rawPayload: {
        tracker_id: 'TRK-EA-90821-X',
        lat: -1.2895,
        lon: 36.7868,
      },
    });

    if (invalidRes.processedCount !== 0 || invalidRes.errors.length === 0) {
      throw new Error('Invalid signature was not rejected');
    }

    const deadLetters = store.listDeadLetters();
    const sigDl = deadLetters.find(d => d.errorClassification === 'SIGNATURE_INVALID');
    if (!sigDl) {
      throw new Error('Invalid signature was not logged to dead letter queue');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: Telemetry Deduplication Idempotency
  // --------------------------------------------------------------------------
  await runTest('6. Telemetry Deduplication Idempotency', async () => {
    await setupFresh();
    const service = TrackingService.getInstance();
    const store = TrackingStore.getInstance();

    const eventId = 'uniq-evt-tractive-889';
    const payload = {
      positions: [
        {
          device_id: 'TRK-EA-90821-X',
          event_id: eventId,
          lat: -1.2894,
          lon: 36.7867,
          accuracy: 5,
          time: new Date().toISOString(),
        },
      ],
    };

    // First ingestion
    const res1 = service.ingestWebhook({
      provider: 'TRACTIVE',
      signature: 'simulated_sig_valid',
      rawPayload: payload,
    });
    if (res1.processedCount !== 1) {
      throw new Error('First ingestion failed');
    }

    // Second ingestion (replay of duplicate event)
    const res2 = service.ingestWebhook({
      provider: 'TRACTIVE',
      signature: 'simulated_sig_valid',
      rawPayload: payload,
    });
    if (res2.processedCount !== 0 || res2.deduplicatedCount !== 1) {
      throw new Error(`Deduplication failed: processed=${res2.processedCount}, deduped=${res2.deduplicatedCount}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: Coordinate Bounds Validation & Dead Letter Routing
  // --------------------------------------------------------------------------
  await runTest('7. Coordinate Bounds Validation & Dead Letter Routing', async () => {
    await setupFresh();
    const service = TrackingService.getInstance();
    const store = TrackingStore.getInstance();

    const badPayload = {
      tracker_id: 'TRK-EA-90821-X',
      lat: 195.42, // Invalid latitude (> 90)
      lon: 36.78,
      time: new Date().toISOString(),
    };

    const res = service.ingestWebhook({
      provider: 'TRACTIVE',
      signature: 'simulated_sig_valid',
      rawPayload: badPayload,
    });

    if (res.processedCount !== 0) {
      throw new Error('Malformed coordinates were accepted!');
    }

    const deadLetters = store.listDeadLetters();
    const coordDl = deadLetters.find(d => d.errorClassification === 'MALFORMED_COORDINATES');
    if (!coordDl) {
      throw new Error('Malformed coordinates not logged in dead letter queue');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: Clock Skew Detection & Quality Classification
  // --------------------------------------------------------------------------
  await runTest('8. Clock Skew Detection & Quality Classification', async () => {
    await setupFresh();
    const service = TrackingService.getInstance();
    const store = TrackingStore.getInstance();

    // 15 minutes clock skew (buffered packet)
    const skewedObserved = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    service.ingestWebhook({
      provider: 'TRACTIVE',
      signature: 'simulated_sig_valid',
      rawPayload: {
        tracker_id: 'TRK-EA-90821-X',
        lat: -1.2890,
        lon: 36.7860,
        accuracy: 12,
        time: skewedObserved,
      },
    });

    const obs = store.getObservationsForPet(CANONICAL_IDS.PET_KIBO);
    const lastObs = obs.find(o => o.observedAt === skewedObserved);
    if (!lastObs) {
      throw new Error('Observation not recorded');
    }

    if (!lastObs.flags.includes('CLOCK_SKEW_EXCESSIVE')) {
      throw new Error('Clock skew anomaly was not flagged');
    }
    if (lastObs.quality !== 'HIGH') {
      throw new Error(`Expected HIGH quality for 12m accuracy, got: ${lastObs.quality}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 9: Speed & Jump Anomaly Filtering
  // --------------------------------------------------------------------------
  await runTest('9. Speed & Jump Anomaly Filtering', async () => {
    await setupFresh();
    const service = TrackingService.getInstance();
    const store = TrackingStore.getInstance();

    const baseTime = Date.now();

    // Point 1: Kilimani
    service.ingestWebhook({
      provider: 'TRACTIVE',
      signature: 'simulated_sig_valid',
      rawPayload: {
        tracker_id: 'TRK-EA-90821-X',
        lat: -1.2892,
        lon: 36.7865,
        accuracy: 10,
        time: new Date(baseTime).toISOString(),
      },
    });

    // Point 2: Sudden jump 5km away 2 seconds later (Teleportation jump)
    service.ingestWebhook({
      provider: 'TRACTIVE',
      signature: 'simulated_sig_valid',
      rawPayload: {
        tracker_id: 'TRK-EA-90821-X',
        lat: -1.2425, // Karura forest (5km away)
        lon: 36.8245,
        accuracy: 10,
        time: new Date(baseTime + 2000).toISOString(),
      },
    });

    const obs = store.getObservationsForPet(CANONICAL_IDS.PET_KIBO);
    const jumpObs = obs[obs.length - 1];

    if (!jumpObs.flags.includes('SUSPECT_JUMP') && !jumpObs.flags.includes('SUSPECT_SPEED')) {
      throw new Error('Teleportation jump was not detected by anomaly engine');
    }
    if (jumpObs.quality !== 'LOW') {
      throw new Error(`Expected LOW quality for anomalous jump, got: ${jumpObs.quality}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 10: Monotonic Live Location (Out-of-Order Packet Defense)
  // --------------------------------------------------------------------------
  await runTest('10. Monotonic Live Location (Out-of-Order Packet Defense)', async () => {
    await setupFresh();
    const service = TrackingService.getInstance();
    const store = TrackingStore.getInstance();

    const now = Date.now();
    const liveTime = new Date(now).toISOString();
    const staleHistoricalTime = new Date(now - 10 * 60 * 1000).toISOString(); // 10 minutes ago

    // 1. Packet A arrives: fresh real-time point
    service.ingestWebhook({
      provider: 'TRACTIVE',
      signature: 'simulated_sig_valid',
      rawPayload: {
        tracker_id: 'TRK-EA-90821-X',
        lat: -1.2893,
        lon: 36.7866,
        accuracy: 6,
        time: liveTime,
      },
    });

    const liveAfterA = store.getLiveLocation(CANONICAL_IDS.PET_KIBO);
    if (!liveAfterA || liveAfterA.observedAt !== liveTime) {
      throw new Error('Live location not updated for fresh packet');
    }

    // 2. Delayed Packet B arrives out-of-order: observed 10 minutes ago
    service.ingestWebhook({
      provider: 'TRACTIVE',
      signature: 'simulated_sig_valid',
      rawPayload: {
        tracker_id: 'TRK-EA-90821-X',
        lat: -1.2700,
        lon: 36.7500,
        accuracy: 10,
        time: staleHistoricalTime,
      },
    });

    const liveAfterB = store.getLiveLocation(CANONICAL_IDS.PET_KIBO);
    // Monotonic invariant: live location MUST NOT regress to the 10-minute old point!
    if (liveAfterB?.observedAt === staleHistoricalTime) {
      throw new Error('CRITICAL FLAW: Out-of-order historical packet regressed live location!');
    }
    if (liveAfterB?.observedAt !== liveTime) {
      throw new Error('Live location was unexpectedly mutated by out-of-order packet');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 11: Active Tracking Session & Filtered Route Accumulation
  // --------------------------------------------------------------------------
  await runTest('11. Active Tracking Session & Filtered Route Accumulation', async () => {
    await setupFresh();
    const service = TrackingService.getInstance();
    const store = TrackingStore.getInstance();

    const dummyWalkId = asWalkSessionId('wlk-sess-test-accumulation');
    const { trackingSessionId, routeReference } = service.startTrackingSessionForWalk({
      walkSessionId: dummyWalkId,
      petIds: [CANONICAL_IDS.PET_KIBO],
      walkerUserId: CANONICAL_IDS.WALKER_SARAH_USER,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    });

    const baseTime = Date.now();

    // Stream 3 progressive walk points
    const pts = [
      { lat: -1.24250, lng: 36.82450 },
      { lat: -1.24300, lng: 36.82500 },
      { lat: -1.24350, lng: 36.82550 },
    ];

    pts.forEach((pt, i) => {
      service.ingestWebhook({
        provider: 'TRACTIVE',
        signature: 'simulated_sig_valid',
        rawPayload: {
          tracker_id: 'TRK-EA-90821-X',
          lat: pt.lat,
          lon: pt.lng,
          accuracy: 6,
          time: new Date(baseTime + i * 30000).toISOString(),
        },
      });
    });

    const route = store.getRouteForSession(trackingSessionId);
    if (!route || route.pointCount !== 3) {
      throw new Error(`Expected 3 accumulated route points, got: ${route?.pointCount}`);
    }
    if (route.distanceMeters <= 50) {
      throw new Error(`Expected non-zero distance for walk points, got: ${route.distanceMeters}m`);
    }
    if (route.routeReference !== routeReference) {
      throw new Error('Route reference does not match session');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 12: Dog Walking & Activity Cross-Domain Projection (ADR-008)
  // --------------------------------------------------------------------------
  await runTest('12. Dog Walking & Activity Cross-Domain Projection (ADR-008)', async () => {
    await setupFresh();
    const service = TrackingService.getInstance();
    const store = TrackingStore.getInstance();

    const dummyWalkId = asWalkSessionId('wlk-sess-test-activity-projection');
    const { trackingSessionId, routeReference } = service.startTrackingSessionForWalk({
      walkSessionId: dummyWalkId,
      petIds: [CANONICAL_IDS.PET_KIBO],
      walkerUserId: CANONICAL_IDS.WALKER_SARAH_USER,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    });

    const baseTime = Date.now();
    service.ingestWebhook({
      provider: 'TRACTIVE',
      signature: 'simulated_sig_valid',
      rawPayload: {
        tracker_id: 'TRK-EA-90821-X',
        lat: -1.24250,
        lon: 36.82450,
        accuracy: 5,
        time: new Date(baseTime).toISOString(),
      },
    });

    service.ingestWebhook({
      provider: 'TRACTIVE',
      signature: 'simulated_sig_valid',
      rawPayload: {
        tracker_id: 'TRK-EA-90821-X',
        lat: -1.24500,
        lon: 36.82700,
        accuracy: 5,
        time: new Date(baseTime + 120000).toISOString(),
      },
    });

    // Finalize tracking session
    const summary = service.endTrackingSessionForWalk({
      trackingSessionId,
      walkSessionId: dummyWalkId,
    });

    if (summary.distanceMeters <= 0) {
      throw new Error('Expected positive completed distance in summary');
    }

    // Verify ActivityStore received the normalized projection
    const activityRecords = ActivityStore.getRecordsForPet(CANONICAL_IDS.PET_KIBO);
    const walkActivity = activityRecords.find(a => a.routeReference === routeReference);
    if (!walkActivity) {
      throw new Error('ActivityStore record not projected from completed tracking session');
    }
    if (walkActivity.distanceValue !== summary.distanceMeters) {
      throw new Error('ActivityRecord distance does not match Tracking summary');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 13: Mobile Phone Location Source & Active Walk Scoping
  // --------------------------------------------------------------------------
  await runTest('13. Mobile Phone Location Source & Active Walk Scoping', async () => {
    await setupFresh();
    const service = TrackingService.getInstance();
    const store = TrackingStore.getInstance();

    // Sarah's canonical walk session in dog walking store
    const walkSession = DogWalkingStore.getInstance().listAllSessions().find(
      s => s.walkerUserId === CANONICAL_IDS.WALKER_SARAH_USER && s.status === 'IN_PROGRESS'
    );

    if (!walkSession) {
      throw new Error('Pre-seeded IN_PROGRESS walk session for Sarah Mwangi not found');
    }

    // Valid mobile telemetry
    const res = service.ingestMobileTelemetry({
      walkerUserId: CANONICAL_IDS.WALKER_SARAH_USER,
      walkSessionId: walkSession.walkSessionId,
      phoneDeviceId: TRACKING_SEED_IDS.DEVICE_PHONE_SARAH,
      coordinates: [
        { lat: -1.2426, lng: 36.8246, accuracyM: 8 },
        { lat: -1.2431, lng: 36.8251, accuracyM: 7 },
      ],
    });

    if (res.processedCount !== 2) {
      throw new Error(`Mobile ingestion expected 2 points, got: ${res.processedCount}`);
    }

    // Unauthorized walker attempt
    let outsiderRejected = false;
    try {
      service.ingestMobileTelemetry({
        walkerUserId: CANONICAL_IDS.OUTSIDER_BRIAN,
        walkSessionId: walkSession.walkSessionId,
        phoneDeviceId: asDeviceId('dev-phone-hacker'),
        coordinates: [{ lat: -1.2426, lng: 36.8246, accuracyM: 10 }],
      });
    } catch {
      outsiderRejected = true;
    }

    if (!outsiderRejected) {
      throw new Error('Outsider mobile telemetry submission was NOT blocked!');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 14: Device Health & Battery Alert Deduplication
  // --------------------------------------------------------------------------
  await runTest('14. Device Health & Battery Alert Deduplication', async () => {
    await setupFresh();
    const service = TrackingService.getInstance();
    const store = TrackingStore.getInstance();

    // Ingest point with CRITICAL battery (8%)
    service.ingestWebhook({
      provider: 'TRACTIVE',
      signature: 'simulated_sig_valid',
      rawPayload: {
        tracker_id: 'TRK-EA-90821-X',
        lat: -1.2892,
        lon: 36.7865,
        battery_level: 8,
        time: new Date().toISOString(),
      },
    });

    const health = store.getDeviceHealth(TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO);
    if (health?.batteryState !== 'CRITICAL' || health.batteryPercent !== 8) {
      throw new Error(`Expected CRITICAL battery state, got: ${health?.batteryState}`);
    }

    // Verify NotificationStore received alert
    const notifs = NotificationStore.getNotificationsForUser(CANONICAL_IDS.OWNER_ELENA);
    const battAlert = notifs.find(n => n.title?.includes('CRITICAL'));
    if (!battAlert) {
      throw new Error('NotificationStore did not record critical battery alert');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 15: Location Authorization Policy & Anti-Stalking Protections
  // --------------------------------------------------------------------------
  await runTest('15. Location Authorization Policy & Anti-Stalking Protections', async () => {
    await setupFresh();
    const service = TrackingService.getInstance();

    // 1. Elena (Owner) has full access
    const ownerAuth = service.checkLocationAccess({
      actorUserId: CANONICAL_IDS.OWNER_ELENA,
      petId: CANONICAL_IDS.PET_KIBO,
      action: 'VIEW_LIVE',
    });
    if (!ownerAuth.granted || ownerAuth.role !== 'PET_OWNER') {
      throw new Error(`Expected owner access granted, got: ${ownerAuth.granted}`);
    }

    // 2. Active walker has access during active walk
    const activeWalk = DogWalkingStore.getInstance().listAllSessions().find(
      s => s.walkerUserId === CANONICAL_IDS.WALKER_SARAH_USER && s.status === 'IN_PROGRESS'
    );
    const walkerAuth = service.checkLocationAccess({
      actorUserId: CANONICAL_IDS.WALKER_SARAH_USER,
      petId: CANONICAL_IDS.PET_KIBO,
      action: 'VIEW_LIVE',
      context: { walkSessionId: activeWalk?.walkSessionId },
    });
    if (!walkerAuth.granted || walkerAuth.role !== 'ACTIVE_SERVICE_PROVIDER') {
      throw new Error(`Expected walker access granted during active walk, got: ${walkerAuth.granted}`);
    }

    // 3. Walker access is DENIED outside active walk
    const completedWalk = DogWalkingStore.getInstance().listAllSessions().find(
      s => s.status === 'COMPLETED'
    );
    const expiredWalkerAuth = service.checkLocationAccess({
      actorUserId: CANONICAL_IDS.WALKER_SARAH_USER,
      petId: CANONICAL_IDS.PET_KIBO,
      action: 'VIEW_LIVE',
      context: { walkSessionId: completedWalk?.walkSessionId },
    });
    if (expiredWalkerAuth.granted) {
      throw new Error('Walker was granted live location access outside active window!');
    }

    // 4. Outsider Brian is completely DENIED
    const outsiderAuth = service.checkLocationAccess({
      actorUserId: CANONICAL_IDS.OUTSIDER_BRIAN,
      petId: CANONICAL_IDS.PET_KIBO,
      action: 'VIEW_LIVE',
    });
    if (outsiderAuth.granted) {
      throw new Error('Outsider was granted access to pet coordinates!');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 16: Dead Letter Replay & Reprocessing
  // --------------------------------------------------------------------------
  await runTest('16. Dead Letter Replay & Reprocessing', async () => {
    await setupFresh();
    const service = TrackingService.getInstance();
    const store = TrackingStore.getInstance();

    service.recordDeadLetter({
      provider: 'TRACTIVE',
      providerEventId: 'dl-test-retry-001',
      sourceDeviceReference: 'TRK-EA-90821-X',
      errorClassification: 'MALFORMED_COORDINATES',
      errorMessage: 'Temporary parsing error',
      rawPayload: JSON.stringify({
        tracker_id: 'TRK-EA-90821-X',
        lat: -1.2892,
        lon: 36.7865,
        accuracy: 10,
        time: new Date().toISOString(),
      }),
      receivedAt: new Date().toISOString(),
    });

    const deadLetters = store.listDeadLetters();
    const dl = deadLetters.find(d => d.providerEventId === 'dl-test-retry-001');
    if (!dl) {
      throw new Error('Dead letter not found');
    }

    const reprocessed = service.reprocessDeadLetter(dl.deadLetterId);
    if (!reprocessed) {
      throw new Error('Dead letter reprocessing failed');
    }

    const after = store.getDeadLetter(dl.deadLetterId);
    if (!after?.reprocessed) {
      throw new Error('Dead letter was not marked reprocessed');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 17: Future Contracts (Tracking Modes & Last Known Location)
  // --------------------------------------------------------------------------
  await runTest('17. Future Contracts (Tracking Modes & Last Known Location)', async () => {
    await setupFresh();
    const service = TrackingService.getInstance();

    const lastLoc = service.getLastKnownLocation(CANONICAL_IDS.PET_KIBO);
    if (!lastLoc || lastLoc.quality !== 'HIGH') {
      throw new Error('Last known location query failed');
    }

    const modeSuccess = await service.requestTrackingMode(
      TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO,
      'FUTURE_LOST_MODE',
      CANONICAL_IDS.OWNER_ELENA
    );
    if (!modeSuccess) {
      throw new Error('Request tracking mode returned false');
    }
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    results,
  };
}
