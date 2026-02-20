import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { removeLocalUpload } from '../uploads/file.utils';
import {
  ensureProjectAccess,
  ensureProjectWritable,
} from '../common/project-access.util';

interface CreateAssetInput {
  id?: string;
  projectId: string;
  instanceId: string;
  userId?: string;
  name: string;
  category?: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  data: string;
  createdById?: string | null;
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
    writable = false,
  ) {
    await ensureProjectAccess(this.prisma, projectId, instanceId, userId);
    if (writable) {
      await ensureProjectWritable(this.prisma, projectId);
    }
  }

  async findAll(projectId: string, instanceId: string, userId?: string) {
    await this.ensureProject(projectId, instanceId, userId);
    return this.prisma.projectAsset.findMany({
      where: { projectId },
      orderBy: { uploadDate: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true, profileImage: true },
        },
      },
    });
  }

  async create(input: CreateAssetInput) {
    await this.ensureProject(input.projectId, input.instanceId, input.userId, true);
    return this.prisma.projectAsset.create({
      data: {
        id: input.id,
        projectId: input.projectId,
        name: input.name,
        category: input.category ?? 'DOCUMENTO_DIVERSO',
        fileType: input.fileType,
        fileSize: input.fileSize,
        uploadDate: input.uploadDate,
        data: input.data,
        createdById: input.userId ?? input.createdById ?? null,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, profileImage: true },
        },
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

    await ensureProjectWritable(this.prisma, existing.projectId);

    return this.prisma.projectAsset.update({
      where: { id: input.id },
      data: {
        name: input.name ?? existing.name,
        category: input.category ?? existing.category,
        fileType: input.fileType ?? existing.fileType,
        fileSize: input.fileSize ?? existing.fileSize,
        uploadDate: input.uploadDate ?? existing.uploadDate,
        data: input.data ?? existing.data,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, profileImage: true },
        },
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

    await ensureProjectWritable(this.prisma, existing.projectId);

    await removeLocalUpload(existing.data);
    await this.prisma.projectAsset.delete({ where: { id } });
    return { deleted: 1 };
  }
}
