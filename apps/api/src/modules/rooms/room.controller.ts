import type { Request, Response } from 'express';
import {
  createRoomTypeSchema,
  updateRoomTypeSchema,
  listRoomTypesQuerySchema,
  createRoomSchema,
  updateRoomSchema,
  updateRoomStatusSchema,
  listRoomsQuerySchema,
  idParamSchema,
} from '@innsight/shared';
import { requireUser } from '../../shared/http/context.js';
import { sendOk, sendCreated, sendPaginated, sendNoContent } from '../../shared/http/respond.js';
import { auditService } from '../audit/audit.service.js';
import { roomTypeService } from './room-type.service.js';
import { roomService } from './room.service.js';

export const roomController = {
  // ─── Room Types ────────────────────────────────────
  async listTypes(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const query = listRoomTypesQuerySchema.parse(req.query);
    const { items, meta } = await roomTypeService.list(actor.hotelId, query);
    sendPaginated(res, items, meta);
  },

  async getType(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    sendOk(res, await roomTypeService.getById(actor.hotelId, id));
  },

  async createType(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const input = createRoomTypeSchema.parse(req.body);
    const type = await roomTypeService.create(actor.hotelId, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'CREATE',
      entity: 'RoomType',
      entityId: type.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendCreated(res, type);
  },

  async updateType(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const input = updateRoomTypeSchema.parse(req.body);
    sendOk(res, await roomTypeService.update(actor.hotelId, id, input));
  },

  async removeType(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    await roomTypeService.remove(actor.hotelId, id);
    sendNoContent(res);
  },

  // ─── Rooms ─────────────────────────────────────────
  async listRooms(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const query = listRoomsQuerySchema.parse(req.query);
    const { items, meta } = await roomService.list(actor.hotelId, query);
    sendPaginated(res, items, meta);
  },

  async getRoom(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    sendOk(res, await roomService.getById(actor.hotelId, id));
  },

  async createRoom(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const input = createRoomSchema.parse(req.body);
    const room = await roomService.create(actor.hotelId, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'CREATE',
      entity: 'Room',
      entityId: room.id,
      newValues: { roomNumber: room.roomNumber },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendCreated(res, room);
  },

  async updateRoom(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const input = updateRoomSchema.parse(req.body);
    sendOk(res, await roomService.update(actor.hotelId, id, input));
  },

  async updateRoomStatus(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const input = updateRoomStatusSchema.parse(req.body);
    const room = await roomService.updateStatus(actor.hotelId, id, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'STATUS_CHANGE',
      entity: 'Room',
      entityId: room.id,
      newValues: { status: room.status },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendOk(res, room);
  },

  async removeRoom(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    await roomService.remove(actor.hotelId, id);
    sendNoContent(res);
  },
};
