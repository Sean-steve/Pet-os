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

This backend is being migrated in bounded waves. Identity/Household/Pet Core, longitudinal care domains, the professional-service lifecycle, and money/billing authority are now durable. Tracking/Transport/Recovery/Community, Commerce and later platform domains still require durable migration, and the static frontend still requires API-adapter cutover.

## Sprint 39 — Migration Wave 2

The backend now persists Pet-specific Health, Care, Nutrition, Training and Activity state in five separate PostgreSQL stores. Each domain exposes authenticated Pet-scoped create/list/detail APIs; Care, Nutrition, Training and Activity also expose optimistic versioned amendments, while Health uses append-only correction records. All five tables are protected by tenant authorization and RLS and are covered by the real `backend:wave2-integration` CI gate.

## Sprint 40 — Migration Wave 3

Provider profiles/businesses/service offerings, Booking, Professional Care and verified-service Reviews now have relational PostgreSQL authority. Booking price/service snapshots are server-derived, active provider time conflicts are serialized by PostgreSQL advisory locks, Professional Care can only originate from confirmed/in-progress Bookings, and Review eligibility is generated only from completed Bookings. Provider execution writes are separated from owner read access, and providers cannot mutate customer Reviews.

## Sprint 41 — Migration Wave 4

Finance, consumer Subscriptions and Provider SaaS now use durable PostgreSQL authority. Payment and payout amounts are server-derived, posted double-entry journals are immutable, provider earnings and refunds are reconciled through trusted adapter routes, and plan prices/entitlements are server-owned. Provider SaaS restriction creates bounded continuity grants for active Professional Care so billing failure cannot interrupt custody/service. Internal settlement routes require `BILLING_ADAPTER_SECRET`; real provider credentials/signature verification remain a production integration requirement.

## Sprint 42 — Migration Wave 5

Tracking, Transport, Recovery and Community now use durable PostgreSQL authority. Exact location is ingested only through the trusted `LOCATION_ADAPTER_SECRET` boundary and stored in Tracking/Recovery private tables. Transport stores coarse stop projections plus encrypted exact-address references and append-only custody records. Lost Pet recovery derives last-known location from Tracking and publishes coarse-only public profiles; Community rejects structured exact location and requires recovery-relay opt-in for volunteers. Real device-provider credentials/signature verification and asynchronous ingestion workers remain production integration requirements.

## Sprint 43 — Migration Wave 6

Commerce, Integrations, AI, Automation and Analytics now use durable PostgreSQL server authority. Commerce uses server pricing and inventory reservations and posts payment continuity to Finance. Integration credentials are hash-only and scope-bound. AI persists consent, safety decisions and provenance while remaining non-authoritative. Automation persists policy, confirmation and execution state. Analytics snapshots are server-derived and privacy-minimized. All six planned backend domain migration waves are complete; production still requires frontend API cutover, durable async workers, live provider credentials/signature verification and deployed observability/security/backup/DR evidence.
