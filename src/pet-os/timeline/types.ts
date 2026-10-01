/**
 * Pet OS Sprint 4 - Canonical Longitudinal Pet Timeline Domain Models
 * Implements Volume III, Volume V, Volume XXVIII, Volume XXX, Volume XXXI
 * Normative Rules:
 * - occurred_at vs recorded_at separation
 * - Append-only immutability and supersession pattern
 * - Source attribution & explicit provenance labeling
 * - Deduplication via idempotency keys
 */

import { PetId, HouseholdId, TimelineEventId, CorrelationId, UserId } from '../kernel/ids';

export type TimelineEventCategory =
  | 'IDENTITY'
  | 'LIFECYCLE'
  | 'HEALTH'
  | 'PREVENTIVE_CARE'
  | 'MEDICATION'
  | 'NUTRITION'
  | 'TRAINING'
  | 'BEHAVIOR'
  | 'ACTIVITY'
  | 'WALK'
  | 'GROOMING'
  | 'BOARDING'
  | 'SERVICE'
  | 'COMMERCE'
  | 'TRACKING'
  | 'LOST_PET'
  | 'RECOVERY'
  | 'DOCUMENT'
  | 'ADMINISTRATIVE'
  | 'NUTRITION';

export type TimelineSourceDomain =
  | 'PET_CORE'
  | 'DOCUMENTS'
  | 'IDENTITY'
  | 'VETERINARY_HEALTH'
  | 'PREVENTIVE_CARE'
  | 'NUTRITION'
  | 'TRAINING'
  | 'BEHAVIOR'
  | 'SERVICES'
  | 'COMMERCE'
  | 'TRACKING'
  | 'AI'
  | 'OBSERVATION';

export type TimelineProvenanceType =
  | 'OWNER_ENTERED'
  | 'PROVIDER_ENTERED'
  | 'SYSTEM_GENERATED'
  | 'DEVICE_GENERATED'
  | 'IMPORTED'
  | 'DOCUMENT_DERIVED'
  | 'VERIFIED_PROFESSIONAL';

export type TimelineActorType = 'USER' | 'PROVIDER' | 'DEVICE' | 'SYSTEM' | 'ADMIN';

export type TimelineEventVisibility = 'HOUSEHOLD' | 'PUBLIC_RECOVERY' | 'RESTRICTED';

export type TimelineEventStatus = 'ACTIVE' | 'SUPERSEDED' | 'RETRACTED';

export interface TimelineEvent {
  timelineEventId: TimelineEventId;
  petId: PetId;
  householdId: HouseholdId;
  eventType: string;
  eventCategory: TimelineEventCategory;
  occurredAt: string; // When the fact occurred in reality
  recordedAt: string; // When recorded into Pet OS
  sourceDomain: TimelineSourceDomain;
  sourceEntityType: string;
  sourceEntityId: string;
  sourceActorType: TimelineActorType;
  sourceActorId: string;
  provenanceType: TimelineProvenanceType;
  title: string;
  summary: string;
  structuredPayload?: Record<string, unknown>;
  visibility: TimelineEventVisibility;
  status: TimelineEventStatus;
  correlationId: CorrelationId;
  deduplicationKey: string;
  supersededBy?: TimelineEventId;
  supersedes?: TimelineEventId;
  retractedAt?: string;
  retractedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecordTimelineEventCommand {
  petId: PetId;
  householdId: HouseholdId;
  eventType: string;
  eventCategory: TimelineEventCategory;
  occurredAt: string;
  recordedAt?: string;
  sourceDomain: TimelineSourceDomain;
  sourceEntityType: string;
  sourceEntityId: string;
  sourceActorType: TimelineActorType;
  sourceActorId: string;
  provenanceType: TimelineProvenanceType;
  title: string;
  summary: string;
  structuredPayload?: Record<string, unknown>;
  visibility?: TimelineEventVisibility;
  deduplicationKey?: string;
  correlationId?: string;
}

export interface SupersedeTimelineEventCommand {
  oldEventId: TimelineEventId;
  actorId: UserId;
  reason: string;
  updatedData: Partial<RecordTimelineEventCommand>;
  correlationId?: string;
}

export interface RetractTimelineEventCommand {
  eventId: TimelineEventId;
  actorId: UserId;
  reason: string;
  correlationId?: string;
}

export interface TimelineQueryOptions {
  category?: TimelineEventCategory;
  sourceDomain?: TimelineSourceDomain;
  provenanceType?: TimelineProvenanceType;
  fromDate?: string; // ISO date/time
  toDate?: string; // ISO date/time
  search?: string;
  visibility?: TimelineEventVisibility;
  includeSuperseded?: boolean;
  includeRetracted?: boolean;
  ascending?: boolean;
  limit?: number;
  cursor?: string; // eventId cursor for pagination
}

export interface TimelineQueryResult {
  events: TimelineEvent[];
  totalCount: number;
  nextCursor?: string;
  hasMore: boolean;
}
