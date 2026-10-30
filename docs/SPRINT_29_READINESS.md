# Sprint 29 — Cross-Domain Automation & Action Orchestration

## Status

Implemented in the Pet OS prototype.

## Core architecture

Sprint 29 introduces an Automation & Action Orchestration bounded context. It coordinates commands but does not own Care, Health, Booking, Finance, Tracking, Lost Pet, Community, Commerce, Identity or AI source-of-truth records.

Implemented primitives:

- ActionDefinition / strict Action Registry
- ActionProposal
- ActionPreview
- AutomationPolicyDecision
- ActionConfirmation
- ApprovalRequest
- WorkflowDefinition / WorkflowInstance / WorkflowStep
- ExecutionAttempt
- CompensationRecord
- AutomationRule / AutomationRuleVersion
- ScheduledAction
- OrchestrationIncident

## Action execution path

1. Propose an allowlisted action.
2. Build a human-readable preview with exact target, effects, privacy impact, warnings and money context where relevant.
3. Bind the preview to a target-state fingerprint.
4. Evaluate origin, household membership, Pet scope, risk and action policy.
5. Require standard confirmation, strong reauthentication, approval, or no confirmation according to action risk.
6. Recheck authorization and target state at execution time.
7. Execute only through the owning domain service.
8. Record idempotent workflow, step and attempt state.
9. Compensate a prior successful step only when a truthful semantic/domain reversal exists.
10. Surface partial failure/manual recovery rather than inventing rollback.

## Allowlisted actions

- CARE_CREATE_OWNER_TASK
- CARE_SNOOZE_OCCURRENCE
- CARE_COMPLETE_OCCURRENCE
- NOTIFICATION_SCHEDULE_SELF
- BOOKING_CREATE_SERVICE_REQUEST
- LOST_PET_ACTIVATE_COMMUNITY_ALERT
- TRACKING_REQUEST_LOST_MODE
- OPEN_DOMAIN_WORKSPACE

## Hard safety boundaries

Sprint 29 does not register generic actions for:

- payments, payouts, automatic refunds or purchases;
- diagnosis, prescribing, medication dose/frequency changes or clinical signing;
- ownership/access-control mutation;
- exact-location publication;
- generic AI-created Community posting;
- destructive or irreversible actions without a dedicated domain-safe contract.

Lost Pet public distribution and tracker Lost Mode require strong reauthentication. The Lost Pet preview explicitly lists public data and excludes exact GPS, phone number, home address, microchip number and BLE-detector identity.

## AI integration

Sprint 28 AI may create an ActionProposal only when the originating governed AI request is completed and belongs to the same actor/household. The AI model does not receive direct write access.

## Automation rules

Standing automation is limited to action definitions that explicitly opt in. Sprint 29 supports low-risk notification/navigation automation with:

- deterministic idempotency keys;
- daily execution caps;
- cycle/depth protection;
- no arbitrary code, eval or SQL;
- authorization recheck at trigger time.

Sensitive Care, Booking, Lost Pet and Tracking writes cannot become unattended standing rules.

## Scheduling

Unattended scheduling is limited to no-confirmation actions. Sensitive, financial, clinical, safety-critical and irreversible actions must return to an interactive confirmation path.

## Compensation truthfulness

Care-task creation and booking creation can use target-domain reversals where legal. Tracker Lost Mode may request NORMAL mode as a semantic reversal. Notifications are not “unsent”; actions without truthful reversal are marked NOT_REQUIRED or MANUAL_REVIEW_REQUIRED.

## UI

Sprint 29 is integrated into the existing multi-sided Pet OS shell. It appears as Automation & Actions / Action Center / Orchestration Safety depending on workspace. No parallel legacy application was introduced.

## Production boundary

This remains an in-browser prototype with in-memory stores. Production execution tokens must be cryptographically signed server-side; target commands, queues/outbox, durable workflow state, retries, approvals and credentials require backend persistence before production launch.

## Next

Sprint 30 should build the unified Pet Command Center, global search, Today view, action inbox and cross-domain navigation/read models on top of the now-connected domains.
