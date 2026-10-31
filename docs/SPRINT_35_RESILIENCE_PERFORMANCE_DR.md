# Sprint 35 — Resilience, Performance & Disaster Recovery Hardening

## Status
Implemented in the Pet OS prototype.

## Purpose
Sprint 35 makes failure behavior explicit across the multi-sided Pet OS and adds measurable performance controls. It does not claim that a browser prototype is highly available or disaster-recovery certified.

## Resilience control plane
The Sprint 35 bounded context defines:
- dependency criticality;
- bounded timeouts and retry limits;
- idempotency requirements before retry;
- circuit-breaker thresholds and recovery cooldown;
- graceful degradation modes;
- recovery objectives;
- recovery drill evidence;
- performance budgets;
- production-readiness boundaries.

Critical domains fail safely. Identity fails closed. Finance mutation pauses rather than inventing payment state. Tracking may expose only clearly timestamped stale-safe state. Third-party integrations queue/retry without blocking core workflows. AI can disable entirely without disabling canonical Pet OS.

## Disaster recovery
Recovery objectives are defined for identity, finance, health, tracking, booking and security/audit evidence. Each objective includes target RTO, target RPO and restore-verification requirements.

These values are objectives, not achieved SLAs. Production certification requires recurring restore drills against real infrastructure and durable stores.

## Performance hardening
Sprint 35 replaces the monolithic application import pattern with lazy-loaded domain consoles so the initial Pet OS shell no longer requires every operational module before first render.

CI now enforces post-build budgets for:
- initial JavaScript raw size;
- initial JavaScript gzip size;
- largest JavaScript chunk;
- aggregate JavaScript gzip size;
- CSS gzip size.

LCP, INP and CLS are documented as production RUM targets and remain explicitly unmeasured in the static prototype.

## Production boundary
Production resilience still requires:
- durable server-side databases;
- multi-zone or multi-region architecture appropriate to each tier;
- encrypted backups with independent copies;
- automated backup verification;
- scheduled restore drills;
- infrastructure-as-code recreation;
- external uptime/SLO monitoring;
- queues with durable deduplication and dead-letter handling;
- autoscaling/capacity testing;
- load, soak and chaos testing;
- CDN/caching policy;
- database connection-pool and query budgets;
- incident command/runbooks and communications;
- measured RTO/RPO evidence.

## Next
Sprint 36 should execute full-system end-to-end certification across every party, role and critical workflow before final production-readiness closure.
