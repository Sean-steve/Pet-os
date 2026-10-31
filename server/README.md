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
