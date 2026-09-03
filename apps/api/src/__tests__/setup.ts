import app from '../app.js';
import { prisma } from '@innsight/database';
import request from 'supertest';
import type { Express } from 'express';

const supertest = request(app) as unknown as ReturnType<typeof request>;

export interface TestContext {
  app: Express;
  prisma: typeof prisma;
  supertest: typeof supertest;
}

export const testContext: TestContext = { app, prisma, supertest };

export async function cleanDatabase(): Promise<void> {
  await prisma.$transaction([
    prisma.invoice.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.folioCharge.deleteMany(),
    prisma.folio.deleteMany(),
    prisma.housekeepingTask.deleteMany(),
    prisma.maintenanceOrder.deleteMany(),
    prisma.reservation.deleteMany(),
    prisma.room.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.roomType.deleteMany(),
    prisma.guest.deleteMany(),
    prisma.role.deleteMany(),
    prisma.hotelSettings.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.hotel.deleteMany(),
  ]);
}
