import { Prisma, prisma } from '@innsight/database';
import type {
  CreateMaintenanceOrderInput,
  UpdateMaintenanceOrderInput,
  UpdateMaintenanceStatusInput,
  ListMaintenanceQuery,
  PaginationMeta,
} from '@innsight/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/app-error.js';
import { toSkipTake, buildPaginationMeta } from '../../shared/http/pagination.js';

const orderInclude = {
  room: { select: { id: true, roomNumber: true, floor: true } },
  assignedEmployee: { select: { id: true, firstName: true, lastName: true } },
  reportingEmployee: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.MaintenanceOrderInclude;
export type MaintenanceOrderDTO = Prisma.MaintenanceOrderGetPayload<{ include: typeof orderInclude }>;

const MT_STATUS_FLOW: Record<string, string[]> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export class MaintenanceService {
  private async assertRoomOwned(hotelId: string, roomId: string): Promise<void> {
    const room = await prisma.room.findFirst({ where: { id: roomId, hotelId }, select: { id: true } });
    if (!room) throw new ValidationError('Room does not exist for this hotel');
  }

  private async assertEmployeeOwned(hotelId: string, employeeId: string): Promise<void> {
    const emp = await prisma.employee.findFirst({ where: { id: employeeId, hotelId }, select: { id: true } });
    if (!emp) throw new ValidationError('Employee does not exist for this hotel');
  }

  /** Resolve the reporter: explicit employee id, else the acting user's linked employee. */
  private async resolveReporter(hotelId: string, explicitId: string | undefined, actorUserId: string): Promise<string> {
    if (explicitId) {
      await this.assertEmployeeOwned(hotelId, explicitId);
      return explicitId;
    }
    const emp = await prisma.employee.findFirst({ where: { hotelId, userId: actorUserId }, select: { id: true } });
    if (emp) {
      return emp.id;
    }
    const user = await prisma.user.findFirst({ where: { id: actorUserId, hotelId }, select: { firstName: true, lastName: true, email: true } });
    if (!user) throw new ValidationError('User not found');
    const newEmp = await prisma.employee.create({
      data: {
        hotelId,
        userId: actorUserId,
        firstName: user.firstName,
        lastName: user.lastName ?? 'Employee',
        email: user.email,
        position: 'MANAGEMENT',
        department: 'ADMIN',
        dateOfJoining: new Date(),
      },
    });
    return newEmp.id;
  }

  async list(hotelId: string, query: ListMaintenanceQuery): Promise<{ items: MaintenanceOrderDTO[]; meta: PaginationMeta }> {
    const { page, limit, search, status, priority, assignedTo, roomId, sortOrder } = query;
    const where: Prisma.MaintenanceOrderWhereInput = {
      hotelId,
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(assignedTo ? { assignedTo } : {}),
      ...(roomId ? { roomId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search } },
              { description: { contains: search } },
            ],
          }
        : {}),
    };
    const { skip, take } = toSkipTake(page, limit);
    const [items, total] = await prisma.$transaction([
      prisma.maintenanceOrder.findMany({
        where,
        include: orderInclude,
        orderBy: [{ priority: 'asc' }, { createdAt: sortOrder }],
        skip,
        take,
      }),
      prisma.maintenanceOrder.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  async getById(hotelId: string, id: string): Promise<MaintenanceOrderDTO> {
    const order = await prisma.maintenanceOrder.findFirst({ where: { id, hotelId }, include: orderInclude });
    if (!order) throw new NotFoundError('Maintenance order not found');
    return order;
  }

  async create(hotelId: string, actorUserId: string, input: CreateMaintenanceOrderInput): Promise<MaintenanceOrderDTO> {
    if (input.roomId) await this.assertRoomOwned(hotelId, input.roomId);
    if (input.assignedTo) await this.assertEmployeeOwned(hotelId, input.assignedTo);
    const reportedBy = await this.resolveReporter(hotelId, input.reportedById ?? undefined, actorUserId);

    return prisma.maintenanceOrder.create({
      data: {
        hotelId,
        roomId: input.roomId ?? null,
        title: input.title,
        description: input.description,
        priority: input.priority,
        assignedTo: input.assignedTo ?? null,
        reportedBy,
        estimatedCost: input.estimatedCost != null ? new Prisma.Decimal(input.estimatedCost) : null,
        scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : null,
      },
      include: orderInclude,
    });
  }

  async update(hotelId: string, id: string, input: UpdateMaintenanceOrderInput): Promise<MaintenanceOrderDTO> {
    await this.getById(hotelId, id);
    if (input.assignedTo) await this.assertEmployeeOwned(hotelId, input.assignedTo);

    const data: Prisma.MaintenanceOrderUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.estimatedCost !== undefined)
      data.estimatedCost = input.estimatedCost === null ? null : new Prisma.Decimal(input.estimatedCost);
    if (input.actualCost !== undefined)
      data.actualCost = input.actualCost === null ? null : new Prisma.Decimal(input.actualCost);
    if (input.scheduledDate !== undefined)
      data.scheduledDate = input.scheduledDate ? new Date(input.scheduledDate) : null;
    if (input.images !== undefined) data.images = JSON.stringify(input.images) as any;
    if (input.assignedTo !== undefined) {
      data.assignedEmployee = input.assignedTo ? { connect: { id: input.assignedTo } } : { disconnect: true };
    }
    return prisma.maintenanceOrder.update({ where: { id }, data, include: orderInclude });
  }

  /** Status lifecycle with timestamps; COMPLETED requires a resolution note. */
  async updateStatus(hotelId: string, id: string, input: UpdateMaintenanceStatusInput): Promise<MaintenanceOrderDTO> {
    const order = await this.getById(hotelId, id);
    const allowed = MT_STATUS_FLOW[order.status];
    if (allowed && !allowed.includes(input.status)) {
      throw new ValidationError(`Cannot transition from ${order.status} to ${input.status}`);
    }
    const now = new Date();
    const data: Prisma.MaintenanceOrderUpdateInput = { status: input.status };
    if (input.resolution !== undefined) data.resolution = input.resolution;

    if (input.status === 'IN_PROGRESS') {
      data.startedAt = now;
    } else if (input.status === 'COMPLETED') {
      if (!input.resolution) throw new ValidationError('A resolution note is required to complete an order');
      data.completedAt = now;
    }
    return prisma.maintenanceOrder.update({ where: { id }, data, include: orderInclude });
  }

  async remove(hotelId: string, id: string): Promise<void> {
    const order = await prisma.maintenanceOrder.findFirst({ where: { id, hotelId }, select: { id: true, status: true } });
    if (!order) throw new NotFoundError('Maintenance order not found');
    if (order.status === 'IN_PROGRESS') throw new ConflictError('Cannot delete an in-progress order');
    await prisma.maintenanceOrder.delete({ where: { id } });
  }
}

export const maintenanceService = new MaintenanceService();
