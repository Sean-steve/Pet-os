import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { generateUUIDv7 } from '../../src/pet-os/kernel/ids';

export type DurableDomain = 'health' | 'care' | 'nutrition' | 'training' | 'activity';

type DomainConfig = {
  table: string;
  recordTypes: readonly string[];
  aggregateType: string;
  eventPrefix: string;
  mutable: boolean;
  hasVerificationStatus: boolean;
};

export const DOMAIN_CONFIG: Record<DurableDomain, DomainConfig> = {
  health: {
    table: 'health_records',
    recordTypes: ['CONDITION','ALLERGY','ENCOUNTER','VACCINATION','MEDICATION','PROCEDURE','DIAGNOSTIC_RESULT','CLINICAL_NOTE','AMENDMENT','DOCUMENT_LINK'],
    aggregateType: 'HealthRecord',
    eventPrefix: 'Health',
    mutable: false,
    hasVerificationStatus: true,
  },
  care: {
    table: 'care_records',
    recordTypes: ['OBLIGATION','OCCURRENCE','COMPLETION','REMINDER_POLICY'],
    aggregateType: 'CareRecord',
    eventPrefix: 'Care',
    mutable: true,
    hasVerificationStatus: false,
  },
  nutrition: {
    table: 'nutrition_records',
    recordTypes: ['FEEDING_PLAN','MEAL_SCHEDULE','MEAL_OCCURRENCE','TREAT_LOG','HYDRATION_LOG','APPETITE_OBSERVATION','DIETARY_RESTRICTION','FOOD_TRANSITION_PLAN'],
    aggregateType: 'NutritionRecord',
    eventPrefix: 'Nutrition',
    mutable: true,
    hasVerificationStatus: false,
  },
  training: {
    table: 'training_records',
    recordTypes: ['GOAL','PLAN','SESSION','EXERCISE_ATTEMPT','SKILL_PROGRESS','MILESTONE','EVIDENCE','BEHAVIOR_OBSERVATION'],
    aggregateType: 'TrainingRecord',
    eventPrefix: 'Training',
    mutable: true,
    hasVerificationStatus: false,
  },
  activity: {
    table: 'activity_records',
    recordTypes: ['ACTIVITY_RECORD','ACTIVITY_SESSION','ROUTINE','OCCURRENCE','GOAL','AMENDMENT'],
    aggregateType: 'ActivityRecord',
    eventPrefix: 'Activity',
    mutable: true,
    hasVerificationStatus: false,
  },
};

