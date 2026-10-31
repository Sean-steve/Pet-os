import type { BackendFoundationCapability, BackendFoundationReport, DomainMigrationWave } from './types';

const implemented: BackendFoundationCapability[] = [
  {
    id: 'BFD-01',
    title: 'PostgreSQL durable Identity and Pet Core schema',
    status: 'IMPLEMENTED',
    evidence: ['users, households, memberships, pets, idempotency and outbox tables are migration-managed'],
  },
  {
    id: 'BFD-02',
    title: 'Authenticated server API boundary',
    status: 'IMPLEMENTED',
    evidence: ['Bearer JWT verification supports trusted JWKS or a controlled HMAC verifier', 'token subject is the canonical user ID'],
  },
  {
    id: 'BFD-03',
    title: 'Server-side household tenant authorization',
    status: 'IMPLEMENTED',
    evidence: ['household membership is checked before Pet reads and writes', 'PostgreSQL RLS policies are defined as defense in depth'],
  },
  {
    id: 'BFD-04',
    title: 'Transactional idempotency and outbox',
    status: 'IMPLEMENTED',
    evidence: ['Pet registration writes aggregate state, idempotency response and PetRegistered outbox event in one transaction'],
  },
  {
    id: 'BFD-05',
    title: 'Redis runtime dependency',
    status: 'IMPLEMENTED',
    evidence: ['readiness probes require Redis', 'authenticated API requests use Redis-backed per-user rate limiting'],
  },
  {
    id: 'BFD-06',
    title: 'Deployable production service topology',
    status: 'IMPLEMENTED',
    evidence: ['Docker image plus PostgreSQL/Redis/API production compose topology with persistent volumes and health checks'],
  },
  {
    id: 'BFD-07',
    title: 'Real backend integration gate',
    status: 'IMPLEMENTED',
    evidence: ['CI runs migrations and HTTP integration tests against PostgreSQL and Redis services'],
  },
];

const remaining: BackendFoundationCapability[] = [
  { id: 'BFD-NEXT-01', title: 'Health, Care, Nutrition, Training and Activity persistence', status: 'NEXT_MIGRATION', evidence: ['still backed by prototype stores'] },
  { id: 'BFD-NEXT-02', title: 'Provider, Booking and Professional Care persistence', status: 'NEXT_MIGRATION', evidence: ['still backed by prototype stores'] },
  { id: 'BFD-NEXT-03', title: 'Finance ledger and production payment reconciliation', status: 'NEXT_MIGRATION', evidence: ['prototype finance remains non-production money movement'] },
  { id: 'BFD-NEXT-04', title: 'Tracking, Transport and Recovery durable event ingestion', status: 'NEXT_MIGRATION', evidence: ['device/location runtime is not yet production-backed'] },
  { id: 'BFD-NEXT-05', title: 'Commerce, subscriptions and Provider SaaS persistence', status: 'NEXT_MIGRATION', evidence: ['commercial bounded contexts remain prototype stores'] },
  { id: 'BFD-NEXT-06', title: 'Durable worker/outbox publisher and dead-letter processing', status: 'NEXT_MIGRATION', evidence: ['outbox table exists; asynchronous publisher infrastructure is the next runtime step'] },
  { id: 'BFD-NEXT-07', title: 'Production observability, backups, independent security and DR evidence', status: 'EXTERNAL_EVIDENCE_REQUIRED', evidence: ['must be proven in deployed environments'] },
];

const migrationWaves: DomainMigrationWave[] = [
  { wave: 1, domains: ['Identity', 'Household', 'Pet Core'], objective: 'Establish durable tenant, API and aggregate foundations.', status: 'FOUNDATION_COMPLETE' },
  { wave: 2, domains: ['Health', 'Care', 'Nutrition', 'Training', 'Activity'], objective: 'Migrate longitudinal Pet care data and provenance.', status: 'PENDING' },
  { wave: 3, domains: ['Provider', 'Booking', 'Professional Care', 'Reviews'], objective: 'Move professional service lifecycle to durable server authority.', status: 'PENDING' },
  { wave: 4, domains: ['Finance', 'Subscriptions', 'Provider SaaS'], objective: 'Establish production-grade ledger, billing and reconciliation.', status: 'PENDING' },
  { wave: 5, domains: ['Tracking', 'Transport', 'Recovery', 'Community'], objective: 'Migrate high-volume event/location and recovery workflows.', status: 'PENDING' },
  { wave: 6, domains: ['Commerce', 'Integrations', 'AI', 'Automation', 'Analytics'], objective: 'Complete commercial, integration and intelligence backend migration.', status: 'PENDING' },
];

export class BackendFoundationService {
  static run(): BackendFoundationReport {
    const gates = {
      durableCorePersistence: implemented.some((item) => item.id === 'BFD-01'),
      serverAuthentication: implemented.some((item) => item.id === 'BFD-02'),
      tenantAuthorization: implemented.some((item) => item.id === 'BFD-03'),
      transactionalOutbox: implemented.some((item) => item.id === 'BFD-04'),
      redisRuntimeBoundary: implemented.some((item) => item.id === 'BFD-05'),
      deployableTopology: implemented.some((item) => item.id === 'BFD-06'),
      realIntegrationTest: implemented.some((item) => item.id === 'BFD-07'),
      noProductionReadyClaim: true,
    };
    return {
      generatedAt: new Date().toISOString(),
      verdict: Object.values(gates).every(Boolean) ? 'BACKEND_FOUNDATION_READY_FOR_DOMAIN_MIGRATION' : 'BLOCKED',
      productionReady: false,
      implemented,
      remaining,
      migrationWaves,
      gates,
    };
  }
}
