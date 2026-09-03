import { Prisma, prisma } from '@innsight/database';
import type { ReportRangeQuery, ReportDayQuery } from '@innsight/shared';

const DAY_MS = 86_400_000;

interface Window {
  from: Date;
  to: Date;
  days: number;
}

/** Resolve an optional query range into a concrete, day-aligned window. Defaults to
 *  the trailing 30 days when unspecified. `from` is snapped to 00:00, `to` to 23:59:59. */
function resolveWindow(q: ReportRangeQuery): Window {
  const now = new Date();
  const rawTo = q.to ?? now;
  const rawFrom = q.from ?? new Date(rawTo.getTime() - 29 * DAY_MS);

  const from = new Date(rawFrom);
  from.setHours(0, 0, 0, 0);
  const to = new Date(rawTo);
  to.setHours(23, 59, 59, 999);

  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS));
  return { from, to, days };
}

/** Whole nights of a stay that fall inside [winStart, winEnd]. */
function nightsInWindow(checkIn: Date, checkOut: Date, winStart: Date, winEnd: Date): number {
  const start = Math.max(checkIn.getTime(), winStart.getTime());
  const end = Math.min(checkOut.getTime(), winEnd.getTime());
  if (end <= start) return 0;
  return Math.max(0, Math.round((end - start) / DAY_MS));
}

const ZERO = new Prisma.Decimal(0);

function decOr0(value: Prisma.Decimal | null | undefined): Prisma.Decimal {
  return value ?? ZERO;
}

