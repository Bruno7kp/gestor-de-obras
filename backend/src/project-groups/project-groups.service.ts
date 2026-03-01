import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(instanceId: string) {
    return this.prisma.projectGroup.findMany({
      where: { instanceId },
      orderBy: { order: 'asc' },
    });
  }

  async create(input: CreateProjectGroupInput) {
    const group = await this.prisma.projectGroup.create({
      data: {
        name: input.name,
        parentId: input.parentId ?? null,
        order: input.order ?? 0,
        instanceId: input.instanceId,
      },
    });

    void this.auditService.log({
      instanceId: input.instanceId,
      action: 'CREATE',
      model: 'ProjectGroup',
      entityId: group.id,
      after: JSON.parse(JSON.stringify(group)) as Record<string, unknown>,
    });

    return group;
  }

  async update(input: UpdateProjectGroupInput) {
    const existing = await this.prisma.projectGroup.findFirst({
      where: { id: input.id, instanceId: input.instanceId },
    });

    if (!existing) throw new NotFoundException('Grupo nao encontrado');

    return this.prisma.projectGroup
      .update({
        where: { id: input.id },
        data: {
          name: input.name ?? existing.name,
          parentId:
            input.parentId !== undefined ? input.parentId : existing.parentId,
          order: input.order ?? existing.order,
        },
      })
      .then((updated) => {
        void this.auditService.log({
          instanceId: input.instanceId,
          action: 'UPDATE',
          model: 'ProjectGroup',
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

    return this.prisma.projectGroup
      .delete({ where: { id } })
      .then((deleted) => {
        void this.auditService.log({
          instanceId,
          action: 'DELETE',
          model: 'ProjectGroup',
          entityId: id,
          before: JSON.parse(JSON.stringify(existing)) as Record<
            string,
            unknown
          >,
        });
        return deleted;
      });
  }
}
