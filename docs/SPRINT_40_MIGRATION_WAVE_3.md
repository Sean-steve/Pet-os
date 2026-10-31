# Sprint 40 — Migration Wave 3: Provider, Booking, Professional Care & Reviews

## Objective

Migration Wave 3 moves the professional service lifecycle into durable cross-party server authority.

Wave 3 covers:

- Provider
- Booking
- Professional Care
- Reviews

Repository verdict:

`WAVE_3_DURABLE_SERVICE_LIFECYCLE_COMPLETE`

This does not mean Pet OS is production certified.

## Provider authority

PostgreSQL now owns:

- provider profiles;
- service businesses;
- business memberships;
- service offerings.

Provider self-onboarding is allowed, but self-verification is not.

A newly created provider is server-forced to:

- PENDING_VERIFICATION
- TEMPORARILY_INACTIVE
- PRIVATE

An unverified provider asking to publish an ACTIVE offering receives a DRAFT offering instead.

Public discovery only returns offerings belonging to providers that are:

- VERIFIED;
- ACTIVE;
- PUBLIC;

with an ACTIVE service offering.

Service businesses begin UNVERIFIED and remain private to unrelated users until verified.

## Booking authority

Bookings now persist relational references to:

- household;
- owner user;
- provider;
- service offering;
- optional provider business;
- booked pets.

Commercial and service snapshots are captured by the server from the active offering at booking time. The customer cannot submit an authoritative price snapshot.

Booking creation uses a provider-scoped PostgreSQL transaction advisory lock and rejects overlapping active provider bookings.

Booking state changes use optimistic concurrency via `concurrency_version`.

Every accepted transition writes an immutable `booking_revisions` row containing previous/new status, snapshots, versions, reason and actor.

Supported provider lifecycle:

- PENDING_PROVIDER -> CONFIRMED
- PENDING_PROVIDER -> DECLINED
- CONFIRMED -> IN_PROGRESS
- IN_PROGRESS -> COMPLETED

Owner/provider cancellation boundaries are also enforced.

If a Professional Care engagement exists, Booking cannot enter COMPLETED until the engagement is completed.

## Professional Care authority

Professional Care engagements can only be created from a Booking in CONFIRMED or IN_PROGRESS state.

The server derives:

- provider;
- business;
- offering;
- household;
- Pet IDs;
- scheduled start/end;
- timezone;

from the authoritative Booking.

Personal providers must assign themselves. Business providers may assign active business members.

Owners may read their care engagement, but provider/staff authority is required to:

- create observations;
- record incidents;
- record handovers;
- persist service execution records;
- transition custody/service status.

Care status and custody state are validated together.

Raw home-access secrets, PINs, codes, passwords and verification codes are rejected from ordinary care record payloads. They require a future dedicated encrypted secrets facility.

## Review authority

A ReviewEligibility is created automatically when a Booking reaches COMPLETED.

Eligibility is derived from the Booking:

- reviewer user;
- reviewer household;
- provider;
- business;
- offering;
- service snapshot;
- completion reference.

Eligibility is valid for 30 days and cannot be forged by arbitrary browser input.

A Review may only be submitted by the eligible Booking owner and only while the eligibility remains ELIGIBLE.

Provider self-review and active business-staff review are blocked.

Published reviews are marked:

- verifiedService = true;
- PUBLISHED;
- APPROVED;

matching the existing Sprint 23 review behavior.

The provider may publish a response, but PostgreSQL RLS prevents the provider from rewriting the customer's review rating or body.

## Cross-party access model

The database now distinguishes:

- public verified Provider discovery;
- private Provider/business management;
- Booking customer access;
- Booking provider/business access;
- Professional Care owner read access;
- Professional Care provider/staff write authority;
- Review customer ownership;
- public published Review reads;
- provider response authority.

Security-definer helper functions avoid recursive RLS dependencies.

## Transactional events and idempotency

Provider onboarding, offering creation, Booking creation/transitions, Professional Care creation/records/transitions, Review publication and provider response use transactional outbox events.

Write endpoints use payload-bound idempotency keys.

Reusing an idempotency key with a different payload returns a conflict.

## Real CI integration

`npm run backend:wave3-integration` runs against real PostgreSQL 17 and Redis 7.4.

It certifies:

- provider onboarding cannot self-verify;
- unverified business privacy;
- unverified offerings cannot become active;
- verified provider discovery;
- server-derived Booking price/service snapshots;
- payload-bound Booking idempotency;
- provider-scoped overlapping Booking conflict prevention;
- Booking optimistic concurrency and revision history;
- owner/provider cross-party Booking isolation;
- Booking-derived Professional Care;
- owner read / provider write separation;
- secret exclusion from care records;
- care custody/state continuity;
- Booking completion blocked before care completion;
- completed Booking automatically creates Review eligibility;
- unrelated users cannot discover private eligibility;
- verified-service Review creation;
- provider response;
- provider cannot mutate customer Review;
- PostgreSQL RLS isolation;
- lifecycle outbox continuity;
- production container startup remains healthy.

## Remaining boundary

The GitHub Pages prototype still uses browser/in-memory domain stores for interactive Provider, Booking, Professional Care and Review screens.

Wave 3 creates the durable server authority and API contracts; frontend adapters still require cutover.

Migration Wave 4 is next:

- Finance
- Subscriptions
- Provider SaaS
