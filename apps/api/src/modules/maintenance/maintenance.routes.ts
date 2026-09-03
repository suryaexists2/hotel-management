import { Router } from 'express';
import { PERMISSIONS } from '@innsight/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { maintenanceController } from './maintenance.controller.js';

export const maintenanceRouter: Router = Router();

maintenanceRouter.use(authenticate);
maintenanceRouter.get('/', requirePermission(PERMISSIONS.MAINTENANCE.READ), asyncHandler(maintenanceController.list));
maintenanceRouter.get('/:id', requirePermission(PERMISSIONS.MAINTENANCE.READ), asyncHandler(maintenanceController.getOne));
maintenanceRouter.post('/', requirePermission(PERMISSIONS.MAINTENANCE.CREATE_ORDER), asyncHandler(maintenanceController.create));
maintenanceRouter.patch('/:id', requirePermission(PERMISSIONS.MAINTENANCE.UPDATE_ORDER), asyncHandler(maintenanceController.update));
maintenanceRouter.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.MAINTENANCE.RESOLVE),
  asyncHandler(maintenanceController.updateStatus),
);
maintenanceRouter.delete('/:id', requirePermission(PERMISSIONS.MAINTENANCE.UPDATE_ORDER), asyncHandler(maintenanceController.remove));
