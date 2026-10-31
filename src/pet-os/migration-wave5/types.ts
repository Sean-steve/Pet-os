export type Wave5Verdict = 'WAVE_5_DURABLE_EVENT_LOCATION_AUTHORITY_COMPLETE' | 'BLOCKED';

export interface Wave5DomainStatus {
  domain: 'Tracking' | 'Transport' | 'Recovery' | 'Community';
  authority: string;
  status: 'DURABLE_BACKEND';
}

export interface Wave5Report {
  generatedAt: string;
  verdict: Wave5Verdict;
  productionReady: false;
  domains: Wave5DomainStatus[];
  gates: {
    trustedLocationAdapter: boolean;
    telemetryDeduplication: boolean;
    monotonicLiveLocation: boolean;
    exactLocationPrivateAuthority: boolean;
    geofenceTransitionAuthority: boolean;
    transportBookingAuthority: boolean;
    encryptedTransportAddressBoundary: boolean;
    immutableCustodyChain: boolean;
    transportCompletionSafety: boolean;
    recoveryTrackingReference: boolean;
    coarsePublicRecoveryProjection: boolean;
    privateSightingAuthority: boolean;
    communityCoarseLocationOnly: boolean;
    recoveryCommunityContinuity: boolean;
    crossTenantRlsIsolation: boolean;
    payloadBoundIdempotency: boolean;
    realPostgresRedisIntegration: boolean;
    liveDeviceProviderStillRequired: boolean;
    frontendCutoverStillPending: boolean;
  };
  nextWave: { wave: 6; domains: string[]; objective: string; };
}
