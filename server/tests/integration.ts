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
  assert.ok(config.authJwtSecret, 'Integration test requires AUTH_JWT_SECRET');
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
  await db.query('TRUNCATE idempotency_records, outbox_events, pets, household_members, households, users RESTART IDENTITY CASCADE');
  await db.query(
    `INSERT INTO users (user_id, normalized_email, account_status) VALUES
      ('usr-int-owner','owner@integration.test','ACTIVE'),
      ('usr-int-outsider','outsider@integration.test','ACTIVE'),
      ('usr-int-suspended','suspended@integration.test','SUSPENDED')`,
  );
  await db.query(
    `INSERT INTO households (household_id, name, owner_user_id, status)
     VALUES ('hh-int-owner','Integration Household','usr-int-owner','ACTIVE')`,
  );
  await db.query(
    `INSERT INTO household_members (membership_id, household_id, user_id, role, status)
     VALUES ('mem-int-owner','hh-int-owner','usr-int-owner','HOUSEHOLD_OWNER','ACTIVE')`,
  );
}

async function request(base: string, path: string, accessToken?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return fetch(base + path, { ...init, headers });
}

async function main() {
  await runMigrations();
  await seed();
  await (await getRedis(config)).flushDb();

  const app = createApp(config);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  const ownerToken = await token('usr-int-owner');
  const outsiderToken = await token('usr-int-outsider');
  const suspendedToken = await token('usr-int-suspended');

  try {
    let response = await request(base, '/health/ready');
    assert.equal(response.status, 200);

    response = await request(base, '/v1/me/households');
    assert.equal(response.status, 401);

    response = await request(base, '/v1/me/households', 'not-a-token');
    assert.equal(response.status, 401);

    response = await request(base, '/v1/me/households', suspendedToken);
    assert.equal(response.status, 403);

    response = await request(base, '/v1/me/households', ownerToken);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-ratelimit-limit'), String(config.rateLimitPerMinute));
    let payload: any = await response.json();
    assert.equal(payload.households.length, 1);
    assert.equal(payload.households[0].householdId, 'hh-int-owner');

    response = await request(base, '/v1/households/hh-int-owner/pets', outsiderToken);
    assert.equal(response.status, 403);

    response = await request(base, '/v1/households/hh-int-owner/pets', ownerToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'Kito', speciesCode: 'SPECIES_DOG', breedCode: 'BREED_MIXED', primaryColor: 'Black', sex: 'MALE' }),
    });
    assert.equal(response.status, 400);

    const createBody = JSON.stringify({
      name: 'Kito',
      speciesCode: 'SPECIES_DOG',
      breedCode: 'BREED_MIXED',
      primaryColor: 'Black',
      sex: 'MALE',
      sizeClassification: 'MEDIUM',
    });
    response = await request(base, '/v1/households/hh-int-owner/pets', ownerToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'pet-create-integration-1' },
      body: createBody,
    });
    assert.equal(response.status, 201);
    payload = await response.json();
    assert.equal(payload.replayed, false);
    const petId = payload.pet.petId;

    response = await request(base, '/v1/households/hh-int-owner/pets', ownerToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'pet-create-integration-1' },
      body: createBody,
    });
    assert.equal(response.status, 200);
    payload = await response.json();
    assert.equal(payload.replayed, true);
    assert.equal(payload.pet.petId, petId);

    response = await request(base, '/v1/households/hh-int-owner/pets', ownerToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'pet-create-integration-1' },
      body: JSON.stringify({
        name: 'Different Pet',
        speciesCode: 'SPECIES_CAT',
        breedCode: 'BREED_UNKNOWN',
        primaryColor: 'White',
        sex: 'FEMALE',
      }),
    });
    assert.equal(response.status, 409);

    response = await request(base, '/v1/households/hh-int-owner/pets', ownerToken);
    assert.equal(response.status, 200);
    payload = await response.json();
    assert.equal(payload.pets.length, 1);
    assert.equal(payload.pets[0].petId, petId);

    const rlsForeignRead = await withTenantTransaction(config, 'usr-int-outsider', 'hh-int-owner', (client) =>
      client.query(`SELECT pet_id FROM pets WHERE household_id = $1`, ['hh-int-owner']),
    );
    assert.equal(rlsForeignRead.rowCount, 0);

    const outbox = await db.query(`SELECT event_type, aggregate_id FROM outbox_events WHERE aggregate_id = $1`, [petId]);
    assert.equal(outbox.rowCount, 1);
    assert.equal(outbox.rows[0].event_type, 'PetRegistered');

    const idempotency = await db.query(
      `SELECT resource_id FROM idempotency_records WHERE actor_user_id = 'usr-int-owner' AND idempotency_key = 'pet-create-integration-1'`,
    );
    assert.equal(idempotency.rowCount, 1);
    assert.equal(idempotency.rows[0].resource_id, petId);

    console.log('BACKEND-INTEGRATION: PASS');
    console.log('PostgreSQL persistence: PASS');
    console.log('JWT authentication + active-account enforcement: PASS');
    console.log('Cross-tenant API denial: PASS');
    console.log('PostgreSQL RLS foreign-tenant denial: PASS');
    console.log('Redis readiness/rate-limit backend: PASS');
    console.log('Transactional outbox + payload-bound idempotency: PASS');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await Promise.allSettled([closeDatabase(), closeRedis()]);
  }
}

main().catch(async (error) => {
  console.error('BACKEND-INTEGRATION: FAIL', error);
  await Promise.allSettled([closeDatabase(), closeRedis()]);
  process.exit(1);
});
