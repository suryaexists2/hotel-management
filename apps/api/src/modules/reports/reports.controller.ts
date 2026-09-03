import type { Request, Response } from 'express';
import { reportRangeQuerySchema, reportDayQuerySchema, PERMISSIONS } from '@innsight/shared';
import { requireUser } from '../../shared/http/context.js';
import { sendOk } from '../../shared/http/respond.js';
import { reportsService } from './reports.service.js';

export const reportsController = {
  async occupancy(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const query = reportRangeQuerySchema.parse(req.query);
    sendOk(res, await reportsService.occupancy(actor.hotelId, query));
  },

  async revenue(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const query = reportRangeQuerySchema.parse(req.query);
    sendOk(res, await reportsService.revenue(actor.hotelId, query));
  },

  async housekeeping(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const query = reportRangeQuerySchema.parse(req.query);
    sendOk(res, await reportsService.housekeeping(actor.hotelId, query));
  },

  async arrivalsDepartures(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const query = reportDayQuerySchema.parse(req.query);
    sendOk(res, await reportsService.arrivalsDepartures(actor.hotelId, query));
  },

  async dashboard(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const data = await reportsService.dashboard(actor.hotelId);
    const hasFinancial = actor.isSuperAdmin || actor.permissions.includes(PERMISSIONS.REPORTS.VIEW_FINANCIAL);
    if (!hasFinancial) {
      delete (data.occupancy as Record<string, unknown>).adr;
      delete (data.occupancy as Record<string, unknown>).revPar;
      delete (data.occupancy as Record<string, unknown>).roomRevenue;
    }
    sendOk(res, data);
  },
};
