# Sprint 28 — Pet Intelligence & AI Platform

## Status

Implemented as the governed AI bounded context for the Pet OS prototype.

## What is implemented

- Model definition and deployment registries.
- Risk- and sensitivity-aware model routing.
- Approved prompt templates and immutable prompt versions.
- Scoped AI consent for general, Pet, Health, Location and professional context.
- Household/Pet authorization before context retrieval.
- Pet context assembly from canonical Pet Core, Health, Care, Nutrition, Training, Activity, Tracking and Lost Pet sources.
- Provenance references, freshness metadata and explicit exclusion of exact coordinates from ordinary AI context.
- Deterministic emergency and high-risk safety classification.
- Emergency responses for breathing distress, poisoning, major trauma and seizure-like events.
- Medication dose-change and prescribing boundaries.
- Prompt-injection detection and retrieved-content trust boundary.
- Post-generation output validation.
- Non-destructive recommendation engine using canonical due-state evidence.
- Recommendation deduplication and snooze semantics that do not mutate canonical care due dates.
- AI conversations and responses stored separately from canonical Pet records.
- Model kill-switch behavior and no unsafe high-risk fallback.
- AI incidents and event envelopes.
- Golden evaluation cases and release-gate execution.
- Sprint 28 operations console and unified multi-sided AI workspace.

## Static prototype model policy

GitHub Pages is a public static deployment. It MUST NOT contain production model-provider secrets.

For this reason Sprint 28 uses the `PET_OS_DETERMINISTIC_DEMO` provider adapter in the browser. It exercises the complete governance path while keeping model calls local and deterministic.

A production external-model adapter must be server-side and may only be enabled after:

1. authenticated backend APIs exist;
2. provider credentials are stored server-side;
3. provider retention/training/region policies are configured;
4. health/location sensitivity routing is enforced;
5. the critical evaluation suite passes for that deployment.

## Source-of-truth rule

AI output is never canonical Pet truth. Pet Core, Health, Care, Nutrition, Training, Activity, Tracking, Lost Pet, Booking, Finance, Reviews and Commerce remain authoritative for their own records.

## Sprint 29 boundary

Sprint 29 may introduce cross-domain action orchestration, but state-changing AI tools must remain explicit, authorized, previewed and human-confirmed.
