import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from '@innsight/shared';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { validateBody } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authController } from './auth.controller.js';

/**
 * Tight rate limit on credential-accepting endpoints to blunt brute-force and
 * token-stuffing. Every attempt counts toward the window (including successful ones)
 * so credential-stuffing that lands valid hits is still throttled; the per-account
 * lockout in auth.service is the second, independent layer of defense.
 */
const authRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRouter: Router = Router();

authRouter.post('/register', authRateLimiter, asyncHandler(authController.register));
authRouter.post(
  '/login',
  authRateLimiter,
  validateBody(loginSchema),
  asyncHandler(authController.login),
);
authRouter.post('/refresh', authRateLimiter, asyncHandler(authController.refresh));
authRouter.post('/logout', asyncHandler(authController.logout));
authRouter.get('/me', authenticate, asyncHandler(authController.me));
authRouter.post(
  '/forgot-password',
  authRateLimiter,
  validateBody(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword),
);
authRouter.post(
  '/reset-password',
  authRateLimiter,
  validateBody(resetPasswordSchema),
  asyncHandler(authController.resetPassword),
);
