import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateAssetInput {
  id?: string;
  projectId: string;
  instanceId: string;
  name: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  data: string;
}

interface UpdateAssetInput extends Partial<CreateAssetInput> {
  id: string;
}

@Injectable()
export class ProjectAssetsService {
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
    return this.prisma.projectAsset.findMany({
      where: { projectId },
      orderBy: { uploadDate: 'desc' },
    });
  }

  async create(input: CreateAssetInput) {
    await this.ensureProject(input.projectId, input.instanceId);
    return this.prisma.projectAsset.create({
      data: {
        id: input.id,
        projectId: input.projectId,
        name: input.name,
        fileType: input.fileType,
        fileSize: input.fileSize,
        uploadDate: input.uploadDate,
        data: input.data,
      },
    });
  }

  async update(input: UpdateAssetInput) {
    const existing = await this.prisma.projectAsset.findFirst({
      where: {
        id: input.id,
        project: { instanceId: input.instanceId },
      },
    });

    if (!existing) throw new NotFoundException('Arquivo nao encontrado');

    return this.prisma.projectAsset.update({
      where: { id: input.id },
      data: {
        name: input.name ?? existing.name,
        fileType: input.fileType ?? existing.fileType,
        fileSize: input.fileSize ?? existing.fileSize,
        uploadDate: input.uploadDate ?? existing.uploadDate,
        data: input.data ?? existing.data,
      },
    });
  }

  async remove(id: string, instanceId: string) {
    const existing = await this.prisma.projectAsset.findFirst({
      where: { id, project: { instanceId } },
    });

    if (!existing) throw new NotFoundException('Arquivo nao encontrado');

    await this.prisma.projectAsset.delete({ where: { id } });
    return { deleted: 1 };
  }
}
