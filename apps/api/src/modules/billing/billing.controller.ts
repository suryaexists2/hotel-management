import type { Request, Response } from 'express';
import {
  postChargeSchema,
  voidChargeSchema,
  applyDiscountSchema,
  recordPaymentSchema,
  refundPaymentSchema,
  updatePaymentSchema,
  voidPaymentSchema,
  idParamSchema,
} from '@innsight/shared';
import { z } from 'zod';
import { requireUser } from '../../shared/http/context.js';
import { sendOk, sendCreated } from '../../shared/http/respond.js';
import { auditService } from '../audit/audit.service.js';
import { folioService } from './folio.service.js';
import { billingService } from './billing.service.js';

const folioParamSchema = z.object({ folioId: z.string().min(1) });
const chargeParamSchema = z.object({ folioId: z.string().min(1), chargeId: z.string().min(1) });
const paymentParamSchema = z.object({ folioId: z.string().min(1), paymentId: z.string().min(1) });

const listInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const billingController = {
  async getFolio(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { folioId } = folioParamSchema.parse(req.params);
    sendOk(res, await folioService.getById(actor.hotelId, folioId));
  },

  async getFolioByReservation(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    sendOk(res, await folioService.getByReservation(actor.hotelId, id));
  },

  async postCharge(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { folioId } = folioParamSchema.parse(req.params);
    const input = postChargeSchema.parse(req.body);
    const folio = await billingService.postCharge(actor.hotelId, folioId, actor.userId, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'CREATE',
      entity: 'FolioCharge',
      entityId: folioId,
      newValues: { ...input },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendCreated(res, folio);
  },

  async voidCharge(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { folioId, chargeId } = chargeParamSchema.parse(req.params);
    const input = voidChargeSchema.parse(req.body);
    const folio = await billingService.voidCharge(actor.hotelId, folioId, chargeId, actor.userId, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'UPDATE',
      entity: 'FolioCharge',
      entityId: chargeId,
      newValues: { voided: true, reason: input.reason },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendOk(res, folio);
  },

  async applyDiscount(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { folioId } = folioParamSchema.parse(req.params);
    const input = applyDiscountSchema.parse(req.body);
    const folio = await billingService.applyDiscount(actor.hotelId, folioId, actor.userId, input);
    sendCreated(res, folio);
  },

  async recordPayment(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { folioId } = folioParamSchema.parse(req.params);
    const input = recordPaymentSchema.parse(req.body);
    const folio = await billingService.recordPayment(actor.hotelId, folioId, actor.userId, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'PAYMENT',
      entity: 'Folio',
      entityId: folioId,
      newValues: { amount: input.amount, method: input.method },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendCreated(res, folio);
  },

  async refundPayment(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { folioId, paymentId } = paymentParamSchema.parse(req.params);
    const input = refundPaymentSchema.parse(req.body);
    const folio = await billingService.refundPayment(actor.hotelId, folioId, paymentId, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'REFUND',
      entity: 'Payment',
      entityId: paymentId,
      newValues: { amount: input.amount, reason: input.reason },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendOk(res, folio);
  },

  async updatePayment(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { folioId, paymentId } = paymentParamSchema.parse(req.params);
    const input = updatePaymentSchema.parse(req.body);
    const folio = await billingService.updatePayment(actor.hotelId, folioId, paymentId, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'UPDATE',
      entity: 'Payment',
      entityId: paymentId,
      newValues: { amount: input.amount, method: input.method },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendOk(res, folio);
  },

  async voidPayment(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { folioId, paymentId } = paymentParamSchema.parse(req.params);
    const input = voidPaymentSchema.parse(req.body);
    const folio = await billingService.voidPayment(actor.hotelId, folioId, paymentId, actor.userId, input);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'UPDATE',
      entity: 'Payment',
      entityId: paymentId,
      newValues: { voided: true, reason: input.reason },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendOk(res, folio);
  },

  async listInvoices(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const query = listInvoicesQuerySchema.parse(req.query);
    const result = await billingService.listInvoices(actor.hotelId, query.page, query.limit);
    sendOk(res, result);
  },

  async getInvoice(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { id } = idParamSchema.parse(req.params);
    sendOk(res, await billingService.getInvoice(actor.hotelId, id));
  },

  async generateInvoice(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const { folioId } = folioParamSchema.parse(req.params);
    const invoice = await billingService.generateInvoice(actor.hotelId, folioId);
    await auditService.record({
      hotelId: actor.hotelId,
      userId: actor.userId,
      action: 'CREATE',
      entity: 'Invoice',
      entityId: invoice.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendCreated(res, invoice);
  },
};
