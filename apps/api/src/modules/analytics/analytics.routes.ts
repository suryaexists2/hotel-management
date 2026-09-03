import { Router } from 'express';
import { PERMISSIONS } from '@innsight/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { analyticsController } from './analytics.controller.js';

export const analyticsRouter: Router = Router();

analyticsRouter.use(authenticate);

analyticsRouter.get(
  '/',
  requirePermission(PERMISSIONS.ANALYTICS.VIEW),
  asyncHandler(analyticsController.list),
);

analyticsRouter.post(
  '/compute',
  requirePermission(PERMISSIONS.ANALYTICS.VIEW),
  asyncHandler(analyticsController.compute),
);

analyticsRouter.post(
  '/seed',
  requirePermission(PERMISSIONS.ANALYTICS.DELETE),
  asyncHandler(analyticsController.seed),
);

analyticsRouter.get(
  '/:date',
  requirePermission(PERMISSIONS.ANALYTICS.VIEW),
  asyncHandler(analyticsController.getByDate),
);

analyticsRouter.delete(
  '/:date',
  requirePermission(PERMISSIONS.ANALYTICS.DELETE),
  asyncHandler(analyticsController.delete),
);
