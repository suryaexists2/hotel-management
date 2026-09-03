import type { Request } from 'express';
import type { UserSessionPayload } from '@innsight/shared';
import { UnauthorizedError } from '../errors/app-error.js';

/**
 * Return the authenticated session or throw. Routes that use this must be mounted
 * behind `authenticate`; the throw is defence-in-depth against misconfiguration so
 * a handler can never silently operate without a tenant/user context.
 */
export function requireUser(req: Request): UserSessionPayload {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  return req.user;
}

/** Convenience accessor for the current tenant id. */
export function hotelScope(req: Request): string {
  return requireUser(req).hotelId;
}
