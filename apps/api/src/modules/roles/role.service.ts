import { Prisma, prisma } from '@innsight/database';
import type { CreateRoleInput, UpdateRoleInput, ListRolesQuery, PaginationMeta } from '@innsight/shared';
import { SYSTEM_ROLES } from '@innsight/shared';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/app-error.js';
import { toSkipTake, buildPaginationMeta } from '../../shared/http/pagination.js';

const RESERVED_ROLE_NAMES = new Set<string>(Object.values(SYSTEM_ROLES));

export interface RoleDTO {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedRoles {
  items: RoleDTO[];
  meta: PaginationMeta;
}

type RoleWithRelations = Prisma.RoleGetPayload<{
  include: { permissions: { include: { permission: true } }; _count: { select: { users: true } } };
}>;

const roleInclude = {
  permissions: { include: { permission: true } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleInclude;

export class RoleService {
  private toDTO(role: RoleWithRelations): RoleDTO {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions.map((rp) => `${rp.permission.module}:${rp.permission.action}`),
      userCount: role._count.users,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  /** Resolve permission keys ("module:action") to their global Permission row ids. */
  private async resolvePermissionIds(keys: string[]): Promise<string[]> {
    const pairs = keys.map((key) => {
      const [module, action] = key.split(':');
      return { module: module ?? '', action: action ?? '' };
    });

    const permissions = await prisma.permission.findMany({
      where: { OR: pairs },
      select: { id: true, module: true, action: true },
    });

    if (permissions.length !== new Set(keys).size) {
      throw new ValidationError('One or more permissions are not registered');
    }
    return permissions.map((p) => p.id);
  }

  async list(hotelId: string, query: ListRolesQuery): Promise<PaginatedRoles> {
    const { page, limit, search, sortOrder } = query;
    const where: Prisma.RoleWhereInput = {
      hotelId,
      ...(search ? { name: { contains: search } } : {}),
    };

    const { skip, take } = toSkipTake(page, limit);
    const [rows, total] = await prisma.$transaction([
      prisma.role.findMany({ where, include: roleInclude, orderBy: { name: sortOrder }, skip, take }),
      prisma.role.count({ where }),
    ]);

    return { items: rows.map((r) => this.toDTO(r)), meta: buildPaginationMeta(page, limit, total) };
  }

  async getById(hotelId: string, id: string): Promise<RoleDTO> {
    const role = await prisma.role.findFirst({ where: { id, hotelId }, include: roleInclude });
    if (!role) {
      throw new NotFoundError('Role not found');
    }
    return this.toDTO(role);
  }

  async create(hotelId: string, input: CreateRoleInput, actorPermissions: string[], actorIsSuperAdmin: boolean = false): Promise<RoleDTO> {
    if (RESERVED_ROLE_NAMES.has(input.name)) {
      throw new ConflictError('This name is reserved for a system role');
    }

    const duplicate = await prisma.role.findFirst({
      where: { hotelId, name: input.name },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictError('A role with this name already exists');
    }

    if (!actorIsSuperAdmin) {
      const granted = new Set(actorPermissions);
      const missing = input.permissions.filter((p) => !granted.has(p));
      if (missing.length > 0) {
        throw new ForbiddenError(`Cannot grant permission(s) you do not hold: ${missing.join(', ')}`);
      }
    }

    const permissionIds = await this.resolvePermissionIds(input.permissions);

    const role = await prisma.role.create({
      data: {
        hotelId,
        name: input.name,
        description: input.description ?? null,
        isSystem: false,
        permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
      },
      include: roleInclude,
    });
    return this.toDTO(role);
  }

  async update(hotelId: string, id: string, input: UpdateRoleInput, actorPermissions: string[], actorIsSuperAdmin: boolean = false): Promise<RoleDTO> {
    const role = await prisma.role.findFirst({ where: { id, hotelId }, select: { id: true, isSystem: true } });
    if (!role) {
      throw new NotFoundError('Role not found');
    }
    if (role.isSystem) {
      throw new ForbiddenError('System roles cannot be modified');
    }

    if (input.name !== undefined && RESERVED_ROLE_NAMES.has(input.name)) {
      throw new ConflictError('This name is reserved for a system role');
    }

    const data: Prisma.RoleUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;

    // Replace the permission set atomically when provided.
    const permissionIds =
      input.permissions !== undefined ? await this.resolvePermissionIds(input.permissions) : null;

    if (permissionIds && !actorIsSuperAdmin) {
      const granted = new Set(actorPermissions);
      const missing = input.permissions!.filter((p) => !granted.has(p));
      if (missing.length > 0) {
        throw new ForbiddenError(`Cannot grant permission(s) you do not hold: ${missing.join(', ')}`);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
        });
      }
      return tx.role.update({ where: { id }, data, include: roleInclude });
    });

    return this.toDTO(updated);
  }

  async remove(hotelId: string, id: string): Promise<void> {
    const role = await prisma.role.findFirst({
      where: { id, hotelId },
      select: { id: true, isSystem: true, _count: { select: { users: true } } },
    });
    if (!role) {
      throw new NotFoundError('Role not found');
    }
    if (role.isSystem) {
      throw new ForbiddenError('System roles cannot be deleted');
    }
    if (role._count.users > 0) {
      throw new ConflictError('Cannot delete a role that still has users assigned');
    }

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      prisma.role.delete({ where: { id } }),
    ]);
  }
}

export const roleService = new RoleService();
