import { Router } from 'express';
import { PERMISSIONS } from '@innsight/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { userController } from './user.controller.js';

export const userRouter: Router = Router();

// Every user-management route requires authentication.
userRouter.use(authenticate);

// Self-service: change own password (no elevated permission required).
userRouter.post('/me/change-password', asyncHandler(userController.changePassword));

userRouter.get('/', requirePermission(PERMISSIONS.USERS.READ), asyncHandler(userController.list));
userRouter.get('/:id', requirePermission(PERMISSIONS.USERS.READ), asyncHandler(userController.getOne));
userRouter.post('/', requirePermission(PERMISSIONS.USERS.CREATE), asyncHandler(userController.create));
userRouter.patch('/:id', requirePermission(PERMISSIONS.USERS.UPDATE), asyncHandler(userController.update));
userRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.USERS.DELETE),
  asyncHandler(userController.deactivate),
);
