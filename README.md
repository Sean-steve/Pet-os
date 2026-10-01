# Pet OS

Pet OS is a unified pet-lifecycle operating platform prototype. The repository currently implements the architecture and interactive domain consoles through **Sprint 27 — Marketplace Commerce**.

The platform includes Pet identity and lifecycle, health, preventive care, nutrition, training, activity, professional services and bookings, finance, tracking and Lost Pet recovery, community, rescue/adoption, professional workspaces, reviews/reputation, subscriptions, tracker connectivity, Provider SaaS, and marketplace commerce.

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

This performs TypeScript validation, the unified sprint regression suites, and the production Vite build.

## Build

```bash
npm run build
```

The static app is written to `dist/`.

## GitHub Pages

The repository contains a GitHub Actions workflow that validates and deploys the current interactive prototype to GitHub Pages from `main`.

## Current engineering status

See `docs/DEVELOPMENT_STATUS.md` for the current architectural assessment and the path from Sprint 27 into the remaining sprints.

## Architecture rules

See `AGENTS.md` before implementing a new sprint. Pet OS is one platform: new domains must extend the canonical model rather than create isolated prototypes or duplicate sources of truth.
