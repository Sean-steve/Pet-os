import type { UserId } from '../kernel/ids';

export type DependencyId='IDENTITY'|'FINANCE'|'HEALTH'|'BOOKING'|'TRACKING'|'NOTIFICATIONS'|'INTEGRATIONS'|'AI';
export type DependencyCriticality='CRITICAL'|'HIGH'|'MEDIUM'|'OPTIONAL';
export type DependencyHealthStatus='HEALTHY'|'DEGRADED'|'UNAVAILABLE'|'UNKNOWN';
export type CircuitState='CLOSED'|'OPEN'|'HALF_OPEN';
export type DegradationMode='FAIL_CLOSED'|'READ_ONLY'|'STALE_SAFE_READ'|'QUEUE_AND_RETRY'|'MANUAL_FALLBACK'|'FEATURE_DISABLED';
export type RecoveryTier='TIER_0'|'TIER_1'|'TIER_2'|'TIER_3';
export type RecoveryDrillStatus='RUNNING'|'PASSED'|'FAILED'|'CANCELLED';
export type PerformanceBudgetStatus='TARGET'|'PASS'|'FAIL'|'UNMEASURED';

export interface DependencyPolicy{
  dependencyId:DependencyId;
  label:string;
  criticality:DependencyCriticality;
  timeoutMs:number;
  maxAttempts:number;
  circuitFailureThreshold:number;
  circuitRecoverySeconds:number;
  degradationMode:DegradationMode;
  degradationMessage:string;
  idempotencyRequiredForRetry:boolean;
}
export interface DependencyRuntimeState{
  dependencyId:DependencyId;
  health:DependencyHealthStatus;
  circuitState:CircuitState;
  consecutiveFailures:number;
  lastCheckedAt?:string;
  lastSuccessAt?:string;
  lastFailureAt?:string;
  circuitOpenedAt?:string;
  lastError?:string;
}
export interface RetryDecision{
  allowed:boolean;
  maxAttempts:number;
  reasonCode:string;
  requiresIdempotency:boolean;
}
export interface RecoveryObjective{
  objectiveId:string;
  domain:string;
  tier:RecoveryTier;
  targetRtoMinutes:number;
  targetRpoMinutes:number;
  backupRequired:boolean;
  restoreVerificationRequired:boolean;
  notes:string;
}
export interface RecoveryDrill{
  drillId:string;
  objectiveId:string;
  scenario:string;
  status:RecoveryDrillStatus;
  startedAt:string;
  startedBy:UserId;
  completedAt?:string;
  observedRtoMinutes?:number;
  observedRpoMinutes?:number;
  restoreVerified?:boolean;
  evidence?:string;
}
export interface PerformanceBudget{
  budgetId:string;
  metric:'ENTRY_JS_RAW_KB'|'ENTRY_JS_GZIP_KB'|'MAX_CHUNK_RAW_KB'|'TOTAL_JS_GZIP_KB'|'CSS_GZIP_KB'|'LCP_P75_MS'|'INP_P75_MS'|'CLS_P75';
  label:string;
  limit:number;
  unit:'KB'|'MS'|'RATIO';
  enforcement:'CI'|'RUM_TARGET';
  status:PerformanceBudgetStatus;
  measuredValue?:number;
  notes:string;
}
export interface GracefulDegradationRule{
  ruleId:string;
  dependencyId:DependencyId;
  userImpact:string;
  allowedBehavior:string[];
  forbiddenBehavior:string[];
}
export interface ResilienceSnapshot{
  generatedAt:string;
  dependencies:Array<{policy:DependencyPolicy;runtime:DependencyRuntimeState}>;
  recoveryObjectives:RecoveryObjective[];
  drills:RecoveryDrill[];
  performanceBudgets:PerformanceBudget[];
  degradationRules:GracefulDegradationRule[];
  recoveryReadiness:{verifiedDrills:number;failedDrills:number;untestedObjectives:number};
  productionBoundaries:string[];
}
