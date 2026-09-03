import { Router } from 'express';
import { PERMISSIONS } from '@innsight/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { employeeController } from './employee.controller.js';

export const employeeRouter: Router = Router();

employeeRouter.use(authenticate);
employeeRouter.get('/', requirePermission(PERMISSIONS.EMPLOYEES.READ), asyncHandler(employeeController.list));
employeeRouter.get('/:id', requirePermission(PERMISSIONS.EMPLOYEES.READ), asyncHandler(employeeController.getOne));
employeeRouter.post('/', requirePermission(PERMISSIONS.EMPLOYEES.CREATE), asyncHandler(employeeController.create));
employeeRouter.patch('/:id', requirePermission(PERMISSIONS.EMPLOYEES.UPDATE), asyncHandler(employeeController.update));
employeeRouter.delete('/:id', requirePermission(PERMISSIONS.EMPLOYEES.DELETE), asyncHandler(employeeController.remove));
