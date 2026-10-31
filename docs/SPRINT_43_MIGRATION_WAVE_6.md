# Sprint 43 — Migration Wave 6: Commerce, Integrations, AI, Automation & Analytics

## Verdict

`WAVE_6_DURABLE_PLATFORM_AUTHORITY_COMPLETE`

Wave 6 completes the six planned Pet OS backend domain migration waves. This is durable repository-level server authority, not production certification.

## Commerce

Commerce now persists verified sellers, moderated products/SKUs/listings, inventory, reservations, checkouts, orders, seller-order splits, payments and fulfillment state.

Authoritative invariants:
- client-provided prices are ignored;
- integer minor-unit pricing is read from active server listings;
- inventory is locked and reserved before checkout;
- reservations prevent overselling;
- live animals cannot become marketplace products;
- prescription-restricted and prohibited products cannot become active open-market listings;
- successful Commerce payment settlement must match server amount/currency;
- Commerce payments post balanced journals into the existing Finance ledger;
- sellers see only authorized Seller Order state;
- buyers receive masked shipping-address projections, never stored ciphertext.

## Integrations

Developer apps require platform review before installation.

Household installations grant only an approved subset of:
- `pet:profile:read`
- `care:read`
- `booking:read`
- `tracker:health:read`
- `command-center:read`
- `webhook:manage`

API credentials are returned once and stored only as SHA-256 hashes. External endpoints expose projections rather than canonical sensitive records. Exact location, clinical write authority, money movement, purchase execution, ownership mutation and orchestration execution are not grantable scopes.

Webhook subscriptions require HTTPS. Public integration event payloads reject exact-location and access-secret material. Delivery state is durable with retry/dead-letter lifecycle fields; the network delivery worker remains production closure work.

## AI

AI now has durable consent, governed request, safety decision, response provenance and recommendation state.

The server:
- verifies Household/Pet access;
- requires use-case-specific consent scopes;
- assembles bounded context references from canonical domains;
- excludes raw clinical bodies and exact recovery coordinates from the Wave 6 context path;
- persists the prompt/model/policy/safety decision used;
- deterministically blocks detected emergency requests from provider inference;
- requires a trusted AI adapter for provider completion;
- keeps AI recommendations non-authoritative until canonical domain action is separately authorized.

The ordinary runtime role cannot insert authoritative AI requests/responses/recommendations directly.

## Automation

Automation now persists:
- canonical action definitions;
- rules and immutable rule versions;
- action proposals;
- preview hashes and target fingerprints;
- confirmation bindings;
- execution attempts.

Database and service policy prevent rule automation from selecting actions that are not approved for autonomous triggering. Actions requiring confirmation cannot bypass it. Confirmations are actor-bound, hash-bound, time-limited and one-use. Authorized mutations are queued through the transactional outbox and must be explicitly settled by a trusted execution worker.

## Analytics

Analytics snapshots are generated server-side from canonical database stores.

Audiences:
- Household
- Provider
- Platform Operations

Persisted snapshots contain derived metrics, outcome indicators, operational signals, provenance and disclaimers. Exact tracker coordinates, raw clinical notes, access secrets, credentials and payment instruments are excluded.

The ordinary runtime role cannot fabricate analytics snapshots.

## Domain migration status

- Wave 1 — Identity, Household, Pet Core: complete
- Wave 2 — Health, Care, Nutrition, Training, Activity: complete
- Wave 3 — Provider, Booking, Professional Care, Reviews: complete
- Wave 4 — Finance, Subscriptions, Provider SaaS: complete
- Wave 5 — Tracking, Transport, Recovery, Community: complete
- Wave 6 — Commerce, Integrations, AI, Automation, Analytics: complete

## Production closure still required

Completing all six domain migration waves does **not** make Pet OS production ready.

Still required:
- frontend API-adapter cutover from browser/in-memory stores;
- durable outbox, webhook and automation workers with retry/DLQ/replay operations;
- live payment, tracker and AI provider credentials/signature validation;
- production secrets/KMS and object storage where required;
- observability, SLOs and alerting;
- backup/restore and disaster-recovery evidence;
- load/soak testing;
- browser/device/accessibility E2E certification;
- independent security evidence.

GitHub Pages remains the static prototype UI until frontend runtime adapters are switched to the server APIs.
