import { PrismaClient } from '@prisma/client';
import { Role } from '@vsp/shared';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  console.log('Seeding database...');

  // Clean existing users
  await prisma.user.deleteMany({});

  const adminPasswordHash = hashPassword('AdminPass123!');
  const agentPasswordHash = hashPassword('AgentPass123!');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@vsp.com' },
    update: {},
    create: {
      email: 'admin@vsp.com',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: 'agent@vsp.com' },
    update: {},
    create: {
      email: 'agent@vsp.com',
      passwordHash: agentPasswordHash,
      role: Role.AGENT,
    },
  });

  console.log('Seed completed successfully.');
  console.log(`Admin account created: ${admin.email}`);
  console.log(`Agent account created: ${agent.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
