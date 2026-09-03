import type { Request, Response } from 'express';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  listEmployeesQuerySchema,
  idParamSchema,
} from '@innsight/shared';
import { requireUser } from '../../shared/http/context.js';
import { sendOk, sendCreated, sendPaginated, sendNoContent } from '../../shared/http/respond.js';
import { auditService } from '../audit/audit.service.js';
import { employeeService } from './employee.service.js';

export const employeeController = {
  async list(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const query = listEmployeesQuerySchema.parse(req.query);
    const { items, meta } = await employeeService.list(actor.hotelId, query);
    sendPaginated(res, items, meta);
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    sendOk(res, await employeeService.getById(actor.hotelId, id));
  },

  async create(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const input = createEmployeeSchema.parse(req.body);
    const employee = await employeeService.create(actor.hotelId, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'CREATE',
      entity: 'Employee',
      entityId: employee.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendCreated(res, employee);
  },

  async update(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const input = updateEmployeeSchema.parse(req.body);
    sendOk(res, await employeeService.update(actor.hotelId, id, input));
  },

  async remove(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    await employeeService.remove(actor.hotelId, id);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'DELETE',
      entity: 'Employee',
      entityId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendNoContent(res);
  },
};
