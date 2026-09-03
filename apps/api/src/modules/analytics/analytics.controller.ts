import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireUser } from '../../shared/http/context.js';
import { sendOk } from '../../shared/http/respond.js';
import { analyticsService } from './analytics.service.js';

const dateRangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

const computeSchema = z.object({
  date: z.string().optional(),
});

const dateParamSchema = z.object({
  date: z.string(),
});

const seedSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const analyticsController = {
  async list(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const query = dateRangeSchema.parse(req.query);
    sendOk(res, await analyticsService.list(actor.hotelId, query.from, query.to));
  },

  async compute(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const body = computeSchema.parse(req.body);
    const date = body.date ? new Date(body.date) : new Date();
    sendOk(res, await analyticsService.compute(actor.hotelId, date));
  },

  async getByDate(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const params = dateParamSchema.parse(req.params);
    sendOk(res, await analyticsService.getByDate(actor.hotelId, new Date(params.date)));
  },

  async delete(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const params = dateParamSchema.parse(req.params);
    await analyticsService.delete(actor.hotelId, new Date(params.date));
    sendOk(res, { deleted: true });
  },

  async seed(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const body = seedSchema.parse(req.body);
    const count = await analyticsService.seed(actor.hotelId, body.days);
    sendOk(res, { generated: count });
  },
};
