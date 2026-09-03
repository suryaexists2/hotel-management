import { Prisma, prisma } from '@innsight/database';
import type {
  PostChargeInput,
  VoidChargeInput,
  ApplyDiscountInput,
  RecordPaymentInput,
  RefundPaymentInput,
  UpdatePaymentInput,
  VoidPaymentInput,
} from '@innsight/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/app-error.js';
import { generateReference } from '../../shared/utils/reference.js';
import { runSerializable } from '../../shared/db/transaction.js';
import { folioService, type FolioDTO } from './folio.service.js';

type Tx = Prisma.TransactionClient;
const ZERO = new Prisma.Decimal(0);

/**
 * Billing operations layered on the folio ledger: manual charges, voids, discounts,
 * payments, refunds and invoice snapshots. Every mutation recomputes folio totals
 * inside the same transaction so the ledger and its rollups can never diverge.
 */
export class BillingService {
  /** Load a folio that must belong to the tenant and still be open to mutation. */
  private async loadMutableFolio(tx: Tx, hotelId: string, folioId: string): Promise<{ id: string; guestId: string }> {
    const folio = await tx.folio.findFirst({
      where: { id: folioId, hotelId },
      select: { id: true, guestId: true, status: true, closedAt: true },
    });
    if (!folio) throw new NotFoundError('Folio not found');
    if (folio.status === 'VOID') throw new ConflictError('Folio is void');
    if (folio.status === 'SETTLED' || folio.closedAt) throw new ConflictError('Folio is settled/closed and can no longer be modified');
    return { id: folio.id, guestId: folio.guestId };
  }

  async postCharge(hotelId: string, folioId: string, actorId: string, input: PostChargeInput): Promise<FolioDTO> {
    await runSerializable(async (tx) => {
      await this.loadMutableFolio(tx, hotelId, folioId);
      await folioService.postCharge(tx, folioId, {
        category: input.category as string,
        description: input.description,
        unitPrice: input.unitPrice,
        quantity: input.quantity,
        taxAmount: input.taxAmount,
        createdBy: actorId,
      });
    });
    return folioService.getById(hotelId, folioId);
  }

  async voidCharge(
    hotelId: string,
    folioId: string,
    chargeId: string,
    actorId: string,
    input: VoidChargeInput,
  ): Promise<FolioDTO> {
    await runSerializable(async (tx) => {
      await this.loadMutableFolio(tx, hotelId, folioId);
      const charge = await tx.folioCharge.findFirst({
        where: { id: chargeId, folioId },
        select: { id: true, isVoided: true },
      });
      if (!charge) throw new NotFoundError('Charge not found');
      if (charge.isVoided) throw new ConflictError('Charge is already voided');

      await tx.folioCharge.update({
        where: { id: chargeId },
        data: { isVoided: true, voidedAt: new Date(), voidedBy: actorId, voidReason: input.reason },
      });
      await folioService.recompute(tx, folioId);
    });
    return folioService.getById(hotelId, folioId);
  }

  async applyDiscount(hotelId: string, folioId: string, actorId: string, input: ApplyDiscountInput): Promise<FolioDTO> {
    await runSerializable(async (tx) => {
      await this.loadMutableFolio(tx, hotelId, folioId);
      await folioService.postCharge(tx, folioId, {
        category: 'DISCOUNT',
        description: input.description,
        unitPrice: input.amount,
        quantity: 1,
        createdBy: actorId,
      });
    });
    return folioService.getById(hotelId, folioId);
  }

  async recordPayment(hotelId: string, folioId: string, actorId: string, input: RecordPaymentInput): Promise<FolioDTO> {
    await runSerializable(async (tx) => {
      await this.loadMutableFolio(tx, hotelId, folioId);
      await tx.payment.create({
        data: {
          folioId,
          amount: new Prisma.Decimal(input.amount),
          method: input.method,
          status: 'COMPLETED',
          referenceNo: input.referenceNo ?? null,
          notes: input.notes ?? null,
          createdBy: actorId,
        },
      });
      await folioService.recompute(tx, folioId);
    });
    return folioService.getById(hotelId, folioId);
  }

