import express, { type NextFunction, type Request, type Response } from 'express';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { ServerConfig } from './config';
import { createAuthMiddleware, requireAuthenticated, type AuthenticatedRequest } from './auth';
import { getDatabase, withSystemTransaction, withTenantTransaction } from './db';
import { getRedis } from './redis';
import { createRateLimitMiddleware } from './rate-limit';
import { createPet, listHouseholdsForUser, listPetsForHousehold } from './repositories/core-repository';
import { amendDomainRecord, createDomainRecord, getDomainRecord, listDomainRecords, type DurableDomain } from './repositories/wave2-repository';
import { createOffering, createProviderProfile, createServiceBusiness, getProviderForActor, listPublicOfferings } from './repositories/provider-repository';
import { createBooking, getBooking, listBookingsForActor, transitionBooking } from './repositories/booking-repository';
import { addCareRecord, createEngagementFromBooking, getEngagement, transitionEngagement } from './repositories/professional-care-repository';
import { listPublicReviews, listReviewEligibilities, respondToReview, submitReview } from './repositories/review-repository';
import {
  createBookingPaymentIntent,
  createPayoutDestination,
  finalizeCompletedBookingEarning,
  getBookingFinance,
  getProviderFinanceSummary,
  requestBookingRefund,
  requestProviderPayout,
  runPaymentReconciliation,
  settlePaymentIntent,
  settleProviderPayout,
  settleRefund,
  verifyPayoutDestination,
} from './repositories/finance-repository';
import {
  cancelConsumerSubscription,
  cancelProviderSaaSSubscription,
  createConsumerSubscription,
  createProviderSaaSSubscription,
  getConsumerSubscription,
  getProviderSaaSSubscription,
  runBillingReconciliation,
  settleConsumerSubscription,
  settleProviderSaaSSubscription,
} from './repositories/subscription-repository';
import {
  assignTrackingDevice,
  claimTrackingDevice,
  completeTrackingSession,
  createCommunityPost,
  createCommunityProfile,
  createSafeZone,
  createTransportDriver,
  createTransportTrip,
  createTransportVehicle,
  getLiveLocation,
  getPublicRecoveryProfile,
  getRecoveryIncident,
  getTrackingRoute,
  getTransportTrip,
  ingestTelemetry,
  registerTrackingDevice,
  reportLostPet,
  reportTransportIncident,
  resolveLostPet,
  startTrackingSession,
  submitRecoverySighting,
  transferTransportCustody,
  transitionTransportTrip,
  verifyRecoverySighting,
  verifyTransportDriver,
  verifyTransportVehicle,
  volunteerForRecovery,
  listCommunityFeed,
} from './repositories/wave5-repository';

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

function choiceField<T extends string>(value: unknown, name: string, allowed: readonly T[]): T {
  const raw = stringField(value, name, 80);
  if (!(allowed as readonly string[]).includes(raw)) {
    throw Object.assign(new Error(`${name}_INVALID`), { statusCode: 400 });
  }
  return raw as T;
}

function finiteNumberField(value: unknown, name: string, min?: number, max?: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw Object.assign(new Error(`${name}_NUMBER_REQUIRED`), { statusCode: 400 });
  if (min !== undefined && parsed < min) throw Object.assign(new Error(`${name}_TOO_SMALL`), { statusCode: 400 });
  if (max !== undefined && parsed > max) throw Object.assign(new Error(`${name}_TOO_LARGE`), { statusCode: 400 });
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

function requireBillingAdapter(req: Request, config: ServerConfig): void {
  const supplied = req.header('x-billing-adapter-secret') || '';
  const expected = config.billingAdapterSecret;
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    throw Object.assign(new Error('BILLING_ADAPTER_AUTHENTICATION_FAILED'), { statusCode: 401 });
  }
}

