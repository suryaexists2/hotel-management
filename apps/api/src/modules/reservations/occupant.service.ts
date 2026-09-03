import { Prisma, prisma } from '@innsight/database';
import { NotFoundError } from '../../shared/errors/app-error.js';

export type OccupantDTO = Prisma.OccupantGetPayload<Record<string, never>>;

interface CreateOccupantInput {
  firstName: string;
  lastName: string;
  gender?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  email?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  relationship?: string | null;
}

interface UpdateOccupantInput {
  firstName?: string;
  lastName?: string;
  gender?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  email?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  relationship?: string | null;
}

export class OccupantService {
  async listByReservation(hotelId: string, reservationId: string): Promise<OccupantDTO[]> {
    const reservation = await prisma.reservation.findFirst({ where: { id: reservationId, hotelId }, select: { id: true } });
    if (!reservation) throw new NotFoundError('Reservation not found');
    return prisma.occupant.findMany({ where: { reservationId }, orderBy: { createdAt: 'asc' } });
  }

  async create(hotelId: string, reservationId: string, input: CreateOccupantInput): Promise<OccupantDTO> {
    const reservation = await prisma.reservation.findFirst({ where: { id: reservationId, hotelId }, select: { id: true } });
    if (!reservation) throw new NotFoundError('Reservation not found');

    return prisma.occupant.create({
      data: {
        reservationId,
        firstName: input.firstName,
        lastName: input.lastName,
        gender: input.gender ?? null,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        idType: input.idType ?? null,
        idNumber: input.idNumber ?? null,
        relationship: input.relationship ?? null,
      },
    });
  }

  async update(hotelId: string, reservationId: string, occupantId: string, input: UpdateOccupantInput): Promise<OccupantDTO> {
    const reservation = await prisma.reservation.findFirst({ where: { id: reservationId, hotelId }, select: { id: true } });
    if (!reservation) throw new NotFoundError('Reservation not found');

    const occupant = await prisma.occupant.findFirst({ where: { id: occupantId, reservationId } });
    if (!occupant) throw new NotFoundError('Occupant not found');

    const data: Record<string, unknown> = {};
    if (input.firstName !== undefined) data.firstName = input.firstName;
    if (input.lastName !== undefined) data.lastName = input.lastName;
    if (input.gender !== undefined) data.gender = input.gender;
    if (input.dateOfBirth !== undefined) data.dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.email !== undefined) data.email = input.email;
    if (input.idType !== undefined) data.idType = input.idType;
    if (input.idNumber !== undefined) data.idNumber = input.idNumber;
    if (input.relationship !== undefined) data.relationship = input.relationship;

    return prisma.occupant.update({ where: { id: occupantId }, data });
  }

  async remove(hotelId: string, reservationId: string, occupantId: string): Promise<void> {
    const reservation = await prisma.reservation.findFirst({ where: { id: reservationId, hotelId }, select: { id: true } });
    if (!reservation) throw new NotFoundError('Reservation not found');

    const occupant = await prisma.occupant.findFirst({ where: { id: occupantId, reservationId } });
    if (!occupant) throw new NotFoundError('Occupant not found');

    await prisma.occupant.delete({ where: { id: occupantId } });
  }
}

export const occupantService = new OccupantService();