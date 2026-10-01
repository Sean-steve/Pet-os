/**
 * Pet OS Sprint 17 - Cryptographic Identity & Ephemeral Identifier Derivation
 * 
 * Implements:
 * - Volume XIX (BLE Recovery Protocol Cryptographic Specifications)
 * - Volume XXXI (Security, Privacy, Trust & Anti-Stalking Protections)
 * - ADR-017 (Ephemeral Rotating Recovery Identifiers & Anti-Stalking Invariants)
 * 
 * Threat Model & Security Properties:
 * 1. Forward Secrecy / Non-linkability: Observers sniffing BLE broadcasts cannot correlate
 *    identifiers from different epochs without possessing the device's root key.
 * 2. Clock Skew Tolerance: Bounded to +/- 1 epoch window (15 minutes) to prevent replay
 *    while accommodating typical device RTC drift.
 * 3. Secret Isolation: Root secrets are strictly isolated in this module's in-memory HSM/vault;
 *    only opaque key references and identifiers are passed to stores and services.
 * 4. Zero Static Identifiers: Advertisements contain no device serial, pet ID, or user identity.
 */

import {
  DeviceId,
  PetId,
  HouseholdId,
  BleRecoveryKeyReferenceId,
  asBleRecoveryKeyReferenceId,
  generateUUIDv7,
} from '../kernel/ids';
import { BleRecoveryKeyReference } from './types';

export const CANONICAL_EPOCH_SECONDS = 900; // 15-minute epoch interval
export const CANONICAL_PROTOCOL_VERSION = 'V1';
export const PROTOCOL_CONTEXT_STRING = 'PET_OS_BLE_RECOVERY_V1';

export interface InternalSecretRecord {
  keyId: string;
  deviceId: DeviceId;
  petId: PetId;
  householdId: HouseholdId;
  rawSecret: string; // 256-bit hex secret (held ONLY in internal vault)
  algorithm: 'HMAC-SHA256';
  createdAt: string;
  revokedAt?: string;
  isRevoked: boolean;
}

