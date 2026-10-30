import type { UserId, HouseholdId, ProviderId } from '../kernel/ids';

export type AnalyticsAudience='HOUSEHOLD'|'PROVIDER'|'PLATFORM_OPS';
export type MetricUnit='COUNT'|'PERCENT'|'MINUTES'|'RATING'|'MINOR_UNITS';
export type MetricDirection='UP'|'DOWN'|'FLAT'|'NOT_COMPARABLE';
export type IntelligenceStatus='HEALTHY'|'WATCH'|'ACTION_NEEDED'|'CRITICAL'|'INFORMATIONAL';

export interface AnalyticsContext{
  actorUserId:UserId;
  audience:AnalyticsAudience;
  householdId?:HouseholdId;
  providerId?:ProviderId;
  windowStart?:string;
  windowEnd?:string;
  timezone?:string;
}

export interface AnalyticsMetric{
  metricId:string;
  label:string;
  domain:string;
  value:number;
  unit:MetricUnit;
  numerator?:number;
  denominator?:number;
  previousValue?:number;
  direction:MetricDirection;
  definition:string;
  source:string;
  asOf:string;
}

export interface OutcomeIndicator{
  outcomeId:string;
  title:string;
  value:number;
  unit:MetricUnit;
  status:IntelligenceStatus;
  interpretation:string;
  caveat:string;
  sourceDomains:string[];
}

export interface OperationsSignal{
  signalId:string;
  title:string;
  status:IntelligenceStatus;
  value:number;
  unit:MetricUnit;
  threshold?:string;
  explanation:string;
  sourceDomain:string;
  drilldownTab:string;
}

export interface AnalyticsSnapshot{
  audience:AnalyticsAudience;
  actorUserId:UserId;
  scopeId:string;
  windowStart:string;
  windowEnd:string;
  generatedAt:string;
  timezone:string;
  metrics:AnalyticsMetric[];
  outcomes:OutcomeIndicator[];
  operations:OperationsSignal[];
  provenance:string[];
  disclaimers:string[];
}

export interface MetricSeriesPoint{
  periodStart:string;
  periodEnd:string;
  value:number;
}

export interface MetricSeries{
  metricId:string;
  label:string;
  unit:MetricUnit;
  points:MetricSeriesPoint[];
}
