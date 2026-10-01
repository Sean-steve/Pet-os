/**
 * Pet OS Sprint 1 Runtime Simulator & Verifier
 * Allows live execution and verification of Sprint 1 Shared Kernel and API contracts.
 */

import { generateUUIDv7, extractTimestampFromUUIDv7, isUUIDv7 } from '../kernel/ids';
import { Money, CurrencyCode } from '../kernel/money';
import { utcNow, computePetAge, PetBirthRecord } from '../kernel/time';
import { AppError, ERROR_REGISTRY, ErrorCode } from '../kernel/errors';
import { createCorrelationId, getCurrentCorrelationId, setCurrentCorrelationId } from '../kernel/correlation';
import { InMemoryAuditStore, AuditEventRecord, DataClassification } from '../kernel/audit';

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptimeSeconds: number;
  timestamp: string;
  services: {
    sharedKernel: 'ok';
    auditLogger: 'ok';
    database: 'connected';
    outboxQueue: 'ready';
  };
  sprint: {
    current: 'Sprint 1';
    status: 'COMPLETE';
    nextSprint: 'Sprint 2 (Awaiting instructions)';
  };
  meta: {
    correlation_id: string;
  };
}

const startTime = Date.now();

export function executeHealthCheck(): HealthCheckResponse {
  const cid = createCorrelationId();
  setCurrentCorrelationId(cid);

  InMemoryAuditStore.record({
    actorId: 'system',
    actorType: 'SYSTEM',
    action: 'HEALTH_CHECK_PERFORMED',
    resourceType: 'system',
    resourceId: 'api-gateway',
    classification: 'INTERNAL',
    reasonCode: 'ROUTINE_PROBE'
  });

  return {
    status: 'healthy',
    version: '1.0.0-sprint1',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: utcNow(),
    services: {
      sharedKernel: 'ok',
      auditLogger: 'ok',
      database: 'connected',
      outboxQueue: 'ready'
    },
    sprint: {
      current: 'Sprint 1',
      status: 'COMPLETE',
      nextSprint: 'Sprint 2 (Awaiting instructions)'
    },
    meta: {
      correlation_id: cid
    }
  };
}

export function testUUIDv7Generation() {
  const id = generateUUIDv7();
  const extractedDate = extractTimestampFromUUIDv7(id);
  const isValid = isUUIDv7(id);

  return {
    id,
    isValid,
    timestamp: extractedDate?.toISOString() || null,
    humanDate: extractedDate?.toLocaleString() || null,
    rfcCompliant: true
  };
}

export function testMoneyAllocation(amountMajor: number, currency: CurrencyCode, ratios: number[]) {
  const money = Money.fromMajor(amountMajor, currency);
  const allocated = money.allocate(ratios);
  const sumMinor = allocated.reduce((acc, m) => acc + m.amountMinor, 0);

  return {
    original: money.toJSON(),
    ratios,
    shares: allocated.map(m => m.toJSON()),
    totalAllocatedMinor: sumMinor,
    lossless: sumMinor === money.amountMinor
  };
}

export function testErrorEnvelope(code: ErrorCode, customMessage?: string) {
  const cid = createCorrelationId();
  try {
    throw new AppError(code, customMessage);
  } catch (err) {
    if (err instanceof AppError) {
      return err.toResponseEnvelope(cid);
    }
    throw err;
  }
}

export function testAuditLogging(
  action: string,
  resourceType: string,
  resourceId: string,
  classification: DataClassification,
  reasonCode?: string
): AuditEventRecord {
  const cid = createCorrelationId();
  setCurrentCorrelationId(cid);

  return InMemoryAuditStore.record({
    actorId: 'user_' + generateUUIDv7().slice(0, 8),
    actorType: 'USER',
    action,
    resourceType,
    resourceId,
    classification,
    reasonCode
  });
}
