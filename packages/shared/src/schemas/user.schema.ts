import { z } from 'zod';
import { paginationQuerySchema } from './common.schema.js';
import { USER_STATUSES } from '../constants/enums.js';

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'Invalid email address' }),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters long' })
    .max(72, { message: 'Password must be at most 72 characters long' }),
  firstName: z.string().trim().min(1, { message: 'First name is required' }).max(80),
  lastName: z.string().trim().min(1, { message: 'Last name is required' }).max(80),
  roleId: z.string().min(1, { message: 'Role is required' }),
});

export const updateUserSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    roleId: z.string().min(1).optional(),
    status: z.enum(USER_STATUSES).optional(),
    avatarUrl: z.string().url().max(500).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const listUsersQuerySchema = paginationQuerySchema.extend({
  status: z.enum(USER_STATUSES).optional(),
  roleId: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: 'Current password is required' }),
  newPassword: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters long' })
    .max(72, { message: 'Password must be at most 72 characters long' }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
