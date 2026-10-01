/**
 * Pet OS Sprint 14 - Tractive GPS Vendor Adapter
 * Simulates real-world ingestion, HMAC verification, and payload mapping.
 */

import { TrackerVendorAdapter } from './types';
import { TelemetryEnvelope } from '../types';
import { asIngestionId, generateUUIDv7 } from '../../kernel/ids';

export class TractiveVendorAdapter implements TrackerVendorAdapter {
  readonly provider = 'TRACTIVE';
  readonly displayName = 'Tractive GPS Pet Tracker';

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!signature || !secret) return false;
    // Simulates standard HMAC-SHA256 signature verification
    // Accepts 'simulated_sig_valid' or matching calculated token
    if (signature === 'simulated_sig_valid' || signature.startsWith('sha256=')) {
      return true;
    }
    return signature === `sig_${secret.slice(0, 8)}`;
  }

  normalizePayload(rawPayload: unknown, receivedAt: string): TelemetryEnvelope[] {
    const raw = rawPayload as Record<string, unknown>;
    const events: TelemetryEnvelope[] = [];

    // Tractive structure handles single event or batched points
    const points = Array.isArray(raw.positions) ? raw.positions : [raw];

    for (const pt of points) {
      if (!pt || typeof pt !== 'object') continue;

      const deviceRef = String(pt.device_id || raw.tracker_id || raw.device_id || 'UNKNOWN');
      const eventId = String(pt.event_id || pt._id || generateUUIDv7());
      const observedAt = String(pt.time || pt.timestamp || receivedAt);

      events.push({
        ingestionId: asIngestionId(generateUUIDv7()),
        provider: this.provider,
        sourceDeviceReference: deviceRef,
        providerEventId: eventId,
        sequenceNumber: typeof pt.seq === 'number' ? pt.seq : undefined,
        observedAt,
        receivedAt,
        latitude: Number(pt.lat ?? pt.latitude),
        longitude: Number(pt.lon ?? pt.lng ?? pt.longitude),
        horizontalAccuracyM: Number(pt.accuracy ?? pt.pos_uncertainty ?? 10),
        altitudeM: pt.altitude !== undefined ? Number(pt.altitude) : undefined,
        speedMps: pt.speed !== undefined ? Number(pt.speed) : undefined,
        headingDegrees: pt.course !== undefined ? Number(pt.course) : undefined,
        batteryPercent: pt.battery_level !== undefined ? Number(pt.battery_level) : undefined,
        connectivityMetadata: {
          networkType: String(pt.network_type || 'LTE-M'),
          rssi: typeof pt.rssi === 'number' ? pt.rssi : -75,
        },
        signatureVerified: true,
        sourcePayloadVersion: 'tractive-v2.1',
      });
    }

    return events;
  }

  async requestDeviceMode(
    deviceRef: string,
    mode: string
  ): Promise<boolean> {
    // Simulates remote command to Tractive API (e.g. enabling LIVE tracking mode)
    return Boolean(deviceRef && mode);
  }
}
