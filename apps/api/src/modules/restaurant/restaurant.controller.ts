import type { Request, Response } from 'express';
import {
  createMenuItemSchema,
  updateMenuItemSchema,
  listMenuQuerySchema,
  createOrderSchema,
  updateOrderStatusSchema,
  listOrdersQuerySchema,
  idParamSchema,
} from '@innsight/shared';
import { requireUser } from '../../shared/http/context.js';
import { sendOk, sendCreated, sendPaginated, sendNoContent } from '../../shared/http/respond.js';
import { auditService } from '../audit/audit.service.js';
import { restaurantService } from './restaurant.service.js';

export const restaurantController = {
  // Menu
  async listMenu(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { items, meta } = await restaurantService.listMenu(actor.hotelId, listMenuQuerySchema.parse(req.query));
    sendPaginated(res, items, meta);
  },
  async getMenuItem(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    sendOk(res, await restaurantService.getMenuItem(actor.hotelId, id));
  },
  async createMenuItem(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const item = await restaurantService.createMenuItem(actor.hotelId, createMenuItemSchema.parse(req.body));
    sendCreated(res, item);
  },
  async updateMenuItem(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    sendOk(res, await restaurantService.updateMenuItem(actor.hotelId, id, updateMenuItemSchema.parse(req.body)));
  },
  async removeMenuItem(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    await restaurantService.removeMenuItem(actor.hotelId, id);
    sendNoContent(res);
  },

  // Orders
  async listOrders(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { items, meta } = await restaurantService.listOrders(actor.hotelId, listOrdersQuerySchema.parse(req.query));
    sendPaginated(res, items, meta);
  },
  async getOrder(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    sendOk(res, await restaurantService.getOrder(actor.hotelId, id));
  },
  async createOrder(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const order = await restaurantService.createOrder(actor.hotelId, actor.userId, createOrderSchema.parse(req.body));
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'CREATE',
      entity: 'Order',
      entityId: order.id,
      newValues: { orderNumber: order.orderNumber, total: order.total.toString() },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendCreated(res, order);
  },
  async updateOrderStatus(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const input = updateOrderStatusSchema.parse(req.body);
    const order = await restaurantService.updateOrderStatus(actor.hotelId, actor.userId, id, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'STATUS_CHANGE',
      entity: 'Order',
      entityId: id,
      newValues: { status: input.status },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendOk(res, order);
  },
};
