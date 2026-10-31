import express, { type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { ServerConfig } from './config';
import { createAuthMiddleware, requireAuthenticated, type AuthenticatedRequest } from './auth';
import { getDatabase, withTenantTransaction } from './db';
import { getRedis } from './redis';
import { createRateLimitMiddleware } from './rate-limit';
import { createPet, listHouseholdsForUser, listPetsForHousehold } from './repositories/core-repository';
import { amendDomainRecord, createDomainRecord, getDomainRecord, listDomainRecords, type DurableDomain } from './repositories/wave2-repository';
import { createOffering, createProviderProfile, createServiceBusiness, getProviderForActor, listPublicOfferings } from './repositories/provider-repository';
import { createBooking, getBooking, listBookingsForActor, transitionBooking } from './repositories/booking-repository';
import { addCareRecord, createEngagementFromBooking, getEngagement, transitionEngagement } from './repositories/professional-care-repository';
import { listPublicReviews, listReviewEligibilities, respondToReview, submitReview } from './repositories/review-repository';

function stringField(value: unknown, name: string, max = 120): string {
  if (typeof value !== 'string' || !value.trim()) throw Object.assign(new Error(`${name}_REQUIRED`), { statusCode: 400 });
  const normalized = value.trim();
  if (normalized.length > max) throw Object.assign(new Error(`${name}_TOO_LONG`), { statusCode: 400 });
  return normalized;
}

function sexField(value: unknown): 'MALE' | 'FEMALE' | 'UNKNOWN' {
  if (value === 'MALE' || value === 'FEMALE' || value === 'UNKNOWN') return value;
  throw Object.assign(new Error('SEX_INVALID'), { statusCode: 400 });
}

function objectField(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Object.assign(new Error(`${name}_OBJECT_REQUIRED`), { statusCode: 400 });
  }
  return value as Record<string, unknown>;
}

function isoDateField(value: unknown, name: string): string {
  const raw = stringField(value, name, 80);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw Object.assign(new Error(`${name}_INVALID`), { statusCode: 400 });
  return parsed.toISOString();
}

function optionalStringField(value: unknown, name: string, max = 120): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return stringField(value, name, max);
}

