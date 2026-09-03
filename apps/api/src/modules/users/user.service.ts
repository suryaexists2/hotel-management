import { Prisma, prisma } from '@innsight/database';
import type {
  CreateUserInput,
  UpdateUserInput,
  ListUsersQuery,
  ChangePasswordInput,
} from '@innsight/shared';
import { SYSTEM_ROLES } from '@innsight/shared';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors/app-error.js';
import { toSkipTake, buildPaginationMeta } from '../../shared/http/pagination.js';
import type { PaginationMeta } from '@innsight/shared';
import { passwordService } from '../auth/password.service.js';

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  status: true,
  hotelId: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true, isSystem: true } },
} satisfies Prisma.UserSelect;

export type UserDTO = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export interface PaginatedUsers {
  items: UserDTO[];
  meta: PaginationMeta;
}

/**
 * User administration, always scoped to the acting user's hotel (tenant isolation).
 * Guards privilege escalation: assigning the SUPER_ADMIN system role, and mutating
 * super-admin accounts, require the actor to be a super-admin.
 */
export class UserService {
  /** Load a role that must belong to the tenant, returning its escalation metadata. */
  private async resolveRole(
    hotelId: string,
    roleId: string,
  ): Promise<{ id: string; isSuperAdminRole: boolean }> {
    const role = await prisma.role.findFirst({
      where: { id: roleId, hotelId },
      select: { id: true, name: true, isSystem: true },
    });
    if (!role) {
      throw new ValidationError('Role does not exist for this hotel');
    }
    return { id: role.id, isSuperAdminRole: role.isSystem && role.name === SYSTEM_ROLES.SUPER_ADMIN };
  }

  async list(hotelId: string, query: ListUsersQuery): Promise<PaginatedUsers> {
    const { page, limit, search, sortOrder, status, roleId } = query;

    const where: Prisma.UserWhereInput = {
      hotelId,
      ...(status ? { status } : {}),
      ...(roleId ? { roleId } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : {}),
    };

    const { skip, take } = toSkipTake(page, limit);
    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({ where, select: userSelect, orderBy: { createdAt: sortOrder }, skip, take }),
      prisma.user.count({ where }),
    ]);

    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  async getById(hotelId: string, id: string): Promise<UserDTO> {
    const user = await prisma.user.findFirst({ where: { id, hotelId }, select: userSelect });
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  async create(
    hotelId: string,
    actorIsSuperAdmin: boolean,
    input: CreateUserInput,
  ): Promise<UserDTO> {
    const role = await this.resolveRole(hotelId, input.roleId);
    if (role.isSuperAdminRole && !actorIsSuperAdmin) {
      throw new ForbiddenError('Only a super-admin can assign the super-admin role');
    }

    const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) {
      throw new ConflictError('A user with this email already exists');
    }

    const passwordHash = await passwordService.hash(input.password);

    return prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        hotelId,
        roleId: role.id,
      },
      select: userSelect,
    });
  }

  async update(
    hotelId: string,
    actorId: string,
    actorIsSuperAdmin: boolean,
    id: string,
    input: UpdateUserInput,
  ): Promise<UserDTO> {
    const target = await prisma.user.findFirst({
      where: { id, hotelId },
      select: { id: true, role: { select: { name: true, isSystem: true } } },
    });
    if (!target) {
      throw new NotFoundError('User not found');
    }

    const targetIsSuperAdmin =
      target.role.isSystem && target.role.name === SYSTEM_ROLES.SUPER_ADMIN;
    if (targetIsSuperAdmin && !actorIsSuperAdmin) {
      throw new ForbiddenError('Only a super-admin can modify a super-admin account');
    }

    const data: Prisma.UserUpdateInput = {};
    if (input.firstName !== undefined) data.firstName = input.firstName;
    if (input.lastName !== undefined) data.lastName = input.lastName;
    if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl;

    if (input.roleId !== undefined) {
      if (id === actorId) {
        throw new ForbiddenError('You cannot change your own role');
      }
      const role = await this.resolveRole(hotelId, input.roleId);
      if (role.isSuperAdminRole && !actorIsSuperAdmin) {
        throw new ForbiddenError('Only a super-admin can assign the super-admin role');
      }
      data.role = { connect: { id: role.id } };
    }

    if (input.status !== undefined) {
      if (id === actorId && input.status !== 'ACTIVE') {
        throw new ForbiddenError('You cannot deactivate your own account');
      }
      data.status = input.status;
      // Revoking sessions when an account leaves ACTIVE enforces the change immediately.
      if (input.status !== 'ACTIVE') {
        await this.revokeSessions(id);
      }
    }

    return prisma.user.update({ where: { id }, data, select: userSelect });
  }

  async deactivate(hotelId: string, actorId: string, actorIsSuperAdmin: boolean, id: string): Promise<UserDTO> {
    if (id === actorId) {
      throw new ForbiddenError('You cannot deactivate your own account');
    }
    const target = await prisma.user.findFirst({
      where: { id, hotelId },
      select: { id: true, role: { select: { name: true, isSystem: true } } },
    });
    if (!target) {
      throw new NotFoundError('User not found');
    }
    const targetIsSuperAdmin = target.role.isSystem && target.role.name === SYSTEM_ROLES.SUPER_ADMIN;
    if (targetIsSuperAdmin && !actorIsSuperAdmin) {
      throw new ForbiddenError('Only a super-admin can deactivate a super-admin account');
    }
    await this.revokeSessions(id);
    return prisma.user.update({ where: { id }, data: { status: 'INACTIVE' }, select: userSelect });
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const matches = await passwordService.compare(input.currentPassword, user.passwordHash);
    if (!matches) {
      throw new ValidationError('Current password is incorrect');
    }

    const passwordHash = await passwordService.hash(input.newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    // Force other sessions to re-authenticate with the new credential.
    await this.revokeSessions(userId);
  }

  private async revokeSessions(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export const userService = new UserService();
