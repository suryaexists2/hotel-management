import type { Request, Response } from 'express';
import { Router } from 'express';
import { listAuditLogsQuerySchema, PERMISSIONS } from '@innsight/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireUser } from '../../shared/http/context.js';
import { sendPaginated } from '../../shared/http/respond.js';
import { auditService } from './audit.service.js';

async function listAuditLogs(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const query = listAuditLogsQuerySchema.parse(req.query);
  const { items, meta } = await auditService.list(actor.hotelId, query);
  sendPaginated(res, items, meta);
}

export const auditRouter: Router = Router();
auditRouter.use(authenticate);
auditRouter.get('/', requirePermission(PERMISSIONS.SYSTEM.AUDIT_LOGS), asyncHandler(listAuditLogs));
