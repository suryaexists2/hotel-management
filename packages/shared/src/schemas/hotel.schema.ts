import { z } from 'zod';

const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Time must be in HH:mm 24-hour format' });

export const updateHotelSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    address: z.string().trim().min(1).max(240).optional(),
    city: z.string().trim().min(1).max(120).optional(),
    state: z.string().trim().max(120).nullable().optional(),
    country: z.string().trim().min(1).max(120).optional(),
    zipCode: z.string().trim().max(20).nullable().optional(),
    phone: z.string().trim().min(1).max(40).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    website: z.string().url().max(200).nullable().optional(),
    logoUrl: z.string().url().max(500).nullable().optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    currency: z.string().trim().length(3, { message: 'Currency must be a 3-letter code' }).optional(),
    currencySymbol: z.string().trim().min(1).max(5).optional(),
    checkInTime: timeStringSchema.optional(),
    checkOutTime: timeStringSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const updateHotelSettingsSchema = z
  .object({
    supportedCurrencies: z.array(z.string().trim().length(3)).min(1).optional(),
    defaultTaxRate: z.coerce.number().min(0).max(1).optional(),
    allowOverbooking: z.boolean().optional(),
    overbookingLimit: z.coerce.number().int().min(0).max(1000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const upsertTaxRuleSchema = z.object({
  name: z.string().trim().min(1).max(80),
  rate: z.coerce.number().min(0).max(1),
  appliesTo: z.array(z.string().trim().min(1)).min(1),
  isInclusive: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type UpdateHotelInput = z.infer<typeof updateHotelSchema>;
export type UpdateHotelSettingsInput = z.infer<typeof updateHotelSettingsSchema>;
export type UpsertTaxRuleInput = z.infer<typeof upsertTaxRuleSchema>;
