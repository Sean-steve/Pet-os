# Pet OS — Architectural Invariants & Integration Rules

## Core Directive: Single Unified Pet OS
Every sprint is an incremental extension of one unified Pet OS—never a standalone implementation or isolated prototype.

### 1. Unified Domain Integration
- **Preserve & Integrate**: All existing functionality across Sprints 1 through 11 (and beyond) must remain active, interoperable, and continuously verified.
- **Single Canonical Entity Model**:
  - Always reuse canonical entities and strongly-typed IDs from `src/pet-os/kernel/ids.ts` (`UserId`, `HouseholdId`, `PetId`, `ProviderId`, `BusinessId`, `ServiceOfferingId`, `BookingId`, etc.).
  - Re-use canonical reference data and schemas (`PetStore`, `IdentityStore`, `HealthStore`, `CareStore`, `NutritionStore`, `ActivityStore`, `TrainingStore`, `ProviderStore`, `BookingStore`).
  - Never generate duplicate mock IDs or parallel entity models.
- **Zero Regressions Across All Sprint Suites**:
  - All test suites (`src/pet-os/*/tests.ts`) must pass before concluding any turn.
  - Never mock, stub out, or bypass prior domains to make a new sprint pass.

### 2. Pre-Implementation Inspection
Before implementing any new sprint:
1. Inspect current stores, types, events, and service layers.
2. Define explicit integration points with existing domains (Identity, Pet Core, Health, Care, Nutrition, Activity, Training, Provider, Booking).
3. Ensure the UI console (`Header.tsx`, `App.tsx`, domain consoles) preserves navigation and access to all historical sprint tools and inspections.

### 3. Shared Design System & Authentication
- Maintain the unified Dark Studio aesthetic (`#0B0D10` background, high-contrast Slate/Zinc typography, emerald/indigo/amber domain badges, 44px minimum touch targets).
- Maintain shared actor context (`Elena Vance` as household owner, `Sarah Mwangi` / `Dr. Kimani` as service providers) across all consoles.
