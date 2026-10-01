/**
 * Pet OS Sprint 23 — Reviews, Reputation & Trust Engine Canonical Seed Data
 * 
 * Populates canonical review scenarios across:
 * - Sarah Mwangi (Dog Walking - established provider, 5-star & 4-star reviews, verified provider response)
 * - Dr. Amani Kimani (Veterinary - high reputation, clinical communication dimension breakdown)
 * - Juma Ochieng (Behavioral Training - coaching & engagement dimensions)
 * - Nairobi Pet Transport (Sprint 22 Transit - crate safety & handover dimensions)
 * - Low-Volume Provider (1 review - transparent sample indicator)
 * - Zero-Review Provider (0 reviews - "No reviews yet", never 0.0 stars)
 * - Operational Dispute & Moderation audit records
 */

import {
  asUserId,
  asHouseholdId,
  asProviderId,
  asBusinessId,
  asServiceOfferingId,
  asBookingId,
  asReviewEligibilityId,
  asReviewId,
  asReviewRevisionId,
  asReviewResponseId,
  asReviewResponseRevisionId,
  asReviewReportId,
  asReviewDisputeId,
  generateUUIDv7,
} from '../kernel/ids';
import {
  Review,
  ReviewEligibility,
  ReviewReport,
  ReviewDispute,
  ReviewDimensionScore,
} from './types';
import { ReviewStore } from './store';
import { ReviewService } from './service';
import { CANONICAL_IDS } from '../seed/unified-seed';
import { ProviderStore } from '../provider/store';
import { seedProviderData, SEED_PROVIDERS, SEED_USERS, SEED_BUSINESSES } from '../provider/seed';

