import { Router } from 'express';
import { PERMISSIONS } from '@innsight/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { notificationController } from './notification.controller.js';

export const notificationRouter: Router = Router();

notificationRouter.use(authenticate);

// Self-service: any authenticated user manages their own notifications.
notificationRouter.get('/', asyncHandler(notificationController.list));
notificationRouter.get('/unread-count', asyncHandler(notificationController.unreadCount));
notificationRouter.post('/read-all', asyncHandler(notificationController.markAllRead));
notificationRouter.post('/:id/read', asyncHandler(notificationController.markRead));

// Creating a notification for another user is an administrative action.
notificationRouter.post(
  '/',
  requirePermission(PERMISSIONS.USERS.UPDATE),
  asyncHandler(notificationController.create),
);
