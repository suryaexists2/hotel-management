import { z } from 'zod';
import { paginationQuerySchema } from './common.schema.js';

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be ISO-8601' }));

export const listAuditLogsQuerySchema = paginationQuerySchema.extend({
  entity: z.string().trim().max(80).optional(),
  entityId: z.string().trim().max(80).optional(),
  userId: z.string().trim().max(80).optional(),
  action: z.string().trim().max(40).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
