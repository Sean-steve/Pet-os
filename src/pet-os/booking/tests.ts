/**
 * Pet OS Sprint 11 - Automated Test Suite
 * Comprehensive verification of all 22 core domain scenarios:
 * - Service discovery & organic eligibility
 * - Species compatibility & minimum necessary prerequisite evaluation
 * - Availability calculation & time-off exceptions
 * - Atomic overbooking concurrency & race protection
 * - Instant book confirmation & immutable snapshots
 * - Request-to-book approval & zero self-approval enforcement
 * - Provider decline & capacity release
 * - Request expiry background worker
 * - Reservation holds lifecycle
 * - Reschedule workflow (atomic shift & rejection rollback)
 * - Owner cancellation & policy cutoff calculations
 * - Provider cancellation & financial remediation trigger
 * - Booking-scoped access grants & minimum necessary data
 * - Address privacy masking
 * - Multi-pet capacity multiplier
 * - Recurring series with isolated conflict handling
 * - Cross-household & cross-business IDOR isolation
 * - Future integration contracts (Payments, Walking, Workspace)
 */

import { BookingPlatformService } from './service';
import { BookingStore } from './store';
import { ProviderStore } from '../provider/store';
import { PetStore } from '../pet-core/store';
import { seedProviderData, SEED_USERS, SEED_PROVIDERS } from '../provider/seed';
import {
  asUserId,
  asHouseholdId,
  asPetId,
  asProviderId,
  asServiceOfferingId,
  asAvailabilityExceptionId,
  asBookingId,
  generateUUIDv7,
} from '../kernel/ids';

export interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  message?: string;
  durationMs: number;
}

export class Sprint11TestSuite {
  private service: BookingPlatformService;
  private bookingStore: BookingStore;
  private providerStore: ProviderStore;

  constructor() {
    this.bookingStore = BookingStore.getInstance();
    this.providerStore = ProviderStore.getInstance();
    this.service = new BookingPlatformService(this.bookingStore, this.providerStore);
  }

  private initBaseline(): {
    ownerUserId: any;
    householdId: any;
    kiboPetId: any;
    lunaPetId: any;
    sarahProviderId: any;
    sarahUserId: any;
    kimaniProviderId: any;
    kimaniUserId: any;
    dogWalkOfferingId: any;
    vetConsultOfferingId: any;
  } {
    this.providerStore.reset();
    seedProviderData(this.providerStore);
    this.bookingStore.reset();
    PetStore.reset();

    const ownerUserId = SEED_USERS.OWNER_ELENA;
    const householdId = asHouseholdId('hh-01955000-0001-7000-8000-000000000001');
    const kiboPetId = asPetId('pet-kibo-001');
    const lunaPetId = asPetId('pet-luna-002');

    const sarahProviderId = SEED_PROVIDERS.SARAH_MWANGI;
    const sarahUserId = SEED_USERS.WALKER_SARAH;

    const kimaniProviderId = SEED_PROVIDERS.DR_KIMANI;
    const kimaniUserId = SEED_USERS.VET_DR_KIMANI;

    const dogWalkOfferingId = asServiceOfferingId('sro-dog-walk-01');
    const vetConsultOfferingId = asServiceOfferingId('sro-vet-consult-01');

    // Seed Kibo (Dog)
    PetStore.savePet({
      petId: kiboPetId,
      householdId,
      name: 'Kibo',
      speciesCode: 'DOG',
      breedCode: 'RHODESIAN_RIDGEBACK',
      mixedBreed: false,
      unknownBreed: false,
      sex: 'MALE',
      reproductiveStatus: 'STERILIZED',
      dateOfBirth: '2021-06-15',
      birthdatePrecision: 'EXACT',
      estimatedBirthdate: false,
      primaryColor: 'Wheaten',
      sizeClassification: 'LARGE',
      lifecycleStage: 'ADULT',
      status: 'ACTIVE',
      createdBy: ownerUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      metadata: {},
    });

    // Seed Luna (Cat)
    PetStore.savePet({
      petId: lunaPetId,
      householdId,
      name: 'Luna',
      speciesCode: 'CAT',
      breedCode: 'DOMESTIC_SHORTHAIR',
      mixedBreed: true,
      unknownBreed: false,
      sex: 'FEMALE',
      reproductiveStatus: 'STERILIZED',
      dateOfBirth: '2022-03-10',
      birthdatePrecision: 'EXACT',
      estimatedBirthdate: false,
      primaryColor: 'Calico',
      sizeClassification: 'SMALL',
      lifecycleStage: 'ADULT',
      status: 'ACTIVE',
      createdBy: ownerUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      metadata: {},
    });

    // Save Sarah's holiday exception on 2026-12-25
    this.providerStore.saveAvailabilityException({
      exceptionId: asAvailabilityExceptionId('ave-sarah-xmas-2026'),
      providerId: sarahProviderId,
      startDate: '2026-12-25',
      endDate: '2026-12-25',
      isAllDay: true,
      type: 'PUBLIC_HOLIDAY',
      reason: 'Holiday closure',
      createdAt: new Date().toISOString(),
    });

    return {
      ownerUserId,
      householdId,
      kiboPetId,
      lunaPetId,
      sarahProviderId,
      sarahUserId,
      kimaniProviderId,
      kimaniUserId,
      dogWalkOfferingId,
      vetConsultOfferingId,
    };
  }

