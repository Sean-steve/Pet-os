import type { PoolClient } from 'pg';
import { asPetId, generateUUIDv7 } from '../../src/pet-os/kernel/ids';

export interface CreatePetInput {
  householdId: string;
  actorUserId: string;
  idempotencyKey: string;
  name: string;
  speciesCode: string;
  breedCode: string;
  primaryColor: string;
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN';
  reproductiveStatus?: string;
  sizeClassification?: string;
}

export interface PersistedPet {
  petId: string;
  householdId: string;
  name: string;
  speciesCode: string;
  breedCode: string;
  primaryColor: string;
  sex: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

const mapPet = (row: any): PersistedPet => ({
  petId: row.pet_id,
  householdId: row.household_id,
  name: row.name,
  speciesCode: row.species_code,
  breedCode: row.breed_code,
  primaryColor: row.primary_color,
  sex: row.sex,
  status: row.status,
  version: row.version,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

export async function listHouseholdsForUser(client: PoolClient, userId: string) {
  const result = await client.query(
    `SELECT h.household_id, h.name, h.owner_user_id, h.status, h.timezone, h.created_at, h.updated_at
       FROM households h
       JOIN household_members hm ON hm.household_id = h.household_id
      WHERE hm.user_id = $1 AND hm.status = 'ACTIVE' AND h.status = 'ACTIVE'
      ORDER BY h.created_at ASC`,
    [userId],
  );
  return result.rows.map((row) => ({
    householdId: row.household_id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    status: row.status,
    timezone: row.timezone,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
}

export async function assertHouseholdMembership(client: PoolClient, householdId: string, userId: string, write = false) {
  const result = await client.query(
    `SELECT role FROM household_members
      WHERE household_id = $1 AND user_id = $2 AND status = 'ACTIVE'
      LIMIT 1`,
    [householdId, userId],
  );
  if (!result.rowCount) throw Object.assign(new Error('HOUSEHOLD_ACCESS_DENIED'), { statusCode: 403 });
  const role = result.rows[0].role as string;
  if (write && !['HOUSEHOLD_OWNER', 'HOUSEHOLD_ADMIN', 'CAREGIVER'].includes(role)) {
    throw Object.assign(new Error('HOUSEHOLD_WRITE_DENIED'), { statusCode: 403 });
  }
  return role;
}

export async function listPetsForHousehold(client: PoolClient, householdId: string, userId: string): Promise<PersistedPet[]> {
  await assertHouseholdMembership(client, householdId, userId);
  const result = await client.query(
    `SELECT pet_id, household_id, name, species_code, breed_code, primary_color, sex, status, version, created_at, updated_at
       FROM pets WHERE household_id = $1 ORDER BY created_at DESC`,
    [householdId],
  );
  return result.rows.map(mapPet);
}

export async function createPet(client: PoolClient, input: CreatePetInput): Promise<{ pet: PersistedPet; replayed: boolean }> {
  await assertHouseholdMembership(client, input.householdId, input.actorUserId, true);
  const scope = `pet:create:${input.householdId}`;
  const existing = await client.query(
    `SELECT response_body FROM idempotency_records
      WHERE actor_user_id = $1 AND scope = $2 AND idempotency_key = $3`,
    [input.actorUserId, scope, input.idempotencyKey],
  );
  if (existing.rowCount) return { pet: existing.rows[0].response_body as PersistedPet, replayed: true };

  const petId = asPetId(`pet-${generateUUIDv7()}`);
  const inserted = await client.query(
    `INSERT INTO pets (
      pet_id, household_id, name, species_code, breed_code, mixed_breed, unknown_breed, sex,
      reproductive_status, birthdate_precision, estimated_birthdate, primary_color, size_classification,
      lifecycle_stage, status, created_by, metadata, version
    ) VALUES ($1,$2,$3,$4,$5,false,false,$6,$7,'UNKNOWN',true,$8,$9,'ADULT','ACTIVE',$10,'{}'::jsonb,1)
    RETURNING pet_id, household_id, name, species_code, breed_code, primary_color, sex, status, version, created_at, updated_at`,
    [
      petId,
      input.householdId,
      input.name,
      input.speciesCode,
      input.breedCode,
      input.sex,
      input.reproductiveStatus || 'UNKNOWN',
      input.primaryColor,
      input.sizeClassification || 'MEDIUM',
      input.actorUserId,
    ],
  );
  const pet = mapPet(inserted.rows[0]);

  await client.query(
    `INSERT INTO outbox_events (event_id, aggregate_type, aggregate_id, event_type, payload)
     VALUES ($1,'Pet',$2,'PetRegistered',$3::jsonb)`,
    [
      `evt-${generateUUIDv7()}`,
      pet.petId,
      JSON.stringify({ petId: pet.petId, householdId: pet.householdId, actorUserId: input.actorUserId, version: pet.version }),
    ],
  );

  await client.query(
    `INSERT INTO idempotency_records (actor_user_id, scope, idempotency_key, resource_id, response_status, response_body)
     VALUES ($1,$2,$3,$4,201,$5::jsonb)`,
    [input.actorUserId, scope, input.idempotencyKey, pet.petId, JSON.stringify(pet)],
  );

  return { pet, replayed: false };
}
