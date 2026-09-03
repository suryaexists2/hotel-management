import { z } from 'zod';
import { paginationQuerySchema } from './common.schema.js';
import { STOCK_MOVEMENT_TYPES } from '../constants/enums.js';

// ─── Suppliers ───────────────────────────────────────
export const createSupplierSchema = z.object({
  name: z.string().trim().min(1).max(160),
  contactName: z.string().trim().max(120).nullable().optional(),
  email: z.string().trim().toLowerCase().email().max(160).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(240).nullable().optional(),
});

export const updateSupplierSchema = createSupplierSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

// ─── Inventory items ─────────────────────────────────
export const createInventoryItemSchema = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(80),
  sku: z.string().trim().max(80).nullable().optional(),
  unit: z.string().trim().min(1).max(30),
  currentStock: z.coerce.number().int().min(0).default(0),
  reorderLevel: z.coerce.number().int().min(0).default(10),
  costPerUnit: z.coerce.number().nonnegative().nullable().optional(),
  supplierId: z.string().min(1).nullable().optional(),
});

export const updateInventoryItemSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    sku: z.string().trim().max(80).nullable().optional(),
    unit: z.string().trim().min(1).max(30).optional(),
    reorderLevel: z.coerce.number().int().min(0).optional(),
    costPerUnit: z.coerce.number().nonnegative().nullable().optional(),
    supplierId: z.string().min(1).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

export const listInventoryQuerySchema = paginationQuerySchema.extend({
  category: z.string().optional(),
  lowStock: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

// ─── Stock movements ─────────────────────────────────
export const createStockMovementSchema = z.object({
  type: z.enum(STOCK_MOVEMENT_TYPES),
  quantity: z.coerce.number().int().positive({ message: 'Quantity must be positive' }),
  reason: z.string().trim().max(240).nullable().optional(),
  referenceNo: z.string().trim().max(120).nullable().optional(),
});

export const listStockMovementsQuerySchema = paginationQuerySchema;

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
export type ListInventoryQuery = z.infer<typeof listInventoryQuerySchema>;
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;
export type ListStockMovementsQuery = z.infer<typeof listStockMovementsQuerySchema>;
