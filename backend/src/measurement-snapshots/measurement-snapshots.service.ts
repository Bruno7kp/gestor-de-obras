import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ensureProjectAccess,
  ensureProjectWritable,
} from '../common/project-access.util';

interface CreateSnapshotInput {
  projectId: string;
  instanceId: string;
  userId?: string;
  measurementNumber: number;
  date: string;
  itemsSnapshot: unknown;
  totals: unknown;
}

interface UpdateSnapshotInput extends Partial<CreateSnapshotInput> {
  id: string;
  userId?: string;
}

@Injectable()
export class MeasurementSnapshotsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProject(
    projectId: string,
    instanceId: string,
    userId?: string,
    writable = false,
  ) {
    await ensureProjectAccess(this.prisma, projectId, instanceId, userId);
    if (writable) {
      await ensureProjectWritable(this.prisma, projectId);
    }
  }

  async findAll(projectId: string, instanceId: string, userId?: string) {
    await this.ensureProject(projectId, instanceId, userId);
    return this.prisma.measurementSnapshot.findMany({
      where: { projectId },
      orderBy: { measurementNumber: 'desc' },
    });
  }

  async create(input: CreateSnapshotInput) {
    await this.ensureProject(input.projectId, input.instanceId, input.userId, true);

    const existing = await this.prisma.measurementSnapshot.findFirst({
      where: {
        projectId: input.projectId,
        measurementNumber: input.measurementNumber,
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.measurementSnapshot.create({
      data: {
        projectId: input.projectId,
        measurementNumber: input.measurementNumber,
        date: input.date,
        itemsSnapshot: input.itemsSnapshot as Prisma.InputJsonValue,
        totals: input.totals as Prisma.InputJsonValue,
      },
    });
  }

  async update(input: UpdateSnapshotInput) {
    let existing = await this.prisma.measurementSnapshot.findFirst({
      where: { id: input.id, project: { instanceId: input.instanceId } },
    });
    if (!existing && input.userId) {
      existing = await this.prisma.measurementSnapshot.findFirst({
        where: {
          id: input.id,
          project: { members: { some: { userId: input.userId } } },
        },
      });
    }

    if (!existing) throw new NotFoundException('Snapshot nao encontrado');

    await ensureProjectWritable(this.prisma, existing.projectId);

    return this.prisma.measurementSnapshot.update({
      where: { id: input.id },
      data: {
        measurementNumber:
          input.measurementNumber ?? existing.measurementNumber,
        date: input.date ?? existing.date,
        itemsSnapshot: (input.itemsSnapshot ??
          existing.itemsSnapshot) as Prisma.InputJsonValue,
        totals: (input.totals ?? existing.totals) as Prisma.InputJsonValue,
      },
    });
  }

  async remove(id: string, instanceId: string, userId?: string) {
    let existing = await this.prisma.measurementSnapshot.findFirst({
      where: { id, project: { instanceId } },
    });
    if (!existing && userId) {
      existing = await this.prisma.measurementSnapshot.findFirst({
        where: { id, project: { members: { some: { userId } } } },
      });
    }

    if (!existing) throw new NotFoundException('Snapshot nao encontrado');

    await ensureProjectWritable(this.prisma, existing.projectId);

    await this.prisma.measurementSnapshot.delete({ where: { id } });
    return { deleted: 1 };
  }
}
