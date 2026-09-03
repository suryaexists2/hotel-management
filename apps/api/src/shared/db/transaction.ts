import { Prisma, prisma } from '@innsight/database';

type Tx = Prisma.TransactionClient;

// Prisma surfaces Postgres serialization / write-conflict / deadlock aborts as P2034.
const RETRYABLE_CODES = new Set(['P2034']);

/**
 * Run a transaction at Serializable isolation, retrying a bounded number of times
 * when Postgres aborts it for a serialization conflict (Prisma P2034).
 *
 * Under the default Read Committed level, read-modify-write flows — booking
 * availability checks, room-assignment conflict checks and folio total rollups —
 * can interleave and produce overbooking or a drifted ledger balance. Serializable
 * makes those conflicts abort deterministically; the retry loop absorbs the abort so
 * callers see either success or a genuine business error, never a lost update.
 */
export async function runSerializable<T>(fn: (tx: Tx) => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        RETRYABLE_CODES.has(error.code)
      ) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
