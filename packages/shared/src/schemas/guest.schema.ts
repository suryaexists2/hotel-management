import { z } from 'zod';
import { paginationQuerySchema } from './common.schema.js';

const isoDateSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be ISO-8601' }));

export const createGuestSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(160).nullable().optional(),
  phone: z.string().trim().min(3).max(40).nullable().optional(),
  dateOfBirth: isoDateSchema.nullable().optional(),
  nationality: z.string().trim().max(80).nullable().optional(),
  idType: z.string().trim().max(40).nullable().optional(),
  idNumber: z.string().trim().max(80).nullable().optional(),
  address: z.string().trim().max(240).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(120).nullable().optional(),
  vipLevel: z.coerce.number().int().min(0).max(5).default(0),
  preferences: z.record(z.string(), z.unknown()).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const updateGuestSchema = createGuestSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' },
);

export const listGuestsQuerySchema = paginationQuerySchema.extend({
  vipOnly: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type CreateGuestInput = z.infer<typeof createGuestSchema>;
export type UpdateGuestInput = z.infer<typeof updateGuestSchema>;
export type ListGuestsQuery = z.infer<typeof listGuestsQuerySchema>;
