import { Prisma, prisma } from '@innsight/database';
import type {
  CreateRoomInput,
  UpdateRoomInput,
  UpdateRoomStatusInput,
  ListRoomsQuery,
  PaginationMeta,
} from '@innsight/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/app-error.js';
import { toSkipTake, buildPaginationMeta } from '../../shared/http/pagination.js';

const roomInclude = {
  roomType: { select: { id: true, name: true, baseRate: true } },
} satisfies Prisma.RoomInclude;

export type RoomDTO = Prisma.RoomGetPayload<{ include: typeof roomInclude }>;

export class RoomService {
  /** A room type must belong to the same tenant before a room can reference it. */
  private async assertRoomTypeOwned(hotelId: string, roomTypeId: string): Promise<void> {
    const rt = await prisma.roomType.findFirst({ where: { id: roomTypeId, hotelId }, select: { id: true } });
    if (!rt) {
      throw new ValidationError('Room type does not exist for this hotel');
    }
  }

  async list(hotelId: string, query: ListRoomsQuery): Promise<{ items: RoomDTO[]; meta: PaginationMeta }> {
    const { page, limit, search, status, roomTypeId, floor, isActive } = query;
    const where: Prisma.RoomWhereInput = {
      hotelId,
      ...(status ? { status } : {}),
      ...(roomTypeId ? { roomTypeId } : {}),
      ...(floor !== undefined ? { floor } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search ? { roomNumber: { contains: search } } : {}),
    };
    const { skip, take } = toSkipTake(page, limit);
    const [items, total] = await prisma.$transaction([
      prisma.room.findMany({ where, include: roomInclude, orderBy: { roomNumber: 'asc' }, skip, take }),
      prisma.room.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  async getById(hotelId: string, id: string): Promise<RoomDTO> {
    const room = await prisma.room.findFirst({ where: { id, hotelId }, include: roomInclude });
    if (!room) {
      throw new NotFoundError('Room not found');
    }
    return room;
  }

  async create(hotelId: string, input: CreateRoomInput): Promise<RoomDTO> {
    await this.assertRoomTypeOwned(hotelId, input.roomTypeId);
    const duplicate = await prisma.room.findFirst({
      where: { hotelId, roomNumber: input.roomNumber },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictError('A room with this number already exists');
    }
    return prisma.room.create({
      data: {
        hotelId,
        roomTypeId: input.roomTypeId,
        roomNumber: input.roomNumber,
        floor: input.floor,
        status: input.status,
        notes: input.notes ?? null,
        isActive: input.isActive,
      },
      include: roomInclude,
    });
  }

  async update(hotelId: string, id: string, input: UpdateRoomInput): Promise<RoomDTO> {
    await this.getById(hotelId, id);
    if (input.roomTypeId !== undefined) {
      await this.assertRoomTypeOwned(hotelId, input.roomTypeId);
    }
    const data: Prisma.RoomUpdateInput = {};
    if (input.roomTypeId !== undefined) data.roomType = { connect: { id: input.roomTypeId } };
    if (input.roomNumber !== undefined) data.roomNumber = input.roomNumber;
    if (input.floor !== undefined) data.floor = input.floor;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    return prisma.room.update({ where: { id }, data, include: roomInclude });
  }

  async updateStatus(hotelId: string, id: string, input: UpdateRoomStatusInput): Promise<RoomDTO> {
    const room = await this.getById(hotelId, id);
    this.assertTransitionAllowed(room.status, input.status);

    const data: Prisma.RoomUpdateInput = { status: input.status };
    if (input.notes !== undefined) data.notes = input.notes;
    // Track the last cleaning completion for housekeeping SLAs.
    if (input.status === 'INSPECTED' || input.status === 'AVAILABLE') {
      if (room.status === 'CLEANING' || room.status === 'DIRTY') {
        data.lastCleanedAt = new Date();
      }
    }
    return prisma.room.update({ where: { id }, data, include: roomInclude });
  }

  async remove(hotelId: string, id: string): Promise<void> {
    const room = await prisma.room.findFirst({
      where: { id, hotelId },
      select: { id: true, status: true, _count: { select: { reservations: true } } },
    });
    if (!room) {
      throw new NotFoundError('Room not found');
    }
    if (room.status === 'OCCUPIED') {
      throw new ConflictError('Cannot delete an occupied room');
    }
    if (room._count.reservations > 0) {
      throw new ConflictError('Cannot delete a room with reservation history; deactivate it instead');
    }
    await prisma.room.delete({ where: { id } });
  }

  /**
   * A room being serviced or occupied cannot jump straight to AVAILABLE without an
   * inspection step; everything else is permitted so front-desk overrides stay possible.
   */
  private assertTransitionAllowed(from: string, to: string): void {
    if (from === to) return;
    if (to === 'AVAILABLE' && (from === 'DIRTY' || from === 'CLEANING')) {
      throw new ValidationError('Room must be inspected before it can be marked available');
    }
    if (from === 'OCCUPIED' && to !== 'DIRTY') {
      throw new ValidationError('An occupied room can only be transitioned to DIRTY');
    }
    if (from === 'OCCUPIED' && to === 'AVAILABLE') {
      throw new ValidationError('An occupied room cannot be made available without checkout');
    }
    if (from === 'DIRTY' && to === 'OCCUPIED') {
      throw new ValidationError('A dirty room cannot be directly occupied');
    }
  }
}

export const roomService = new RoomService();
