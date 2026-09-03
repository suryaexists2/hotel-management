import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  availabilityQuerySchema,
  createReservationSchema,
  walkInSchema,
  checkInSchema,
  cancelReservationSchema,
  listReservationsQuerySchema,
  idParamSchema,
} from '@innsight/shared';
import { requireUser } from '../../shared/http/context.js';
import { sendOk, sendCreated, sendPaginated, sendNoContent } from '../../shared/http/respond.js';
import { auditService } from '../audit/audit.service.js';
import { reservationService } from './reservation.service.js';
import { occupantService } from './occupant.service.js';

export const reservationController = {
  async availability(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const query = availabilityQuerySchema.parse(req.query);
    sendOk(res, await reservationService.availability(actor.hotelId, query));
  },

  async list(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const query = listReservationsQuerySchema.parse(req.query);
    const { items, meta } = await reservationService.list(actor.hotelId, query);
    sendPaginated(res, items, meta);
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    sendOk(res, await reservationService.getById(actor.hotelId, id));
  },

  async create(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const input = createReservationSchema.parse(req.body);
    const reservation = await reservationService.create(actor.hotelId, actor.userId, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'CREATE',
      entity: 'Reservation',
      entityId: reservation.id,
      newValues: { confirmationNo: reservation.confirmationNo },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendCreated(res, reservation);
  },

  async walkIn(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const input = walkInSchema.parse(req.body);
    const reservation = await reservationService.walkIn(actor.hotelId, actor.userId, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'CHECK_IN',
      entity: 'Reservation',
      entityId: reservation.id,
      newValues: { confirmationNo: reservation.confirmationNo, walkIn: true },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendCreated(res, reservation);
  },

  async checkIn(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const input = checkInSchema.parse(req.body);
    const reservation = await reservationService.checkIn(actor.hotelId, actor.userId, id, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'CHECK_IN',
      entity: 'Reservation',
      entityId: reservation.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendOk(res, reservation);
  },

  async checkOut(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const reservation = await reservationService.checkOut(actor.hotelId, actor.userId, id);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'CHECK_OUT',
      entity: 'Reservation',
      entityId: reservation.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendOk(res, reservation);
  },

  async cancel(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const input = cancelReservationSchema.parse(req.body);
    const reservation = await reservationService.cancel(actor.hotelId, actor.userId, id, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'UPDATE',
      entity: 'Reservation',
      entityId: reservation.id,
      newValues: { status: 'CANCELLED', reason: input.reason },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendOk(res, reservation);
  },

  // ── Occupant Management ──

  async listOccupants(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    sendOk(res, await occupantService.listByReservation(actor.hotelId, id));
  },

  async addOccupant(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    const input = z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      gender: z.string().nullable().optional(),
      dateOfBirth: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      idType: z.string().nullable().optional(),
      idNumber: z.string().nullable().optional(),
      relationship: z.string().nullable().optional(),
    }).parse(req.body);
    const occupant = await occupantService.create(actor.hotelId, id, input);
    sendCreated(res, occupant);
  },

  async updateOccupant(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id, occupantId } = z.object({ id: z.string().min(1), occupantId: z.string().min(1) }).parse(req.params);
    const input = z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      gender: z.string().nullable().optional(),
      dateOfBirth: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      idType: z.string().nullable().optional(),
      idNumber: z.string().nullable().optional(),
      relationship: z.string().nullable().optional(),
    }).parse(req.body);
    sendOk(res, await occupantService.update(actor.hotelId, id, occupantId, input));
  },

  async removeOccupant(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id, occupantId } = z.object({ id: z.string().min(1), occupantId: z.string().min(1) }).parse(req.params);
    await occupantService.remove(actor.hotelId, id, occupantId);
    sendNoContent(res);
  },
};
