# Pet OS Production Backend Foundation

Sprint 38 introduces the first durable server-side slice for Pet OS.

## Implemented in this slice

- PostgreSQL persistence for users, households, memberships and Pet Core records.
- Server-side tenant authorization for household-scoped Pet reads and writes.
- JWT verification using either a production JWKS endpoint or a minimum-32-byte HMAC secret for controlled environments.
- Redis-backed API rate limiting and readiness checks.
- Transactional Pet registration with an idempotency record and an outbox event written in the same PostgreSQL transaction.
- Docker production topology for API, PostgreSQL and Redis.
- CI integration tests against real PostgreSQL and Redis services.

## API

- `GET /health/live`
- `GET /health/ready`
- `GET /v1/me/households`
- `GET /v1/households/:householdId/pets`
- `POST /v1/households/:householdId/pets` with `Idempotency-Key`

All `/v1` routes require a valid Bearer token. The token subject is the canonical Pet OS user ID.

## Important boundary

This is the first production backend migration slice, not completion of the full migration. Health, booking, finance, tracking, professional care, commerce, subscriptions and the remaining bounded contexts still use prototype stores until migrated in later backend phases.

## Sprint 39 — Migration Wave 2

The backend now persists Pet-specific Health, Care, Nutrition, Training and Activity state in five separate PostgreSQL stores. Each domain exposes authenticated Pet-scoped create/list/detail APIs; Care, Nutrition, Training and Activity also expose optimistic versioned amendments, while Health uses append-only correction records. All five tables are protected by tenant authorization and RLS and are covered by the real `backend:wave2-integration` CI gate.

## Sprint 40 — Migration Wave 3

Provider profiles/businesses/service offerings, Booking, Professional Care and verified-service Reviews now have relational PostgreSQL authority. Booking price/service snapshots are server-derived, active provider time conflicts are serialized by PostgreSQL advisory locks, Professional Care can only originate from confirmed/in-progress Bookings, and Review eligibility is generated only from completed Bookings. Provider execution writes are separated from owner read access, and providers cannot mutate customer Reviews.