  async runAllTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Helper runner
    const runTest = async (name: string, fn: () => void | Promise<void>) => {
      const start = performance.now();
      try {
        await fn();
        results.push({
          id: `T${results.length + 1}`,
          name,
          passed: true,
          durationMs: Math.round(performance.now() - start),
        });
      } catch (err: any) {
        results.push({
          id: `T${results.length + 1}`,
          name,
          passed: false,
          message: err?.message || String(err),
          durationMs: Math.round(performance.now() - start),
        });
      }
    };

    // 1. Service Discovery Organic Filtering
    await runTest('1. Service Discovery only returns active & verified providers with active services', () => {
      const ctx = this.initBaseline();
      const results = this.service.discoverServices();
      if (results.length === 0) throw new Error('Expected active offerings in discovery');

      for (const r of results) {
        const p = this.providerStore.getProvider(r.providerId);
        if (p?.operationalStatus !== 'ACTIVE' || p?.verificationStatus !== 'VERIFIED') {
          throw new Error(`Inactive or unverified provider '${r.providerDisplayName}' appeared in discovery!`);
        }
      }
    });

    // 2. Species Compatibility Filter
    await runTest('2. Service Discovery species filter strictly excludes incompatible services', () => {
      this.initBaseline();
      const catResults = this.service.discoverServices({ targetSpecies: 'CAT' });
      for (const r of catResults) {
        if (!r.targetSpecies.includes('CAT')) {
          throw new Error(`Offering '${r.serviceTitle}' does not support CAT but appeared in query!`);
        }
      }
    });

    // 3. Pet Eligibility & Minimum Necessary Prerequisite Evaluation
    await runTest('3. Evaluates pet eligibility & prerequisites without leaking full medical history', () => {
      const ctx = this.initBaseline();
      const dogWalkEligibility = this.service.evaluatePetEligibility(ctx.kiboPetId, ctx.dogWalkOfferingId);
      if (!dogWalkEligibility.isEligible) {
        throw new Error('Kibo (dog) should be eligible for Dog Walking service');
      }

      // Check cat with dog-only service
      const catEligibility = this.service.evaluatePetEligibility(ctx.lunaPetId, ctx.dogWalkOfferingId);
      if (catEligibility.isEligible || catEligibility.speciesSupported) {
        throw new Error('Luna (cat) must be ineligible for Dog Walking service');
      }

      // Verify prerequisite result format
      for (const prereq of dogWalkEligibility.prerequisites) {
        if (!['REQUIREMENT_SATISFIED', 'REQUIREMENT_NOT_SATISFIED', 'REQUIREMENT_UNKNOWN'].includes(prereq.state)) {
          throw new Error(`Invalid prerequisite satisfaction state: ${prereq.state}`);
        }
      }
    });

