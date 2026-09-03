import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { PermissionType } from '@innsight/shared';
import { ForbiddenError, UnauthorizedError } from '../shared/errors/app-error.js';

/**
 * Guard a route by RBAC using the shared permission matrix. The caller must hold
 * *every* listed permission. Platform super-admins bypass the check via the
 * server-derived `isSuperAdmin` claim — never via the tenant-settable role name.
 *
 * Must run after `authenticate`, which populates `req.user`.
 */
export function requirePermission(...required: PermissionType[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { user } = req;

    if (!user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    if (user.isSuperAdmin) {
      next();
      return;
    }

    const granted = new Set(user.permissions);
    const missing = required.filter((permission) => !granted.has(permission));

    if (missing.length > 0) {
      next(new ForbiddenError(`Missing required permission(s): ${missing.join(', ')}`));
      return;
    }

    next();
  };
}
