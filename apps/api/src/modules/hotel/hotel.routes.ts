import { Router } from 'express';
import { PERMISSIONS } from '@innsight/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { hotelController } from './hotel.controller.js';

export const hotelRouter: Router = Router();

hotelRouter.use(authenticate);

// Reading the hotel profile is available to any authenticated staff member; writes
// require the system settings permission.
hotelRouter.get('/', asyncHandler(hotelController.getCurrent));
hotelRouter.patch(
  '/',
  requirePermission(PERMISSIONS.SYSTEM.SETTINGS),
  asyncHandler(hotelController.update),
);
hotelRouter.patch(
  '/settings',
  requirePermission(PERMISSIONS.SYSTEM.SETTINGS),
  asyncHandler(hotelController.updateSettings),
);

hotelRouter.get(
  '/tax-rules',
  requirePermission(PERMISSIONS.SYSTEM.SETTINGS),
  asyncHandler(hotelController.listTaxRules),
);
hotelRouter.post(
  '/tax-rules',
  requirePermission(PERMISSIONS.SYSTEM.SETTINGS),
  asyncHandler(hotelController.createTaxRule),
);
hotelRouter.patch(
  '/tax-rules/:id',
  requirePermission(PERMISSIONS.SYSTEM.SETTINGS),
  asyncHandler(hotelController.updateTaxRule),
);
hotelRouter.delete(
  '/tax-rules/:id',
  requirePermission(PERMISSIONS.SYSTEM.SETTINGS),
  asyncHandler(hotelController.deleteTaxRule),
);
