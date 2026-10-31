import 'dotenv/config';

export interface ServerConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  redisUrl: string;
  databaseRuntimeRole: string;
  corsOrigins: string[];
  authIssuer: string;
  authAudience: string;
  authJwtSecret?: string;
  authJwksUrl?: string;
  rateLimitPerMinute: number;
}

function requireValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parsePositiveInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

export function loadServerConfig(): ServerConfig {
  const nodeEnv = (process.env.NODE_ENV || 'development') as ServerConfig['nodeEnv'];
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('NODE_ENV must be development, test or production');

  const authJwtSecret = process.env.AUTH_JWT_SECRET?.trim();
  const authJwksUrl = process.env.AUTH_JWKS_URL?.trim();
  if (!authJwtSecret && !authJwksUrl) throw new Error('Configure AUTH_JWT_SECRET or AUTH_JWKS_URL');
  if (authJwtSecret && Buffer.byteLength(authJwtSecret) < 32) throw new Error('AUTH_JWT_SECRET must be at least 32 bytes');

  const databaseRuntimeRole = process.env.DATABASE_RUNTIME_ROLE?.trim() || 'petos_app';
  if (!/^[a-z_][a-z0-9_]*$/.test(databaseRuntimeRole)) throw new Error('DATABASE_RUNTIME_ROLE contains invalid characters');

  const corsOrigins = requireValue('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    nodeEnv,
    port: parsePositiveInt('API_PORT', 3001),
    databaseUrl: requireValue('DATABASE_URL'),
    redisUrl: requireValue('REDIS_URL'),
    databaseRuntimeRole,
    corsOrigins,
    authIssuer: requireValue('AUTH_ISSUER'),
    authAudience: requireValue('AUTH_AUDIENCE'),
    authJwtSecret,
    authJwksUrl,
    rateLimitPerMinute: parsePositiveInt('RATE_LIMIT_PER_MINUTE', 120),
  };
}
