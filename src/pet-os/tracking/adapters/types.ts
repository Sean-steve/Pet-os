/**
 * Pet OS Sprint 14 - Vendor Adapters Types
 */

import { TelemetryEnvelope, TrackingMode, TrackingDevice } from '../types';

export interface TrackerVendorAdapter {
  readonly provider: string;
  readonly displayName: string;
  
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
  
  normalizePayload(rawPayload: unknown, receivedAt: string): TelemetryEnvelope[];
  
  fetchDeviceStatus?(
    deviceRef: string,
    credentials?: Record<string, unknown>
  ): Promise<Partial<TrackingDevice>>;
  
  requestDeviceMode?(
    deviceRef: string,
    mode: TrackingMode,
    credentials?: Record<string, unknown>
  ): Promise<boolean>;
}
