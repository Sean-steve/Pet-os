# Sprint 42 — Migration Wave 5: Tracking, Transport, Recovery & Community

## Verdict

`WAVE_5_DURABLE_EVENT_LOCATION_AUTHORITY_COMPLETE`

This certifies the in-repository Wave 5 backend model against PostgreSQL/Redis. It does not certify live tracker-provider credentials, production webhook signatures, background workers, deployed observability/DR, or frontend API cutover.

## Tracking authority

Tracking is the canonical owner of exact Pet location.

Durable state includes:
- device registry and household claim;
- time-bounded device-to-Pet assignments;
- active tracking sessions and opaque route references;
- trusted telemetry ingestion events;
- exact immutable location observations;
- monotonic live-location projection;
- route aggregates;
- dead-letter evidence;
- safe-zone transition derivation.

Trusted telemetry enters only through `/internal/location/*` using `LOCATION_ADAPTER_SECRET`.

Duplicate provider events are idempotent. Older observations are preserved but cannot regress the live projection.

## Location minimization

Exact coordinates are intentionally constrained.

- Tracking stores exact telemetry.
- Recovery stores exact private sightings and references Tracking observations.
- Transport stores encrypted exact-address references plus coarse public snippets; route location stays in Tracking.
- Community accepts coarse location only and rejects structured latitude/longitude fields.
- Public recovery profiles expose coarse missing area only.

## Transport authority

Transport is derived from an authoritative Booking and requires:
- verified active driver;
- verified available insured vehicle;
- capacity validation;
- versioned lifecycle transitions;
- immutable custody transfer records;
- hashed verification proof;
- no plaintext exact-address storage;
- successful Pet handover before completion.

Custody records cannot be updated or deleted.

## Recovery authority

Lost Pet incidents:
- belong to the canonical Pet/Household;
- derive last-known location from Tracking;
- publish coarse recovery projections;
- optionally activate a Community recovery alert;
- accept private exact sightings;
- allow only Household-authorized review of exact sightings;
- close the public profile and Community alert on recovery;
- return the canonical Pet status to ACTIVE.

## Community authority

Community uses coarse location only.

Durable Wave 5 Community includes:
- profiles with coarse neighborhood/city/county;
- coarse-location posts;
- Recovery alerts based on coarse Recovery projections;
- volunteer participation requiring explicit recovery-relay opt-in.

## CI certification

`npm run backend:wave5-integration` proves:
- location adapter authentication;
- telemetry deduplication;
- monotonic live location;
- route accumulation;
- geofence transition derivation;
- Tracking RLS;
- verified Transport driver/vehicle readiness;
- encrypted Transport address boundary;
- immutable custody;
- trip completion after handover;
- Lost Pet incident derivation from Tracking;
- coarse-only public recovery profile;
- private exact sighting + owner verification;
- Community exact-location rejection;
- recovery volunteer opt-in;
- recovery closure propagation;
- Tracking/Transport/Recovery RLS isolation.

## Next

Wave 6:
- Commerce
- Integrations
- AI
- Automation
- Analytics
