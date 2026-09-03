import { Router } from 'express';
import { PERMISSIONS } from '@innsight/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { uploadIdProof } from '../../shared/uploads/upload.js';
import { guestController } from './guest.controller.js';

export const guestRouter: Router = Router();

guestRouter.use(authenticate);
guestRouter.get('/', requirePermission(PERMISSIONS.GUESTS.READ), asyncHandler(guestController.list));
guestRouter.get('/history', requirePermission(PERMISSIONS.GUESTS.READ), asyncHandler(guestController.history));
guestRouter.get('/backups', requirePermission(PERMISSIONS.GUESTS.READ), asyncHandler(guestController.listBackups));
guestRouter.get('/:id', requirePermission(PERMISSIONS.GUESTS.READ), asyncHandler(guestController.getOne));
guestRouter.post('/', requirePermission(PERMISSIONS.GUESTS.CREATE), asyncHandler(guestController.create));
guestRouter.post('/:id/id-proof', requirePermission(PERMISSIONS.GUESTS.UPDATE), uploadIdProof.fields([
  { name: 'idProofFront', maxCount: 1 },
  { name: 'idProofBack', maxCount: 1 },
]), asyncHandler(guestController.uploadIdProof));
guestRouter.post('/bulk-delete', requirePermission(PERMISSIONS.GUESTS.DELETE), asyncHandler(guestController.bulkDelete));
guestRouter.post('/delete-by-date-range', requirePermission(PERMISSIONS.GUESTS.DELETE), asyncHandler(guestController.deleteByDateRange));
guestRouter.post('/clear-all', requirePermission(PERMISSIONS.GUESTS.DELETE), asyncHandler(guestController.clearAll));
guestRouter.post('/:id/restore', requirePermission(PERMISSIONS.GUESTS.DELETE), asyncHandler(guestController.restore));
guestRouter.patch('/:id', requirePermission(PERMISSIONS.GUESTS.UPDATE), asyncHandler(guestController.update));
guestRouter.delete('/:id', requirePermission(PERMISSIONS.GUESTS.DELETE), asyncHandler(guestController.remove));
