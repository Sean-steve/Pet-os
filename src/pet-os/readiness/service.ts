import type {
  BackendMigrationBoundary,
  ProductionReadinessItem,
  ProductionReadinessReport,
} from './types';

const repositoryItems: ProductionReadinessItem[] = [
  {
    id: 'PRD-CODE-01',
    category: 'CODE_QUALITY',
    title: 'Strict TypeScript validation is a mandatory release gate',
    status: 'CLOSED_IN_REPO',
    evidence: ['Sprint 37 reconciles legacy console/API drift.', 'CI and Pages are required to run npm run typecheck without advisory bypass.'],
    ownerBoundary: 'REPOSITORY',
  },
  {
    id: 'PRD-CODE-02',
    category: 'VALIDATION',
    title: 'Unified regression coverage remains mandatory',
    status: 'CLOSED_IN_REPO',
    evidence: ['Sprint 2-37 suites execute through scripts/run-all-tests.ts.'],
    ownerBoundary: 'REPOSITORY',
  },
  {
    id: 'PRD-CODE-03',
    category: 'VALIDATION',
    title: 'Full-system prototype certification remains mandatory',
    status: 'CLOSED_IN_REPO',
    evidence: ['Sprint 36 cross-role certification remains a required gate.'],
    ownerBoundary: 'REPOSITORY',
  },
  {
    id: 'PRD-CODE-04',
    category: 'VALIDATION',
    title: 'Production bundle performance budgets remain mandatory',
    status: 'CLOSED_IN_REPO',
    evidence: ['CI and Pages retain the performance budget check after the production build.'],
    ownerBoundary: 'REPOSITORY',
  },
  {
    id: 'PRD-CODE-05',
    category: 'CODE_QUALITY',
    title: 'Prototype and production-readiness claims are explicitly separated',
    status: 'CLOSED_IN_REPO',
    evidence: ['CERTIFIED_PROTOTYPE is not treated as production certification.', 'Sprint 37 cannot emit a PRODUCTION_READY verdict.'],
    ownerBoundary: 'REPOSITORY',
  },
];

const externalItems: ProductionReadinessItem[] = [
  {
    id: 'PRD-EXT-01',
    category: 'PERSISTENCE',
    title: 'Durable transactional persistence',
    status: 'EXTERNAL_REQUIRED',
    evidence: ['Replace browser/in-memory stores with durable production databases and migrations.'],
    ownerBoundary: 'PRODUCTION_PLATFORM',
  },
  {
    id: 'PRD-EXT-02',
    category: 'IDENTITY_SECURITY',
    title: 'Authenticated server APIs and production session security',
    status: 'EXTERNAL_REQUIRED',
    evidence: ['Move authorization enforcement to trusted server boundaries with production identity/session controls.'],
    ownerBoundary: 'PRODUCTION_PLATFORM',
  },
  {
    id: 'PRD-EXT-03',
    category: 'IDENTITY_SECURITY',
    title: 'Secrets and key management',
    status: 'EXTERNAL_REQUIRED',
    evidence: ['Production credentials, signing keys and encryption material require a managed secrets/KMS boundary.'],
    ownerBoundary: 'PRODUCTION_PLATFORM',
  },
  {
    id: 'PRD-EXT-04',
    category: 'PLATFORM_RUNTIME',
    title: 'Durable queue, scheduler and transactional outbox infrastructure',
    status: 'EXTERNAL_REQUIRED',
    evidence: ['Retries, jobs, webhooks and domain-event delivery require durable infrastructure with dead-letter handling.'],
    ownerBoundary: 'PRODUCTION_PLATFORM',
  },
  {
    id: 'PRD-EXT-05',
    category: 'INTEGRATIONS',
    title: 'Real payment and external provider integrations',
    status: 'EXTERNAL_REQUIRED',
    evidence: ['Prototype payment/provider adapters must be replaced by production accounts, signed callbacks and reconciliation.'],
    ownerBoundary: 'PRODUCTION_PLATFORM',
  },
  {
    id: 'PRD-EXT-06',
    category: 'PLATFORM_RUNTIME',
    title: 'Production object and media storage',
    status: 'EXTERNAL_REQUIRED',
    evidence: ['Documents, photos and evidence require durable object storage, signed access and malware/content controls.'],
    ownerBoundary: 'PRODUCTION_PLATFORM',
  },
  {
    id: 'PRD-EXT-07',
    category: 'OBSERVABILITY',
    title: 'Production observability, SLOs, RUM and security telemetry',
    status: 'EXTERNAL_REQUIRED',
    evidence: ['Runtime metrics, logs, traces, alerts, product RUM and security-event retention must be observed in production.'],
    ownerBoundary: 'PRODUCTION_PLATFORM',
  },
  {
    id: 'PRD-EXT-08',
    category: 'QUALITY_ASSURANCE',
    title: 'Independent security testing and threat-model closure',
    status: 'EXTERNAL_REQUIRED',
    evidence: ['Production launch requires penetration testing and closure of material threat-model findings.'],
    ownerBoundary: 'PRODUCTION_PLATFORM',
  },
  {
    id: 'PRD-EXT-09',
    category: 'QUALITY_ASSURANCE',
    title: 'Browser, device and accessibility automation',
    status: 'EXTERNAL_REQUIRED',
    evidence: ['Real browser/device journeys and accessibility conformance must be tested outside the domain-level prototype suites.'],
    ownerBoundary: 'PRODUCTION_PLATFORM',
  },
  {
    id: 'PRD-EXT-10',
    category: 'QUALITY_ASSURANCE',
    title: 'Load, soak and failure-mode validation',
    status: 'EXTERNAL_REQUIRED',
    evidence: ['Production services require capacity, soak, back-pressure and controlled failure testing.'],
    ownerBoundary: 'PRODUCTION_PLATFORM',
  },
  {
    id: 'PRD-EXT-11',
    category: 'DISASTER_RECOVERY',
    title: 'Infrastructure backups and observed disaster-recovery drills',
    status: 'EXTERNAL_REQUIRED',
    evidence: ['Sprint 35 RTO/RPO policies require real backups, restore evidence and environment-level recovery drills.'],
    ownerBoundary: 'PRODUCTION_PLATFORM',
  },
  {
    id: 'PRD-EXT-12',
    category: 'PLATFORM_RUNTIME',
    title: 'Infrastructure as code and reproducible environments',
    status: 'EXTERNAL_REQUIRED',
    evidence: ['Production/staging environments must be reproducible from reviewed infrastructure definitions.'],
    ownerBoundary: 'PRODUCTION_PLATFORM',
  },
];

