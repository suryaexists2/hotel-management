import { Prisma, prisma } from '@innsight/database';
import { NotFoundError } from '../../shared/errors/app-error.js';
import { generateReference } from '../../shared/utils/reference.js';

const ZERO = new Prisma.Decimal(0);

/** Prisma transaction client type (subset used here). */
type Tx = Prisma.TransactionClient;

export interface PostChargeInput {
  category: string;
  description: string;
  unitPrice: Prisma.Decimal | number;
  quantity?: number;
  taxAmount?: Prisma.Decimal | number;
  createdBy?: string | null;
}

const folioInclude = {
  charges: { orderBy: { date: 'asc' } },
  payments: { orderBy: { processedAt: 'asc' } },
} satisfies Prisma.FolioInclude;

export type FolioDTO = Prisma.FolioGetPayload<{ include: typeof folioInclude }>;

/**
 * Owns the folio ledger: opening a folio for a reservation, posting append-only
 * charges, and recomputing derived totals from source rows. All money math uses
 * Prisma.Decimal to avoid floating-point drift across 10k tenants.
 */
export class FolioService {
  /** Open a folio for a freshly created/checked-in reservation (idempotent per reservation). */
  async createForReservation(
    tx: Tx,
    params: { hotelId: string; reservationId: string; guestId: string; currency: string; now: Date },
  ): Promise<string> {
    const existing = await tx.folio.findUnique({
      where: { reservationId: params.reservationId },
      select: { id: true },
    });
    if (existing) return existing.id;

    const folio = await tx.folio.create({
      data: {
        hotelId: params.hotelId,
        reservationId: params.reservationId,
        guestId: params.guestId,
        folioNumber: generateReference('FOL', params.now),
        currency: params.currency,
        status: 'OPEN',
      },
      select: { id: true },
    });
    return folio.id;
  }

  /** Append a charge line and recompute the folio. Runs inside the given transaction. */
  async postCharge(tx: Tx, folioId: string, input: PostChargeInput): Promise<void> {
    const quantity = input.quantity ?? 1;
    const unitPrice = new Prisma.Decimal(input.unitPrice);
    const amount = unitPrice.mul(quantity);
    const taxAmount = input.taxAmount ? new Prisma.Decimal(input.taxAmount) : ZERO;

    await tx.folioCharge.create({
      data: {
        folioId,
        category: input.category,
        description: input.description,
        unitPrice,
        quantity,
        amount,
        taxAmount,
        createdBy: input.createdBy ?? null,
      },
    });
    await this.recompute(tx, folioId);
  }

  /** Recompute totals/balance/status from non-voided charges and completed payments. */
  async recompute(tx: Tx, folioId: string): Promise<void> {
    const [charges, payments] = await Promise.all([
      tx.folioCharge.findMany({ where: { folioId, isVoided: false } }),
      tx.payment.findMany({
        where: { folioId, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } },
      }),
    ]);

    let gross = ZERO;
    let discounts = ZERO;
    let tax = ZERO;
    for (const c of charges) {
      if (c.category === 'DISCOUNT') {
        discounts = discounts.add(c.amount.abs());
      } else if (c.category === 'TAX') {
        tax = tax.add(c.amount);
      } else {
        gross = gross.add(c.amount);
      }
      tax = tax.add(c.taxAmount);
    }

    let paid = ZERO;
    for (const p of payments) {
      paid = paid.add(p.amount).sub(p.refundedAmount ?? ZERO);
    }

    const totalCharges = gross;
    const balance = gross.sub(discounts).add(tax).sub(paid);

    const nearZero = balance.abs().lessThanOrEqualTo('0.01');
    const status = nearZero
      ? charges.length > 0
        ? 'SETTLED'
        : 'OPEN'
      : balance.isNegative()
        ? 'OPEN'
        : paid.greaterThan(ZERO)
          ? 'PARTIALLY_SETTLED'
          : 'OPEN';

    await tx.folio.update({
      where: { id: folioId },
      data: {
        totalCharges,
        totalDiscounts: discounts,
        totalTax: tax,
        totalPayments: paid,
        balance,
        status,
      },
    });

    if (status === 'SETTLED') {
      await tx.invoice.updateMany({
        where: { folioId, paidAt: null },
        data: { paidAt: new Date() },
      });
    } else {
      await tx.invoice.updateMany({
        where: { folioId, paidAt: { not: null } },
        data: { paidAt: null },
      });
    }
  }

  async getById(hotelId: string, id: string): Promise<FolioDTO> {
    const folio = await prisma.folio.findFirst({ where: { id, hotelId }, include: folioInclude });
    if (!folio) {
      throw new NotFoundError('Folio not found');
    }
    return folio;
  }

  async getByReservation(hotelId: string, reservationId: string): Promise<FolioDTO> {
    const folio = await prisma.folio.findFirst({
      where: { hotelId, reservationId },
      include: folioInclude,
    });
    if (!folio) {
      throw new NotFoundError('Folio not found');
    }
    return folio;
  }
}

export const folioService = new FolioService();
