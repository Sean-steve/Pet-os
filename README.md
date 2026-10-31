# Pet OS

Pet OS is a unified pet-lifecycle operating platform prototype. The repository currently implements the architecture and interactive domain consoles through **Sprint 37 — Production Readiness Closure**.

The platform includes Pet identity and lifecycle, health, preventive care, nutrition, training, activity, professional services and bookings, finance, tracking and Lost Pet recovery, community, rescue/adoption, professional workspaces, reviews/reputation, subscriptions, tracker connectivity, Provider SaaS, marketplace commerce, governed Pet Intelligence & AI, human-confirmed cross-domain automation/action orchestration, a unified Command Center with authorized cross-domain search, Today, household pulse and action inbox, a scoped Developer Platform for connected apps, minimized read APIs and signed webhooks, governed analytics, descriptive outcome indicators and operations intelligence, privacy-safe engagement, activation and adoption intelligence that explicitly excludes attention-capture metrics, a shared Security, Privacy & Compliance control plane for sensitive-action step-up, privacy rights, retention, incident response and compliance evidence, plus resilience policies, circuit breakers, recovery objectives, restore drills and CI-enforced performance budgets, followed by a full-system certification layer that validates all nine workspaces, cross-role continuity, tenant isolation and canonical Booking → Finance linkage. Sprint 37 then closes legacy TypeScript/API drift, makes typechecking mandatory and defines explicit backend migration boundaries plus the remaining production-infrastructure requirements.

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

This performs strict TypeScript validation, all unified sprint regression suites, full-system certification, Sprint 37 production-readiness closure, the production Vite build and performance-budget validation.

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
