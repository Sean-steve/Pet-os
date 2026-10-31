# Pet OS

Pet OS is a unified pet-lifecycle operating platform prototype. The repository currently implements the architecture and interactive domain consoles through **Sprint 38 — Backend Migration & Production Infrastructure Foundation**.

The platform includes Pet identity and lifecycle, health, preventive care, nutrition, training, activity, professional services and bookings, finance, tracking and Lost Pet recovery, community, rescue/adoption, professional workspaces, reviews/reputation, subscriptions, tracker connectivity, Provider SaaS, marketplace commerce, governed Pet Intelligence & AI, human-confirmed cross-domain automation/action orchestration, a unified Command Center with authorized cross-domain search, Today, household pulse and action inbox, a scoped Developer Platform for connected apps, minimized read APIs and signed webhooks, governed analytics, descriptive outcome indicators and operations intelligence, privacy-safe engagement, activation and adoption intelligence that explicitly excludes attention-capture metrics, a shared Security, Privacy & Compliance control plane for sensitive-action step-up, privacy rights, retention, incident response and compliance evidence, plus resilience policies, circuit breakers, recovery objectives, restore drills and CI-enforced performance budgets, followed by a full-system certification layer that validates all nine workspaces, cross-role continuity, tenant isolation and canonical Booking → Finance linkage. Sprint 37 closes legacy TypeScript/API drift and defines explicit production boundaries. Sprint 38 begins the real migration with PostgreSQL-backed Identity/Household/Pet Core persistence, authenticated server APIs, Redis runtime services, transactional idempotency/outbox semantics, production containers and real database/cache CI integration.

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

This performs strict TypeScript validation, all unified sprint regression suites, full-system certification, Sprint 37 readiness checks, the backend production bundle, the production Vite build and performance-budget validation. CI additionally runs the Sprint 38 PostgreSQL/Redis backend integration path.

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
