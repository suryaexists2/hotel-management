import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { UserSessionPayload } from '@innsight/shared';
import { env } from '../../config/env.js';
import { parseDurationMs } from '../../shared/utils/duration.js';
import { sessionPayloadSchema } from './jwt.schema.js';

/**
 * A freshly minted opaque refresh token. The `raw` value is returned to the client
 * exactly once; only its SHA-256 `hash` is ever persisted, so a database leak never
 * exposes usable tokens.
 */
export interface GeneratedRefreshToken {
  raw: string;
  hash: string;
  expiresAt: Date;
}

const REFRESH_TOKEN_BYTES = 48;

// Pin the signing algorithm and bind an issuer so verification cannot be coerced
// into accepting a different `alg` and tokens from other systems are rejected.
const JWT_ALGORITHM = 'HS256' as const;
const JWT_ISSUER = 'innsight-api';

/**
 * Encapsulates all token cryptography. The auth service depends on this interface,
 * keeping JWT/hashing details in one swappable place (SRP + DIP).
 */
export interface TokenService {
  signAccessToken(payload: UserSessionPayload): string;
  verifyAccessToken(token: string): UserSessionPayload;
  generateRefreshToken(): GeneratedRefreshToken;
  hashRefreshToken(raw: string): string;
}

function hashRefreshToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export const tokenService: TokenService = {
  signAccessToken(payload: UserSessionPayload): string {
    const options: SignOptions = {
      expiresIn: env.JWT_ACCESS_EXPIRY as SignOptions['expiresIn'],
      algorithm: JWT_ALGORITHM,
      issuer: JWT_ISSUER,
    };
    return jwt.sign(payload, env.JWT_SECRET, options);
  },

  verifyAccessToken(token: string): UserSessionPayload {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
    });
    // `decoded` is `string | JwtPayload`; Zod narrows it to our contract or throws.
    return sessionPayloadSchema.parse(decoded);
  },

  generateRefreshToken(): GeneratedRefreshToken {
    const raw = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const expiresAt = new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRY));
    return { raw, hash: hashRefreshToken(raw), expiresAt };
  },

  hashRefreshToken,
};
