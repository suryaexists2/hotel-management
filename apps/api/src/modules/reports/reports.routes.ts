import { Router } from 'express';
import { PERMISSIONS } from '@innsight/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { reportsController } from './reports.controller.js';

export const reportsRouter: Router = Router();

reportsRouter.use(authenticate);

// Operational reports — occupancy, housekeeping SLA, arrivals/departures, dashboard.
reportsRouter.get(
  '/occupancy',
  requirePermission(PERMISSIONS.REPORTS.VIEW_OPERATIONAL),
  asyncHandler(reportsController.occupancy),
);
reportsRouter.get(
  '/housekeeping',
  requirePermission(PERMISSIONS.REPORTS.VIEW_OPERATIONAL),
  asyncHandler(reportsController.housekeeping),
);
reportsRouter.get(
  '/arrivals-departures',
  requirePermission(PERMISSIONS.REPORTS.VIEW_OPERATIONAL),
  asyncHandler(reportsController.arrivalsDepartures),
);
reportsRouter.get(
  '/dashboard',
  requirePermission(PERMISSIONS.REPORTS.VIEW_OPERATIONAL),
  asyncHandler(reportsController.dashboard),
);

// Financial report — revenue breakdown.
reportsRouter.get(
  '/revenue',
  requirePermission(PERMISSIONS.REPORTS.VIEW_FINANCIAL),
  asyncHandler(reportsController.revenue),
);