/** Serialize a Decimal money value to a 2dp number at the response boundary only. */
function money(value: Prisma.Decimal): number {
  return Number(value.toDecimalPlaces(2).toString());
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export class ReportsService {
  /** Occupancy, ADR, RevPAR and room revenue over a window. */
  async occupancy(hotelId: string, query: ReportRangeQuery) {
    const win = resolveWindow(query);

    const activeRooms = await prisma.room.count({ where: { hotelId, isActive: true } });

    // Reservations whose stay overlaps the window and represent real occupancy.
    const reservations = await prisma.reservation.findMany({
      where: {
        hotelId,
        status: { in: ['CHECKED_IN', 'CHECKED_OUT'] },
        checkInDate: { lte: win.to },
        checkOutDate: { gte: win.from },
      },
      select: { checkInDate: true, checkOutDate: true, ratePerNight: true },
    });

    let roomNightsSold = 0;
    let roomRevenue = ZERO;
    for (const r of reservations) {
      const nights = nightsInWindow(r.checkInDate, r.checkOutDate, win.from, win.to);
      roomNightsSold += nights;
      roomRevenue = roomRevenue.add(r.ratePerNight.mul(nights));
    }

    const availableRoomNights = activeRooms * win.days;
    const occupancyRate = availableRoomNights > 0 ? roomNightsSold / availableRoomNights : 0;
    const adr = roomNightsSold > 0 ? roomRevenue.div(roomNightsSold) : ZERO;
    const revPar = availableRoomNights > 0 ? roomRevenue.div(availableRoomNights) : ZERO;

    return {
      range: { from: win.from, to: win.to, days: win.days },
      activeRooms,
      availableRoomNights,
      roomNightsSold,
      occupancyRate: round2(occupancyRate * 100),
      roomRevenue: money(roomRevenue),
      adr: money(adr),
      revPar: money(revPar),
    };
  }

  /** Collected revenue, refunds and a charge breakdown by category over a window. */
  async revenue(hotelId: string, query: ReportRangeQuery) {
    const win = resolveWindow(query);
    const folioFilter = { folio: { hotelId } };

    const [payments, refunds, chargesByCategory] = await Promise.all([
      prisma.payment.aggregate({
        where: { ...folioFilter, status: 'COMPLETED', processedAt: { gte: win.from, lte: win.to } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { ...folioFilter, refundedAt: { gte: win.from, lte: win.to } },
        _sum: { refundedAmount: true },
      }),
      prisma.folioCharge.groupBy({
        by: ['category'],
        where: { ...folioFilter, isVoided: false, date: { gte: win.from, lte: win.to } },
        _sum: { amount: true, taxAmount: true },
      }),
    ]);

    const grossCollected = decOr0(payments._sum.amount);
    const refunded = decOr0(refunds._sum.refundedAmount);
    const chargesTotal = chargesByCategory.reduce((s, c) => s.add(decOr0(c._sum.amount)), ZERO);
    const charges = chargesByCategory
      .map((c) => ({
        category: c.category,
        amount: money(decOr0(c._sum.amount)),
        tax: money(decOr0(c._sum.taxAmount)),
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      range: { from: win.from, to: win.to, days: win.days },
      paymentCount: payments._count,
      grossCollected: money(grossCollected),
      refunded: money(refunded),
      netRevenue: money(grossCollected.sub(refunded)),
      chargesTotal: money(chargesTotal),
      chargesByCategory: charges,
    };
  }

  /** Housekeeping throughput + SLA (completion rate, average minutes to complete). */
  async housekeeping(hotelId: string, query: ReportRangeQuery) {
    const win = resolveWindow(query);
    const where = { hotelId, createdAt: { gte: win.from, lte: win.to } };

    const byStatus = await prisma.housekeepingTask.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    const statusCounts: Record<string, number> = {};
    let total = 0;
    for (const s of byStatus) {
      statusCounts[s.status] = s._count;
      total += s._count;
    }
    const completed = statusCounts.COMPLETED ?? 0;

    // Average minutes from creation to completion for tasks completed in the window.
    const completedTasks = await prisma.housekeepingTask.findMany({
      where: { hotelId, status: 'COMPLETED', completedAt: { gte: win.from, lte: win.to } },
      select: { createdAt: true, startedAt: true, completedAt: true },
    });
    let totalMinutes = 0;
    let measured = 0;
    for (const t of completedTasks) {
      if (!t.completedAt) continue;
      const start = t.startedAt ?? t.createdAt;
      const minutes = (t.completedAt.getTime() - start.getTime()) / 60_000;
      if (minutes >= 0) {
        totalMinutes += minutes;
        measured += 1;
      }
    }

    return {
      range: { from: win.from, to: win.to, days: win.days },
      totalTasks: total,
      statusCounts,
      completionRate: total > 0 ? round2((completed / total) * 100) : 0,
      avgCompletionMinutes: measured > 0 ? round2(totalMinutes / measured) : 0,
    };
  }

  /** Arrivals, departures and in-house counts/lists for a single day. */
  async arrivalsDepartures(hotelId: string, query: ReportDayQuery) {
    const target = query.date ?? new Date();
    const dayStart = new Date(target);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(target);
    dayEnd.setHours(23, 59, 59, 999);

    const guestSelect = {
      id: true,
      confirmationNo: true,
      status: true,
      checkInDate: true,
      checkOutDate: true,
      guest: { select: { id: true, firstName: true, lastName: true } },
      room: { select: { id: true, roomNumber: true } },
    } satisfies Prisma.ReservationSelect;

    const [arrivals, departures, inHouse] = await Promise.all([
      prisma.reservation.findMany({
        where: {
          hotelId,
          checkInDate: { gte: dayStart, lte: dayEnd },
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
        },
        select: guestSelect,
        orderBy: { checkInDate: 'asc' },
      }),
      prisma.reservation.findMany({
        where: {
          hotelId,
          checkOutDate: { gte: dayStart, lte: dayEnd },
          status: { in: ['CHECKED_IN', 'CHECKED_OUT'] },
        },
        select: guestSelect,
        orderBy: { checkOutDate: 'asc' },
      }),
      prisma.reservation.count({ where: { hotelId, status: 'CHECKED_IN' } }),
    ]);

    return {
      date: dayStart,
      arrivals: { count: arrivals.length, items: arrivals },
      departures: { count: departures.length, items: departures },
      inHouse,
    };
  }

  /** Live snapshot for the operator dashboard: today's occupancy + operational counters. */
  async dashboard(hotelId: string) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      occupancy,
      roomsByStatus,
      arrivalsDepartures,
      openFolios,
      pendingTasks,
      openMaintenance,
      revenueToday,
      revenueThisWeek,
      revenueThisMonth,
      revenueTotal,
      outstandingInvoices,
      recentPayments,
    ] = await Promise.all([
      this.occupancy(hotelId, { from: todayStart, to: todayEnd }),
      prisma.room.groupBy({ by: ['status'], where: { hotelId, isActive: true }, _count: true }),
      this.arrivalsDepartures(hotelId, {}),
      prisma.folio.aggregate({
        where: { hotelId, status: { in: ['OPEN', 'PARTIALLY_SETTLED'] } },
        _sum: { balance: true },
        _count: true,
      }),
      prisma.housekeepingTask.count({
        where: { hotelId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      }),
      prisma.maintenanceOrder.count({
        where: { hotelId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      prisma.payment.aggregate({
        where: { folio: { hotelId }, status: 'COMPLETED', processedAt: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { folio: { hotelId }, status: 'COMPLETED', processedAt: { gte: weekStart } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { folio: { hotelId }, status: 'COMPLETED', processedAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { folio: { hotelId }, status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      prisma.invoice.count({
        where: { hotelId, paidAt: null },
      }),
      prisma.payment.findMany({
        where: { folio: { hotelId }, status: 'COMPLETED' },
        orderBy: { processedAt: 'desc' },
        take: 10,
        select: { id: true, amount: true, method: true, processedAt: true, folio: { select: { currency: true } } },
      }),
    ]);

    const roomStatusCounts: Record<string, number> = {};
    for (const r of roomsByStatus) roomStatusCounts[r.status] = r._count;

    return {
      occupancy: {
        rate: occupancy.occupancyRate,
        adr: occupancy.adr,
        revPar: occupancy.revPar,
        roomRevenue: occupancy.roomRevenue,
      },
      rooms: { total: occupancy.activeRooms, byStatus: roomStatusCounts },
      today: {
        arrivals: arrivalsDepartures.arrivals.count,
        departures: arrivalsDepartures.departures.count,
        inHouse: arrivalsDepartures.inHouse,
      },
      folios: { open: openFolios._count, outstandingBalance: money(decOr0(openFolios._sum.balance)) },
      housekeeping: { pending: pendingTasks },
      maintenance: { open: openMaintenance },
      revenue: {
        today: money(decOr0(revenueToday._sum.amount)),
        thisWeek: money(decOr0(revenueThisWeek._sum.amount)),
        thisMonth: money(decOr0(revenueThisMonth._sum.amount)),
        total: money(decOr0(revenueTotal._sum.amount)),
      },
      pendingPayments: money(decOr0(openFolios._sum.balance)),
      outstandingInvoices,
      recentActivity: recentPayments.map((p) => ({
        id: p.id,
        type: 'payment',
        description: `Payment via ${p.method}`,
        amount: money(p.amount),
        currency: p.folio.currency,
        date: p.processedAt.toISOString(),
      })),
    };
  }
}

export const reportsService = new ReportsService();
