import express, { type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { ServerConfig } from './config';
import { createAuthMiddleware, requireAuthenticated, type AuthenticatedRequest } from './auth';
import { getDatabase, withTenantTransaction } from './db';
import { getRedis } from './redis';
import { createRateLimitMiddleware } from './rate-limit';
import { createPet, listHouseholdsForUser, listPetsForHousehold } from './repositories/core-repository';

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
  app.use('/v1', authenticate, rateLimit);

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

  app.use((req: Request, res: Response) => res.status(404).json({ error: 'NOT_FOUND' }));
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : Number.isInteger(error?.status) ? error.status : 500;
    if (statusCode >= 500) console.error('API request failed', error);
    res.status(statusCode).json({ error: statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : error.message });
  });

  return app;
}
