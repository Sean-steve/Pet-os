# Pet OS

Pet OS is a unified pet-lifecycle operating platform prototype. The repository currently implements the architecture and interactive domain consoles through **Sprint 41 — Migration Wave 4: Finance, Subscriptions & Provider SaaS**.

The platform includes Pet identity and lifecycle, health, preventive care, nutrition, training, activity, professional services and bookings, finance, tracking and Lost Pet recovery, community, rescue/adoption, professional workspaces, reviews/reputation, subscriptions, tracker connectivity, Provider SaaS, marketplace commerce, governed Pet Intelligence & AI, human-confirmed cross-domain automation/action orchestration, a unified Command Center with authorized cross-domain search, Today, household pulse and action inbox, a scoped Developer Platform for connected apps, minimized read APIs and signed webhooks, governed analytics, descriptive outcome indicators and operations intelligence, privacy-safe engagement, activation and adoption intelligence that explicitly excludes attention-capture metrics, a shared Security, Privacy & Compliance control plane for sensitive-action step-up, privacy rights, retention, incident response and compliance evidence, plus resilience policies, circuit breakers, recovery objectives, restore drills and CI-enforced performance budgets, followed by a full-system certification layer that validates all nine workspaces, cross-role continuity, tenant isolation and canonical Booking → Finance linkage. Sprint 37 closes legacy TypeScript/API drift and defines explicit production boundaries. Sprint 38 establishes the durable server/runtime foundation for Identity, Household and Pet Core. Sprint 39 completes Migration Wave 2 for Health, Care, Nutrition, Training and Activity. Sprint 40 completes Migration Wave 3 by moving Provider identity/offers, Booking, Professional Care execution and verified-service Reviews into relational PostgreSQL authority with cross-party authorization, lifecycle constraints, idempotency, revision history and transactional events. Sprint 41 completes Migration Wave 4 with durable Finance, consumer Subscriptions and Provider SaaS authority, including immutable double-entry journals, server-derived payments/payouts, durable entitlements, billing reconciliation and active-service continuity safeguards.

## Run locally

Prerequisite: Node.js 20+.

```bash
npm install
npm run dev
```

The development server runs on port 3000.

## Validate the repository

```bash
npm run check
```

This performs strict TypeScript validation, all unified sprint regression suites, full-system certification, Sprint 37 readiness checks, the backend production bundle, the production Vite build and performance-budget validation. CI additionally runs the real PostgreSQL/Redis integration paths for backend Waves 1–4, including finance, billing, entitlement and reconciliation certification.

## Build

```bash
npm run build
```

The static app is written to `dist/`.

## GitHub Pages

The repository contains a GitHub Actions workflow that validates and deploys the current interactive prototype to GitHub Pages from `main`.

## Current engineering status

See `docs/DEVELOPMENT_STATUS.md` for the current architectural assessment and the Sprint 37 codebase-closure verdict and the remaining backend/infrastructure work required before production certification.

## Architecture rules

See `AGENTS.md` before implementing a new sprint. Pet OS is one platform: new domains must extend the canonical model rather than create isolated prototypes or duplicate sources of truth.

## Sprint 37 readiness verdict

The repository target is **CODEBASE_READY_FOR_BACKEND_MIGRATION**, not production certification. The browser/in-memory prototype still requires durable server persistence, production authentication, real integrations, queues, secrets management, observability, security testing, browser/device/accessibility testing, load testing and observed disaster recovery before a production launch.

## Sprint 38 backend foundation

Migration Wave 1 is implemented for **Identity, Household and Pet Core**. The repository now includes a deployable Express API, PostgreSQL migrations, Redis-backed rate limiting/readiness, transactional outbox/idempotency, Docker production topology and integration tests against real PostgreSQL/Redis services. Later domain waves remain pending; Pet OS is not yet production certified.

## Sprint 39 — Migration Wave 2

Health, Care, Nutrition, Training and Activity now have separate durable PostgreSQL stores and Pet-scoped authenticated APIs. Health remains append-only with correction records; the other four domains use optimistic concurrency plus an immutable revision ledger. CI certifies all five domains against real PostgreSQL/Redis, including cross-tenant API and RLS denial. The GitHub Pages prototype still needs frontend API-adapter cutover before browser workflows are production-backed.

## Sprint 40 — Migration Wave 3

Provider, Booking, Professional Care and Reviews now have durable cross-party server authority. The server captures Booking snapshots from verified active offerings, serializes provider time conflicts, prevents Booking completion before linked care completion, derives Review eligibility from completed Bookings, and prevents providers from modifying customer Reviews. The Pages UI still requires API-adapter cutover before its interactive workflows use these production stores.

## Sprint 41 — Migration Wave 4

Finance, consumer Subscriptions and Provider SaaS now have durable PostgreSQL-backed server authority. Booking payment amounts, commissions, payout amounts and subscription prices are server-derived; posted ledger journals are balanced and immutable; consumer/provider entitlement state is durable; billing/provider reconciliation is persisted; and Provider SaaS billing restriction cannot interrupt active Pet care. Live payment-provider credentials/signature verification and frontend API-adapter cutover remain outside repository certification.
