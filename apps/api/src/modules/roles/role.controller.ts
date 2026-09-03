import type { Request, Response } from 'express';
import {
  createRoleSchema,
  updateRoleSchema,
  listRolesQuerySchema,
  idParamSchema,
  PERMISSIONS,
  ALL_PERMISSIONS,
} from '@innsight/shared';
import { requireUser } from '../../shared/http/context.js';
import { sendOk, sendCreated, sendPaginated, sendNoContent } from '../../shared/http/respond.js';
import { auditService } from '../audit/audit.service.js';
import { roleService } from './role.service.js';

export const roleController = {
  /** Static catalogue of assignable permissions grouped by module (for role editors). */
  catalog(_req: Request, res: Response): void {
    sendOk(res, { grouped: PERMISSIONS, all: ALL_PERMISSIONS });
  },

  async list(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const query = listRolesQuerySchema.parse(req.query);
    const { items, meta } = await roleService.list(actor.hotelId, query);
    sendPaginated(res, items, meta);
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    sendOk(res, await roleService.getById(actor.hotelId, id));
  },

  async create(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const input = createRoleSchema.parse(req.body);
    const role = await roleService.create(actor.hotelId, input, actor.permissions, actor.isSuperAdmin);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'CREATE',
      entity: 'Role',
      entityId: role.id,
      newValues: { name: role.name, permissions: role.permissions },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendCreated(res, role);
  },

  async update(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const input = updateRoleSchema.parse(req.body);
    const role = await roleService.update(actor.hotelId, id, input, actor.permissions, actor.isSuperAdmin);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'UPDATE',
      entity: 'Role',
      entityId: role.id,
      newValues: { ...input },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendOk(res, role);
  },

  async remove(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    await roleService.remove(actor.hotelId, id);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'DELETE',
      entity: 'Role',
      entityId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendNoContent(res);
  },
};
