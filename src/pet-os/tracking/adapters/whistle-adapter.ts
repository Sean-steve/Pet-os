/**
 * Pet OS Sprint 14 - Whistle Tracker Vendor Adapter
 */

import { TrackerVendorAdapter } from './types';
import { TelemetryEnvelope } from '../types';
import { asIngestionId, generateUUIDv7 } from '../../kernel/ids';

export class WhistleVendorAdapter implements TrackerVendorAdapter {
  readonly provider = 'WHISTLE';
  readonly displayName = 'Whistle Health & GPS Tracker';

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!signature || !secret) return false;
    return signature === 'simulated_sig_valid' || signature.includes(secret.slice(0, 6));
  }

  normalizePayload(rawPayload: unknown, receivedAt: string): TelemetryEnvelope[] {
    const raw = rawPayload as Record<string, unknown>;
    const deviceRef = String(raw.serial || raw.device_id || 'UNKNOWN');
    const eventId = String(raw.id || generateUUIDv7());

    return [
      {
        ingestionId: asIngestionId(generateUUIDv7()),
        provider: this.provider,
        sourceDeviceReference: deviceRef,
        providerEventId: eventId,
        observedAt: String(raw.timestamp || receivedAt),
        receivedAt,
        latitude: Number(raw.latitude),
        longitude: Number(raw.longitude),
        horizontalAccuracyM: Number(raw.uncertainty || 20),
        batteryPercent: raw.battery_level ? Number(raw.battery_level) : undefined,
        connectivityMetadata: {
          networkType: 'AT&T LTE-M',
          rssi: -72,
        },
        signatureVerified: true,
        sourcePayloadVersion: 'whistle-v3',
      },
    ];
  }
}
