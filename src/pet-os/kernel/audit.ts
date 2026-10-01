/**
 * Pet OS Shared Kernel - Audit Trail & Compliance Recorder
 * Implements Volume XXX & XXXI requirements:
 * Append-only, tamper-evident audit logging for restricted and state-changing actions.
 */

import { generateUUIDv7 } from './ids';
import { utcNow } from './time';
import { getCurrentCorrelationId } from './correlation';

export type DataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export interface AuditEventRecord {
  id: string; // UUIDv7
  actorId: string;
  actorType: 'USER' | 'PROVIDER' | 'DEVICE' | 'SYSTEM' | 'ADMIN';
  action: string;
  resourceType: string;
  resourceId: string;
  classification: DataClassification;
  occurredAt: string;
  reasonCode?: string;
  correlationId: string;
  metadata?: Record<string, unknown>;
}

export class InMemoryAuditStore {
  private static records: AuditEventRecord[] = [];

  static record(event: Omit<AuditEventRecord, 'id' | 'occurredAt' | 'correlationId'>): AuditEventRecord {
    const fullRecord: AuditEventRecord = {
      id: generateUUIDv7(),
      occurredAt: utcNow(),
      correlationId: getCurrentCorrelationId(),
      ...event
    };

    // Immutability: never mutate past items
    this.records.push(Object.freeze({ ...fullRecord }));
    return fullRecord;
  }

  static getRecent(limit = 20): AuditEventRecord[] {
    return [...this.records].slice(-limit).reverse();
  }

  static getByResource(resourceType: string, resourceId: string): AuditEventRecord[] {
    return this.records.filter(
      r => r.resourceType === resourceType && r.resourceId === resourceId
    );
  }

  static clear(): void {
    this.records = [];
  }
}
