/**
 * Pet OS Shared Kernel - Correlation & Tracing
 * Implements PETXXXIPET-001:
 * "Every request/job/device batch MUST carry correlation ID."
 */

import { generateUUIDv7 } from './ids';

let currentCorrelationId: string = generateUUIDv7();

export function createCorrelationId(): string {
  return generateUUIDv7();
}

export function getCurrentCorrelationId(): string {
  return currentCorrelationId;
}

export function setCurrentCorrelationId(id: string): void {
  currentCorrelationId = id;
}

export interface CorrelationContext {
  correlationId: string;
  causationId?: string;
  actorId?: string;
  actorType?: 'USER' | 'PROVIDER' | 'DEVICE' | 'SYSTEM' | 'ADMIN';
  householdId?: string;
}