export interface DurableDomainRecord {
  recordId: string;
  domain: DurableDomain;
  petId: string;
  householdId: string;
  recordType: string;
  occurredAt: string;
  status?: string;
  provenance?: string;
  verificationStatus?: string;
  payload: Record<string, unknown>;
  createdBy: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDomainRecordInput {
  domain: DurableDomain;
  petId: string;
  actorUserId: string;
  idempotencyKey: string;
  recordType: string;
  occurredAt: string;
  status?: string;
  provenance?: string;
  verificationStatus?: string;
  payload: Record<string, unknown>;
}

export interface AmendDomainRecordInput {
  domain: Exclude<DurableDomain, 'health'>;
  petId: string;
  recordId: string;
  actorUserId: string;
  idempotencyKey: string;
  expectedVersion: number;
  reason: string;
  status?: string;
  payloadPatch: Record<string, unknown>;
}

function assertRecordType(domain: DurableDomain, recordType: string): void {
  if (!DOMAIN_CONFIG[domain].recordTypes.includes(recordType)) {
    throw Object.assign(new Error('RECORD_TYPE_INVALID'), { statusCode: 400 });
  }
}

function rowSelector(domain: DurableDomain): string {
  return DOMAIN_CONFIG[domain].hasVerificationStatus
    ? 'verification_status'
    : 'NULL::text AS verification_status';
}

function mapRow(domain: DurableDomain, row: any): DurableDomainRecord {
  return {
    recordId: row.record_id,
    domain,
    petId: row.pet_id,
    householdId: row.household_id,
    recordType: row.record_type,
    occurredAt: new Date(row.occurred_at).toISOString(),
    status: row.status || undefined,
    provenance: row.provenance || undefined,
    verificationStatus: row.verification_status || undefined,
    payload: row.payload || {},
    createdBy: row.created_by,
    version: Number(row.version),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export async function resolvePetDomainContext(
  client: PoolClient,
  petId: string,
  actorUserId: string,
  write = false,
): Promise<{ householdId: string; role: string }> {
  const result = await client.query(
    `SELECT p.household_id, hm.role
       FROM pets p
       JOIN household_members hm ON hm.household_id = p.household_id
      WHERE p.pet_id = $1
        AND hm.user_id = $2
        AND hm.status = 'ACTIVE'
        AND p.status NOT IN ('ARCHIVED','DECEASED')
      LIMIT 1`,
    [petId, actorUserId],
  );
  if (!result.rowCount) throw Object.assign(new Error('PET_DOMAIN_ACCESS_DENIED'), { statusCode: 403 });
  const role = String(result.rows[0].role);
  if (write && !['HOUSEHOLD_OWNER', 'HOUSEHOLD_ADMIN', 'CAREGIVER'].includes(role)) {
    throw Object.assign(new Error('PET_DOMAIN_WRITE_DENIED'), { statusCode: 403 });
  }
  return { householdId: String(result.rows[0].household_id), role };
}

export async function createDomainRecord(
  client: PoolClient,
  input: CreateDomainRecordInput,
): Promise<{ record: DurableDomainRecord; replayed: boolean }> {
  assertRecordType(input.domain, input.recordType);
  const config = DOMAIN_CONFIG[input.domain];
  const { householdId } = await resolvePetDomainContext(client, input.petId, input.actorUserId, true);
  const scope = `${input.domain}:record:create:${input.petId}`;
  const requestFingerprint = fingerprint({
    petId: input.petId,
    recordType: input.recordType,
    occurredAt: input.occurredAt,
    status: input.status || null,
    provenance: input.provenance || null,
    verificationStatus: input.verificationStatus || null,
    payload: input.payload,
  });

  const existing = await client.query(
    `SELECT request_fingerprint, response_body
       FROM idempotency_records
      WHERE actor_user_id = $1 AND scope = $2 AND idempotency_key = $3`,
    [input.actorUserId, scope, input.idempotencyKey],
  );
  if (existing.rowCount) {
    if (existing.rows[0].request_fingerprint !== requestFingerprint) {
      throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'), { statusCode: 409 });
    }
    return { record: existing.rows[0].response_body as DurableDomainRecord, replayed: true };
  }

  const recordId = `${input.domain}-${generateUUIDv7()}`;
  const verificationColumn = config.hasVerificationStatus ? ', verification_status' : '';
  const verificationValue = config.hasVerificationStatus ? ', $9' : '';
  const params = config.hasVerificationStatus
    ? [recordId, input.petId, householdId, input.recordType, input.occurredAt, input.status || null, input.provenance || null, JSON.stringify(input.payload), input.verificationStatus || null, input.actorUserId]
    : [recordId, input.petId, householdId, input.recordType, input.occurredAt, input.status || null, input.provenance || null, JSON.stringify(input.payload), input.actorUserId];
  const actorParam = config.hasVerificationStatus ? '$10' : '$9';

  const inserted = await client.query(
    `INSERT INTO ${config.table} (
      record_id, pet_id, household_id, record_type, occurred_at, status, provenance, payload${verificationColumn}, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb${verificationValue},${actorParam})
    RETURNING record_id, pet_id, household_id, record_type, occurred_at, status, provenance,
      ${rowSelector(input.domain)}, payload, created_by, version, created_at, updated_at`,
    params,
  );
  const record = mapRow(input.domain, inserted.rows[0]);

  await client.query(
    `INSERT INTO outbox_events (event_id, aggregate_type, aggregate_id, event_type, payload)
     VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [
      `evt-${generateUUIDv7()}`,
      config.aggregateType,
      record.recordId,
      `${config.eventPrefix}RecordPersisted`,
      JSON.stringify({
        domain: input.domain,
        recordId: record.recordId,
        recordType: record.recordType,
        petId: record.petId,
        householdId: record.householdId,
        version: record.version,
      }),
    ],
  );

  await client.query(
    `INSERT INTO idempotency_records (
      actor_user_id, scope, idempotency_key, request_fingerprint, resource_id, response_status, response_body
    ) VALUES ($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId, scope, input.idempotencyKey, requestFingerprint, record.recordId, JSON.stringify(record)],
  );

  return { record, replayed: false };
}

export async function listDomainRecords(
  client: PoolClient,
  domain: DurableDomain,
  petId: string,
  actorUserId: string,
  recordType?: string,
  limit = 100,
): Promise<DurableDomainRecord[]> {
  await resolvePetDomainContext(client, petId, actorUserId, false);
  if (recordType) assertRecordType(domain, recordType);
  const config = DOMAIN_CONFIG[domain];
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 100, 1), 200);
  const result = await client.query(
    `SELECT record_id, pet_id, household_id, record_type, occurred_at, status, provenance,
      ${rowSelector(domain)}, payload, created_by, version, created_at, updated_at
       FROM ${config.table}
      WHERE pet_id = $1 AND ($2::text IS NULL OR record_type = $2)
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT $3`,
    [petId, recordType || null, safeLimit],
  );
  return result.rows.map((row) => mapRow(domain, row));
}

export async function getDomainRecord(
  client: PoolClient,
  domain: DurableDomain,
  petId: string,
  recordId: string,
  actorUserId: string,
): Promise<DurableDomainRecord> {
  await resolvePetDomainContext(client, petId, actorUserId, false);
  const config = DOMAIN_CONFIG[domain];
  const result = await client.query(
    `SELECT record_id, pet_id, household_id, record_type, occurred_at, status, provenance,
      ${rowSelector(domain)}, payload, created_by, version, created_at, updated_at
       FROM ${config.table}
      WHERE pet_id = $1 AND record_id = $2
      LIMIT 1`,
    [petId, recordId],
  );
  if (!result.rowCount) throw Object.assign(new Error('DOMAIN_RECORD_NOT_FOUND'), { statusCode: 404 });
  return mapRow(domain, result.rows[0]);
}

export async function amendDomainRecord(
  client: PoolClient,
  input: AmendDomainRecordInput,
): Promise<{ record: DurableDomainRecord; replayed: boolean }> {
  const config = DOMAIN_CONFIG[input.domain];
  if (!config.mutable) throw Object.assign(new Error('DOMAIN_RECORD_APPEND_ONLY'), { statusCode: 409 });
  const { householdId } = await resolvePetDomainContext(client, input.petId, input.actorUserId, true);
  const scope = `${input.domain}:record:amend:${input.recordId}:${input.expectedVersion}`;
  const requestFingerprint = fingerprint({
    expectedVersion: input.expectedVersion,
    reason: input.reason,
    status: input.status || null,
    payloadPatch: input.payloadPatch,
  });

  const priorIdempotency = await client.query(
    `SELECT request_fingerprint, response_body
       FROM idempotency_records
      WHERE actor_user_id = $1 AND scope = $2 AND idempotency_key = $3`,
    [input.actorUserId, scope, input.idempotencyKey],
  );
  if (priorIdempotency.rowCount) {
    if (priorIdempotency.rows[0].request_fingerprint !== requestFingerprint) {
      throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'), { statusCode: 409 });
    }
    return { record: priorIdempotency.rows[0].response_body as DurableDomainRecord, replayed: true };
  }

  const currentResult = await client.query(
    `SELECT record_id, pet_id, household_id, record_type, occurred_at, status, provenance,
      ${rowSelector(input.domain)}, payload, created_by, version, created_at, updated_at
       FROM ${config.table}
      WHERE record_id = $1 AND pet_id = $2
      FOR UPDATE`,
    [input.recordId, input.petId],
  );
  if (!currentResult.rowCount) throw Object.assign(new Error('DOMAIN_RECORD_NOT_FOUND'), { statusCode: 404 });
  const current = mapRow(input.domain, currentResult.rows[0]);
  if (current.version !== input.expectedVersion) {
    throw Object.assign(new Error('DOMAIN_RECORD_VERSION_CONFLICT'), { statusCode: 409 });
  }

  const nextPayload = { ...current.payload, ...input.payloadPatch };
  const nextVersion = current.version + 1;
  const updatedResult = await client.query(
    `UPDATE ${config.table}
        SET payload = $1::jsonb,
            status = COALESCE($2, status),
            version = $3,
            updated_at = now()
      WHERE record_id = $4 AND pet_id = $5 AND version = $6
      RETURNING record_id, pet_id, household_id, record_type, occurred_at, status, provenance,
        ${rowSelector(input.domain)}, payload, created_by, version, created_at, updated_at`,
    [JSON.stringify(nextPayload), input.status || null, nextVersion, input.recordId, input.petId, input.expectedVersion],
  );
  if (!updatedResult.rowCount) throw Object.assign(new Error('DOMAIN_RECORD_VERSION_CONFLICT'), { statusCode: 409 });
  const record = mapRow(input.domain, updatedResult.rows[0]);

  await client.query(
    `INSERT INTO pet_domain_record_revisions (
      revision_id, domain, record_id, pet_id, household_id, prior_version, new_version,
      previous_status, new_status, previous_payload, new_payload, reason, amended_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13)`,
    [
      `rev-${generateUUIDv7()}`,
      input.domain,
      record.recordId,
      record.petId,
      householdId,
      current.version,
      record.version,
      current.status || null,
      record.status || null,
      JSON.stringify(current.payload),
      JSON.stringify(record.payload),
      input.reason,
      input.actorUserId,
    ],
  );

  await client.query(
    `INSERT INTO outbox_events (event_id, aggregate_type, aggregate_id, event_type, payload)
     VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [
      `evt-${generateUUIDv7()}`,
      config.aggregateType,
      record.recordId,
      `${config.eventPrefix}RecordAmended`,
      JSON.stringify({
        domain: input.domain,
        recordId: record.recordId,
        petId: record.petId,
        householdId,
        priorVersion: current.version,
        version: record.version,
        reason: input.reason,
      }),
    ],
  );

  await client.query(
    `INSERT INTO idempotency_records (
      actor_user_id, scope, idempotency_key, request_fingerprint, resource_id, response_status, response_body
    ) VALUES ($1,$2,$3,$4,$5,200,$6::jsonb)`,
    [input.actorUserId, scope, input.idempotencyKey, requestFingerprint, record.recordId, JSON.stringify(record)],
  );

  return { record, replayed: false };
}
