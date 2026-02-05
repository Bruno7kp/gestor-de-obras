import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

  findAll(instanceId: string) {
    return this.prisma.role.findMany({
      where: { instanceId },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async create(input: CreateRoleInput) {
    return this.prisma.role.create({
      data: {
        name: input.name,
        description: input.description || null,
        instanceId: input.instanceId,
      },
    });
  }

  async update(input: UpdateRoleInput) {
    const existing = await this.prisma.role.findFirst({
      where: { id: input.id, instanceId: input.instanceId },
    });
    if (!existing) throw new NotFoundException('Role nao encontrada');

    return this.prisma.role.update({
      where: { id: input.id },
      data: {
        name: input.name ?? existing.name,
        description: input.description ?? existing.description,
      },
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

  async removePermission(roleId: string, permissionId: string, instanceId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, instanceId },
    });
    if (!role) throw new NotFoundException('Role nao encontrada');

    await this.prisma.rolePermission.deleteMany({
      where: { roleId, permissionId },
    });

    return { deleted: 1 };
  }
}
