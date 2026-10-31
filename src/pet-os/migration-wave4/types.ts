export type Wave4Verdict = 'WAVE_4_DURABLE_MONEY_BILLING_COMPLETE' | 'BLOCKED';

export interface Wave4DomainStatus {
  domain: 'Finance' | 'Subscriptions' | 'Provider SaaS';
  authority: string;
  status: 'DURABLE_BACKEND';
}

export interface Wave4Report {
  generatedAt: string;
  verdict: Wave4Verdict;
  productionReady: false;
  domains: Wave4DomainStatus[];
  gates: {
    serverDerivedBookingPayments: boolean;
    immutableBalancedDoubleEntryLedger: boolean;
    durableReceiptsRefundsEarningsPayouts: boolean;
    trustedBillingAdapterBoundary: boolean;
    paymentReconciliation: boolean;
    consumerSubscriptionBilling: boolean;
    durableConsumerEntitlements: boolean;
    providerSaaSBilling: boolean;
    providerEntitlementRestriction: boolean;
    activeServiceContinuity: boolean;
    billingReconciliation: boolean;
    crossTenantRlsIsolation: boolean;
    payloadBoundIdempotency: boolean;
    realPostgresRedisIntegration: boolean;
    liveExternalPaymentProviderStillRequired: boolean;
    frontendCutoverStillPending: boolean;
  };
  nextWave: {
    wave: 5;
    domains: string[];
    objective: string;
  };
}
