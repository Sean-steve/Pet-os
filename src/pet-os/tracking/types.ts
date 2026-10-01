/**
 * Pet OS Sprint 14 - Pet Tracking & Location Platform Bounded Context Types
 * 
 * Implements:
 * - Volume XIX (Pet Tracking & Device Architecture)
 * - Volume XX (Location, Geofencing & Lost-Pet Recovery Architecture)
 * - Volume XXI (Pet Identity Network & Device Interoperability)
 * - Volume XXIV (AI Safety & Privacy Boundaries)
 * - Volume XXVI (Notifications & Device Health Alerts)
 * - Volume XXVII (UX/UI & Command Center Location Console)
 * - Volume XXVIII (API & Integration Specification)
 * - Volume XXIX (Event, Command & Asynchronous Architecture)
 * - Volume XXX (Database Schema & Technical Data Dictionary)
 * - Volume XXXI (Security, Privacy, Trust & Anti-Stalking Protections)
 * - Volume XXXII (Kenyan Location Data Protection & Regulatory Compliance)
 * - ADR-003 (UUIDv7 for Primary IDs)
 * - ADR-004 (Household as Primary Access Boundary)
 * - ADR-008 (Exact Location Privacy: Opaque Route Reference Outside Access Window)
 */

import {
  UserId,
  HouseholdId,
  PetId,
  DeviceId,
  TrackingDeviceAssignmentId,
  TrackingSessionId,
  LocationObservationId,
  RouteId,
  IngestionId,
  IntegrationCredentialId,
  DeadLetterEventId,
  WalkSessionId,
} from '../kernel/ids';

// ============================================================================
// TAXONOMY & ENUMS
// ============================================================================

export type DeviceType =
  | 'GPS_CELLULAR_TRACKER'
  | 'GPS_BLUETOOTH_TRACKER'
  | 'PHONE_LOCATION_SOURCE'
  | 'THIRD_PARTY_TRACKER'
  | 'FUTURE_PET_OS_TRACKER'
  | 'OTHER_APPROVED_LOCATION_DEVICE';

export type DeviceOperationalStatus =
  | 'UNCLAIMED'
  | 'CLAIMED'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'LOST_DEVICE'
  | 'RETIRED';

export type DeviceConnectivityStatus =
  | 'ONLINE'
  | 'RECENTLY_SEEN'
  | 'OFFLINE'
  | 'UNKNOWN';

export type BatteryStatus =
  | 'NORMAL'
  | 'LOW'
  | 'CRITICAL'
  | 'UNKNOWN';

export type LocationSourceType =
  | 'TRACKER_DEVICE'
  | 'PHONE_LOCATION_SOURCE'
  | 'BLE_BEACON'
  | 'CROWD_BLE'
  | 'MANUAL_ENTRY'
  | 'SYSTEM_DERIVED';

export type LocationQuality =
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'UNKNOWN';

export type LocationFreshness =
  | 'LIVE'
  | 'RECENT'
  | 'STALE'
  | 'OFFLINE_UNKNOWN';

export type TrackingSessionStatus =
  | 'REQUESTED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type TrackingSessionContextType =
  | 'DOG_WALK'
  | 'GENERAL_PET_TRACKING'
  | 'FUTURE_LOST_PET'
  | 'MANUAL_TEST';

export type TrackingMode =
  | 'NORMAL'
  | 'ACTIVE_SESSION'
  | 'FUTURE_LOST_MODE';

export type RouteStatus =
  | 'ACTIVE'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'INVALIDATED';

export type DistanceReliability =
  | 'HIGH_CONFIDENCE'
  | 'LOW_CONFIDENCE'
  | 'UNAVAILABLE';

export type ObservationAnomalyFlag =
  | 'SUSPECT_SPEED'
  | 'SUSPECT_JUMP'
  | 'POOR_ACCURACY'
  | 'CLOCK_SKEW_EXCESSIVE'
  | 'OFFLINE_BUFFERED';

export type LocationAccessRole =
  | 'PET_OWNER'
  | 'HOUSEHOLD_MEMBER'
  | 'TEMPORARY_CAREGIVER'
  | 'ACTIVE_SERVICE_PROVIDER'
  | 'BUSINESS_OPERATIONS'
  | 'INTERNAL_TRUST_OPERATIONS'
  | 'PUBLIC_USER';