function positiveIntField(value: unknown, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${name}_POSITIVE_INTEGER_REQUIRED`), { statusCode: 400 });
  }
  return parsed;
}

function nonNegativeIntField(value: unknown, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw Object.assign(new Error(`${name}_NON_NEGATIVE_INTEGER_REQUIRED`), { statusCode: 400 });
  }
  return parsed;
}

function stringArrayField(value: unknown, name: string, maxItems = 50): string[] {
  if (!Array.isArray(value) || value.length > maxItems || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw Object.assign(new Error(`${name}_STRING_ARRAY_REQUIRED`), { statusCode: 400 });
  }
  return [...new Set(value.map((item) => item.trim()))];
}

function arrayField(value: unknown, name: string, maxItems = 50): unknown[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw Object.assign(new Error(`${name}_ARRAY_REQUIRED`), { statusCode: 400 });
  }
  return value;
}

function containsAccessSecret(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => containsAccessSecret(item));
  const secretKeys = new Set(['encryptedvalue','accesscode','doorcode','alarmcode','securepin','verificationcode','password','secret']);
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (secretKeys.has(key.toLowerCase())) return true;
    if (containsAccessSecret(nested)) return true;
  }
  return false;
}

function containsRestrictedExactLocation(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => containsRestrictedExactLocation(item));
  const restrictedKeys = new Set(['latitude','longitude','lat','lng','coordinates','gps','rawgps','geopoint','geojson','position']);
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (restrictedKeys.has(key.toLowerCase())) return true;
    if (containsRestrictedExactLocation(nested)) return true;
  }
  return false;
}

function validateWave2Payload(
  domain: DurableDomain,
  recordType: string,
  provenance: string | undefined,
  verificationStatus: string | undefined,
  payload: Record<string, unknown>,
): void {
  if (domain === 'health') {
    if (recordType === 'AMENDMENT') {
      throw Object.assign(new Error('HEALTH_AMENDMENT_ROUTE_REQUIRED'), { statusCode: 400 });
    }
    if (verificationStatus === 'VERIFIED') {
      throw Object.assign(new Error('PROFESSIONAL_HEALTH_VERIFICATION_REQUIRED'), { statusCode: 403 });
    }
    if (provenance === 'VETERINARY_PROFESSIONAL' || provenance === 'CLINIC_SYSTEM') {
      throw Object.assign(new Error('PROFESSIONAL_HEALTH_WRITE_REQUIRES_WAVE3'), { statusCode: 403 });
    }
    if (recordType === 'CONDITION' && payload.isDiagnosis === true) {
      throw Object.assign(new Error('PROFESSIONAL_DIAGNOSIS_WRITE_REQUIRES_WAVE3'), { statusCode: 403 });
    }
  }

  if (domain === 'activity' && containsRestrictedExactLocation(payload)) {
    throw Object.assign(new Error('ACTIVITY_EXACT_LOCATION_FORBIDDEN_USE_TRACKING_REFERENCE'), { statusCode: 400 });
  }
}

export function createApp(config: ServerConfig) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use((req, res, next) => {
    const requestId = req.header('x-request-id') || randomUUID();
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('permissions-policy', 'geolocation=(), microphone=(), camera=()');

    const origin = req.header('origin');
    if (origin && config.corsOrigins.includes(origin)) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'Origin');
      res.setHeader('access-control-allow-headers', 'authorization,content-type,idempotency-key,x-request-id');
      res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  app.get('/health/live', (_req, res) => res.status(200).json({ status: 'live' }));
  app.get('/health/ready', async (_req, res) => {
    try {
      await getDatabase(config).query('SELECT 1');
      await (await getRedis(config)).ping();
      res.status(200).json({ status: 'ready', postgres: 'ok', redis: 'ok' });
    } catch {
      res.status(503).json({ status: 'not_ready' });
    }
  });

  const authenticate = createAuthMiddleware(config);
  const rateLimit = createRateLimitMiddleware(config);
  const requireActiveAccount = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = requireAuthenticated(req);
      const accountStatus = await withTenantTransaction(config, userId, undefined, async (client) => {
        const result = await client.query('SELECT account_status FROM users WHERE user_id = $1 LIMIT 1', [userId]);
        return result.rows[0]?.account_status as string | undefined;
      });
      if (accountStatus !== 'ACTIVE') return res.status(403).json({ error: 'ACCOUNT_NOT_ACTIVE' });
      next();
    } catch (error) {
      next(error);
    }
  };
  app.use('/v1', authenticate, rateLimit, requireActiveAccount);

  app.get('/v1/me/households', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const households = await withTenantTransaction(config, userId, undefined, (client) => listHouseholdsForUser(client, userId));
      res.json({ households });
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/households/:householdId/pets', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const householdId = stringField(req.params.householdId, 'HOUSEHOLD_ID', 180);
      const pets = await withTenantTransaction(config, userId, householdId, (client) => listPetsForHousehold(client, householdId, userId));
      res.json({ pets });
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/households/:householdId/pets', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const householdId = stringField(req.params.householdId, 'HOUSEHOLD_ID', 180);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const result = await withTenantTransaction(config, userId, householdId, (client) =>
        createPet(client, {
          householdId,
          actorUserId: userId,
          idempotencyKey,
          name: stringField(body.name, 'NAME', 120),
          speciesCode: stringField(body.speciesCode, 'SPECIES_CODE', 80),
          breedCode: stringField(body.breedCode || 'BREED_UNKNOWN', 'BREED_CODE', 100),
          primaryColor: stringField(body.primaryColor || 'Unknown', 'PRIMARY_COLOR', 80),
          sex: sexField(body.sex || 'UNKNOWN'),
          reproductiveStatus: typeof body.reproductiveStatus === 'string' ? body.reproductiveStatus : undefined,
          sizeClassification: typeof body.sizeClassification === 'string' ? body.sizeClassification : undefined,
        }),
      );
      res.status(result.replayed ? 200 : 201).json({ pet: result.pet, replayed: result.replayed });
    } catch (error) {
      next(error);
    }
  });

  const wave2Domains: DurableDomain[] = ['health', 'care', 'nutrition', 'training', 'activity'];
  for (const domain of wave2Domains) {
    const basePath = `/v1/pets/:petId/${domain}/records`;

    app.get(basePath, async (req: AuthenticatedRequest, res, next) => {
      try {
        const { userId } = requireAuthenticated(req);
        const petId = stringField(req.params.petId, 'PET_ID', 180);
        const recordType = optionalStringField(req.query.type, 'RECORD_TYPE', 80);
        const limit = req.query.limit === undefined ? 100 : positiveIntField(req.query.limit, 'LIMIT');
        const records = await withTenantTransaction(config, userId, undefined, (client) =>
          listDomainRecords(client, domain, petId, userId, recordType, limit),
        );
        res.json({ domain, records });
      } catch (error) {
        next(error);
      }
    });

    app.get(`${basePath}/:recordId`, async (req: AuthenticatedRequest, res, next) => {
      try {
        const { userId } = requireAuthenticated(req);
        const petId = stringField(req.params.petId, 'PET_ID', 180);
        const recordId = stringField(req.params.recordId, 'RECORD_ID', 220);
        const record = await withTenantTransaction(config, userId, undefined, (client) =>
          getDomainRecord(client, domain, petId, recordId, userId),
        );
        res.json({ record });
      } catch (error) {
        next(error);
      }
    });

    app.post(basePath, async (req: AuthenticatedRequest, res, next) => {
      try {
        const { userId } = requireAuthenticated(req);
        const petId = stringField(req.params.petId, 'PET_ID', 180);
        const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
        const body = req.body || {};
        const recordType = stringField(body.recordType, 'RECORD_TYPE', 80);
        const provenance = optionalStringField(body.provenance, 'PROVENANCE', 100);
        const verificationStatus = optionalStringField(body.verificationStatus, 'VERIFICATION_STATUS', 80);
        const payload = objectField(body.payload, 'PAYLOAD');
        validateWave2Payload(domain, recordType, provenance, verificationStatus, payload);
        const result = await withTenantTransaction(config, userId, undefined, (client) =>
          createDomainRecord(client, {
            domain,
            petId,
            actorUserId: userId,
            idempotencyKey,
            recordType,
            occurredAt: body.occurredAt ? isoDateField(body.occurredAt, 'OCCURRED_AT') : new Date().toISOString(),
            status: optionalStringField(body.status, 'STATUS', 80),
            provenance,
            verificationStatus,
            payload,
          }),
        );
        res.status(result.replayed ? 200 : 201).json({ record: result.record, replayed: result.replayed });
      } catch (error) {
        next(error);
      }
    });

    if (domain !== 'health') {
      app.patch(`${basePath}/:recordId`, async (req: AuthenticatedRequest, res, next) => {
        try {
          const { userId } = requireAuthenticated(req);
          const petId = stringField(req.params.petId, 'PET_ID', 180);
          const recordId = stringField(req.params.recordId, 'RECORD_ID', 220);
          const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
          const body = req.body || {};
          const payloadPatch = objectField(body.payloadPatch || {}, 'PAYLOAD_PATCH');
          if (domain === 'activity' && containsRestrictedExactLocation(payloadPatch)) {
            throw Object.assign(new Error('ACTIVITY_EXACT_LOCATION_FORBIDDEN_USE_TRACKING_REFERENCE'), { statusCode: 400 });
          }
          const result = await withTenantTransaction(config, userId, undefined, (client) =>
            amendDomainRecord(client, {
              domain,
              petId,
              recordId,
              actorUserId: userId,
              idempotencyKey,
              expectedVersion: positiveIntField(body.expectedVersion, 'EXPECTED_VERSION'),
              reason: stringField(body.reason, 'REASON', 500),
              status: optionalStringField(body.status, 'STATUS', 80),
              payloadPatch,
            }),
          );
          res.status(200).json({ record: result.record, replayed: result.replayed });
        } catch (error) {
          next(error);
        }
      });
    }
  }

  app.post('/v1/pets/:petId/health/records/:recordId/amendments', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const petId = stringField(req.params.petId, 'PET_ID', 180);
      const targetRecordId = stringField(req.params.recordId, 'RECORD_ID', 220);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const provenance = optionalStringField(body.provenance, 'PROVENANCE', 100);
      const verificationStatus = optionalStringField(body.verificationStatus, 'VERIFICATION_STATUS', 80);
      if (verificationStatus === 'VERIFIED') {
        throw Object.assign(new Error('PROFESSIONAL_HEALTH_VERIFICATION_REQUIRED'), { statusCode: 403 });
      }
      if (provenance === 'VETERINARY_PROFESSIONAL' || provenance === 'CLINIC_SYSTEM') {
        throw Object.assign(new Error('PROFESSIONAL_HEALTH_WRITE_REQUIRES_WAVE3'), { statusCode: 403 });
      }
      const result = await withTenantTransaction(config, userId, undefined, async (client) => {
        await getDomainRecord(client, 'health', petId, targetRecordId, userId);
        return createDomainRecord(client, {
          domain: 'health',
          petId,
          actorUserId: userId,
          idempotencyKey,
          recordType: 'AMENDMENT',
          occurredAt: new Date().toISOString(),
          status: 'RECORDED',
          provenance,
          verificationStatus,
          payload: {
            targetRecordId,
            reason: stringField(body.reason, 'REASON', 500),
            changes: objectField(body.changes, 'CHANGES'),
          },
        });
      });
      res.status(result.replayed ? 200 : 201).json({ record: result.record, replayed: result.replayed });
    } catch (error) {
      next(error);
    }
  });


  // --------------------------------------------------------------------------
  // Sprint 40 / Migration Wave 3 — Professional service lifecycle
  // --------------------------------------------------------------------------

  app.get('/v1/providers/me', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const provider = await withTenantTransaction(config, userId, undefined, (client) => getProviderForActor(client, userId));
      if (!provider) return res.status(404).json({ error: 'PROVIDER_PROFILE_NOT_FOUND' });
      res.json({ provider });
    } catch (error) { next(error); }
  });

  app.post('/v1/providers/me', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const result = await withTenantTransaction(config, userId, undefined, (client) =>
        createProviderProfile(client, {
          actorUserId: userId,
          idempotencyKey,
          displayName: stringField(body.displayName, 'DISPLAY_NAME', 140),
          professionalTitle: optionalStringField(body.professionalTitle, 'PROFESSIONAL_TITLE', 140),
          category: stringField(body.category, 'CATEGORY', 80),
          bio: typeof body.bio === 'string' ? body.bio.trim().slice(0, 4000) : '',
          yearsOfExperience: nonNegativeIntField(body.yearsOfExperience ?? 0, 'YEARS_OF_EXPERIENCE'),
          languages: body.languages === undefined ? [] : stringArrayField(body.languages, 'LANGUAGES', 20),
        }),
      );
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { next(error); }
  });

  app.post('/v1/businesses', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const result = await withTenantTransaction(config, userId, undefined, (client) =>
        createServiceBusiness(client, {
          actorUserId: userId,
          idempotencyKey,
          legalName: stringField(body.legalName, 'LEGAL_NAME', 180),
          tradingName: stringField(body.tradingName, 'TRADING_NAME', 180),
          businessType: stringField(body.businessType, 'BUSINESS_TYPE', 100),
          contactEmail: stringField(body.contactEmail, 'CONTACT_EMAIL', 254),
          contactPhone: stringField(body.contactPhone, 'CONTACT_PHONE', 80),
          websiteUrl: optionalStringField(body.websiteUrl, 'WEBSITE_URL', 500),
        }),
      );
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { next(error); }
  });

  app.get('/v1/offerings', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const category = optionalStringField(req.query.category, 'CATEGORY', 80);
      const offerings = await withTenantTransaction(config, userId, undefined, (client) => listPublicOfferings(client, { category }));
      res.json({ offerings });
    } catch (error) { next(error); }
  });

  app.post('/v1/providers/:providerId/offerings', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const providerId = stringField(req.params.providerId, 'PROVIDER_ID', 180);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const result = await withTenantTransaction(config, userId, undefined, (client) =>
        createOffering(client, {
          actorUserId: userId,
          idempotencyKey,
          providerId,
          businessId: optionalStringField(body.businessId, 'BUSINESS_ID', 180),
          serviceTypeId: stringField(body.serviceTypeId, 'SERVICE_TYPE_ID', 120),
          title: stringField(body.title, 'TITLE', 180),
          description: typeof body.description === 'string' ? body.description.trim().slice(0, 5000) : '',
          category: stringField(body.category, 'CATEGORY', 80),
          requestedStatus: optionalStringField(body.status, 'STATUS', 80),
          pricingModel: stringField(body.pricingModel, 'PRICING_MODEL', 80),
          basePriceMinorUnits: nonNegativeIntField(body.basePriceMinorUnits, 'BASE_PRICE_MINOR_UNITS'),
          currency: stringField(body.currency, 'CURRENCY', 12),
          defaultDurationMinutes: positiveIntField(body.defaultDurationMinutes, 'DEFAULT_DURATION_MINUTES'),
          locationTypes: stringArrayField(body.locationTypes, 'LOCATION_TYPES', 20),
          targetSpecies: stringArrayField(body.targetSpecies, 'TARGET_SPECIES', 20),
          variants: body.variants === undefined ? [] : arrayField(body.variants, 'VARIANTS', 30),
          prerequisites: body.prerequisites === undefined ? [] : stringArrayField(body.prerequisites, 'PREREQUISITES', 30),
          maxPetsPerBooking: body.maxPetsPerBooking === undefined ? undefined : positiveIntField(body.maxPetsPerBooking, 'MAX_PETS_PER_BOOKING'),
        }),
      );
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { next(error); }
  });

  app.get('/v1/bookings', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const bookings = await withTenantTransaction(config, userId, undefined, (client) => listBookingsForActor(client, userId));
      res.json({ bookings });
    } catch (error) { next(error); }
  });

  app.post('/v1/bookings', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const result = await withTenantTransaction(config, userId, undefined, (client) =>
        createBooking(client, {
          actorUserId: userId,
          idempotencyKey,
          householdId: stringField(body.householdId, 'HOUSEHOLD_ID', 180),
          offeringId: stringField(body.offeringId, 'OFFERING_ID', 180),
          petIds: stringArrayField(body.petIds, 'PET_IDS', 20),
          startAt: isoDateField(body.startAt, 'START_AT'),
          endAt: isoDateField(body.endAt, 'END_AT'),
          timezone: stringField(body.timezone, 'TIMEZONE', 80),
          instructions: objectField(body.instructions || {}, 'INSTRUCTIONS'),
        }),
      );
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { next(error); }
  });

  app.get('/v1/bookings/:bookingId', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const bookingId = stringField(req.params.bookingId, 'BOOKING_ID', 180);
      const booking = await withTenantTransaction(config, userId, undefined, (client) => getBooking(client, bookingId, userId));
      res.json({ booking });
    } catch (error) { next(error); }
  });

  app.post('/v1/bookings/:bookingId/transitions', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const bookingId = stringField(req.params.bookingId, 'BOOKING_ID', 180);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const result = await withTenantTransaction(config, userId, undefined, (client) =>
        transitionBooking(client, {
          actorUserId: userId,
          idempotencyKey,
          bookingId,
          expectedVersion: positiveIntField(body.expectedVersion, 'EXPECTED_VERSION'),
          nextStatus: stringField(body.nextStatus, 'NEXT_STATUS', 80),
          reason: stringField(body.reason, 'REASON', 500),
        }),
      );
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/v1/bookings/:bookingId/professional-care', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const bookingId = stringField(req.params.bookingId, 'BOOKING_ID', 180);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const result = await withTenantTransaction(config, userId, undefined, (client) =>
        createEngagementFromBooking(client, {
          actorUserId: userId,
          idempotencyKey,
          bookingId,
          serviceType: stringField(body.serviceType, 'SERVICE_TYPE', 80),
          assignedStaffId: stringField(body.assignedStaffId, 'ASSIGNED_STAFF_ID', 180),
        }),
      );
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { next(error); }
  });

  app.get('/v1/professional-care/:engagementId', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const engagementId = stringField(req.params.engagementId, 'ENGAGEMENT_ID', 180);
      const engagement = await withTenantTransaction(config, userId, undefined, (client) => getEngagement(client, engagementId, userId));
      res.json({ engagement });
    } catch (error) { next(error); }
  });

  app.post('/v1/professional-care/:engagementId/records', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const engagementId = stringField(req.params.engagementId, 'ENGAGEMENT_ID', 180);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const payload = objectField(body.payload, 'PAYLOAD');
      if (containsAccessSecret(payload)) {
        throw Object.assign(new Error('PROFESSIONAL_CARE_SECRET_MUST_USE_SECURE_SECRET_STORE'), { statusCode: 400 });
      }
      const result = await withTenantTransaction(config, userId, undefined, (client) =>
        addCareRecord(client, {
          actorUserId: userId,
          idempotencyKey,
          engagementId,
          recordType: stringField(body.recordType, 'RECORD_TYPE', 80),
          petId: optionalStringField(body.petId, 'PET_ID', 180),
          status: optionalStringField(body.status, 'STATUS', 80),
          occurredAt: body.occurredAt ? isoDateField(body.occurredAt, 'OCCURRED_AT') : new Date().toISOString(),
          payload,
        }),
      );
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { next(error); }
  });

  app.post('/v1/professional-care/:engagementId/transitions', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const engagementId = stringField(req.params.engagementId, 'ENGAGEMENT_ID', 180);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const result = await withTenantTransaction(config, userId, undefined, (client) =>
        transitionEngagement(client, {
          actorUserId: userId,
          idempotencyKey,
          engagementId,
          expectedVersion: positiveIntField(body.expectedVersion, 'EXPECTED_VERSION'),
          nextStatus: stringField(body.nextStatus, 'NEXT_STATUS', 80),
          custodyStatus: stringField(body.custodyStatus, 'CUSTODY_STATUS', 80),
          reason: stringField(body.reason, 'REASON', 500),
        }),
      );
      res.json(result);
    } catch (error) { next(error); }
  });

  app.get('/v1/review-eligibilities', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const eligibilities = await withTenantTransaction(config, userId, undefined, (client) => listReviewEligibilities(client, userId));
      res.json({ eligibilities });
    } catch (error) { next(error); }
  });

  app.post('/v1/reviews', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const result = await withTenantTransaction(config, userId, undefined, (client) =>
        submitReview(client, {
          actorUserId: userId,
          idempotencyKey,
          eligibilityId: stringField(body.eligibilityId, 'ELIGIBILITY_ID', 180),
          overallRating: positiveIntField(body.overallRating, 'OVERALL_RATING'),
          dimensions: body.dimensions === undefined ? [] : arrayField(body.dimensions, 'DIMENSIONS', 30),
          structuredTags: body.structuredTags === undefined ? [] : stringArrayField(body.structuredTags, 'STRUCTURED_TAGS', 30),
          body: stringField(body.body, 'BODY', 5000),
          publicIdentityMode: stringField(body.publicIdentityMode, 'PUBLIC_IDENTITY_MODE', 80),
        }),
      );
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { next(error); }
  });

  app.get('/v1/providers/:providerId/reviews', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const providerId = stringField(req.params.providerId, 'PROVIDER_ID', 180);
      const reviews = await withTenantTransaction(config, userId, undefined, (client) => listPublicReviews(client, providerId));
      res.json({ reviews });
    } catch (error) { next(error); }
  });

  app.post('/v1/reviews/:reviewId/responses', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const reviewId = stringField(req.params.reviewId, 'REVIEW_ID', 180);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const result = await withTenantTransaction(config, userId, undefined, (client) =>
        respondToReview(client, {
          actorUserId: userId,
          idempotencyKey,
          reviewId,
          body: stringField(body.body, 'BODY', 3000),
        }),
      );
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { next(error); }
  });

  app.use((req: Request, res: Response) => res.status(404).json({ error: 'NOT_FOUND' }));
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : Number.isInteger(error?.status) ? error.status : 500;
    if (statusCode >= 500) console.error('API request failed', error);
    res.status(statusCode).json({ error: statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : error.message });
  });

  return app;
}
