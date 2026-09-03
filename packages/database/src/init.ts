import { PrismaClient } from '@prisma/client';

export async function initializeDatabase(dbPath: string): Promise<PrismaClient> {
  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${dbPath}` } },
  });

  await prisma.$connect();
  return prisma;
}