// ============================================================================
// CORE AGGREGATES & ENTITIES
// ============================================================================

/**
 * TrackingDevice: Authoritative hardware or phone-source record in Device Registry.
 * Internal DeviceId is immutable and distinct from vendor serial/IMEI.
 */
export interface TrackingDevice {
  deviceId: DeviceId;
  deviceType: DeviceType;
  provider: string; // e.g. 'TRACTIVE', 'FI', 'WHISTLE', 'PET_OS_MOBILE', 'PET_OS_HARDWARE'
  externalDeviceReference: string; // Sensitive vendor reference / IMEI / external tracker ID
  serialNumberMasked: string; // Publicly safe display (e.g. 'TRK-***-8921')
  displayName: string;
  model: string;
  hardwareVersion: string;
  firmwareVersion: string;
  operationalStatus: DeviceOperationalStatus;
  connectivityStatus: DeviceConnectivityStatus;
  batteryStatus: BatteryStatus;
  batteryPercent?: number; // 0-100
  householdId?: HouseholdId; // Claimed household owner
  claimedAt?: string;
  claimedBy?: UserId;
  lastSeenAt?: string;
  lastLocationAt?: string;
  createdAt: string;
  updatedAt: string;
  retiredAt?: string;
  supportsBleRecovery?: boolean;
  supportsRotatingIdentifier?: boolean;
  supportsLostModeBroadcast?: boolean;
  supportsRemoteModeChange?: boolean;
  bleProtocolVersion?: string;
}

/**
 * TrackingDeviceAssignment: Time-bound association between a device and a pet.
 * Assignment history is immutable: previous intervals are preserved forever.
 */
export interface TrackingDeviceAssignment {
  assignmentId: TrackingDeviceAssignmentId;
  deviceId: DeviceId;
  petId: PetId;
  householdId: HouseholdId;
  assignedAt: string; // ISO 8601 UTC
  assignedBy: UserId;
  unassignedAt?: string; // ISO 8601 UTC
  unassignedBy?: UserId;
  reason?: string;
  status: 'ACTIVE' | 'TERMINATED';
  createdAt: string;
}

/**
 * TrackingSession: Explicit lifecycle for an active tracking context (e.g. Dog Walk).
 */
export interface TrackingSession {
  trackingSessionId: TrackingSessionId;
  petId: PetId;
  sourceDeviceId?: DeviceId;
  sourceType: LocationSourceType;
  sourceContextType: TrackingSessionContextType;
  sourceContextId?: string; // e.g. WalkSessionId
  status: TrackingSessionStatus;
  startedAt: string;
  endedAt?: string;
  trackingMode: TrackingMode;
  routeReference: string; // Opaque token
  createdBy: UserId;
  createdAt: string;
  updatedAt: string;
}

/**
 * Raw Telemetry Ingestion Envelope: Neutral intake format for third-party & mobile streams.
 */
export interface TelemetryEnvelope {
  ingestionId: IngestionId;
  provider: string;
  sourceDeviceReference: string;
  providerEventId: string;
  sequenceNumber?: number;
  observedAt: string; // ISO 8601 UTC as recorded by device clock
  receivedAt: string; // ISO 8601 UTC as received by Pet OS server
  latitude: number;
  longitude: number;
  horizontalAccuracyM: number;
  altitudeM?: number;
  speedMps?: number;
  headingDegrees?: number;
  batteryPercent?: number;
  connectivityMetadata?: {
    networkType?: string;
    rssi?: number;
    cellularTechnology?: string;
  };
  signature?: string;
  signatureVerified: boolean;
  sourcePayloadVersion: string;
  rawPayloadRef?: string;
}

/**
 * Normalized LocationObservation: Canonical domain truth for a single spatial point.
 */
export interface LocationObservation {
  locationObservationId: LocationObservationId;
  petId: PetId;
  assignmentId?: TrackingDeviceAssignmentId;
  trackingSessionId?: TrackingSessionId;
  deviceId: DeviceId;
  sourceType: LocationSourceType;
  sourceProvider: string;
  observedAt: string;
  receivedAt: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  altitudeM?: number;
  speedMps?: number;
  headingDegrees?: number;
  quality: LocationQuality;
  clockSkewMs: number;
  flags: ObservationAnomalyFlag[];
  ingestionId: IngestionId;
  sequence?: number;
  createdAt: string;
}

