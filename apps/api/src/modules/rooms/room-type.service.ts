import { Prisma, prisma } from '@innsight/database';
import type {
  CreateRoomTypeInput,
  UpdateRoomTypeInput,
  ListRoomTypesQuery,
  PaginationMeta,
} from '@innsight/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/app-error.js';
import { toSkipTake, buildPaginationMeta } from '../../shared/http/pagination.js';

const roomTypeInclude = { _count: { select: { rooms: true } } } satisfies Prisma.RoomTypeInclude;
export type RoomTypeDTO = Prisma.RoomTypeGetPayload<{ include: typeof roomTypeInclude }>;

export class RoomTypeService {
  async list(
    hotelId: string,
    query: ListRoomTypesQuery,
  ): Promise<{ items: RoomTypeDTO[]; meta: PaginationMeta }> {
    const { page, limit, search, isActive } = query;
    const where: Prisma.RoomTypeWhereInput = {
      hotelId,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search ? { name: { contains: search } } : {}),
    };
    const { skip, take } = toSkipTake(page, limit);
    const [items, total] = await prisma.$transaction([
      prisma.roomType.findMany({
        where,
        include: roomTypeInclude,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip,
        take,
      }),
      prisma.roomType.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  async getById(hotelId: string, id: string): Promise<RoomTypeDTO> {
    const roomType = await prisma.roomType.findFirst({ where: { id, hotelId }, include: roomTypeInclude });
    if (!roomType) {
      throw new NotFoundError('Room type not found');
    }
    return roomType;
  }

  async create(hotelId: string, input: CreateRoomTypeInput): Promise<RoomTypeDTO> {
    this.assertOccupancy(input.maxAdults, input.maxChildren, input.maxOccupancy);
    return prisma.roomType.create({
      data: {
        hotelId,
        name: input.name,
        description: input.description ?? null,
        baseRate: new Prisma.Decimal(input.baseRate),
        maxOccupancy: input.maxOccupancy,
        maxAdults: input.maxAdults,
        maxChildren: input.maxChildren,
        amenities: JSON.stringify(input.amenities) as any,
        images: JSON.stringify(input.images) as any,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
      include: roomTypeInclude,
    });
  }

  async update(hotelId: string, id: string, input: UpdateRoomTypeInput): Promise<RoomTypeDTO> {
    const existing = await this.getById(hotelId, id);
    const maxAdults = input.maxAdults ?? existing.maxAdults;
    const maxChildren = input.maxChildren ?? existing.maxChildren;
    const maxOccupancy = input.maxOccupancy ?? existing.maxOccupancy;
    this.assertOccupancy(maxAdults, maxChildren, maxOccupancy);

    const data: Prisma.RoomTypeUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.baseRate !== undefined) data.baseRate = new Prisma.Decimal(input.baseRate);
    if (input.maxOccupancy !== undefined) data.maxOccupancy = input.maxOccupancy;
    if (input.maxAdults !== undefined) data.maxAdults = input.maxAdults;
    if (input.maxChildren !== undefined) data.maxChildren = input.maxChildren;
    if (input.amenities !== undefined) data.amenities = JSON.stringify(input.amenities) as any;
    if (input.images !== undefined) data.images = JSON.stringify(input.images) as any;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    return prisma.roomType.update({ where: { id }, data, include: roomTypeInclude });
  }

  async remove(hotelId: string, id: string): Promise<void> {
    const roomType = await this.getById(hotelId, id);
    if (roomType._count.rooms > 0) {
      throw new ConflictError('Cannot delete a room type that still has rooms; deactivate it instead');
    }
    await prisma.roomType.delete({ where: { id } });
  }

  private assertOccupancy(maxAdults: number, maxChildren: number, maxOccupancy: number): void {
    if (maxAdults + maxChildren < maxOccupancy) {
      throw new ValidationError('maxOccupancy cannot exceed maxAdults + maxChildren');
    }
  }
}

export const roomTypeService = new RoomTypeService();
