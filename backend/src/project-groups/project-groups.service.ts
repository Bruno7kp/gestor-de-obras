import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateProjectGroupInput {
  name: string;
  parentId?: string | null;
  order?: number;
  instanceId: string;
}

interface UpdateProjectGroupInput {
  id: string;
  name?: string;
  parentId?: string | null;
  order?: number;
  instanceId: string;
}

@Injectable()
export class ProjectGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(instanceId: string) {
    return this.prisma.projectGroup.findMany({
      where: { instanceId },
      orderBy: { order: 'asc' },
    });
  }

  create(input: CreateProjectGroupInput) {
    return this.prisma.projectGroup.create({
      data: {
        name: input.name,
        parentId: input.parentId ?? null,
        order: input.order ?? 0,
        instanceId: input.instanceId,
      },
    });
  }

  async update(input: UpdateProjectGroupInput) {
    const existing = await this.prisma.projectGroup.findFirst({
      where: { id: input.id, instanceId: input.instanceId },
    });

    if (!existing) throw new NotFoundException('Grupo nao encontrado');

    return this.prisma.projectGroup.update({
      where: { id: input.id },
      data: {
        name: input.name ?? existing.name,
        parentId: input.parentId ?? existing.parentId,
        order: input.order ?? existing.order,
      },
    });
  }

  async remove(id: string, instanceId: string) {
    const existing = await this.prisma.projectGroup.findFirst({
      where: { id, instanceId },
    });

    if (!existing) throw new NotFoundException('Grupo nao encontrado');

    await this.prisma.projectGroup.updateMany({
      where: { parentId: id, instanceId },
      data: { parentId: null },
    });

    await this.prisma.project.updateMany({
      where: { groupId: id, instanceId },
      data: { groupId: null },
    });

    return this.prisma.projectGroup.delete({ where: { id } });
  }
}
