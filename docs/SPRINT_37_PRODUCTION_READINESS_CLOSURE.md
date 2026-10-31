# Sprint 37 — Production Readiness Closure

## Objective

Sprint 37 closes repository-owned technical debt and establishes the controlled migration boundary from the certified Pet OS browser prototype to a production platform.

The sprint deliberately does **not** claim that Pet OS is production ready. Its terminal repository verdict is:

`CODEBASE_READY_FOR_BACKEND_MIGRATION`

Production readiness remains dependent on backend, infrastructure, external-integration and independent assurance evidence.

## Repository closure

Sprint 37:

- reconciles the legacy UI/API TypeScript drift identified by Sprint 36 CI;
- promotes TypeScript validation from advisory to a mandatory CI and GitHub Pages release gate;
- adds Sprint 37 to the unified regression runner;
- preserves Sprint 36 full-system certification as a mandatory gate;
- preserves production bundle performance budgets;
- adds a machine-readable production-readiness register;
- adds explicit backend migration boundaries;
- exposes Production Readiness across all nine Pet OS workspaces.

## Technical-debt repair set

The pre-Sprint-37 compiler reported 40 errors across older Sprint 4–22 consoles and the Command Center. The repairs align those consoles with current canonical contracts rather than weakening types or adding blanket suppressions.

Reconciled areas include:

- Pet Core DTO fields used by Passport and Booking;
- Finance journal/source enums, Money values, payment initiation, provider webhooks, payout destinations, cancellation and trial balance projections;
- Dog Walking incident fields;
- Community reaction/media/recovery projections and a restored typed leave-group operation;
- Health alert, medication, vaccination, diagnostic, timeline and amendment contracts;
- Care and Nutrition simulated-clock APIs;
- Transport event union rendering;
- Command Center tracker-status union typing.

## Hard release gates

The Sprint 37 release pipeline requires, in order:

1. clean `npm run typecheck`;
2. all unified Sprint 2–37 regression suites;
3. Sprint 36 full-system certification;
4. Sprint 37 production-readiness closure;
5. production Vite build;
6. performance-budget validation.

GitHub Pages uses the same pre-deployment gates.

## Production requirements that remain external

The readiness register keeps these requirements explicitly open until real infrastructure exists:

1. durable transactional databases and migrations;
2. authenticated server APIs and production session security;
3. secrets/KMS;
4. durable queues, schedulers and transactional outbox infrastructure;
5. real payment/provider integrations and reconciliation;
6. production object/media storage;
7. production observability, SLOs, RUM and security telemetry;
8. independent security testing and threat-model closure;
9. browser/device and accessibility automation;
10. load, soak and failure-mode testing;
11. real backups and observed disaster-recovery drills;
12. infrastructure as code and reproducible environments.

## Backend migration boundaries

The migration contract covers:

- Identity, Household & Authorization;
- Pet Core, Health, Care & Professional Records;
- Booking & Finance;
- Events, Jobs & Webhooks;
- Tracking & Transport Telemetry;
- Documents, Photos & Evidence;
- External Integrations;
- Platform Operations.

The governing rule is to preserve canonical IDs and bounded-context ownership while moving authority from browser/in-memory stores into authenticated server-side persistence. No migration may create a second source of truth for an existing domain.

## Certification semantics

`CERTIFIED_PROTOTYPE` from Sprint 36 remains valid for the in-repository multi-role graph.

`CODEBASE_READY_FOR_BACKEND_MIGRATION` from Sprint 37 means repository-owned closure gates are satisfied and the production migration boundary is explicit.

Neither verdict means `PRODUCTION_READY`.

Production certification can only occur after the external requirements above have been implemented and evidenced in real environments.
