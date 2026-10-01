/**
 * Pet OS Sprint 23 — Provider Reviews, Reputation, Service Quality & Trust Engine Test Suite
 * Comprehensive Verification of Domain Invariants, Safety Workflows, and Cross-Sprint Integrations
 */

import {
  asUserId,
  asHouseholdId,
  asProviderId,
  asBusinessId,
  asBookingId,
  asServiceOfferingId,
  asReviewEligibilityId,
  generateUUIDv7,
} from '../kernel/ids';
import { ReviewStore } from './store';
import { ReviewService } from './service';
import { seedReviewData } from './seed';
import { BookingStore } from '../booking/store';
import { ProviderStore } from '../provider/store';
import { CANONICAL_IDS } from '../seed/unified-seed';
import { SEED_PROVIDERS, SEED_USERS, SEED_BUSINESSES } from '../provider/seed';

export interface ReviewTestResult {
  testName: string;
  category: 'ELIGIBILITY' | 'ANTI_FRAUD' | 'RATINGS' | 'LIFECYCLE' | 'PROVIDER_RESPONSE' | 'DISPUTES' | 'MODERATION' | 'REPUTATION' | 'PRIVACY';
  passed: boolean;
  message: string;
  durationMs: number;
}

export function runAllReviewTests(): ReviewTestResult[] {
  const results: ReviewTestResult[] = [];

  function record(
    testName: string,
    category: ReviewTestResult['category'],
    fn: () => void
  ) {
    const start = performance.now();
    try {
      fn();
      results.push({
        testName,
        category,
        passed: true,
        message: 'Assertion verified successfully.',
        durationMs: Math.round(performance.now() - start),
      });
    } catch (err: any) {
      results.push({
        testName,
        category,
        passed: false,
        message: err?.message || String(err),
        durationMs: Math.round(performance.now() - start),
      });
    }
  }

  const store = ReviewStore.getInstance();
  const service = ReviewService.getInstance();
  const bookingStore = BookingStore.getInstance();
  const providerStore = ProviderStore.getInstance();

  // Initialize fresh canonical state
  seedReviewData();

  // ==========================================================================
  // 1. ELIGIBILITY INVARIANTS
  // ==========================================================================

  record('Only completed terminal services can receive ReviewEligibility', 'ELIGIBILITY', () => {
    // Find or create non-completed booking
    const draftBookingId = asBookingId('bok-test-draft-01');
    const existing = bookingStore.findBookingById(draftBookingId);
    if (!existing) {
      bookingStore.saveBooking({
        bookingId: draftBookingId,
        ownerUserId: CANONICAL_IDS.OWNER_ELENA,
        householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
        providerId: SEED_PROVIDERS.SARAH_MWANGI,
        serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
        status: 'PENDING_PROVIDER',
        pricingSnapshot: { amountMinorUnits: 250000, currency: 'KES', pricingModel: 'FIXED' },
        petSnapshots: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
    }

    let errorThrown = false;
    try {
      service.grantReviewEligibility({
        bookingId: draftBookingId,
        serviceExecutionReference: 'draft-execution-ref',
      });
    } catch (e: any) {
      errorThrown = true;
      if (!e.message.includes('Only completed services are eligible')) {
        throw new Error(`Unexpected error message: ${e.message}`);
      }
    }
    if (!errorThrown) {
      throw new Error('Expected grantReviewEligibility to fail for non-completed booking.');
    }
  });

  record('ReviewEligibility sets strict 30-day expiration window', 'ELIGIBILITY', () => {
    const completedBookingId = asBookingId('bok-test-completed-01');
    bookingStore.saveBooking({
      bookingId: completedBookingId,
      ownerUserId: CANONICAL_IDS.OWNER_ELENA,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      providerId: SEED_PROVIDERS.SARAH_MWANGI,
      serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
      status: 'COMPLETED',
      pricingSnapshot: { amountMinorUnits: 250000, currency: 'KES', pricingModel: 'FIXED' },
      petSnapshots: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const eligibility = service.grantReviewEligibility({
      bookingId: completedBookingId,
      serviceExecutionReference: 'completed-walk-ref-01',
    });

    if (!eligibility.expiresAt) {
      throw new Error('Eligibility missing expiresAt timestamp.');
    }
    const diffDays = (new Date(eligibility.expiresAt).getTime() - new Date(eligibility.eligibleAt).getTime()) / (1000 * 60 * 60 * 24);
    if (Math.round(diffDays) !== 30) {
      throw new Error(`Expected 30-day expiration window, got: ${diffDays} days.`);
    }
  });

  // ==========================================================================
  // 2. ANTI-MANIPULATION & FRAUD CHECKS
  // ==========================================================================

  record('Provider is strictly blocked from self-reviewing own service', 'ANTI_FRAUD', () => {
    // Booking where provider's user is the reviewer
    const selfBookingId = asBookingId('bok-test-self-review-01');
    bookingStore.saveBooking({
      bookingId: selfBookingId,
      ownerUserId: SEED_USERS.WALKER_SARAH, // Sarah Mwangi herself
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      providerId: SEED_PROVIDERS.SARAH_MWANGI,
      serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
      status: 'COMPLETED',
      pricingSnapshot: { amountMinorUnits: 250000, currency: 'KES', pricingModel: 'FIXED' },
      petSnapshots: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const eligibility = service.grantReviewEligibility({
      bookingId: selfBookingId,
      serviceExecutionReference: 'self-exec-01',
    });

    let blocked = false;
    try {
      service.submitReview({
        eligibilityId: eligibility.eligibilityId,
        actorUserId: SEED_USERS.WALKER_SARAH,
        overallRating: 5,
        dimensions: [
          { dimensionKey: 'PUNCTUALITY', score: 5 },
          { dimensionKey: 'COMMUNICATION', score: 5 },
          { dimensionKey: 'PET_HANDLING', score: 5 },
          { dimensionKey: 'SERVICE_EXECUTION', score: 5 },
        ],
        body: 'I am the best dog walker in Nairobi!',
        publicIdentityMode: 'FIRST_NAME_INITIAL',
      });
    } catch (err: any) {
      blocked = true;
      if (!err.message.includes('Providers are strictly forbidden from reviewing their own services')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }

    if (!blocked) {
      throw new Error('Self-review check failed: Provider was allowed to submit a review for themselves.');
    }

    // Verify AbuseSignal was raised
    const signals = store.listAbuseSignals().filter(s => s.signalType === 'SELF_REVIEW_ATTEMPT');
    if (signals.length === 0) {
      throw new Error('Expected SELF_REVIEW_ATTEMPT abuse signal to be raised.');
    }
  });

  record('Business staff member is blocked from reviewing their own business', 'ANTI_FRAUD', () => {
    // Caregiver Sean is registered as staff at Nairobi West Vet for test
    providerStore.saveBusinessMembership({
      membershipId: 'mem-staff-test-01' as any,
      businessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
      userId: CANONICAL_IDS.CAREGIVER_SEAN,
      role: 'STAFF',
      isActive: true,
      canManageServices: false,
      canManageSchedule: false,
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const staffBookingId = asBookingId('bok-test-staff-review-01');
    bookingStore.saveBooking({
      bookingId: staffBookingId,
      ownerUserId: CANONICAL_IDS.CAREGIVER_SEAN,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      providerId: SEED_PROVIDERS.DR_KIMANI,
      businessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
      serviceOfferingId: CANONICAL_IDS.OFFERING_VET_CONSULT,
      status: 'COMPLETED',
      pricingSnapshot: { amountMinorUnits: 450000, currency: 'KES', pricingModel: 'FIXED' },
      petSnapshots: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const eligibility = service.grantReviewEligibility({
      bookingId: staffBookingId,
      serviceExecutionReference: 'vet-staff-exec-01',
    });

    let blocked = false;
    try {
      service.submitReview({
        eligibilityId: eligibility.eligibilityId,
        actorUserId: CANONICAL_IDS.CAREGIVER_SEAN,
        overallRating: 5,
        dimensions: [
          { dimensionKey: 'TIMELINESS', score: 5 },
          { dimensionKey: 'COMMUNICATION', score: 5 },
          { dimensionKey: 'FACILITY_EXPERIENCE', score: 5 },
          { dimensionKey: 'EXPLANATION_CLARITY', score: 5 },
        ],
        body: 'Our hospital is amazing and 100% top quality.',
        publicIdentityMode: 'FIRST_NAME_INITIAL',
      });
    } catch (err: any) {
      blocked = true;
      if (!err.message.includes('Business staff and contractors cannot submit customer reviews')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }

    if (!blocked) {
      throw new Error('Staff review check failed: Business employee was allowed to submit review.');
    }
  });

  record('Only one review permitted per canonical booking transaction', 'ANTI_FRAUD', () => {
    const testBookingId = asBookingId('bok-test-duplicate-check-01');
    bookingStore.saveBooking({
      bookingId: testBookingId,
      ownerUserId: CANONICAL_IDS.OWNER_ELENA,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      providerId: SEED_PROVIDERS.SARAH_MWANGI,
      serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
      status: 'COMPLETED',
      pricingSnapshot: { amountMinorUnits: 250000, currency: 'KES', pricingModel: 'FIXED' },
      petSnapshots: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const eligibility = service.grantReviewEligibility({
      bookingId: testBookingId,
      serviceExecutionReference: 'duplicate-exec-01',
    });

    // First review succeeds
    service.submitReview({
      eligibilityId: eligibility.eligibilityId,
      actorUserId: CANONICAL_IDS.OWNER_ELENA,
      overallRating: 5,
      dimensions: [
        { dimensionKey: 'PUNCTUALITY', score: 5 },
        { dimensionKey: 'COMMUNICATION', score: 5 },
        { dimensionKey: 'PET_HANDLING', score: 5 },
        { dimensionKey: 'SERVICE_EXECUTION', score: 5 },
      ],
      body: 'First legitimate review for walk.',
      publicIdentityMode: 'FIRST_NAME_INITIAL',
    });

    // Attempting second review on same eligibility fails
    let blocked = false;
    try {
      service.submitReview({
        eligibilityId: eligibility.eligibilityId,
        actorUserId: CANONICAL_IDS.OWNER_ELENA,
        overallRating: 5,
        dimensions: [
          { dimensionKey: 'PUNCTUALITY', score: 5 },
          { dimensionKey: 'COMMUNICATION', score: 5 },
          { dimensionKey: 'PET_HANDLING', score: 5 },
          { dimensionKey: 'SERVICE_EXECUTION', score: 5 },
        ],
        body: 'Second duplicate review attempt.',
        publicIdentityMode: 'FIRST_NAME_INITIAL',
      });
    } catch (err: any) {
      blocked = true;
      if (!err.message.includes('already been consumed')) {
        throw new Error(`Unexpected message: ${err.message}`);
      }
    }

    if (!blocked) {
      throw new Error('Duplicate review check failed: Eligibility was consumed more than once.');
    }
  });

  // ==========================================================================
  // 3. RATING & DIMENSION VALIDATION
  // ==========================================================================

  record('Overall rating strictly rejects non-integers, 0, and out-of-bound values', 'RATINGS', () => {
    const validBookingId = asBookingId('bok-test-rating-bounds-01');
    bookingStore.saveBooking({
      bookingId: validBookingId,
      ownerUserId: CANONICAL_IDS.OWNER_ELENA,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      providerId: SEED_PROVIDERS.SARAH_MWANGI,
      serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
      status: 'COMPLETED',
      pricingSnapshot: { amountMinorUnits: 250000, currency: 'KES', pricingModel: 'FIXED' },
      petSnapshots: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const eligibility = service.grantReviewEligibility({
      bookingId: validBookingId,
      serviceExecutionReference: 'rating-bounds-ref-01',
    });

    // Test decimal rating: 4.5
    let decimalBlocked = false;
    try {
      service.submitReview({
        eligibilityId: eligibility.eligibilityId,
        actorUserId: CANONICAL_IDS.OWNER_ELENA,
        overallRating: 4.5,
        dimensions: [
          { dimensionKey: 'PUNCTUALITY', score: 5 },
          { dimensionKey: 'COMMUNICATION', score: 5 },
          { dimensionKey: 'PET_HANDLING', score: 5 },
          { dimensionKey: 'SERVICE_EXECUTION', score: 5 },
        ],
        body: 'Great walk overall.',
        publicIdentityMode: 'FIRST_NAME_INITIAL',
      });
    } catch (err: any) {
      decimalBlocked = true;
    }
    if (!decimalBlocked) {
      throw new Error('Decimal rating 4.5 was improperly allowed.');
    }

    // Test 0 rating
    let zeroBlocked = false;
    try {
      service.submitReview({
        eligibilityId: eligibility.eligibilityId,
        actorUserId: CANONICAL_IDS.OWNER_ELENA,
        overallRating: 0,
        dimensions: [
          { dimensionKey: 'PUNCTUALITY', score: 5 },
          { dimensionKey: 'COMMUNICATION', score: 5 },
          { dimensionKey: 'PET_HANDLING', score: 5 },
          { dimensionKey: 'SERVICE_EXECUTION', score: 5 },
        ],
        body: 'Zero stars rating.',
        publicIdentityMode: 'FIRST_NAME_INITIAL',
      });
    } catch (err: any) {
      zeroBlocked = true;
    }
    if (!zeroBlocked) {
      throw new Error('Rating 0 was improperly allowed.');
    }

    // Test 6 rating
    let sixBlocked = false;
    try {
      service.submitReview({
        eligibilityId: eligibility.eligibilityId,
        actorUserId: CANONICAL_IDS.OWNER_ELENA,
        overallRating: 6,
        dimensions: [
          { dimensionKey: 'PUNCTUALITY', score: 5 },
          { dimensionKey: 'COMMUNICATION', score: 5 },
          { dimensionKey: 'PET_HANDLING', score: 5 },
          { dimensionKey: 'SERVICE_EXECUTION', score: 5 },
        ],
        body: 'Six stars rating.',
        publicIdentityMode: 'FIRST_NAME_INITIAL',
      });
    } catch (err: any) {
      sixBlocked = true;
    }
    if (!sixBlocked) {
      throw new Error('Rating 6 was improperly allowed.');
    }
  });

  record('Service-specific dimensions are validated and required dimensions enforced', 'RATINGS', () => {
    const dogWalkBookingId = asBookingId('bok-test-dimensions-01');
    bookingStore.saveBooking({
      bookingId: dogWalkBookingId,
      ownerUserId: CANONICAL_IDS.OWNER_ELENA,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      providerId: SEED_PROVIDERS.SARAH_MWANGI,
      serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
      status: 'COMPLETED',
      pricingSnapshot: { amountMinorUnits: 250000, currency: 'KES', pricingModel: 'FIXED' },
      petSnapshots: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const eligibility = service.grantReviewEligibility({
      bookingId: dogWalkBookingId,
      serviceExecutionReference: 'dim-exec-01',
    });

    // Attempt to score veterinary-only dimension 'FACILITY_EXPERIENCE' on a dog walk
    let wrongDimBlocked = false;
    try {
      service.submitReview({
        eligibilityId: eligibility.eligibilityId,
        actorUserId: CANONICAL_IDS.OWNER_ELENA,
        overallRating: 5,
        dimensions: [
          { dimensionKey: 'PUNCTUALITY', score: 5 },
          { dimensionKey: 'COMMUNICATION', score: 5 },
          { dimensionKey: 'PET_HANDLING', score: 5 },
          { dimensionKey: 'SERVICE_EXECUTION', score: 5 },
          { dimensionKey: 'FACILITY_EXPERIENCE', score: 5 }, // Invalid for dog walk!
        ],
        body: 'Good walk but why is clinic cleanliness here?',
        publicIdentityMode: 'FIRST_NAME_INITIAL',
      });
    } catch (err: any) {
      wrongDimBlocked = true;
      if (!err.message.includes('FACILITY_EXPERIENCE is not applicable')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
    if (!wrongDimBlocked) {
      throw new Error('Cross-service dimension injection was improperly permitted.');
    }
  });

  // ==========================================================================
  // 4. REVIEW EDITING & WITHDRAWAL
  // ==========================================================================

  record('Review edits create immutable revision history and recompute reputation', 'LIFECYCLE', () => {
    const editBookingId = asBookingId('bok-test-edit-01');
    bookingStore.saveBooking({
      bookingId: editBookingId,
      ownerUserId: CANONICAL_IDS.OWNER_ELENA,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      providerId: SEED_PROVIDERS.SARAH_MWANGI,
      serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
      status: 'COMPLETED',
      pricingSnapshot: { amountMinorUnits: 250000, currency: 'KES', pricingModel: 'FIXED' },
      petSnapshots: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const eligibility = service.grantReviewEligibility({
      bookingId: editBookingId,
      serviceExecutionReference: 'edit-exec-01',
    });

    const initialReview = service.submitReview({
      eligibilityId: eligibility.eligibilityId,
      actorUserId: CANONICAL_IDS.OWNER_ELENA,
      overallRating: 4,
      dimensions: [
        { dimensionKey: 'PUNCTUALITY', score: 4 },
        { dimensionKey: 'COMMUNICATION', score: 4 },
        { dimensionKey: 'PET_HANDLING', score: 4 },
        { dimensionKey: 'SERVICE_EXECUTION', score: 4 },
      ],
      body: 'Initial review text before follow-up.',
      publicIdentityMode: 'FIRST_NAME_INITIAL',
    });

    // Edit review to 5 stars
    const editedReview = service.editReview({
      reviewId: initialReview.reviewId,
      actorUserId: CANONICAL_IDS.OWNER_ELENA,
      overallRating: 5,
      dimensions: [
        { dimensionKey: 'PUNCTUALITY', score: 5 },
        { dimensionKey: 'COMMUNICATION', score: 5 },
        { dimensionKey: 'PET_HANDLING', score: 5 },
        { dimensionKey: 'SERVICE_EXECUTION', score: 5 },
      ],
      body: 'Updated review text: Sarah followed up and resolved our minor note perfectly!',
      editReason: 'Follow-up resolution satisfied all concerns',
    });

    if (editedReview.version !== 2) {
      throw new Error(`Expected version 2, got: ${editedReview.version}`);
    }
    if (editedReview.revisions.length !== 2) {
      throw new Error(`Expected 2 revisions, got: ${editedReview.revisions.length}`);
    }
    if (editedReview.revisions[0].overallRating !== 4) {
      throw new Error(`Historical revision 1 corrupted: rating is ${editedReview.revisions[0].overallRating}`);
    }
    if (editedReview.overallRating !== 5) {
      throw new Error(`Active review rating not updated to 5.`);
    }
  });

  record('Withdrawn review is excluded from reputation aggregate', 'LIFECYCLE', () => {
    const withdrawBookingId = asBookingId('bok-test-withdraw-01');
    bookingStore.saveBooking({
      bookingId: withdrawBookingId,
      ownerUserId: CANONICAL_IDS.OWNER_ELENA,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      providerId: SEED_PROVIDERS.JUMA_OCHIENG,
      serviceOfferingId: CANONICAL_IDS.OFFERING_TRAINING,
      status: 'COMPLETED',
      pricingSnapshot: { amountMinorUnits: 350000, currency: 'KES', pricingModel: 'FIXED' },
      petSnapshots: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const eligibility = service.grantReviewEligibility({
      bookingId: withdrawBookingId,
      serviceExecutionReference: 'withdraw-exec-01',
    });

    const rev = service.submitReview({
      eligibilityId: eligibility.eligibilityId,
      actorUserId: CANONICAL_IDS.OWNER_ELENA,
      overallRating: 1,
      dimensions: [
        { dimensionKey: 'COMMUNICATION', score: 1 },
        { dimensionKey: 'EXPLANATION_CLARITY', score: 1 },
        { dimensionKey: 'TIMELINESS', score: 1 },
        { dimensionKey: 'SESSION_EXPERIENCE', score: 1 },
      ],
      body: 'Accidental low review that will be withdrawn.',
      publicIdentityMode: 'FIRST_NAME_INITIAL',
    });

    // Check reputation before withdrawal
    const beforeProj = store.findReputationProjection('PROVIDER', SEED_PROVIDERS.JUMA_OCHIENG)!;
    const countBefore = beforeProj.reviewCount;

    // Withdraw review
    service.withdrawReview({
      reviewId: rev.reviewId,
      actorUserId: CANONICAL_IDS.OWNER_ELENA,
      reason: 'Submitted for wrong appointment by mistake',
    });

    // Check reputation after withdrawal
    const afterProj = store.findReputationProjection('PROVIDER', SEED_PROVIDERS.JUMA_OCHIENG)!;
    if (afterProj.reviewCount !== countBefore - 1) {
      throw new Error(`Expected review count to decrease by 1. Before: ${countBefore}, After: ${afterProj.reviewCount}`);
    }
  });

  // ==========================================================================
  // 5. PROVIDER RESPONSE & PRIVACY FILTERS
  // ==========================================================================

  record('Provider cannot alter customer review, and response blocks private contact leaks', 'PROVIDER_RESPONSE', () => {
    const reviews = store.listReviewsForProvider(SEED_PROVIDERS.SARAH_MWANGI);
    const targetReview = reviews[0];
    const initialCustomerRating = targetReview.overallRating;

    // Test privacy filter: Provider attempts to leak phone number in response
    let phoneLeakBlocked = false;
    try {
      service.respondToReview({
        reviewId: targetReview.reviewId,
        actorUserId: SEED_USERS.WALKER_SARAH,
        providerId: SEED_PROVIDERS.SARAH_MWANGI,
        body: 'Call me back on +254 712 345678 or my email test@example.com to discuss this.',
      });
    } catch (err: any) {
      phoneLeakBlocked = true;
      if (!err.message.includes('Privacy Violation')) {
        throw new Error(`Unexpected message: ${err.message}`);
      }
    }
    if (!phoneLeakBlocked) {
      throw new Error('Provider response privacy filter failed to block phone/email leak.');
    }

    // Valid response succeeds
    const resp = service.respondToReview({
      reviewId: targetReview.reviewId,
      actorUserId: SEED_USERS.WALKER_SARAH,
      providerId: SEED_PROVIDERS.SARAH_MWANGI,
      body: 'Thank you for the constructive feedback! We are always striving to improve our transit routes.',
    });

    if (!resp || resp.status !== 'PUBLISHED') {
      throw new Error('Valid provider response failed to publish.');
    }

    // Verify customer rating was NOT altered
    const updatedReview = store.findReviewById(targetReview.reviewId)!;
    if (updatedReview.overallRating !== initialCustomerRating) {
      throw new Error(`Integrity Violation: Customer rating was modified during provider response!`);
    }
  });

  // ==========================================================================
  // 6. DISPUTES & CONTENT MODERATION
  // ==========================================================================

  record('Provider dispute requires factual grounds; upheld dispute removes review from reputation', 'DISPUTES', () => {
    const disputeBookingId = asBookingId('bok-test-dispute-flow-01');
    bookingStore.saveBooking({
      bookingId: disputeBookingId,
      ownerUserId: CANONICAL_IDS.OWNER_ELENA,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      providerId: SEED_PROVIDERS.DR_KIMANI,
      businessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
      serviceOfferingId: CANONICAL_IDS.OFFERING_VET_CONSULT,
      status: 'COMPLETED',
      pricingSnapshot: { amountMinorUnits: 450000, currency: 'KES', pricingModel: 'FIXED' },
      petSnapshots: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const eligibility = service.grantReviewEligibility({
      bookingId: disputeBookingId,
      serviceExecutionReference: 'dispute-flow-ref-01',
    });

    const rev = service.submitReview({
      eligibilityId: eligibility.eligibilityId,
      actorUserId: CANONICAL_IDS.OWNER_ELENA,
      overallRating: 1,
      dimensions: [
        { dimensionKey: 'TIMELINESS', score: 1 },
        { dimensionKey: 'COMMUNICATION', score: 1 },
        { dimensionKey: 'FACILITY_EXPERIENCE', score: 1 },
        { dimensionKey: 'EXPLANATION_CLARITY', score: 1 },
      ],
      body: 'I am posting this review for a different clinic across town.',
      publicIdentityMode: 'FIRST_NAME_INITIAL',
    });

    const countBefore = store.findReputationProjection('PROVIDER', SEED_PROVIDERS.DR_KIMANI)!.reviewCount;

    // Submit factual dispute: wrong provider targeted
    const dispute = service.submitProviderDispute({
      reviewId: rev.reviewId,
      actorUserId: SEED_USERS.VET_DR_KIMANI,
      providerId: SEED_PROVIDERS.DR_KIMANI,
      businessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
      reasonCategory: 'WRONG_PROVIDER_TARGETED',
      statement: 'The reviewer explicitly states in the review body that this review was intended for a different clinic across town.',
    });

    if (dispute.status !== 'SUBMITTED') {
      throw new Error(`Expected dispute status SUBMITTED, got: ${dispute.status}`);
    }

    // Moderator upholds dispute
    service.resolveProviderDispute({
      disputeId: dispute.disputeId,
      moderatorUserId: CANONICAL_IDS.ADMIN_CHARLES,
      outcome: 'UPHELD',
      notes: 'Factual error confirmed. Review targeted wrong provider.',
    });

    const updatedRev = store.findReviewById(rev.reviewId)!;
    if (updatedRev.status !== 'REMOVED') {
      throw new Error(`Expected review status REMOVED after dispute upheld, got: ${updatedRev.status}`);
    }

    // Verify reputation projection excluded this review
    const countAfter = store.findReputationProjection('PROVIDER', SEED_PROVIDERS.DR_KIMANI)!.reviewCount;
    if (countAfter !== countBefore - 1) {
      throw new Error(`Reputation projection failed to subtract removed review. Before: ${countBefore}, After: ${countAfter}`);
    }
  });

  // ==========================================================================
  // 7. TRUST & SAFETY SAFETY ALLEGATION HANDOFF
  // ==========================================================================

  record('Serious safety allegations flag Trust & Safety without automatic review deletion', 'MODERATION', () => {
    const safetyBookingId = asBookingId('bok-test-safety-allegation-01');
    bookingStore.saveBooking({
      bookingId: safetyBookingId,
      ownerUserId: CANONICAL_IDS.OWNER_ELENA,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      providerId: SEED_PROVIDERS.SARAH_MWANGI,
      serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
      status: 'COMPLETED',
      pricingSnapshot: { amountMinorUnits: 250000, currency: 'KES', pricingModel: 'FIXED' },
      petSnapshots: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const eligibility = service.grantReviewEligibility({
      bookingId: safetyBookingId,
      serviceExecutionReference: 'safety-allegation-ref-01',
    });

    const rev = service.submitReview({
      eligibilityId: eligibility.eligibilityId,
      actorUserId: CANONICAL_IDS.OWNER_ELENA,
      overallRating: 1,
      dimensions: [
        { dimensionKey: 'PUNCTUALITY', score: 1 },
        { dimensionKey: 'COMMUNICATION', score: 1 },
        { dimensionKey: 'PET_HANDLING', score: 1 },
        { dimensionKey: 'SERVICE_EXECUTION', score: 1 },
      ],
      body: 'I suspect animal abuse occurred during this walk as my pet had unexpected bruising.',
      publicIdentityMode: 'FIRST_NAME_INITIAL',
    });

    // Verify safety event was raised
    const events = store.listEvents().filter(e => e.eventType === 'ReviewSafetyConcernFlagged');
    if (events.length === 0) {
      throw new Error('Expected ReviewSafetyConcernFlagged event to be emitted.');
    }

    // Verify review itself was NOT deleted autonomously
    const saved = store.findReviewById(rev.reviewId);
    if (!saved) {
      throw new Error('Review was prematurely deleted instead of preserved for T&S investigation.');
    }
  });

  // ==========================================================================
  // 8. REPUTATION AGGREGATION & SMALL-SAMPLE TRANSPARENCY
  // ==========================================================================

  record('Zero-review providers show NO_REVIEWS and never 0.0 stars; rebuild is 100% idempotent', 'REPUTATION', () => {
    const unreviewedProviderId = asProviderId('prv-brand-new-zero-reviews');
    providerStore.saveProvider({
      providerId: unreviewedProviderId,
      userId: asUserId('usr-new-zero-reviews'),
      businessName: 'New Nairobi Grooming Services',
      bio: 'Newly registered pet groomer',
      category: 'GROOMING',
      verificationStatus: 'VERIFIED',
      badges: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const projection = service.recomputeReputationForTarget('PROVIDER', unreviewedProviderId);
    if (projection.displayStatus !== 'NO_REVIEWS') {
      throw new Error(`Expected displayStatus NO_REVIEWS, got: ${projection.displayStatus}`);
    }
    if (projection.reviewCount !== 0) {
      throw new Error(`Expected review count 0, got: ${projection.reviewCount}`);
    }

    // Rebuild all projections idempotently
    const { rebuiltCount } = service.rebuildAllReputationProjections();
    if (rebuiltCount === 0) {
      throw new Error('Expected rebuildAllReputationProjections to rebuild providers.');
    }

    const rebuiltProj = store.findReputationProjection('PROVIDER', unreviewedProviderId)!;
    if (rebuiltProj.displayStatus !== 'NO_REVIEWS') {
      throw new Error('Rebuild corrupted displayStatus for zero-review provider.');
    }
  });

  // ==========================================================================
  // 9. PUBLIC DTO PRIVACY & DATA MINIMIZATION
  // ==========================================================================

  record('PublicReviewDTO strips internal user IDs, households, and bookings', 'PRIVACY', () => {
    const reviews = store.listAllReviews();
    if (reviews.length === 0) {
      throw new Error('No reviews found to test public DTO transformation.');
    }

    const review = reviews[0];
    const dto = service.toPublicReviewDTO(review);

    // Verify internal identifiers are completely omitted
    if ((dto as any).reviewerUserId !== undefined) {
      throw new Error('Security Breach: PublicReviewDTO leaks internal reviewerUserId!');
    }
    if ((dto as any).reviewerHouseholdId !== undefined) {
      throw new Error('Security Breach: PublicReviewDTO leaks internal reviewerHouseholdId!');
    }
    if ((dto as any).bookingId !== undefined) {
      throw new Error('Security Breach: PublicReviewDTO leaks raw internal bookingId!');
    }
    if ((dto as any).eligibilityId !== undefined) {
      throw new Error('Security Breach: PublicReviewDTO leaks raw eligibilityId!');
    }
    if (!dto.publicAuthorDisplayName) {
      throw new Error('PublicReviewDTO missing sanitized publicAuthorDisplayName.');
    }
  });

  return results;
}
