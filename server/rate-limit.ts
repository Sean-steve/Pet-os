import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from './auth';
import type { ServerConfig } from './config';
import { getRedis } from './redis';

export function createRateLimitMiddleware(config: ServerConfig) {
  return async function rateLimit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED' });

    try {
      const redis = await getRedis(config);
      const minute = Math.floor(Date.now() / 60_000);
      const key = `rate:api:${userId}:${minute}`;
      const count = Number(await redis.incr(key));
      if (!Number.isFinite(count)) throw new Error('RATE_LIMIT_COUNTER_INVALID');
      if (count === 1) await redis.expire(key, 70);
      res.setHeader('X-RateLimit-Limit', String(config.rateLimitPerMinute));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, config.rateLimitPerMinute - count)));
      if (count > config.rateLimitPerMinute) return res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED' });
      next();
    } catch {
      return res.status(503).json({ error: 'RATE_LIMIT_BACKEND_UNAVAILABLE' });
    }
  };
}
