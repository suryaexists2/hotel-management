import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
const prisma = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash('Admin@12345', 12);
  await prisma.user.update({
    where: { email: 'admin@innsight.io' },
    data: { passwordHash: hash, status: 'ACTIVE' },
  });
  const u = await prisma.user.findUnique({ where: { email: 'admin@innsight.io' }, select: { email: true, status: true, passwordHash: true } });
  console.log(JSON.stringify({ email: u?.email, hash: u?.passwordHash?.substring(0,20)+'...', status: u?.status }));
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