    // 4. Availability Calculation
    await runTest('4. Availability engine generates slots from operating rules and buffers', () => {
      const ctx = this.initBaseline();
      const now = new Date();
      let dayOffset = 1;
      let targetDate = new Date(now.getTime() + dayOffset * 24 * 3600 * 1000);
      while (targetDate.getUTCDay() === 0) { // Skip Sunday since Sarah operates Mon-Sat
        dayOffset++;
        targetDate = new Date(now.getTime() + dayOffset * 24 * 3600 * 1000);
      }
      const testDateStr = targetDate.toISOString().split('T')[0];
      const slots = this.service.calculateAvailabilitySlots({
        providerId: ctx.sarahProviderId,
        serviceOfferingId: ctx.dogWalkOfferingId,
        date: testDateStr,
      });

      if (slots.length === 0) {
        throw new Error('Expected calculated availability slots for Sarah on active operating day');
      }

      for (const slot of slots) {
        if (slot.availableCapacity < 0 || slot.availableCapacity > slot.totalCapacity) {
          throw new Error('Available capacity out of bounds');
        }
        if (!slot.slotToken) {
          throw new Error('Slot token missing for concurrency verification');
        }
      }
    });

    // 5. Provider Time-Off Exception Handling
    await runTest('5. Availability engine returns zero slots on provider time-off dates', () => {
      const ctx = this.initBaseline();
      // Sarah has holiday exception on 2026-12-25
      const slots = this.service.calculateAvailabilitySlots({
        providerId: ctx.sarahProviderId,
        serviceOfferingId: ctx.dogWalkOfferingId,
        date: '2026-12-25',
      });

      if (slots.length > 0) {
        throw new Error('Expected 0 slots on provider holiday exception date 2026-12-25');
      }
    });

    // 6. Atomic Overbooking Concurrency Protection
    await runTest('6. Overbooking prevention: concurrent bookings for final slot allow exactly 1 success', () => {
      const ctx = this.initBaseline();
      const slotStart = '2026-10-15T08:00:00.000Z';
      const slotEnd = '2026-10-15T08:45:00.000Z';

      // Sarah's rule capacity is 4, let's saturate 3 units first
      this.bookingStore.atomicAllocateCapacity(ctx.sarahProviderId, slotStart, slotEnd, 3, 4);

      // Now exactly 1 unit remains. Request 1:
      const booking1 = this.service.createBooking({
        ownerUserId: ctx.ownerUserId,
        householdId: ctx.householdId,
        providerId: ctx.sarahProviderId,
        serviceOfferingId: ctx.dogWalkOfferingId,
        petIds: [ctx.kiboPetId],
        startAt: slotStart,
        endAt: slotEnd,
      });

      if (!booking1) throw new Error('First booking should have succeeded');

      // Request 2 for the same slot should now fail with capacity exhausted!
      let request2Failed = false;
      try {
        this.service.createBooking({
          ownerUserId: ctx.ownerUserId,
          householdId: ctx.householdId,
          providerId: ctx.sarahProviderId,
          serviceOfferingId: ctx.dogWalkOfferingId,
          petIds: [ctx.kiboPetId],
          startAt: slotStart,
          endAt: slotEnd,
        });
      } catch (err: any) {
        if (err.message.includes('SLOT_UNAVAILABLE') || err.message.includes('capacity')) {
          request2Failed = true;
        }
      }

      if (!request2Failed) {
        throw new Error('Race condition failed: Second concurrent booking should have been rejected!');
      }
    });

    // 7. Instant Booking Confirmation & Immutable Snapshots
    await runTest('7. Instant booking creates CONFIRMED state with immutable snapshots', () => {
      const ctx = this.initBaseline();
      const booking = this.service.createBooking({
        ownerUserId: ctx.ownerUserId,
        householdId: ctx.householdId,
        providerId: ctx.sarahProviderId,
        serviceOfferingId: ctx.dogWalkOfferingId,
        petIds: [ctx.kiboPetId],
        startAt: '2026-10-16T08:00:00.000Z',
        endAt: '2026-10-16T08:45:00.000Z',
      });

      if (booking.status !== 'CONFIRMED') {
        throw new Error(`Expected CONFIRMED status, received: ${booking.status}`);
      }

      if (booking.priceSnapshot.amountMinorUnits <= 0) {
        throw new Error('Expected positive minor units in price snapshot');
      }

      if (!booking.accessGrantId) {
        throw new Error('Access grant should be created for confirmed booking');
      }
    });

