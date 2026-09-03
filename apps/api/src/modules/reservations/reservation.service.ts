import { Prisma, prisma } from '@innsight/database';
import type {
  AvailabilityQuery,
  CreateReservationInput,
  WalkInInput,
  CheckInInput,
  CancelReservationInput,
  ListReservationsQuery,
  PaginationMeta,
} from '@innsight/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/app-error.js';
import { toSkipTake, buildPaginationMeta } from '../../shared/http/pagination.js';
import { generateReference } from '../../shared/utils/reference.js';
import { runSerializable } from '../../shared/db/transaction.js';
import { folioService } from '../billing/folio.service.js';
import { billingService } from '../billing/billing.service.js';
import { analyticsService } from '../analytics/analytics.service.js';

// Statuses that occupy inventory for an overlapping date range.
const OCCUPYING: string[] = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'WAITLISTED'];

const reservationInclude = {
  guest: { select: { id: true, firstName: true, lastName: true, email: true, vipLevel: true } },
  roomType: { select: { id: true, name: true, baseRate: true } },
  room: { select: { id: true, roomNumber: true, floor: true } },
  occupants: { orderBy: { createdAt: 'asc' } },
  folio: { include: { invoices: { select: { id: true, invoiceNumber: true } } } },
} satisfies Prisma.ReservationInclude;

export type ReservationDTO = Prisma.ReservationGetPayload<{ include: typeof reservationInclude }>;
type Tx = Prisma.TransactionClient;

function parseUTCDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function nightsBetween(checkIn: Date, checkOut: Date): number {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export class ReservationService {
  /** Rooms of a type still free across [checkIn, checkOut), excluding one reservation. */
  private async availableCount(
    client: Tx | typeof prisma,
    hotelId: string,
    roomTypeId: string,
    checkIn: Date,
    checkOut: Date,
    excludeReservationId?: string,
  ): Promise<number> {
    const totalRooms = await client.room.count({
      where: { hotelId, roomTypeId, isActive: true },
    });
    if (totalRooms === 0) return 0;
    const overlapping = await client.reservation.count({
      where: {
        hotelId,
        roomTypeId,
        status: { in: OCCUPYING },
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
    });
    return totalRooms - overlapping;
  }

  async availability(hotelId: string, query: AvailabilityQuery): Promise<{
    roomTypeId: string;
    available: number;
    checkInDate: string;
    checkOutDate: string;
  }> {
    const checkIn = parseUTCDate(query.checkInDate);
    const checkOut = parseUTCDate(query.checkOutDate);
    if (checkOut <= checkIn) {
      throw new ValidationError('Check-out must be after check-in');
    }
    const available = await this.availableCount(prisma, hotelId, query.roomTypeId, checkIn, checkOut);
    return {
      roomTypeId: query.roomTypeId,
      available: Math.max(0, available),
      checkInDate: query.checkInDate,
      checkOutDate: query.checkOutDate,
    };
  }

  async list(
    hotelId: string,
    query: ListReservationsQuery,
  ): Promise<{ items: ReservationDTO[]; meta: PaginationMeta }> {
    const { page, limit, search, sortOrder, status, guestId, roomId, from, to } = query;
    const statuses = status ? status.split(',').map((s) => s.trim()).filter(Boolean) as any : undefined;
    const where: Prisma.ReservationWhereInput = {
      hotelId,
      ...(statuses ? { status: { in: statuses } } : {}),
      ...(guestId ? { guestId } : {}),
      ...(roomId ? { roomId } : {}),
      ...(from ? { checkOutDate: { gte: parseUTCDate(from) } } : {}),
      ...(to ? { checkInDate: { lte: parseUTCDate(to) } } : {}),
      ...(search
        ? {
            OR: [
              { confirmationNo: { contains: search } },
              { guest: { firstName: { contains: search } } },
              { guest: { lastName: { contains: search } } },
            ],
          }
        : {}),
    };
    const { skip, take } = toSkipTake(page, limit);
    const [items, total] = await prisma.$transaction([
      prisma.reservation.findMany({ where, include: reservationInclude, orderBy: { checkInDate: sortOrder }, skip, take }),
      prisma.reservation.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  async getById(hotelId: string, id: string): Promise<ReservationDTO> {
    const reservation = await prisma.reservation.findFirst({ where: { id, hotelId }, include: reservationInclude });
    if (!reservation) {
      throw new NotFoundError('Reservation not found');
    }
    return reservation;
  }

  /** Validate guest + room type ownership and compute pricing for a booking. */
  private async prepareBooking(
    tx: Tx,
    hotelId: string,
    input: CreateReservationInput | WalkInInput,
  ): Promise<{
    checkIn: Date;
    checkOut: Date;
    nights: number;
    ratePerNight: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
  }> {
    const guest = await tx.guest.findFirst({ where: { id: input.guestId, hotelId, deletedAt: null }, select: { id: true } });
    if (!guest) throw new ValidationError('Guest does not exist for this hotel');

    const roomType = await tx.roomType.findFirst({
      where: { id: input.roomTypeId, hotelId },
      select: { id: true, baseRate: true, maxOccupancy: true },
    });
    if (!roomType) throw new ValidationError('Room type does not exist for this hotel');

    if (input.adults + input.children > roomType.maxOccupancy) {
      throw new ValidationError('Occupancy exceeds room type maximum');
    }

    const checkIn = parseUTCDate(input.checkInDate);
    const checkOut = parseUTCDate(input.checkOutDate);
    const nights = nightsBetween(checkIn, checkOut);
    if (nights < 1) throw new ValidationError('Stay must be at least one night');

    const ratePerNight =
      input.ratePerNight !== undefined ? new Prisma.Decimal(input.ratePerNight) : roomType.baseRate;
    const totalAmount = ratePerNight.mul(nights);
    return { checkIn, checkOut, nights, ratePerNight, totalAmount };
  }

  async create(hotelId: string, actorId: string, input: CreateReservationInput): Promise<ReservationDTO> {
    // Serializable: the availability count + create is a read-modify-write that must
    // not overbook a room type under concurrent bookings.
    return runSerializable(async (tx) => {
      const pricing = await this.prepareBooking(tx, hotelId, input);
      const available = await this.availableCount(tx, hotelId, input.roomTypeId, pricing.checkIn, pricing.checkOut);
      if (available <= 0) {
        const roomCount = await tx.room.count({ where: { hotelId, roomTypeId: input.roomTypeId, isActive: true } });
        if (roomCount === 0) {
          throw new ConflictError('No rooms exist for this room type. Please add rooms first.');
        }
        throw new ConflictError('No rooms of this type are available for the selected dates');
      }
      if (input.roomId) {
        await this.assertRoomAssignable(tx, hotelId, input.roomId, input.roomTypeId);
      }

      const created = await tx.reservation.create({
        data: {
          hotelId,
          confirmationNo: generateReference('RES', pricing.checkIn),
          guestId: input.guestId,
          roomId: input.roomId ?? null,
          roomTypeId: input.roomTypeId,
          checkInDate: pricing.checkIn,
          checkOutDate: pricing.checkOut,
          nights: pricing.nights,
          adults: input.adults,
          children: input.children,
          ratePerNight: pricing.ratePerNight,
          totalAmount: pricing.totalAmount,
          status: 'CONFIRMED',
          source: input.source,
          specialRequests: input.specialRequests ?? null,
          internalNotes: input.internalNotes ?? null,
          createdBy: actorId,
        },
        include: reservationInclude,
      });
      return created;
    });
  }

  async walkIn(hotelId: string, actorId: string, input: WalkInInput): Promise<ReservationDTO> {
    return runSerializable(async (tx) => {
      const pricing = await this.prepareBooking(tx, hotelId, input);
      const available = await this.availableCount(tx, hotelId, input.roomTypeId, pricing.checkIn, pricing.checkOut);
      if (available <= 0) {
        const roomCount = await tx.room.count({ where: { hotelId, roomTypeId: input.roomTypeId, isActive: true } });
        if (roomCount === 0) {
          throw new ConflictError('No rooms exist for this room type. Please add rooms first.');
        }
        throw new ConflictError('No rooms of this type are available for the selected dates');
      }

      const walkInReservation = await tx.reservation.create({
        data: {
          hotelId,
          confirmationNo: generateReference('RES', pricing.checkIn),
          guestId: input.guestId,
          roomId: input.roomId ?? null,
          roomTypeId: input.roomTypeId,
          checkInDate: pricing.checkIn,
          checkOutDate: pricing.checkOut,
          nights: pricing.nights,
          adults: input.adults,
          children: input.children,
          ratePerNight: pricing.ratePerNight,
          totalAmount: pricing.totalAmount,
          status: 'CONFIRMED',
          source: input.source,
          specialRequests: input.specialRequests ?? null,
          internalNotes: input.internalNotes ?? null,
          createdBy: actorId,
        },
        include: reservationInclude,
      });

      return this.doCheckIn(tx, hotelId, actorId, walkInReservation.id, { roomId: input.roomId });
    });
  }

  async checkIn(hotelId: string, actorId: string, id: string, input: CheckInInput): Promise<ReservationDTO> {
    return runSerializable(async (tx) => {
      return this.doCheckIn(tx, hotelId, actorId, id, input);
    });
  }

  private async doCheckIn(tx: Tx, hotelId: string, actorId: string, id: string, input: CheckInInput): Promise<ReservationDTO> {
    const reservation = await tx.reservation.findFirst({ where: { id, hotelId } });
    if (!reservation) throw new NotFoundError('Reservation not found');
    if (reservation.status !== 'CONFIRMED' && reservation.status !== 'PENDING') {
      throw new ConflictError(`Cannot check in a reservation with status ${reservation.status}`);
    }

    const roomId = input.roomId ?? reservation.roomId ?? (await this.autoAssignRoom(tx, hotelId, reservation.roomTypeId));
    await this.assertRoomAssignable(tx, hotelId, roomId, reservation.roomTypeId, id);

    const now = new Date();
    await tx.reservation.update({
      where: { id },
      data: { status: 'CHECKED_IN', checkedInAt: now, roomId, updatedBy: actorId },
    });
    await tx.room.update({ where: { id: roomId }, data: { status: 'OCCUPIED' } });

    const hotel = await tx.hotel.findUnique({
      where: { id: hotelId },
      select: { currency: true, settings: { select: { defaultTaxRate: true } } },
    });
    const currency = hotel?.currency ?? 'USD';
    const taxRate = hotel?.settings?.defaultTaxRate ?? new Prisma.Decimal(0);

    const folioId = await folioService.createForReservation(tx, {
      hotelId,
      reservationId: id,
      guestId: reservation.guestId,
      currency,
      now,
    });

    const roomTotal = reservation.ratePerNight.mul(reservation.nights);
    await folioService.postCharge(tx, folioId, {
      category: 'ROOM',
      description: `Room charge — ${reservation.nights} night(s)`,
      unitPrice: reservation.ratePerNight,
      quantity: reservation.nights,
      taxAmount: roomTotal.mul(taxRate),
      createdBy: actorId,
    });

    return tx.reservation.findFirstOrThrow({ where: { id }, include: reservationInclude });
  }

  async checkOut(hotelId: string, actorId: string, id: string): Promise<ReservationDTO> {
    const result = await runSerializable(async (tx) => {
      const reservation = await tx.reservation.findFirst({ where: { id, hotelId } });
      if (!reservation) throw new NotFoundError('Reservation not found');
      if (reservation.status !== 'CHECKED_IN') {
        throw new ConflictError('Only checked-in reservations can be checked out');
      }

      const folio = await tx.folio.findUnique({ where: { reservationId: id } });
      if (folio && folio.balance.greaterThan('0.005')) {
        throw new ConflictError('Outstanding folio balance must be settled before check-out');
      }

      const now = new Date();
      await tx.reservation.update({
        where: { id },
        data: { status: 'CHECKED_OUT', checkedOutAt: now, updatedBy: actorId },
      });

      if (reservation.roomId) {
        await tx.room.update({ where: { id: reservation.roomId }, data: { status: 'DIRTY' } });
        await tx.housekeepingTask.create({
          data: {
            hotelId,
            roomId: reservation.roomId,
            status: 'PENDING',
            priority: 'HIGH',
            type: 'CHECKOUT_CLEAN',
          },
        });
      }

      if (folio) {
        await tx.folio.update({ where: { id: folio.id }, data: { status: 'SETTLED', closedAt: now } });
        // Generate the invoice inside the same transaction so a checkout always
        // produces its invoice — it can never be silently dropped afterwards.
        await billingService.generateInvoice(hotelId, folio.id, tx);
        await tx.guest.update({
          where: { id: reservation.guestId },
          data: {
            totalStays: { increment: 1 },
            totalSpent: { increment: folio.totalPayments },
            lastStayAt: now,
          },
        });
      }

      return tx.reservation.findFirstOrThrow({ where: { id }, include: reservationInclude });
    });

    await analyticsService.compute(hotelId, new Date()).catch(() => {});

    return result;
  }

  async cancel(hotelId: string, actorId: string, id: string, input: CancelReservationInput): Promise<ReservationDTO> {
    return prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({ where: { id, hotelId } });
      if (!reservation) throw new NotFoundError('Reservation not found');
      if (reservation.status === 'CHECKED_IN' || reservation.status === 'CHECKED_OUT') {
        throw new ConflictError('Cannot cancel a reservation that is checked in or out');
      }
      if (reservation.status === 'CANCELLED') {
        throw new ConflictError('Reservation is already cancelled');
      }

      await tx.reservation.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: input.reason,
          updatedBy: actorId,
        },
      });
      return tx.reservation.findFirstOrThrow({ where: { id }, include: reservationInclude });
    });
  }

  private async autoAssignRoom(tx: Tx, hotelId: string, roomTypeId: string): Promise<string> {
    const room = await tx.room.findFirst({
      where: {
        hotelId,
        roomTypeId,
        isActive: true,
        status: { in: ['AVAILABLE', 'INSPECTED'] },
      },
      orderBy: { roomNumber: 'asc' },
      select: { id: true },
    });
    if (!room) {
      throw new ConflictError('No serviceable room of this type is currently available');
    }
    return room.id;
  }

  private async assertRoomAssignable(
    tx: Tx,
    hotelId: string,
    roomId: string,
    roomTypeId: string,
    reservationId?: string,
  ): Promise<void> {
    const room = await tx.room.findFirst({
      where: { id: roomId, hotelId, roomTypeId, isActive: true },
      select: { id: true },
    });
    if (!room) {
      throw new ValidationError('Room is invalid for this room type');
    }
    const conflict = await tx.reservation.findFirst({
      where: {
        hotelId,
        roomId,
        status: 'CHECKED_IN',
        ...(reservationId ? { id: { not: reservationId } } : {}),
      },
      select: { id: true },
    });
    if (conflict) {
      throw new ConflictError('Room is currently occupied by another guest');
    }
  }
}

export const reservationService = new ReservationService();
