import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { ServerConfig } from './config';

export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    claims: JWTPayload;
  };
}

export function createAuthMiddleware(config: ServerConfig) {
  const remoteKeys = config.authJwksUrl ? createRemoteJWKSet(new URL(config.authJwksUrl)) : undefined;
  const secretKey = config.authJwtSecret ? new TextEncoder().encode(config.authJwtSecret) : undefined;

  return async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED' });

    try {
      const token = header.slice('Bearer '.length).trim();
      const key = remoteKeys || secretKey;
      if (!key) throw new Error('AUTH_VERIFIER_NOT_CONFIGURED');
      const { payload } = await jwtVerify(token, key, {
        issuer: config.authIssuer,
        audience: config.authAudience,
        algorithms: remoteKeys ? undefined : ['HS256'],
      });
      if (!payload.sub) return res.status(401).json({ error: 'TOKEN_SUBJECT_REQUIRED' });
      req.auth = { userId: payload.sub, claims: payload };
      next();
    } catch {
      return res.status(401).json({ error: 'INVALID_ACCESS_TOKEN' });
    }
  };
}

export function requireAuthenticated(req: AuthenticatedRequest): { userId: string; claims: JWTPayload } {
  if (!req.auth) throw new Error('AUTHENTICATION_REQUIRED');
  return req.auth;
}
