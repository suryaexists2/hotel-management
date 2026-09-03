import type { UserSessionPayload } from '@innsight/shared';

/**
 * Augment Express's Request with the authenticated session established by the
 * `authenticate` middleware. Downstream handlers read `req.user` with full typing.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserSessionPayload;
    }
  }
}

export {};
