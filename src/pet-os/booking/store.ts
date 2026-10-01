/**
 * Pet OS Sprint 11 - Booking Platform In-Memory Transactional Store
 * Implements Volume III (DDD Architecture), Volume XXX (Database Conventions),
 * Volume XXXI (Security & Concurrency).
 * 
 * Features:
 * - Thread-safe indexed repository for Bookings, Holds, Series, Grants, and Reschedules
 * - Idempotency tracking (keyed by unique idempotency key)
 * - Atomic capacity locking to prevent race-condition overbooking
 * - Event outbox and pub/sub subscribers
 */

import {
  BookingId,
  ReservationHoldId,
  BookingSeriesId,
  BookingAccessGrantId,
  RescheduleRequestId,
  BookingCancellationId,
  ProviderId,
  UserId,
  HouseholdId,
  PetId,
} from '../kernel/ids';
import {
  BookingAggregate,
  ReservationHold,
  RescheduleRequest,
  BookingCancellation,
  RecurringBookingSeries,
  SeriesOccurrence,
  BookingAccessGrant,
} from './types';
import { BookingDomainEvent } from './events';

export class BookingStore {
  private bookings = new Map<BookingId, BookingAggregate>();
  private reservationHolds = new Map<ReservationHoldId, ReservationHold>();
  private rescheduleRequests = new Map<RescheduleRequestId, RescheduleRequest>();
  private cancellations = new Map<BookingCancellationId, BookingCancellation>();
  private recurringSeries = new Map<BookingSeriesId, RecurringBookingSeries>();
  private seriesOccurrences = new Map<BookingSeriesId, SeriesOccurrence[]>();
  private accessGrants = new Map<BookingAccessGrantId, BookingAccessGrant>();
  
  // Track consumed capacity units per slot interval: key = `${providerId}_${startAt}_${endAt}`
  private capacityAllocations = new Map<string, number>();

  // Idempotency registry: idempotencyKey -> bookingId
  private idempotencyRegistry = new Map<string, BookingId>();

  // Domain event bus
  private eventListeners: Array<(event: BookingDomainEvent) => void> = [];
  private eventLog: BookingDomainEvent[] = [];

  // Concurrency mutex lock for critical slot locking
  private slotLocks = new Set<string>();

  private static instance: BookingStore;

  static getInstance(): BookingStore {
    if (!BookingStore.instance) {
      BookingStore.instance = new BookingStore();
    }
    return BookingStore.instance;
  }

  reset(): void {
    this.bookings.clear();
    this.reservationHolds.clear();
    this.rescheduleRequests.clear();
    this.cancellations.clear();
    this.recurringSeries.clear();
    this.seriesOccurrences.clear();
    this.accessGrants.clear();
    this.capacityAllocations.clear();
    this.idempotencyRegistry.clear();
    this.eventLog = [];
    this.slotLocks.clear();
  }

  // --- Subscriptions & Events ---
  subscribe(listener: (event: BookingDomainEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter(l => l !== listener);
    };
  }

