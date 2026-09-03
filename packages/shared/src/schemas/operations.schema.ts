import { z } from 'zod';
import { paginationQuerySchema } from './common.schema.js';
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  MAINTENANCE_STATUSES,
  MAINTENANCE_PRIORITIES,
} from '../constants/enums.js';

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be ISO-8601' }));

// ─── Housekeeping ────────────────────────────────────
export const createHousekeepingTaskSchema = z.object({
  roomId: z.string().min(1),
  assignedTo: z.string().min(1).nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).default('MEDIUM'),
  type: z.string().trim().min(1).max(60).default('CHECKOUT_CLEAN'),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const updateHousekeepingTaskSchema = z
  .object({
    assignedTo: z.string().min(1).nullable().optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    type: z.string().trim().min(1).max(60).optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

export const updateHousekeepingStatusSchema = z.object({
  status: z.enum(TASK_STATUSES),
  notes: z.string().trim().max(1000).optional(),
});

export const listHousekeepingQuerySchema = paginationQuerySchema.extend({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assignedTo: z.string().optional(),
  roomId: z.string().optional(),
});

// ─── Maintenance ─────────────────────────────────────
export const createMaintenanceOrderSchema = z.object({
  roomId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(2000),
  priority: z.enum(MAINTENANCE_PRIORITIES).default('P3_MEDIUM'),
  assignedTo: z.string().min(1).nullable().optional(),
  reportedById: z.string().min(1).optional(),
  estimatedCost: z.coerce.number().nonnegative().nullable().optional(),
  scheduledDate: isoDate.nullable().optional(),
});

export const updateMaintenanceOrderSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().min(1).max(2000).optional(),
    priority: z.enum(MAINTENANCE_PRIORITIES).optional(),
    assignedTo: z.string().min(1).nullable().optional(),
    estimatedCost: z.coerce.number().nonnegative().nullable().optional(),
    actualCost: z.coerce.number().nonnegative().nullable().optional(),
    scheduledDate: isoDate.nullable().optional(),
    images: z.array(z.string().url().max(500)).max(20).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

export const updateMaintenanceStatusSchema = z.object({
  status: z.enum(MAINTENANCE_STATUSES),
  resolution: z.string().trim().max(2000).optional(),
});

export const listMaintenanceQuerySchema = paginationQuerySchema.extend({
  status: z.enum(MAINTENANCE_STATUSES).optional(),
  priority: z.enum(MAINTENANCE_PRIORITIES).optional(),
  assignedTo: z.string().optional(),
  roomId: z.string().optional(),
});

export type CreateHousekeepingTaskInput = z.infer<typeof createHousekeepingTaskSchema>;
export type UpdateHousekeepingTaskInput = z.infer<typeof updateHousekeepingTaskSchema>;
export type UpdateHousekeepingStatusInput = z.infer<typeof updateHousekeepingStatusSchema>;
export type ListHousekeepingQuery = z.infer<typeof listHousekeepingQuerySchema>;
export type CreateMaintenanceOrderInput = z.infer<typeof createMaintenanceOrderSchema>;
export type UpdateMaintenanceOrderInput = z.infer<typeof updateMaintenanceOrderSchema>;
export type UpdateMaintenanceStatusInput = z.infer<typeof updateMaintenanceStatusSchema>;
export type ListMaintenanceQuery = z.infer<typeof listMaintenanceQuerySchema>;