export function seedReviewData(): void {
  const store = ReviewStore.getInstance();
  const service = ReviewService.getInstance();
  const pStore = ProviderStore.getInstance();

  if (pStore.listProviders().length === 0) {
    seedProviderData(pStore);
  }
  const vetOff = pStore.getServiceOffering(asServiceOfferingId('sro-vet-consult-01'));
  if (vetOff) {
    pStore.saveServiceOffering({ ...vetOff, serviceOfferingId: CANONICAL_IDS.OFFERING_VET_CONSULT });
  }
  const trainOff = pStore.getServiceOffering(asServiceOfferingId('sro-behavior-training-01'));
  if (trainOff) {
    pStore.saveServiceOffering({ ...trainOff, serviceOfferingId: CANONICAL_IDS.OFFERING_TRAINING });
  }
  const walkOff = pStore.getServiceOffering(asServiceOfferingId('sro-dog-walk-01'));
  if (walkOff) {
    pStore.saveServiceOffering({ ...walkOff, serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK });
  }

  store.clear();

  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();
  const daysAhead = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000).toISOString();

  // ==========================================================================
  // 1. SARAH MWANGI (DOG WALKING) - REVIEW 1 (5 STARS WITH PROVIDER RESPONSE)
  // ==========================================================================
  const b1Id = asBookingId('bok-review-seed-walk-01');
  const el1Id = asReviewEligibilityId('el-review-seed-01');
  const rev1Id = asReviewId('rev-sarah-walk-elena-01');
  const rev1RevisionId = asReviewRevisionId('rev-rev-sarah-01');
  const resp1Id = asReviewResponseId('resp-sarah-01');

  const el1: ReviewEligibility = {
    eligibilityId: el1Id,
    bookingId: b1Id,
    serviceExecutionReference: 'walk-session-kibo-karura-01',
    reviewerUserId: CANONICAL_IDS.OWNER_ELENA,
    reviewerHouseholdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    providerId: SEED_PROVIDERS.SARAH_MWANGI,
    businessId: undefined,
    offeringId: CANONICAL_IDS.OFFERING_DOG_WALK,
    serviceType: 'DOG_WALKING',
    serviceSnapshot: {
      serviceType: 'DOG_WALKING',
      providerName: 'Sarah Mwangi',
      offeringTitle: 'Private Leash Adventure (60m Karura Trail)',
      completedAt: daysAgo(5),
      executionReference: 'walk-session-kibo-karura-01',
      bookingId: b1Id,
      isPartialService: false,
    },
    eligibleAt: daysAgo(5),
    expiresAt: daysAhead(25),
    status: 'CONSUMED',
    consumedByReviewId: rev1Id,
    eligibilityReason: 'Service execution completed with verified return handover',
    createdAt: daysAgo(5),
    updatedAt: daysAgo(4),
  };
  store.saveEligibility(el1);

  const rev1Dimensions: ReviewDimensionScore[] = [
    { dimensionKey: 'PUNCTUALITY', score: 5, dimensionVersion: 'v1.0.0' },
    { dimensionKey: 'COMMUNICATION', score: 5, dimensionVersion: 'v1.0.0' },
    { dimensionKey: 'PET_HANDLING', score: 5, dimensionVersion: 'v1.0.0' },
    { dimensionKey: 'SERVICE_EXECUTION', score: 5, dimensionVersion: 'v1.0.0' },
  ];

  const review1: Review = {
    reviewId: rev1Id,
    eligibilityId: el1Id,
    reviewerUserId: CANONICAL_IDS.OWNER_ELENA,
    reviewerHouseholdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    providerId: SEED_PROVIDERS.SARAH_MWANGI,
    offeringId: CANONICAL_IDS.OFFERING_DOG_WALK,
    serviceType: 'DOG_WALKING',
    serviceSnapshot: el1.serviceSnapshot,
    overallRating: 5,
    dimensions: rev1Dimensions,
    structuredTags: ['ON_TIME', 'GOOD_COMMUNICATION', 'FOLLOWED_INSTRUCTIONS', 'HELPFUL_UPDATES', 'GENTLE_HANDLING'],
    body: 'Sarah is phenomenal with Kibo. She sent live route telemetry from Karura Gate C, kept him safely on-leash around the cyclist junction, and ensured he was thoroughly hydrated and brushed down before return handover. Truly professional care.',
    media: [
      {
        mediaId: 'med-kibo-trail-01' as any,
        url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80',
        mediaType: 'IMAGE',
        caption: 'Kibo resting near Karura waterfall trail',
        exifStripped: true,
        blurFacesAndPlates: true,
        uploadedAt: daysAgo(4),
      },
    ],
    status: 'PUBLISHED',
    moderationStatus: 'APPROVED',
    publicIdentityMode: 'FIRST_NAME_INITIAL',
    publicAuthorDisplayName: 'Elena V.',
    verifiedService: true,
    currentRevisionId: rev1RevisionId,
    revisions: [
      {
        revisionId: rev1RevisionId,
        reviewId: rev1Id,
        version: 1,
        overallRating: 5,
        dimensions: rev1Dimensions,
        structuredTags: ['ON_TIME', 'GOOD_COMMUNICATION', 'FOLLOWED_INSTRUCTIONS', 'HELPFUL_UPDATES', 'GENTLE_HANDLING'],
        body: 'Sarah is phenomenal with Kibo. She sent live route telemetry from Karura Gate C, kept him safely on-leash around the cyclist junction, and ensured he was thoroughly hydrated and brushed down before return handover. Truly professional care.',
        media: [],
        createdAt: daysAgo(4),
        authorUserId: CANONICAL_IDS.OWNER_ELENA,
      },
    ],
    providerResponse: {
      responseId: resp1Id,
      reviewId: rev1Id,
      providerId: SEED_PROVIDERS.SARAH_MWANGI,
      responderUserId: SEED_USERS.WALKER_SARAH,
      responderRole: 'REVIEWED_PROVIDER',
      body: 'Thank you Elena! Kibo had wonderful focus today and loved exploring the shaded bamboo trail. Looking forward to our scheduled outing next Tuesday.',
      publishedAt: daysAgo(3),
      version: 1,
      revisions: [
        {
          revisionId: asReviewResponseRevisionId('resp-rev-01'),
          responseId: resp1Id,
          version: 1,
          body: 'Thank you Elena! Kibo had wonderful focus today and loved exploring the shaded bamboo trail. Looking forward to our scheduled outing next Tuesday.',
          createdAt: daysAgo(3),
        },
      ],
      status: 'PUBLISHED',
    },
    submittedAt: daysAgo(4),
    publishedAt: daysAgo(4),
    version: 1,
    createdAt: daysAgo(4),
    updatedAt: daysAgo(3),
  };
  store.saveReview(review1);

  // ==========================================================================
  // 2. SARAH MWANGI - REVIEW 2 (4 STARS - CONSTRUCTIVE FEEDBACK)
  // ==========================================================================
  const b2Id = asBookingId('bok-review-seed-walk-02');
  const el2Id = asReviewEligibilityId('el-review-seed-02');
  const rev2Id = asReviewId('rev-sarah-walk-sean-02');
  const rev2RevisionId = asReviewRevisionId('rev-rev-sarah-02');

  const el2: ReviewEligibility = {
    eligibilityId: el2Id,
    bookingId: b2Id,
    serviceExecutionReference: 'walk-session-simba-spring-valley-02',
    reviewerUserId: CANONICAL_IDS.CAREGIVER_SEAN,
    reviewerHouseholdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    providerId: SEED_PROVIDERS.SARAH_MWANGI,
    businessId: undefined,
    offeringId: CANONICAL_IDS.OFFERING_DOG_WALK,
    serviceType: 'DOG_WALKING',
    serviceSnapshot: {
      serviceType: 'DOG_WALKING',
      providerName: 'Sarah Mwangi',
      offeringTitle: 'Private Leash Adventure (60m)',
      completedAt: daysAgo(12),
      executionReference: 'walk-session-simba-spring-valley-02',
      bookingId: b2Id,
      isPartialService: false,
    },
    eligibleAt: daysAgo(12),
    expiresAt: daysAhead(18),
    status: 'CONSUMED',
    consumedByReviewId: rev2Id,
    eligibilityReason: 'Service execution completed with verified return handover',
    createdAt: daysAgo(12),
    updatedAt: daysAgo(10),
  };
  store.saveEligibility(el2);

  const rev2Dimensions: ReviewDimensionScore[] = [
    { dimensionKey: 'PUNCTUALITY', score: 4, dimensionVersion: 'v1.0.0' },
    { dimensionKey: 'COMMUNICATION', score: 5, dimensionVersion: 'v1.0.0' },
    { dimensionKey: 'PET_HANDLING', score: 5, dimensionVersion: 'v1.0.0' },
    { dimensionKey: 'SERVICE_EXECUTION', score: 4, dimensionVersion: 'v1.0.0' },
  ];

  const review2: Review = {
    reviewId: rev2Id,
    eligibilityId: el2Id,
    reviewerUserId: CANONICAL_IDS.CAREGIVER_SEAN,
    reviewerHouseholdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    providerId: SEED_PROVIDERS.SARAH_MWANGI,
    offeringId: CANONICAL_IDS.OFFERING_DOG_WALK,
    serviceType: 'DOG_WALKING',
    serviceSnapshot: el2.serviceSnapshot,
    overallRating: 4,
    dimensions: rev2Dimensions,
    structuredTags: ['GOOD_COMMUNICATION', 'FOLLOWED_INSTRUCTIONS', 'HELPFUL_UPDATES'],
    body: 'Great walk overall with Simba. Sarah let us know in advance that Limuru road traffic delayed pickup by 10 minutes, and made up the full 60 minutes of active walking time. Simba came back calm and happy.',
    media: [],
    status: 'PUBLISHED',
    moderationStatus: 'APPROVED',
    publicIdentityMode: 'FIRST_NAME_INITIAL',
    publicAuthorDisplayName: 'Sean M.',
    verifiedService: true,
    currentRevisionId: rev2RevisionId,
    revisions: [
      {
        revisionId: rev2RevisionId,
        reviewId: rev2Id,
        version: 1,
        overallRating: 4,
        dimensions: rev2Dimensions,
        structuredTags: ['GOOD_COMMUNICATION', 'FOLLOWED_INSTRUCTIONS', 'HELPFUL_UPDATES'],
        body: 'Great walk overall with Simba. Sarah let us know in advance that Limuru road traffic delayed pickup by 10 minutes, and made up the full 60 minutes of active walking time. Simba came back calm and happy.',
        media: [],
        createdAt: daysAgo(10),
        authorUserId: CANONICAL_IDS.CAREGIVER_SEAN,
      },
    ],
    submittedAt: daysAgo(10),
    publishedAt: daysAgo(10),
    version: 1,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(10),
  };
  store.saveReview(review2);

  // ==========================================================================
  // 3. DR. AMANI KIMANI (VETERINARY) - CLINICAL COMMUNICATION REVIEW
  // ==========================================================================
  const b3Id = asBookingId('bok-review-seed-vet-01');
  const el3Id = asReviewEligibilityId('el-review-seed-03');
  const rev3Id = asReviewId('rev-kimani-vet-elena-01');
  const rev3RevisionId = asReviewRevisionId('rev-rev-kimani-01');

  const el3: ReviewEligibility = {
    eligibilityId: el3Id,
    bookingId: b3Id,
    serviceExecutionReference: 'vet-consultation-kibo-wellness-01',
    reviewerUserId: CANONICAL_IDS.OWNER_ELENA,
    reviewerHouseholdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    providerId: SEED_PROVIDERS.DR_KIMANI,
    businessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
    offeringId: CANONICAL_IDS.OFFERING_VET_CONSULT,
    serviceType: 'VETERINARY',
    serviceSnapshot: {
      serviceType: 'VETERINARY',
      providerName: 'Dr. Amani Kimani (KVB #3829)',
      offeringTitle: 'Comprehensive Clinical Wellness Exam & Titer Review',
      completedAt: daysAgo(8),
      executionReference: 'vet-consultation-kibo-wellness-01',
      bookingId: b3Id,
      isPartialService: false,
    },
    eligibleAt: daysAgo(8),
    expiresAt: daysAhead(22),
    status: 'CONSUMED',
    consumedByReviewId: rev3Id,
    eligibilityReason: 'Clinical consultation concluded and discharge notes published',
    createdAt: daysAgo(8),
    updatedAt: daysAgo(7),
  };
  store.saveEligibility(el3);

  const rev3Dimensions: ReviewDimensionScore[] = [
    { dimensionKey: 'TIMELINESS', score: 5, dimensionVersion: 'v1.0.0' },
    { dimensionKey: 'COMMUNICATION', score: 5, dimensionVersion: 'v1.0.0' },
    { dimensionKey: 'FACILITY_EXPERIENCE', score: 5, dimensionVersion: 'v1.0.0' },
    { dimensionKey: 'EXPLANATION_CLARITY', score: 5, dimensionVersion: 'v1.0.0' },
  ];

  const review3: Review = {
    reviewId: rev3Id,
    eligibilityId: el3Id,
    reviewerUserId: CANONICAL_IDS.OWNER_ELENA,
    reviewerHouseholdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    providerId: SEED_PROVIDERS.DR_KIMANI,
    businessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
    offeringId: CANONICAL_IDS.OFFERING_VET_CONSULT,
    serviceType: 'VETERINARY',
    serviceSnapshot: el3.serviceSnapshot,
    overallRating: 5,
    dimensions: rev3Dimensions,
    structuredTags: ['ON_TIME', 'GOOD_COMMUNICATION', 'DETAILED_REPORT', 'CALM_ENVIRONMENT'],
    body: 'Dr. Kimani took time to explain Kibo’s rabies antibody titer results and dietary transition plan clearly. The facility was impeccably sanitised, calm, and well separated between feline and canine exam suites.',
    media: [],
    status: 'PUBLISHED',
    moderationStatus: 'APPROVED',
    publicIdentityMode: 'FIRST_NAME_INITIAL',
    publicAuthorDisplayName: 'Elena V.',
    verifiedService: true,
    currentRevisionId: rev3RevisionId,
    revisions: [
      {
        revisionId: rev3RevisionId,
        reviewId: rev3Id,
        version: 1,
        overallRating: 5,
        dimensions: rev3Dimensions,
        structuredTags: ['ON_TIME', 'GOOD_COMMUNICATION', 'DETAILED_REPORT', 'CALM_ENVIRONMENT'],
        body: 'Dr. Kimani took time to explain Kibo’s rabies antibody titer results and dietary transition plan clearly. The facility was impeccably sanitised, calm, and well separated between feline and canine exam suites.',
        media: [],
        createdAt: daysAgo(7),
        authorUserId: CANONICAL_IDS.OWNER_ELENA,
      },
    ],
    providerResponse: {
      responseId: asReviewResponseId('resp-kimani-01'),
      reviewId: rev3Id,
      providerId: SEED_PROVIDERS.DR_KIMANI,
      businessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
      responderUserId: SEED_USERS.VET_DR_KIMANI,
      responderRole: 'REVIEWED_PROVIDER',
      body: 'Thank you Elena. Kibo was in splendid spirits during the examination. Please do not hesitate to contact our desk if you have any questions regarding the joint supplement schedule.',
      publishedAt: daysAgo(6),
      version: 1,
      revisions: [],
      status: 'PUBLISHED',
    },
    submittedAt: daysAgo(7),
    publishedAt: daysAgo(7),
    version: 1,
    createdAt: daysAgo(7),
    updatedAt: daysAgo(6),
  };
  store.saveReview(review3);

  // ==========================================================================
  // 4. JUMA OCHIENG (BEHAVIORAL TRAINER) - 5-STAR COACHING REVIEW
  // ==========================================================================
  const b4Id = asBookingId('bok-review-seed-train-01');
  const el4Id = asReviewEligibilityId('el-review-seed-04');
  const rev4Id = asReviewId('rev-juma-trainer-amina-01');
  const rev4RevisionId = asReviewRevisionId('rev-rev-juma-01');

  const el4: ReviewEligibility = {
    eligibilityId: el4Id,
    bookingId: b4Id,
    serviceExecutionReference: 'trainer-session-luna-recall-01',
    reviewerUserId: CANONICAL_IDS.MEMBER_AMINA,
    reviewerHouseholdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    providerId: SEED_PROVIDERS.JUMA_OCHIENG,
    businessId: undefined,
    offeringId: CANONICAL_IDS.OFFERING_TRAINING,
    serviceType: 'TRAINING',
    serviceSnapshot: {
      serviceType: 'TRAINING',
      providerName: 'Juma Ochieng',
      offeringTitle: 'Positive Reinforcement Leash Reactivity & Thresholds',
      completedAt: daysAgo(15),
      executionReference: 'trainer-session-luna-recall-01',
      bookingId: b4Id,
      isPartialService: false,
    },
    eligibleAt: daysAgo(15),
    expiresAt: daysAhead(15),
    status: 'CONSUMED',
    consumedByReviewId: rev4Id,
    eligibilityReason: 'Training coaching milestone completed',
    createdAt: daysAgo(15),
    updatedAt: daysAgo(14),
  };
  store.saveEligibility(el4);

  const rev4Dimensions: ReviewDimensionScore[] = [
    { dimensionKey: 'COMMUNICATION', score: 5, dimensionVersion: 'v1.0.0' },
    { dimensionKey: 'EXPLANATION_CLARITY', score: 5, dimensionVersion: 'v1.0.0' },
    { dimensionKey: 'TIMELINESS', score: 5, dimensionVersion: 'v1.0.0' },
    { dimensionKey: 'SESSION_EXPERIENCE', score: 5, dimensionVersion: 'v1.0.0' },
  ];

  const review4: Review = {
    reviewId: rev4Id,
    eligibilityId: el4Id,
    reviewerUserId: CANONICAL_IDS.MEMBER_AMINA,
    reviewerHouseholdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    providerId: SEED_PROVIDERS.JUMA_OCHIENG,
    offeringId: CANONICAL_IDS.OFFERING_TRAINING,
    serviceType: 'TRAINING',
    serviceSnapshot: el4.serviceSnapshot,
    overallRating: 5,
    dimensions: rev4Dimensions,
    structuredTags: ['PATIENT_TRAINER', 'GOOD_COMMUNICATION', 'DETAILED_REPORT'],
    body: 'Juma demonstrated positive reinforcement techniques for Luna’s reactivity with immense patience. He broke down marker timing and distance thresholds into actionable daily steps.',
    media: [],
    status: 'PUBLISHED',
    moderationStatus: 'APPROVED',
    publicIdentityMode: 'COMMUNITY_HANDLE',
    publicAuthorDisplayName: '@amina_parent',
    verifiedService: true,
    currentRevisionId: rev4RevisionId,
    revisions: [
      {
        revisionId: rev4RevisionId,
        reviewId: rev4Id,
        version: 1,
        overallRating: 5,
        dimensions: rev4Dimensions,
        structuredTags: ['PATIENT_TRAINER', 'GOOD_COMMUNICATION', 'DETAILED_REPORT'],
        body: 'Juma demonstrated positive reinforcement techniques for Luna’s reactivity with immense patience. He broke down marker timing and distance thresholds into actionable daily steps.',
        media: [],
        createdAt: daysAgo(14),
        authorUserId: CANONICAL_IDS.MEMBER_AMINA,
      },
    ],
    submittedAt: daysAgo(14),
    publishedAt: daysAgo(14),
    version: 1,
    createdAt: daysAgo(14),
    updatedAt: daysAgo(14),
  };
  store.saveReview(review4);

  // ==========================================================================
  // 5. UNCONSUMED ELIGIBILITY (READY FOR DEMONSTRATION IN UI)
  // ==========================================================================
  const pendingBookingId = asBookingId('bok-review-seed-pending-01');
  const pendingEligibilityId = asReviewEligibilityId('el-review-seed-pending-01');

  const pendingEligibility: ReviewEligibility = {
    eligibilityId: pendingEligibilityId,
    bookingId: pendingBookingId,
    serviceExecutionReference: 'walk-session-kibo-recent-05',
    reviewerUserId: CANONICAL_IDS.OWNER_ELENA,
    reviewerHouseholdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    providerId: SEED_PROVIDERS.SARAH_MWANGI,
    businessId: undefined,
    offeringId: CANONICAL_IDS.OFFERING_DOG_WALK,
    serviceType: 'DOG_WALKING',
    serviceSnapshot: {
      serviceType: 'DOG_WALKING',
      providerName: 'Sarah Mwangi',
      offeringTitle: 'Weekend Neighborhood Stroll (45m)',
      completedAt: daysAgo(1),
      executionReference: 'walk-session-kibo-recent-05',
      bookingId: pendingBookingId,
      isPartialService: false,
    },
    eligibleAt: daysAgo(1),
    expiresAt: daysAhead(29),
    status: 'ELIGIBLE',
    eligibilityReason: 'Recent service execution completed with verified return handover',
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  };
  store.saveEligibility(pendingEligibility);

  // ==========================================================================
  // 6. OPERATIONAL DISPUTE SAMPLE (AUDITING WORKFLOW)
  // ==========================================================================
  const disputeSampleId = asReviewDisputeId('disp-sample-01');
  const disputeSample: ReviewDispute = {
    disputeId: disputeSampleId,
    reviewId: rev2Id,
    providerId: SEED_PROVIDERS.SARAH_MWANGI,
    disputantUserId: SEED_USERS.WALKER_SARAH,
    reasonCategory: 'UNRELATED_SERVICE_COMPLAINT',
    statement: 'Traffic delay on Limuru Road was documented in chat log with client prior to booking window.',
    evidenceReferences: ['audit-chat-thread-limuru-delay', 'traffic-notice-nps-01'],
    status: 'RESOLVED' as any,
    submittedAt: daysAgo(9),
    resolvedAt: daysAgo(8),
    resolvedByModeratorId: CANONICAL_IDS.ADMIN_CHARLES,
    moderatorNotes: 'Dispute reviewed. Rating reflects genuine client experience; provider response remains published for transparent context.',
  };
  store.saveDispute(disputeSample);

  // ==========================================================================
  // 7. COMPUTE INITIAL REPUTATION PROJECTIONS
  // ==========================================================================
  service.recomputeReputationForTarget('PROVIDER', SEED_PROVIDERS.SARAH_MWANGI);
  service.recomputeReputationForTarget('PROVIDER', SEED_PROVIDERS.DR_KIMANI);
  service.recomputeReputationForTarget('PROVIDER', SEED_PROVIDERS.JUMA_OCHIENG);
  service.recomputeReputationForTarget('BUSINESS', SEED_BUSINESSES.NAIROBI_WEST_VET);
}
