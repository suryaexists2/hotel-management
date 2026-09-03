import { z } from 'zod';

export const setupCheckSchema = z.object({
  configured: z.boolean(),
});

export const setupHotelSchema = z.object({
  name: z.string().trim().min(1, 'Hotel name is required').max(120),
  phone: z.string().trim().min(3, 'Phone number is required').max(40),
  address: z.string().trim().min(1, 'Address is required').max(240),
  email: z.string().trim().toLowerCase().email().default('admin@innsight.io'),
  password: z.string().min(8).max(72).default('Admin@12345'),
});

export const guestIdProofSchema = z.object({
  idProofFront: z.string().nullable().optional(),
  idProofBack: z.string().nullable().optional(),
});

export const bulkDeleteGuestsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one guest ID is required'),
});

export const deleteByDateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const guestHistoryQuerySchema = z.object({
  guestId: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SetupHotelInput = z.infer<typeof setupHotelSchema>;
export type GuestIdProofInput = z.infer<typeof guestIdProofSchema>;
export type BulkDeleteGuestsInput = z.infer<typeof bulkDeleteGuestsSchema>;
export type DeleteByDateRangeInput = z.infer<typeof deleteByDateRangeSchema>;
export type GuestHistoryQuery = z.infer<typeof guestHistoryQuerySchema>;
