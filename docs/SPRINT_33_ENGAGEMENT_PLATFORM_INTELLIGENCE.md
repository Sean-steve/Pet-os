# Sprint 33 — Engagement & Platform Intelligence

## Status

Implemented in the Pet OS prototype.

## Purpose

Sprint 33 measures whether Pet OS is helping households, professionals and platform operators reach meaningful product outcomes. It is not an attention-maximization system.

The bounded context combines:

- canonical domain milestones;
- consent-aware product telemetry;
- activation funnels;
- meaningful-value adoption breadth;
- workflow completion/continuity;
- aggregate platform product-health signals.

## Core rule

Engagement success is defined by meaningful product value, not by time spent.

The following are explicitly excluded from success calculations:

- session duration;
- time spent;
- click volume;
- page-view volume;
- streaks;
- notification-open pressure;
- compulsive return frequency;
- endless-scroll behavior;
- dark-pattern conversion pressure.

Navigation telemetry may be collected when the user has opted in, but navigation never counts as meaningful engagement or activation.

## Consent model

Optional product analytics is controlled by a per-user telemetry preference.

When disabled:

- new EngagementStore product events are rejected;
- canonical Pet OS features continue working;
- household and provider adoption milestones remain available because they are derived from their authoritative domains;
- no loss of core functionality occurs.

## Event contract

Sprint 33 stores only a minimized event envelope:

- actor ID;
- optional household/provider scope;
- event kind;
- meaningful area;
- bounded event name;
- timestamp;
- optional workflow correlation ID;
- optional workflow state;
- surface;
- idempotency key.

There is no arbitrary payload field.

EngagementStore does not capture:

- free-form user text;
- search queries;
- private messages;
- health-record content;
- prescriptions;
- exact coordinates or route history;
- payment instruments;
- microchip identifiers;
- access secrets.

## Household intelligence

Authorized household members can see:

- capability adoption breadth;
- meaningful VALUE-event count for opted-in telemetry;
- value-active days;
- distinct meaningful product areas;
- observed workflow completion;
- canonical activation milestones for Pet profile, Care, Activity, Training, Booking, Tracking, Automation, Integrations and Commerce.

These are not user scores and are not used to rank households.

## Provider intelligence

A Provider can see only their own provider scope:

- business capability adoption;
- meaningful provider VALUE events;
- value-active days;
- workflow completion;
- milestones for verification, active offerings, first booking, completed service, verified-service review and authoritative Finance earnings.

Provider engagement does not replace credential verification or service-quality review domains.

## Platform intelligence

Platform access requires the existing Sprint 31 platform-review authority.

Platform views are aggregate only and include:

- activated Pet households;
- activation rate;
- connected-capability adoption;
- optional telemetry opt-in rate;
- opted-in value-active household count;
- observed workflow completion;
- activation funnel across Pet profile, Care setup, meaningful workflow evidence and connected capability;
- telemetry coverage and workflow-dropoff diagnostics.

Platform intelligence does not expose user-level engagement rankings.

## Action boundary

Engagement signals never authorize or execute:

- notifications;
- purchases;
- personalized ranking changes;
- automated recommendations;
- pricing changes;
- subscription changes;
- state-changing actions.

Any future action remains governed by the owning domain and Sprint 29 authorization/confirmation rules.

## Relationship to Sprint 32

Sprint 32 answers: “What operational outcomes and metrics are occurring?”

Sprint 33 answers: “Are users and organizations reaching meaningful product value, and where are workflows failing to reach completion?”

Both are read/intelligence layers. Neither becomes canonical business truth.

## UI

Sprint 33 is integrated into the unified multi-sided Pet OS shell as **Engagement & Platform Intelligence** across all workspaces.

Views:

- Household
- Provider
- Platform Operations

The UI includes:

- meaningful adoption cards;
- activation funnel;
- canonical milestone grid;
- workflow/product-health signals;
- telemetry preference control;
- engagement safety contract;
- provenance.

## Production boundary

The repository remains an in-memory/browser prototype.

Production implementation requires:

- server-side telemetry collection;
- signed event ingestion;
- schema/version registry;
- consent propagation;
- deletion/retention enforcement;
- tenant isolation;
- event deduplication;
- warehouse/read-model governance;
- aggregate privacy thresholds;
- sampling/freshness monitoring;
- metric-definition versioning;
- auditability;
- documented experimentation ethics.

## Next

Sprint 34 should begin Security, Privacy & Compliance Hardening across the full Pet OS surface.
