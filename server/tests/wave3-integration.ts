import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { SignJWT } from 'jose';
import { createApp } from '../app';
import { loadServerConfig } from '../config';
import { closeDatabase, getDatabase, withTenantTransaction } from '../db';
import { closeRedis, getRedis } from '../redis';
import { runMigrations } from '../migrate';

const config = loadServerConfig();
const db = getDatabase(config);

async function token(subject: string) {
  assert.ok(config.authJwtSecret, 'Wave 3 integration requires AUTH_JWT_SECRET');
  return new SignJWT({ scope: 'petos:api' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setIssuer(config.authIssuer)
    .setAudience(config.authAudience)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(new TextEncoder().encode(config.authJwtSecret));
}

async function seed() {
  await db.query(`
    TRUNCATE
      review_responses, review_revisions, reviews, review_eligibilities,
      professional_care_records, professional_care_engagements,
      booking_revisions, booking_pet_links, bookings,
      provider_service_offerings, business_memberships, provider_profiles, service_businesses,
      pet_domain_record_revisions,
      health_records, care_records, nutrition_records, training_records, activity_records,
      idempotency_records, outbox_events, pets, household_members, households, users
    RESTART IDENTITY CASCADE
  `);

  await db.query(
    `INSERT INTO users (user_id, normalized_email, account_status) VALUES
      ('usr-w3-owner','owner@wave3.test','ACTIVE'),
      ('usr-w3-provider','provider@wave3.test','ACTIVE'),
      ('usr-w3-outsider','outsider@wave3.test','ACTIVE'),
      ('usr-w3-applicant','applicant@wave3.test','ACTIVE')`,
  );

  await db.query(
    `INSERT INTO households (household_id, name, owner_user_id, status)
     VALUES ('hh-w3-owner','Wave 3 Household','usr-w3-owner','ACTIVE')`,
  );
  await db.query(
    `INSERT INTO household_members (membership_id, household_id, user_id, role, status)
     VALUES ('mem-w3-owner','hh-w3-owner','usr-w3-owner','HOUSEHOLD_OWNER','ACTIVE')`,
  );
  await db.query(
    `INSERT INTO pets (
      pet_id, household_id, name, species_code, breed_code, sex, reproductive_status,
      birthdate_precision, primary_color, size_classification, lifecycle_stage, status, created_by
    ) VALUES (
      'pet-w3','hh-w3-owner','Kito','SPECIES_DOG','BREED_MIXED','MALE','STERILIZED',
      'ESTIMATED_YEAR','Black','MEDIUM','ADULT','ACTIVE','usr-w3-owner'
    )`,
  );

  await db.query(
    `INSERT INTO provider_profiles (
      provider_id,user_id,display_name,professional_title,category,bio,years_of_experience,languages,
      verification_status,operational_status,visibility_status,metadata
    ) VALUES (
      'provider-w3','usr-w3-provider','Amani Pet Care','Professional Pet Sitter','PET_SITTER',
      'Verified Wave 3 provider',6,'["English","Swahili"]'::jsonb,
      'VERIFIED','ACTIVE','PUBLIC','{}'::jsonb
    )`,
  );
}

async function request(base: string, path: string, accessToken: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${accessToken}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return fetch(base + path, { ...init, headers });
}

async function json(response: Response) {
  return response.json() as Promise<any>;
}

async function main() {
  await runMigrations();
  await seed();
  await (await getRedis(config)).flushDb();

  const app = createApp(config);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const ownerToken = await token('usr-w3-owner');
  const providerToken = await token('usr-w3-provider');
  const outsiderToken = await token('usr-w3-outsider');
  const applicantToken = await token('usr-w3-applicant');

  try {
    // Provider onboarding cannot self-verify.
    let response = await request(base, '/v1/providers/me', applicantToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'w3-applicant-provider' },
      body: JSON.stringify({
        displayName: 'Applicant Provider',
        professionalTitle: 'Pet Sitter',
        category: 'PET_SITTER',
        bio: 'Pending verification profile',
        yearsOfExperience: 2,
        languages: ['English'],
      }),
    });
    assert.equal(response.status, 201);
    let payload = await json(response);
    assert.equal(payload.provider.verificationStatus, 'PENDING_VERIFICATION');
    assert.equal(payload.provider.operationalStatus, 'TEMPORARILY_INACTIVE');
    assert.equal(payload.provider.visibilityStatus, 'PRIVATE');
    const applicantProviderId = payload.provider.providerId;

    response = await request(base, `/v1/providers/${applicantProviderId}/offerings`, applicantToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'w3-applicant-offering' },
      body: JSON.stringify({
        serviceTypeId: 'PET_SITTING_VISIT',
        title: 'Applicant Visit',
        description: 'Must remain draft until verified',
        category: 'PET_SITTER',
        status: 'ACTIVE',
        pricingModel: 'FIXED',
        basePriceMinorUnits: 100000,
        currency: 'KES',
        defaultDurationMinutes: 60,
        locationTypes: ['CLIENT_LOCATION'],
        targetSpecies: ['DOG'],
        maxPetsPerBooking: 2,
      }),
    });
    assert.equal(response.status, 201);
    payload = await json(response);
    assert.equal(payload.offering.status, 'DRAFT');

    // Verified provider creates an active offering.
    response = await request(base, '/v1/providers/provider-w3/offerings', providerToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'w3-provider-offering' },
      body: JSON.stringify({
        serviceTypeId: 'PET_SITTING_VISIT',
        title: 'Home Pet Sitting Visit',
        description: 'One-hour in-home care visit',
        category: 'PET_SITTER',
        status: 'ACTIVE',
        pricingModel: 'FIXED',
        basePriceMinorUnits: 150000,
        currency: 'KES',
        defaultDurationMinutes: 60,
        locationTypes: ['CLIENT_LOCATION'],
        targetSpecies: ['DOG', 'CAT'],
        maxPetsPerBooking: 3,
      }),
    });
    assert.equal(response.status, 201);
    payload = await json(response);
    assert.equal(payload.offering.status, 'ACTIVE');
    const offeringId = payload.offering.offeringId;

    response = await request(base, '/v1/offerings?category=PET_SITTER', ownerToken);
    assert.equal(response.status, 200);
    payload = await json(response);
    assert.equal(payload.offerings.some((offering: any) => offering.offeringId === offeringId), true);
    assert.equal(payload.offerings.some((offering: any) => offering.offeringId === undefined), false);

    // Owner creates booking; snapshots are server-derived.
    const bookingBody = JSON.stringify({
      householdId: 'hh-w3-owner',
      offeringId,
      petIds: ['pet-w3'],
      startAt: '2026-11-05T07:00:00.000Z',
      endAt: '2026-11-05T08:00:00.000Z',
      timezone: 'Africa/Nairobi',
      instructions: {
        emergencyContactName: 'Owner',
        emergencyContactPhone: '+254700000000',
        petHandlingNotes: 'Use harness',
      },
    });
    response = await request(base, '/v1/bookings', ownerToken, { method: 'POST', body: bookingBody });
    assert.equal(response.status, 400, 'Booking must require idempotency key');

    response = await request(base, '/v1/bookings', ownerToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'w3-booking-create' },
      body: bookingBody,
    });
    assert.equal(response.status, 201);
    payload = await json(response);
    assert.equal(payload.booking.status, 'PENDING_PROVIDER');
    assert.equal(payload.booking.serviceSnapshot.title, 'Home Pet Sitting Visit');
    assert.equal(payload.booking.priceSnapshot.amountMinorUnits, 150000);
    const bookingId = payload.booking.bookingId;

    response = await request(base, '/v1/bookings', ownerToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'w3-booking-create' },
      body: bookingBody,
    });
    assert.equal(response.status, 200);
    payload = await json(response);
    assert.equal(payload.replayed, true);
    assert.equal(payload.booking.bookingId, bookingId);

    response = await request(base, `/v1/bookings/${bookingId}`, outsiderToken);
    assert.equal(response.status, 403);

    response = await request(base, '/v1/bookings', ownerToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'w3-overlap-booking' },
      body: JSON.stringify({
        householdId: 'hh-w3-owner',
        offeringId,
        petIds: ['pet-w3'],
        startAt: '2026-11-05T07:30:00.000Z',
        endAt: '2026-11-05T08:30:00.000Z',
        timezone: 'Africa/Nairobi',
        instructions: { emergencyContactName: 'Owner', emergencyContactPhone: '+254700000000' },
      }),
    });
    assert.equal(response.status, 409, 'Overlapping active provider booking must be rejected');

    // Provider confirms booking.
    response = await request(base, `/v1/bookings/${bookingId}/transitions`, providerToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'w3-booking-confirm' },
      body: JSON.stringify({ expectedVersion: 1, nextStatus: 'CONFIRMED', reason: 'Availability confirmed' }),
    });
    assert.equal(response.status, 200);
    payload = await json(response);
    assert.equal(payload.booking.status, 'CONFIRMED');
    assert.equal(payload.booking.concurrencyVersion, 2);

    // Provider creates booking-derived professional care.
    response = await request(base, `/v1/bookings/${bookingId}/professional-care`, ownerToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'w3-owner-cannot-create-care' },
      body: JSON.stringify({ serviceType: 'PET_SITTING_VISIT', assignedStaffId: 'usr-w3-provider' }),
    });
    assert.equal(response.status, 403);

    response = await request(base, `/v1/bookings/${bookingId}/professional-care`, providerToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'w3-care-create' },
      body: JSON.stringify({ serviceType: 'PET_SITTING_VISIT', assignedStaffId: 'usr-w3-provider' }),
    });
    assert.equal(response.status, 201);
    payload = await json(response);
    assert.equal(payload.engagement.bookingId, bookingId);
    assert.equal(payload.engagement.status, 'SCHEDULED');
    const engagementId = payload.engagement.engagementId;

    response = await request(base, `/v1/professional-care/${engagementId}`, ownerToken);
    assert.equal(response.status, 200, 'Owner should have read access to their care engagement');
    response = await request(base, `/v1/professional-care/${engagementId}`, outsiderToken);
    assert.equal(response.status, 403);

    // Owners cannot forge provider execution records.
    response = await request(base, `/v1/professional-care/${engagementId}/records`, ownerToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'w3-owner-care-record' },
      body: JSON.stringify({
        recordType: 'OBSERVATION',
        petId: 'pet-w3',
        payload: { category: 'GENERAL', observationText: 'Owner should not write provider record' },
      }),
    });
    assert.equal(response.status, 403);

    // Secrets cannot be stored in ordinary care records.
    response = await request(base, `/v1/professional-care/${engagementId}/records`, providerToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'w3-care-secret-rejected' },
      body: JSON.stringify({
        recordType: 'HANDOVER',
        petId: 'pet-w3',
        payload: { verificationCode: '123456', notes: 'raw secret must not persist here' },
      }),
    });
    assert.equal(response.status, 400);

    // Provider moves custody through a valid care lifecycle.
    const careTransitions = [
      ['READY_FOR_HANDOVER', 'OWNER_CUSTODY'],
      ['IN_CARE', 'PROVIDER_CUSTODY'],
    ] as const;
    let careVersion = 1;
    for (const [nextStatus, custodyStatus] of careTransitions) {
      response = await request(base, `/v1/professional-care/${engagementId}/transitions`, providerToken, {
        method: 'POST',
        headers: { 'idempotency-key': `w3-care-transition-${careVersion}` },
        body: JSON.stringify({ expectedVersion: careVersion, nextStatus, custodyStatus, reason: 'Integration lifecycle' }),
      });
      assert.equal(response.status, 200);
      payload = await json(response);
      careVersion += 1;
      assert.equal(payload.engagement.concurrencyVersion, careVersion);
    }

    response = await request(base, `/v1/professional-care/${engagementId}/records`, providerToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'w3-care-observation' },
      body: JSON.stringify({
        recordType: 'OBSERVATION',
        petId: 'pet-w3',
        status: 'RECORDED',
        occurredAt: '2026-11-05T07:20:00.000Z',
        payload: {
          category: 'GENERAL',
          observationText: 'Pet calm and comfortable',
          severityIndicator: 'NORMAL',
          tags: ['calm'],
        },
      }),
    });
    assert.equal(response.status, 201);
    payload = await json(response);
    assert.equal(payload.record.recordType, 'OBSERVATION');

    // Booking enters service.
    response = await request(base, `/v1/bookings/${bookingId}/transitions`, providerToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'w3-booking-start' },
      body: JSON.stringify({ expectedVersion: 2, nextStatus: 'IN_PROGRESS', reason: 'Service started' }),
    });
    assert.equal(response.status, 200);

    const remainingCareTransitions = [
      ['RETURN_PENDING', 'RETURN_PENDING'],
      ['COMPLETION_PENDING', 'RETURNED'],
      ['COMPLETED', 'RETURNED'],
    ] as const;
    for (const [nextStatus, custodyStatus] of remainingCareTransitions) {
      response = await request(base, `/v1/professional-care/${engagementId}/transitions`, providerToken, {
        method: 'POST',
        headers: { 'idempotency-key': `w3-care-transition-${careVersion}` },
        body: JSON.stringify({ expectedVersion: careVersion, nextStatus, custodyStatus, reason: 'Integration completion' }),
      });
      assert.equal(response.status, 200);
      payload = await json(response);
      careVersion += 1;
      assert.equal(payload.engagement.concurrencyVersion, careVersion);
    }

    response = await request(base, `/v1/bookings/${bookingId}/transitions`, providerToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'w3-booking-complete' },
      body: JSON.stringify({ expectedVersion: 3, nextStatus: 'COMPLETED', reason: 'Service completed and pet returned' }),
    });
    assert.equal(response.status, 200);
    payload = await json(response);
    assert.equal(payload.booking.status, 'COMPLETED');
    assert.equal(payload.booking.concurrencyVersion, 4);

    // Completion automatically grants owner review eligibility.
    response = await request(base, '/v1/review-eligibilities', ownerToken);
    assert.equal(response.status, 200);
    payload = await json(response);
    assert.equal(payload.eligibilities.length, 1);
    assert.equal(payload.eligibilities[0].bookingId, bookingId);
    assert.equal(payload.eligibilities[0].status, 'ELIGIBLE');
    const eligibilityId = payload.eligibilities[0].eligibilityId;

    response = await request(base, '/v1/review-eligibilities', outsiderToken);
    assert.equal(response.status, 200);
    payload = await json(response);
    assert.equal(payload.eligibilities.length, 0);

    // Only eligible booking owner can submit verified-service review.
    response = await request(base, '/v1/reviews', outsiderToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'w3-outsider-review' },
      body: JSON.stringify({
        eligibilityId,
        overallRating: 5,
        dimensions: [],
        structuredTags: ['GOOD_COMMUNICATION'],
        body: 'Attempted outsider review',
        publicIdentityMode: 'ANONYMOUS_TO_PUBLIC',
      }),
    });
    assert.equal(response.status, 403);

    response = await request(base, '/v1/reviews', ownerToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'w3-owner-review' },
      body: JSON.stringify({
        eligibilityId,
        overallRating: 5,
        dimensions: [],
        structuredTags: ['GOOD_COMMUNICATION', 'GENTLE_HANDLING'],
        body: 'Clear updates, gentle handling, and a smooth return handover.',
        publicIdentityMode: 'ANONYMOUS_TO_PUBLIC',
      }),
    });
    assert.equal(response.status, 201);
    payload = await json(response);
    assert.equal(payload.review.verifiedService, true);
    assert.equal(payload.review.status, 'PUBLISHED');
    assert.equal(payload.review.overallRating, 5);
    const reviewId = payload.review.reviewId;

    response = await request(base, `/v1/providers/provider-w3/reviews`, outsiderToken);
    assert.equal(response.status, 200);
    payload = await json(response);
    assert.equal(payload.reviews.length, 1);
    assert.equal(payload.reviews[0].reviewId, reviewId);

    response = await request(base, `/v1/reviews/${reviewId}/responses`, ownerToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'w3-owner-cannot-respond' },
      body: JSON.stringify({ body: 'Owner cannot answer as provider' }),
    });
    assert.equal(response.status, 403);

    response = await request(base, `/v1/reviews/${reviewId}/responses`, providerToken, {
      method: 'POST',
      headers: { 'idempotency-key': 'w3-provider-response' },
      body: JSON.stringify({ body: 'Thank you for the feedback and for the clear care instructions.' }),
    });
    assert.equal(response.status, 201);
    payload = await json(response);
    assert.equal(payload.response.providerId, 'provider-w3');

    // RLS must hide private transactional records from unrelated user.
    for (const [table, where] of [
      ['bookings', "booking_id = 'PLACEHOLDER'"],
      ['professional_care_engagements', "engagement_id = 'PLACEHOLDER'"],
      ['review_eligibilities', "eligibility_id = 'PLACEHOLDER'"],
    ] as const) {
      const resolvedWhere = where.replace('PLACEHOLDER', table === 'bookings' ? bookingId : table === 'professional_care_engagements' ? engagementId : eligibilityId);
      const foreign = await withTenantTransaction(config, 'usr-w3-outsider', undefined, (client) =>
        client.query(`SELECT 1 FROM ${table} WHERE ${resolvedWhere}`),
      );
      assert.equal(foreign.rowCount, 0, `${table} leaked through RLS`);
    }

    // Provider cannot change a customer's published review.
    let providerReviewMutationDenied = false;
    try {
      await withTenantTransaction(config, 'usr-w3-provider', undefined, (client) =>
        client.query(`UPDATE reviews SET overall_rating = 1 WHERE review_id = $1`, [reviewId]),
      );
    } catch {
      providerReviewMutationDenied = true;
    }
    assert.equal(providerReviewMutationDenied, true);

    const bookingRevisions = await db.query('SELECT prior_version,new_version FROM booking_revisions WHERE booking_id=$1 ORDER BY new_version', [bookingId]);
    assert.equal(bookingRevisions.rowCount, 3);
    assert.deepEqual(bookingRevisions.rows.map((row) => Number(row.new_version)), [2,3,4]);

    const careRecords = await db.query('SELECT record_type FROM professional_care_records WHERE engagement_id=$1', [engagementId]);
    assert.equal(careRecords.rowCount, 1);
    assert.equal(careRecords.rows[0].record_type, 'OBSERVATION');

    const reviewState = await db.query(
      `SELECT e.status AS eligibility_status,r.verified_service,rr.version
       FROM review_eligibilities e
       JOIN reviews r ON r.review_id=e.consumed_by_review_id
       JOIN review_revisions rr ON rr.review_id=r.review_id
       WHERE e.eligibility_id=$1`,
      [eligibilityId],
    );
    assert.equal(reviewState.rows[0].eligibility_status, 'CONSUMED');
    assert.equal(reviewState.rows[0].verified_service, true);
    assert.equal(Number(reviewState.rows[0].version), 1);

    const events = await db.query(
      `SELECT event_type FROM outbox_events WHERE aggregate_id = ANY($1::text[])
       ORDER BY occurred_at`,
      [[bookingId, engagementId, reviewId]],
    );
    const eventTypes = events.rows.map((row) => row.event_type);
    assert.ok(eventTypes.includes('BookingRequested'));
    assert.ok(eventTypes.includes('BookingStatusChanged'));
    assert.ok(eventTypes.includes('ProfessionalCareEngagementCreated'));
    assert.ok(eventTypes.includes('ProfessionalCareStatusChanged'));
    assert.ok(eventTypes.includes('ReviewPublished'));

    console.log('WAVE3-INTEGRATION: PASS');
    console.log('Provider verification boundary + offering activation: PASS');
    console.log('Server-derived Booking snapshots + idempotency: PASS');
    console.log('Booking conflict lock + optimistic concurrency + revision history: PASS');
    console.log('Booking-derived Professional Care authority: PASS');
    console.log('Owner read / provider write separation: PASS');
    console.log('Professional care secret-exclusion boundary: PASS');
    console.log('Completed booking -> review eligibility: PASS');
    console.log('Verified-service review + provider response: PASS');
    console.log('Provider cannot mutate customer review: PASS');
    console.log('Cross-party API + PostgreSQL RLS isolation: PASS');
    console.log('Transactional lifecycle outbox: PASS');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await Promise.allSettled([closeDatabase(), closeRedis()]);
  }
}

main().catch(async (error) => {
  console.error('WAVE3-INTEGRATION: FAIL', error);
  await Promise.allSettled([closeDatabase(), closeRedis()]);
  process.exit(1);
});
