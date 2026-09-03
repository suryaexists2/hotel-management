import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { prisma, Prisma } from '@innsight/database';
import { PERMISSIONS } from '@innsight/shared';
import type { Express } from 'express';

const TEST_PASSWORD = 'TestPass123!';

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

function uid(): string {
  return crypto.randomUUID().slice(0, 8);
}

export async function createTestHotel(): Promise<{ id: string; currency: string }> {
  const slug = `test-hotel-${uid()}`;
  const email = `hotel-${uid()}@test.com`;

  const hotel = await prisma.hotel.create({
    data: {
      name: `Test Hotel ${uid()}`,
      slug,
      address: '123 Test Street',
      city: 'Test City',
      state: 'TS',
      country: 'Test Country',
      phone: '+1-555-0000',
      email,
      currency: 'USD',
      currencySymbol: '$',
    },
  });

  await prisma.hotelSettings.create({
    data: {
      hotelId: hotel.id,
      defaultTaxRate: new Prisma.Decimal('0.10'),
    },
  });

  return { id: hotel.id, currency: 'USD' };
}

export async function createAllPermissions(): Promise<Array<{ id: string }>> {
  const perms: Array<{ id: string }> = [];

  for (const module of Object.values(PERMISSIONS)) {
    for (const permValue of Object.values(module)) {
      const [mod, action] = (permValue as string).split(':');
      const perm = await prisma.permission.upsert({
        where: { module_action: { module: mod!, action: action! } },
        update: {},
        create: { module: mod!, action: action!, description: permValue as string },
      });
      perms.push(perm);
    }
  }

  return perms;
}

export async function createTestRole(
  hotelId: string,
  permissions: Array<{ id: string }>,
): Promise<{ id: string }> {
  const role = await prisma.role.create({
    data: {
      name: `TEST_ROLE_${uid()}`,
      description: 'Test role with full permissions',
      isSystem: false,
      hotelId,
    },
  });

  if (permissions.length > 0) {
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
  }

  return { id: role.id };
}

export async function createTestUser(
  hotelId: string,
  roleId: string,
  overrides?: Partial<{ email: string; firstName: string; lastName: string }>,
): Promise<{ id: string; email: string; password: string }> {
  const email = overrides?.email ?? `user-${uid()}@test.com`;
  const passwordHash = await hashPassword(TEST_PASSWORD);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: overrides?.firstName ?? 'Test',
      lastName: overrides?.lastName ?? 'User',
      status: 'ACTIVE',
      hotelId,
      roleId,
    },
  });

  return { id: user.id, email, password: TEST_PASSWORD };
}

import request from 'supertest';

export async function loginAs(
  app: Express,
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshCookie: string }> {
  const agent = request(app);
  const res = await agent.post('/api/v1/auth/login').send({ email, password });

  const cookies = (res.headers['set-cookie'] ?? []) as string[];
  const refreshCookie = cookies.find((c) => c.startsWith('refreshToken=')) ?? '';

  return { accessToken: res.body.data.accessToken, refreshCookie };
}

export async function createTestGuest(hotelId: string): Promise<{ id: string }> {
  return prisma.guest.create({
    data: {
      hotelId,
      firstName: 'John',
      lastName: 'Doe',
      email: `guest-${uid()}@test.com`,
      phone: '+1-555-1234',
    },
    select: { id: true },
  });
}

export async function createTestRoomType(
  hotelId: string,
  overrides?: Partial<{
    name: string;
    baseRate: number;
    maxOccupancy: number;
  }>,
): Promise<{ id: string; baseRate: Prisma.Decimal }> {
  const rt = await prisma.roomType.create({
    data: {
      hotelId,
      name: overrides?.name ?? `Deluxe Suite ${uid()}`,
      description: 'A test room type',
      baseRate: new Prisma.Decimal(overrides?.baseRate ?? 200),
      maxOccupancy: overrides?.maxOccupancy ?? 2,
      maxAdults: 2,
      maxChildren: 1,
    },
  });
  return { id: rt.id, baseRate: rt.baseRate };
}

export async function createTestRoom(
  hotelId: string,
  roomTypeId: string,
  overrides?: Partial<{ roomNumber: string; floor: number }>,
): Promise<{ id: string }> {
  return prisma.room.create({
    data: {
      hotelId,
      roomTypeId,
      roomNumber: overrides?.roomNumber ?? `${101 + Math.floor(Math.random() * 100)}`,
      floor: overrides?.floor ?? 1,
      status: 'AVAILABLE',
    },
    select: { id: true },
  });
}