const migrationBoundaries: BackendMigrationBoundary[] = [
  {
    domain: 'Identity, Household & Authorization',
    currentSource: 'Browser/in-memory identity stores',
    productionTarget: 'Authenticated server API + relational tenant/identity persistence',
    migrationRule: 'Every household-scoped read/write must be authorized on the server before persistence access.',
  },
  {
    domain: 'Pet Core, Health, Care & Professional Records',
    currentSource: 'Client-side bounded-context stores',
    productionTarget: 'Durable relational aggregates with transactional domain services',
    migrationRule: 'Preserve canonical IDs, provenance and append/supersession semantics; do not create parallel sources of truth.',
  },
  {
    domain: 'Booking & Finance',
    currentSource: 'In-memory booking and finance stores with deterministic adapters',
    productionTarget: 'Transactional booking persistence + append-only financial ledger + real payment reconciliation',
    migrationRule: 'Money movement remains server-authoritative, idempotent and traceable from booking to payment, receipt and earning.',
  },
  {
    domain: 'Events, Jobs & Webhooks',
    currentSource: 'In-process event/outbox simulations',
    productionTarget: 'Transactional outbox + durable queue/workers + retry/dead-letter infrastructure',
    migrationRule: 'Persist domain state and outbox atomically; external delivery must be replayable and idempotent.',
  },
  {
    domain: 'Tracking & Transport Telemetry',
    currentSource: 'Prototype tracking/transport stores',
    productionTarget: 'Authorized ingestion APIs + durable event/time-series storage',
    migrationRule: 'Exact location stays access-scoped; public/read-model projections remain privacy minimized.',
  },
  {
    domain: 'Documents, Photos & Evidence',
    currentSource: 'Reference metadata and prototype URLs',
    productionTarget: 'Encrypted object storage with signed URLs, retention and malware/content scanning',
    migrationRule: 'Keep metadata in canonical domain records while binary objects live behind controlled storage access.',
  },
  {
    domain: 'External Integrations',
    currentSource: 'Deterministic/local adapters and in-memory webhook state',
    productionTarget: 'Production credentials, provider sandboxes/live accounts and durable delivery/reconciliation',
    migrationRule: 'No production secret may ship to the browser; integrations must use scoped server-side credentials.',
  },
  {
    domain: 'Platform Operations',
    currentSource: 'In-repo security, resilience and analytics policy models',
    productionTarget: 'Managed secrets, observability, backups, IaC and environment-level controls',
    migrationRule: 'Policy objectives become certified only when backed by observed production infrastructure evidence.',
  },
];

export class ProductionReadinessService {
  static run(): ProductionReadinessReport {
    const items = [...repositoryItems, ...externalItems];
    const repositoryScope = items.filter((item) => item.ownerBoundary === 'REPOSITORY');
    const closedInRepo = items.filter((item) => item.status === 'CLOSED_IN_REPO').length;
    const externalRequired = items.filter((item) => item.status === 'EXTERNAL_REQUIRED').length;
    const blocked = items.filter((item) => item.status === 'BLOCKED').length;
    const releaseGates = {
      repositoryClosureComplete: repositoryScope.every((item) => item.status === 'CLOSED_IN_REPO'),
      noHiddenRepositoryBlockers: repositoryScope.every((item) => item.status !== 'BLOCKED'),
      productionBlockersExplicit: externalRequired >= 10,
      migrationBoundariesExplicit: migrationBoundaries.length >= 6,
    };

    return {
      generatedAt: new Date().toISOString(),
      verdict: Object.values(releaseGates).every(Boolean) ? 'CODEBASE_READY_FOR_BACKEND_MIGRATION' : 'BLOCKED',
      productionReady: false,
      closedInRepo,
      externalRequired,
      blocked,
      items,
      migrationBoundaries,
      releaseGates,
    };
  }
}
