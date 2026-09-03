import type { Request, Response } from 'express';
import {
  updateHotelSchema,
  updateHotelSettingsSchema,
  upsertTaxRuleSchema,
  idParamSchema,
} from '@innsight/shared';
import { requireUser } from '../../shared/http/context.js';
import { sendOk, sendCreated, sendNoContent } from '../../shared/http/respond.js';
import { auditService } from '../audit/audit.service.js';
import { hotelService } from './hotel.service.js';

export const hotelController = {
  async getCurrent(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    sendOk(res, await hotelService.getCurrent(actor.hotelId));
  },

  async update(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const input = updateHotelSchema.parse(req.body);
    const hotel = await hotelService.update(actor.hotelId, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'UPDATE',
      entity: 'Hotel',
      entityId: actor.hotelId,
      newValues: { ...input },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendOk(res, hotel);
  },

  async updateSettings(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const input = updateHotelSettingsSchema.parse(req.body);
    const hotel = await hotelService.updateSettings(actor.hotelId, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'UPDATE',
      entity: 'HotelSettings',
      entityId: actor.hotelId,
      newValues: { ...input },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendOk(res, hotel);
  },

  async listTaxRules(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    sendOk(res, await hotelService.listTaxRules(actor.hotelId));
  },

  async createTaxRule(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const input = upsertTaxRuleSchema.parse(req.body);
    sendCreated(res, await hotelService.createTaxRule(actor.hotelId, input));
  },

  async updateTaxRule(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const input = upsertTaxRuleSchema.parse(req.body);
    sendOk(res, await hotelService.updateTaxRule(actor.hotelId, id, input));
  },

  async deleteTaxRule(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    await hotelService.deleteTaxRule(actor.hotelId, id);
    sendNoContent(res);
  },
};