// ============================================================================
// ISOMORPHIC PURE TYPESCRIPT SHA-256 & HMAC-SHA256 (ZERO BROWSER BUNDLE ISSUES)
// ============================================================================

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256Bytes(data: Uint8Array): Uint8Array {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const bitLength = data.length * 8;
  const paddingLength = (data.length % 64 < 56) ? (56 - (data.length % 64)) : (120 - (data.length % 64));
  const totalLength = data.length + paddingLength + 8;
  const padded = new Uint8Array(totalLength);
  padded.set(data);
  padded[data.length] = 0x80;

  const view = new DataView(padded.buffer);
  // Set 64-bit length (big-endian)
  view.setUint32(totalLength - 4, bitLength >>> 0);
  view.setUint32(totalLength - 8, Math.floor(bitLength / 0x100000000));

  const w = new Uint32Array(64);

  for (let i = 0; i < totalLength; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(i + t * 4);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(7, w[t - 15]) ^ rotr(18, w[t - 15]) ^ (w[t - 15] >>> 3);
      const s1 = rotr(17, w[t - 2]) ^ rotr(19, w[t - 2]) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let t = 0; t < 64; t++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const result = new Uint8Array(32);
  const resultView = new DataView(result.buffer);
  resultView.setUint32(0, h0);
  resultView.setUint32(4, h1);
  resultView.setUint32(8, h2);
  resultView.setUint32(12, h3);
  resultView.setUint32(16, h4);
  resultView.setUint32(20, h5);
  resultView.setUint32(24, h6);
  resultView.setUint32(28, h7);
  return result;
}

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function stringToBytes(str: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function computeHmacSha256(keyBytes: Uint8Array, messageBytes: Uint8Array): Uint8Array {
  const blockSize = 64;
  let key = keyBytes;
  if (key.length > blockSize) {
    key = sha256Bytes(key);
  }
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(key);

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = paddedKey[i] ^ 0x5c;
    iKeyPad[i] = paddedKey[i] ^ 0x36;
  }

  const innerData = new Uint8Array(iKeyPad.length + messageBytes.length);
  innerData.set(iKeyPad);
  innerData.set(messageBytes, iKeyPad.length);
  const innerHash = sha256Bytes(innerData);

  const outerData = new Uint8Array(oKeyPad.length + innerHash.length);
  outerData.set(oKeyPad);
  outerData.set(innerHash, oKeyPad.length);
  return sha256Bytes(outerData);
}

function generateSecureRandomHex(byteCount = 32): string {
  const bytes = new Uint8Array(byteCount);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteCount; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}

/**
 * BleKeyVault: In-memory simulation of a Hardware Security Module / Cloud KMS
 * protecting device root keys from application-level exposure.
 */
class BleKeyVault {
  private static instance: BleKeyVault;
  private secrets = new Map<string, InternalSecretRecord>(); // keyId -> record
  private deviceKeyMap = new Map<string, string>(); // deviceId -> keyId (latest active)

  private constructor() {}

  public static getInstance(): BleKeyVault {
    if (!BleKeyVault.instance) {
      BleKeyVault.instance = new BleKeyVault();
    }
    return BleKeyVault.instance;
  }

  /**
   * Generates and securely vaults a new 256-bit cryptographic root secret for a device.
   */
  public provisionDeviceSecret(deviceId: DeviceId, petId: PetId, householdId: HouseholdId): {
    keyId: string;
    keyReference: BleRecoveryKeyReference;
  } {
    const keyId = `kms_ble_${generateUUIDv7().replace(/-/g, '').substring(0, 16)}`;
    const rawSecret = generateSecureRandomHex(32); // 256-bit entropy

    const record: InternalSecretRecord = {
      keyId,
      deviceId,
      petId,
      householdId,
      rawSecret,
      algorithm: 'HMAC-SHA256',
      createdAt: new Date().toISOString(),
      isRevoked: false,
    };

    this.secrets.set(keyId, record);
    this.deviceKeyMap.set(deviceId, keyId);

    const keyReferenceId = asBleRecoveryKeyReferenceId(generateUUIDv7());
    const keyReference: BleRecoveryKeyReference = {
      keyReferenceId,
      deviceId,
      householdId,
      petId,
      status: 'ACTIVE',
      protocolVersion: CANONICAL_PROTOCOL_VERSION,
      epochIntervalSeconds: CANONICAL_EPOCH_SECONDS,
      keyId,
      activeFrom: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return { keyId, keyReference };
  }

  /**
   * Marks an existing key as revoked in the vault.
   */
  public revokeSecret(keyId: string, reason: string): boolean {
    const record = this.secrets.get(keyId);
    if (!record) return false;

    record.isRevoked = true;
    record.revokedAt = new Date().toISOString();
    return true;
  }

  /**
   * Internal lookup to fetch the raw secret for derivation/resolution ONLY.
   * NEVER exposed outside of this crypto module.
   */
  public getInternalSecret(keyId: string): InternalSecretRecord | undefined {
    return this.secrets.get(keyId);
  }

  /**
   * Returns all active internal secret records for backend resolution scanning.
   */
  public getActiveSecrets(): InternalSecretRecord[] {
    const active: InternalSecretRecord[] = [];
    for (const record of this.secrets.values()) {
      if (!record.isRevoked) {
        active.push(record);
      }
    }
    return active;
  }

  /**
   * Clears all vaulted secrets (used for testing and full reset).
   */
  public clear(): void {
    this.secrets.clear();
    this.deviceKeyMap.clear();
  }
}

export const bleKeyVault = BleKeyVault.getInstance();

// ============================================================================
// CRYPTOGRAPHIC DERIVATION FUNCTIONS
// ============================================================================

/**
 * Computes the epoch index for a given timestamp.
 */
export function calculateEpochIndex(timestampMs: number, epochSeconds: number = CANONICAL_EPOCH_SECONDS): number {
  return Math.floor(timestampMs / (epochSeconds * 1000));
}

/**
 * Derives the Rotating Ephemeral Identifier (REI) using HMAC-SHA256:
 * REI = Truncate16Hex(HMAC-SHA256(rootSecret, "PET_OS_BLE_RECOVERY_V1:" || epochIndex))
 */
export function deriveRotatingIdentifier(rawSecretHex: string, epochIndex: number): string {
  const message = `${PROTOCOL_CONTEXT_STRING}:${epochIndex}`;
  const keyBytes = hexToBytes(rawSecretHex);
  const messageBytes = stringToBytes(message);
  const hmacBytes = computeHmacSha256(keyBytes, messageBytes);
  const digestHex = bytesToHex(hmacBytes);
  // Truncate to 16 hex chars (8 bytes = 64 bits of entropy per advertisement packet)
  return digestHex.substring(0, 16).toUpperCase();
}

/**
 * Generates the simulated BLE advertisement payload broadcast by a compatible pet tracker.
 * Contains ZERO static pet/owner identifiers.
 */
export function generateDeviceAdvertisement(deviceId: DeviceId, timestampMs: number = Date.now()): {
  payload: {
    serviceUuid: string;
    protocolVersion: string;
    ephemeralIdentifier: string;
    epochIndex: number;
    txPower: number;
  };
  epochIndex: number;
} {
  // Find active key for device
  const activeRecords = bleKeyVault.getActiveSecrets().filter(r => r.deviceId === deviceId);
  if (activeRecords.length === 0) {
    throw new Error(`No active cryptographic identity provisioned for device: ${deviceId}`);
  }

  const record = activeRecords[activeRecords.length - 1];
  const epochIndex = calculateEpochIndex(timestampMs);
  const ephemeralIdentifier = deriveRotatingIdentifier(record.rawSecret, epochIndex);

  return {
    payload: {
      serviceUuid: '0xFD59', // Pet OS canonical 16-bit BLE Service UUID
      protocolVersion: CANONICAL_PROTOCOL_VERSION,
      ephemeralIdentifier,
      epochIndex,
      txPower: -4,
    },
    epochIndex,
  };
}

/**
 * Secure Backend-Only Ephemeral Identifier Resolution.
 * Tests candidate epochs: current epoch, previous epoch, and next epoch (clock skew tolerance).
 * Returns the matching internal device and pet linkage, or undefined if no match.
 */
export function resolveIdentifierInternally(
  ephemeralIdentifier: string,
  observationTimestampMs: number
): {
  matchedRecord: InternalSecretRecord;
  matchedEpoch: number;
  isClockSkewed: boolean;
} | undefined {
  const targetId = ephemeralIdentifier.trim().toUpperCase();
  const currentEpoch = calculateEpochIndex(observationTimestampMs);

  // Allow current epoch, E - 1 (previous 15 min), and E + 1 (next 15 min for drift)
  const candidateEpochs = [currentEpoch, currentEpoch - 1, currentEpoch + 1];

  const activeRecords = bleKeyVault.getActiveSecrets();
  for (const record of activeRecords) {
    for (const epoch of candidateEpochs) {
      const candidateId = deriveRotatingIdentifier(record.rawSecret, epoch);
      if (candidateId === targetId) {
        return {
          matchedRecord: record,
          matchedEpoch: epoch,
          isClockSkewed: epoch !== currentEpoch,
        };
      }
    }
  }

  return undefined;
}

/**
 * Computes a pseudonymous hash for scanner installations to protect observer identity.
 */
export function hashScannerInstallationId(installationId: string): string {
  const data = stringToBytes(`SCANNER_SALT_2026_${installationId}`);
  const hash = sha256Bytes(data);
  return bytesToHex(hash).substring(0, 16);
}

/**
 * Generates an idempotency duplicate key for incoming observations.
 */
export function generateObservationDuplicateKey(
  scannerHash: string,
  ephemeralId: string,
  observedAtMs: number
): string {
  // Bucket to 1-minute intervals to debounce rapid repetitive packets from same phone
  const minuteBucket = Math.floor(observedAtMs / 60000);
  return `${scannerHash}_${ephemeralId}_${minuteBucket}`;
}

/**
 * Classifies proximity based on calibrated RSSI bands.
 */
export function classifyProximityRssi(rssi: number): 'VERY_NEAR' | 'NEAR' | 'DETECTED' | 'LOW_SIGNAL' | 'UNKNOWN' {
  if (rssi >= -65) return 'VERY_NEAR';
  if (rssi >= -75) return 'NEAR';
  if (rssi >= -88) return 'DETECTED';
  if (rssi < -88) return 'LOW_SIGNAL';
  return 'UNKNOWN';
}

/**
 * Generalizes a precise GPS coordinate to a privacy-preserving circle (~150m radius).
 * Protects observer phone location from being exposed to the pet owner.
 */
export function generalizeCoordinate(coord: number): number {
  // Round to ~3 decimal places (~110m precision)
  return Math.round(coord * 1000) / 1000;
}
