export type BackendFoundationStatus = 'IMPLEMENTED' | 'NEXT_MIGRATION' | 'EXTERNAL_EVIDENCE_REQUIRED';
export type BackendFoundationVerdict = 'BACKEND_FOUNDATION_READY_FOR_DOMAIN_MIGRATION' | 'BLOCKED';

export interface BackendFoundationCapability {
  id: string;
  title: string;
  status: BackendFoundationStatus;
  evidence: string[];
}

export interface DomainMigrationWave {
  wave: number;
  domains: string[];
  objective: string;
  status: 'FOUNDATION_COMPLETE' | 'PENDING';
}

export interface BackendFoundationReport {
  generatedAt: string;
  verdict: BackendFoundationVerdict;
  productionReady: false;
  implemented: BackendFoundationCapability[];
  remaining: BackendFoundationCapability[];
  migrationWaves: DomainMigrationWave[];
  gates: {
    durableCorePersistence: boolean;
    serverAuthentication: boolean;
    tenantAuthorization: boolean;
    transactionalOutbox: boolean;
    redisRuntimeBoundary: boolean;
    deployableTopology: boolean;
    realIntegrationTest: boolean;
    noProductionReadyClaim: boolean;
  };
}
