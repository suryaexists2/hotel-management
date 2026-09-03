import type { Request, Response } from 'express';
import {
  createSupplierSchema,
  updateSupplierSchema,
  createInventoryItemSchema,
  updateInventoryItemSchema,
  listInventoryQuerySchema,
  createStockMovementSchema,
  listStockMovementsQuerySchema,
  idParamSchema,
} from '@innsight/shared';
import { requireUser } from '../../shared/http/context.js';
import { sendOk, sendCreated, sendPaginated, sendNoContent } from '../../shared/http/respond.js';
import { auditService } from '../audit/audit.service.js';
import { inventoryService } from './inventory.service.js';

export const inventoryController = {
  // Suppliers
  async listSuppliers(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    sendOk(res, await inventoryService.listSuppliers(actor.hotelId));
  },
  async createSupplier(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    sendCreated(res, await inventoryService.createSupplier(actor.hotelId, createSupplierSchema.parse(req.body)));
  },
  async updateSupplier(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    sendOk(res, await inventoryService.updateSupplier(actor.hotelId, id, updateSupplierSchema.parse(req.body)));
  },
  async removeSupplier(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    await inventoryService.removeSupplier(actor.hotelId, id);
    sendNoContent(res);
  },

  // Items
  async listItems(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { items, meta } = await inventoryService.listItems(actor.hotelId, listInventoryQuerySchema.parse(req.query));
    sendPaginated(res, items, meta);
  },
  async getItem(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    sendOk(res, await inventoryService.getItem(actor.hotelId, id));
  },
  async createItem(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const item = await inventoryService.createItem(actor.hotelId, createInventoryItemSchema.parse(req.body));
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'CREATE',
      entity: 'InventoryItem',
      entityId: item.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendCreated(res, item);
  },
  async updateItem(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    sendOk(res, await inventoryService.updateItem(actor.hotelId, id, updateInventoryItemSchema.parse(req.body)));
  },
  async removeItem(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    await inventoryService.removeItem(actor.hotelId, id);
    sendNoContent(res);
  },

  // Stock movements
  async recordMovement(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const input = createStockMovementSchema.parse(req.body);
    const item = await inventoryService.recordMovement(actor.hotelId, id, actor.userId, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'UPDATE',
      entity: 'InventoryItem',
      entityId: id,
      newValues: { movement: input.type, quantity: input.quantity, newStock: item.currentStock },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendOk(res, item);
  },
  async listMovements(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const { items, meta } = await inventoryService.listMovements(
      actor.hotelId,
      id,
      listStockMovementsQuerySchema.parse(req.query),
    );
    sendPaginated(res, items, meta);
  },
};
