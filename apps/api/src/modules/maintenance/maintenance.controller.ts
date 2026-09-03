import type { Request, Response } from 'express';
import {
  createMaintenanceOrderSchema,
  updateMaintenanceOrderSchema,
  updateMaintenanceStatusSchema,
  listMaintenanceQuerySchema,
  idParamSchema,
} from '@innsight/shared';
import { requireUser } from '../../shared/http/context.js';
import { sendOk, sendCreated, sendPaginated, sendNoContent } from '../../shared/http/respond.js';
import { auditService } from '../audit/audit.service.js';
import { maintenanceService } from './maintenance.service.js';

export const maintenanceController = {
  async list(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const query = listMaintenanceQuerySchema.parse(req.query);
    const { items, meta } = await maintenanceService.list(actor.hotelId, query);
    sendPaginated(res, items, meta);
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    sendOk(res, await maintenanceService.getById(actor.hotelId, id));
  },

  async create(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const input = createMaintenanceOrderSchema.parse(req.body);
    const order = await maintenanceService.create(actor.hotelId, actor.userId, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'CREATE',
      entity: 'MaintenanceOrder',
      entityId: order.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendCreated(res, order);
  },

  async update(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const input = updateMaintenanceOrderSchema.parse(req.body);
    sendOk(res, await maintenanceService.update(actor.hotelId, id, input));
  },

  async updateStatus(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const input = updateMaintenanceStatusSchema.parse(req.body);
    const order = await maintenanceService.updateStatus(actor.hotelId, id, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'STATUS_CHANGE',
      entity: 'MaintenanceOrder',
      entityId: id,
      newValues: { status: input.status },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendOk(res, order);
  },

  async remove(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    await maintenanceService.remove(actor.hotelId, id);
    sendNoContent(res);
  },
};
