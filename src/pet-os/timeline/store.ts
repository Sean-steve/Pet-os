/**
 * Pet OS Sprint 4 - Timeline In-Memory Store & Indexing
 * Implements Volume III, Volume V, Volume XXX (Schema Conventions)
 * Enforces deduplication key uniqueness, append-only persistence, and tie-broken sorting.
 */

import { TimelineEvent, TimelineQueryOptions, TimelineQueryResult } from './types';
import { PetId, TimelineEventId } from '../kernel/ids';

export class TimelineStore {
  private static events = new Map<string, TimelineEvent>();
  private static deduplicationIndex = new Map<string, string>(); // deduplicationKey -> timelineEventId

  static reset(): void {
    this.events.clear();
    this.deduplicationIndex.clear();
  }

  static save(event: TimelineEvent): void {
    this.events.set(event.timelineEventId, { ...event, structuredPayload: event.structuredPayload ? { ...event.structuredPayload } : undefined });
    if (event.deduplicationKey) {
      this.deduplicationIndex.set(event.deduplicationKey, event.timelineEventId);
    }
  }

  static addEvent(event: any): void {
    const now = new Date().toISOString();
    const id = event.timelineEventId || event.eventId;
    const fullEvent: TimelineEvent = {
      timelineEventId: id,
      petId: event.petId,
      householdId: event.householdId,
      eventType: event.eventType || 'CARE_PERFORMED',
      eventCategory: event.eventCategory || 'WALK',
      occurredAt: event.occurredAt || now,
      recordedAt: event.recordedAt || now,
      sourceDomain: event.sourceDomain || 'SERVICES',
      sourceEntityType: event.sourceEntityType || 'DOG_WALK_SESSION',
      sourceEntityId: event.sourceEntityId || '',
      sourceActorType: event.sourceActorType || 'PROVIDER',
      sourceActorId: event.sourceActorId || '',
      provenanceType: event.provenanceType || 'VERIFIED_PROFESSIONAL',
      title: event.title || 'Dog Walk Event',
      summary: event.summary || '',
      visibility: event.visibility || 'HOUSEHOLD',
      status: event.status || 'ACTIVE',
      correlationId: event.correlationId || (id as any),
      deduplicationKey: event.deduplicationKey || `wlk-evt-${id}-${event.occurredAt || now}`,
      createdAt: now,
      updatedAt: now,
      structuredPayload: event.structuredPayload,
    };
    this.save(fullEvent);
  }

  static findById(eventId: TimelineEventId): TimelineEvent | undefined {
    const ev = this.events.get(eventId);
    return ev ? { ...ev, structuredPayload: ev.structuredPayload ? { ...ev.structuredPayload } : undefined } : undefined;
  }

  static findByDeduplicationKey(deduplicationKey: string): TimelineEvent | undefined {
    const id = this.deduplicationIndex.get(deduplicationKey);
    if (!id) return undefined;
    return this.findById(id as TimelineEventId);
  }

  static query(petId: PetId, options: TimelineQueryOptions = {}): TimelineQueryResult {
    let list: TimelineEvent[] = [];

    for (const ev of this.events.values()) {
      if (ev.petId !== petId) continue;

      // Status filters
      if (!options.includeSuperseded && ev.status === 'SUPERSEDED') continue;
      if (!options.includeRetracted && ev.status === 'RETRACTED') continue;

      // Category filter
      if (options.category && ev.eventCategory !== options.category) continue;

      // Source domain filter
      if (options.sourceDomain && ev.sourceDomain !== options.sourceDomain) continue;

      // Provenance filter
      if (options.provenanceType && ev.provenanceType !== options.provenanceType) continue;

      // Visibility filter
      if (options.visibility && ev.visibility !== options.visibility) continue;

      // Date bounds (tested against occurredAt)
      if (options.fromDate && new Date(ev.occurredAt).getTime() < new Date(options.fromDate).getTime()) continue;
      if (options.toDate && new Date(ev.occurredAt).getTime() > new Date(options.toDate).getTime()) continue;

      // Search keyword
      if (options.search) {
        const query = options.search.toLowerCase();
        const matches =
          ev.title.toLowerCase().includes(query) ||
          ev.summary.toLowerCase().includes(query) ||
          ev.eventType.toLowerCase().includes(query) ||
          ev.eventCategory.toLowerCase().includes(query);
        if (!matches) continue;
      }

      list.push({ ...ev, structuredPayload: ev.structuredPayload ? { ...ev.structuredPayload } : undefined });
    }

    // Sort order: primary occurredAt, tie-breakers: recordedAt, then timelineEventId
    const multiplier = options.ascending ? 1 : -1;
    list.sort((a, b) => {
      const timeDiff = (new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()) * multiplier;
      if (timeDiff !== 0) return timeDiff;

      const recordDiff = (new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()) * multiplier;
      if (recordDiff !== 0) return recordDiff;

      return a.timelineEventId.localeCompare(b.timelineEventId) * multiplier;
    });

    const totalCount = list.length;

    // Cursor pagination
    let startIndex = 0;
    if (options.cursor) {
      const cursorIndex = list.findIndex(e => e.timelineEventId === options.cursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    const limit = options.limit && options.limit > 0 ? options.limit : 50;
    const paginated = list.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < totalCount;
    const nextCursor = hasMore && paginated.length > 0 ? paginated[paginated.length - 1].timelineEventId : undefined;

    return {
      events: paginated,
      totalCount,
      nextCursor,
      hasMore
    };
  }

  static countForPet(petId: PetId): number {
    let count = 0;
    for (const ev of this.events.values()) {
      if (ev.petId === petId && ev.status === 'ACTIVE') {
        count++;
      }
    }
    return count;
  }

  static getEventsForPet(petId: PetId): TimelineEvent[] {
    return this.query(petId).events;
  }
}