function requireLocationAdapter(req: Request, config: ServerConfig): void {
  const supplied = req.header('x-location-adapter-secret') || '';
  const expected = config.locationAdapterSecret;
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    throw Object.assign(new Error('LOCATION_ADAPTER_AUTHENTICATION_FAILED'), { statusCode: 401 });
  }
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

  app.post('/internal/billing/finance/payment-settlements', async (req, res, next) => {
    try {
      requireBillingAdapter(req, config);
      const body = req.body || {};
      const result = await withSystemTransaction(config, (client) =>
        settlePaymentIntent(client, {
          providerEventId: stringField(body.providerEventId, 'PROVIDER_EVENT_ID', 180),
          paymentIntentId: stringField(body.paymentIntentId, 'PAYMENT_INTENT_ID', 180),
          providerTransactionId: stringField(body.providerTransactionId, 'PROVIDER_TRANSACTION_ID', 180),
          settledAmountMinor: positiveIntField(body.settledAmountMinor, 'SETTLED_AMOUNT_MINOR'),
          currency: stringField(body.currency, 'CURRENCY', 12),
          status: choiceField(body.status, 'STATUS', ['SUCCESS','FAILED'] as const),
          providerFeeMinor: body.providerFeeMinor === undefined ? 0 : nonNegativeIntField(body.providerFeeMinor, 'PROVIDER_FEE_MINOR'),
        }),
      );
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/internal/billing/finance/bookings/:bookingId/finalize-earning', async (req, res, next) => {
    try {
      requireBillingAdapter(req, config);
      const bookingId = stringField(req.params.bookingId, 'BOOKING_ID', 180);
      const result = await withSystemTransaction(config, (client) => finalizeCompletedBookingEarning(client, bookingId));
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/internal/billing/finance/payout-destinations/:destinationId/verify', async (req, res, next) => {
    try {
      requireBillingAdapter(req, config);
      const destinationId = stringField(req.params.destinationId, 'DESTINATION_ID', 180);
      const destination = await withSystemTransaction(config, (client) => verifyPayoutDestination(client, destinationId));
      res.json({ destination });
    } catch (error) { next(error); }
  });

  app.post('/internal/billing/finance/payouts/:payoutId/settle', async (req, res, next) => {
    try {
      requireBillingAdapter(req, config);
      const payoutId = stringField(req.params.payoutId, 'PAYOUT_ID', 180);
      const body = req.body || {};
      const result = await withSystemTransaction(config, (client) =>
        settleProviderPayout(client, {
          payoutId,
          providerReference: stringField(body.providerReference, 'PROVIDER_REFERENCE', 180),
          status: choiceField(body.status, 'STATUS', ['PAID','FAILED'] as const),
          failureReason: optionalStringField(body.failureReason, 'FAILURE_REASON', 500),
        }),
      );
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/internal/billing/finance/refunds/:refundId/settle', async (req, res, next) => {
    try {
      requireBillingAdapter(req, config);
      const refundId = stringField(req.params.refundId, 'REFUND_ID', 180);
      const body = req.body || {};
      const result = await withSystemTransaction(config, (client) =>
        settleRefund(client, {
          refundId,
          providerRefundReference: stringField(body.providerRefundReference, 'PROVIDER_REFUND_REFERENCE', 180),
          status: choiceField(body.status, 'STATUS', ['SUCCEEDED','FAILED'] as const),
        }),
      );
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/internal/billing/subscriptions/consumer/:subscriptionId/settle', async (req, res, next) => {
    try {
      requireBillingAdapter(req, config);
      const subscriptionId = stringField(req.params.subscriptionId, 'SUBSCRIPTION_ID', 180);
      const body = req.body || {};
      const result = await withSystemTransaction(config, (client) =>
        settleConsumerSubscription(client, {
          subscriptionId,
          providerEventId: stringField(body.providerEventId, 'PROVIDER_EVENT_ID', 180),
          providerInvoiceReference: stringField(body.providerInvoiceReference, 'PROVIDER_INVOICE_REFERENCE', 180),
          status: choiceField(body.status, 'STATUS', ['PAYMENT_SUCCEEDED','PAYMENT_FAILED'] as const),
          amountMinor: nonNegativeIntField(body.amountMinor, 'AMOUNT_MINOR'),
          currency: stringField(body.currency, 'CURRENCY', 12),
          externalSubscriptionReference: optionalStringField(body.externalSubscriptionReference, 'EXTERNAL_SUBSCRIPTION_REFERENCE', 180),
        }),
      );
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/internal/billing/provider-saas/:subscriptionId/settle', async (req, res, next) => {
    try {
      requireBillingAdapter(req, config);
      const subscriptionId = stringField(req.params.subscriptionId, 'SUBSCRIPTION_ID', 180);
      const body = req.body || {};
      const result = await withSystemTransaction(config, (client) =>
        settleProviderSaaSSubscription(client, {
          subscriptionId,
          providerEventId: stringField(body.providerEventId, 'PROVIDER_EVENT_ID', 180),
          providerInvoiceReference: stringField(body.providerInvoiceReference, 'PROVIDER_INVOICE_REFERENCE', 180),
          status: choiceField(body.status, 'STATUS', ['PAYMENT_SUCCEEDED','PAYMENT_FAILED'] as const),
          amountMinor: nonNegativeIntField(body.amountMinor, 'AMOUNT_MINOR'),
          currency: stringField(body.currency, 'CURRENCY', 12),
          externalBillingRef: optionalStringField(body.externalBillingRef, 'EXTERNAL_BILLING_REF', 180),
        }),
      );
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/internal/billing/finance/reconcile', async (req, res, next) => {
    try {
      requireBillingAdapter(req, config);
      const body = req.body || {};
      const rawRecords = arrayField(body.records, 'RECORDS', 1000);
      const records = rawRecords.map((item, index) => {
        const row = objectField(item, `RECORD_${index}`);
        return {
          providerTransactionId: stringField(row.providerTransactionId, 'PROVIDER_TRANSACTION_ID', 180),
          amountMinor: nonNegativeIntField(row.amountMinor, 'AMOUNT_MINOR'),
          currency: stringField(row.currency, 'CURRENCY', 12),
          status: stringField(row.status, 'STATUS', 30),
          bookingId: optionalStringField(row.bookingId, 'BOOKING_ID', 180),
        };
      });
      const result = await withSystemTransaction(config, (client) =>
        runPaymentReconciliation(client, {
          provider: stringField(body.provider, 'PROVIDER', 80),
          periodStart: isoDateField(body.periodStart, 'PERIOD_START'),
          periodEnd: isoDateField(body.periodEnd, 'PERIOD_END'),
          currency: stringField(body.currency, 'CURRENCY', 12),
          records,
        }),
      );
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/internal/billing/subscriptions/reconcile', async (req, res, next) => {
    try {
      requireBillingAdapter(req, config);
      const body = req.body || {};
      const rawRecords = arrayField(body.records, 'RECORDS', 1000);
      const records = rawRecords.map((item, index) => {
        const row = objectField(item, `RECORD_${index}`);
        return {
          subscriptionId: stringField(row.subscriptionId, 'SUBSCRIPTION_ID', 180),
          providerStatus: stringField(row.providerStatus, 'PROVIDER_STATUS', 80),
        };
      });
      const result = await withSystemTransaction(config, (client) =>
        runBillingReconciliation(client, {
          billingDomain: choiceField(body.billingDomain, 'BILLING_DOMAIN', ['CONSUMER_SUBSCRIPTION','PROVIDER_SAAS'] as const),
          records,
        }),
      );
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/internal/location/devices', async (req, res, next) => {
    try {
      requireLocationAdapter(req, config);
      const body = req.body || {};
      const result = await withSystemTransaction(config, (client) =>
        registerTrackingDevice(client, {
          provider: stringField(body.provider, 'PROVIDER', 80),
          externalDeviceReference: stringField(body.externalDeviceReference, 'EXTERNAL_DEVICE_REFERENCE', 220),
          deviceType: choiceField(body.deviceType, 'DEVICE_TYPE', [
            'GPS_CELLULAR_TRACKER','GPS_BLUETOOTH_TRACKER','PHONE_LOCATION_SOURCE','THIRD_PARTY_TRACKER','FUTURE_PET_OS_TRACKER','OTHER_APPROVED_LOCATION_DEVICE',
          ] as const),
          serialNumberMasked: stringField(body.serialNumberMasked, 'SERIAL_NUMBER_MASKED', 120),
          displayName: stringField(body.displayName, 'DISPLAY_NAME', 120),
          model: stringField(body.model, 'MODEL', 120),
          supportsBleRecovery: body.supportsBleRecovery === true,
          supportsRotatingIdentifier: body.supportsRotatingIdentifier === true,
          supportsLostModeBroadcast: body.supportsLostModeBroadcast === true,
          supportsRemoteModeChange: body.supportsRemoteModeChange === true,
        }),
      );
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { next(error); }
  });

  app.post('/internal/location/telemetry', async (req, res, next) => {
    try {
      requireLocationAdapter(req, config);
      const body = req.body || {};
      const result = await withSystemTransaction(config, (client) =>
        ingestTelemetry(client, {
          provider: stringField(body.provider, 'PROVIDER', 80),
          providerEventId: stringField(body.providerEventId, 'PROVIDER_EVENT_ID', 180),
          sourceDeviceReference: stringField(body.sourceDeviceReference, 'SOURCE_DEVICE_REFERENCE', 220),
          sequenceNumber: body.sequenceNumber === undefined ? undefined : nonNegativeIntField(body.sequenceNumber, 'SEQUENCE_NUMBER'),
          observedAt: isoDateField(body.observedAt, 'OBSERVED_AT'),
          latitude: finiteNumberField(body.latitude, 'LATITUDE', -90, 90),
          longitude: finiteNumberField(body.longitude, 'LONGITUDE', -180, 180),
          accuracyM: finiteNumberField(body.accuracyM, 'ACCURACY_M', 0, 10000),
          altitudeM: body.altitudeM === undefined ? undefined : finiteNumberField(body.altitudeM, 'ALTITUDE_M', -1000, 15000),
          speedMps: body.speedMps === undefined ? undefined : finiteNumberField(body.speedMps, 'SPEED_MPS', 0, 200),
          headingDegrees: body.headingDegrees === undefined ? undefined : finiteNumberField(body.headingDegrees, 'HEADING_DEGREES', 0, 359.999),
          batteryPercent: body.batteryPercent === undefined ? undefined : nonNegativeIntField(body.batteryPercent, 'BATTERY_PERCENT'),
          signatureVerified: body.signatureVerified === true,
          sourcePayloadVersion: stringField(body.sourcePayloadVersion, 'SOURCE_PAYLOAD_VERSION', 40),
        }),
      );
      res.json(result);
    } catch (error) { next(error); }
  });

  app.get('/public/recovery/:publicToken', async (req, res, next) => {
    try {
      const publicToken = stringField(req.params.publicToken, 'PUBLIC_TOKEN', 220);
      const profile = await withSystemTransaction(config, (client) => getPublicRecoveryProfile(client, publicToken));
      res.json({ profile });
    } catch (error) { next(error); }
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

  app.post('/v1/finance/payment-intents', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const body = req.body || {};
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const result = await withTenantTransaction(config, userId, undefined, (client) =>
        createBookingPaymentIntent(client, {
          actorUserId: userId,
          idempotencyKey,
          bookingId: stringField(body.bookingId, 'BOOKING_ID', 180),
          paymentMethodType: choiceField(body.paymentMethodType, 'PAYMENT_METHOD_TYPE', ['MPESA','CARD','BANK_TRANSFER'] as const),
          provider: choiceField(body.provider, 'PAYMENT_PROVIDER', ['MPESA_SAFARICOM','CARD_GATEWAY','MOCK_PROVIDER'] as const),
        }),
      );
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { next(error); }
  });

  app.get('/v1/finance/bookings/:bookingId', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const bookingId = stringField(req.params.bookingId, 'BOOKING_ID', 180);
      const finance = await withTenantTransaction(config, userId, undefined, (client) => getBookingFinance(client, bookingId, userId));
      res.json(finance);
    } catch (error) { next(error); }
  });

  app.get('/v1/providers/:providerId/finance', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const providerId = stringField(req.params.providerId, 'PROVIDER_ID', 180);
      const currency = req.query.currency ? stringField(req.query.currency, 'CURRENCY', 12) : 'KES';
      const finance = await withTenantTransaction(config, userId, undefined, (client) => getProviderFinanceSummary(client, providerId, userId, currency));
      res.json(finance);
    } catch (error) { next(error); }
  });

  app.post('/v1/providers/:providerId/payout-destinations', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const providerId = stringField(req.params.providerId, 'PROVIDER_ID', 180);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const result = await withTenantTransaction(config, userId, undefined, (client) =>
        createPayoutDestination(client, {
          actorUserId: userId,
          idempotencyKey,
          providerId,
          destinationType: choiceField(body.destinationType, 'DESTINATION_TYPE', ['MPESA_B2C','BANK_ACCOUNT'] as const),
          displayTitle: stringField(body.displayTitle, 'DISPLAY_TITLE', 120),
          maskedIdentifier: stringField(body.maskedIdentifier, 'MASKED_IDENTIFIER', 120),
          destinationToken: stringField(body.destinationToken, 'DESTINATION_TOKEN', 220),
          isDefault: body.isDefault === true,
        }),
      );
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { next(error); }
  });

  app.post('/v1/providers/:providerId/payouts', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const providerId = stringField(req.params.providerId, 'PROVIDER_ID', 180);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const result = await withSystemTransaction(config, (client) =>
        requestProviderPayout(client, {
          actorUserId: userId,
          idempotencyKey,
          providerId,
          destinationId: stringField(body.destinationId, 'DESTINATION_ID', 180),
          currency: stringField(body.currency, 'CURRENCY', 12),
        }),
      );
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { next(error); }
  });

  app.post('/v1/finance/bookings/:bookingId/refunds', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const bookingId = stringField(req.params.bookingId, 'BOOKING_ID', 180);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const result = await withSystemTransaction(config, (client) =>
        requestBookingRefund(client, {
          actorUserId: userId,
          idempotencyKey,
          bookingId,
          reason: choiceField(body.reason, 'REFUND_REASON', ['OWNER_CANCELLATION','PROVIDER_CANCELLATION','SERVICE_UNSATISFACTORY','DUPLICATE_CHARGE','GOODWILL','SYSTEM_RECOVERY'] as const),
          reasonDetails: optionalStringField(body.reasonDetails, 'REASON_DETAILS', 500),
        }),
      );
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { next(error); }
  });

  app.post('/v1/subscriptions/consumer', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const result = await withTenantTransaction(config, userId, undefined, (client) =>
        createConsumerSubscription(client, {
          actorUserId: userId,
          idempotencyKey,
          ownerType: choiceField(body.ownerType, 'OWNER_TYPE', ['HOUSEHOLD','USER'] as const),
          ownerId: stringField(body.ownerId, 'OWNER_ID', 180),
          planCode: choiceField(body.planCode, 'PLAN_CODE', ['FREE','PREMIUM'] as const),
          billingInterval: choiceField(body.billingInterval, 'BILLING_INTERVAL', ['MONTHLY','ANNUAL'] as const),
          currency: stringField(body.currency, 'CURRENCY', 12),
          marketCountry: stringField(body.marketCountry, 'MARKET_COUNTRY', 8),
          billingProvider: choiceField(body.billingProvider, 'BILLING_PROVIDER', ['MPESA_RECURRING','CARD_GATEWAY','MOCK_BILLING_PROVIDER'] as const),
        }),
      );
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { next(error); }
  });

  app.get('/v1/subscriptions/consumer/:subscriptionId', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const subscriptionId = stringField(req.params.subscriptionId, 'SUBSCRIPTION_ID', 180);
      const result = await withTenantTransaction(config, userId, undefined, (client) => getConsumerSubscription(client, subscriptionId, userId));
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/v1/subscriptions/consumer/:subscriptionId/cancel', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const subscriptionId = stringField(req.params.subscriptionId, 'SUBSCRIPTION_ID', 180);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const result = await withTenantTransaction(config, userId, undefined, (client) =>
        cancelConsumerSubscription(client, { actorUserId:userId,idempotencyKey,subscriptionId,reason:stringField(body.reason,'REASON',500) }),
      );
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/v1/provider-saas/subscriptions', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const result = await withTenantTransaction(config, userId, undefined, (client) =>
        createProviderSaaSSubscription(client, {
          actorUserId:userId,idempotencyKey,
          subscriberType:choiceField(body.subscriberType,'SUBSCRIBER_TYPE',['SERVICE_BUSINESS','INDIVIDUAL_PROVIDER'] as const),
          businessId:optionalStringField(body.businessId,'BUSINESS_ID',180),
          providerId:optionalStringField(body.providerId,'PROVIDER_ID',180),
          planCode:stringField(body.planCode,'PLAN_CODE',80),
          billingInterval:choiceField(body.billingInterval,'BILLING_INTERVAL',['MONTHLY','ANNUAL'] as const),
          currency:stringField(body.currency,'CURRENCY',12),
          market:stringField(body.market,'MARKET',20),
        }),
      );
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { next(error); }
  });

  app.get('/v1/provider-saas/subscriptions/:subscriptionId', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const subscriptionId = stringField(req.params.subscriptionId, 'SUBSCRIPTION_ID', 180);
      const result = await withTenantTransaction(config, userId, undefined, (client) => getProviderSaaSSubscription(client, subscriptionId, userId));
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/v1/provider-saas/subscriptions/:subscriptionId/cancel', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const subscriptionId = stringField(req.params.subscriptionId, 'SUBSCRIPTION_ID', 180);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const result = await withTenantTransaction(config, userId, undefined, (client) =>
        cancelProviderSaaSSubscription(client, { actorUserId:userId,idempotencyKey,subscriptionId,reason:stringField(body.reason,'REASON',500) }),
      );
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/v1/tracking/devices/:deviceId/claim', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const deviceId = stringField(req.params.deviceId, 'DEVICE_ID', 180);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const result = await withSystemTransaction(config, (client) =>
        claimTrackingDevice(client, {
          actorUserId:userId,idempotencyKey,deviceId,
          householdId:stringField(body.householdId,'HOUSEHOLD_ID',180),
        }),
      );
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/v1/tracking/devices/:deviceId/assign', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const deviceId = stringField(req.params.deviceId, 'DEVICE_ID', 180);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const result = await withSystemTransaction(config, (client) =>
        assignTrackingDevice(client, {
          actorUserId:userId,idempotencyKey,deviceId,
          petId:stringField(body.petId,'PET_ID',180),
          reason:optionalStringField(body.reason,'REASON',500),
        }),
      );
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { next(error); }
  });

  app.post('/v1/tracking/pets/:petId/sessions', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const petId = stringField(req.params.petId, 'PET_ID', 180);
      const idempotencyKey = stringField(req.header('idempotency-key'), 'IDEMPOTENCY_KEY', 180);
      const body = req.body || {};
      const result = await withTenantTransaction(config, userId, undefined, (client) =>
        startTrackingSession(client, {
          actorUserId:userId,idempotencyKey,petId,
          sourceContextType:choiceField(body.sourceContextType,'SOURCE_CONTEXT_TYPE',['DOG_WALK','GENERAL_PET_TRACKING','FUTURE_LOST_PET','MANUAL_TEST'] as const),
          sourceContextId:optionalStringField(body.sourceContextId,'SOURCE_CONTEXT_ID',180),
          trackingMode:choiceField(body.trackingMode,'TRACKING_MODE',['NORMAL','ACTIVE_SESSION','FUTURE_LOST_MODE'] as const),
        }),
      );
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { next(error); }
  });

  app.post('/v1/tracking/sessions/:trackingSessionId/complete', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const trackingSessionId = stringField(req.params.trackingSessionId,'TRACKING_SESSION_ID',180);
      const idempotencyKey = stringField(req.header('idempotency-key'),'IDEMPOTENCY_KEY',180);
      const result = await withTenantTransaction(config,userId,undefined,(client)=>
        completeTrackingSession(client,{actorUserId:userId,idempotencyKey,trackingSessionId}),
      );
      res.json(result);
    } catch (error) { next(error); }
  });

  app.get('/v1/tracking/pets/:petId/live', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const petId=stringField(req.params.petId,'PET_ID',180);
      const location=await withTenantTransaction(config,userId,undefined,(client)=>getLiveLocation(client,petId,userId));
      res.json({ location });
    } catch (error) { next(error); }
  });

  app.get('/v1/tracking/sessions/:trackingSessionId/route', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId } = requireAuthenticated(req);
      const trackingSessionId=stringField(req.params.trackingSessionId,'TRACKING_SESSION_ID',180);
      const route=await withTenantTransaction(config,userId,undefined,(client)=>getTrackingRoute(client,trackingSessionId,userId));
      res.json(route);
    } catch (error) { next(error); }
  });

  app.post('/v1/businesses/:businessId/transport/drivers', async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId }=requireAuthenticated(req);
      const businessId=stringField(req.params.businessId,'BUSINESS_ID',180);
      const idempotencyKey=stringField(req.header('idempotency-key'),'IDEMPOTENCY_KEY',180);
      const body=req.body||{};
      const result=await withTenantTransaction(config,userId,undefined,(client)=>createTransportDriver(client,{
        actorUserId:userId,idempotencyKey,businessId,
        providerId:stringField(body.providerId,'PROVIDER_ID',180),
        userId:stringField(body.userId,'DRIVER_USER_ID',180),
        fullName:stringField(body.fullName,'FULL_NAME',120),
        phoneNumberMasked:stringField(body.phoneNumberMasked,'PHONE_NUMBER_MASKED',80),
        drivingLicenseRefMasked:stringField(body.drivingLicenseRefMasked,'DRIVING_LICENSE_REF_MASKED',100),
        approvedServiceTypes:stringArrayField(body.approvedServiceTypes,'APPROVED_SERVICE_TYPES',20),
        emergencyContactMasked:stringField(body.emergencyContactMasked,'EMERGENCY_CONTACT_MASKED',100),
      }));
      res.status(result.replayed?200:201).json(result);
    } catch(error){next(error);}
  });

  app.post('/v1/transport/drivers/:driverProfileId/verify', async (req: AuthenticatedRequest,res,next)=>{
    try{
      const {userId}=requireAuthenticated(req);
      const driverProfileId=stringField(req.params.driverProfileId,'DRIVER_PROFILE_ID',180);
      const driver=await withTenantTransaction(config,userId,undefined,(client)=>verifyTransportDriver(client,{actorUserId:userId,driverProfileId}));
      res.json({driver});
    }catch(error){next(error);}
  });

  app.post('/v1/businesses/:businessId/transport/vehicles', async (req: AuthenticatedRequest,res,next)=>{
    try{
      const {userId}=requireAuthenticated(req);
      const businessId=stringField(req.params.businessId,'BUSINESS_ID',180);
      const idempotencyKey=stringField(req.header('idempotency-key'),'IDEMPOTENCY_KEY',180);
      const body=req.body||{};
      const result=await withTenantTransaction(config,userId,undefined,(client)=>createTransportVehicle(client,{
        actorUserId:userId,idempotencyKey,businessId,
        providerId:stringField(body.providerId,'PROVIDER_ID',180),
        displayName:stringField(body.displayName,'DISPLAY_NAME',120),
        registrationNumberMasked:stringField(body.registrationNumberMasked,'REGISTRATION_NUMBER_MASKED',80),
        makeModel:stringField(body.makeModel,'MAKE_MODEL',120),
        vehicleType:choiceField(body.vehicleType,'VEHICLE_TYPE',['CAR','VAN','SPECIALIZED_PET_VAN','OTHER_APPROVED'] as const),
        capacity:objectField(body.capacity,'CAPACITY'),
        sensorCapabilities:body.sensorCapabilities===undefined?[]:stringArrayField(body.sensorCapabilities,'SENSOR_CAPABILITIES',20),
        lastInspectionDate:isoDateField(body.lastInspectionDate,'LAST_INSPECTION_DATE').slice(0,10),
        insuranceValidUntil:isoDateField(body.insuranceValidUntil,'INSURANCE_VALID_UNTIL').slice(0,10),
      }));
      res.status(result.replayed?200:201).json(result);
    }catch(error){next(error);}
  });

  app.post('/v1/transport/vehicles/:vehicleId/verify', async (req:AuthenticatedRequest,res,next)=>{
    try{
      const {userId}=requireAuthenticated(req);
      const vehicleId=stringField(req.params.vehicleId,'VEHICLE_ID',180);
      const vehicle=await withTenantTransaction(config,userId,undefined,(client)=>verifyTransportVehicle(client,{actorUserId:userId,vehicleId}));
      res.json({vehicle});
    }catch(error){next(error);}
  });

  app.post('/v1/transport/trips', async (req:AuthenticatedRequest,res,next)=>{
    try{
      const {userId}=requireAuthenticated(req);
      const idempotencyKey=stringField(req.header('idempotency-key'),'IDEMPOTENCY_KEY',180);
      const body=req.body||{};
      const rawStops=arrayField(body.stops,'STOPS',20);
      const stops=rawStops.map((item,index)=>{
        const stop=objectField(item,`STOP_${index}`);
        return {
          stopType:choiceField(stop.stopType,'STOP_TYPE',['PICKUP','DROP_OFF','VETERINARY_STOP','BOARDING_STOP','GROOMING_STOP','RESCUE_STOP','REST_STOP','TRANSFER_STOP','RETURN_ORIGIN_STOP'] as const),
          title:stringField(stop.title,'TITLE',120),
          addressPublicSnippet:stringField(stop.addressPublicSnippet,'ADDRESS_PUBLIC_SNIPPET',180),
          exactAddressCiphertext:optionalStringField(stop.exactAddressCiphertext,'EXACT_ADDRESS_CIPHERTEXT',1000),
          scheduledArrival:isoDateField(stop.scheduledArrival,'SCHEDULED_ARRIVAL'),
          recipientContactName:stringField(stop.recipientContactName,'RECIPIENT_CONTACT_NAME',120),
          recipientContactPhoneMasked:stringField(stop.recipientContactPhoneMasked,'RECIPIENT_CONTACT_PHONE_MASKED',80),
          petIdsBoarding:stop.petIdsBoarding===undefined?[]:stringArrayField(stop.petIdsBoarding,'PET_IDS_BOARDING',30),
          petIdsExiting:stop.petIdsExiting===undefined?[]:stringArrayField(stop.petIdsExiting,'PET_IDS_EXITING',30),
        };
      });
      const result=await withTenantTransaction(config,userId,undefined,(client)=>createTransportTrip(client,{
        actorUserId:userId,idempotencyKey,
        bookingId:stringField(body.bookingId,'BOOKING_ID',180),
        assignedDriverId:stringField(body.assignedDriverId,'ASSIGNED_DRIVER_ID',180),
        assignedVehicleId:stringField(body.assignedVehicleId,'ASSIGNED_VEHICLE_ID',180),
        tripType:stringField(body.tripType,'TRIP_TYPE',80),
        stops,
      }));
      res.status(result.replayed?200:201).json(result);
    }catch(error){next(error);}
  });

  app.get('/v1/transport/trips/:tripId', async (req:AuthenticatedRequest,res,next)=>{
    try{
      const {userId}=requireAuthenticated(req);
      const tripId=stringField(req.params.tripId,'TRIP_ID',180);
      const trip=await withTenantTransaction(config,userId,undefined,(client)=>getTransportTrip(client,tripId,userId));
      res.json(trip);
    }catch(error){next(error);}
  });

  app.post('/v1/transport/trips/:tripId/transitions', async (req:AuthenticatedRequest,res,next)=>{
    try{
      const {userId}=requireAuthenticated(req);
      const tripId=stringField(req.params.tripId,'TRIP_ID',180);
      const idempotencyKey=stringField(req.header('idempotency-key'),'IDEMPOTENCY_KEY',180);
      const body=req.body||{};
      const result=await withTenantTransaction(config,userId,undefined,(client)=>transitionTransportTrip(client,{
        actorUserId:userId,idempotencyKey,tripId,
        expectedVersion:positiveIntField(body.expectedVersion,'EXPECTED_VERSION'),
        nextStatus:choiceField(body.nextStatus,'NEXT_STATUS',[
          'SCHEDULED','READY','DRIVER_EN_ROUTE_TO_PICKUP','ARRIVED_AT_PICKUP','PICKUP_VERIFICATION','PET_IN_CUSTODY',
          'IN_TRANSIT','STOP_IN_PROGRESS','ARRIVED_AT_DESTINATION','HANDOVER_PENDING','COMPLETED','ABORTED','CANCELLED','INCIDENT_ACTIVE',
        ] as const),
        reason:stringField(body.reason,'REASON',500),
      }));
      res.json(result);
    }catch(error){next(error);}
  });

  app.post('/v1/transport/trips/:tripId/custody', async (req:AuthenticatedRequest,res,next)=>{
    try{
      const {userId}=requireAuthenticated(req);
      const tripId=stringField(req.params.tripId,'TRIP_ID',180);
      const idempotencyKey=stringField(req.header('idempotency-key'),'IDEMPOTENCY_KEY',180);
      const body=req.body||{};
      const result=await withTenantTransaction(config,userId,undefined,(client)=>transferTransportCustody(client,{
        actorUserId:userId,idempotencyKey,tripId,
        petId:stringField(body.petId,'PET_ID',180),
        stopId:stringField(body.stopId,'STOP_ID',180),
        toActorUserId:stringField(body.toActorUserId,'TO_ACTOR_USER_ID',180),
        toActorRole:stringField(body.toActorRole,'TO_ACTOR_ROLE',80),
        verificationMethod:choiceField(body.verificationMethod,'VERIFICATION_METHOD',['OWNER_PIN','ID_DOCUMENT','RESCUE_STAFF_BADGE','CLINIC_STAFF_BADGE','AUTHORIZED_CONTACT_CODE','ALTERNATE_RECIPIENT_AUTHORIZATION'] as const),
        verificationProof:stringField(body.verificationProof,'VERIFICATION_PROOF',500),
        notes:optionalStringField(body.notes,'NOTES',500),
      }));
      res.status(result.replayed?200:201).json(result);
    }catch(error){next(error);}
  });

  app.post('/v1/transport/trips/:tripId/incidents', async (req:AuthenticatedRequest,res,next)=>{
    try{
      const {userId}=requireAuthenticated(req);
      const tripId=stringField(req.params.tripId,'TRIP_ID',180);
      const idempotencyKey=stringField(req.header('idempotency-key'),'IDEMPOTENCY_KEY',180);
      const body=req.body||{};
      const result=await withTenantTransaction(config,userId,undefined,(client)=>reportTransportIncident(client,{
        actorUserId:userId,idempotencyKey,tripId,
        category:choiceField(body.category,'INCIDENT_CATEGORY',['VEHICLE_BREAKDOWN','ROAD_ACCIDENT','PET_ESCAPE','PET_INJURY_OBSERVED','PET_ILLNESS_OBSERVED','PET_DISTRESS_OBSERVED','CONTAINMENT_FAILURE','DRIVER_UNAVAILABLE','ROUTE_BLOCKED','ENVIRONMENTAL_ALERT','HANDOVER_FAILURE','WRONG_PET_ATTEMPT','SECURITY_INCIDENT','OTHER'] as const),
        severity:choiceField(body.severity,'INCIDENT_SEVERITY',['LOW','MODERATE','HIGH','CRITICAL'] as const),
        petIds:stringArrayField(body.petIds,'PET_IDS',30),
        description:stringField(body.description,'DESCRIPTION',2000),
        actionTaken:stringField(body.actionTaken,'ACTION_TAKEN',2000),
        lastKnownTrackingRef:optionalStringField(body.lastKnownTrackingRef,'LAST_KNOWN_TRACKING_REF',220),
      }));
      res.status(result.replayed?200:201).json(result);
    }catch(error){next(error);}
  });

  app.post('/v1/recovery/pets/:petId/safe-zones', async (req:AuthenticatedRequest,res,next)=>{
    try{
      const {userId}=requireAuthenticated(req);
      const petId=stringField(req.params.petId,'PET_ID',180);
      const idempotencyKey=stringField(req.header('idempotency-key'),'IDEMPOTENCY_KEY',180);
      const body=req.body||{};
      const result=await withTenantTransaction(config,userId,undefined,(client)=>createSafeZone(client,{
        actorUserId:userId,idempotencyKey,petId,
        name:stringField(body.name,'NAME',120),
        zoneType:choiceField(body.zoneType,'ZONE_TYPE',['HOME','PARK','DAYCARE','VET_CLINIC','CUSTOM'] as const),
        centerLatitude:finiteNumberField(body.centerLatitude,'CENTER_LATITUDE',-90,90),
        centerLongitude:finiteNumberField(body.centerLongitude,'CENTER_LONGITUDE',-180,180),
        radiusMeters:finiteNumberField(body.radiusMeters,'RADIUS_METERS',20,5000),
        hysteresisBufferMeters:body.hysteresisBufferMeters===undefined?25:finiteNumberField(body.hysteresisBufferMeters,'HYSTERESIS_BUFFER_METERS',0,1000),
        alertOnExit:body.alertOnExit!==false,
        alertOnEntry:body.alertOnEntry===true,
      }));
      res.status(result.replayed?200:201).json(result);
    }catch(error){next(error);}
  });

  app.post('/v1/recovery/pets/:petId/incidents', async (req:AuthenticatedRequest,res,next)=>{
    try{
      const {userId}=requireAuthenticated(req);
      const petId=stringField(req.params.petId,'PET_ID',180);
      const idempotencyKey=stringField(req.header('idempotency-key'),'IDEMPOTENCY_KEY',180);
      const body=req.body||{};
      const result=await withSystemTransaction(config,(client)=>reportLostPet(client,{
        actorUserId:userId,idempotencyKey,petId,
        missingSince:isoDateField(body.missingSince,'MISSING_SINCE'),
        coarseDescription:stringField(body.coarseDescription,'COARSE_DESCRIPTION',220),
        neighborhood:stringField(body.neighborhood,'NEIGHBORHOOD',120),
        district:stringField(body.district,'DISTRICT',120),
        city:stringField(body.city,'CITY',120),
        county:stringField(body.county,'COUNTY',120),
        coarseCenterLatitude:finiteNumberField(body.coarseCenterLatitude,'COARSE_CENTER_LATITUDE',-90,90),
        coarseCenterLongitude:finiteNumberField(body.coarseCenterLongitude,'COARSE_CENTER_LONGITUDE',-180,180),
        coarseRadiusKm:finiteNumberField(body.coarseRadiusKm,'COARSE_RADIUS_KM',0.1,100),
        ownerInstructions:stringField(body.ownerInstructions,'OWNER_INSTRUCTIONS',1000),
        communityAlertRequested:body.communityAlertRequested===true,
      }));
      res.status(result.replayed?200:201).json(result);
    }catch(error){next(error);}
  });

  app.get('/v1/recovery/incidents/:incidentId', async (req:AuthenticatedRequest,res,next)=>{
    try{
      const {userId}=requireAuthenticated(req);
      const incidentId=stringField(req.params.incidentId,'INCIDENT_ID',180);
      const incident=await withTenantTransaction(config,userId,undefined,(client)=>getRecoveryIncident(client,incidentId,userId));
      res.json(incident);
    }catch(error){next(error);}
  });

  app.post('/v1/recovery/incidents/:incidentId/sightings', async (req:AuthenticatedRequest,res,next)=>{
    try{
      const {userId}=requireAuthenticated(req);
      const incidentId=stringField(req.params.incidentId,'INCIDENT_ID',180);
      const idempotencyKey=stringField(req.header('idempotency-key'),'IDEMPOTENCY_KEY',180);
      const body=req.body||{};
      const result=await withTenantTransaction(config,userId,undefined,(client)=>submitRecoverySighting(client,{
        actorUserId:userId,idempotencyKey,incidentId,
        sightingAt:isoDateField(body.sightingAt,'SIGHTING_AT'),
        latitude:finiteNumberField(body.latitude,'LATITUDE',-90,90),
        longitude:finiteNumberField(body.longitude,'LONGITUDE',-180,180),
        coarseDescription:stringField(body.coarseDescription,'COARSE_DESCRIPTION',220),
        notes:stringField(body.notes,'NOTES',1000),
        confidence:choiceField(body.confidence,'CONFIDENCE',['LOW','MEDIUM','HIGH'] as const),
        reportedVia:choiceField(body.reportedVia,'REPORTED_VIA',['COMMUNITY_ALERT','PUBLIC_RECOVERY_PAGE','QR_TAG_SCAN','DIRECT'] as const),
      }));
      res.status(result.replayed?200:201).json(result);
    }catch(error){next(error);}
  });

  app.post('/v1/recovery/incidents/:incidentId/sightings/:sightingId/review', async (req:AuthenticatedRequest,res,next)=>{
    try{
      const {userId}=requireAuthenticated(req);
      const incidentId=stringField(req.params.incidentId,'INCIDENT_ID',180);
      const sightingId=stringField(req.params.sightingId,'SIGHTING_ID',180);
      const idempotencyKey=stringField(req.header('idempotency-key'),'IDEMPOTENCY_KEY',180);
      const body=req.body||{};
      const result=await withTenantTransaction(config,userId,undefined,(client)=>verifyRecoverySighting(client,{
        actorUserId:userId,idempotencyKey,incidentId,sightingId,
        status:choiceField(body.status,'STATUS',['VERIFIED','REJECTED','FLAGGED_ABUSIVE'] as const),
      }));
      res.json(result);
    }catch(error){next(error);}
  });

  app.post('/v1/recovery/incidents/:incidentId/resolve', async (req:AuthenticatedRequest,res,next)=>{
    try{
      const {userId}=requireAuthenticated(req);
      const incidentId=stringField(req.params.incidentId,'INCIDENT_ID',180);
      const idempotencyKey=stringField(req.header('idempotency-key'),'IDEMPOTENCY_KEY',180);
      const body=req.body||{};
      const result=await withTenantTransaction(config,userId,undefined,(client)=>resolveLostPet(client,{
        actorUserId:userId,idempotencyKey,incidentId,resolutionNotes:stringField(body.resolutionNotes,'RESOLUTION_NOTES',1000),
      }));
      res.json(result);
    }catch(error){next(error);}
  });

  app.post('/v1/community/profile', async (req:AuthenticatedRequest,res,next)=>{
    try{
      const {userId}=requireAuthenticated(req);
      const idempotencyKey=stringField(req.header('idempotency-key'),'IDEMPOTENCY_KEY',180);
      const body=req.body||{};
      const result=await withTenantTransaction(config,userId,undefined,(client)=>createCommunityProfile(client,{
        actorUserId:userId,idempotencyKey,
        handle:stringField(body.handle,'HANDLE',60),
        displayName:stringField(body.displayName,'DISPLAY_NAME',120),
        bio:typeof body.bio==='string'?body.bio.slice(0,1000):'',
        neighborhood:stringField(body.neighborhood,'NEIGHBORHOOD',120),
        city:stringField(body.city,'CITY',120),
        county:stringField(body.county,'COUNTY',120),
        visibility:choiceField(body.visibility,'VISIBILITY',['PRIVATE','COMMUNITY_VISIBLE','PUBLIC'] as const),
        allowsRecoveryRelay:body.allowsRecoveryRelay===true,
      }));
      res.status(result.replayed?200:201).json(result);
    }catch(error){next(error);}
  });

  app.post('/v1/community/posts', async (req:AuthenticatedRequest,res,next)=>{
    try{
      const {userId}=requireAuthenticated(req);
      const idempotencyKey=stringField(req.header('idempotency-key'),'IDEMPOTENCY_KEY',180);
      const body=req.body||{};
      if(containsRestrictedExactLocation(body)) throw Object.assign(new Error('COMMUNITY_EXACT_LOCATION_FORBIDDEN'),{statusCode:400});
      const result=await withTenantTransaction(config,userId,undefined,(client)=>createCommunityPost(client,{
        actorUserId:userId,idempotencyKey,
        postType:choiceField(body.postType,'POST_TYPE',['GENERAL','QUESTION','PET_UPDATE','TIP','EVENT_UPDATE','RECOVERY_UPDATE','RESOURCE'] as const),
        content:stringField(body.content,'CONTENT',5000),
        coarseLocationArea:optionalStringField(body.coarseLocationArea,'COARSE_LOCATION_AREA',220),
      }));
      res.status(result.replayed?200:201).json(result);
    }catch(error){next(error);}
  });

  app.get('/v1/community/feed', async (req:AuthenticatedRequest,res,next)=>{
    try{
      const {userId}=requireAuthenticated(req);
      const limit=req.query.limit===undefined?50:positiveIntField(req.query.limit,'LIMIT');
      const posts=await withTenantTransaction(config,userId,undefined,(client)=>listCommunityFeed(client,userId,limit));
      res.json({posts});
    }catch(error){next(error);}
  });

  app.post('/v1/community/recovery-alerts/:communityAlertId/volunteer', async (req:AuthenticatedRequest,res,next)=>{
    try{
      const {userId}=requireAuthenticated(req);
      const communityAlertId=stringField(req.params.communityAlertId,'COMMUNITY_ALERT_ID',180);
      const idempotencyKey=stringField(req.header('idempotency-key'),'IDEMPOTENCY_KEY',180);
      const body=req.body||{};
      const result=await withTenantTransaction(config,userId,undefined,(client)=>volunteerForRecovery(client,{
        actorUserId:userId,idempotencyKey,communityAlertId,
        volunteerRole:choiceField(body.volunteerRole,'VOLUNTEER_ROLE',['SEARCH_PARTICIPANT','FLYER_DISTRIBUTION','SHELTER_CHECKER','TRANSPORT_BACKUP'] as const),
        notes:optionalStringField(body.notes,'NOTES',500),
      }));
      res.status(result.replayed?200:201).json(result);
    }catch(error){next(error);}
  });

  app.use((req: Request, res: Response) => res.status(404).json({ error: 'NOT_FOUND' }));
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : Number.isInteger(error?.status) ? error.status : 500;
    if (statusCode >= 500) console.error('API request failed', error);
    res.status(statusCode).json({ error: statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : error.message });
  });

  return app;
}
