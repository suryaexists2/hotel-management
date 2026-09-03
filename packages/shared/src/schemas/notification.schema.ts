import { z } from 'zod';
import { paginationQuerySchema } from './common.schema.js';
import { NOTIFICATION_TYPES } from '../constants/enums.js';

export const createNotificationSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(NOTIFICATION_TYPES).default('INFO'),
  title: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(1000),
  link: z.string().trim().max(500).nullable().optional(),
});

export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
