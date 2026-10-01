/**
 * Pet OS Sprint 2 - Rate Limiting Primitives
 * Implements Volume XXXI (Abuse Prevention) & Step 28:
 * In-memory sliding-window rate limiting for security-sensitive auth actions.
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTimeMs: number;
  retryAfterSeconds?: number;
}

export class RateLimiter {
  private static store = new Map<string, number[]>();

  static readonly CONFIGS = {
    REGISTRATION: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 min
    LOGIN: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 failures per 15 min per identity
    PASSWORD_RESET: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
    VERIFY_RESEND: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
    INVITE_CREATE: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour per household
    INVITE_ACCEPT: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
  };

  /**
   * Evaluates if a request under a given key is allowed.
   */
  static check(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const timestamps = this.store.get(key) || [];
    const validTimestamps = timestamps.filter(t => now - t < config.windowMs);

    if (validTimestamps.length >= config.maxRequests) {
      const oldestValid = validTimestamps[0];
      const resetTimeMs = oldestValid + config.windowMs;
      const retryAfterSeconds = Math.ceil((resetTimeMs - now) / 1000);

      this.store.set(key, validTimestamps);
      return {
        allowed: false,
        remaining: 0,
        resetTimeMs,
        retryAfterSeconds: Math.max(1, retryAfterSeconds)
      };
    }

    validTimestamps.push(now);
    this.store.set(key, validTimestamps);

    return {
      allowed: true,
      remaining: config.maxRequests - validTimestamps.length,
      resetTimeMs: now + config.windowMs
    };
  }

  static reset(key?: string): void {
    if (key) {
      this.store.delete(key);
    } else {
      this.store.clear();
    }
  }
}
