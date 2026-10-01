/**
 * Pet OS Sprint 14 - Fi Collar Vendor Adapter
 * Simulates Fi smart dog collar webhook ingestion and telemetry envelope creation.
 */

import { TrackerVendorAdapter } from './types';
import { TelemetryEnvelope } from '../types';
import { asIngestionId, generateUUIDv7 } from '../../kernel/ids';

export class FiVendorAdapter implements TrackerVendorAdapter {
  readonly provider = 'FI';
  readonly displayName = 'Fi Smart Dog Collar (Series 3)';

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!signature || !secret) return false;
    if (signature === 'simulated_sig_valid' || signature.startsWith('fi-sha256=')) {
      return true;
    }
    return signature === `fi_sig_${secret.slice(0, 8)}`;
  }

  normalizePayload(rawPayload: unknown, receivedAt: string): TelemetryEnvelope[] {
    const raw = rawPayload as Record<string, unknown>;
    const events: TelemetryEnvelope[] = [];

    const collarId = String(raw.collar_id || raw.device_id || 'UNKNOWN');
    const locations = Array.isArray(raw.locations) ? raw.locations : [raw];

    for (const loc of locations) {
      if (!loc || typeof loc !== 'object') continue;

      const eventId = String(loc.id || loc.event_id || generateUUIDv7());
      const observedAt = String(loc.observed_at || loc.timestamp || receivedAt);

      events.push({
        ingestionId: asIngestionId(generateUUIDv7()),
        provider: this.provider,
        sourceDeviceReference: collarId,
        providerEventId: eventId,
        sequenceNumber: typeof loc.sequence === 'number' ? loc.sequence : undefined,
        observedAt,
        receivedAt,
        latitude: Number(loc.latitude ?? loc.lat),
        longitude: Number(loc.longitude ?? loc.lon),
        horizontalAccuracyM: Number(loc.precision_radius ?? loc.accuracy ?? 15),
        altitudeM: loc.elevation !== undefined ? Number(loc.elevation) : undefined,
        speedMps: loc.velocity !== undefined ? Number(loc.velocity) : undefined,
        batteryPercent: loc.battery_percent !== undefined ? Number(loc.battery_percent) : undefined,
        connectivityMetadata: {
          networkType: String(loc.radio_type || 'NB-IoT'),
          rssi: typeof loc.signal_dbm === 'number' ? loc.signal_dbm : -80,
        },
        signatureVerified: true,
        sourcePayloadVersion: 'fi-series3-v1',
      });
    }

    return events;
  }

  async requestDeviceMode(
    deviceRef: string,
    mode: string
  ): Promise<boolean> {
    return Boolean(deviceRef && mode);
  }
}
