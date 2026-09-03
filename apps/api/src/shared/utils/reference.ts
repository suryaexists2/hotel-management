import crypto from 'node:crypto';

/**
 * Human-readable, collision-resistant reference numbers for reservations, folios,
 * invoices and orders. Format: PREFIX-YYYYMMDD-XXXXXX where the suffix is 6 random
 * base32 chars (~1e9 space per day per prefix). Callers persist behind a UNIQUE
 * column and retry on the rare P2002, so absolute uniqueness is enforced by the DB.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)

export function generateReference(prefix: string, now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  let suffix = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i += 1) {
    suffix += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return `${prefix}-${y}${m}${d}-${suffix}`;
}
