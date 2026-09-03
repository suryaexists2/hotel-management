import { Prisma, prisma } from '@innsight/database';
import type { ListAuditLogsQuery, PaginationMeta } from '@innsight/shared';
import { toSkipTake, buildPaginationMeta } from '../../shared/http/pagination.js';

export interface AuditEntry {
  hotelId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Append-only audit trail. Recording is best-effort: a logging failure must never
 * roll back or break the business operation that triggered it, so errors are
 * swallowed after being reported to the server console.
 */
export class AuditService {
  async record(entry: AuditEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          hotelId: entry.hotelId,
          userId: entry.userId ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          oldValues: entry.oldValues ? JSON.stringify(entry.oldValues) : null as any,
          newValues: entry.newValues ? JSON.stringify(entry.newValues) : null as any,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (error) {
      console.error('⚠️ Failed to write audit log entry:', error);
    }
  }

  async list(
    hotelId: string,
    query: ListAuditLogsQuery,
  ): Promise<{ items: Prisma.AuditLogGetPayload<{ include: { user: { select: { id: true; email: true } } } }>[]; meta: PaginationMeta }> {
    const { page, limit, entity, entityId, userId, action, from, to, sortOrder } = query;
    const where: Prisma.AuditLogWhereInput = {
      hotelId,
      ...(entity ? { entity } : {}),
      ...(entityId ? { entityId } : {}),
      ...(userId ? { userId } : {}),
      ...(action ? { action } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };
    const { skip, take } = toSkipTake(page, limit);
    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, email: true } } },
        orderBy: { createdAt: sortOrder },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(page, limit, total) };
  }
}

export const auditService = new AuditService();
