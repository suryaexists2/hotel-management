import type { Request, Response } from 'express';
import {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
  changePasswordSchema,
  idParamSchema,
} from '@innsight/shared';
import { requireUser } from '../../shared/http/context.js';
import { sendOk, sendCreated, sendPaginated } from '../../shared/http/respond.js';
import { auditService } from '../audit/audit.service.js';
import { userService } from './user.service.js';

export const userController = {
  async list(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const query = listUsersQuerySchema.parse(req.query);
    const { items, meta } = await userService.list(actor.hotelId, query);
    sendPaginated(res, items, meta);
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const user = await userService.getById(actor.hotelId, id);
    sendOk(res, user);
  },

  async create(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const input = createUserSchema.parse(req.body);
    const user = await userService.create(actor.hotelId, actor.isSuperAdmin, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'CREATE',
      entity: 'User',
      entityId: user.id,
      newValues: { email: user.email, roleId: user.role.id },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendCreated(res, user);
  },

  async update(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const input = updateUserSchema.parse(req.body);
    const user = await userService.update(actor.hotelId, actor.userId, actor.isSuperAdmin, id, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: input.status !== undefined ? 'STATUS_CHANGE' : 'UPDATE',
      entity: 'User',
      entityId: user.id,
      newValues: { ...input },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendOk(res, user);
  },

  async deactivate(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const user = await userService.deactivate(actor.hotelId, actor.userId, actor.isSuperAdmin, id);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'DELETE',
      entity: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendOk(res, user);
  },

  async changePassword(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const input = changePasswordSchema.parse(req.body);
    await userService.changePassword(actor.userId, input);
    sendOk(res, { message: 'Password changed successfully' });
  },
};