/**
 * PetLiveLocation: Materialized read projection of the latest verified location.
 * Monotonic: out-of-order stale packets are prevented from regressing live state.
 */
export interface PetLiveLocation {
  petId: PetId;
  latestObservationId: LocationObservationId;
  observedAt: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  quality: LocationQuality;
  source: LocationSourceType;
  deviceId: DeviceId;
  trackingSessionId?: TrackingSessionId;
  freshness: LocationFreshness;
  flags: ObservationAnomalyFlag[];
  updatedAt: string;
}

/**
 * LocationRoute: Historical or active trajectory aggregation.
 */
export interface LocationRoute {
  routeId: RouteId;
  petId: PetId;
  trackingSessionId: TrackingSessionId;
  sourceContextType: TrackingSessionContextType;
  sourceContextId?: string;
  startedAt: string;
  endedAt?: string;
  status: RouteStatus;
  pointCount: number;
  distanceMeters: number;
  distanceReliability: DistanceReliability;
  durationSeconds: number;
  routeReference: string;
  simplifiedPoints: RouteCoordinatePoint[];
  qualitySummary: {
    highQualityPoints: number;
    mediumQualityPoints: number;
    lowQualityPoints: number;
    anomalyCount: number;
  };
  createdAt: string;
  completedAt?: string;
}

export interface RouteCoordinatePoint {
  latitude: number;
  longitude: number;
  observedAt: string;
  accuracyM: number;
  speedMps?: number;
}

export interface RouteSummary {
  routeId: RouteId;
  routeReference: string;
  petId: PetId;
  trackingSessionId: TrackingSessionId;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  distanceMeters: number;
  distanceReliability: DistanceReliability;
  pointCount: number;
  quality: LocationQuality;
  interruptionPeriodsCount: number;
}

/**
 * DeviceHealth: Diagnostic projection for battery, connectivity, and hardware state.
 */
export interface DeviceHealth {
  deviceId: DeviceId;
  lastSeenAt: string;
  lastLocationAt: string;
  batteryPercent?: number;
  batteryState: BatteryStatus;
  connectivityState: DeviceConnectivityStatus;
  networkType?: string;
  firmwareVersion?: string;
  lastError?: string;
  locationSourceState: 'ACTIVE' | 'DEGRADED' | 'STANDBY' | 'ERROR';
  updatedAt: string;
}

/**
 * TrackerIntegration: Third-party OAuth or API credentials container.
 */
export interface TrackerIntegration {
  integrationId: IntegrationCredentialId;
  householdId: HouseholdId;
  provider: string; // 'TRACTIVE', 'FI', 'WHISTLE'
  status: 'CONNECTED' | 'EXPIRED' | 'REVOKED' | 'OUTAGE_DEGRADED';
  encryptedAccessToken: string;
  tokenExpiresAt?: string;
  refreshTokenRef?: string;
  connectedAt: string;
  lastSyncAt?: string;
  lastError?: string;
}

/**
 * DeadLetterEvent: Failed ingestion envelope for review and idempotent retry.
 */
export interface DeadLetterEvent {
  deadLetterId: DeadLetterEventId;
  provider: string;
  providerEventId: string;
  sourceDeviceReference: string;
  errorClassification: 'SIGNATURE_INVALID' | 'MALFORMED_COORDINATES' | 'UNKNOWN_DEVICE' | 'RATE_LIMITED' | 'CLOCK_SKEW' | 'OTHER';
  errorMessage: string;
  rawPayload: string;
  receivedAt: string;
  reprocessed: boolean;
  reprocessedAt?: string;
}

/**
 * Location Access Authorization Context
 */
export interface LocationAuthorizationQuery {
  actorUserId: UserId;
  petId: PetId;
  action: 'VIEW_LIVE' | 'VIEW_ROUTE_HISTORY' | 'MANAGE_DEVICE' | 'INGEST_TELEMETRY' | 'REQUEST_TRACKING_MODE';
  context?: {
    trackingSessionId?: TrackingSessionId;
    deviceId?: DeviceId;
    walkSessionId?: WalkSessionId;
  };
}

export interface LocationAuthorizationResult {
  granted: boolean;
  role: LocationAccessRole;
  reason: string;
  accessWindowValid: boolean;
}
