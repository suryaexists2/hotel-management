import { z } from 'zod';
import { paginationQuerySchema } from './common.schema.js';
import { ALL_PERMISSIONS } from '../constants/permissions.js';

// Permissions must be members of the shared permission matrix — rejects typos and
// fabricated permission strings at the API boundary.
const permissionKeySchema = z
  .string()
  .refine((value): value is (typeof ALL_PERMISSIONS)[number] => ALL_PERMISSIONS.includes(value as never), {
    message: 'Unknown permission',
  });

export const createRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'Role name must be at least 2 characters' })
    .max(60, { message: 'Role name must be at most 60 characters' }),
  description: z.string().trim().max(280).optional(),
  permissions: z.array(permissionKeySchema).min(1, { message: 'At least one permission is required' }),
});

export const updateRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    description: z.string().trim().max(280).nullable().optional(),
    permissions: z.array(permissionKeySchema).min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const listRolesQuerySchema = paginationQuerySchema;

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type ListRolesQuery = z.infer<typeof listRolesQuerySchema>;
