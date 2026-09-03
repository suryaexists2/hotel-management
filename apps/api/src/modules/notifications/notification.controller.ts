import type { Request, Response } from 'express';
import {
  createNotificationSchema,
  listNotificationsQuerySchema,
  idParamSchema,
} from '@innsight/shared';
import { requireUser } from '../../shared/http/context.js';
import { sendOk, sendCreated, sendPaginated } from '../../shared/http/respond.js';
import { notificationService } from './notification.service.js';

export const notificationController = {
  async list(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const query = listNotificationsQuerySchema.parse(req.query);
    const { items, meta } = await notificationService.listForUser(actor.hotelId, actor.userId, query);
    sendPaginated(res, items, meta);
  },

  async unreadCount(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    sendOk(res, { count: await notificationService.unreadCount(actor.hotelId, actor.userId) });
  },

  async markRead(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    sendOk(res, await notificationService.markRead(actor.hotelId, actor.userId, id));
  },

  async markAllRead(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    sendOk(res, await notificationService.markAllRead(actor.hotelId, actor.userId));
  },

  async create(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const input = createNotificationSchema.parse(req.body);
    sendCreated(res, await notificationService.create(actor.hotelId, input));
  },
};
