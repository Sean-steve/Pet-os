export type Wave3Verdict = 'WAVE_3_DURABLE_SERVICE_LIFECYCLE_COMPLETE' | 'BLOCKED';

export interface Wave3Report {
  generatedAt: string;
  verdict: Wave3Verdict;
  productionReady: false;
  domains: Array<{
    domain: 'Provider' | 'Booking' | 'Professional Care' | 'Reviews';
    authority: string;
    status: 'DURABLE_BACKEND';
  }>;
  gates: {
    providerIdentityAndOfferingAuthority: boolean;
    providerVerificationBoundary: boolean;
    raceSafeBookingAuthority: boolean;
    bookingVersionHistory: boolean;
    bookingDerivedProfessionalCare: boolean;
    ownerReadProviderWriteSeparation: boolean;
    careSecretExclusion: boolean;
    completedBookingReviewEligibility: boolean;
    verifiedServiceReviewIntegrity: boolean;
    providerCannotMutateCustomerReview: boolean;
    crossPartyRlsIsolation: boolean;
    transactionalLifecycleOutbox: boolean;
    realPostgresRedisIntegration: boolean;
    frontendCutoverStillPending: boolean;
  };
  nextWave: {
    wave: 4;
    domains: string[];
    objective: string;
  };
}
