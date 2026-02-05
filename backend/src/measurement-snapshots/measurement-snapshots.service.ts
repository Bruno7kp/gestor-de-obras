import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateSnapshotInput {
  projectId: string;
  instanceId: string;
  measurementNumber: number;
  date: string;
  itemsSnapshot: unknown;
  totals: unknown;
}

interface UpdateSnapshotInput extends Partial<CreateSnapshotInput> {
  id: string;
}

@Injectable()
export class MeasurementSnapshotsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProject(projectId: string, instanceId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, instanceId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Projeto nao encontrado');
  }

  async findAll(projectId: string, instanceId: string) {
    await this.ensureProject(projectId, instanceId);
    return this.prisma.measurementSnapshot.findMany({
      where: { projectId },
      orderBy: { measurementNumber: 'desc' },
    });
  }

  async create(input: CreateSnapshotInput) {
    await this.ensureProject(input.projectId, input.instanceId);
    return this.prisma.measurementSnapshot.create({
      data: {
        projectId: input.projectId,
        measurementNumber: input.measurementNumber,
        date: input.date,
        itemsSnapshot: input.itemsSnapshot,
        totals: input.totals,
      },
    });
  }

  async update(input: UpdateSnapshotInput) {
    const existing = await this.prisma.measurementSnapshot.findFirst({
      where: { id: input.id, project: { instanceId: input.instanceId } },
    });

    if (!existing) throw new NotFoundException('Snapshot nao encontrado');

    return this.prisma.measurementSnapshot.update({
      where: { id: input.id },
      data: {
        measurementNumber: input.measurementNumber ?? existing.measurementNumber,
        date: input.date ?? existing.date,
        itemsSnapshot: input.itemsSnapshot ?? existing.itemsSnapshot,
        totals: input.totals ?? existing.totals,
      },
    });
  }

  async remove(id: string, instanceId: string) {
    const existing = await this.prisma.measurementSnapshot.findFirst({
      where: { id, project: { instanceId } },
    });

    if (!existing) throw new NotFoundException('Snapshot nao encontrado');

    await this.prisma.measurementSnapshot.delete({ where: { id } });
    return { deleted: 1 };
  }
}
