# Sprint 32 — Analytics, Outcomes & Operations Intelligence

## Status

Implemented in the Pet OS prototype.

## Purpose

Sprint 32 provides governed analytical projections over Pet OS canonical domains. It does not become a source of truth for Care, Health, Activity, Booking, Finance, Tracking, Reviews, Integrations, Notifications or Orchestration.

## Audiences

### Household
Authorized active household members can see:

- Care completion/adherence rate.
- Activity minutes.
- Completed training sessions.
- Service-booking completion.
- Notification delivery.
- Sprint 29 action execution reliability.
- Current tracker connectivity readiness.
- Descriptive household outcome indicators and operational alerts.

### Provider
A Provider can see only their own provider analytics:

- Booking volume.
- Booking completion/no-show/cancellation rates.
- Published verified-service review rating.
- Provider available earnings from the authoritative Finance read model.

Provider earnings are not reconstructed from booking prices.

### Platform Operations
Only an active Sprint 31 platform reviewer may access platform-wide operational analytics:

- Booking volume/completion.
- Notification delivery.
- Sprint 29 orchestration reliability.
- Sprint 31 webhook delivery.
- Active developer apps/installations.
- Dead letters and denied integration access.

## Analytics contract

Every metric contains:

- stable metric ID;
- human label;
- value/unit;
- optional numerator and denominator;
- prior-period value where meaningful;
- deterministic direction;
- formula definition;
- canonical source name;
- generation timestamp.

The analytics window is bounded to a maximum of 366 days.

## Outcomes safety

Outcome indicators are descriptive operational signals only. They must not be interpreted as:

- a diagnosis;
- medical advice;
- treatment effectiveness;
- causal proof;
- credential verification;
- reconstructed financial truth.

Examples:

- Care consistency describes task execution, not clinical health.
- Activity engagement describes recorded minutes, not a veterinary exercise prescription.
- Training engagement describes completed sessions, not behavioral efficacy.
- Provider review averages describe customer experience and do not verify professional credentials.

## Privacy boundaries

Sprint 32 excludes:

- latitude/longitude and route history;
- tracker vendor hardware identifiers;
- raw clinical notes and prescription content;
- household access secrets;
- payment instruments;
- microchip identifiers;
- arbitrary cross-household detail.

## Finance boundary

Provider money figures are read from `FinanceStore.getProviderFinancialSummary()`. Analytics does not rebuild balances, revenue or payouts from Booking or Commerce records.

## Trends

Metric series are recomputed using the same authorized metric definitions for bounded time buckets. No separate analytics truth is persisted.

## UI

Sprint 32 is integrated into the unified Pet OS shell as **Analytics & Outcomes** across all workspaces. The dashboard supports Household, Provider and Platform Operations perspectives and drill-down navigation back to canonical modules.

## Production boundary

The current repository remains an in-memory/browser prototype. Production analytics requires:

- durable event/read-model infrastructure;
- incremental aggregation jobs;
- warehouse/lakehouse governance where justified;
- row/tenant-level authorization at query time;
- metric-definition versioning;
- retention and deletion propagation;
- privacy-preserving exports;
- observability and freshness SLAs;
- secure server-side provider/platform analytics.

## Next

Sprint 33 should build Engagement & Platform Intelligence without turning behavioral telemetry into manipulative engagement scoring or bypassing privacy/consent controls.
