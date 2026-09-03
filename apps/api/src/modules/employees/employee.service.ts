import { Prisma, prisma } from '@innsight/database';
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  ListEmployeesQuery,
  PaginationMeta,
} from '@innsight/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/app-error.js';
import { toSkipTake, buildPaginationMeta } from '../../shared/http/pagination.js';

const employeeInclude = {
  user: { select: { id: true, email: true } },
} satisfies Prisma.EmployeeInclude;
export type EmployeeDTO = Prisma.EmployeeGetPayload<{ include: typeof employeeInclude }>;

export class EmployeeService {
  /** A linked user must belong to the tenant and not already be attached elsewhere. */
  private async assertUserLinkable(hotelId: string, userId: string, excludeEmployeeId?: string): Promise<void> {
    const user = await prisma.user.findFirst({ where: { id: userId, hotelId }, select: { id: true } });
    if (!user) throw new ValidationError('User does not exist for this hotel');
    const linked = await prisma.employee.findFirst({
      where: { userId, ...(excludeEmployeeId ? { id: { not: excludeEmployeeId } } : {}) },
      select: { id: true },
    });
    if (linked) throw new ConflictError('User is already linked to another employee');
  }

  async list(hotelId: string, query: ListEmployeesQuery): Promise<{ items: EmployeeDTO[]; meta: PaginationMeta }> {
    const { page, limit, search, sortOrder, department, isActive } = query;
    const where: Prisma.EmployeeWhereInput = {
      hotelId,
      ...(department ? { department } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { position: { contains: search } },
              { employeeCode: { contains: search } },
            ],
          }
        : {}),
    };
    const { skip, take } = toSkipTake(page, limit);
    const [items, total] = await prisma.$transaction([
      prisma.employee.findMany({ where, include: employeeInclude, orderBy: { createdAt: sortOrder }, skip, take }),
      prisma.employee.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  async getById(hotelId: string, id: string): Promise<EmployeeDTO> {
    const employee = await prisma.employee.findFirst({ where: { id, hotelId }, include: employeeInclude });
    if (!employee) throw new NotFoundError('Employee not found');
    return employee;
  }

  async create(hotelId: string, input: CreateEmployeeInput): Promise<EmployeeDTO> {
    if (input.userId) await this.assertUserLinkable(hotelId, input.userId);
    return prisma.employee.create({
      data: {
        hotelId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        department: input.department,
        position: input.position,
        employeeCode: input.employeeCode ?? null,
        dateOfJoining: new Date(input.dateOfJoining),
        emergencyContact: input.emergencyContact ?? null,
        emergencyPhone: input.emergencyPhone ?? null,
        userId: input.userId ?? null,
      },
      include: employeeInclude,
    });
  }

  async update(hotelId: string, id: string, input: UpdateEmployeeInput): Promise<EmployeeDTO> {
    await this.getById(hotelId, id);
    if (input.userId) await this.assertUserLinkable(hotelId, input.userId, id);

    const data: Prisma.EmployeeUpdateInput = {};
    if (input.firstName !== undefined) data.firstName = input.firstName;
    if (input.lastName !== undefined) data.lastName = input.lastName;
    if (input.email !== undefined) data.email = input.email;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.department !== undefined) data.department = input.department;
    if (input.position !== undefined) data.position = input.position;
    if (input.employeeCode !== undefined) data.employeeCode = input.employeeCode;
    if (input.dateOfJoining !== undefined) data.dateOfJoining = new Date(input.dateOfJoining);
    if (input.emergencyContact !== undefined) data.emergencyContact = input.emergencyContact;
    if (input.emergencyPhone !== undefined) data.emergencyPhone = input.emergencyPhone;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.userId !== undefined) {
      data.user = input.userId ? { connect: { id: input.userId } } : { disconnect: true };
    }

    return prisma.employee.update({ where: { id }, data, include: employeeInclude });
  }

  async remove(hotelId: string, id: string): Promise<void> {
    await this.getById(hotelId, id);
    await prisma.employee.update({ where: { id }, data: { isActive: false } });
  }
}

export const employeeService = new EmployeeService();
