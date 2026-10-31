# Sprint 41 — Migration Wave 4: Finance, Subscriptions & Provider SaaS

## Objective

Migration Wave 4 moves money movement, billing state and subscription entitlements into durable server authority.

Wave 4 covers:

- Finance
- Consumer Subscriptions
- Provider SaaS

Repository verdict:

`WAVE_4_DURABLE_MONEY_BILLING_COMPLETE`

This verdict certifies the in-repository money/billing model and real PostgreSQL/Redis integration. It is **not** a claim that live payment-provider accounts or production settlement credentials are configured.

## Finance authority

Booking payments are derived exclusively from the authoritative Wave 3 Booking price snapshot.

The browser may choose a supported payment method/provider, but it cannot submit an authoritative amount.

Durable Finance includes:

- payment intents;
- payment transactions;
- immutable receipts;
- provider earnings;
- payout destinations;
- payouts and earning allocations;
- refunds;
- reconciliation runs/items;
- trusted webhook-event deduplication.

### Double-entry ledger

The durable ledger contains Accounts, Journals and Entries.

Every posted Journal must satisfy:

- total debits > 0;
- total debits = total credits;
- total debits = journal total;
- all entries use the Journal currency.

Posted Journals and Entries are immutable at the PostgreSQL trigger layer.

The ordinary `petos_app` runtime role cannot post Journals or write reconciliation/webhook state. Those operations are restricted to the trusted billing adapter/system transaction boundary.

### Service fulfillment and earnings

A Provider earning can only be finalized after:

1. Booking is COMPLETED;
2. Booking has a successful durable payment.

The current repository commission policy is 15% (1500 basis points). The server derives gross, commission and net amounts.

Service fulfillment posts:

- Debit Customer Prepayments;
- Credit Provider Payable Available;
- Credit Platform Commission.

### Payout safety

Providers may create tokenized payout destinations, but cannot self-verify them.

Payout destination verification is an internal trusted-adapter action.

Payout requests do not accept an amount from the browser. The payout amount is derived from the Provider's AVAILABLE earnings and those earnings are atomically moved to RESERVED_FOR_PAYOUT.

On successful payout the ledger posts the Provider payable release and the earnings become PAID. Failed payouts release reserved earnings back to AVAILABLE.

### Refund safety

Customer refund amounts are derived from the successful charge.

Wave 4 only permits the ordinary owner refund workflow before Provider earning finalization. Once Provider earning exists, the request is rejected and requires a later adjustment/dispute workflow instead of silently corrupting the ledger.

## Trusted billing adapter

External settlement and reconciliation routes are under `/internal/billing/*`.

They require `X-Billing-Adapter-Secret`, compared with constant-time semantics.

This boundary supports:

- payment settlement;
- earning finalization;
- payout destination verification;
- payout settlement;
- refund settlement;
- consumer subscription billing settlement;
- Provider SaaS billing settlement;
- financial-provider reconciliation;
- subscription-provider reconciliation.

This shared secret is an internal adapter boundary for this repository phase. A live production integration still requires real provider credentials, provider-specific signature verification, replay protections and operational reconciliation evidence.

## Consumer Subscriptions

Consumer Plan and Price catalogs are server-owned.

The client selects a plan code, interval and market, but the server derives the price.

Durable Consumer Subscription authority includes:

- subscription lifecycle;
- immutable status history;
- invoices;
- entitlement grants;
- cancellation-at-period-end;
- billing reconciliation.

A successful paid-plan billing event activates the subscription and materializes durable entitlement grants.

The FREE baseline contains safety/core entitlements. Safety-critical access such as core Pet profile and privacy export must not be silently removed because a paid billing event fails.

## Provider SaaS

Provider SaaS Plan and Price catalogs are server-owned.

Durable Provider SaaS includes:

- subscription lifecycle;
- status history;
- invoices;
- entitlements;
- billing-failure counts;
- grace/restricted states;
- active-service continuity grants;
- provider billing reconciliation.

A Provider SaaS subscription can only be managed by the authoritative Provider or Business manager boundary established in Wave 3.

### Active Pet-service continuity

After repeated billing failure, Provider SaaS may enter RESTRICTED and ordinary paid entitlements are revoked.

However, an active Professional Care engagement must not be interrupted because billing failed.

For active engagements, the server creates continuity grants tied to:

- the subscription;
- Provider or Business;
- Professional Care engagement;
- active Pet IDs;
- bounded expiry.

This safety shield remains active until care is safely concluded or the grant expires.

## Reconciliation

Wave 4 persists two classes of reconciliation evidence:

1. Financial provider transaction reconciliation;
2. Consumer / Provider SaaS subscription status reconciliation.

Reconciliation records preserve discrepancies rather than silently mutating durable state.

## Tenant and financial isolation

RLS protects customer and Provider-facing money/subscription state.

CI verifies that an unrelated authenticated user cannot read:

- another household's payment intent;
- another household's consumer subscription;
- another Provider's SaaS subscription.

Ledger posting, provider settlement, billing reconciliation and trusted webhook/event state are additionally unavailable to the ordinary application DB role.

## Real CI certification

`npm run backend:wave4-integration` runs against real PostgreSQL 17 and Redis 7.4 and certifies:

- Booking-derived payment amounts;
- billing-adapter authentication;
- duplicate settlement handling;
- balanced immutable ledger posting;
- completed Booking -> Provider earning;
- server-derived commission/net earning;
- tokenized/verified payout destination;
- server-derived payout amount;
- payout settlement;
- pre-fulfillment refund;
- financial reconciliation;
- Consumer Premium subscription activation;
- durable Consumer entitlements;
- cancellation-at-period-end;
- Provider Pro subscription activation;
- Provider SaaS entitlement activation;
- repeated billing failure -> RESTRICTED;
- entitlement restriction;
- active-care continuity grant;
- Consumer and Provider SaaS reconciliation;
- Finance/Subscription/Provider SaaS cross-tenant RLS.

## Remaining production boundary

Wave 4 does not certify:

- live M-PESA/card/bank credentials;
- real provider webhook signatures;
- production settlement callbacks;
- production payout credentials;
- external subscription-provider mandates;
- secret/KMS integration for production provider credentials;
- durable asynchronous outbox publisher/dead-letter workers;
- real environment observability/backup/DR/security evidence;
- browser frontend API-adapter cutover.

Migration Wave 5 is next:

- Tracking
- Transport
- Recovery
- Community
