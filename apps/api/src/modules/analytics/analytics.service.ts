import { prisma } from '@innsight/database';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export class AnalyticsService {
  async compute(hotelId: string, date: Date) {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    const totalRooms = await prisma.room.count({ where: { hotelId, isActive: true } });

    const reservations = await prisma.reservation.findMany({
      where: {
        hotelId,
        OR: [
          { checkInDate: { lte: dayEnd }, checkOutDate: { gte: dayStart } },
          { checkedInAt: { gte: dayStart, lte: dayEnd } },
        ],
      },
      select: {
        id: true,
        guestId: true,
        status: true,
        checkInDate: true,
        checkOutDate: true,
        totalAmount: true,
        nights: true,
        checkedInAt: true,
        checkedOutAt: true,
        cancelledAt: true,
      },
    });

    let totalGuests = 0;
    let totalReservations = 0;
    let checkIns = 0;
    let checkOuts = 0;
    let cancellations = 0;
    let totalRevenue = 0;
    let totalRoomsBooked = 0;
    let totalNights = 0;
    let nightsCount = 0;
    const uniqueGuests = new Set<string>();

    for (const r of reservations) {
      uniqueGuests.add(r.guestId);
      totalReservations++;

      const checkInDay = startOfDay(r.checkInDate).getTime();
      const checkOutDay = startOfDay(r.checkOutDate).getTime();
      const targetDay = dayStart.getTime();

      if (r.status === 'CHECKED_IN' || r.status === 'CHECKED_OUT') {
        if (checkInDay <= targetDay && checkOutDay > targetDay) {
          totalRoomsBooked++;
        }
      }

      if (r.checkedInAt && r.checkedInAt >= dayStart && r.checkedInAt <= dayEnd) {
        checkIns++;
      }
      if (r.checkedOutAt && r.checkedOutAt >= dayStart && r.checkedOutAt <= dayEnd) {
        checkOuts++;
        totalNights += r.nights;
        nightsCount++;
      }
      if (r.cancelledAt && r.cancelledAt >= dayStart && r.cancelledAt <= dayEnd) {
        cancellations++;
      }
    }

    totalGuests = uniqueGuests.size;

    // Use actual completed payments for revenue, not reservation.totalAmount
    const paymentAgg = await prisma.payment.aggregate({
      where: {
        folio: { hotelId },
        status: 'COMPLETED',
        processedAt: { gte: dayStart, lte: dayEnd },
      },
      _sum: { amount: true },
    });
    totalRevenue = Number(paymentAgg._sum.amount ?? 0);
    const occupancyRate = totalRooms > 0 ? (totalRoomsBooked / totalRooms) * 100 : 0;
    const avgNights = nightsCount > 0 ? totalNights / nightsCount : 0;

    const data = {
      hotelId,
      date: dayStart,
      totalGuests,
      totalReservations,
      checkIns,
      checkOuts,
      cancellations,
      totalRevenue,
      totalRoomsBooked,
      occupancyRate,
      avgNights,
    };

    return prisma.dailyAnalytics.upsert({
      where: { hotelId_date: { hotelId, date: dayStart } },
      create: data,
      update: data,
    });
  }

  async list(hotelId: string, from?: string, to?: string) {
    const fromDate = from ? startOfDay(new Date(from)) : new Date(0);
    const toDate = to ? endOfDay(new Date(to)) : new Date();

    return prisma.dailyAnalytics.findMany({
      where: {
        hotelId,
        date: { gte: fromDate, lte: toDate },
      },
      orderBy: { date: 'desc' },
    });
  }

  async getByDate(hotelId: string, date: Date) {
    const dayStart = startOfDay(date);
    return prisma.dailyAnalytics.findUnique({
      where: { hotelId_date: { hotelId, date: dayStart } },
    });
  }

  async delete(hotelId: string, date: Date) {
    const dayStart = startOfDay(date);
    return prisma.dailyAnalytics.delete({
      where: { hotelId_date: { hotelId, date: dayStart } },
    });
  }

  async seed(hotelId: string, days: number) {
    const totalRooms = await prisma.room.count({ where: { hotelId, isActive: true } });
    const rooms = totalRooms || 20;
    const today = new Date();
    let count = 0;

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayStart = startOfDay(d);

      const existing = await prisma.dailyAnalytics.findUnique({
        where: { hotelId_date: { hotelId, date: dayStart } },
      });
      if (existing) continue;

      const variance = () => Math.random() * 0.4 + 0.6;
      const baseGuests = Math.floor(Math.random() * 15 + 5);

      await prisma.dailyAnalytics.create({
        data: {
          hotelId,
          date: dayStart,
          totalGuests: baseGuests,
          totalReservations: Math.floor(baseGuests * variance()),
          checkIns: Math.floor(baseGuests * 0.7),
          checkOuts: Math.floor(baseGuests * 0.6),
          cancellations: Math.floor(Math.random() * 3),
          totalRevenue: Math.floor(Math.random() * 80000 + 15000),
          totalRoomsBooked: Math.floor(Math.random() * rooms * 0.8 + 1),
          occupancyRate: Math.random() * 60 + 30,
          avgNights: Math.round((Math.random() * 2 + 1) * 10) / 10,
        },
      });
      count++;
    }
    return count;
  }
}

export const analyticsService = new AnalyticsService();
