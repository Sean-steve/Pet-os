# Sprint 36 — Full-System End-to-End Certification & Cross-Role Workflow Validation

## Status
Implemented as the final prototype-level cross-system certification layer.

## Purpose
Earlier sprints proved individual bounded contexts. Sprint 36 answers a different question: does the unified multi-sided Pet OS still behave as one coherent product when canonical identities, roles and domain records cross boundaries?

## Certified product sides
The certification matrix covers all nine unified workspaces:
1. Pet Parent
2. Professional
3. Provider Business
4. Rescue & Welfare
5. Seller & Commerce
6. Finance & Billing
7. Trust & Operations
8. AI & Intelligence
9. Platform & Engineering

## Cross-domain journeys
The release gate validates:
- owner → household → Pet continuity;
- owner → Command Center projection;
- foreign-tenant denial;
- professional identity → offering → booking;
- booking → professional-care execution;
- booking → payment → immutable receipt → provider earning;
- provider-business → SaaS subscription;
- transport trip → verified driver → verified vehicle → custody;
- rescue intake → custody → adoption/outcome readiness;
- seller → listing → inventory → buyer order;
- consumer/tracker subscriptions;
- verified service → review/reputation;
- governed AI → policy-controlled action registry;
- approved external app → household installation → HTTPS webhook;
- trust authority → security + resilience control plane.

## Canonical finance reconciliation
Sprint 36 closes a prior integration weakness: Finance now participates in the unified seed/reset graph. A canonical confirmed household booking produces a successful prototype payment intent, transaction, receipt, provider earning and verified payout destination using the same Booking and Provider IDs.

This does not replace the Finance domain's 26 accounting/payment tests. It makes their bounded context visible in the cross-system graph.

## Release verdict
The certification service returns `CERTIFIED_PROTOTYPE` only when:
- cross-tenant isolation passes;
- canonical Booking → Finance continuity passes;
- security/resilience control-plane authority passes;
- all nine workspaces are represented;
- no critical cross-domain journey fails.

CI and GitHub Pages execute `npm run certification:check`; a blocked verdict fails the release.

## Production boundary
`CERTIFIED_PROTOTYPE` is not production certification. Production still requires durable server APIs and databases, real payment/provider adapters, mandatory clean TypeScript, browser/device E2E automation, accessibility certification, security testing, load/soak testing and real infrastructure recovery evidence.

## Next
Sprint 37 should be Production Readiness Closure: eliminate legacy TypeScript debt, convert advisory typechecking into a required gate, define real backend/persistence migration boundaries and produce the final production blocker register.
