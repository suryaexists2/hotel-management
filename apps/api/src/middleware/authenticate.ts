import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../shared/errors/app-error.js';
import { tokenService } from '../modules/auth/token.service.js';

/**
 * Verify the Bearer access token and attach the decoded session to `req.user`.
 * Any verification failure (missing header, malformed/expired/invalid token) is
 * normalised to a 401 via `UnauthorizedError`.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or malformed Authorization header'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    next(new UnauthorizedError('Missing access token'));
    return;
  }

  try {
    req.user = tokenService.verifyAccessToken(token);
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired access token'));
  }
}
