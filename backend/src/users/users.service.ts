import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';

interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  status?: string;
  instanceId: string;
}

interface AssignRoleInput {
  userId: string;
  roleId: string;
  instanceId: string;
}

interface SetRolesInput {
  userId: string;
  roleIds: string[];
  instanceId: string;
}

interface UpdateSelfInput {
  userId: string;
  instanceId: string;
  name?: string;
  email?: string;
  profileImage?: string | null;
}

interface UpdatePasswordInput {
  userId: string;
  instanceId: string;
  currentPassword: string;
  newPassword: string;
}

interface UpdateUserInput {
  userId: string;
  instanceId: string;
  name?: string;
  email?: string;
  password?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateUserInput) {
    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        status: input.status || 'ACTIVE',
        instanceId: input.instanceId,
      },
    });

    await this.mailService.sendWelcomeEmail(user.email, user.name);

    void this.auditService.log({
      instanceId: input.instanceId,
      action: 'CREATE',
      model: 'User',
      entityId: user.id,
      after: {
        name: user.name,
        email: user.email,
        status: user.status,
      } as Record<string, unknown>,
    });

    return user;
  }

  findAll(instanceId: string) {
    return this.prisma.user.findMany({
      where: { instanceId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        instanceId: true,
        profileImage: true,
        roles: { include: { role: true } },
      },
    });
  }

  findById(id: string, instanceId: string) {
    return this.prisma.user.findFirst({
      where: { id, instanceId },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        instanceId: true,
        profileImage: true,
        roles: { include: { role: true } },
      },
    });
  }

  findByIdWithRoles(id: string, instanceId: string) {
    return this.prisma.user.findFirst({
      where: { id, instanceId },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        instanceId: true,
        profileImage: true,
        roles: { include: { role: true } },
      },
    });
  }

  async assignRole(input: AssignRoleInput) {
    const user = await this.prisma.user.findFirst({
      where: { id: input.userId, instanceId: input.instanceId },
    });

    if (!user) throw new NotFoundException('Usuario nao encontrado');

    const role = await this.prisma.role.findFirst({
      where: { id: input.roleId, instanceId: input.instanceId },
    });

    if (!role) throw new NotFoundException('Role nao encontrada');

    await this.prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: input.userId,
          roleId: input.roleId,
        },
      },
      update: {},
      create: {
        userId: input.userId,
        roleId: input.roleId,
      },
    });

    void this.auditService.log({
      instanceId: input.instanceId,
      userId: input.userId,
      action: 'UPDATE',
      model: 'User',
      entityId: input.userId,
      metadata: {
        operation: 'assignRole',
        roleId: input.roleId,
        roleName: role.name,
      } as Record<string, unknown>,
    });

    return this.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        instanceId: true,
        profileImage: true,
        roles: { include: { role: true } },
      },
    });
  }

  async setRoles(input: SetRolesInput) {
    const user = await this.prisma.user.findFirst({
      where: { id: input.userId, instanceId: input.instanceId },
    });

    if (!user) throw new NotFoundException('Usuario nao encontrado');

    const roles = await this.prisma.role.findMany({
      where: {
        id: { in: input.roleIds },
        instanceId: input.instanceId,
      },
    });

    if (roles.length !== input.roleIds.length) {
      throw new NotFoundException('Role nao encontrada');
    }

    await this.prisma.userRole.deleteMany({
      where: { userId: input.userId },
    });

    if (input.roleIds.length > 0) {
      await this.prisma.userRole.createMany({
        data: input.roleIds.map((roleId) => ({
          userId: input.userId,
          roleId,
        })),
      });
    }

    void this.auditService.log({
      instanceId: input.instanceId,
      userId: input.userId,
      action: 'UPDATE',
      model: 'User',
      entityId: input.userId,
      metadata: {
        operation: 'setRoles',
        roleIds: input.roleIds,
      } as Record<string, unknown>,
    });

    return this.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        instanceId: true,
        profileImage: true,
        roles: { include: { role: true } },
      },
    });
  }

  async resolveRoleNames(roleIds: string[], instanceId: string) {
    const roles = await this.prisma.role.findMany({
      where: {
        id: { in: roleIds },
        instanceId,
      },
      select: { name: true },
    });

    return roles.map((role) => role.name);
  }

  async updateSelf(input: UpdateSelfInput) {
    const existing = await this.prisma.user.findFirst({
      where: { id: input.userId, instanceId: input.instanceId },
    });

    if (!existing) throw new NotFoundException('Usuario nao encontrado');

    const updated = await this.prisma.user.update({
      where: { id: input.userId },
      data: {
        name: input.name ?? existing.name,
        email: input.email ?? existing.email,
        profileImage:
          input.profileImage !== undefined
            ? input.profileImage
            : existing.profileImage,
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        instanceId: true,
        profileImage: true,
        roles: { include: { role: true } },
      },
    });

    void this.auditService.log({
      instanceId: input.instanceId,
      userId: input.userId,
      action: 'UPDATE',
      model: 'User',
      entityId: input.userId,
      before: {
        name: existing.name,
        email: existing.email,
      } as Record<string, unknown>,
      after: {
        name: updated.name,
        email: updated.email,
      } as Record<string, unknown>,
    });

    return updated;
  }

  async updatePassword(input: UpdatePasswordInput) {
    const existing = await this.prisma.user.findFirst({
      where: { id: input.userId, instanceId: input.instanceId },
    });

    if (!existing) throw new NotFoundException('Usuario nao encontrado');

    const passwordValid = await bcrypt.compare(
      input.currentPassword,
      existing.passwordHash,
    );

    if (!passwordValid) {
      throw new BadRequestException('Senha atual invalida');
    }

    const newHash = await bcrypt.hash(input.newPassword, 10);

    await this.prisma.user.update({
      where: { id: input.userId },
      data: { passwordHash: newHash },
    });

    void this.auditService.log({
      instanceId: input.instanceId,
      userId: input.userId,
      action: 'UPDATE',
      model: 'User',
      entityId: input.userId,
      metadata: { operation: 'passwordChange' } as Record<string, unknown>,
    });

    return { ok: true };
  }

  async listRoles(userId: string, instanceId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, instanceId },
      include: { roles: { include: { role: true } } },
    });

    if (!user) throw new NotFoundException('Usuario nao encontrado');

    return user.roles.map((entry) => entry.role);
  }

  async updateUser(input: UpdateUserInput) {
    const existing = await this.prisma.user.findFirst({
      where: { id: input.userId, instanceId: input.instanceId },
    });

    if (!existing) throw new NotFoundException('Usuario nao encontrado');

    const updateData: {
      name?: string;
      email?: string;
      passwordHash?: string;
    } = {};

    if (input.name !== undefined) {
      updateData.name = input.name;
    }

    if (input.email !== undefined) {
      updateData.email = input.email;
    }

    if (input.password) {
      updateData.passwordHash = await bcrypt.hash(input.password, 10);
    }

    return this.prisma.user
      .update({
        where: { id: input.userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          createdAt: true,
          instanceId: true,
          profileImage: true,
          roles: { include: { role: true } },
        },
      })
      .then((updated) => {
        void this.auditService.log({
          instanceId: input.instanceId,
          userId: input.userId,
          action: 'UPDATE',
          model: 'User',
          entityId: input.userId,
          before: {
            name: existing.name,
            email: existing.email,
          } as Record<string, unknown>,
          after: {
            name: updated.name,
            email: updated.email,
          } as Record<string, unknown>,
        });
        return updated;
      });
  }

  async toggleStatus(userId: string, instanceId: string) {
    const existing = await this.prisma.user.findFirst({
      where: { id: userId, instanceId },
    });

    if (!existing) throw new NotFoundException('Usuario nao encontrado');

    const newStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    return this.prisma.user
      .update({
        where: { id: userId },
        data: { status: newStatus },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          createdAt: true,
          instanceId: true,
          profileImage: true,
          roles: { include: { role: true } },
        },
      })
      .then((updated) => {
        void this.auditService.log({
          instanceId,
          action: 'UPDATE',
          model: 'User',
          entityId: userId,
          before: { status: existing.status } as Record<string, unknown>,
          after: { status: newStatus } as Record<string, unknown>,
          metadata: { operation: 'toggleStatus' } as Record<string, unknown>,
        });
        return updated;
      });
  }
}
