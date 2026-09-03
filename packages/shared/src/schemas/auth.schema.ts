import { z } from 'zod';

// bcrypt only considers the first 72 bytes of a password; capping length here keeps
// hashing/verification behaviour predictable and bounds request-body work.
const passwordSchema = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters long' })
  .max(72, { message: 'Password must be at most 72 characters long' });

// Normalise email to a canonical lowercase form so lookups and the unique
// constraint are case-insensitive (prevents duplicate / locked-out accounts).
const emailSchema = z.string().trim().toLowerCase().email({ message: 'Invalid email address' });

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, { message: 'Reset token is required' }),
    password: passwordSchema,
    confirmPassword: z.string().optional(),
  })
  .refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const userCreateSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().min(2, { message: 'First name must be at least 2 characters' }),
  lastName: z.string().trim().min(2, { message: 'Last name must be at least 2 characters' }),
  roleId: z.string().min(1, { message: 'Role is required' }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
