/**
 * Pet OS Sprint 14 - Security, Privacy & Anti-Stalking Audit Logger
 * Records immutable audit logs for device claiming, assignments, sensitive location views, and reassignment.
 */

import { UserId, HouseholdId, PetId, DeviceId, asAuditEventId, generateUUIDv7 } from '../kernel/ids';

export type TrackingAuditAction =
  | 'DEVICE_REGISTERED'
  | 'DEVICE_CLAIMED'
  | 'DEVICE_CLAIM_REJECTED'
  | 'DEVICE_ASSIGNED'
  | 'DEVICE_UNASSIGNED'
  | 'DEVICE_REASSIGNED_CROSS_PET'
  | 'LIVE_LOCATION_ACCESSED'
  | 'ROUTE_HISTORY_ACCESSED'
  | 'CROSS_TENANT_ACCESS_DENIED'
  | 'OUT_OF_WINDOW_ACCESS_DENIED'
  | 'MOBILE_TELEMETRY_UNAUTHORIZED'
  | 'DEVICE_TAKEOVER_BLOCKED'
  | 'INTEGRATION_CONNECTED'
  | 'INTEGRATION_DISCONNECTED';

export interface TrackingAuditEntry {
  auditId: string;
  action: TrackingAuditAction;
  actorUserId?: UserId;
  householdId?: HouseholdId;
  petId?: PetId;
  deviceId?: DeviceId;
  success: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export class TrackingAuditLogger {
  private static instance: TrackingAuditLogger;
  private entries: TrackingAuditEntry[] = [];

  static getInstance(): TrackingAuditLogger {
    if (!TrackingAuditLogger.instance) {
      TrackingAuditLogger.instance = new TrackingAuditLogger();
    }
    return TrackingAuditLogger.instance;
  }

  log(entry: Omit<TrackingAuditEntry, 'auditId' | 'timestamp'>): TrackingAuditEntry {
    const record: TrackingAuditEntry = {
      auditId: asAuditEventId(generateUUIDv7()),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.entries.push(record);
    return record;
  }

  getEntries(filter?: {
    action?: TrackingAuditAction;
    petId?: PetId;
    deviceId?: DeviceId;
    actorUserId?: UserId;
  }): TrackingAuditEntry[] {
    return this.entries.filter(e => {
      if (filter?.action && e.action !== filter.action) return false;
      if (filter?.petId && e.petId !== filter.petId) return false;
      if (filter?.deviceId && e.deviceId !== filter.deviceId) return false;
      if (filter?.actorUserId && e.actorUserId !== filter.actorUserId) return false;
      return true;
    });
  }

  clear(): void {
    this.entries = [];
  }
}
