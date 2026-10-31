export type Wave2Domain = 'Health' | 'Care' | 'Nutrition' | 'Training' | 'Activity';
export type Wave2Verdict = 'WAVE_2_DURABLE_BACKEND_COMPLETE' | 'BLOCKED';

export interface Wave2DomainStatus {
  domain: Wave2Domain;
  durableTable: string;
  apiBasePath: string;
  recordTypes: string[];
  lifecycle: 'APPEND_ONLY_WITH_AMENDMENTS' | 'VERSIONED_WITH_REVISION_LEDGER';
  status: 'DURABLE_BACKEND';
}

export interface Wave2Report {
  generatedAt: string;
  verdict: Wave2Verdict;
  productionReady: false;
  domains: Wave2DomainStatus[];
  gates: {
    fiveDurableStores: boolean;
    fiveAuthenticatedApis: boolean;
    tenantAuthorization: boolean;
    rowLevelSecurity: boolean;
    payloadBoundIdempotency: boolean;
    transactionalOutbox: boolean;
    optimisticConcurrency: boolean;
    immutableRevisionHistory: boolean;
    healthAppendOnly: boolean;
    realPostgresRedisIntegration: boolean;
    frontendCutoverStillPending: boolean;
  };
  nextWave: {
    wave: 3;
    domains: string[];
    objective: string;
  };
}
