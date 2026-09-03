import { Router } from 'express';
import { PERMISSIONS } from '@innsight/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { housekeepingController } from './housekeeping.controller.js';

export const housekeepingRouter: Router = Router();

housekeepingRouter.use(authenticate);
housekeepingRouter.get('/', requirePermission(PERMISSIONS.HOUSEKEEPING.READ), asyncHandler(housekeepingController.list));
housekeepingRouter.get('/:id', requirePermission(PERMISSIONS.HOUSEKEEPING.READ), asyncHandler(housekeepingController.getOne));
housekeepingRouter.post('/', requirePermission(PERMISSIONS.HOUSEKEEPING.CREATE_TASK), asyncHandler(housekeepingController.create));
housekeepingRouter.patch('/:id', requirePermission(PERMISSIONS.HOUSEKEEPING.UPDATE_TASK), asyncHandler(housekeepingController.update));
housekeepingRouter.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.HOUSEKEEPING.UPDATE_TASK),
  asyncHandler(housekeepingController.updateStatus),
);
housekeepingRouter.post(
  '/:id/inspect',
  requirePermission(PERMISSIONS.ROOMS.INSPECT),
  asyncHandler(housekeepingController.inspect),
);
