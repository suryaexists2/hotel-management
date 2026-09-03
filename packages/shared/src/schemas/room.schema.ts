import { z } from 'zod';
import { paginationQuerySchema } from './common.schema.js';
import { ROOM_STATUSES } from '../constants/enums.js';

// ─── Room Types ──────────────────────────────────────
export const createRoomTypeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  baseRate: z.coerce.number().nonnegative({ message: 'Base rate cannot be negative' }),
  maxOccupancy: z.coerce.number().int().min(1).max(30),
  maxAdults: z.coerce.number().int().min(1).max(30),
  maxChildren: z.coerce.number().int().min(0).max(30).default(0),
  amenities: z.array(z.string().trim().min(1).max(60)).max(60).default([]),
  images: z.array(z.string().url().max(500)).max(30).default([]),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateRoomTypeSchema = createRoomTypeSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' },
);

export const listRoomTypesQuerySchema = paginationQuerySchema.extend({
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

// ─── Rooms ───────────────────────────────────────────
export const createRoomSchema = z.object({
  roomTypeId: z.string().min(1, { message: 'Room type is required' }),
  roomNumber: z.string().trim().min(1).max(20),
  floor: z.coerce.number().int().min(-10).max(200),
  status: z.enum(ROOM_STATUSES).default('AVAILABLE'),
  notes: z.string().trim().max(1000).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const updateRoomSchema = z
  .object({
    roomTypeId: z.string().min(1).optional(),
    roomNumber: z.string().trim().min(1).max(20).optional(),
    floor: z.coerce.number().int().min(-10).max(200).optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const updateRoomStatusSchema = z.object({
  status: z.enum(ROOM_STATUSES),
  notes: z.string().trim().max(1000).optional(),
});

export const listRoomsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ROOM_STATUSES).optional(),
  roomTypeId: z.string().optional(),
  floor: z.coerce.number().int().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type CreateRoomTypeInput = z.infer<typeof createRoomTypeSchema>;
export type UpdateRoomTypeInput = z.infer<typeof updateRoomTypeSchema>;
export type ListRoomTypesQuery = z.infer<typeof listRoomTypesQuerySchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type UpdateRoomStatusInput = z.infer<typeof updateRoomStatusSchema>;
export type ListRoomsQuery = z.infer<typeof listRoomsQuerySchema>;
