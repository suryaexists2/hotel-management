import { z } from 'zod';
import { CHARGE_CATEGORIES, PAYMENT_METHODS } from '../constants/enums.js';

// Categories a user may post manually (TAX is system-computed; DISCOUNT has its own route).
const MANUAL_CHARGE_CATEGORIES = CHARGE_CATEGORIES.filter(
  (c) => c !== 'TAX' && c !== 'DISCOUNT',
) as [string, ...string[]];

export const postChargeSchema = z.object({
  category: z.enum(MANUAL_CHARGE_CATEGORIES),
  description: z.string().trim().min(1).max(240),
  unitPrice: z.coerce.number().nonnegative(),
  quantity: z.coerce.number().int().min(1).max(1000).default(1),
  taxAmount: z.coerce.number().nonnegative().default(0),
});

export const voidChargeSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const applyDiscountSchema = z.object({
  description: z.string().trim().min(1).max(240),
  amount: z.coerce.number().positive({ message: 'Discount amount must be positive' }),
});

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive({ message: 'Payment amount must be positive' }),
  method: z.enum(PAYMENT_METHODS),
  referenceNo: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const refundPaymentSchema = z.object({
  amount: z.coerce.number().positive({ message: 'Refund amount must be positive' }),
  reason: z.string().trim().min(1).max(500),
});

export const updatePaymentSchema = z.object({
  amount: z.coerce.number().positive({ message: 'Payment amount must be positive' }),
  method: z.enum(PAYMENT_METHODS),
  referenceNo: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const voidPaymentSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export type PostChargeInput = z.infer<typeof postChargeSchema>;
export type VoidChargeInput = z.infer<typeof voidChargeSchema>;
export type ApplyDiscountInput = z.infer<typeof applyDiscountSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type VoidPaymentInput = z.infer<typeof voidPaymentSchema>;
