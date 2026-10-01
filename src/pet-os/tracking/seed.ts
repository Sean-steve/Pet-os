/**
 * Pet OS Sprint 14 - Tracking & Location Canonical Seed Data
 * Seeds realistic devices, assignments, live locations, routes, and diagnostic health for:
 * - Elena Vance's Household (hh-01951500-0000-7000-8000-000000000001)
 * - Pets: Kibo (pet-kibo-001) & Simba (pet-001)
 * - Walker: Sarah Mwangi (prv-sarah-walker-001)
 * - Real Nairobi locations: Kilimani home base & Karura Forest trail
 */

import {
  asDeviceId,
  asPetId,
  asHouseholdId,
  asUserId,
  asTrackingDeviceAssignmentId,
  asTrackingSessionId,
  asLocationObservationId,
  asRouteId,
  asIngestionId,
  asIntegrationCredentialId,
  generateUUIDv7,
} from '../kernel/ids';
import { TrackingStore } from './store';
import {
  TrackingDevice,
  TrackingDeviceAssignment,
  TrackingSession,
  LocationObservation,
  PetLiveLocation,
  LocationRoute,
  DeviceHealth,
  TrackerIntegration,
} from './types';
import { CANONICAL_IDS } from '../seed/unified-seed';
import { calculateFilteredRouteDistance } from './geospatial';

export const TRACKING_SEED_IDS = {
  DEVICE_TRACTIVE_KIBO: asDeviceId('dev-tractive-gps-001'),
  DEVICE_FI_SIMBA: asDeviceId('dev-fi-collar-002'),
  DEVICE_PHONE_SARAH: asDeviceId('dev-phone-sarah-003'),
  DEVICE_FUTURE_PETOS: asDeviceId('dev-petos-smart-004'),
  INTEGRATION_TRACTIVE: asIntegrationCredentialId('intg-tractive-001'),
};

/**
 * Karura Forest scenic trail coordinates in Nairobi (-1.2425, 36.8245)
 */
export const KARURA_TRAIL_COORDINATES = [
  { lat: -1.24250, lng: 36.82450, alt: 1680, acc: 8 },
  { lat: -1.24285, lng: 36.82490, alt: 1681, acc: 7 },
  { lat: -1.24320, lng: 36.82535, alt: 1682, acc: 6 },
  { lat: -1.24360, lng: 36.82590, alt: 1683, acc: 8 },
  { lat: -1.24410, lng: 36.82640, alt: 1685, acc: 9 },
  { lat: -1.24460, lng: 36.82700, alt: 1686, acc: 8 },
  { lat: -1.24520, lng: 36.82760, alt: 1688, acc: 7 },
  { lat: -1.24580, lng: 36.82820, alt: 1689, acc: 8 },
  { lat: -1.24640, lng: 36.82875, alt: 1690, acc: 9 },
  { lat: -1.24700, lng: 36.82930, alt: 1691, acc: 7 },
  { lat: -1.24760, lng: 36.82990, alt: 1692, acc: 8 },
  { lat: -1.24820, lng: 36.83050, alt: 1694, acc: 9 },
  { lat: -1.24750, lng: 36.83110, alt: 1693, acc: 10 },
  { lat: -1.24680, lng: 36.83160, alt: 1691, acc: 8 },
  { lat: -1.24600, lng: 36.83190, alt: 1690, acc: 7 },
  { lat: -1.24510, lng: 36.83180, alt: 1688, acc: 8 },
  { lat: -1.24430, lng: 36.83130, alt: 1686, acc: 9 },
  { lat: -1.24350, lng: 36.83060, alt: 1684, acc: 8 },
  { lat: -1.24280, lng: 36.82980, alt: 1682, acc: 7 },
  { lat: -1.24250, lng: 36.82890, alt: 1680, acc: 8 },
];

/**
 * Kilimani Home Base coordinates in Nairobi (-1.2892, 36.7865)
 */
export const KILIMANI_HOME_COORDINATES = {
  lat: -1.2892,
  lng: 36.7865,
  acc: 6,
};

