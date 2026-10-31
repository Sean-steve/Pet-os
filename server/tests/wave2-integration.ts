import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { SignJWT } from 'jose';
import { createApp } from '../app';
import { loadServerConfig } from '../config';
import { closeDatabase, getDatabase, withTenantTransaction } from '../db';
import { closeRedis, getRedis } from '../redis';
import { runMigrations } from '../migrate';

const config = loadServerConfig();
const db = getDatabase(config);

async function token(subject: string) {
  assert.ok(config.authJwtSecret, 'Wave 2 integration test requires AUTH_JWT_SECRET');
  return new SignJWT({ scope: 'petos:api' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setIssuer(config.authIssuer)
    .setAudience(config.authAudience)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(new TextEncoder().encode(config.authJwtSecret));
}

async function seed() {
  await db.query(`
    TRUNCATE
      pet_domain_record_revisions,
      health_records,
      care_records,
      nutrition_records,
      training_records,
      activity_records,
      idempotency_records,
      outbox_events,
      pets,
      household_members,
      households,
      users
    RESTART IDENTITY CASCADE
  `);
  await db.query(
    `INSERT INTO users (user_id, normalized_email, account_status) VALUES
      ('usr-wave2-owner','wave2-owner@integration.test','ACTIVE'),
      ('usr-wave2-outsider','wave2-outsider@integration.test','ACTIVE')`,
  );
  await db.query(
    `INSERT INTO households (household_id, name, owner_user_id, status)
     VALUES ('hh-wave2','Wave 2 Household','usr-wave2-owner','ACTIVE')`,
  );
  await db.query(
    `INSERT INTO household_members (membership_id, household_id, user_id, role, status)
     VALUES ('mem-wave2-owner','hh-wave2','usr-wave2-owner','HOUSEHOLD_OWNER','ACTIVE')`,
  );
  await db.query(
    `INSERT INTO pets (
      pet_id, household_id, name, species_code, breed_code, sex, reproductive_status,
      birthdate_precision, primary_color, size_classification, lifecycle_stage, status, created_by
    ) VALUES (
      'pet-wave2','hh-wave2','Milo','SPECIES_DOG','BREED_MIXED','MALE','STERILIZED',
      'ESTIMATED_YEAR','Brown','MEDIUM','ADULT','ACTIVE','usr-wave2-owner'
    )`,
  );
}

async function request(base: string, path: string, accessToken: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${accessToken}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return fetch(base + path, { ...init, headers });
}

type DomainCase = {
  domain: 'health' | 'care' | 'nutrition' | 'training' | 'activity';
  recordType: string;
  status: string;
  provenance: string;
  payload: Record<string, unknown>;
};

const domainCases: DomainCase[] = [
  {
    domain: 'health',
    recordType: 'CONDITION',
    status: 'SUSPECTED',
    provenance: 'OWNER_ENTERED',
    payload: { conditionName: 'Seasonal itch', isDiagnosis: false, chronic: false },
  },
  {
    domain: 'care',
    recordType: 'OBLIGATION',
    status: 'ACTIVE',
    provenance: 'OWNER_DEFINED',
    payload: { title: 'Annual wellness check', dueAt: '2026-12-15T09:00:00.000Z', priority: 'MEDIUM' },
  },
  {
    domain: 'nutrition',
    recordType: 'FEEDING_PLAN',
    status: 'ACTIVE',
    provenance: 'OWNER_DEFINED',
    payload: { title: 'Maintenance plan', dailyMeals: 2, notes: 'Measure each serving' },
  },
  {
    domain: 'training',
    recordType: 'GOAL',
    status: 'ACTIVE',
    provenance: 'OWNER_DEFINED',
    payload: { title: 'Reliable recall', targetBehavior: 'Return on cue', targetSessionsPerWeek: 4 },
  },
  {
    domain: 'activity',
    recordType: 'ACTIVITY_RECORD',
    status: 'VERIFIED',
    provenance: 'OWNER_RECORDED',
    payload: { activityType: 'WALK', durationSeconds: 900, intensity: 'MODERATE', locationContext: 'OUTDOOR' },
  },
];

async function main() {
  await runMigrations();
  await seed();
  await (await getRedis(config)).flushDb();

  const app = createApp(config);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  const ownerToken = await token('usr-wave2-owner');
  const outsiderToken = await token('usr-wave2-outsider');

  try {
    const created = new Map<DomainCase['domain'], string>();

    for (const item of domainCases) {
      const path = `/v1/pets/pet-wave2/${item.domain}/records`;
      const body = JSON.stringify({
        recordType: item.recordType,
        occurredAt: '2026-10-31T07:00:00.000Z',
        status: item.status,
        provenance: item.provenance,
        verificationStatus: item.domain === 'health' ? 'UNVERIFIED' : undefined,
        payload: item.payload,
      });
      const idempotencyKey = `wave2-${item.domain}-create-1`;

      let response = await request(base, path, ownerToken, { method: 'POST', body });
      assert.equal(response.status, 400, `${item.domain} must require idempotency key`);

      response = await request(base, path, ownerToken, {
        method: 'POST',
        headers: { 'idempotency-key': idempotencyKey },
        body,
      });
      assert.equal(response.status, 201, `${item.domain} create failed`);
      let payload: any = await response.json();
      assert.equal(payload.replayed, false);
      assert.equal(payload.record.domain, item.domain);
      assert.equal(payload.record.recordType, item.recordType);
      assert.equal(payload.record.petId, 'pet-wave2');
      assert.equal(payload.record.householdId, 'hh-wave2');
      assert.equal(payload.record.version, 1);
      const recordId = String(payload.record.recordId);
      created.set(item.domain, recordId);

      response = await request(base, path, ownerToken, {
        method: 'POST',
        headers: { 'idempotency-key': idempotencyKey },
        body,
      });
      assert.equal(response.status, 200, `${item.domain} replay failed`);
      payload = await response.json();
      assert.equal(payload.replayed, true);
      assert.equal(payload.record.recordId, recordId);

      response = await request(base, `${path}?type=${encodeURIComponent(item.recordType)}`, ownerToken);
      assert.equal(response.status, 200, `${item.domain} list failed`);
      payload = await response.json();
      assert.equal(payload.records.length, 1);
      assert.equal(payload.records[0].recordId, recordId);

      response = await request(base, `${path}/${recordId}`, ownerToken);
      assert.equal(response.status, 200, `${item.domain} detail failed`);
      payload = await response.json();
      assert.equal(payload.record.recordId, recordId);

      response = await request(base, path, outsiderToken);
      assert.equal(response.status, 403, `${item.domain} foreign tenant was not denied`);
    }

    const mutableDomains: Array<Exclude<DomainCase['domain'], 'health'>> = ['care', 'nutrition', 'training', 'activity'];
    for (const domain of mutableDomains) {
      const recordId = created.get(domain);
      assert.ok(recordId);
      const path = `/v1/pets/pet-wave2/${domain}/records/${recordId}`;
      const body = JSON.stringify({
        expectedVersion: 1,
        reason: 'Integration lifecycle update',
        status: 'UPDATED',
        payloadPatch: { integrationUpdated: true },
      });

      let response = await request(base, path, ownerToken, {
        method: 'PATCH',
        headers: { 'idempotency-key': `wave2-${domain}-amend-1` },
        body,
      });
      assert.equal(response.status, 200, `${domain} amendment failed`);
      let payload: any = await response.json();
      assert.equal(payload.replayed, false);
      assert.equal(payload.record.version, 2);
      assert.equal(payload.record.payload.integrationUpdated, true);

      response = await request(base, path, ownerToken, {
        method: 'PATCH',
        headers: { 'idempotency-key': `wave2-${domain}-amend-1` },
        body,
      });
      assert.equal(response.status, 200, `${domain} amendment replay failed`);
      payload = await response.json();
      assert.equal(payload.replayed, true);
      assert.equal(payload.record.version, 2);

      response = await request(base, path, ownerToken, {
        method: 'PATCH',
        headers: { 'idempotency-key': `wave2-${domain}-stale-version` },
        body: JSON.stringify({
          expectedVersion: 1,
          reason: 'Stale write must fail',
          payloadPatch: { stale: true },
        }),
      });
      assert.equal(response.status, 409, `${domain} stale write was not rejected`);
    }

    const healthId = created.get('health');
    assert.ok(healthId);
    let response = await request(base, `/v1/pets/pet-wave2/health/records/${healthId}/amendments`, ownerToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'wave2-health-amendment-1' },
      body: JSON.stringify({
        reason: 'Clarify owner observation wording',
        provenance: 'OWNER_ENTERED',
        verificationStatus: 'UNVERIFIED',
        changes: { description: 'Seasonal itching observed after outdoor play' },
      }),
    });
    assert.equal(response.status, 201);
    let payload: any = await response.json();
    assert.equal(payload.record.recordType, 'AMENDMENT');
    assert.equal(payload.record.payload.targetRecordId, healthId);

    response = await request(base, `/v1/pets/pet-wave2/health/records/${healthId}`, ownerToken);
    assert.equal(response.status, 200);
    payload = await response.json();
    assert.equal(payload.record.version, 1, 'Health source record must remain append-only');

    const tableNames = ['health_records', 'care_records', 'nutrition_records', 'training_records', 'activity_records'];
    for (const table of tableNames) {
      const foreignRead = await withTenantTransaction(config, 'usr-wave2-outsider', undefined, (client) =>
        client.query(`SELECT record_id FROM ${table} WHERE pet_id = $1`, ['pet-wave2']),
      );
      assert.equal(foreignRead.rowCount, 0, `${table} RLS exposed a foreign tenant record`);
    }

    const revisions = await db.query('SELECT domain, record_id, prior_version, new_version FROM pet_domain_record_revisions');
    assert.equal(revisions.rowCount, 4);
    assert.ok(revisions.rows.every((row) => row.prior_version === 1 && row.new_version === 2));

    const outbox = await db.query(
      `SELECT event_type, aggregate_id FROM outbox_events
       WHERE event_type LIKE '%RecordPersisted' OR event_type LIKE '%RecordAmended'`,
    );
    assert.equal(outbox.rowCount, 10);

    const idempotency = await db.query(
      `SELECT scope FROM idempotency_records
       WHERE actor_user_id = 'usr-wave2-owner'`,
    );
    assert.equal(idempotency.rowCount, 10);

    console.log('WAVE2-INTEGRATION: PASS');
    console.log('Health durable append-only persistence: PASS');
    console.log('Care durable versioned persistence: PASS');
    console.log('Nutrition durable versioned persistence: PASS');
    console.log('Training durable versioned persistence: PASS');
    console.log('Activity durable versioned persistence: PASS');
    console.log('Five-domain cross-tenant API denial: PASS');
    console.log('Five-domain PostgreSQL RLS denial: PASS');
    console.log('Optimistic concurrency + revision ledger: PASS');
    console.log('Transactional outbox + payload-bound idempotency: PASS');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await Promise.allSettled([closeDatabase(), closeRedis()]);
  }
}

main().catch(async (error) => {
  console.error('WAVE2-INTEGRATION: FAIL', error);
  await Promise.allSettled([closeDatabase(), closeRedis()]);
  process.exit(1);
});
