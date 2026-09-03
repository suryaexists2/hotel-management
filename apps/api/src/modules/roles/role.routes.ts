import { Router } from 'express';
import { PERMISSIONS } from '@innsight/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { roleController } from './role.controller.js';

export const roleRouter: Router = Router();

roleRouter.use(authenticate);

roleRouter.get(
  '/permissions/catalog',
  requirePermission(PERMISSIONS.ROLES.READ),
  asyncHandler(async (req, res) => roleController.catalog(req, res)),
);
roleRouter.get('/', requirePermission(PERMISSIONS.ROLES.READ), asyncHandler(roleController.list));
roleRouter.get('/:id', requirePermission(PERMISSIONS.ROLES.READ), asyncHandler(roleController.getOne));
roleRouter.post('/', requirePermission(PERMISSIONS.ROLES.CREATE), asyncHandler(roleController.create));
roleRouter.patch('/:id', requirePermission(PERMISSIONS.ROLES.UPDATE), asyncHandler(roleController.update));
roleRouter.delete('/:id', requirePermission(PERMISSIONS.ROLES.DELETE), asyncHandler(roleController.remove));
