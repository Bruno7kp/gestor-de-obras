import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const instanceName = process.env.ADMIN_INSTANCE_NAME || 'Instancia Principal';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@exemplo.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const existingInstance = await prisma.instance.findFirst({
    where: { name: instanceName },
  });

  const instance = existingInstance
    ? existingInstance
    : await prisma.instance.create({
        data: {
          name: instanceName,
          status: 'ACTIVE',
          globalSettings: {
            create: {
              defaultCompanyName: 'Sua Empresa de Engenharia',
              companyCnpj: '',
              userName: 'Administrador',
              language: 'pt-BR',
              currencySymbol: 'R$',
            },
          },
          subscription: {
            create: {
              plan: 'TRIAL',
              status: 'ACTIVE',
              startDate: new Date(),
              billingCycle: 'monthly',
            },
          },
        },
      });

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const adminRole = await prisma.role.findFirst({
    where: { name: 'ADMIN', instanceId: instance.id },
  });

  const userRole = await prisma.role.findFirst({
    where: { name: 'USER', instanceId: instance.id },
  });

  const ensuredAdminRole = adminRole
    ? adminRole
    : await prisma.role.create({
        data: {
          name: 'ADMIN',
          description: 'Administrador da instancia',
          instanceId: instance.id,
        },
      });

  if (!userRole) {
    await prisma.role.create({
      data: {
        name: 'USER',
        description: 'Usuario padrao',
        instanceId: instance.id,
      },
    });
  }

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'Administrador',
      email: adminEmail,
      passwordHash,
      status: 'ACTIVE',
      instanceId: instance.id,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: ensuredAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: ensuredAdminRole.id,
    },
  });

  console.log('Seed concluido:', { instanceId: instance.id, adminEmail });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