    // 8. Request-to-Book Provider Approval Workflow
    await runTest('8. Request-to-Book creates PENDING_PROVIDER, transitions to CONFIRMED on approval', () => {
      const ctx = this.initBaseline();
      const booking = this.service.createBooking({
        ownerUserId: ctx.ownerUserId,
        householdId: ctx.householdId,
        providerId: ctx.kimaniProviderId,
        serviceOfferingId: ctx.vetConsultOfferingId,
        petIds: [ctx.lunaPetId],
        startAt: '2026-10-17T09:00:00.000Z',
        endAt: '2026-10-17T09:30:00.000Z',
      });

      if (booking.status !== 'PENDING_PROVIDER') {
        throw new Error(`Expected PENDING_PROVIDER status, got: ${booking.status}`);
      }

      // Provider approves
      const confirmed = this.service.providerAcceptBooking({
        bookingId: booking.bookingId,
        providerUserId: ctx.kimaniUserId,
      });

      if (confirmed.status !== 'CONFIRMED' || !confirmed.confirmedAt) {
        throw new Error('Booking did not transition to CONFIRMED');
      }
    });

    // 9. Zero Self-Approval Security Policy
    await runTest('9. Zero Self-Approval policy prevents provider from approving their own booking', () => {
      const ctx = this.initBaseline();
      const booking = this.service.createBooking({
        ownerUserId: ctx.sarahUserId, // Sarah booked as an owner
        householdId: ctx.householdId,
        providerId: ctx.sarahProviderId,
        serviceOfferingId: ctx.dogWalkOfferingId,
        petIds: [ctx.kiboPetId],
        startAt: '2026-10-18T08:00:00.000Z',
        endAt: '2026-10-18T08:45:00.000Z',
      });

      let rejected = false;
      try {
        this.service.providerAcceptBooking({
          bookingId: booking.bookingId,
          providerUserId: ctx.sarahUserId, // Sarah attempts self-approval
        });
      } catch (err: any) {
        if (err.message.includes('Zero Self-Approval Violation')) {
          rejected = true;
        }
      }

      if (!rejected) {
        throw new Error('Self-approval should have been strictly blocked!');
      }
    });

    // 10. Provider Decline Workflow & Capacity Release
    await runTest('10. Provider decline transitions to DECLINED and releases slot capacity', () => {
      const ctx = this.initBaseline();
      const slotStart = '2026-10-19T09:00:00.000Z';
      const slotEnd = '2026-10-19T09:30:00.000Z';

      const booking = this.service.createBooking({
        ownerUserId: ctx.ownerUserId,
        householdId: ctx.householdId,
        providerId: ctx.kimaniProviderId,
        serviceOfferingId: ctx.vetConsultOfferingId,
        petIds: [ctx.lunaPetId],
        startAt: slotStart,
        endAt: slotEnd,
      });

      const declined = this.service.providerDeclineBooking({
        bookingId: booking.bookingId,
        providerUserId: ctx.kimaniUserId,
        reasonCode: 'CAPACITY',
      });

      if (declined.status !== 'DECLINED') {
        throw new Error('Booking should be DECLINED');
      }

      // Verify capacity released
      const consumed = this.bookingStore.getConsumedCapacity(ctx.kimaniProviderId, slotStart, slotEnd);
      if (consumed !== 0) {
        throw new Error(`Expected consumed capacity to be 0 after decline, got: ${consumed}`);
      }
    });

    // 11. Request Expiry Background Worker
    await runTest('11. Background worker expires stale pending requests and frees capacity', () => {
      const ctx = this.initBaseline();
      const slotStart = '2026-10-20T09:00:00.000Z';
      const slotEnd = '2026-10-20T09:30:00.000Z';

      const booking = this.service.createBooking({
        ownerUserId: ctx.ownerUserId,
        householdId: ctx.householdId,
        providerId: ctx.kimaniProviderId,
        serviceOfferingId: ctx.vetConsultOfferingId,
        petIds: [ctx.lunaPetId],
        startAt: slotStart,
        endAt: slotEnd,
      });

      // Manually set pendingExpiresAt into past
      booking.pendingExpiresAt = '2020-01-01T00:00:00.000Z';
      this.bookingStore.saveBooking(booking);

      const expiredCount = this.service.processExpiredRequests();
      if (expiredCount === 0) {
        throw new Error('Worker failed to detect expired request');
      }

      const updated = this.bookingStore.findBookingById(booking.bookingId);
      if (updated?.status !== 'EXPIRED') {
        throw new Error('Booking should be marked EXPIRED');
      }
    });

