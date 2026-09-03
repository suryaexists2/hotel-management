import type { CookieOptions, Request, Response } from 'express';
import { setupHotelSchema } from '@innsight/shared';
import { env } from '../../config/env.js';
import { sendOk, sendCreated } from '../../shared/http/respond.js';
import { setupService } from './setup.service.js';

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
  };
}

export const setupController = {
  async check(_req: Request, res: Response): Promise<void> {
    sendOk(res, await setupService.check());
  },

  async setup(req: Request, res: Response): Promise<void> {
    const input = setupHotelSchema.parse(req.body);
    const result = await setupService.setup(input);

    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions());

    sendCreated(res, {
      hotelId: result.hotelId,
      accessToken: result.accessToken,
      message: result.message,
    });
  },
};
