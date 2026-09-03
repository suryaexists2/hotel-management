import { Router } from 'express';
import { PERMISSIONS } from '@innsight/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { reservationController } from './reservation.controller.js';

export const reservationRouter: Router = Router();

reservationRouter.use(authenticate);

reservationRouter.get(
  '/availability',
  requirePermission(PERMISSIONS.RESERVATIONS.READ),
  asyncHandler(reservationController.availability),
);
reservationRouter.get('/', requirePermission(PERMISSIONS.RESERVATIONS.READ), asyncHandler(reservationController.list));
reservationRouter.get('/:id', requirePermission(PERMISSIONS.RESERVATIONS.READ), asyncHandler(reservationController.getOne));
reservationRouter.post('/', requirePermission(PERMISSIONS.RESERVATIONS.CREATE), asyncHandler(reservationController.create));
reservationRouter.post(
  '/walk-in',
  requirePermission(PERMISSIONS.RESERVATIONS.CHECK_IN),
  asyncHandler(reservationController.walkIn),
);
reservationRouter.post(
  '/:id/check-in',
  requirePermission(PERMISSIONS.RESERVATIONS.CHECK_IN),
  asyncHandler(reservationController.checkIn),
);
reservationRouter.post(
  '/:id/check-out',
  requirePermission(PERMISSIONS.RESERVATIONS.CHECK_OUT),
  asyncHandler(reservationController.checkOut),
);
reservationRouter.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.RESERVATIONS.CANCEL),
  asyncHandler(reservationController.cancel),
);

// Occupant management (additional companions)
reservationRouter.get(
  '/:id/occupants',
  requirePermission(PERMISSIONS.RESERVATIONS.READ),
  asyncHandler(reservationController.listOccupants),
);
reservationRouter.post(
  '/:id/occupants',
  requirePermission(PERMISSIONS.RESERVATIONS.UPDATE),
  asyncHandler(reservationController.addOccupant),
);
reservationRouter.patch(
  '/:id/occupants/:occupantId',
  requirePermission(PERMISSIONS.RESERVATIONS.UPDATE),
  asyncHandler(reservationController.updateOccupant),
);
reservationRouter.delete(
  '/:id/occupants/:occupantId',
  requirePermission(PERMISSIONS.RESERVATIONS.UPDATE),
  asyncHandler(reservationController.removeOccupant),
);
