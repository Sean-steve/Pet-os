/**
 * Pet OS Sprint 17 - Privacy-Preserving BLE Crowd Recovery Network
 * 
 * Implements:
 * - Volume XIX (Pet Tracking & Device Architecture - BLE Recovery Tag Protocol)
 * - Volume XX (Location, Geofencing & Lost-Pet Recovery Architecture)
 * - Volume XXI (QR, NFC, Microchip & BLE Pet Identity Network)
 * - Volume XXII (Pet Community & Social Platform - Participation Consent)
 * - Volume XXIV (Pet Intelligence & AI Safety - Anti-Stalking & Threat Model)
 * - Volume XXVI (Notifications & Engagement - Silent Observation Handling)
 * - Volume XXVIII (API & Integration Specification - Ingestion & Protected Resolution)
 * - Volume XXIX (Event, Command & Asynchronous Architecture)
 * - Volume XXX (Database Schema & Technical Data Dictionary)
 * - Volume XXXI (Security, Privacy, Trust & Abuse Prevention)
 * - Volume XXXII (Kenyan Privacy, Regulatory & Compliance Architecture)
 * - Volume XLI (ADR-017: Ephemeral Rotating Recovery Identifiers & Anti-Stalking Invariants)
 */

import {
  UserId,
  HouseholdId,
  PetId,
  DeviceId,
  LostPetIncidentId,
  ScannerInstallationId,
  BleRecoveryKeyReferenceId,
  CrowdRecoverySessionId,
  CrowdObservationId,
  CrowdObservationClusterId,
  CrowdRecoveryEvidenceId,
  CrowdRecoveryAbuseFlagId,
  RecoveryConsentId,
} from '../kernel/ids';

// ============================================================================
// TAXONOMY & ENUMS
// ============================================================================

export type ScannerParticipationStatus =
  | 'DISABLED'
  | 'ENABLED'
  | 'PERMISSION_REQUIRED'
  | 'PLATFORM_UNSUPPORTED'
  | 'TEMPORARILY_SUSPENDED';

export type ScannerPlatform = 'ANDROID' | 'IOS' | 'SIMULATED_BLE_SCANNER';

export type BluetoothState =
  | 'POWERED_ON'
  | 'POWERED_OFF'
  | 'UNAUTHORIZED'
  | 'UNSUPPORTED';

export type LocationPermissionState =
  | 'GRANTED'
  | 'DENIED'
  | 'RESTRICTED'
  | 'NOT_DETERMINED';

export type BackgroundScanCapability =
  | 'FULL_BACKGROUND'
  | 'OPPORTUNISTIC'
  | 'RESTRICTED'
  | 'UNSUPPORTED';

export type CrowdObservationResolutionStatus =
  | 'UNRESOLVED'
  | 'RESOLVED_NON_LOST'
  | 'RESOLVED_ACTIVE_INCIDENT'
  | 'INVALID'
  | 'EXPIRED'
  | 'SUSPECT'
  | 'DUPLICATE';

export type CrowdLocationQuality = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export type ProximityClassification =
  | 'VERY_NEAR'   // RSSI >= -65 dBm (~< 3m)
  | 'NEAR'        // -75 <= RSSI < -65 dBm (~3-10m)
  | 'DETECTED'    // -88 <= RSSI < -75 dBm (~10-25m)
  | 'LOW_SIGNAL'  // RSSI < -88 dBm (~> 25m / fringe)
  | 'UNKNOWN';

export type CrowdRecoverySessionStatus =
  | 'REQUESTED'
  | 'ACTIVE'
  | 'DEGRADED'
  | 'COMPLETED'
  | 'CANCELLED';

export type AbuseFlagReason =
  | 'IMPOSSIBLE_GEOGRAPHY'
  | 'REPLAY_ATTACK'
  | 'RATE_LIMIT_EXCEEDED'
  | 'MALFORMED_IDENTIFIER'
  | 'EXCESSIVE_DUPLICATES';

export type AbuseFlagSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export type AbuseFlagStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';

// ============================================================================
// CORE ENTITIES & PROTOCOL METADATA
// ============================================================================