export function seedTrackingData(store: TrackingStore = TrackingStore.getInstance()): void {
  const now = new Date();
  const nowIso = now.toISOString();

  // One hour ago for historical route start
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000);

  // ==========================================================================
  // 1. DEVICE REGISTRY
  // ==========================================================================

  const tractiveKibo: TrackingDevice = {
    deviceId: TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO,
    deviceType: 'GPS_CELLULAR_TRACKER',
    provider: 'TRACTIVE',
    externalDeviceReference: 'TRK-EA-90821-X',
    serialNumberMasked: 'TRK-***-8921',
    displayName: "Kibo's Tractive GPS XL",
    model: 'Tractive GPS DOG 4 (LTE-M)',
    hardwareVersion: 'v4.2',
    firmwareVersion: '3.18.4',
    operationalStatus: 'ACTIVE',
    connectivityStatus: 'ONLINE',
    batteryStatus: 'NORMAL',
    batteryPercent: 82,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    claimedAt: new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString(),
    claimedBy: CANONICAL_IDS.OWNER_ELENA,
    lastSeenAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
    lastLocationAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
    createdAt: new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString(),
    updatedAt: nowIso,
  };

  const fiSimba: TrackingDevice = {
    deviceId: TRACKING_SEED_IDS.DEVICE_FI_SIMBA,
    deviceType: 'GPS_CELLULAR_TRACKER',
    provider: 'FI',
    externalDeviceReference: 'FI-SERIES3-8812',
    serialNumberMasked: 'FI3-***-4412',
    displayName: "Simba's Fi Collar Series 3",
    model: 'Fi Series 3 Smart Dog Collar',
    hardwareVersion: 'Series 3 Rev C',
    firmwareVersion: 'v2.4.1',
    operationalStatus: 'ACTIVE',
    connectivityStatus: 'ONLINE',
    batteryStatus: 'NORMAL',
    batteryPercent: 91,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    claimedAt: new Date(now.getTime() - 45 * 24 * 3600 * 1000).toISOString(),
    claimedBy: CANONICAL_IDS.OWNER_ELENA,
    lastSeenAt: new Date(now.getTime() - 4 * 60 * 1000).toISOString(),
    lastLocationAt: new Date(now.getTime() - 4 * 60 * 1000).toISOString(),
    createdAt: new Date(now.getTime() - 45 * 24 * 3600 * 1000).toISOString(),
    updatedAt: nowIso,
  };

  const phoneSarah: TrackingDevice = {
    deviceId: TRACKING_SEED_IDS.DEVICE_PHONE_SARAH,
    deviceType: 'PHONE_LOCATION_SOURCE',
    provider: 'PET_OS_MOBILE',
    externalDeviceReference: 'SARAH-IPHONE-15-PRO',
    serialNumberMasked: 'MOB-***-9901',
    displayName: "Sarah's Walker Companion (iPhone)",
    model: 'Apple iPhone 15 Pro (High-Precision Dual GPS)',
    hardwareVersion: 'A2848',
    firmwareVersion: 'iOS 18.2 / Pet OS v1.14',
    operationalStatus: 'ACTIVE',
    connectivityStatus: 'ONLINE',
    batteryStatus: 'NORMAL',
    batteryPercent: 68,
    claimedAt: new Date(now.getTime() - 60 * 24 * 3600 * 1000).toISOString(),
    claimedBy: CANONICAL_IDS.WALKER_SARAH_USER,
    lastSeenAt: new Date(now.getTime() - 1 * 60 * 1000).toISOString(),
    lastLocationAt: new Date(now.getTime() - 1 * 60 * 1000).toISOString(),
    createdAt: new Date(now.getTime() - 60 * 24 * 3600 * 1000).toISOString(),
    updatedAt: nowIso,
  };

  const futurePetOS: TrackingDevice = {
    deviceId: TRACKING_SEED_IDS.DEVICE_FUTURE_PETOS,
    deviceType: 'FUTURE_PET_OS_TRACKER',
    provider: 'PET_OS_HARDWARE',
    externalDeviceReference: 'PETOS-COLLAR-HW-DEV-001',
    serialNumberMasked: 'POS-***-0001',
    displayName: 'Pet OS Satellite-Hybrid Prototype',
    model: 'Pet OS Smart Band Gen 1 (BLE + Satellite Dual-Mesh)',
    hardwareVersion: 'Proto B',
    firmwareVersion: 'Zephyr RTOS 3.6',
    operationalStatus: 'CLAIMED',
    connectivityStatus: 'RECENTLY_SEEN',
    batteryStatus: 'NORMAL',
    batteryPercent: 98,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    claimedAt: nowIso,
    claimedBy: CANONICAL_IDS.OWNER_ELENA,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  store.saveDevice(tractiveKibo);
  store.saveDevice(fiSimba);
  store.saveDevice(phoneSarah);
  store.saveDevice(futurePetOS);

  // ==========================================================================
  // 2. DEVICE ASSIGNMENTS
  // ==========================================================================

  const assignKibo: TrackingDeviceAssignment = {
    assignmentId: asTrackingDeviceAssignmentId('asgn-kibo-tractive-001'),
    deviceId: TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO,
    petId: CANONICAL_IDS.PET_KIBO,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    assignedAt: new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString(),
    assignedBy: CANONICAL_IDS.OWNER_ELENA,
    status: 'ACTIVE',
    reason: 'Primary GPS collar for Kibo',
    createdAt: new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString(),
  };

  const assignSimba: TrackingDeviceAssignment = {
    assignmentId: asTrackingDeviceAssignmentId('asgn-simba-fi-002'),
    deviceId: TRACKING_SEED_IDS.DEVICE_FI_SIMBA,
    petId: CANONICAL_IDS.PET_SIMBA,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    assignedAt: new Date(now.getTime() - 45 * 24 * 3600 * 1000).toISOString(),
    assignedBy: CANONICAL_IDS.OWNER_ELENA,
    status: 'ACTIVE',
    reason: 'Primary smart collar for Simba',
    createdAt: new Date(now.getTime() - 45 * 24 * 3600 * 1000).toISOString(),
  };

  store.saveAssignment(assignKibo);
  store.saveAssignment(assignSimba);

  // ==========================================================================
  // 3. DEVICE HEALTH
  // ==========================================================================

  store.saveDeviceHealth({
    deviceId: TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO,
    lastSeenAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
    lastLocationAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
    batteryPercent: 82,
    batteryState: 'NORMAL',
    connectivityState: 'ONLINE',
    networkType: 'Safaricom LTE-M (Band 20)',
    firmwareVersion: '3.18.4',
    locationSourceState: 'ACTIVE',
    updatedAt: nowIso,
  });

  store.saveDeviceHealth({
    deviceId: TRACKING_SEED_IDS.DEVICE_FI_SIMBA,
    lastSeenAt: new Date(now.getTime() - 4 * 60 * 1000).toISOString(),
    lastLocationAt: new Date(now.getTime() - 4 * 60 * 1000).toISOString(),
    batteryPercent: 91,
    batteryState: 'NORMAL',
    connectivityState: 'ONLINE',
    networkType: 'Airtel NB-IoT',
    firmwareVersion: 'v2.4.1',
    locationSourceState: 'ACTIVE',
    updatedAt: nowIso,
  });

  store.saveDeviceHealth({
    deviceId: TRACKING_SEED_IDS.DEVICE_PHONE_SARAH,
    lastSeenAt: new Date(now.getTime() - 1 * 60 * 1000).toISOString(),
    lastLocationAt: new Date(now.getTime() - 1 * 60 * 1000).toISOString(),
    batteryPercent: 68,
    batteryState: 'NORMAL',
    connectivityState: 'ONLINE',
    networkType: '5G High-Precision',
    locationSourceState: 'ACTIVE',
    updatedAt: nowIso,
  });

  // ==========================================================================
  // 4. THIRD-PARTY INTEGRATION
  // ==========================================================================

  const tractiveIntegration: TrackerIntegration = {
    integrationId: TRACKING_SEED_IDS.INTEGRATION_TRACTIVE,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    provider: 'TRACTIVE',
    status: 'CONNECTED',
    encryptedAccessToken: 'enc_sec_tractive_oauth_token_verified_99',
    tokenExpiresAt: new Date(now.getTime() + 90 * 24 * 3600 * 1000).toISOString(),
    connectedAt: new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString(),
    lastSyncAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
  };

  store.saveIntegration(tractiveIntegration);

  // ==========================================================================
  // 5. HISTORICAL COMPLETED ROUTE IN KARURA FOREST (For Kibo)
  // ==========================================================================

  const historicalSessionId = asTrackingSessionId('trksess-karura-walk-001');
  const historicalRouteReference = 'rt-ref-karura-trail-verified-001';

  const karuraSession: TrackingSession = {
    trackingSessionId: historicalSessionId,
    petId: CANONICAL_IDS.PET_KIBO,
    sourceDeviceId: TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO,
    sourceType: 'TRACKER_DEVICE',
    sourceContextType: 'DOG_WALK',
    sourceContextId: 'wlk-sess-01955000-0001-7000-8000-000000000001',
    status: 'COMPLETED',
    startedAt: oneHourAgo.toISOString(),
    endedAt: thirtyMinsAgo.toISOString(),
    trackingMode: 'ACTIVE_SESSION',
    routeReference: historicalRouteReference,
    createdBy: CANONICAL_IDS.WALKER_SARAH_USER,
    createdAt: oneHourAgo.toISOString(),
    updatedAt: thirtyMinsAgo.toISOString(),
  };

  store.saveTrackingSession(karuraSession);

  // Generate historical observations along Karura trail
  const routePoints: Array<{ latitude: number; longitude: number; observedAt: string; accuracyM: number }> = [];

  KARURA_TRAIL_COORDINATES.forEach((coord, idx) => {
    const pointTime = new Date(oneHourAgo.getTime() + idx * 90 * 1000); // every 90 seconds
    const pointTimeIso = pointTime.toISOString();
    const obsId = asLocationObservationId(`obs-karura-${idx.toString().padStart(3, '0')}`);

    const observation: LocationObservation = {
      locationObservationId: obsId,
      petId: CANONICAL_IDS.PET_KIBO,
      assignmentId: assignKibo.assignmentId,
      trackingSessionId: historicalSessionId,
      deviceId: TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO,
      sourceType: 'TRACKER_DEVICE',
      sourceProvider: 'TRACTIVE',
      observedAt: pointTimeIso,
      receivedAt: new Date(pointTime.getTime() + 1200).toISOString(), // 1.2s network latency
      latitude: coord.lat,
      longitude: coord.lng,
      accuracyM: coord.acc,
      altitudeM: coord.alt,
      speedMps: 1.35, // typical dog walking speed (~4.8 km/h)
      headingDegrees: 45 + idx * 5,
      quality: 'HIGH',
      clockSkewMs: 1200,
      flags: [],
      ingestionId: asIngestionId(`ing-karura-${idx}`),
      sequence: idx + 1,
      createdAt: pointTimeIso,
    };

    store.saveObservation(observation);
    routePoints.push({
      latitude: coord.lat,
      longitude: coord.lng,
      observedAt: pointTimeIso,
      accuracyM: coord.acc,
    });
  });

  const distCalc = calculateFilteredRouteDistance(routePoints);

  const karuraRoute: LocationRoute = {
    routeId: asRouteId('rt-karura-001'),
    petId: CANONICAL_IDS.PET_KIBO,
    trackingSessionId: historicalSessionId,
    sourceContextType: 'DOG_WALK',
    sourceContextId: 'wlk-sess-01955000-0001-7000-8000-000000000001',
    startedAt: oneHourAgo.toISOString(),
    endedAt: thirtyMinsAgo.toISOString(),
    status: 'COMPLETED',
    pointCount: routePoints.length,
    distanceMeters: distCalc.distanceMeters,
    distanceReliability: distCalc.reliability,
    durationSeconds: 30 * 60,
    routeReference: historicalRouteReference,
    simplifiedPoints: routePoints,
    qualitySummary: {
      highQualityPoints: routePoints.length,
      mediumQualityPoints: 0,
      lowQualityPoints: 0,
      anomalyCount: 0,
    },
    createdAt: oneHourAgo.toISOString(),
    completedAt: thirtyMinsAgo.toISOString(),
  };

  store.saveRoute(karuraRoute);

  // ==========================================================================
  // 6. LIVE LOCATION PROJECTIONS (Kilimani Home Sanctuary)
  // ==========================================================================

  const liveKiboObsId = asLocationObservationId('obs-kibo-live-kilimani');
  const liveKiboObs: LocationObservation = {
    locationObservationId: liveKiboObsId,
    petId: CANONICAL_IDS.PET_KIBO,
    assignmentId: assignKibo.assignmentId,
    deviceId: TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO,
    sourceType: 'TRACKER_DEVICE',
    sourceProvider: 'TRACTIVE',
    observedAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
    receivedAt: new Date(now.getTime() - 2 * 60 * 1000 + 800).toISOString(),
    latitude: KILIMANI_HOME_COORDINATES.lat,
    longitude: KILIMANI_HOME_COORDINATES.lng,
    accuracyM: KILIMANI_HOME_COORDINATES.acc,
    altitudeM: 1675,
    speedMps: 0.1,
    headingDegrees: 180,
    quality: 'HIGH',
    clockSkewMs: 800,
    flags: [],
    ingestionId: asIngestionId('ing-live-kibo'),
    createdAt: nowIso,
  };

  store.saveObservation(liveKiboObs);

  const liveKibo: PetLiveLocation = {
    petId: CANONICAL_IDS.PET_KIBO,
    latestObservationId: liveKiboObsId,
    observedAt: liveKiboObs.observedAt,
    latitude: liveKiboObs.latitude,
    longitude: liveKiboObs.longitude,
    accuracyM: liveKiboObs.accuracyM,
    quality: 'HIGH',
    source: 'TRACKER_DEVICE',
    deviceId: TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO,
    freshness: 'LIVE',
    flags: [],
    updatedAt: nowIso,
  };

  store.saveLiveLocation(liveKibo);

  // Simba live location
  const liveSimbaObsId = asLocationObservationId('obs-simba-live-kilimani');
  const liveSimbaObs: LocationObservation = {
    locationObservationId: liveSimbaObsId,
    petId: CANONICAL_IDS.PET_SIMBA,
    assignmentId: assignSimba.assignmentId,
    deviceId: TRACKING_SEED_IDS.DEVICE_FI_SIMBA,
    sourceType: 'TRACKER_DEVICE',
    sourceProvider: 'FI',
    observedAt: new Date(now.getTime() - 4 * 60 * 1000).toISOString(),
    receivedAt: new Date(now.getTime() - 4 * 60 * 1000 + 950).toISOString(),
    latitude: KILIMANI_HOME_COORDINATES.lat + 0.0001,
    longitude: KILIMANI_HOME_COORDINATES.lng - 0.0001,
    accuracyM: 8,
    altitudeM: 1675,
    speedMps: 0.0,
    quality: 'HIGH',
    clockSkewMs: 950,
    flags: [],
    ingestionId: asIngestionId('ing-live-simba'),
    createdAt: nowIso,
  };

  store.saveObservation(liveSimbaObs);

  const liveSimba: PetLiveLocation = {
    petId: CANONICAL_IDS.PET_SIMBA,
    latestObservationId: liveSimbaObsId,
    observedAt: liveSimbaObs.observedAt,
    latitude: liveSimbaObs.latitude,
    longitude: liveSimbaObs.longitude,
    accuracyM: liveSimbaObs.accuracyM,
    quality: 'HIGH',
    source: 'TRACKER_DEVICE',
    deviceId: TRACKING_SEED_IDS.DEVICE_FI_SIMBA,
    freshness: 'LIVE',
    flags: [],
    updatedAt: nowIso,
  };

  store.saveLiveLocation(liveSimba);
}
