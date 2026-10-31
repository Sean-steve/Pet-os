import express, { type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { ServerConfig } from './config';
import { createAuthMiddleware, requireAuthenticated, type AuthenticatedRequest } from './auth';
import { getDatabase, withTenantTransaction } from './db';
import { getRedis } from './redis';
import { createRateLimitMiddleware } from './rate-limit';
import { createPet, listHouseholdsForUser, listPetsForHousehold } from './repositories/core-repository';
import { amendDomainRecord, createDomainRecord, getDomainRecord, listDomainRecords, type DurableDomain } from './repositories/wave2-repository';

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
      res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
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
        const result = await withTenantTransaction(config, userId, undefined, (client) =>
          createDomainRecord(client, {
            domain,
            petId,
            actorUserId: userId,
            idempotencyKey,
            recordType: stringField(body.recordType, 'RECORD_TYPE', 80),
            occurredAt: body.occurredAt ? isoDateField(body.occurredAt, 'OCCURRED_AT') : new Date().toISOString(),
            status: optionalStringField(body.status, 'STATUS', 80),
            provenance: optionalStringField(body.provenance, 'PROVENANCE', 100),
            verificationStatus: optionalStringField(body.verificationStatus, 'VERIFICATION_STATUS', 80),
            payload: objectField(body.payload, 'PAYLOAD'),
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
              payloadPatch: objectField(body.payloadPatch || {}, 'PAYLOAD_PATCH'),
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
          provenance: optionalStringField(body.provenance, 'PROVENANCE', 100),
          verificationStatus: optionalStringField(body.verificationStatus, 'VERIFICATION_STATUS', 80),
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

  app.use((req: Request, res: Response) => res.status(404).json({ error: 'NOT_FOUND' }));
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : Number.isInteger(error?.status) ? error.status : 500;
    if (statusCode >= 500) console.error('API request failed', error);
    res.status(statusCode).json({ error: statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : error.message });
  });

  return app;
}
