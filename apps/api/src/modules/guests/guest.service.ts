import { Prisma, prisma } from '@innsight/database';
import type {
  CreateGuestInput,
  ListGuestsQuery,
  GuestHistoryQuery,
  PaginationMeta,
} from '@innsight/shared';
import { NotFoundError } from '../../shared/errors/app-error.js';
import { toSkipTake, buildPaginationMeta } from '../../shared/http/pagination.js';

export type GuestDTO = Prisma.GuestGetPayload<Record<string, never>>;

export class GuestService {
  private toDate(value: string | null | undefined): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return new Date(value);
  }

  async list(hotelId: string, query: ListGuestsQuery): Promise<{ items: GuestDTO[]; meta: PaginationMeta }> {
    const { page, limit, search, sortOrder, vipOnly } = query;
    const where: Prisma.GuestWhereInput = {
      hotelId,
      deletedAt: null,
      ...(vipOnly ? { vipLevel: { gt: 0 } } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { email: { contains: search } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };
    const { skip, take } = toSkipTake(page, limit);
    const [items, total] = await prisma.$transaction([
      prisma.guest.findMany({
        where,
        orderBy: { createdAt: sortOrder },
        skip,
        take,
        include: { reservations: { take: 5, orderBy: { createdAt: 'desc' }, include: { room: true } } },
      }),
      prisma.guest.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  async getById(hotelId: string, id: string): Promise<GuestDTO> {
    const guest = await prisma.guest.findFirst({
      where: { id, hotelId, deletedAt: null },
      include: {
        reservations: { orderBy: { createdAt: 'desc' }, include: { room: true, folio: { include: { invoices: true } }, occupants: true } },
        backup: true,
      },
    });
    if (!guest) {
      throw new NotFoundError('Guest not found');
    }
    return guest;
  }

  async create(hotelId: string, input: CreateGuestInput): Promise<GuestDTO> {
    return prisma.guest.create({
      data: {
        hotelId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        dateOfBirth: this.toDate(input.dateOfBirth) ?? null,
        nationality: input.nationality ?? null,
        idType: input.idType ?? null,
        idNumber: input.idNumber ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        country: input.country ?? null,
        vipLevel: input.vipLevel,
        preferences: input.preferences ? JSON.stringify(input.preferences) : null as any,
        notes: input.notes ?? null,
      },
    });
  }

  async update(hotelId: string, id: string, input: Record<string, unknown>): Promise<GuestDTO> {
    const guest = await prisma.guest.findFirst({ where: { id, hotelId, deletedAt: null } });
    if (!guest) throw new NotFoundError('Guest not found');
    const data: Record<string, unknown> = {};
    if (input.firstName !== undefined) data.firstName = input.firstName;
    if (input.lastName !== undefined) data.lastName = input.lastName;
    if (input.email !== undefined) data.email = input.email;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.dateOfBirth !== undefined) data.dateOfBirth = this.toDate(input.dateOfBirth as string | null | undefined);
    if (input.nationality !== undefined) data.nationality = input.nationality;
    if (input.idType !== undefined) data.idType = input.idType;
    if (input.idNumber !== undefined) data.idNumber = input.idNumber;
    if (input.idProofFront !== undefined) data.idProofFront = input.idProofFront;
    if (input.idProofBack !== undefined) data.idProofBack = input.idProofBack;
    if (input.address !== undefined) data.address = input.address;
    if (input.city !== undefined) data.city = input.city;
    if (input.country !== undefined) data.country = input.country;
    if (input.vipLevel !== undefined) data.vipLevel = input.vipLevel;
    if (input.preferences !== undefined) data.preferences = input.preferences ? JSON.stringify(input.preferences) : null as any;
    if (input.notes !== undefined) data.notes = input.notes;

    return prisma.guest.update({ where: { id }, data });
  }

  async remove(hotelId: string, id: string): Promise<void> {
    const guest = await prisma.guest.findFirst({ where: { id, hotelId, deletedAt: null } });
    if (!guest) throw new NotFoundError('Guest not found');

    await prisma.$transaction(async (tx) => {
      await tx.guestBackup.create({
        data: {
          guestId: id,
          hotelId: guest.hotelId,
          firstName: guest.firstName,
          lastName: guest.lastName,
          email: guest.email,
          phone: guest.phone,
          dateOfBirth: guest.dateOfBirth,
          nationality: guest.nationality,
          idType: guest.idType,
          idNumber: guest.idNumber,
          idProofFront: guest.idProofFront,
          idProofBack: guest.idProofBack,
          address: guest.address,
          city: guest.city,
          country: guest.country,
          vipLevel: guest.vipLevel,
          preferences: JSON.parse(guest.preferences as string || 'null'),
          notes: guest.notes,
          totalStays: guest.totalStays,
          totalSpent: guest.totalSpent,
          lastStayAt: guest.lastStayAt,
          deletedAt: new Date(),
        },
      });
      await tx.guest.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  async bulkDelete(hotelId: string, ids: string[]): Promise<void> {
    for (const id of ids) {
      const guest = await prisma.guest.findFirst({ where: { id, hotelId, deletedAt: null } });
      if (guest) {
        await this.remove(hotelId, id);
      }
    }
  }

  async deleteByDateRange(hotelId: string, from: string, to: string): Promise<number> {
    const fromDate = new Date(from);
    const toDate = new Date(to + 'T23:59:59.999Z');
    const guests = await prisma.guest.findMany({
      where: { hotelId, deletedAt: null, createdAt: { gte: fromDate, lte: toDate } },
      select: { id: true },
    });
    for (const g of guests) {
      await this.remove(hotelId, g.id);
    }
    return guests.length;
  }

  async clearAll(hotelId: string): Promise<void> {
    const guests = await prisma.guest.findMany({
      where: { hotelId, deletedAt: null },
      select: { id: true },
    });
    for (const g of guests) {
      await this.remove(hotelId, g.id);
    }
  }

  async restore(hotelId: string, id: string): Promise<GuestDTO> {
    const backup = await prisma.guestBackup.findFirst({
      where: { guestId: id, hotelId },
    });
    if (!backup) throw new NotFoundError('No backup found for this guest');

    await prisma.$transaction(async (tx) => {
      await tx.guest.update({
        where: { id },
        data: {
          deletedAt: null,
          firstName: backup.firstName,
          lastName: backup.lastName,
          email: backup.email,
          phone: backup.phone,
          dateOfBirth: backup.dateOfBirth,
          nationality: backup.nationality,
          idType: backup.idType,
          idNumber: backup.idNumber,
          idProofFront: backup.idProofFront,
          idProofBack: backup.idProofBack,
          address: backup.address,
          city: backup.city,
          country: backup.country,
          vipLevel: backup.vipLevel,
          preferences: JSON.parse(backup.preferences as string || 'null'),
          notes: backup.notes,
          totalStays: backup.totalStays,
          totalSpent: backup.totalSpent,
          lastStayAt: backup.lastStayAt,
        },
      });
      await tx.guestBackup.delete({ where: { id: backup.id } });
    });

    return this.getById(hotelId, id);
  }

  async listBackups(hotelId: string): Promise<{ id: string; firstName: string; lastName: string; email: string | null; phone: string | null; backedUpAt: Date }[]> {
    return prisma.guestBackup.findMany({
      where: { hotelId },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, backedUpAt: true },
      orderBy: { backedUpAt: 'desc' },
    });
  }

  async history(
    hotelId: string,
    query: GuestHistoryQuery,
  ): Promise<{ items: unknown[]; meta: PaginationMeta }> {
    const { guestId, from, to, page, limit } = query;
    const where: Prisma.ReservationWhereInput = {
      hotelId,
      ...(guestId ? { guestId } : {}),
      ...(from || to
        ? {
            OR: [
              ...(from ? [{ checkInDate: { gte: new Date(from) } }] : []),
              ...(to ? [{ checkOutDate: { lte: new Date(to + 'T23:59:59.999Z') } }] : []),
            ],
          }
        : {}),
    };
    const { skip, take } = toSkipTake(page, limit);
    const [items, total] = await prisma.$transaction([
      prisma.reservation.findMany({
        where,
        include: { guest: { select: { id: true, firstName: true, lastName: true, email: true } }, room: true, roomType: true },
        orderBy: { checkInDate: 'desc' },
        skip,
        take,
      }),
      prisma.reservation.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(page, limit, total) };
  }
}

export const guestService = new GuestService();
