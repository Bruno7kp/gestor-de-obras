import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DEFAULT_ROLES, buildPermissionCodes } from './default-roles';

interface CreateRoleInput {
  instanceId: string;
  name: string;
  description?: string;
}

interface UpdateRoleInput extends Partial<CreateRoleInput> {
  id: string;
}

interface AddPermissionInput {
  roleId: string;
  instanceId: string;
  code: string;
  description?: string;
}

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(instanceId: string) {
    return this.prisma.role.findMany({
      where: { instanceId },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async create(input: CreateRoleInput) {
    const created = await this.prisma.role.create({
      data: {
        name: input.name,
        description: input.description || null,
        instanceId: input.instanceId,
      },
    });

    void this.auditService.log({
      instanceId: input.instanceId,
      action: 'CREATE',
      model: 'Role',
      entityId: created.id,
      after: JSON.parse(JSON.stringify(created)) as Record<string, unknown>,
    });

    return created;
  }

  async update(input: UpdateRoleInput) {
    const existing = await this.prisma.role.findFirst({
      where: { id: input.id, instanceId: input.instanceId },
    });
    if (!existing) throw new NotFoundException('Role nao encontrada');

    return this.prisma.role
      .update({
        where: { id: input.id },
        data: {
          name: input.name ?? existing.name,
          description: input.description ?? existing.description,
        },
      })
      .then((updated) => {
        void this.auditService.log({
          instanceId: input.instanceId!,
          action: 'UPDATE',
          model: 'Role',
          entityId: input.id,
          before: JSON.parse(JSON.stringify(existing)) as Record<
            string,
            unknown
          >,
          after: JSON.parse(JSON.stringify(updated)) as Record<string, unknown>,
        });
        return updated;
      });
  }

  async remove(id: string, instanceId: string) {
    const existing = await this.prisma.role.findFirst({
      where: { id, instanceId },
      include: { permissions: true, users: true },
    });
    if (!existing) throw new NotFoundException('Role nao encontrada');

    await this.prisma.rolePermission.deleteMany({
      where: { roleId: id },
    });

    await this.prisma.userRole.deleteMany({
      where: { roleId: id },
    });

    await this.prisma.role.delete({ where: { id } });

    void this.auditService.log({
      instanceId,
      action: 'DELETE',
      model: 'Role',
      entityId: id,
      before: {
        name: existing.name,
        description: existing.description,
      } as Record<string, unknown>,
    });

    return { deleted: 1 };
  }

  async addPermission(input: AddPermissionInput) {
    const role = await this.prisma.role.findFirst({
      where: { id: input.roleId, instanceId: input.instanceId },
    });
    if (!role) throw new NotFoundException('Role nao encontrada');

    const permission = await this.prisma.permission.upsert({
      where: { code: input.code },
      update: { description: input.description ?? undefined },
      create: {
        code: input.code,
        description: input.description || null,
      },
    });

    await this.prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });

    return this.prisma.role.findUnique({
      where: { id: role.id },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async removePermission(
    roleId: string,
    permissionId: string,
    instanceId: string,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, instanceId },
    });
    if (!role) throw new NotFoundException('Role nao encontrada');

    await this.prisma.rolePermission.deleteMany({
      where: { roleId, permissionId },
    });

    return { deleted: 1 };
  }

  async setPermissions(roleId: string, instanceId: string, codes: string[]) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, instanceId },
    });
    if (!role) throw new NotFoundException('Role nao encontrada');

    const beforeRole = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
    const beforeCodes = (beforeRole?.permissions ?? []).map(
      (rp) => rp.permission.code,
    );

    const uniqueCodes = Array.from(new Set(codes));
    if (uniqueCodes.length === 0) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId } });
      return this.prisma.role.findUnique({
        where: { id: roleId },
        include: { permissions: { include: { permission: true } } },
      });
    }

    const permissions = await Promise.all(
      uniqueCodes.map((code) =>
        this.prisma.permission.upsert({
          where: { code },
          update: {},
          create: { code },
        }),
      ),
    );

    await this.prisma.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId: {
          notIn: permissions.map((permission) => permission.id),
        },
      },
    });

    await Promise.all(
      permissions.map((permission) =>
        this.prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId,
            permissionId: permission.id,
          },
        }),
      ),
    );

    return this.prisma.role
      .findUnique({
        where: { id: roleId },
        include: { permissions: { include: { permission: true } } },
      })
      .then((result) => {
        void this.auditService.log({
          instanceId,
          action: 'UPDATE',
          model: 'Role',
          entityId: roleId,
          before: { permissions: beforeCodes } as Record<string, unknown>,
          after: {
            permissions: (result?.permissions ?? []).map(
              (rp) => rp.permission.code,
            ),
          } as Record<string, unknown>,
          metadata: { operation: 'setPermissions' } as Record<string, unknown>,
        });
        return result;
      });
  }

  async seedDefaultRoles(instanceId: string) {
    const existing = await this.prisma.role.findMany({
      where: {
        instanceId,
        name: { in: DEFAULT_ROLES.map((role) => role.name) },
      },
    });

    const existingNames = new Set(existing.map((role) => role.name));

    for (const definition of DEFAULT_ROLES) {
      if (existingNames.has(definition.name)) continue;

      const created = await this.prisma.role.create({
        data: {
          name: definition.name,
          description: definition.description ?? null,
          instanceId,
        },
      });

      const codes = buildPermissionCodes(definition.access);
      if (codes.length > 0) {
        await this.setPermissions(created.id, instanceId, codes);
      }
    }

    return this.findAll(instanceId);
  }

  async resetToDefaults(instanceId: string) {
    const systemRoles = ['ADMIN', 'SUPER_ADMIN'];
    const rolesToRemove = await this.prisma.role.findMany({
      where: {
        instanceId,
        name: { notIn: systemRoles },
      },
      select: { id: true },
    });

    const roleIds = rolesToRemove.map((role) => role.id);

    if (roleIds.length > 0) {
      await this.prisma.rolePermission.deleteMany({
        where: { roleId: { in: roleIds } },
      });

      await this.prisma.userRole.deleteMany({
        where: { roleId: { in: roleIds } },
      });

      await this.prisma.role.deleteMany({
        where: { id: { in: roleIds } },
      });
    }

    return this.seedDefaultRoles(instanceId);
  }
}
