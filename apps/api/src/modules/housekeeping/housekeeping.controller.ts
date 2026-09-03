import type { Request, Response } from 'express';
import {
  createHousekeepingTaskSchema,
  updateHousekeepingTaskSchema,
  updateHousekeepingStatusSchema,
  listHousekeepingQuerySchema,
  idParamSchema,
} from '@innsight/shared';
import { prisma } from '@innsight/database';
import { requireUser } from '../../shared/http/context.js';
import { sendOk, sendCreated, sendPaginated } from '../../shared/http/respond.js';
import { auditService } from '../audit/audit.service.js';
import { housekeepingService } from './housekeeping.service.js';

/** Resolve the acting user's linked employee id (used to stamp inspections). */
async function actingEmployeeId(hotelId: string, userId: string): Promise<string | null> {
  const emp = await prisma.employee.findFirst({ where: { hotelId, userId }, select: { id: true } });
  return emp?.id ?? null;
}

export const housekeepingController = {
  async list(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const query = listHousekeepingQuerySchema.parse(req.query);
    const { items, meta } = await housekeepingService.list(actor.hotelId, query);
    sendPaginated(res, items, meta);
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    sendOk(res, await housekeepingService.getById(actor.hotelId, id));
  },

  async create(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const input = createHousekeepingTaskSchema.parse(req.body);
    const task = await housekeepingService.create(actor.hotelId, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'CREATE',
      entity: 'HousekeepingTask',
      entityId: task.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendCreated(res, task);
  },

  async update(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const input = updateHousekeepingTaskSchema.parse(req.body);
    sendOk(res, await housekeepingService.update(actor.hotelId, id, input));
  },

  async updateStatus(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const input = updateHousekeepingStatusSchema.parse(req.body);
    const task = await housekeepingService.updateStatus(actor.hotelId, id, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'STATUS_CHANGE',
      entity: 'HousekeepingTask',
      entityId: id,
      newValues: { status: input.status },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendOk(res, task);
  },

  async inspect(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const inspectorId = await actingEmployeeId(actor.hotelId, actor.userId);
    const task = await housekeepingService.inspect(actor.hotelId, id, inspectorId);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'STATUS_CHANGE',
      entity: 'HousekeepingTask',
      entityId: id,
      newValues: { inspected: true },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendOk(res, task);
  },
};