  async refundPayment(
    hotelId: string,
    folioId: string,
    paymentId: string,
    input: RefundPaymentInput,
  ): Promise<FolioDTO> {
    await runSerializable(async (tx) => {
      const folio = await tx.folio.findFirst({ where: { id: folioId, hotelId }, select: { id: true } });
      if (!folio) throw new NotFoundError('Folio not found');

      const payment = await tx.payment.findFirst({ where: { id: paymentId, folioId } });
      if (!payment) throw new NotFoundError('Payment not found');
      if (payment.status === 'REFUNDED') throw new ConflictError('Payment is already fully refunded');
      if (payment.status === 'VOIDED') throw new ConflictError('Payment is voided and cannot be refunded');

      const alreadyRefunded = payment.refundedAmount ?? ZERO;
      const refundable = payment.amount.sub(alreadyRefunded);
      const refundAmount = new Prisma.Decimal(input.amount);
      if (refundAmount.greaterThan(refundable)) {
        throw new ValidationError('Refund exceeds the refundable amount for this payment');
      }

      const newRefunded = alreadyRefunded.add(refundAmount);
      const fullyRefunded = newRefunded.greaterThanOrEqualTo(payment.amount);
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          refundedAmount: newRefunded,
          refundedAt: new Date(),
          refundReason: input.reason,
          status: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        },
      });
      await folioService.recompute(tx, folioId);
    });
    return folioService.getById(hotelId, folioId);
  }

  /**
   * Correct a mis-recorded payment (wrong amount/method/reference). Intentionally
   * bypasses the settled/closed guard so an overpaid folio can be fixed even after
   * check-out; the ledger totals and invoice paidAt are recomputed accordingly.
   */
  async updatePayment(
    hotelId: string,
    folioId: string,
    paymentId: string,
    input: UpdatePaymentInput,
  ): Promise<FolioDTO> {
    await runSerializable(async (tx) => {
      const folio = await tx.folio.findFirst({ where: { id: folioId, hotelId }, select: { id: true } });
      if (!folio) throw new NotFoundError('Folio not found');

      const payment = await tx.payment.findFirst({ where: { id: paymentId, folioId } });
      if (!payment) throw new NotFoundError('Payment not found');
      if (payment.status === 'VOIDED') throw new ConflictError('Payment is voided and cannot be edited');
      if (payment.refundedAt) throw new ConflictError('Payment has been refunded and cannot be edited; void or refund it instead');

      await tx.payment.update({
        where: { id: paymentId },
        data: {
          amount: new Prisma.Decimal(input.amount),
          method: input.method,
          referenceNo: input.referenceNo ?? null,
          notes: input.notes ?? null,
        },
      });
      await folioService.recompute(tx, folioId);
    });
    return folioService.getById(hotelId, folioId);
  }

  /**
   * Reverse an erroneous payment entirely. Works on settled/closed folios too so a
   * mistaken overpayment can be removed after check-out.
   */
  async voidPayment(
    hotelId: string,
    folioId: string,
    paymentId: string,
    actorId: string,
    input: VoidPaymentInput,
  ): Promise<FolioDTO> {
    await runSerializable(async (tx) => {
      const folio = await tx.folio.findFirst({ where: { id: folioId, hotelId }, select: { id: true } });
      if (!folio) throw new NotFoundError('Folio not found');

      const payment = await tx.payment.findFirst({ where: { id: paymentId, folioId } });
      if (!payment) throw new NotFoundError('Payment not found');
      if (payment.status === 'VOIDED') throw new ConflictError('Payment is already voided');
      if (payment.refundedAt) {
        throw new ConflictError('Payment has been refunded and cannot be voided');
      }

      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'VOIDED',
          voidedAt: new Date(),
          voidReason: input.reason,
          voidedBy: actorId,
        },
      });
      await folioService.recompute(tx, folioId);
    });
    return folioService.getById(hotelId, folioId);
  }

  private formatInvoice(invoice: Record<string, unknown>): Record<string, unknown> {
    if (typeof invoice.lineItems === 'string') {
      try { invoice.lineItems = JSON.parse(invoice.lineItems); } catch { invoice.lineItems = []; }
    }
    if (typeof invoice.taxBreakdown === 'string') {
      try { invoice.taxBreakdown = JSON.parse(invoice.taxBreakdown); } catch { invoice.taxBreakdown = {}; }
    }
    return invoice;
  }

  async listInvoices(hotelId: string, page = 1, limit = 20): Promise<{ items: unknown[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const [items, total] = await prisma.$transaction([
      prisma.invoice.findMany({
        where: { hotelId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where: { hotelId } }),
    ]);
    return { items: items.map((i) => this.formatInvoice(i as Record<string, unknown>)), total, page, limit };
  }

  async getInvoice(hotelId: string, invoiceId: string): Promise<Prisma.InvoiceGetPayload<{ include: { folio: { include: { reservation: { include: { room: true, roomType: true, guest: true } }, payments: true } } } }>> {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, hotelId },
      include: { folio: { include: { reservation: { include: { room: true, roomType: true, guest: true, occupants: true } }, payments: true } } },
    });
    if (!invoice) throw new NotFoundError('Invoice not found');
    return this.formatInvoice(invoice as unknown as Record<string, unknown>) as typeof invoice;
  }

  /**
   * Snapshot the folio into an immutable invoice document (idempotent per folio).
   * Accepts a Prisma client so callers can generate the invoice inside their own
   * transaction, making the invoice atomic with the operation that settled the folio.
   */
  async generateInvoice(hotelId: string, folioId: string, client: Tx | typeof prisma = prisma): Promise<Prisma.InvoiceGetPayload<Record<string, never>>> {
    const existing = await client.invoice.findFirst({ where: { folioId }, select: { id: true } });
    if (existing) {
      const inv = await client.invoice.findUniqueOrThrow({ where: { id: existing.id } });
      return this.formatInvoice(inv as unknown as Record<string, unknown>) as typeof inv;
    }

    const folio = await client.folio.findFirst({
      where: { id: folioId, hotelId },
      include: {
        charges: { where: { isVoided: false }, orderBy: { date: 'asc' } },
        reservation: { include: { guest: { select: { firstName: true, lastName: true, email: true } } } },
      },
    });
    if (!folio) throw new NotFoundError('Folio not found');

    const guest = folio.reservation.guest;
    const lineItems = folio.charges.map((c) => ({
      category: c.category,
      description: c.description,
      quantity: c.quantity,
      unitPrice: Number(c.unitPrice),
      taxAmount: Number(c.taxAmount),
      total: Number(c.amount),
    }));
    const taxBreakdown = { totalTax: Number(folio.totalTax) };

    const created = await client.invoice.create({
      data: {
        hotelId,
        folioId,
        invoiceNumber: generateReference('INV', new Date()),
        guestName: `${guest.firstName} ${guest.lastName}`,
        guestEmail: guest.email,
        subtotal: folio.totalCharges,
        taxTotal: folio.totalTax,
        discountTotal: folio.totalDiscounts,
        grandTotal: folio.totalCharges.sub(folio.totalDiscounts).add(folio.totalTax),
        currency: folio.currency,
        taxBreakdown: JSON.stringify(taxBreakdown),
        lineItems: JSON.stringify(lineItems),
        paidAt: folio.status === 'SETTLED' ? new Date() : undefined,
      },
    });
    return this.formatInvoice(created as unknown as Record<string, unknown>) as typeof created;
  }
}

export const billingService = new BillingService();
