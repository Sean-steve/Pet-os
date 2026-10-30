import type { UserId, HouseholdId, ProviderId } from '../kernel/ids';

export type EngagementAudience='HOUSEHOLD'|'PROVIDER'|'PLATFORM_OPS';
export type EngagementEventKind='VALUE'|'WORKFLOW'|'NAVIGATION';
export type WorkflowEventState='STARTED'|'COMPLETED'|'FAILED'|'CANCELLED';
export type MeaningfulArea='PET_PROFILE'|'CARE'|'ACTIVITY'|'TRAINING'|'BOOKING'|'TRACKING'|'AUTOMATION'|'INTEGRATIONS'|'COMMERCE'|'COMMUNITY'|'RECOVERY';

export interface EngagementTelemetryPreference{
  userId:UserId;
  productAnalyticsEnabled:boolean;
  updatedAt:string;
  updatedBy:UserId;
}

export interface EngagementEvent{
  eventId:string;
  actorUserId:UserId;
  householdId?:HouseholdId;
  providerId?:ProviderId;
  kind:EngagementEventKind;
  area:MeaningfulArea;
  eventName:string;
  occurredAt:string;
  correlationId?:string;
  workflowState?:WorkflowEventState;
  surface:string;
  idempotencyKey:string;
}

export interface AdoptionMilestone{
  milestoneId:string;
  label:string;
  achieved:boolean;
  sourceDomain:string;
  definition:string;
}

export interface EngagementMetric{
  metricId:string;
  label:string;
  value:number;
  unit:'COUNT'|'PERCENT'|'DAYS';
  definition:string;
  source:string;
}

export interface ActivationFunnelStep{
  stepId:string;
  label:string;
  count:number;
  percentOfBase:number;
  definition:string;
}

export interface PlatformHealthSignal{
  signalId:string;
  label:string;
  value:number;
  unit:'COUNT'|'PERCENT';
  status:'HEALTHY'|'WATCH'|'ACTION_NEEDED'|'INFORMATIONAL';
  explanation:string;
}

export interface EngagementSnapshot{
  audience:EngagementAudience;
  actorUserId:UserId;
  scopeId:string;
  windowStart:string;
  windowEnd:string;
  generatedAt:string;
  metrics:EngagementMetric[];
  milestones:AdoptionMilestone[];
  funnel:ActivationFunnelStep[];
  signals:PlatformHealthSignal[];
  guardrails:string[];
  provenance:string[];
}

export interface EngagementContext{
  actorUserId:UserId;
  audience:EngagementAudience;
  householdId?:HouseholdId;
  providerId?:ProviderId;
  windowStart?:string;
  windowEnd?:string;
}

export interface RecordEngagementEventInput{
  actorUserId:UserId;
  householdId?:HouseholdId;
  providerId?:ProviderId;
  kind:EngagementEventKind;
  area:MeaningfulArea;
  eventName:string;
  occurredAt?:string;
  correlationId?:string;
  workflowState?:WorkflowEventState;
  surface:string;
  idempotencyKey:string;
}
