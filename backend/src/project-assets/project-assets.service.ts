import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { removeLocalUpload } from '../uploads/file.utils';
import { ensureProjectAccess } from '../common/project-access.util';

interface CreateAssetInput {
  id?: string;
  projectId: string;
  instanceId: string;
  userId?: string;
  name: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  data: string;
}

interface UpdateAssetInput extends Partial<CreateAssetInput> {
  id: string;
  userId?: string;
}

@Injectable()
export class ProjectAssetsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProject(
    projectId: string,
    instanceId: string,
    userId?: string,
  ) {
    return ensureProjectAccess(this.prisma, projectId, instanceId, userId);
  }

  async findAll(projectId: string, instanceId: string, userId?: string) {
    await this.ensureProject(projectId, instanceId, userId);
    return this.prisma.projectAsset.findMany({
      where: { projectId },
      orderBy: { uploadDate: 'desc' },
    });
  }

  async create(input: CreateAssetInput) {
    await this.ensureProject(input.projectId, input.instanceId, input.userId);
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
    let existing = await this.prisma.projectAsset.findFirst({
      where: {
        id: input.id,
        project: { instanceId: input.instanceId },
      },
    });
    if (!existing && input.userId) {
      existing = await this.prisma.projectAsset.findFirst({
        where: {
          id: input.id,
          project: { members: { some: { userId: input.userId } } },
        },
      });
    }

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

  async remove(id: string, instanceId: string, userId?: string) {
    let existing = await this.prisma.projectAsset.findFirst({
      where: { id, project: { instanceId } },
    });
    if (!existing && userId) {
      existing = await this.prisma.projectAsset.findFirst({
        where: { id, project: { members: { some: { userId } } } },
      });
    }

    if (!existing) throw new NotFoundException('Arquivo nao encontrado');

    await removeLocalUpload(existing.data);
    await this.prisma.projectAsset.delete({ where: { id } });
    return { deleted: 1 };
  }
}