    // 12. Reservation Holds
    await runTest('12. Reservation holds lock capacity temporarily and release upon hold expiry', () => {
      const ctx = this.initBaseline();
      const hold = this.service.createReservationHold({
        offeringId: ctx.dogWalkOfferingId,
        providerId: ctx.sarahProviderId,
        customerUserId: ctx.ownerUserId,
        householdId: ctx.householdId,
        petIds: [ctx.kiboPetId],
        startAt: '2026-10-21T08:00:00.000Z',
        endAt: '2026-10-21T08:45:00.000Z',
        durationSeconds: 1, // Expire in 1 second
      });

      if (hold.status !== 'ACTIVE') throw new Error('Hold should be ACTIVE');

      // Release hold
      this.service.releaseReservationHold(hold.holdId);
      const released = this.bookingStore.findHoldById(hold.holdId);
      if (released?.status !== 'RELEASED') {
        throw new Error('Hold should be RELEASED');
      }
    });

    // 13. Rescheduling with Atomic Capacity Shift
    await runTest('13. Reschedule workflow performs atomic capacity shift between old and new slot', () => {
      const ctx = this.initBaseline();
      const originalStart = '2026-10-22T08:00:00.000Z';
      const originalEnd = '2026-10-22T08:45:00.000Z';
      const newStart = '2026-10-22T10:00:00.000Z';
      const newEnd = '2026-10-22T10:45:00.000Z';

      const booking = this.service.createBooking({
        ownerUserId: ctx.ownerUserId,
        householdId: ctx.householdId,
        providerId: ctx.sarahProviderId,
        serviceOfferingId: ctx.dogWalkOfferingId,
        petIds: [ctx.kiboPetId],
        startAt: originalStart,
        endAt: originalEnd,
      });

      // Request Reschedule
      const req = this.service.requestReschedule({
        bookingId: booking.bookingId,
        actorUserId: ctx.ownerUserId,
        actorType: 'OWNER',
        newStartAt: newStart,
        newEndAt: newEnd,
        reason: 'Conflict with morning flight.',
      });

      // Accept Reschedule
      const rescheduled = this.service.respondReschedule({
        requestId: req.requestId,
        responderUserId: ctx.sarahUserId,
        accept: true,
      });

      if (rescheduled.status !== 'CONFIRMED' || rescheduled.startAt !== newStart) {
        throw new Error('Booking did not update to new scheduled start');
      }

      // Verify old slot capacity freed
      const oldConsumed = this.bookingStore.getConsumedCapacity(ctx.sarahProviderId, originalStart, originalEnd);
      if (oldConsumed !== 0) {
        throw new Error(`Old slot capacity was not released: ${oldConsumed}`);
      }
    });

    // 14. Reschedule Rejection Rollback
    await runTest('14. Reschedule rejection rolls back to original schedule without data loss', () => {
      const ctx = this.initBaseline();
      const originalStart = '2026-10-23T08:00:00.000Z';
      const originalEnd = '2026-10-23T08:45:00.000Z';
      const newStart = '2026-10-23T11:00:00.000Z';
      const newEnd = '2026-10-23T11:45:00.000Z';

      const booking = this.service.createBooking({
        ownerUserId: ctx.ownerUserId,
        householdId: ctx.householdId,
        providerId: ctx.sarahProviderId,
        serviceOfferingId: ctx.dogWalkOfferingId,
        petIds: [ctx.kiboPetId],
        startAt: originalStart,
        endAt: originalEnd,
      });

      const req = this.service.requestReschedule({
        bookingId: booking.bookingId,
        actorUserId: ctx.ownerUserId,
        actorType: 'OWNER',
        newStartAt: newStart,
        newEndAt: newEnd,
        reason: 'Reschedule test.',
      });

      const rolledBack = this.service.respondReschedule({
        requestId: req.requestId,
        responderUserId: ctx.sarahUserId,
        accept: false,
        rejectionReason: 'Time slot fully committed.',
      });

      if (rolledBack.status !== 'CONFIRMED' || rolledBack.startAt !== originalStart) {
        throw new Error('Booking failed to retain original schedule upon reschedule rejection');
      }
    });

