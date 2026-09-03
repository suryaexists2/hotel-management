import { z } from 'zod';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Load .env file (from project root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../../../.env') });

// Token lifetimes are expressed as `<number><unit>` where unit ∈ s|m|h|d. Validating
// the shape here means `duration.ts` never has to throw at token-mint time.
const durationString = z.string().regex(/^\d+[smhd]$/, 'must look like 15m, 7d, 3600s');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: durationString.default('15m'),
  JWT_REFRESH_EXPIRY: durationString.default('7d'),
  // Comma-separated allowlist of browser origins. `*` is rejected below because it is
  // invalid together with `credentials: true` (the cookie-based refresh flow).
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  // Number of trusted reverse-proxy hops. Must be set correctly in production so
  // `req.ip` (and thus IP rate limiting) reflects the real client and cannot be
  // spoofed via X-Forwarded-For. 0 = trust no proxy (direct connection).
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('noreply@innsight.io'),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('❌ Invalid environment variables:', result.error.format());
  process.exit(1);
}

const parsed = result.data;

// Fail fast on insecure production configuration. A forgeable JWT secret is a full
// auth-bypass (an attacker can mint a super-admin token), and a wildcard CORS origin
// is invalid with credentialed requests.
if (parsed.NODE_ENV === 'production') {
  const problems: string[] = [];
  if (/^change-this/i.test(parsed.JWT_SECRET) || /^change-this/i.test(parsed.JWT_REFRESH_SECRET)) {
    problems.push('JWT secret is still the placeholder value — set a strong random secret');
  }
  if (parsed.CORS_ORIGIN.trim() === '*') {
    problems.push('CORS_ORIGIN cannot be "*" when credentials are enabled');
  }
  if (problems.length > 0) {
    console.error(`❌ Refusing to start in production:\n - ${problems.join('\n - ')}`);
    process.exit(1);
  }
}

/** Parsed CORS origins as an array (single value or comma-separated allowlist). */
export const corsOrigins = parsed.CORS_ORIGIN.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const env = parsed;
