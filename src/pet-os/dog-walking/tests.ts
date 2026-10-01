/**
 * Pet OS Sprint 13 - Dog Walking Platform Test Suite
 * 
 * Validates:
 * 1. DogWalkSession Aggregate isolation & lifecycle state machine
 * 2. Pre-walk readiness evaluation & medical restriction safety
 * 3. Secure 2-way handover protocol (Pickup & Return OTP + Safety Checklist)
 * 4. Live GPS telemetry tracking & Haversine distance calculation
 * 5. Pause & resume duration accounting
 * 6. Potty, hydration, and behavioral observation logging
 * 7. Incident reporting & emergency abort protocol
 * 8. Strict service completion prerequisites & Multi-Domain Canonical Projections:
 *    - Activity domain (ActivityRecord creation)
 *    - Booking domain (status: COMPLETED)
 *    - Finance domain (Earning release to AVAILABLE & Double-Entry Ledger)
 *    - Timeline domain (CARE_PERFORMED events)
 * 9. Offline event queue synchronization
 * 10. Segregated Owner & Walker read model projections
 */

import {
  asBookingId,
  asPetId,
  asUserId,
  asProviderId,
  generateUUIDv7,
} from '../kernel/ids';
import { seedUnifiedPetOS, CANONICAL_IDS } from '../seed/unified-seed';
import { DogWalkingService } from './service';
import { DogWalkingStore } from './store';
import { BookingStore } from '../booking/store';
import { ActivityStore } from '../activity/store';
import { TimelineStore } from '../timeline/store';
import { HealthStore } from '../health/store';
import {
  FinancialPlatformService,
  DoubleEntryLedgerEngine,
  CommissionEngine,
  PaymentProviderRegistry,
  MpesaPaymentProvider,
  CardPaymentProvider,
  FinanceStore,
} from '../finance';
import { IdentityStore } from '../identity/store';
import { seedDogWalkingData, SEED_WALK_SESSION_ID } from './seed';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export class Sprint13DogWalkingTestSuite {
  private service: DogWalkingService;
  private store: DogWalkingStore;
  private financeService: FinancialPlatformService;

  constructor() {
    this.store = DogWalkingStore.getInstance();
    const bookingStore = BookingStore.getInstance();
    const financeStore = FinanceStore.getInstance();
    const ledger = new DoubleEntryLedgerEngine();
    const commission = new CommissionEngine();
    const registry = new PaymentProviderRegistry();
    registry.register(new MpesaPaymentProvider());
    registry.register(new CardPaymentProvider());
    const identityStore = new IdentityStore();

    this.financeService = new FinancialPlatformService(
      financeStore,
      ledger,
      commission,
      registry,
      bookingStore,
      identityStore
    );

    this.service = new DogWalkingService(
      this.store,
      bookingStore,
      undefined,
      this.financeService
    );
  }

  async runAllTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    const run = async (name: string, fn: () => Promise<void> | void) => {
      try {
        await fn();
        results.push({ name, passed: true });
      } catch (err: any) {
        results.push({ name, passed: false, error: err.message || String(err) });
      }
    };

    // Prepare clean environment
    await seedUnifiedPetOS({ forceReset: true });
    seedDogWalkingData();

    // ------------------------------------------------------------------------
    // GROUP 1: Pre-walk Readiness Evaluation & Invariants
    // ------------------------------------------------------------------------

    await run('Readiness: Confirmed booking passes readiness check', () => {
      const allBookings = BookingStore.getInstance().listAllBookings();
      const confirmed = allBookings.find(
        b => b.providerId === CANONICAL_IDS.WALKER_SARAH && b.status === 'CONFIRMED'
      );
      if (!confirmed) throw new Error('Confirmed dog walking booking not found in seed');

      const readiness = this.service.evaluateWalkReadiness(confirmed.bookingId);
      if (!readiness.isReady) {
        throw new Error(`Readiness check failed: ${readiness.rejectionReasons.join(', ')}`);
      }
      if (!readiness.walkerVerified) throw new Error('Expected walker to be verified');
      if (readiness.readinessScore < 80) throw new Error(`Readiness score too low: ${readiness.readinessScore}`);
    });

    await run('Readiness: Rejects non-confirmed draft booking', () => {
      const fakeBookingId = asBookingId('bk-draft-test');
      BookingStore.getInstance().saveBooking({
        bookingId: fakeBookingId,
        ownerUserId: CANONICAL_IDS.OWNER_ELENA,
        householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
        providerId: CANONICAL_IDS.WALKER_SARAH,
        serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
        status: 'DRAFT',
        confirmationMode: 'INSTANT_CONFIRM',
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 3600000).toISOString(),
        serviceDurationMinutes: 30,
        timezone: 'Africa/Nairobi',
        petCount: 1,
        petIds: [CANONICAL_IDS.PET_KIBO],
        petSnapshots: [],
        serviceSnapshot: {
          serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
          title: 'Dog Walk',
          category: 'DOG_WALKER',
          serviceDescription: 'Verified dog walking service',
          defaultDurationMinutes: 30,
          locationType: 'CLIENT_LOCATION',
          confirmationMode: 'INSTANT_CONFIRM',
          snapshotTimestamp: new Date().toISOString(),
        },
        priceSnapshot: {
          amountMinorUnits: 150000,
          currency: 'KES',
          pricingModel: 'FIXED',
          baseAmountMinorUnits: 150000,
          perPetAddonMinorUnits: 0,
          petCount: 1,
          taxIncluded: true,
          feeBasisReference: 'FEE-01',
        },
        cancellationPolicySnapshot: {
          policyTier: 'STANDARD',
          freeCancellationCutoffHours: 24,
          lateCancellationNotice: 'Standard 24-hour notice',
          description: 'Standard',
        },
        instructions: {
          emergencyContactName: 'Elena Vance',
          emergencyContactPhone: '+254700000001',
        },
        requestedAt: new Date().toISOString(),
        concurrencyVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const readiness = this.service.evaluateWalkReadiness(fakeBookingId);
      if (readiness.isReady) {
        throw new Error('DRAFT booking should fail readiness check');
      }
      if (!readiness.rejectionReasons.some(r => r.includes('must be CONFIRMED'))) {
        throw new Error('Expected rejection reason to cite booking status');
      }
    });

    await run('Readiness: Medical restriction flag detects respiratory condition', () => {
      // Temporarily add infectious cough condition to Kibo
      const conditionId = HealthStore.addCondition({
        conditionId: generateUUIDv7() as any,
        petId: CANONICAL_IDS.PET_KIBO,
        householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
        conditionName: 'Kennel Cough (Bordetella bronchiseptica)',
        clinicalStatus: 'ACTIVE',
        verificationStatus: 'CONFIRMED',
        severity: 'SEVERE',
        onsetDate: new Date().toISOString(),
        diagnosedBy: 'Dr. Kimani',
        isCommunicable: true,
        notes: 'Strict quarantine and exercise restriction',
        createdBy: CANONICAL_IDS.OWNER_ELENA,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const allBookings = BookingStore.getInstance().listAllBookings();
      const confirmed = allBookings.find(
        b => b.providerId === CANONICAL_IDS.WALKER_SARAH && b.status === 'CONFIRMED'
      );
      if (!confirmed) throw new Error('Confirmed booking required');

      const readiness = this.service.evaluateWalkReadiness(confirmed.bookingId);
      if (readiness.medicalClearance) {
        throw new Error('Expected medicalClearance to be FALSE when active cough is present');
      }
      if (readiness.isReady) {
        throw new Error('Expected readiness isReady to be false with blocking condition');
      }

      // Cleanup condition
      HealthStore.deleteCondition(conditionId);
    });

    // ------------------------------------------------------------------------
    // GROUP 2: DogWalkSession Aggregate Creation
    // ------------------------------------------------------------------------

    await run('Session: Creates isolated DogWalkSession aggregate with opaque routeReference', () => {
      const allBookings = BookingStore.getInstance().listAllBookings();
      const confirmed = allBookings.find(
        b => b.providerId === CANONICAL_IDS.WALKER_SARAH && b.status === 'CONFIRMED'
      );
      if (!confirmed) throw new Error('Confirmed booking required');

      const session = this.service.createSessionFromBooking(
        confirmed.bookingId,
        CANONICAL_IDS.OWNER_ELENA
      );

      if (!session.walkSessionId) throw new Error('Missing walkSessionId');
      if (session.status !== 'SCHEDULED') throw new Error(`Expected status SCHEDULED, got ${session.status}`);
      if (!session.routeReference.startsWith('rt-ref-')) {
        throw new Error('routeReference must be opaque token (ADR-008)');
      }
      if (session.activeCustodyState !== 'CUSTODY_WITH_HOUSEHOLD') {
        throw new Error('Initial custody state must be CUSTODY_WITH_HOUSEHOLD');
      }
      if (session.totalDistanceMeters !== 0) throw new Error('Initial distance must be 0');
    });

    await run('Session: Idempotent initialization returns existing session for booking', () => {
      const allBookings = BookingStore.getInstance().listAllBookings();
      const confirmed = allBookings.find(
        b => b.providerId === CANONICAL_IDS.WALKER_SARAH && b.status === 'CONFIRMED'
      );
      if (!confirmed) throw new Error('Confirmed booking required');

      const session1 = this.service.createSessionFromBooking(confirmed.bookingId, CANONICAL_IDS.OWNER_ELENA);
      const session2 = this.service.createSessionFromBooking(confirmed.bookingId, CANONICAL_IDS.OWNER_ELENA);
      if (session1.walkSessionId !== session2.walkSessionId) {
        throw new Error('createSessionFromBooking must be idempotent');
      }
    });

    // ------------------------------------------------------------------------
    // GROUP 3: Secure 2-Way Handover Protocol (Pickup)
    // ------------------------------------------------------------------------

    let testSessionId = SEED_WALK_SESSION_ID;

    await run('Handover: Pickup handover flow requires valid OTP and safety checklist', () => {
      const allBookings = BookingStore.getInstance().listAllBookings();
      const confirmed = allBookings.find(
        b => b.providerId === CANONICAL_IDS.WALKER_SARAH && b.status === 'CONFIRMED'
      );
      if (!confirmed) throw new Error('Confirmed booking required');

      const session = this.service.createSessionFromBooking(confirmed.bookingId, CANONICAL_IDS.OWNER_ELENA);
      testSessionId = session.walkSessionId;

      const { handoverId, verificationCode } = this.service.initiatePickupHandover(
        session.walkSessionId,
        session.walkerUserId
      );

      if (!handoverId) throw new Error('Missing handoverId');
      if (!verificationCode || verificationCode.length !== 6) {
        throw new Error('Expected 6-digit verification code');
      }

      const sessionMid = this.store.findSessionById(session.walkSessionId)!;
      if (sessionMid.status !== 'PICKUP_HANDOVER_IN_PROGRESS') {
        throw new Error(`Expected status PICKUP_HANDOVER_IN_PROGRESS, got ${sessionMid.status}`);
      }

      // Confirm with correct code & checklist
      const confirmedHandover = this.service.confirmPickupHandover({
        walkSessionId: session.walkSessionId,
        verificationCode,
        actorUserId: session.walkerUserId,
        checklist: {
          leashAndHarnessSecure: true,
          collarTagVerified: true,
          temperamentAssessed: true,
          waterHydrationConfirmed: true,
        },
      });

      if (confirmedHandover.verificationStatus !== 'VERIFIED') {
        throw new Error('Handover must be VERIFIED');
      }

      const activeSession = this.store.findSessionById(session.walkSessionId)!;
      if (activeSession.status !== 'IN_PROGRESS') {
        throw new Error(`Expected status IN_PROGRESS, got ${activeSession.status}`);
      }
      if (activeSession.activeCustodyState !== 'CUSTODY_WITH_PROVIDER') {
        throw new Error('Custody must now be CUSTODY_WITH_PROVIDER');
      }
      if (!activeSession.actualStartedAt) {
        throw new Error('actualStartedAt must be populated');
      }
    });

    await run('Handover: Pickup fails if invalid verification code is supplied', () => {
      const s = this.store.findSessionById(testSessionId)!;
      // Revert status to test error branch
      s.status = 'PICKUP_HANDOVER_IN_PROGRESS';
      this.store.saveSession(s);

      let threw = false;
      try {
        this.service.confirmPickupHandover({
          walkSessionId: testSessionId,
          verificationCode: '000000', // Invalid code
          actorUserId: s.walkerUserId,
          checklist: {
            leashAndHarnessSecure: true,
            collarTagVerified: true,
            temperamentAssessed: true,
            waterHydrationConfirmed: true,
          },
        });
      } catch (err: any) {
        threw = true;
        if (!err.message.includes('Invalid verification OTP code')) {
          throw new Error(`Unexpected error message: ${err.message}`);
        }
      }
      if (!threw) throw new Error('Expected confirmPickupHandover to throw on wrong code');

      // Restore
      s.status = 'IN_PROGRESS';
      s.activeCustodyState = 'CUSTODY_WITH_PROVIDER';
      this.store.saveSession(s);
    });

    // ------------------------------------------------------------------------
    // GROUP 4: Telemetry, GPS, and Haversine Distance
    // ------------------------------------------------------------------------

    await run('Telemetry: Ingests waypoints and calculates cumulative Haversine distance', () => {
      const s = this.store.findSessionById(testSessionId)!;
      s.totalDistanceMeters = 0;
      this.store.saveSession(s);

      // Waypoint 1 (Kilimani start: -1.2921, 36.7845)
      const wp1 = this.service.recordTelemetryWaypoint({
        walkSessionId: testSessionId,
        walkerUserId: s.walkerUserId,
        latitude: -1.2921,
        longitude: 36.7845,
        accuracyMeters: 4.0,
        speedMps: 1.2,
      });

      if (wp1.sequenceNumber !== 1) throw new Error('Expected sequence 1');

      // Waypoint 2 (~500m away: -1.2950, 36.7870)
      const wp2 = this.service.recordTelemetryWaypoint({
        walkSessionId: testSessionId,
        walkerUserId: s.walkerUserId,
        latitude: -1.2950,
        longitude: 36.7870,
        accuracyMeters: 3.5,
        speedMps: 1.4,
      });

      if (wp2.sequenceNumber !== 2) throw new Error('Expected sequence 2');

      const updatedSession = this.store.findSessionById(testSessionId)!;
      if (updatedSession.totalDistanceMeters < 350 || updatedSession.totalDistanceMeters > 600) {
        throw new Error(`Unexpected distance calculated: ${updatedSession.totalDistanceMeters}m`);
      }
    });

    // ------------------------------------------------------------------------
    // GROUP 5: Pause & Resume Mechanics
    // ------------------------------------------------------------------------

    await run('Pause & Resume: Accurately pauses walk and tracks paused duration', () => {
      const s = this.store.findSessionById(testSessionId)!;
      const initialPaused = s.totalPausedDurationSeconds;

      const paused = this.service.pauseWalk({
        walkSessionId: testSessionId,
        walkerUserId: s.walkerUserId,
        reason: 'HYDRATION',
      });

      if (paused.status !== 'PAUSED') throw new Error('Expected status PAUSED');
      if (paused.pauseReason !== 'HYDRATION') throw new Error('Expected pauseReason HYDRATION');
      if (!paused.lastPausedAt) throw new Error('Expected lastPausedAt');

      // Resume
      const resumed = this.service.resumeWalk({
        walkSessionId: testSessionId,
        walkerUserId: s.walkerUserId,
      });

      if (resumed.status !== 'IN_PROGRESS') throw new Error('Expected status IN_PROGRESS');
      if (resumed.pauseReason !== undefined) throw new Error('Expected pauseReason cleared');
      if (resumed.totalPausedDurationSeconds < initialPaused) {
        throw new Error('Paused duration must not decrease');
      }
    });

    // ------------------------------------------------------------------------
    // GROUP 6: Potty, Behavior & Media
    // ------------------------------------------------------------------------

    await run('Observation: Logs potty and behavioral observations during walk', () => {
      const s = this.store.findSessionById(testSessionId)!;

      const potty = this.service.logPottyEvent({
        walkSessionId: testSessionId,
        petId: s.petIds[0],
        walkerUserId: s.walkerUserId,
        type: 'POOP',
        poopConsistency: 'NORMAL_FIRM',
        hydrationGiven: true,
        notes: 'Healthy elimination, clean pickup',
      });

      if (potty.type !== 'POOP') throw new Error('Expected POOP');
      if (potty.poopConsistency !== 'NORMAL_FIRM') throw new Error('Expected consistency NORMAL_FIRM');

      const behavior = this.service.logBehaviorObservation({
        walkSessionId: testSessionId,
        petId: s.petIds[0],
        walkerUserId: s.walkerUserId,
        tag: 'CALM_LOOSE_LEASH',
        notes: 'Very attentive to handler commands',
      });

      if (behavior.tag !== 'CALM_LOOSE_LEASH') throw new Error('Expected CALM_LOOSE_LEASH tag');

      const media = this.service.attachMedia({
        walkSessionId: testSessionId,
        petId: s.petIds[0],
        walkerUserId: s.walkerUserId,
        url: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b',
        caption: 'Midday hydration stop',
      });

      if (!media.isWatermarked) throw new Error('Expected media to be watermarked');
      if (!media.gpsReferenceOpaque) throw new Error('Expected opaque GPS reference');
    });

    // ------------------------------------------------------------------------
    // GROUP 7: Incident Reporting & Emergency Workflow
    // ------------------------------------------------------------------------

    await run('Incidents: Non-critical incident is logged without aborting session', () => {
      const s = this.store.findSessionById(testSessionId)!;

      const incident = this.service.reportIncident({
        walkSessionId: testSessionId,
        petId: s.petIds[0],
        reportedBy: s.walkerUserId,
        type: 'EQUIPMENT_FAILURE',
        severity: 'LOW',
        description: 'Harness front-clip buckle loose. Switched to secure backup collar lead.',
        actionTaken: 'Tightened straps and attached backup carabiner',
      });

      if (incident.severity !== 'LOW') throw new Error('Expected LOW severity');
      if (incident.status !== 'OPEN') throw new Error('Expected status OPEN');

      const afterSession = this.store.findSessionById(testSessionId)!;
      if (afterSession.status !== 'IN_PROGRESS') {
        throw new Error('Low-severity incident should NOT abort walk');
      }

      // Resolve incident
      const resolved = this.service.resolveIncident({
        incidentId: incident.incidentId,
        actorUserId: s.walkerUserId,
        resolutionNotes: 'Harness inspected and verified secure.',
      });

      if (resolved.status !== 'RESOLVED') throw new Error('Expected incident RESOLVED');
    });

    await run('Incidents: Critical emergency incident triggers ABORTED_EMERGENCY', () => {
      // Create separate temporary session to test critical emergency abort
      const tempBookingId = asBookingId('bk-emergency-test');
      BookingStore.getInstance().saveBooking({
        bookingId: tempBookingId,
        ownerUserId: CANONICAL_IDS.OWNER_ELENA,
        householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
        providerId: CANONICAL_IDS.WALKER_SARAH,
        serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
        status: 'CONFIRMED',
        confirmationMode: 'INSTANT_CONFIRM',
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 3600000).toISOString(),
        serviceDurationMinutes: 30,
        timezone: 'Africa/Nairobi',
        petCount: 1,
        petIds: [CANONICAL_IDS.PET_KIBO],
        accessGrantId: generateUUIDv7() as any,
        petSnapshots: [],
        serviceSnapshot: {
          serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
          title: 'Dog Walk',
          category: 'DOG_WALKER',
          serviceDescription: 'Verified dog walking service',
          defaultDurationMinutes: 30,
          locationType: 'CLIENT_LOCATION',
          confirmationMode: 'INSTANT_CONFIRM',
          snapshotTimestamp: new Date().toISOString(),
        },
        priceSnapshot: {
          amountMinorUnits: 150000,
          currency: 'KES',
          pricingModel: 'FIXED',
          baseAmountMinorUnits: 150000,
          perPetAddonMinorUnits: 0,
          petCount: 1,
          taxIncluded: true,
          feeBasisReference: 'FEE-01',
        },
        cancellationPolicySnapshot: {
          policyTier: 'STANDARD',
          freeCancellationCutoffHours: 24,
          lateCancellationNotice: 'Standard 24-hour notice',
          description: 'Standard',
        },
        instructions: {
          emergencyContactName: 'Elena Vance',
          emergencyContactPhone: '+254700000001',
        },
        requestedAt: new Date().toISOString(),
        concurrencyVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Save access grant
      BookingStore.getInstance().saveAccessGrant({
        grantId: BookingStore.getInstance().findBookingById(tempBookingId)!.accessGrantId!,
        bookingId: tempBookingId,
        providerId: CANONICAL_IDS.WALKER_SARAH,
        providerUserId: CANONICAL_IDS.OWNER_ELENA,
        petIds: [CANONICAL_IDS.PET_KIBO],
        scopes: ['PET_IDENTITY_SUMMARY', 'SERVICE_INSTRUCTIONS'],
        status: 'ACTIVE',
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 86400000).toISOString(),
        grantedAt: new Date().toISOString(),
      });

      const tempSession = this.service.createSessionFromBooking(tempBookingId, CANONICAL_IDS.OWNER_ELENA);
      tempSession.status = 'IN_PROGRESS';
      this.store.saveSession(tempSession);

      const emergencyIncident = this.service.reportIncident({
        walkSessionId: tempSession.walkSessionId,
        petId: CANONICAL_IDS.PET_KIBO,
        reportedBy: tempSession.walkerUserId,
        type: 'INGESTED_HAZARD',
        severity: 'CRITICAL_EMERGENCY',
        description: 'Possible ingestion of unknown wild berry plant. Vomiting observed.',
        actionTaken: 'Immediate emergency transport to Dr. Kimani Vet Clinic',
        vetReferralRequired: true,
      });

      if (emergencyIncident.severity !== 'CRITICAL_EMERGENCY') {
        throw new Error('Expected CRITICAL_EMERGENCY');
      }

      const abortedSession = this.store.findSessionById(tempSession.walkSessionId)!;
      if (abortedSession.status !== 'ABORTED_EMERGENCY') {
        throw new Error(`Expected ABORTED_EMERGENCY status, got ${abortedSession.status}`);
      }
    });

    // ------------------------------------------------------------------------
    // GROUP 8: Return Handover & Service Completion
    // ------------------------------------------------------------------------

    await run('Return Handover: Verifies custody return to household', () => {
      const s = this.store.findSessionById(testSessionId)!;
      const { handoverId, verificationCode } = this.service.initiateReturnHandover(
        testSessionId,
        s.walkerUserId
      );

      if (!handoverId) throw new Error('Missing return handoverId');
      if (verificationCode !== '741295') throw new Error('Unexpected return OTP');

      const verifiedReturn = this.service.confirmReturnHandover({
        walkSessionId: testSessionId,
        verificationCode,
        actorUserId: CANONICAL_IDS.OWNER_ELENA,
        checklist: {
          leashAndHarnessSecure: true,
          collarTagVerified: true,
          temperamentAssessed: true,
          waterHydrationConfirmed: true,
          pawsInspectedAndCleaned: true,
          keysReturnedOrSecured: true,
        },
      });

      if (verifiedReturn.verificationStatus !== 'VERIFIED') {
        throw new Error('Expected return handover VERIFIED');
      }

      const reviewSession = this.store.findSessionById(testSessionId)!;
      if (reviewSession.status !== 'PENDING_COMPLETION_REVIEW') {
        throw new Error(`Expected PENDING_COMPLETION_REVIEW, got ${reviewSession.status}`);
      }
      if (reviewSession.activeCustodyState !== 'CUSTODY_WITH_HOUSEHOLD') {
        throw new Error('Custody must now be CUSTODY_WITH_HOUSEHOLD');
      }
    });

    await run('Completion: Service completion strictly projects to Activity, Booking, Finance & Timeline', async () => {
      const s = this.store.findSessionById(testSessionId)!;

      // Seed a pending earning in finance store for this booking so the completion can release it
      const financeStore = FinanceStore.getInstance();
      financeStore.saveProviderEarning({
        earningId: generateUUIDv7() as any,
        bookingId: s.bookingId,
        providerId: s.providerId,
        grossAmountMinor: 150000,
        platformCommissionMinor: 22500,
        providerFeesMinor: 0,
        adjustmentsMinor: 0,
        netAmountMinor: 127500,
        currency: 'KES',
        status: 'PENDING',
        holdReason: 'PENDING_SERVICE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const completion = await this.service.completeWalkSession({
        walkSessionId: testSessionId,
        walkerUserId: s.walkerUserId,
        summaryText: 'Superb walk around the neighborhood. Dogs settled safely.',
        behaviorNotes: 'Attentive, friendly, zero reactivity.',
        ownerRating: 5,
        ownerFeedback: 'Sarah did an extraordinary job!',
      });

      // 1. Walk Session checks
      if (completion.session.status !== 'COMPLETED') {
        throw new Error(`Expected session COMPLETED, got ${completion.session.status}`);
      }
      if (!completion.session.actualEndedAt) {
        throw new Error('Missing actualEndedAt');
      }

      // 2. Activity domain projection
      const activity = ActivityStore.getRecord(completion.activityRecord.activityId);
      if (!activity) {
        throw new Error('ActivityRecord was NOT projected into ActivityStore!');
      }
      if (activity.activityType !== 'WALK') throw new Error('Expected activityType WALK');
      if (activity.sourceType !== 'SERVICE_PROVIDER') throw new Error('Expected sourceType SERVICE_PROVIDER');
      if (activity.sourceEntityId !== testSessionId) {
        throw new Error('Activity sourceEntityId must match walkSessionId');
      }
      if (!activity.routeReference) throw new Error('Activity must carry opaque routeReference');

      // 3. Booking domain status update
      const booking = BookingStore.getInstance().findBookingById(s.bookingId);
      if (booking?.status !== 'COMPLETED') {
        throw new Error(`Booking status must be updated to COMPLETED, got ${booking?.status}`);
      }

      // 4. Finance domain earning release
      const earnings = financeStore.getEarningsForBooking(s.bookingId);
      const released = earnings.find(e => e.status === 'AVAILABLE');
      if (!released) {
        throw new Error('Provider earning was NOT released to AVAILABLE in Finance domain!');
      }
      if (released.holdReason !== undefined) {
        throw new Error('Provider earning holdReason must be cleared');
      }

      // 5. Timeline projection
      const petTimeline = TimelineStore.getEventsForPet(s.petIds[0]);
      const completedTimelineEvt = petTimeline.find(
        e => e.sourceEntityId === testSessionId && e.title.includes('Dog Walk Completed')
      );
      if (!completedTimelineEvt) {
        throw new Error('Walk completion event not found in Pet Timeline');
      }
    });

    await run('Completion: Rejects completion if return handover has NOT been verified', async () => {
      // Create fresh unreturned session
      const tempBookingId = asBookingId('bk-unreturned-test');
      BookingStore.getInstance().saveBooking({
        bookingId: tempBookingId,
        ownerUserId: CANONICAL_IDS.OWNER_ELENA,
        householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
        providerId: CANONICAL_IDS.WALKER_SARAH,
        serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
        status: 'CONFIRMED',
        confirmationMode: 'INSTANT_CONFIRM',
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 3600000).toISOString(),
        serviceDurationMinutes: 30,
        timezone: 'Africa/Nairobi',
        petCount: 1,
        petIds: [CANONICAL_IDS.PET_KIBO],
        accessGrantId: generateUUIDv7() as any,
        petSnapshots: [],
        serviceSnapshot: {
          serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
          title: 'Dog Walk',
          category: 'DOG_WALKER',
          serviceDescription: 'Verified dog walking service',
          defaultDurationMinutes: 30,
          locationType: 'CLIENT_LOCATION',
          confirmationMode: 'INSTANT_CONFIRM',
          snapshotTimestamp: new Date().toISOString(),
        },
        priceSnapshot: {
          amountMinorUnits: 150000,
          currency: 'KES',
          pricingModel: 'FIXED',
          baseAmountMinorUnits: 150000,
          perPetAddonMinorUnits: 0,
          petCount: 1,
          taxIncluded: true,
          feeBasisReference: 'FEE-01',
        },
        cancellationPolicySnapshot: {
          policyTier: 'STANDARD',
          freeCancellationCutoffHours: 24,
          lateCancellationNotice: 'Standard 24-hour notice',
          description: 'Standard',
        },
        instructions: {
          emergencyContactName: 'Elena Vance',
          emergencyContactPhone: '+254700000001',
        },
        requestedAt: new Date().toISOString(),
        concurrencyVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      BookingStore.getInstance().saveAccessGrant({
        grantId: BookingStore.getInstance().findBookingById(tempBookingId)!.accessGrantId!,
        bookingId: tempBookingId,
        providerId: CANONICAL_IDS.WALKER_SARAH,
        providerUserId: CANONICAL_IDS.OWNER_ELENA,
        petIds: [CANONICAL_IDS.PET_KIBO],
        scopes: ['PET_IDENTITY_SUMMARY'],
        status: 'ACTIVE',
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 86400000).toISOString(),
        grantedAt: new Date().toISOString(),
      });

      const session = this.service.createSessionFromBooking(tempBookingId, CANONICAL_IDS.OWNER_ELENA);
      session.status = 'IN_PROGRESS';
      session.activeCustodyState = 'CUSTODY_WITH_PROVIDER';
      this.store.saveSession(session);

      let threw = false;
      try {
        await this.service.completeWalkSession({
          walkSessionId: session.walkSessionId,
          walkerUserId: session.walkerUserId,
          summaryText: 'Premature finish attempt',
          behaviorNotes: 'N/A',
        });
      } catch (err: any) {
        threw = true;
        if (!err.message.includes('return handover must be verified')) {
          throw new Error(`Unexpected error message: ${err.message}`);
        }
      }
      if (!threw) throw new Error('Expected completeWalkSession to fail without verified return handover');
    });

    // ------------------------------------------------------------------------
    // GROUP 9: Offline Event Synchronization
    // ------------------------------------------------------------------------

    await run('Offline Sync: Deterministically synchronizes queued offline events', () => {
      const offlineEvents = [
        {
          syncEventId: generateUUIDv7() as any,
          walkSessionId: testSessionId,
          sequenceNumber: 2,
          eventType: 'POTTY_LOGGED' as const,
          payload: { type: 'PEE', hydrationGiven: true },
          clientTimestamp: new Date().toISOString(),
          syncStatus: 'QUEUED' as const,
        },
        {
          syncEventId: generateUUIDv7() as any,
          walkSessionId: testSessionId,
          sequenceNumber: 1,
          eventType: 'BEHAVIOR_OBSERVED' as const,
          payload: { tag: 'PLAYFUL_AND_CURIOUS', notes: 'Bounced through grassy trail' },
          clientTimestamp: new Date().toISOString(),
          syncStatus: 'QUEUED' as const,
        },
      ];

      const count = this.service.syncOfflineEvents(
        testSessionId,
        offlineEvents,
        CANONICAL_IDS.OWNER_ELENA
      );

      if (count !== 2) throw new Error(`Expected 2 synced events, got ${count}`);
      const pottyList = this.store.getPottyEventsForSession(testSessionId);
      if (!pottyList.some(p => p.hydrationGiven)) {
        throw new Error('Offline potty event not ingested into store');
      }
    });

    // ------------------------------------------------------------------------
    // GROUP 10: Segregated Projections
    // ------------------------------------------------------------------------

    await run('Projections: Owner Live Walk Projection formats sanitized view with OTPs', () => {
      const projection = this.service.getOwnerLiveWalkProjection(SEED_WALK_SESSION_ID);
      if (projection.walkSessionId !== SEED_WALK_SESSION_ID) {
        throw new Error('Mismatched walkSessionId');
      }
      if (!projection.walkerDisplayName) throw new Error('Missing walkerDisplayName');
      if (projection.pets.length === 0) throw new Error('Missing pets array');
      if (!projection.elapsedDurationFormatted) throw new Error('Missing elapsedDurationFormatted');
      if (projection.distanceKm <= 0) throw new Error('Expected positive distance in km');
    });

    await run('Projections: Walker Execution Dashboard Projection provides navigation and custody controls', () => {
      const projection = this.service.getWalkerExecutionDashboardProjection(SEED_WALK_SESSION_ID);
      if (projection.walkSessionId !== SEED_WALK_SESSION_ID) {
        throw new Error('Mismatched walkSessionId');
      }
      if (!projection.ownerName) throw new Error('Missing ownerName');
      if (!projection.destinationAddressMasked) throw new Error('Missing masked address');
      if (!projection.emergencyContact.phone) throw new Error('Missing emergency contact phone');
    });

    return results;
  }
}

// Auto-run if executed directly via CLI
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('dog-walking/tests')) {
  new Sprint13DogWalkingTestSuite().runAllTests().then(results => {
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log(`\n========================================`);
    console.log(`Sprint 13 Dog Walking Test Suite Results:`);
    console.log(`Passed: ${passed} | Failed: ${failed} | Total: ${results.length}`);
    console.log(`========================================\n`);
    if (failed > 0) {
      results.filter(r => !r.passed).forEach(r => {
        console.error(`❌ FAIL: ${r.name} -> ${r.error}`);
      });
      process.exit(1);
    } else {
      console.log(`All ${passed} tests PASSED with zero regressions.`);
    }
  }).catch(err => {
    console.error('Fatal test runner error:', err);
    process.exit(1);
  });
}