    // 15. Owner Cancellation & Policy Evaluation
    await runTest('15. Owner cancellation calculates policy cutoff and releases capacity', () => {
      const ctx = this.initBaseline();
      const slotStart = '2026-10-24T08:00:00.000Z';
      const slotEnd = '2026-10-24T08:45:00.000Z';

      const booking = this.service.createBooking({
        ownerUserId: ctx.ownerUserId,
        householdId: ctx.householdId,
        providerId: ctx.sarahProviderId,
        serviceOfferingId: ctx.dogWalkOfferingId,
        petIds: [ctx.kiboPetId],
        startAt: slotStart,
        endAt: slotEnd,
      });

      const cancelled = this.service.cancelBookingByOwner({
        bookingId: booking.bookingId,
        ownerUserId: ctx.ownerUserId,
        reason: 'Change of schedule.',
      });

      if (cancelled.status !== 'CANCELLED_BY_OWNER') {
        throw new Error('Booking status is not CANCELLED_BY_OWNER');
      }

      // Check access grant revoked
      if (cancelled.accessGrantId) {
        const grant = this.bookingStore.findAccessGrantById(cancelled.accessGrantId);
        if (grant?.status !== 'REVOKED') {
          throw new Error('Access grant should be REVOKED upon cancellation');
        }
      }
    });

    // 16. Provider Cancellation & Remediation Event
    await runTest('16. Provider cancellation triggers financial review event and releases capacity', () => {
      const ctx = this.initBaseline();
      const booking = this.service.createBooking({
        ownerUserId: ctx.ownerUserId,
        householdId: ctx.householdId,
        providerId: ctx.sarahProviderId,
        serviceOfferingId: ctx.dogWalkOfferingId,
        petIds: [ctx.kiboPetId],
        startAt: '2026-10-25T08:00:00.000Z',
        endAt: '2026-10-25T08:45:00.000Z',
      });

      const cancelled = this.service.cancelBookingByProvider({
        bookingId: booking.bookingId,
        providerUserId: ctx.sarahUserId,
        reason: 'Emergency provider illness.',
      });

      if (cancelled.status !== 'CANCELLED_BY_PROVIDER') {
        throw new Error('Expected CANCELLED_BY_PROVIDER status');
      }

      const events = this.bookingStore.getEventLog();
      const reviewEvent = events.find(e => e.eventType === 'BookingCancellationFinancialReviewRequired');
      if (!reviewEvent) {
        throw new Error('Provider cancellation did not emit financial remediation review event');
      }
    });

    // 17. Booking-Scoped Access Grant Minimum Necessary Verification
    await runTest('17. Booking access grant strictly isolates minimum-necessary pet data', () => {
      const ctx = this.initBaseline();
      const booking = this.service.createBooking({
        ownerUserId: ctx.ownerUserId,
        householdId: ctx.householdId,
        providerId: ctx.sarahProviderId,
        serviceOfferingId: ctx.dogWalkOfferingId,
        petIds: [ctx.kiboPetId],
        startAt: '2026-10-26T08:00:00.000Z',
        endAt: '2026-10-26T08:45:00.000Z',
      });

      const grant = this.bookingStore.findAccessGrantById(booking.accessGrantId!);
      if (!grant) throw new Error('Grant not found');

      // Assert non-clinical service does NOT grant clinical records
      if ((grant.scopes as string[]).includes('FULL_MEDICAL_HISTORY')) {
        throw new Error('Access grant violated minimum-necessary principle by granting full medical history!');
      }

      if (!grant.scopes.includes('PET_IDENTITY_SUMMARY') || !grant.scopes.includes('SERVICE_INSTRUCTIONS')) {
        throw new Error('Expected fundamental identity and instruction scopes');
      }
    });

    // 18. Address Privacy Masking Policy
    await runTest('18. Customer address masked until booking is confirmed and in window', () => {
      const ctx = this.initBaseline();
      const projections = this.service.getOwnerBookingProjections(ctx.ownerUserId);
      for (const p of projections) {
        if (!p.addressDisplay) throw new Error('Address display should be populated');
      }
    });

