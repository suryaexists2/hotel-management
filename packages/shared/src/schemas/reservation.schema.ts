import { z } from 'zod';
import { paginationQuerySchema } from './common.schema.js';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD' });

export const availabilityQuerySchema = z.object({
  roomTypeId: z.string().min(1),
  checkInDate: dateOnly,
  checkOutDate: dateOnly,
});

const baseBooking = {
  guestId: z.string().min(1, { message: 'Guest is required' }),
  roomTypeId: z.string().min(1, { message: 'Room type is required' }),
  checkInDate: dateOnly,
  checkOutDate: dateOnly,
  adults: z.coerce.number().int().min(1).max(30).default(1),
  children: z.coerce.number().int().min(0).max(30).default(0),
  ratePerNight: z.coerce.number().nonnegative().optional(),
  source: z.string().trim().max(40).default('DIRECT'),
  specialRequests: z.string().trim().max(1000).nullable().optional(),
  internalNotes: z.string().trim().max(1000).nullable().optional(),
};

export const createReservationSchema = z
  .object({ ...baseBooking, roomId: z.string().min(1).optional() })
  .refine((d) => d.checkOutDate > d.checkInDate, {
    message: 'Check-out must be after check-in',
    path: ['checkOutDate'],
  });

export const walkInSchema = z
  .object({ ...baseBooking, roomId: z.string().min(1).optional() })
  .refine((d) => d.checkOutDate > d.checkInDate, {
    message: 'Check-out must be after check-in',
    path: ['checkOutDate'],
  });

export const checkInSchema = z.object({
  roomId: z.string().min(1).optional(),
});

export const cancelReservationSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const listReservationsQuerySchema = paginationQuerySchema.extend({
  status: z.string().optional(),
  guestId: z.string().optional(),
  roomId: z.string().optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type WalkInInput = z.infer<typeof walkInSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type CancelReservationInput = z.infer<typeof cancelReservationSchema>;
export type ListReservationsQuery = z.infer<typeof listReservationsQuerySchema>;
