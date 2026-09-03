import { z } from 'zod';
import { paginationQuerySchema } from './common.schema.js';

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be ISO-8601' }));

export const createEmployeeSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(160).nullable().optional(),
  phone: z.string().trim().min(3).max(40).nullable().optional(),
  department: z.string().trim().min(1).max(80),
  position: z.string().trim().min(1).max(80),
  employeeCode: z.string().trim().min(1).max(40).nullable().optional(),
  dateOfJoining: isoDate,
  emergencyContact: z.string().trim().max(120).nullable().optional(),
  emergencyPhone: z.string().trim().max(40).nullable().optional(),
  userId: z.string().min(1).nullable().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const listEmployeesQuerySchema = paginationQuerySchema.extend({
  department: z.string().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
