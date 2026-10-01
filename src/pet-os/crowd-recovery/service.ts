/**
 * Pet OS Sprint 17 - Crowd Recovery Bounded Context Service
 * 
 * Implements:
 * - Volume XIX (BLE Recovery Protocol Service Layer)
 * - Volume XX (Location & Lost-Pet Recovery Integration)
 * - Volume XXI (Pet Identity Network & Anonymous Proximity Detection)
 * - Volume XXII (Community Recovery Participation Consent)
 * - Volume XXIV (Anti-Stalking Protections & Threat Mitigations)
 * - Volume XXVIII (API & Integration Specification)
 * - Volume XXIX (Event, Command & Asynchronous Architecture)
 * - Volume XXXI (Security, Privacy, Trust & Abuse Prevention)
 * - ADR-017 (Ephemeral Rotating Recovery Identifiers & Anti-Stalking Invariants)
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
  asScannerInstallationId,
  asBleRecoveryKeyReferenceId,
  asCrowdRecoverySessionId,
  asCrowdObservationId,
  asCrowdObservationClusterId,
  asCrowdRecoveryEvidenceId,
  asCrowdRecoveryAbuseFlagId,
  asRecoveryConsentId,
  generateUUIDv7,
} from '../kernel/ids';
import { createEventEnvelope, EventEnvelope } from '../kernel/events';
import {
  ScannerParticipationStatus,
  ScannerPlatform,
  BluetoothState,
  LocationPermissionState,
  BackgroundScanCapability,
  CrowdLocationQuality,
  BleDeviceCapability,
  BleRecoveryKeyReference,
  ScannerInstallation,
  CrowdRecoveryParticipationRecord,
  CrowdObservation,
  CrowdObservationCluster,
  CrowdRecoveryEvidence,
  CrowdRecoverySession,
  CrowdRecoveryAbuseFlag,
  IngestCrowdObservationsRequestDto,
  IngestCrowdObservationsResponseDto,
  OwnerCrowdRecoveryStatusDto,
  BleAdvertisementPayload,
} from './types';
import { CrowdRecoveryStore } from './store';
import {
  bleKeyVault,
  deriveRotatingIdentifier,
  calculateEpochIndex,
  resolveIdentifierInternally,
  hashScannerInstallationId,
  generateObservationDuplicateKey,
  classifyProximityRssi,
  generalizeCoordinate,
  generateDeviceAdvertisement,
  CANONICAL_PROTOCOL_VERSION,
  CANONICAL_EPOCH_SECONDS,
} from './crypto';
import { RecoveryStore } from '../recovery/store';
import { RecoveryService } from '../recovery/service';
import { TrackingStore } from '../tracking/store';

// Haversine distance helper
function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export class CrowdRecoveryService {
  private static instance: CrowdRecoveryService;
  private store: CrowdRecoveryStore;
  private eventListeners: Array<(event: EventEnvelope) => void> = [];

  private constructor() {
    this.store = CrowdRecoveryStore.getInstance();

    // Bind event listener to RecoveryService for automatic lifecycle coupling
    try {
      const recoveryService = RecoveryService.getInstance();
      recoveryService.addEventListener((event: EventEnvelope) => {
        this.handleExternalRecoveryEvent(event);
      });
    } catch (err) {
      console.warn('Could not attach to RecoveryService listener:', err);
    }
  }

  private handleExternalRecoveryEvent(event: EventEnvelope): void {
    if (event.eventType === 'LostPetIncidentReported' || event.eventType === 'LostPetIncidentDeclared') {
      const payload = event.payload as any;
      if (payload?.incidentId && payload?.petId) {
        this.startRecoverySessionForIncident(payload.incidentId, payload.petId);
      }
    } else if (event.eventType === 'LostPetRecovered' || event.eventType === 'LostPetIncidentCancelled') {
      const payload = event.payload as any;
      if (payload?.incidentId) {
        this.completeRecoverySessionForIncident(payload.incidentId);
      }
    }
  }

  public static getInstance(): CrowdRecoveryService {
    if (!CrowdRecoveryService.instance) {
      CrowdRecoveryService.instance = new CrowdRecoveryService();
    }
    return CrowdRecoveryService.instance;
  }

  public addEventListener(listener: (event: EventEnvelope) => void): void {
    this.eventListeners.push(listener);
  }

  private emitEvent(event: EventEnvelope): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in crowd recovery event listener:', err);
      }
    }
  }

  // ============================================================================
  // 1. PARTICIPATION & CONSENT MANAGEMENT (Community Boundary)
  // ============================================================================

  public getParticipation(userId: UserId): CrowdRecoveryParticipationRecord | undefined {
    return this.store.participations.get(userId);
  }

  public getScannerInstallation(installationId: ScannerInstallationId): ScannerInstallation | undefined {
    return this.store.scannerInstallations.get(installationId);
  }

  public enableParticipation(params: {
    userId: UserId;
    platform: ScannerPlatform;
    appVersion?: string;
    consentPolicyVersion?: string;
  }): { participation: CrowdRecoveryParticipationRecord; installation: ScannerInstallation } {
    const consentPolicyVersion = params.consentPolicyVersion ?? '2026.1_CROWD_RECOVERY';
    let installation = Array.from(this.store.scannerInstallations.values()).find(
      s => s.userId === params.userId
    );

    if (!installation) {
      const installationId = asScannerInstallationId(generateUUIDv7());
      installation = {
        scannerInstallationId: installationId,
        userId: params.userId,
        platform: params.platform,
        appVersion: params.appVersion ?? '2026.9.1',
        status: 'ENABLED',
        consentPolicyVersion,
        bluetoothState: 'POWERED_ON',
        locationPermission: 'GRANTED',
        backgroundCapability: params.platform === 'ANDROID' ? 'FULL_BACKGROUND' : 'OPPORTUNISTIC',
        isBatterySaverActive: false,
        enabledAt: new Date().toISOString(),
        lastHeartbeatAt: new Date().toISOString(),
        totalObservationsSubmitted: 0,
        totalBatchesSubmitted: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.store.scannerInstallations.set(installationId, installation);
    } else {
      installation.status = 'ENABLED';
      installation.enabledAt = new Date().toISOString();
      installation.disabledAt = undefined;
      installation.updatedAt = new Date().toISOString();
    }

    let participation = this.store.participations.get(params.userId);
    if (!participation) {
      participation = {
        consentId: asRecoveryConsentId(generateUUIDv7()),
        userId: params.userId,
        status: 'ENABLED',
        consentPolicyVersion,
        enabledAt: new Date().toISOString(),
        scannerInstallationId: installation.scannerInstallationId,
        optInExplanationAcknowledged: true,
        updatedAt: new Date().toISOString(),
      };
    } else {
      participation.status = 'ENABLED';
      participation.enabledAt = new Date().toISOString();
      participation.disabledAt = undefined;
      participation.scannerInstallationId = installation.scannerInstallationId;
      participation.updatedAt = new Date().toISOString();
    }
    this.store.participations.set(params.userId, participation);

    this.emitEvent(
      createEventEnvelope(
        'CrowdRecoveryParticipationEnabled',
        'ScannerInstallation',
        installation.scannerInstallationId,
        {
          userId: params.userId,
          scannerInstallationId: installation.scannerInstallationId,
          policyVersion: consentPolicyVersion,
          platform: params.platform,
        },
        1,
        undefined,
        params.userId
      )
    );

    return { participation, installation };
  }

  public disableParticipation(userId: UserId): CrowdRecoveryParticipationRecord {
    const participation = this.store.participations.get(userId);
    if (!participation) {
      throw new Error(`Participation record not found for user: ${userId}`);
    }

    participation.status = 'DISABLED';
    participation.disabledAt = new Date().toISOString();
    participation.updatedAt = new Date().toISOString();

    if (participation.scannerInstallationId) {
      const installation = this.store.scannerInstallations.get(participation.scannerInstallationId);
      if (installation) {
        installation.status = 'DISABLED';
        installation.disabledAt = new Date().toISOString();
        installation.updatedAt = new Date().toISOString();
      }
    }

    this.emitEvent(
      createEventEnvelope(
        'CrowdRecoveryParticipationDisabled',
        'ScannerInstallation',
        participation.scannerInstallationId || userId,
        {
          userId,
          disabledAt: participation.disabledAt,
        },
        1,
        undefined,
        userId
      )
    );

    return participation;
  }

  public updateScannerState(params: {
    scannerInstallationId: ScannerInstallationId;
    bluetoothState?: BluetoothState;
    locationPermission?: LocationPermissionState;
    isBatterySaverActive?: boolean;
  }): ScannerInstallation {
    const installation = this.store.scannerInstallations.get(params.scannerInstallationId);
    if (!installation) {
      throw new Error(`Scanner installation not found: ${params.scannerInstallationId}`);
    }

    if (params.bluetoothState !== undefined) {
      installation.bluetoothState = params.bluetoothState;
    }
    if (params.locationPermission !== undefined) {
      installation.locationPermission = params.locationPermission;
    }
    if (params.isBatterySaverActive !== undefined) {
      installation.isBatterySaverActive = params.isBatterySaverActive;
    }

    // Evaluate participation operational status based on platform constraints
    if (installation.bluetoothState !== 'POWERED_ON' || installation.locationPermission !== 'GRANTED') {
      installation.status = 'PERMISSION_REQUIRED';
    } else if (installation.status === 'PERMISSION_REQUIRED') {
      installation.status = 'ENABLED';
    }

    installation.lastHeartbeatAt = new Date().toISOString();
    installation.updatedAt = new Date().toISOString();
    return installation;
  }

  // ============================================================================
  // 2. DEVICE CAPABILITY & CRYPTOGRAPHIC KEY LIFECYCLE
  // ============================================================================

  public registerDeviceCapability(capability: BleDeviceCapability): void {
    this.store.deviceCapabilities.set(capability.deviceId, capability);
  }

  public getDeviceCapability(deviceId: DeviceId): BleDeviceCapability | undefined {
    return this.store.deviceCapabilities.get(deviceId);
  }

  public provisionDeviceKey(deviceId: DeviceId, petId: PetId, householdId: HouseholdId): BleRecoveryKeyReference {
    const capability = this.store.deviceCapabilities.get(deviceId);
    if (capability && capability.isRevoked) {
      throw new Error(`Cannot provision key for revoked device: ${deviceId}`);
    }

    const { keyReference } = bleKeyVault.provisionDeviceSecret(deviceId, petId, householdId);
    this.store.keyReferences.set(keyReference.keyReferenceId, keyReference);

    if (!capability) {
      this.store.deviceCapabilities.set(deviceId, {
        deviceId,
        supportsBleRecovery: true,
        supportsRotatingIdentifier: true,
        supportsLostModeBroadcast: true,
        supportsRemoteModeChange: true,
        protocolVersion: CANONICAL_PROTOCOL_VERSION,
        advertisingIntervalMs: 1280,
        txPowerDbm: -4,
        isRevoked: false,
      });
    }

    return keyReference;
  }

  public rotateDeviceKey(deviceId: DeviceId, reason: string): BleRecoveryKeyReference {
    // Find active key
    const existing = Array.from(this.store.keyReferences.values()).find(
      k => k.deviceId === deviceId && k.status === 'ACTIVE'
    );
    if (!existing) {
      throw new Error(`No active key found to rotate for device: ${deviceId}`);
    }

    existing.status = 'SUPERSEDED';
    existing.updatedAt = new Date().toISOString();

    const { keyReference } = bleKeyVault.provisionDeviceSecret(deviceId, existing.petId, existing.householdId);
    this.store.keyReferences.set(keyReference.keyReferenceId, keyReference);

    this.emitEvent(
      createEventEnvelope(
        'BleRecoveryKeyRotated',
        'BleRecoveryKeyReference',
        keyReference.keyReferenceId,
        {
          deviceId,
          oldKeyReferenceId: existing.keyReferenceId,
          newKeyReferenceId: keyReference.keyReferenceId,
          reason,
        },
        1,
        undefined,
        undefined,
        existing.householdId
      )
    );

    return keyReference;
  }

  public revokeDeviceKey(deviceId: DeviceId, reason: string): boolean {
    const capability = this.store.deviceCapabilities.get(deviceId);
    if (capability) {
      capability.isRevoked = true;
      capability.revokedAt = new Date().toISOString();
      capability.revocationReason = reason;
    }

    const activeKeys = Array.from(this.store.keyReferences.values()).filter(
      k => k.deviceId === deviceId && k.status === 'ACTIVE'
    );
    for (const k of activeKeys) {
      k.status = 'REVOKED';
      k.revokedAt = new Date().toISOString();
      k.revocationReason = reason;
      k.updatedAt = new Date().toISOString();
      bleKeyVault.revokeSecret(k.keyId, reason);
    }

    this.emitEvent(
      createEventEnvelope(
        'BleRecoveryIdentityRevoked',
        'BleDeviceCapability',
        deviceId,
        {
          deviceId,
          reason,
          revokedAt: new Date().toISOString(),
        },
        1
      )
    );

    return true;
  }

  public reassignDeviceForHouseholdTransfer(
    deviceId: DeviceId,
    newPetId: PetId,
    newHouseholdId: HouseholdId
  ): BleRecoveryKeyReference {
    // Revoke previous keys so previous household cannot sniff or correlate future BLE broadcasts
    this.revokeDeviceKey(deviceId, 'Household transfer / Device reassignment safety reprovisioning');

    // Reset revocation state on capability
    const capability = this.store.deviceCapabilities.get(deviceId);
    if (capability) {
      capability.isRevoked = false;
      capability.revokedAt = undefined;
      capability.revocationReason = undefined;
    }

    // Provision brand new cryptographic identity
    return this.provisionDeviceKey(deviceId, newPetId, newHouseholdId);
  }

  // ============================================================================
  // 3. BLE ADVERTISEMENT SIMULATION (No Static Identifiers)
  // ============================================================================

  public generateBleAdvertisement(deviceId: DeviceId, timestampMs: number = Date.now()): BleAdvertisementPayload {
    const capability = this.store.deviceCapabilities.get(deviceId);
    if (capability?.isRevoked) {
      throw new Error(`Device is revoked: ${deviceId}`);
    }

    const { payload } = generateDeviceAdvertisement(deviceId, timestampMs);
    return payload;
  }

  // ============================================================================
  // 4. SECURE INGESTION PIPELINE & ANONYMOUS RESOLUTION
  // ============================================================================

  public async ingestObservationBatch(
    request: IngestCrowdObservationsRequestDto,
    callerRole: string = 'SCANNER_APP'
  ): Promise<IngestCrowdObservationsResponseDto> {
    const scanner = this.store.scannerInstallations.get(request.scannerInstallationId);
    if (!scanner) {
      throw new Error(`Scanner installation not authorized: ${request.scannerInstallationId}`);
    }

    if (scanner.status !== 'ENABLED') {
      throw new Error(`Scanner participation is currently not enabled: status ${scanner.status}`);
    }

    // Backend Rate Limiting: Max 100 observations per batch, max 60 requests per minute
    if (request.observations.length > 100) {
      throw new Error(`Batch size exceeds maximum limit of 100 items`);
    }

    const now = Date.now();
    const rateKey = scanner.scannerInstallationId;
    const rateRecord = this.store.scannerRateLimits.get(rateKey) ?? { count: 0, windowStart: now };
    if (now - rateRecord.windowStart > 60000) {
      rateRecord.count = 0;
      rateRecord.windowStart = now;
    }
    rateRecord.count += request.observations.length;
    this.store.scannerRateLimits.set(rateKey, rateRecord);

    if (rateRecord.count > 120) {
      this.flagAbuse({
        scannerInstallationId: scanner.scannerInstallationId,
        reason: 'RATE_LIMIT_EXCEEDED',
        details: `Scanner exceeded 120 observations/minute: submitted ${rateRecord.count}`,
        severity: 'MEDIUM',
      });
      throw new Error('Rate limit exceeded for crowd observation uploads');
    }

    const batchId = `ing_batch_${generateUUIDv7().replace(/-/g, '').substring(0, 12)}`;
    const scannerHash = hashScannerInstallationId(scanner.scannerInstallationId);
    let acceptedCount = 0;
    let deduplicatedCount = 0;
    let rejectedCount = 0;

    const recoveryStore = RecoveryStore.getInstance();
    const trackingStore = TrackingStore.getInstance();

    for (const obsDto of request.observations) {
      // 1. Basic Coordinate & RSSI Sanity Validation
      if (
        obsDto.latitude < -90 || obsDto.latitude > 90 ||
        obsDto.longitude < -180 || obsDto.longitude > 180 ||
        obsDto.horizontalAccuracyMeters <= 0 ||
        obsDto.rssi > 0 || obsDto.rssi < -130
      ) {
        rejectedCount++;
        continue;
      }

      const observedAtMs = new Date(obsDto.observedAt).getTime();
      if (isNaN(observedAtMs) || observedAtMs > now + 60000) {
        // Disallow observations timestamped far in the future
        rejectedCount++;
        continue;
      }

      // 2. Local/Server Deduplication
      const duplicateKey = generateObservationDuplicateKey(scannerHash, obsDto.ephemeralIdentifier, observedAtMs);
      if (this.store.idempotencyKeys.has(duplicateKey)) {
        deduplicatedCount++;
        continue;
      }
      this.store.idempotencyKeys.add(duplicateKey);

      // 3. Protected Backend Identifier Resolution (Zero exposure to scanner)
      const resolution = resolveIdentifierInternally(obsDto.ephemeralIdentifier, observedAtMs);

      const observationId = asCrowdObservationId(generateUUIDv7());
      const proximityClass = classifyProximityRssi(obsDto.rssi);

      if (!resolution) {
        // Unresolved / Rogue / Unknown tag
        const unresObs: CrowdObservation = {
          crowdObservationId: observationId,
          ephemeralIdentifier: obsDto.ephemeralIdentifier,
          protocolVersion: obsDto.protocolVersion || CANONICAL_PROTOCOL_VERSION,
          observedAt: obsDto.observedAt,
          receivedAt: new Date().toISOString(),
          scannerInstallationReference: scannerHash,
          latitude: obsDto.latitude,
          longitude: obsDto.longitude,
          horizontalAccuracyMeters: obsDto.horizontalAccuracyMeters,
          rssi: obsDto.rssi,
          txPower: obsDto.txPower,
          proximityClassification: proximityClass,
          resolutionStatus: 'UNRESOLVED',
          duplicateKey,
          ingestionBatchId: batchId,
          validationFlags: ['UNKNOWN_OR_EXPIRED_IDENTIFIER'],
          createdAt: new Date().toISOString(),
        };
        this.store.crowdObservations.set(observationId, unresObs);
        acceptedCount++;
        continue;
      }

      const deviceId = resolution.matchedRecord.deviceId;
      const petId = resolution.matchedRecord.petId;
      const capability = this.store.deviceCapabilities.get(deviceId);

      if (capability?.isRevoked) {
        const revokedObs: CrowdObservation = {
          crowdObservationId: observationId,
          ephemeralIdentifier: obsDto.ephemeralIdentifier,
          protocolVersion: obsDto.protocolVersion || CANONICAL_PROTOCOL_VERSION,
          observedAt: obsDto.observedAt,
          receivedAt: new Date().toISOString(),
          scannerInstallationReference: scannerHash,
          latitude: obsDto.latitude,
          longitude: obsDto.longitude,
          horizontalAccuracyMeters: obsDto.horizontalAccuracyMeters,
          rssi: obsDto.rssi,
          proximityClassification: proximityClass,
          resolutionStatus: 'INVALID',
          resolvedDeviceId: deviceId,
          resolvedPetId: petId,
          duplicateKey,
          ingestionBatchId: batchId,
          validationFlags: ['DEVICE_REVOKED'],
          createdAt: new Date().toISOString(),
        };
        this.store.crowdObservations.set(observationId, revokedObs);
        acceptedCount++;
        continue;
      }

      // 4. Anti-Stalking & Impossible Geography Verification
      // Check recent observations of the same device in the last 10 minutes
      const recentSameDeviceObs = Array.from(this.store.crowdObservations.values()).filter(
        o => o.resolvedDeviceId === deviceId &&
             now - new Date(o.observedAt).getTime() < 10 * 60 * 1000 &&
             o.resolutionStatus !== 'INVALID'
      );

      let isImpossibleGeography = false;
      for (const prev of recentSameDeviceObs) {
        const distMeters = haversineDistanceMeters(prev.latitude, prev.longitude, obsDto.latitude, obsDto.longitude);
        const timeDiffSeconds = Math.max(1, Math.abs(observedAtMs - new Date(prev.observedAt).getTime()) / 1000);
        const speedKmh = (distMeters / timeDiffSeconds) * 3.6;

        // If detected > 250 km/h (impossible terrestrial pet speed)
        if (speedKmh > 250 && distMeters > 3000) {
          isImpossibleGeography = true;
          this.flagAbuse({
            scannerInstallationId: scanner.scannerInstallationId,
            reason: 'IMPOSSIBLE_GEOGRAPHY',
            details: `Device ${deviceId} observed at impossible speed ${Math.round(speedKmh)} km/h across ${Math.round(distMeters)}m in ${Math.round(timeDiffSeconds)}s`,
            severity: 'HIGH',
          });
          break;
        }
      }

      // 5. Active Lost Pet Incident Gate
      // Find if there is an active LostPetIncident for this resolved pet
      const activeIncidents = Array.from(recoveryStore.lostPetIncidents.values()).filter(
        inc => inc.petId === petId && (inc.status === 'ACTIVE' || inc.status === 'SEARCH_IN_PROGRESS')
      );

      const activeIncident = activeIncidents.length > 0 ? activeIncidents[0] : undefined;

      // =========================================================================
      // MANDATORY PRIVACY INVARIANT: NON-LOST OBSERVATION HANDLING
      // If the pet is NOT in Lost Pet Mode:
      // Store record as RESOLVED_NON_LOST.
      // NEVER create owner-visible crowd tracking history!
      // Scanner receives NO pet name or identity.
      // =========================================================================
      if (!activeIncident) {
        const nonLostObs: CrowdObservation = {
          crowdObservationId: observationId,
          ephemeralIdentifier: obsDto.ephemeralIdentifier,
          protocolVersion: obsDto.protocolVersion || CANONICAL_PROTOCOL_VERSION,
          observedAt: obsDto.observedAt,
          receivedAt: new Date().toISOString(),
          scannerInstallationReference: scannerHash,
          latitude: obsDto.latitude,
          longitude: obsDto.longitude,
          horizontalAccuracyMeters: obsDto.horizontalAccuracyMeters,
          rssi: obsDto.rssi,
          proximityClassification: proximityClass,
          resolutionStatus: 'RESOLVED_NON_LOST',
          resolvedPetId: petId,
          resolvedDeviceId: deviceId,
          duplicateKey,
          ingestionBatchId: batchId,
          validationFlags: isImpossibleGeography ? ['IMPOSSIBLE_GEOGRAPHY_SUSPECT'] : [],
          createdAt: new Date().toISOString(),
        };
        this.store.crowdObservations.set(observationId, nonLostObs);
        acceptedCount++;
        continue;
      }

      // 6. Active Lost Pet Incident Correlation: Evidence & Clustering
      const resolutionStatus = isImpossibleGeography ? 'SUSPECT' : 'RESOLVED_ACTIVE_INCIDENT';

      const validObs: CrowdObservation = {
        crowdObservationId: observationId,
        ephemeralIdentifier: obsDto.ephemeralIdentifier,
        protocolVersion: obsDto.protocolVersion || CANONICAL_PROTOCOL_VERSION,
        observedAt: obsDto.observedAt,
        receivedAt: new Date().toISOString(),
        scannerInstallationReference: scannerHash,
        latitude: obsDto.latitude,
        longitude: obsDto.longitude,
        horizontalAccuracyMeters: obsDto.horizontalAccuracyMeters,
        rssi: obsDto.rssi,
        proximityClassification: proximityClass,
        resolutionStatus,
        resolvedPetId: petId,
        resolvedDeviceId: deviceId,
        resolvedIncidentId: activeIncident.lostPetIncidentId,
        duplicateKey,
        ingestionBatchId: batchId,
        validationFlags: isImpossibleGeography ? ['IMPOSSIBLE_GEOGRAPHY_SUSPECT'] : [],
        createdAt: new Date().toISOString(),
      };
      this.store.crowdObservations.set(observationId, validObs);
      acceptedCount++;

      if (isImpossibleGeography) {
        // Do not move recovery map or cluster suspect telemetry
        continue;
      }

      // Calculate Evidence Quality
      let quality: CrowdLocationQuality = 'LOW';
      if (obsDto.horizontalAccuracyMeters <= 25 && obsDto.rssi >= -70 && !resolution.isClockSkewed) {
        quality = 'HIGH';
      } else if (obsDto.horizontalAccuracyMeters <= 60 && obsDto.rssi >= -85) {
        quality = 'MEDIUM';
      }

      // Check GPS Agreement vs Conflict with Tracking Domain
      let isCorroboratingGps = false;
      let conflictWarning: string | undefined = undefined;

      const petLastObs = trackingStore.getLatestObservationForDevice(deviceId);

      if (petLastObs && petLastObs.latitude && petLastObs.longitude) {
        const gpsAgeMinutes = (now - new Date(petLastObs.observedAt).getTime()) / 60000;
        const distFromGps = haversineDistanceMeters(
          petLastObs.latitude,
          petLastObs.longitude,
          obsDto.latitude,
          obsDto.longitude
        );

        if (gpsAgeMinutes < 15 && distFromGps < 400) {
          isCorroboratingGps = true;
        } else if (gpsAgeMinutes < 15 && distFromGps > 2500) {
          conflictWarning = `Source Discrepancy: Crowd BLE detected ~${Math.round(distFromGps)}m away from fresh GPS fix. High-quality GPS remains authoritative.`;
        }
      }

      // Cluster Management: Merge with recent nearby cluster (< 400m, last 45m)
      const existingCluster = Array.from(this.store.clusters.values()).find(
        c => c.lostPetIncidentId === activeIncident.lostPetIncidentId &&
             c.status === 'ACTIVE' &&
             now - new Date(c.endTime).getTime() < 45 * 60 * 1000 &&
             haversineDistanceMeters(c.centroidLatitude, c.centroidLongitude, obsDto.latitude, obsDto.longitude) < 400
      );

      let clusterId: CrowdObservationClusterId;
      let independentScannersCount = 1;

      if (existingCluster) {
        clusterId = existingCluster.clusterId;
        existingCluster.endTime = obsDto.observedAt;
        existingCluster.observationCount += 1;
        // Calculate new moving average centroid
        existingCluster.centroidLatitude = (existingCluster.centroidLatitude + obsDto.latitude) / 2;
        existingCluster.centroidLongitude = (existingCluster.centroidLongitude + obsDto.longitude) / 2;

        // Check independent observers in this cluster
        const clusterObservations = Array.from(this.store.crowdObservations.values()).filter(
          o => o.resolvedIncidentId === activeIncident.lostPetIncidentId &&
               o.resolutionStatus === 'RESOLVED_ACTIVE_INCIDENT' &&
               haversineDistanceMeters(existingCluster.centroidLatitude, existingCluster.centroidLongitude, o.latitude, o.longitude) < 400
        );
        const uniqueScanners = new Set(clusterObservations.map(o => o.scannerInstallationReference));
        uniqueScanners.add(scannerHash);
        existingCluster.independentScannerCount = uniqueScanners.size;
        independentScannersCount = existingCluster.independentScannerCount;

        if (independentScannersCount >= 2 && quality === 'MEDIUM') {
          quality = 'HIGH'; // Multi-scanner corroboration boosts quality
        }
        existingCluster.quality = quality;
        existingCluster.updatedAt = new Date().toISOString();
      } else {
        clusterId = asCrowdObservationClusterId(generateUUIDv7());
        const newCluster: CrowdObservationCluster = {
          clusterId,
          lostPetIncidentId: activeIncident.lostPetIncidentId,
          petId,
          deviceId,
          startTime: obsDto.observedAt,
          endTime: obsDto.observedAt,
          centroidLatitude: obsDto.latitude,
          centroidLongitude: obsDto.longitude,
          uncertaintyRadiusMeters: Math.max(obsDto.horizontalAccuracyMeters, 80),
          observationCount: 1,
          independentScannerCount: 1,
          quality,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.store.clusters.set(clusterId, newCluster);
      }

      // Create Derived CrowdRecoveryEvidence for Owner
      // Generalized Coordinates: Never reveal precise observer house or location
      const generalizedLatitude = generalizeCoordinate(obsDto.latitude);
      const generalizedLongitude = generalizeCoordinate(obsDto.longitude);
      const evidenceId = asCrowdRecoveryEvidenceId(generateUUIDv7());

      const evidence: CrowdRecoveryEvidence = {
        evidenceId,
        lostPetIncidentId: activeIncident.lostPetIncidentId,
        petId,
        deviceId,
        observedAt: obsDto.observedAt,
        generalizedLatitude,
        generalizedLongitude,
        accuracyMeters: Math.max(obsDto.horizontalAccuracyMeters, 120), // Minimum 120m privacy buffer
        source: 'CROWD_BLE',
        quality,
        proximityClassification: proximityClass,
        rssi: obsDto.rssi,
        clusterId,
        independentObserversCount: independentScannersCount,
        evidenceLabel: 'RECOVERY NETWORK DETECTION',
        isCorroboratingGps,
        conflictWarning,
        createdAt: new Date().toISOString(),
      };
      this.store.recoveryEvidences.set(evidenceId, evidence);

      // Update CrowdRecoverySession
      const session = Array.from(this.store.crowdSessions.values()).find(
        s => s.lostPetIncidentId === activeIncident.lostPetIncidentId && s.status === 'ACTIVE'
      );
      if (session) {
        session.totalDetections += 1;
        session.lastDetectionAt = obsDto.observedAt;
        session.updatedAt = new Date().toISOString();
      }

      // Emit Canonical Domain Events
      this.emitEvent(
        createEventEnvelope(
          'CrowdRecoveryEvidenceCreated',
          'CrowdRecoveryEvidence',
          evidenceId,
          {
            lostPetIncidentId: activeIncident.lostPetIncidentId,
            petId,
            deviceId,
            observedAt: obsDto.observedAt,
            quality,
            independentObserversCount: independentScannersCount,
            source: 'CROWD_BLE',
          },
          1,
          undefined,
          undefined,
          activeIncident.householdId
        )
      );

      // Emit Integration Event to Tracking Domain (Source Type = CROWD_BLE)
      this.emitEvent(
        createEventEnvelope(
          'CrowdLocationObservationAvailable',
          'CrowdObservation',
          observationId,
          {
            deviceId,
            petId,
            sourceType: 'CROWD_BLE',
            latitude: generalizedLatitude,
            longitude: generalizedLongitude,
            accuracyMeters: evidence.accuracyMeters,
            observedAt: obsDto.observedAt,
            quality,
            evidenceLabel: 'RECOVERY NETWORK DETECTION',
          },
          1
        )
      );
    }

    scanner.totalObservationsSubmitted += acceptedCount;
    scanner.totalBatchesSubmitted += 1;
    scanner.lastHeartbeatAt = new Date().toISOString();
    scanner.updatedAt = new Date().toISOString();

    return {
      acceptedCount,
      deduplicatedCount,
      rejectedCount,
      batchId,
      processedAt: new Date().toISOString(),
    };
  }

  // ============================================================================
  // 5. PROTECTED BACKEND RESOLUTION API (Strict Authorization)
  // ============================================================================

  /**
   * Internal-only API: Ordinary users or public endpoints are forbidden from calling this.
   */
  public internalResolveEphemeralIdentifier(
    ephemeralIdentifier: string,
    observedAtMs: number,
    callerRole: string
  ): { deviceId: DeviceId; petId: PetId; householdId: HouseholdId; epoch: number } {
    if (callerRole !== 'INTERNAL_RECOVERY_SERVICE' && callerRole !== 'SYSTEM_INTERNAL') {
      throw new Error('Access Denied: Ephemeral BLE resolution is restricted to internal recovery pipelines');
    }

    const resolution = resolveIdentifierInternally(ephemeralIdentifier, observedAtMs);
    if (!resolution) {
      throw new Error('Identifier not found or expired');
    }

    return {
      deviceId: resolution.matchedRecord.deviceId,
      petId: resolution.matchedRecord.petId,
      householdId: resolution.matchedRecord.householdId,
      epoch: resolution.matchedEpoch,
    };
  }

  // ============================================================================
  // 6. OWNER LOST PET CROWD RECOVERY STATUS & RECOVERY MAP API
  // ============================================================================

  /**
   * Returns anonymized, generalized recovery network evidence for an owner's incident.
   * GUARANTEE: Zero scanner usernames, phone numbers, or installation IDs are returned.
   */
  public getLostPetCrowdRecoveryStatus(
    incidentId: LostPetIncidentId,
    requestingUserId: UserId
  ): OwnerCrowdRecoveryStatusDto {
    const recoveryStore = RecoveryStore.getInstance();
    const incident = recoveryStore.lostPetIncidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    // Check compatible devices for pet
    const compatibleCapabilities = Array.from(this.store.deviceCapabilities.values()).filter(
      c => c.supportsBleRecovery && !c.isRevoked
    );

    const activeEvidences = Array.from(this.store.recoveryEvidences.values())
      .filter(e => e.lostPetIncidentId === incidentId)
      .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());

    let networkStatus: 'ACTIVE' | 'UNAVAILABLE' | 'NO_COMPATIBLE_DEVICE' = 'ACTIVE';
    if (compatibleCapabilities.length === 0) {
      networkStatus = 'NO_COMPATIBLE_DEVICE';
    } else if (incident.status === 'RECOVERED' || incident.status === 'CANCELLED') {
      networkStatus = 'UNAVAILABLE';
    }

    let lastDetectionMinutesAgo: number | undefined = undefined;
    let detectionQuality: CrowdLocationQuality | undefined = undefined;

    if (activeEvidences.length > 0) {
      const mostRecent = activeEvidences[0];
      lastDetectionMinutesAgo = Math.max(
        0,
        Math.round((Date.now() - new Date(mostRecent.observedAt).getTime()) / 60000)
      );
      detectionQuality = mostRecent.quality;
    }

    // Count distinct clusters / independent observers
    const totalIndependent = activeEvidences.reduce(
      (acc, ev) => Math.max(acc, ev.independentObserversCount),
      activeEvidences.length > 0 ? 1 : 0
    );

    return {
      networkStatus,
      compatibleDevicesCount: compatibleCapabilities.length,
      lastDetectionMinutesAgo,
      detectionQuality,
      totalIndependentDetections: totalIndependent,
      activeEvidenceList: activeEvidences,
      privacyNotice:
        'Nearby participating devices anonymously detect BLE recovery tags. Observer identities and exact scanner locations are never shared.',
    };
  }

  // ============================================================================
  // 7. CROWD RECOVERY SESSION LIFECYCLE
  // ============================================================================

  public startRecoverySessionForIncident(
    incidentId: LostPetIncidentId,
    petId: PetId
  ): CrowdRecoverySession {
    const existing = Array.from(this.store.crowdSessions.values()).find(
      s => s.lostPetIncidentId === incidentId && s.status === 'ACTIVE'
    );
    if (existing) return existing;

    const compatibleDevices = Array.from(this.store.deviceCapabilities.values())
      .filter(c => c.supportsBleRecovery && !c.isRevoked)
      .map(c => c.deviceId);

    const sessionId = asCrowdRecoverySessionId(generateUUIDv7());
    const session: CrowdRecoverySession = {
      crowdRecoverySessionId: sessionId,
      lostPetIncidentId: incidentId,
      petId,
      deviceIds: compatibleDevices,
      status: compatibleDevices.length > 0 ? 'ACTIVE' : 'DEGRADED',
      startedAt: new Date().toISOString(),
      totalDetections: 0,
      clustersCreated: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.crowdSessions.set(sessionId, session);

    this.emitEvent(
      createEventEnvelope(
        'CrowdRecoverySessionStarted',
        'CrowdRecoverySession',
        sessionId,
        {
          sessionId,
          lostPetIncidentId: incidentId,
          petId,
          deviceCount: compatibleDevices.length,
        },
        1
      )
    );

    return session;
  }

  public completeRecoverySessionForIncident(incidentId: LostPetIncidentId): boolean {
    const session = Array.from(this.store.crowdSessions.values()).find(
      s => s.lostPetIncidentId === incidentId && s.status === 'ACTIVE'
    );
    if (!session) return false;

    session.status = 'COMPLETED';
    session.endedAt = new Date().toISOString();
    session.updatedAt = new Date().toISOString();

    // Invalidate active clusters for this incident
    for (const cluster of this.store.clusters.values()) {
      if (cluster.lostPetIncidentId === incidentId) {
        cluster.status = 'SUPERSEDED';
        cluster.updatedAt = new Date().toISOString();
      }
    }

    this.emitEvent(
      createEventEnvelope(
        'CrowdRecoverySessionCompleted',
        'CrowdRecoverySession',
        session.crowdRecoverySessionId,
        {
          sessionId: session.crowdRecoverySessionId,
          lostPetIncidentId: incidentId,
          completedAt: session.endedAt,
        },
        1
      )
    );

    return true;
  }

  // ============================================================================
  // 8. TRUST & SAFETY ABUSE FLAGGING
  // ============================================================================

  public flagAbuse(params: {
    scannerInstallationId: ScannerInstallationId;
    reason: 'IMPOSSIBLE_GEOGRAPHY' | 'REPLAY_ATTACK' | 'RATE_LIMIT_EXCEEDED' | 'MALFORMED_IDENTIFIER' | 'EXCESSIVE_DUPLICATES';
    details: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }): CrowdRecoveryAbuseFlag {
    const flagId = asCrowdRecoveryAbuseFlagId(generateUUIDv7());
    const flag: CrowdRecoveryAbuseFlag = {
      flagId,
      scannerInstallationId: params.scannerInstallationId,
      reason: params.reason,
      details: params.details,
      severity: params.severity,
      status: 'OPEN',
      flaggedAt: new Date().toISOString(),
    };

    this.store.abuseFlags.set(flagId, flag);

    this.emitEvent(
      createEventEnvelope(
        'CrowdRecoveryAbuseFlagged',
        'CrowdRecoveryAbuseFlag',
        flagId,
        {
          flagId,
          scannerInstallationId: params.scannerInstallationId,
          reason: params.reason,
          severity: params.severity,
        },
        1
      )
    );

    return flag;
  }

  public listAbuseFlags(): CrowdRecoveryAbuseFlag[] {
    return Array.from(this.store.abuseFlags.values()).sort(
      (a, b) => new Date(b.flaggedAt).getTime() - new Date(a.flaggedAt).getTime()
    );
  }

  public reviewAbuseFlag(params: {
    flagId: CrowdRecoveryAbuseFlagId;
    reviewerUserId: UserId;
    status: 'RESOLVED' | 'DISMISSED';
    reviewNotes: string;
  }): CrowdRecoveryAbuseFlag {
    const flag = this.store.abuseFlags.get(params.flagId);
    if (!flag) throw new Error(`Abuse flag not found: ${params.flagId}`);

    flag.status = params.status;
    flag.reviewedBy = params.reviewerUserId;
    flag.reviewedAt = new Date().toISOString();
    flag.reviewNotes = params.reviewNotes;
    return flag;
  }

  // ============================================================================
  // 9. DATA MINIMIZATION & RETENTION PRUNING
  // ============================================================================

  public runRetentionPruning(maxRawAgeHours: number = 48): {
    prunedObservationsCount: number;
    retainedEvidenceCount: number;
  } {
    const cutoffTime = Date.now() - maxRawAgeHours * 3600 * 1000;
    let prunedCount = 0;

    for (const [obsId, obs] of this.store.crowdObservations.entries()) {
      const obsTime = new Date(obs.observedAt).getTime();
      // Raw scanner-level observations older than cutoff are pruned unless actively investigating
      if (obsTime < cutoffTime) {
        this.store.crowdObservations.delete(obsId);
        prunedCount++;
      }
    }

    return {
      prunedObservationsCount: prunedCount,
      retainedEvidenceCount: this.store.recoveryEvidences.size,
    };
  }
}
