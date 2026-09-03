import { Router } from 'express';
import { PERMISSIONS } from '@innsight/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { billingController } from './billing.controller.js';

export const billingRouter: Router = Router();

billingRouter.use(authenticate);

// Folio lookups
billingRouter.get(
  '/reservations/:id/folio',
  requirePermission(PERMISSIONS.BILLING.READ),
  asyncHandler(billingController.getFolioByReservation),
);
billingRouter.get(
  '/folios/:folioId',
  requirePermission(PERMISSIONS.BILLING.READ),
  asyncHandler(billingController.getFolio),
);

// Charges
billingRouter.post(
  '/folios/:folioId/charges',
  requirePermission(PERMISSIONS.BILLING.CREATE_CHARGE),
  asyncHandler(billingController.postCharge),
);
billingRouter.post(
  '/folios/:folioId/charges/:chargeId/void',
  requirePermission(PERMISSIONS.BILLING.VOID),
  asyncHandler(billingController.voidCharge),
);
billingRouter.post(
  '/folios/:folioId/discounts',
  requirePermission(PERMISSIONS.BILLING.CREATE_CHARGE),
  asyncHandler(billingController.applyDiscount),
);

// Payments & refunds
billingRouter.post(
  '/folios/:folioId/payments',
  requirePermission(PERMISSIONS.BILLING.PAY),
  asyncHandler(billingController.recordPayment),
);
billingRouter.post(
  '/folios/:folioId/payments/:paymentId/refund',
  requirePermission(PERMISSIONS.BILLING.REFUND),
  asyncHandler(billingController.refundPayment),
);
billingRouter.patch(
  '/folios/:folioId/payments/:paymentId',
  requirePermission(PERMISSIONS.BILLING.PAY),
  asyncHandler(billingController.updatePayment),
);
billingRouter.post(
  '/folios/:folioId/payments/:paymentId/void',
  requirePermission(PERMISSIONS.BILLING.REFUND),
  asyncHandler(billingController.voidPayment),
);

// Invoice
billingRouter.get(
  '/invoices',
  requirePermission(PERMISSIONS.BILLING.READ),
  asyncHandler(billingController.listInvoices),
);
billingRouter.get(
  '/invoices/:id',
  requirePermission(PERMISSIONS.BILLING.READ),
  asyncHandler(billingController.getInvoice),
);
billingRouter.post(
  '/folios/:folioId/invoice',
  requirePermission(PERMISSIONS.BILLING.GENERATE_INVOICE),
  asyncHandler(billingController.generateInvoice),
);
