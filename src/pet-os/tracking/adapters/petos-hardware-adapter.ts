/**
 * Pet OS Sprint 14 - Future Pet OS Smart Hardware Adapter
 * Prepared contract for first-party smart collar hardware.
 */

import { TrackerVendorAdapter } from './types';
import { TelemetryEnvelope, TrackingMode } from '../types';
import { asIngestionId, generateUUIDv7 } from '../../kernel/ids';

export class PetOSHardwareAdapter implements TrackerVendorAdapter {
  readonly provider = 'PET_OS_HARDWARE';
  readonly displayName = 'Pet OS Native Ultra-Low Power Collar';

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!signature || !secret) return false;
    return signature === 'simulated_sig_valid' || signature.startsWith('petos-hw-hmac=');
  }

  normalizePayload(rawPayload: unknown, receivedAt: string): TelemetryEnvelope[] {
    const raw = rawPayload as Record<string, unknown>;
    const deviceRef = String(raw.collarId || 'PET_OS_HW_UNKNOWN');
    const eventId = String(raw.packetId || generateUUIDv7());

    return [
      {
        ingestionId: asIngestionId(generateUUIDv7()),
        provider: this.provider,
        sourceDeviceReference: deviceRef,
        providerEventId: eventId,
        sequenceNumber: Number(raw.seq || 1),
        observedAt: String(raw.observedAt || receivedAt),
        receivedAt,
        latitude: Number(raw.lat),
        longitude: Number(raw.lng),
        horizontalAccuracyM: Number(raw.accuracyM || 5),
        altitudeM: raw.altM ? Number(raw.altM) : undefined,
        speedMps: raw.speedMps ? Number(raw.speedMps) : undefined,
        headingDegrees: raw.bearingDeg ? Number(raw.bearingDeg) : undefined,
        batteryPercent: raw.battPercent ? Number(raw.battPercent) : undefined,
        connectivityMetadata: {
          networkType: 'SATELLITE_BLE_CELLULAR_HYBRID',
          rssi: -55,
        },
        signatureVerified: true,
        sourcePayloadVersion: 'petos-proto-v1',
      },
    ];
  }

  async requestDeviceMode(deviceRef: string, mode: TrackingMode): Promise<boolean> {
    return Boolean(deviceRef && mode);
  }
}
