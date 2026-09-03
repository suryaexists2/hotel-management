/**
 * Parse a short duration string (e.g. "15m", "7d", "30s", "12h") into milliseconds.
 *
 * Supported units: s (seconds), m (minutes), h (hours), d (days).
 * Used to derive absolute expiry timestamps for opaque refresh tokens from the
 * same human-readable env strings that JWT itself consumes.
 */
const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function parseDurationMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  const amountRaw = match?.[1];
  const unit = match?.[2];
  if (!amountRaw || !unit) {
    throw new Error(`Invalid duration string: "${value}". Expected forms like "15m", "7d".`);
  }

  const unitMs = UNIT_MS[unit];
  if (unitMs === undefined) {
    throw new Error(`Unsupported duration unit in "${value}".`);
  }

  return Number(amountRaw) * unitMs;
}
