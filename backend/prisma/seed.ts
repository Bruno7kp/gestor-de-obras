import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const instanceName = process.env.ADMIN_INSTANCE_NAME || 'Instancia Principal';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@exemplo.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const isSuperAdmin =
    (process.env.ADMIN_IS_SUPERADMIN || 'true').toLowerCase() === 'true';

  // Create/ensure all permissions exist
  const permissionsList = [
    { code: 'biddings.view', description: 'View biddings' },
    { code: 'biddings.edit', description: 'Edit biddings' },
    { code: 'suppliers.view', description: 'View suppliers' },
    { code: 'suppliers.edit', description: 'Edit suppliers' },
    { code: 'projects.view', description: 'View projects list' },
    { code: 'projects.edit', description: 'Edit projects list' },
    {
      code: 'projects_general.view',
      description: 'View all projects in instance',
    },
    {
      code: 'projects_general.edit',
      description: 'Edit all projects in instance',
    },
    {
      code: 'projects_specific.view',
      description: 'View assigned projects only',
    },
    {
      code: 'projects_specific.edit',
      description: 'Edit assigned projects only',
    },
    { code: 'wbs.view', description: 'View WBS' },
    { code: 'wbs.edit', description: 'Edit WBS' },
    { code: 'technical_analysis.view', description: 'View technical analysis' },
    { code: 'technical_analysis.edit', description: 'Edit technical analysis' },
    { code: 'financial_flow.view', description: 'View financial flow' },
    { code: 'financial_flow.edit', description: 'Edit financial flow' },
    { code: 'supplies.view', description: 'View supplies' },
    { code: 'supplies.edit', description: 'Edit supplies' },
    { code: 'workforce.view', description: 'View workforce' },
    { code: 'workforce.edit', description: 'Edit workforce' },
    { code: 'planning.view', description: 'View planning' },
    { code: 'planning.edit', description: 'Edit planning' },
    { code: 'journal.view', description: 'View journal' },
    { code: 'journal.edit', description: 'Edit journal' },
    { code: 'documents.view', description: 'View documents' },
    { code: 'documents.edit', description: 'Edit documents' },
    { code: 'project_settings.view', description: 'View project settings' },
    { code: 'project_settings.edit', description: 'Edit project settings' },
    { code: 'global_settings.view', description: 'View global settings' },
    { code: 'global_settings.edit', description: 'Edit global settings' },
  ];

  const createdPermissions = await Promise.all(
    permissionsList.map((perm) =>
      prisma.permission.upsert({
        where: { code: perm.code },
        update: {},
        create: perm,
      }),
    ),
  );

  console.log('✓ Permissions created:', createdPermissions.length);

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

  const superAdminRole = await prisma.role.findFirst({
    where: { name: 'SUPER_ADMIN', instanceId: instance.id },
  });

  const userRole = await prisma.role.findFirst({
    where: { name: 'USER', instanceId: instance.id },
  });

  const ensuredAdminRole = adminRole
    ? adminRole
    : await prisma.role.create({
        data: {
          name: 'ADMIN',
          description: 'Administrador da instância',
          instanceId: instance.id,
        },
      });

  const ensuredSuperAdminRole = superAdminRole
    ? superAdminRole
    : await prisma.role.create({
        data: {
          name: 'SUPER_ADMIN',
          description: 'Administrador global',
          instanceId: instance.id,
        },
      });

  if (!userRole) {
    await prisma.role.create({
      data: {
        name: 'USER',
        description: 'Usuário padrão',
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

  if (isSuperAdmin) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: adminUser.id,
          roleId: ensuredSuperAdminRole.id,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        roleId: ensuredSuperAdminRole.id,
      },
    });
  }

  // Assign all permissions to ADMIN and SUPER_ADMIN roles
  const permissionIds = createdPermissions.map((p) => p.id);

  // ADMIN role permissions
  await Promise.all(
    permissionIds.map((permId) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: ensuredAdminRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: {
          roleId: ensuredAdminRole.id,
          permissionId: permId,
        },
      }),
    ),
  );

  // SUPER_ADMIN role permissions
  await Promise.all(
    permissionIds.map((permId) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: ensuredSuperAdminRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: {
          roleId: ensuredSuperAdminRole.id,
          permissionId: permId,
        },
      }),
    ),
  );

  console.log('Seed concluido:', {
    instanceId: instance.id,
    adminEmail,
    isSuperAdmin,
    permissionsAssigned: permissionIds.length * 2,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
