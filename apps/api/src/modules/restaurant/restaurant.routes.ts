import { Router } from 'express';
import { PERMISSIONS } from '@innsight/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { restaurantController } from './restaurant.controller.js';

const R = PERMISSIONS.RESTAURANT;

// ─── Menu (/api/v1/menu) ─────────────────────────────
export const menuRouter: Router = Router();
menuRouter.use(authenticate);
menuRouter.get('/', requirePermission(R.READ), asyncHandler(restaurantController.listMenu));
menuRouter.get('/:id', requirePermission(R.READ), asyncHandler(restaurantController.getMenuItem));
menuRouter.post('/', requirePermission(R.CREATE_MENU_ITEM), asyncHandler(restaurantController.createMenuItem));
menuRouter.patch('/:id', requirePermission(R.UPDATE_MENU_ITEM), asyncHandler(restaurantController.updateMenuItem));
menuRouter.delete('/:id', requirePermission(R.UPDATE_MENU_ITEM), asyncHandler(restaurantController.removeMenuItem));

// ─── Orders (/api/v1/orders) ─────────────────────────
export const orderRouter: Router = Router();
orderRouter.use(authenticate);
orderRouter.get('/', requirePermission(R.READ), asyncHandler(restaurantController.listOrders));
orderRouter.get('/:id', requirePermission(R.READ), asyncHandler(restaurantController.getOrder));
orderRouter.post('/', requirePermission(R.CREATE_ORDER), asyncHandler(restaurantController.createOrder));
orderRouter.patch('/:id/status', requirePermission(R.UPDATE_ORDER), asyncHandler(restaurantController.updateOrderStatus));