  emit(event: BookingDomainEvent): void {
    this.eventLog.push(event);
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in Booking domain event listener:', err);
      }
    }
  }

  getEventLog(): BookingDomainEvent[] {
    return [...this.eventLog];
  }

  // --- Concurrency & Capacity Lock ---
  private getSlotKey(providerId: ProviderId, startAt: string, endAt: string): string {
    return `${providerId}__${startAt}__${endAt}`;
  }

  getConsumedCapacity(providerId: ProviderId, startAt: string, endAt: string): number {
    const key = this.getSlotKey(providerId, startAt, endAt);
    return this.capacityAllocations.get(key) || 0;
  }

  /**
   * Atomically allocates capacity for a slot.
   * If totalCapacity would be exceeded, fails and throws without mutating.
   */
  atomicAllocateCapacity(
    providerId: ProviderId,
    startAt: string,
    endAt: string,
    unitsToAdd: number,
    maxTotalCapacity: number
  ): boolean {
    const key = this.getSlotKey(providerId, startAt, endAt);
    
    // Acquire lock check
    if (this.slotLocks.has(key)) {
      // In a concurrent execution simulation, another thread currently has this slot locked
      return false;
    }

    this.slotLocks.add(key);
    try {
      const current = this.capacityAllocations.get(key) || 0;
      if (current + unitsToAdd > maxTotalCapacity) {
        return false;
      }
      this.capacityAllocations.set(key, current + unitsToAdd);
      return true;
    } finally {
      this.slotLocks.delete(key);
    }
  }

  releaseCapacity(providerId: ProviderId, startAt: string, endAt: string, unitsToRelease: number): void {
    const key = this.getSlotKey(providerId, startAt, endAt);
    const current = this.capacityAllocations.get(key) || 0;
    const next = Math.max(0, current - unitsToRelease);
    if (next === 0) {
      this.capacityAllocations.delete(key);
    } else {
      this.capacityAllocations.set(key, next);
    }
  }

  // --- Idempotency ---
  findBookingByIdempotencyKey(key: string): BookingAggregate | undefined {
    const id = this.idempotencyRegistry.get(key);
    return id ? this.bookings.get(id) : undefined;
  }

  registerIdempotency(key: string, bookingId: BookingId): void {
    this.idempotencyRegistry.set(key, bookingId);
  }

  // --- Bookings ---
  saveBooking(booking: BookingAggregate): void {
    this.bookings.set(booking.bookingId, { ...booking });
  }

  findBookingById(bookingId: BookingId): BookingAggregate | undefined {
    const b = this.bookings.get(bookingId);
    return b ? { ...b } : undefined;
  }

  getBooking(bookingId: BookingId): BookingAggregate | undefined {
    return this.findBookingById(bookingId);
  }

  listAllBookings(): BookingAggregate[] {
    return Array.from(this.bookings.values()).map(b => ({ ...b }));
  }

  listBookingsByHousehold(householdId: HouseholdId): BookingAggregate[] {
    return Array.from(this.bookings.values())
      .filter(b => b.householdId === householdId)
      .map(b => ({ ...b }));
  }

  listBookingsByOwner(ownerUserId: UserId): BookingAggregate[] {
    return Array.from(this.bookings.values())
      .filter(b => b.ownerUserId === ownerUserId)
      .map(b => ({ ...b }));
  }

  listBookingsByProvider(providerId: ProviderId): BookingAggregate[] {
    return Array.from(this.bookings.values())
      .filter(b => b.providerId === providerId)
      .map(b => ({ ...b }));
  }

  listBookingsByPet(petId: PetId): BookingAggregate[] {
    return Array.from(this.bookings.values())
      .filter(b => b.petIds.includes(petId))
      .map(b => ({ ...b }));
  }

  // --- Reservation Holds ---
  saveHold(hold: ReservationHold): void {
    this.reservationHolds.set(hold.holdId, { ...hold });
  }

  findHoldById(holdId: ReservationHoldId): ReservationHold | undefined {
    const h = this.reservationHolds.get(holdId);
    return h ? { ...h } : undefined;
  }

  listActiveHoldsByProvider(providerId: ProviderId): ReservationHold[] {
    return Array.from(this.reservationHolds.values())
      .filter(h => h.providerId === providerId && h.status === 'ACTIVE')
      .map(h => ({ ...h }));
  }

  listAllHolds(): ReservationHold[] {
    return Array.from(this.reservationHolds.values()).map(h => ({ ...h }));
  }

  // --- Reschedule Requests ---
  saveRescheduleRequest(req: RescheduleRequest): void {
    this.rescheduleRequests.set(req.requestId, { ...req });
  }

  findRescheduleRequestById(id: RescheduleRequestId): RescheduleRequest | undefined {
    const r = this.rescheduleRequests.get(id);
    return r ? { ...r } : undefined;
  }

  listRescheduleRequestsByBooking(bookingId: BookingId): RescheduleRequest[] {
    return Array.from(this.rescheduleRequests.values())
      .filter(r => r.bookingId === bookingId)
      .map(r => ({ ...r }));
  }

  // --- Cancellations ---
  saveCancellation(c: BookingCancellation): void {
    this.cancellations.set(c.cancellationId, { ...c });
  }

  findCancellationById(id: BookingCancellationId): BookingCancellation | undefined {
    const c = this.cancellations.get(id);
    return c ? { ...c } : undefined;
  }

  // --- Access Grants ---
  saveAccessGrant(grant: BookingAccessGrant): void {
    this.accessGrants.set(grant.grantId, { ...grant });
  }

  findAccessGrantById(grantId: BookingAccessGrantId): BookingAccessGrant | undefined {
    const g = this.accessGrants.get(grantId);
    return g ? { ...g } : undefined;
  }

  findActiveAccessGrant(bookingId: BookingId, providerUserId: UserId): BookingAccessGrant | undefined {
    return Array.from(this.accessGrants.values()).find(
      g => g.bookingId === bookingId && g.providerUserId === providerUserId && g.status === 'ACTIVE'
    );
  }

  // --- Recurring Series ---
  saveRecurringSeries(series: RecurringBookingSeries): void {
    this.recurringSeries.set(series.seriesId, { ...series });
  }

  findRecurringSeriesById(seriesId: BookingSeriesId): RecurringBookingSeries | undefined {
    const s = this.recurringSeries.get(seriesId);
    return s ? { ...s } : undefined;
  }

  listRecurringSeriesByOwner(ownerUserId: UserId): RecurringBookingSeries[] {
    return Array.from(this.recurringSeries.values())
      .filter(s => s.ownerUserId === ownerUserId)
      .map(s => ({ ...s }));
  }

  saveOccurrences(seriesId: BookingSeriesId, occurrences: SeriesOccurrence[]): void {
    this.seriesOccurrences.set(seriesId, [...occurrences]);
  }

  getOccurrences(seriesId: BookingSeriesId): SeriesOccurrence[] {
    return this.seriesOccurrences.get(seriesId) || [];
  }
}
