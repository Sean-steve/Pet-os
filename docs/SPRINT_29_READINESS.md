# Sprint 29 Readiness — Cross-Domain Automation & Action Orchestration

## Baseline

Sprint 28 is implemented and the user-facing/operational UI is now unified. Sprint 29 must extend this baseline rather than introduce another standalone console.

## Sprint 29 must build on

- Identity, Household and resource-aware authorization.
- Canonical bounded-context ownership through Sprint 28.
- Event/outbox architecture and idempotency patterns.
- Finance transaction and reconciliation boundaries.
- Booking/service execution state machines.
- Care, Nutrition, Training, Activity, Tracking, Lost Pet and professional workspaces.
- Consumer, tracker and Provider SaaS entitlement services.
- Governed AI context, consent, model routing, safety, provenance and evaluation.
- Unified multi-sided SaaS workspace shell.

## Required orchestration architecture

Sprint 29 should introduce an explicit Automation / Action Orchestration bounded context with:

- ActionIntent
- ActionPlan
- ActionStep
- ActionPolicyDecision
- ApprovalRequest
- ConfirmationSnapshot
- ExecutionAttempt
- CompensationPlan
- AutomationRule
- ScheduledAction
- ActionAudit
- OrchestrationIncident

## Non-negotiable boundaries

1. AI proposes; domain services decide.
2. No model directly writes canonical records.
3. Every state-changing command is server/domain validated.
4. High-impact actions require explicit preview and human confirmation.
5. Financial, clinical, Lost Pet, ownership, access-control and destructive actions require stronger policy gates.
6. Cross-domain workflows must use public domain commands/contracts, not direct store mutation.
7. Every step is idempotent and replay-safe.
8. Partial failure must be observable and compensatable where possible.
9. Automation may never bypass entitlement, authorization, consent, clinical safety or continuity protections.
10. The UI must stay inside the unified Pet OS shell.

## Initial target workflows

- AI recommendation -> user confirms -> create canonical care task.
- AI suggestion -> user confirms -> open Booking flow for a Vet/Trainer/Groomer.
- Missed care -> household approval -> reschedule reminder without altering original clinical due date.
- Lost Pet incident -> user-approved community distribution and tracker mode request.
- Provider SaaS continuity -> permit minimum safe active-service actions while premium operations remain restricted.
- Commerce return -> approved return state -> Finance refund request -> reconciliation.
- Tracker issue -> owner confirms troubleshooting/action request -> Device/Connectivity domain handles it.
- Professional AI draft -> professional reviews -> explicit sign/commit into canonical workspace.

## UI contract

Sprint 29 should appear as a first-class Automation / Actions module in the relevant workspace and as a cross-platform operations view where appropriate. It must use the same sidebar, workspace switcher, module header, sibling navigation, forms, confirmations and status surfaces introduced by the seamless integration pass.

## Ready state

The repository is ready for Sprint 29 once CI, regression tests and production build remain green after the seamless module integration is merged.
