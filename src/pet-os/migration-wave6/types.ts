export type Wave6Verdict = 'WAVE_6_DURABLE_PLATFORM_AUTHORITY_COMPLETE' | 'BLOCKED';

export interface Wave6DomainStatus {
  domain: 'Commerce' | 'Integrations' | 'AI' | 'Automation' | 'Analytics';
  authority: string;
  status: 'DURABLE_BACKEND';
}

export interface Wave6Report {
  generatedAt: string;
  verdict: Wave6Verdict;
  productionReady: false;
  domainMigrationComplete: boolean;
  domains: Wave6DomainStatus[];
  gates: {
    commerceServerPricing: boolean;
    commerceInventoryReservation: boolean;
    commercePolicyBoundaries: boolean;
    commerceFinanceLedgerContinuity: boolean;
    integrationHashedCredentials: boolean;
    integrationScopeIsolation: boolean;
    integrationWebhookQueue: boolean;
    aiConsentGovernance: boolean;
    aiEmergencyBlocking: boolean;
    aiNonAuthoritative: boolean;
    automationPolicyAuthority: boolean;
    automationConfirmationBinding: boolean;
    automationWorkerSettlement: boolean;
    analyticsDerivedAuthority: boolean;
    analyticsPrivacyMinimization: boolean;
    crossTenantIsolation: boolean;
    realPostgresRedisIntegration: boolean;
    frontendCutoverStillPending: boolean;
    asyncWorkersStillPending: boolean;
    externalProductionEvidenceStillPending: boolean;
  };
  remainingProductionClosure: string[];
}
