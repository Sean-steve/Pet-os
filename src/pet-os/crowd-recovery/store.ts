/**
 * Pet OS Sprint 17 - Crowd Recovery Bounded Context In-Memory Store
 * 
 * Implements:
 * - Volume XIX (BLE Recovery Tag Platform Storage)
 * - Volume XXX (Database Schema & Technical Data Dictionary)
 * - Volume XXXI (Security, Privacy, Trust & Anti-Stalking Protections)
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
  asDeviceId,
  asPetId,
  asHouseholdId,
  asUserId,
  asScannerInstallationId,
  asRecoveryConsentId,
  asCrowdRecoverySessionId,
  asLostPetIncidentId,
  generateUUIDv7,
} from '../kernel/ids';
import { CANONICAL_IDS } from '../kernel/canonical-ids';
import {
  BleDeviceCapability,
  BleRecoveryKeyReference,
  ScannerInstallation,
  CrowdRecoveryParticipationRecord,
  CrowdObservation,
  CrowdObservationCluster,
  CrowdRecoveryEvidence,
  CrowdRecoverySession,
  CrowdRecoveryAbuseFlag,
} from './types';
import { bleKeyVault } from './crypto';

export class CrowdRecoveryStore {
  private static instance: CrowdRecoveryStore;

  public participations = new Map<UserId, CrowdRecoveryParticipationRecord>();
  public scannerInstallations = new Map<ScannerInstallationId, ScannerInstallation>();
  public deviceCapabilities = new Map<DeviceId, BleDeviceCapability>();
  public keyReferences = new Map<BleRecoveryKeyReferenceId, BleRecoveryKeyReference>();
  public crowdSessions = new Map<CrowdRecoverySessionId, CrowdRecoverySession>();
  public crowdObservations = new Map<CrowdObservationId, CrowdObservation>();
  public clusters = new Map<CrowdObservationClusterId, CrowdObservationCluster>();
  public recoveryEvidences = new Map<CrowdRecoveryEvidenceId, CrowdRecoveryEvidence>();
  public abuseFlags = new Map<CrowdRecoveryAbuseFlagId, CrowdRecoveryAbuseFlag>();

  // Ingestion idempotency and rate limiting
  public idempotencyKeys = new Set<string>();
  public scannerRateLimits = new Map<string, { count: number; windowStart: number }>();

  private constructor() {
    this.seedCanonicalData();
  }

  public static getInstance(): CrowdRecoveryStore {
    if (!CrowdRecoveryStore.instance) {
      CrowdRecoveryStore.instance = new CrowdRecoveryStore();
    }
    return CrowdRecoveryStore.instance;
  }

  public clear(): void {
    this.participations.clear();
    this.scannerInstallations.clear();
    this.deviceCapabilities.clear();
    this.keyReferences.clear();
    this.crowdSessions.clear();
    this.crowdObservations.clear();
    this.clusters.clear();
    this.recoveryEvidences.clear();
    this.abuseFlags.clear();
    this.idempotencyKeys.clear();
    this.scannerRateLimits.clear();
    bleKeyVault.clear();
    this.seedCanonicalData();
  }

  private seedCanonicalData(): void {
    const elenaId = CANONICAL_IDS.OWNER_ELENA;
    const sarahId = CANONICAL_IDS.PROVIDER_SARAH;
    const householdId = CANONICAL_IDS.MAIN_HOUSEHOLD;
    const buddyPetId = CANONICAL_IDS.BUDDY;
    const lunaPetId = CANONICAL_IDS.LUNA;

    // 1. BLE Device Capabilities
    const buddyDeviceId = asDeviceId('dev_01j7h9e0000000000000000001');
    const lunaDeviceId = asDeviceId('dev_01j7h9e0000000000000000002');

    const buddyCapability: BleDeviceCapability = {
      deviceId: buddyDeviceId,
      supportsBleRecovery: true,
      supportsRotatingIdentifier: true,
      supportsLostModeBroadcast: true,
      supportsRemoteModeChange: true,
      protocolVersion: 'V1',
      advertisingIntervalMs: 1280,
      txPowerDbm: -4,
      isRevoked: false,
    };
    this.deviceCapabilities.set(buddyDeviceId, buddyCapability);

    const lunaCapability: BleDeviceCapability = {
      deviceId: lunaDeviceId,
      supportsBleRecovery: true,
      supportsRotatingIdentifier: true,
      supportsLostModeBroadcast: true,
      supportsRemoteModeChange: false, // passive tag
      protocolVersion: 'V1',
      advertisingIntervalMs: 2000,
      txPowerDbm: -4,
      isRevoked: false,
    };
    this.deviceCapabilities.set(lunaDeviceId, lunaCapability);

    // 2. Provision Initial Cryptographic Keys in Vault
    const buddyKey = bleKeyVault.provisionDeviceSecret(buddyDeviceId, buddyPetId, householdId);
    this.keyReferences.set(buddyKey.keyReference.keyReferenceId, buddyKey.keyReference);

    const lunaKey = bleKeyVault.provisionDeviceSecret(lunaDeviceId, lunaPetId, householdId);
    this.keyReferences.set(lunaKey.keyReference.keyReferenceId, lunaKey.keyReference);

    // 3. Opted-in Scanner Participant: Sarah Mwangi (Provider / Walker)
    const sarahScannerId = asScannerInstallationId('scan_01j7h9s0000000000000000001');
    const sarahScanner: ScannerInstallation = {
      scannerInstallationId: sarahScannerId,
      userId: sarahId,
      platform: 'ANDROID',
      appVersion: '2026.9.1',
      status: 'ENABLED',
      consentPolicyVersion: '2026.1_CROWD_RECOVERY',
      bluetoothState: 'POWERED_ON',
      locationPermission: 'GRANTED',
      backgroundCapability: 'FULL_BACKGROUND',
      isBatterySaverActive: false,
      enabledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      totalObservationsSubmitted: 14,
      totalBatchesSubmitted: 3,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.scannerInstallations.set(sarahScannerId, sarahScanner);

    const sarahParticipation: CrowdRecoveryParticipationRecord = {
      consentId: asRecoveryConsentId('rc_01j7h9s0000000000000000001'),
      userId: sarahId,
      status: 'ENABLED',
      consentPolicyVersion: '2026.1_CROWD_RECOVERY',
      enabledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      scannerInstallationId: sarahScannerId,
      optInExplanationAcknowledged: true,
      updatedAt: new Date().toISOString(),
    };
    this.participations.set(sarahId, sarahParticipation);

    // 4. Opted-in Scanner Participant: Elena Vance (Household Owner)
    const elenaScannerId = asScannerInstallationId('scan_01j7h9s0000000000000000002');
    const elenaScanner: ScannerInstallation = {
      scannerInstallationId: elenaScannerId,
      userId: elenaId,
      platform: 'IOS',
      appVersion: '2026.9.1',
      status: 'ENABLED',
      consentPolicyVersion: '2026.1_CROWD_RECOVERY',
      bluetoothState: 'POWERED_ON',
      locationPermission: 'GRANTED',
      backgroundCapability: 'OPPORTUNISTIC',
      isBatterySaverActive: false,
      enabledAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      totalObservationsSubmitted: 8,
      totalBatchesSubmitted: 2,
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.scannerInstallations.set(elenaScannerId, elenaScanner);

    const elenaParticipation: CrowdRecoveryParticipationRecord = {
      consentId: asRecoveryConsentId('rc_01j7h9s0000000000000000002'),
      userId: elenaId,
      status: 'ENABLED',
      consentPolicyVersion: '2026.1_CROWD_RECOVERY',
      enabledAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      scannerInstallationId: elenaScannerId,
      optInExplanationAcknowledged: true,
      updatedAt: new Date().toISOString(),
    };
    this.participations.set(elenaId, elenaParticipation);
  }
}
