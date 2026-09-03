import { Router } from 'express';
import { PERMISSIONS } from '@innsight/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { inventoryController } from './inventory.controller.js';

const I = PERMISSIONS.INVENTORY;

// ─── Suppliers (/api/v1/suppliers) ───────────────────
export const supplierRouter: Router = Router();
supplierRouter.use(authenticate);
supplierRouter.get('/', requirePermission(I.READ), asyncHandler(inventoryController.listSuppliers));
supplierRouter.post('/', requirePermission(I.CREATE), asyncHandler(inventoryController.createSupplier));
supplierRouter.patch('/:id', requirePermission(I.UPDATE), asyncHandler(inventoryController.updateSupplier));
supplierRouter.delete('/:id', requirePermission(I.DELETE), asyncHandler(inventoryController.removeSupplier));

// ─── Inventory items (/api/v1/inventory) ─────────────
export const inventoryRouter: Router = Router();
inventoryRouter.use(authenticate);
inventoryRouter.get('/', requirePermission(I.READ), asyncHandler(inventoryController.listItems));
inventoryRouter.get('/:id', requirePermission(I.READ), asyncHandler(inventoryController.getItem));
inventoryRouter.post('/', requirePermission(I.CREATE), asyncHandler(inventoryController.createItem));
inventoryRouter.patch('/:id', requirePermission(I.UPDATE), asyncHandler(inventoryController.updateItem));
inventoryRouter.delete('/:id', requirePermission(I.DELETE), asyncHandler(inventoryController.removeItem));
inventoryRouter.get('/:id/movements', requirePermission(I.READ), asyncHandler(inventoryController.listMovements));
inventoryRouter.post('/:id/movements', requirePermission(I.MOVEMENT), asyncHandler(inventoryController.recordMovement));
