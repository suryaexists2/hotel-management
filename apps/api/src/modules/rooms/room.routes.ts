import { Router } from 'express';
import { PERMISSIONS } from '@innsight/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { roomController } from './room.controller.js';

// ─── Room Types (/api/v1/room-types) ─────────────────
export const roomTypeRouter: Router = Router();
roomTypeRouter.use(authenticate);
roomTypeRouter.get('/', requirePermission(PERMISSIONS.ROOMS.READ), asyncHandler(roomController.listTypes));
roomTypeRouter.get('/:id', requirePermission(PERMISSIONS.ROOMS.READ), asyncHandler(roomController.getType));
roomTypeRouter.post('/', requirePermission(PERMISSIONS.ROOMS.CREATE), asyncHandler(roomController.createType));
roomTypeRouter.patch('/:id', requirePermission(PERMISSIONS.ROOMS.UPDATE), asyncHandler(roomController.updateType));
roomTypeRouter.delete('/:id', requirePermission(PERMISSIONS.ROOMS.DELETE), asyncHandler(roomController.removeType));

// ─── Rooms (/api/v1/rooms) ───────────────────────────
export const roomRouter: Router = Router();
roomRouter.use(authenticate);
roomRouter.get('/', requirePermission(PERMISSIONS.ROOMS.READ), asyncHandler(roomController.listRooms));
roomRouter.get('/:id', requirePermission(PERMISSIONS.ROOMS.READ), asyncHandler(roomController.getRoom));
roomRouter.post('/', requirePermission(PERMISSIONS.ROOMS.CREATE), asyncHandler(roomController.createRoom));
roomRouter.patch('/:id', requirePermission(PERMISSIONS.ROOMS.UPDATE), asyncHandler(roomController.updateRoom));
roomRouter.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.ROOMS.UPDATE),
  asyncHandler(roomController.updateRoomStatus),
);
roomRouter.delete('/:id', requirePermission(PERMISSIONS.ROOMS.DELETE), asyncHandler(roomController.removeRoom));
