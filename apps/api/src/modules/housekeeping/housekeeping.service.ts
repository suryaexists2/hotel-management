import { Prisma, prisma } from '@innsight/database';
import type {
  CreateHousekeepingTaskInput,
  UpdateHousekeepingTaskInput,
  UpdateHousekeepingStatusInput,
  ListHousekeepingQuery,
  PaginationMeta,
} from '@innsight/shared';
import { NotFoundError, ValidationError } from '../../shared/errors/app-error.js';
import { toSkipTake, buildPaginationMeta } from '../../shared/http/pagination.js';

const taskInclude = {
  room: { select: { id: true, roomNumber: true, floor: true } },
  assignedEmployee: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.HousekeepingTaskInclude;
export type HousekeepingTaskDTO = Prisma.HousekeepingTaskGetPayload<{ include: typeof taskInclude }>;

// Valid forward-only transitions for housekeeping tasks.
const HK_STATUS_FLOW: Record<string, string[]> = {
  PENDING: ['IN_PROGRESS', 'SKIPPED', 'REASSIGNED'],
  IN_PROGRESS: ['COMPLETED', 'REASSIGNED'],
  COMPLETED: [],
  SKIPPED: [],
  REASSIGNED: ['IN_PROGRESS', 'COMPLETED', 'SKIPPED'],
};

export class HousekeepingService {
  private async assertRoomOwned(hotelId: string, roomId: string): Promise<void> {
    const room = await prisma.room.findFirst({ where: { id: roomId, hotelId }, select: { id: true } });
    if (!room) throw new ValidationError('Room does not exist for this hotel');
  }

  private async assertEmployeeOwned(hotelId: string, employeeId: string): Promise<void> {
    const emp = await prisma.employee.findFirst({ where: { id: employeeId, hotelId }, select: { id: true } });
    if (!emp) throw new ValidationError('Assigned employee does not exist for this hotel');
  }

  async list(hotelId: string, query: ListHousekeepingQuery): Promise<{ items: HousekeepingTaskDTO[]; meta: PaginationMeta }> {
    const { page, limit, status, priority, assignedTo, roomId, sortOrder } = query;
    const where: Prisma.HousekeepingTaskWhereInput = {
      hotelId,
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(assignedTo ? { assignedTo } : {}),
      ...(roomId ? { roomId } : {}),
    };
    const { skip, take } = toSkipTake(page, limit);
    const [items, total] = await prisma.$transaction([
      prisma.housekeepingTask.findMany({
        where,
        include: taskInclude,
        orderBy: [{ priority: 'asc' }, { createdAt: sortOrder }],
        skip,
        take,
      }),
      prisma.housekeepingTask.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  async getById(hotelId: string, id: string): Promise<HousekeepingTaskDTO> {
    const task = await prisma.housekeepingTask.findFirst({ where: { id, hotelId }, include: taskInclude });
    if (!task) throw new NotFoundError('Housekeeping task not found');
    return task;
  }

  async create(hotelId: string, input: CreateHousekeepingTaskInput): Promise<HousekeepingTaskDTO> {
    await this.assertRoomOwned(hotelId, input.roomId);
    if (input.assignedTo) await this.assertEmployeeOwned(hotelId, input.assignedTo);
    return prisma.housekeepingTask.create({
      data: {
        hotelId,
        roomId: input.roomId,
        assignedTo: input.assignedTo ?? null,
        priority: input.priority,
        type: input.type,
        notes: input.notes ?? null,
      },
      include: taskInclude,
    });
  }

  async update(hotelId: string, id: string, input: UpdateHousekeepingTaskInput): Promise<HousekeepingTaskDTO> {
    await this.getById(hotelId, id);
    if (input.assignedTo) await this.assertEmployeeOwned(hotelId, input.assignedTo);

    const data: Prisma.HousekeepingTaskUpdateInput = {};
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.type !== undefined) data.type = input.type;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.assignedTo !== undefined) {
      data.assignedEmployee = input.assignedTo ? { connect: { id: input.assignedTo } } : { disconnect: true };
      if (input.assignedTo) data.status = 'REASSIGNED';
    }
    return prisma.housekeepingTask.update({ where: { id }, data, include: taskInclude });
  }

  /** Advance task status, keeping room state in sync (CLEANING while in progress, INSPECTED on done). */
  async updateStatus(hotelId: string, id: string, input: UpdateHousekeepingStatusInput): Promise<HousekeepingTaskDTO> {
    const task = await this.getById(hotelId, id);
    const allowed = HK_STATUS_FLOW[task.status];
    if (allowed && !allowed.includes(input.status)) {
      throw new ValidationError(`Cannot transition from ${task.status} to ${input.status}`);
    }
    const now = new Date();

    const data: Prisma.HousekeepingTaskUpdateInput = { status: input.status };
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.status === 'IN_PROGRESS') data.startedAt = now;
    if (input.status === 'COMPLETED') data.completedAt = now;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.housekeepingTask.update({ where: { id }, data, include: taskInclude });
      if (input.status === 'IN_PROGRESS') {
        await tx.room.updateMany({ where: { id: task.roomId, status: 'DIRTY' }, data: { status: 'CLEANING' } });
      } else if (input.status === 'COMPLETED') {
        await tx.room.update({ where: { id: task.roomId }, data: { status: 'INSPECTED', lastCleanedAt: now } });
      }
      return updated;
    });
  }

  async inspect(hotelId: string, id: string, inspectorEmployeeId: string | null): Promise<HousekeepingTaskDTO> {
    const task = await this.getById(hotelId, id);
    return prisma.$transaction(async (tx) => {
      const updated = await tx.housekeepingTask.update({
        where: { id },
        data: { inspectedAt: new Date(), inspectedBy: inspectorEmployeeId },
        include: taskInclude,
      });
      await tx.room.updateMany({
        where: { id: task.roomId, status: { in: ['CLEANING', 'INSPECTED', 'DIRTY'] } },
        data: { status: 'AVAILABLE' },
      });
      return updated;
    });
  }
}

export const housekeepingService = new HousekeepingService();
