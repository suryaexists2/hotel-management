import type { PaginationMeta } from '@innsight/shared';

/** Translate page/limit into Prisma `skip`/`take`. */
export function toSkipTake(page: number, limit: number): { skip: number; take: number } {
  return { skip: (page - 1) * limit, take: limit };
}

/** Build the pagination metadata block for a `StandardResponse`. */
export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}
