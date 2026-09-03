import { z } from 'zod';
import { paginationQuerySchema } from './common.schema.js';
import { ORDER_TYPES, ORDER_STATUSES } from '../constants/enums.js';

// ─── Menu ────────────────────────────────────────────
export const createMenuItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  category: z.string().trim().min(1).max(60),
  price: z.coerce.number().nonnegative(),
  isAvailable: z.boolean().default(true),
  isVegetarian: z.boolean().default(false),
  allergens: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  imageUrl: z.string().url().max(500).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const updateMenuItemSchema = createMenuItemSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

export const listMenuQuerySchema = paginationQuerySchema.extend({
  category: z.string().optional(),
  isAvailable: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

// ─── Orders ──────────────────────────────────────────
export const createOrderSchema = z
  .object({
    type: z.enum(ORDER_TYPES),
    roomNumber: z.string().trim().max(20).nullable().optional(),
    tableNumber: z.string().trim().max(20).nullable().optional(),
    guestId: z.string().min(1).nullable().optional(),
    folioId: z.string().min(1).nullable().optional(),
    specialInstructions: z.string().trim().max(1000).nullable().optional(),
    items: z
      .array(
        z.object({
          menuItemId: z.string().min(1),
          quantity: z.coerce.number().int().min(1).max(100),
          notes: z.string().trim().max(240).nullable().optional(),
        }),
      )
      .min(1, { message: 'An order must contain at least one item' }),
  })
  .refine((d) => d.type !== 'ROOM_SERVICE' || Boolean(d.roomNumber || d.folioId), {
    message: 'Room service orders require a room number or folio',
    path: ['roomNumber'],
  });

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

export const listOrdersQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  type: z.enum(ORDER_TYPES).optional(),
});

export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
export type ListMenuQuery = z.infer<typeof listMenuQuerySchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