/**
 * BleDeviceCapability: BLE capability profile for eligible Pet OS trackers/tags.
 */
export interface BleDeviceCapability {
  deviceId: DeviceId;
  supportsBleRecovery: boolean;
  supportsRotatingIdentifier: boolean;
  supportsLostModeBroadcast: boolean;
  supportsRemoteModeChange: boolean;
  protocolVersion: string; // e.g. 'V1'
  advertisingIntervalMs: number; // e.g. 1280ms
  txPowerDbm: number; // e.g. -4 dBm
  isRevoked: boolean;
  revokedAt?: string;
  revocationReason?: string;
}

/**
 * BleRecoveryKeyReference: Public metadata reference for a device's cryptographic identity.
 * CRITICAL: The actual cryptographic secret is held in the isolated KMS/Vault, NEVER in this record.
 */
export interface BleRecoveryKeyReference {
  keyReferenceId: BleRecoveryKeyReferenceId;
  deviceId: DeviceId;
  householdId: HouseholdId;
  petId: PetId;
  status: 'ACTIVE' | 'REVOKED' | 'SUPERSEDED';
  protocolVersion: string; // 'V1'
  epochIntervalSeconds: number; // 900 seconds (15 minutes)
  keyId: string; // KMS or Vault handle
  activeFrom: string;
  revokedAt?: string;
  revocationReason?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * ScannerInstallation: Anonymous/pseudonymous client installation on a participant's phone.
 * Kept internal to the backend; NEVER exposed to Pet owners or third parties.
 */
export interface ScannerInstallation {
  scannerInstallationId: ScannerInstallationId;
  userId: UserId; // Internal link only
  platform: ScannerPlatform;
  appVersion: string;
  status: ScannerParticipationStatus;
  consentPolicyVersion: string; // e.g. '2026.1_CROWD_RECOVERY'
  bluetoothState: BluetoothState;
  locationPermission: LocationPermissionState;
  backgroundCapability: BackgroundScanCapability;
  isBatterySaverActive: boolean;
  enabledAt?: string;
  disabledAt?: string;
  lastHeartbeatAt?: string;
  totalObservationsSubmitted: number;
  totalBatchesSubmitted: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * User participation consent record linked to Community domain.
 */
export interface CrowdRecoveryParticipationRecord {
  consentId: RecoveryConsentId;
  userId: UserId;
  status: ScannerParticipationStatus;
  consentPolicyVersion: string;
  enabledAt?: string;
  disabledAt?: string;
  scannerInstallationId?: ScannerInstallationId;
  optInExplanationAcknowledged: boolean;
  updatedAt: string;
}

/**
 * BLE Advertising Packet Layout (Simulated wire format)
 * Explicitly verified to contain ZERO static IDs (no pet_id, user_id, household_id, serial, or microchip).
 */
export interface BleAdvertisementPayload {
  serviceUuid: string; // e.g. '0xFEAA' or Pet OS custom 16-bit UUID '0xFD59'
  protocolVersion: string; // 'V1'
  ephemeralIdentifier: string; // 16-char hex string (8 bytes) derived via HMAC-SHA256
  epochIndex: number;
  txPower: number; // dBm
}

/**
 * CrowdObservation: Raw incoming proximity observation from a participating phone.
 * Location represents the scanner's phone at observation time, NOT exact pet coordinates.
 */
export interface CrowdObservation {
  crowdObservationId: CrowdObservationId;
  ephemeralIdentifier: string; // 16-char hex
  protocolVersion: string;
  observedAt: string; // Scanner detection time (ISO 8601 UTC)
  receivedAt: string; // Backend ingestion time (ISO 8601 UTC)
  scannerInstallationReference: string; // Pseudonymous hash of scanner installation ID
  latitude: number; // Scanner device coordinate
  longitude: number;
  horizontalAccuracyMeters: number;
  rssi: number; // Signal strength in dBm
  txPower?: number;
  proximityClassification: ProximityClassification;
  resolutionStatus: CrowdObservationResolutionStatus;
  resolvedPetId?: PetId;
  resolvedDeviceId?: DeviceId;
  resolvedIncidentId?: LostPetIncidentId;
  resolvedKeyReferenceId?: BleRecoveryKeyReferenceId;
  duplicateKey: string;
  ingestionBatchId: string;
  validationFlags: string[];
  createdAt: string;
}

/**
 * CrowdObservationCluster: Spatio-temporal cluster combining multiple observations.
 * Provides multi-observer corroboration and independent scanner counts.
 */
export interface CrowdObservationCluster {
  clusterId: CrowdObservationClusterId;
  lostPetIncidentId: LostPetIncidentId;
  petId: PetId;
  deviceId: DeviceId;
  startTime: string;
  endTime: string;
  centroidLatitude: number;
  centroidLongitude: number;
  uncertaintyRadiusMeters: number;
  observationCount: number;
  independentScannerCount: number;
  quality: CrowdLocationQuality;
  status: 'ACTIVE' | 'SUPERSEDED';
  createdAt: string;
  updatedAt: string;
}

/**
 * CrowdRecoveryEvidence: Privacy-safe, owner-visible proximity evidence for an active Lost Pet.
 * CRITICAL: Contains generalized coordinates and ZERO observer identity or scanner history.
 */
export interface CrowdRecoveryEvidence {
  evidenceId: CrowdRecoveryEvidenceId;
  lostPetIncidentId: LostPetIncidentId;
  petId: PetId;
  deviceId: DeviceId;
  observedAt: string;
  generalizedLatitude: number; // Truncated/dithered to ~100-200m circle
  generalizedLongitude: number;
  accuracyMeters: number;
  source: 'CROWD_BLE';
  quality: CrowdLocationQuality;
  proximityClassification: ProximityClassification;
  rssi: number;
  clusterId?: CrowdObservationClusterId;
  independentObserversCount: number;
  evidenceLabel: 'RECOVERY NETWORK DETECTION';
  isCorroboratingGps: boolean;
  conflictWarning?: string;
  createdAt: string;
}

/**
 * CrowdRecoverySession: Lifecycle of crowd correlation for a specific Lost Pet Incident.
 */
export interface CrowdRecoverySession {
  crowdRecoverySessionId: CrowdRecoverySessionId;
  lostPetIncidentId: LostPetIncidentId;
  petId: PetId;
  deviceIds: DeviceId[];
  status: CrowdRecoverySessionStatus;
  startedAt: string;
  endedAt?: string;
  totalDetections: number;
  clustersCreated: number;
  lastDetectionAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * CrowdRecoveryAbuseFlag: Internal Trust & Safety audit record for suspicious telemetry.
 */
export interface CrowdRecoveryAbuseFlag {
  flagId: CrowdRecoveryAbuseFlagId;
  scannerInstallationId: ScannerInstallationId;
  reason: AbuseFlagReason;
  details: string;
  severity: AbuseFlagSeverity;
  status: AbuseFlagStatus;
  flaggedAt: string;
  reviewedBy?: UserId;
  reviewedAt?: string;
  reviewNotes?: string;
}

// ============================================================================
// DTOs & CONTRACTS
// ============================================================================

export interface ObservationBatchItemDto {
  ephemeralIdentifier: string;
  protocolVersion: string;
  observedAt: string;
  latitude: number;
  longitude: number;
  horizontalAccuracyMeters: number;
  rssi: number;
  txPower?: number;
}

export interface IngestCrowdObservationsRequestDto {
  scannerInstallationId: ScannerInstallationId;
  authSignature?: string;
  observations: ObservationBatchItemDto[];
}

export interface IngestCrowdObservationsResponseDto {
  acceptedCount: number;
  deduplicatedCount: number;
  rejectedCount: number;
  batchId: string;
  processedAt: string;
}

export interface OwnerCrowdRecoveryStatusDto {
  networkStatus: 'ACTIVE' | 'UNAVAILABLE' | 'NO_COMPATIBLE_DEVICE';
  compatibleDevicesCount: number;
  lastDetectionMinutesAgo?: number;
  detectionQuality?: CrowdLocationQuality;
  totalIndependentDetections: number;
  activeEvidenceList: CrowdRecoveryEvidence[];
  privacyNotice: string;
}
