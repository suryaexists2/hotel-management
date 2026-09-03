import type { CookieOptions, Request, Response } from 'express';
import type { LoginInput, UserCreateInput } from '@innsight/shared';
import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../shared/errors/app-error.js';
import { sendOk } from '../../shared/http/respond.js';
import { authService, type PublicUser } from './auth.service.js';

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

/** Cookie options for the rotating refresh token — httpOnly and scoped to auth routes. */
function refreshCookieOptions(expiresAt?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[REFRESH_COOKIE];
}

interface LoginResponseData {
  user: PublicUser;
  accessToken: string;
}

interface RefreshResponseData {
  accessToken: string;
}

/**
 * HTTP boundary for authentication. Controllers stay thin: translate request →
 * service call → `StandardResponse` envelope, and manage the refresh-token cookie.
 */
export const authController = {
  async login(req: Request, res: Response): Promise<void> {
    // Body is already validated/typed by `validateBody(loginSchema)`.
    const input = req.body as LoginInput;
    const result = await authService.login(input);

    res.cookie(
      REFRESH_COOKIE,
      result.refreshToken,
      refreshCookieOptions(result.refreshTokenExpiresAt),
    );

    sendOk(res, { user: result.user, accessToken: result.accessToken } satisfies LoginResponseData);
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const rawToken = readRefreshCookie(req);
    if (!rawToken) {
      throw new UnauthorizedError('No refresh token provided');
    }

    const tokens = await authService.refresh(rawToken);
    res.cookie(
      REFRESH_COOKIE,
      tokens.refreshToken,
      refreshCookieOptions(tokens.refreshTokenExpiresAt),
    );

    sendOk(res, { accessToken: tokens.accessToken } satisfies RefreshResponseData);
  },

  async logout(req: Request, res: Response): Promise<void> {
    const rawToken = readRefreshCookie(req);
    if (rawToken) {
      await authService.logout(rawToken);
    }

    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());

    sendOk(res, { message: 'Logged out successfully' });
  },

  async me(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const user = await authService.getProfile(req.user.userId);

    sendOk(res, user);
  },

  async register(req: Request, res: Response): Promise<void> {
    const input = req.body as UserCreateInput & { hotelName: string; hotelPhone: string; hotelAddress: string };
    const result = await authService.register(input);

    res.cookie(
      REFRESH_COOKIE,
      result.refreshToken,
      refreshCookieOptions(result.refreshTokenExpiresAt),
    );

    sendOk(res, { user: result.user, accessToken: result.accessToken });
  },

  async forgotPassword(req: Request, res: Response): Promise<void> {
    const { email } = req.body as { email: string };
    const result = await authService.forgotPassword(email);
    sendOk(res, { message: result.message });
  },

  async resetPassword(req: Request, res: Response): Promise<void> {
    const { token, password } = req.body as { token: string; password: string };
    await authService.resetPassword(token, password);
    sendOk(res, { message: 'Password reset successfully' });
  },
};
