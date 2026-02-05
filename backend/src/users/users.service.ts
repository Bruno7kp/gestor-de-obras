import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

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

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
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

    return this.prisma.user.findUnique({
      where: { id: input.userId },
      include: { roles: { include: { role: true } } },
    });
  }

  async listRoles(userId: string, instanceId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, instanceId },
      include: { roles: { include: { role: true } } },
    });

    if (!user) throw new NotFoundException('Usuario nao encontrado');

    return user.roles.map(entry => entry.role);
  }
}