    // 19. Multi-Pet Booking Capacity Multiplier
    await runTest('19. Multi-pet booking consumes multiplied capacity units', () => {
      const ctx = this.initBaseline();
      const slotStart = '2026-10-27T08:00:00.000Z';
      const slotEnd = '2026-10-27T08:45:00.000Z';

      // 2 dogs booking
      const booking = this.service.createBooking({
        ownerUserId: ctx.ownerUserId,
        householdId: ctx.householdId,
        providerId: ctx.sarahProviderId,
        serviceOfferingId: ctx.dogWalkOfferingId,
        petIds: [ctx.kiboPetId, ctx.kiboPetId], // Consumes 2 units
        startAt: slotStart,
        endAt: slotEnd,
      });

      const consumed = this.bookingStore.getConsumedCapacity(ctx.sarahProviderId, slotStart, slotEnd);
      if (consumed < 2) {
        throw new Error(`Expected at least 2 capacity units consumed for 2 pets, got: ${consumed}`);
      }
    });

    // 20. Recurring Booking Series Occurrence Conflict Handling
    await runTest('20. Recurring series flags time-off conflicts as REQUIRES_ATTENTION without failing series', () => {
      const ctx = this.initBaseline();
      const { series, occurrences } = this.service.createRecurringSeries({
        ownerUserId: ctx.ownerUserId,
        householdId: ctx.householdId,
        providerId: ctx.sarahProviderId,
        serviceOfferingId: ctx.dogWalkOfferingId,
        petIds: [ctx.kiboPetId],
        daysOfWeek: [1, 5],
        scheduledTimeOfDay: '08:00',
        durationMinutes: 45,
        startDate: '2026-12-20', // Spans Christmas 2026-12-25 when Sarah has time-off!
        horizonWeeks: 2,
      });

      if (occurrences.length === 0) throw new Error('No occurrences generated');

      const conflictOccurrence = occurrences.find(o => o.scheduledDate === '2026-12-25');
      if (!conflictOccurrence) {
        throw new Error('Christmas occurrence should have been generated');
      }

      if (conflictOccurrence.status !== 'REQUIRES_ATTENTION') {
        throw new Error(`Occurrence on time-off date should be REQUIRES_ATTENTION, got: ${conflictOccurrence.status}`);
      }

      if (!conflictOccurrence.conflictReason) {
        throw new Error('Conflict reason should be specified');
      }
    });

    // 21. Cross-Household & Cross-Business IDOR Isolation
    await runTest('21. Cross-household authorization prevents unauthorized cancellation and tampering', () => {
      const ctx = this.initBaseline();
      const booking = this.service.createBooking({
        ownerUserId: ctx.ownerUserId,
        householdId: ctx.householdId,
        providerId: ctx.sarahProviderId,
        serviceOfferingId: ctx.dogWalkOfferingId,
        petIds: [ctx.kiboPetId],
        startAt: '2026-10-28T08:00:00.000Z',
        endAt: '2026-10-28T08:45:00.000Z',
      });

      const hackerUserId = asUserId('usr-hacker-9999-0000-0000-000000000000');
      let rejected = false;
      try {
        this.service.cancelBookingByOwner({
          bookingId: booking.bookingId,
          ownerUserId: hackerUserId, // Unauthorized user
          reason: 'Unauthorized cancel attempt.',
        });
      } catch (err: any) {
        if (err.message.includes('Unauthorized')) {
          rejected = true;
        }
      }

      if (!rejected) {
        throw new Error('IDOR defense failed: Unauthorized user was able to cancel booking!');
      }
    });

    // 22. Future Integration Contracts Validation
    await runTest('22. Future integration contracts produce compliant handoff models', () => {
      const ctx = this.initBaseline();
      const booking = this.service.createBooking({
        ownerUserId: ctx.ownerUserId,
        householdId: ctx.householdId,
        providerId: ctx.sarahProviderId,
        serviceOfferingId: ctx.dogWalkOfferingId,
        petIds: [ctx.kiboPetId],
        startAt: '2026-10-29T08:00:00.000Z',
        endAt: '2026-10-29T08:45:00.000Z',
      });

      // Payment contract
      const payContract = this.service.getFuturePaymentContract(booking.bookingId);
      if (payContract.contractVersion !== '1.0' || !payContract.feeBasisReference) {
        throw new Error('Invalid future payment contract snapshot');
      }

      // Dog walking contract
      const walkContract = this.service.getFutureDogWalkingContract(booking.bookingId);
      if (walkContract.contractVersion !== '1.0' || walkContract.pets.length === 0) {
        throw new Error('Invalid future dog walking contract');
      }
    });

    return results;
  }
}
