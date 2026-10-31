# Sprint 38 — Backend Migration & Production Infrastructure Foundation

## Objective

Sprint 38 converts the Sprint 37 migration boundary into the first real server-side production foundation.

The sprint does **not** claim that the entire Pet OS is production migrated. It establishes the durable runtime and completes Migration Wave 1:

- Identity
- Household
- Pet Core

The repository verdict for this sprint is:

`BACKEND_FOUNDATION_READY_FOR_DOMAIN_MIGRATION`

## Production foundation implemented

### PostgreSQL

Migration-managed tables now exist for:

- users
- households
- household memberships
- pets
- idempotency records
- transactional outbox events
- schema migration history

Tenant-aware indexes and PostgreSQL row-level security policies are included as defense in depth. Server repository methods still enforce household membership explicitly before Pet reads or writes.

### Authenticated server API

A dedicated Express server now provides:

- `GET /health/live`
- `GET /health/ready`
- `GET /v1/me/households`
- `GET /v1/households/:householdId/pets`
- `POST /v1/households/:householdId/pets`

All `/v1` routes require a verified Bearer token.

The verifier supports:

- a trusted JWKS URL for external/OIDC identity providers; or
- a controlled HMAC verifier for local/test environments.

The token subject is treated as the canonical Pet OS user ID. The browser cannot select a different actor through request payloads.

### Server-side tenant authorization

Household membership is resolved on the server before household-scoped Pet operations.

Write authorization is limited to:

- HOUSEHOLD_OWNER
- HOUSEHOLD_ADMIN
- CAREGIVER

VIEW_ONLY and foreign users cannot create Pet records.

### Idempotency and transactional outbox

Pet registration requires an `Idempotency-Key`.

Within one PostgreSQL transaction the API writes:

1. the new Pet aggregate;
2. a `PetRegistered` outbox event;
3. the idempotency response record.

A repeated request with the same actor/scope/key replays the existing result instead of creating a duplicate aggregate or duplicate event.

### Redis

Redis is now a real runtime dependency for:

- readiness;
- per-user API rate limiting.

If Redis is unavailable, protected requests fail closed rather than silently bypassing the rate limiter.

### Container topology

`Dockerfile` builds the backend into production ESM bundles.

`docker-compose.production.yml` defines:

- PostgreSQL 17
- Redis 7.4
- Pet OS API

PostgreSQL and Redis use persistent volumes and service health checks. The API only publishes on the loopback interface by default so a reverse proxy can terminate TLS in front of it.

### CI infrastructure certification

GitHub Actions now provisions real PostgreSQL and Redis service containers.

The Sprint 38 backend integration test verifies:

- database migrations;
- PostgreSQL readiness;
- Redis readiness;
- valid JWT access;
- invalid/missing JWT rejection;
- household tenant isolation;
- mandatory idempotency;
- durable Pet persistence;
- idempotent replay;
- exactly one transactional outbox event.

CI also builds the backend production bundle and Docker image before the frontend build.

## Migration waves

### Wave 1 — complete

Identity, Household and Pet Core foundation.

### Wave 2 — pending

Health, Care, Nutrition, Training and Activity.

Goal: migrate longitudinal Pet care data, provenance and scheduling.

### Wave 3 — pending

Provider, Booking, Professional Care and Reviews.

Goal: establish durable professional service lifecycle authority.

### Wave 4 — pending

Finance, consumer subscriptions and Provider SaaS.

Goal: implement production ledger, payment reconciliation and billing authority.

### Wave 5 — pending

Tracking, Transport, Recovery and Community.

Goal: establish durable high-volume event/location ingestion with strict location privacy.

### Wave 6 — pending

Commerce, Integrations, AI, Automation and Analytics.

Goal: complete commercial, developer and intelligence platform migration.

## Remaining production infrastructure

Sprint 38 does not yet certify:

- production OIDC tenant/provider configuration;
- durable outbox workers and dead-letter processing;
- full-domain database migration;
- production payment accounts/reconciliation;
- production object storage;
- managed secrets/KMS;
- production observability and SLOs;
- backup/restore evidence;
- independent penetration testing;
- browser/device/accessibility E2E;
- load/soak/failure testing;
- infrastructure as code for a real cloud/server environment.

These remain required before a `PRODUCTION_READY` claim is possible.
