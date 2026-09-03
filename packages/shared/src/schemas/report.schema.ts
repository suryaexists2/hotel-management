import { z } from 'zod';

/**
 * Reports accept an inclusive date range. Dates arrive as ISO strings on the query
 * string and are coerced to `Date`. When omitted, services default to a sensible
 * window (e.g. the trailing 30 days) so the endpoints are usable without params.
 */
export const reportRangeQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: 'from must be on or before to',
    path: ['from'],
  });

/** Single-day operational report (arrivals / departures / in-house). */
export const reportDayQuerySchema = z.object({
  date: z.coerce.date().optional(),
});

export type ReportRangeQuery = z.infer<typeof reportRangeQuerySchema>;
export type ReportDayQuery = z.infer<typeof reportDayQuerySchema>;
