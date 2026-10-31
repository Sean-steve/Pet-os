# Sprint 39 — Migration Wave 2: Health, Care, Nutrition, Training & Activity

## Objective

Migration Wave 2 moves the five longitudinal Pet-care bounded contexts from browser-only state into durable server authority.

Wave 2 covers:

- Health
- Care
- Nutrition
- Training
- Activity

The repository verdict is:

`WAVE_2_DURABLE_BACKEND_COMPLETE`

This is not a whole-platform `PRODUCTION_READY` claim.

## Durable stores

Each bounded context has a separate PostgreSQL table:

- `health_records`
- `care_records`
- `nutrition_records`
- `training_records`
- `activity_records`

All records are Pet- and Household-scoped, carry a typed `record_type`, timestamp, provenance/status metadata, JSONB domain payload, creator, version and audit timestamps.

The JSONB payload preserves the existing bounded-context vocabulary while the server owns tenant boundaries, write safety, versioning and persistence.

## Health

Supported durable record types:

- CONDITION
- ALLERGY
- ENCOUNTER
- VACCINATION
- MEDICATION
- PROCEDURE
- DIAGNOSTIC_RESULT
- CLINICAL_NOTE
- AMENDMENT
- DOCUMENT_LINK

Health source records are append-only. Corrections are created through a separate amendment record and do not silently mutate the original clinical/owner-observation record.

## Care

Supported durable record types:

- OBLIGATION
- OCCURRENCE
- COMPLETION
- REMINDER_POLICY

Care records support versioned amendments with optimistic concurrency and immutable revision evidence.

## Nutrition

Supported durable record types:

- FEEDING_PLAN
- MEAL_SCHEDULE
- MEAL_OCCURRENCE
- TREAT_LOG
- HYDRATION_LOG
- APPETITE_OBSERVATION
- DIETARY_RESTRICTION
- FOOD_TRANSITION_PLAN

The global Food catalog remains product/configuration data; longitudinal Pet-specific nutrition state is now durable.

## Training

Supported durable record types:

- GOAL
- PLAN
- SESSION
- EXERCISE_ATTEMPT
- SKILL_PROGRESS
- MILESTONE
- EVIDENCE
- BEHAVIOR_OBSERVATION

Global Skill and Program catalogs remain product/configuration data. Pet-specific training state is durable.

## Activity

Supported durable record types:

- ACTIVITY_RECORD
- ACTIVITY_SESSION
- ROUTINE
- OCCURRENCE
- GOAL
- AMENDMENT

Precise GPS data is still not stored in Activity; Tracking remains the location authority and Activity may only carry opaque route references in payloads.

## API contract

Every domain exposes authenticated Pet-scoped routes:

- `GET /v1/pets/:petId/<domain>/records`
- `GET /v1/pets/:petId/<domain>/records/:recordId`
- `POST /v1/pets/:petId/<domain>/records`

Mutable domains also expose:

- `PATCH /v1/pets/:petId/<domain>/records/:recordId`

Health exposes append-only correction:

- `POST /v1/pets/:petId/health/records/:recordId/amendments`

List APIs accept:

- `type=<recordType>`
- `limit=<1..200>`

All `/v1` routes require the Sprint 38 Bearer-token boundary and active account state.

## Write safety

Every create and amendment requires `Idempotency-Key`.

The key is payload-bound. Reusing a key with a different request returns a conflict rather than silently replaying the wrong write.

Care, Nutrition, Training and Activity amendments require:

- `expectedVersion`
- `reason`
- `payloadPatch`
- optional new `status`

A stale `expectedVersion` is rejected with a version conflict.

Every accepted amendment writes an immutable `pet_domain_record_revisions` row containing before/after payload, status, actor, reason and versions.

## Transactional outbox

Every record creation writes a domain outbox event in the same PostgreSQL transaction.

Mutable-domain amendments also write a domain amendment outbox event in the same transaction.

This keeps durable state and future worker/event publication consistent.

## Tenant isolation

The server derives Household scope from the authenticated user's active membership and the target Pet. The request body cannot choose another Household.

Five-domain Row Level Security is enabled as defense in depth using `petos_can_access_pet(...)`.

CI proves:

- foreign-tenant API access is denied;
- a restricted `petos_app` database transaction cannot read another tenant's Health/Care/Nutrition/Training/Activity rows.

## Real integration gate

`npm run backend:wave2-integration` runs against real PostgreSQL and Redis in CI and verifies:

- migrations;
- all five domain create routes;
- payload-bound idempotent replay;
- type-filtered list and record detail;
- cross-tenant API denial;
- RLS denial across all five durable tables;
- versioned amendments for Care/Nutrition/Training/Activity;
- stale-write conflict handling;
- append-only Health amendment;
- immutable revision ledger;
- domain outbox events.

## Remaining migration boundary

The GitHub Pages prototype still uses browser/in-memory stores for its interactive domain consoles. Wave 2 establishes server authority and API contracts, but frontend runtime adapters still need to be switched to the server before browser workflows are production-backed.

Migration Wave 3 is next:

- Provider
- Booking
- Professional Care
- Reviews
