import { z } from 'zod';

/**
 * Common query/param schemas reused across every list and detail endpoint so
 * pagination, sorting and search behave identically platform-wide.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const idParamSchema = z.object({
  id: z.string().min(1, { message: 'Identifier is required' }),
});

export type IdParam = z.infer<typeof idParamSchema>;

/** Standard cursor-less pagination metadata returned in `StandardResponse.meta`. */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
