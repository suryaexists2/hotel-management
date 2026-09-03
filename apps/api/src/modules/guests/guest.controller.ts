import type { Request, Response } from 'express';
import {
  createGuestSchema,
  updateGuestSchema,
  listGuestsQuerySchema,
  idParamSchema,
  bulkDeleteGuestsSchema,
  deleteByDateRangeSchema,
  guestHistoryQuerySchema,
} from '@innsight/shared';
import { requireUser } from '../../shared/http/context.js';
import { sendOk, sendCreated, sendPaginated, sendNoContent } from '../../shared/http/respond.js';
import { getUploadUrl } from '../../shared/uploads/upload.js';
import { auditService } from '../audit/audit.service.js';
import { guestService } from './guest.service.js';

export const guestController = {
  async list(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const query = listGuestsQuerySchema.parse(req.query);
    const { items, meta } = await guestService.list(actor.hotelId, query);
    sendPaginated(res, items, meta);
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    sendOk(res, await guestService.getById(actor.hotelId, id));
  },

  async create(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const input = createGuestSchema.parse(req.body);
    const guest = await guestService.create(actor.hotelId, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'CREATE',
      entity: 'Guest',
      entityId: guest.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendCreated(res, guest);
  },

  async update(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const input = updateGuestSchema.parse(req.body);
    sendOk(res, await guestService.update(actor.hotelId, id, input));
  },

  async uploadIdProof(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const data: { idProofFront?: string | null; idProofBack?: string | null } = {};
    if (files?.idProofFront?.[0]) {
      data.idProofFront = getUploadUrl(files.idProofFront[0].filename);
    }
    if (files?.idProofBack?.[0]) {
      data.idProofBack = getUploadUrl(files.idProofBack[0].filename);
    }
    sendOk(res, await guestService.update(actor.hotelId, id, data));
  },

  async remove(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    await guestService.remove(actor.hotelId, id);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'DELETE',
      entity: 'Guest',
      entityId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendNoContent(res);
  },

  async bulkDelete(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { ids } = bulkDeleteGuestsSchema.parse(req.body);
    await guestService.bulkDelete(actor.hotelId, ids);
    sendOk(res, { deleted: ids.length });
  },

  async deleteByDateRange(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { from, to } = deleteByDateRangeSchema.parse(req.body);
    const count = await guestService.deleteByDateRange(actor.hotelId, from, to);
    sendOk(res, { deleted: count });
  },

  async clearAll(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    await guestService.clearAll(actor.hotelId);
    sendNoContent(res);
  },

  async restore(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    sendOk(res, await guestService.restore(actor.hotelId, id));
  },

  async listBackups(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    sendOk(res, await guestService.listBackups(actor.hotelId));
  },

  async history(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const query = guestHistoryQuerySchema.parse(req.query);
    const result = await guestService.history(actor.hotelId, query);
    sendPaginated(res, result.items, result.meta);
  },
};
