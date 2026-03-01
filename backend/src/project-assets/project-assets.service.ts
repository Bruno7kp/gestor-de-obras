import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { removeLocalUpload } from '../uploads/file.utils';
import {
  ensureProjectAccess,
  ensureProjectWritable,
} from '../common/project-access.util';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

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
  instanceId: string;
  userId?: string;
}

@Injectable()
export class ProjectAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  private async emitAssetCreatedNotification(input: {
    instanceId: string;
    projectId: string;
    actorUserId?: string;
    asset: {
      id: string;
      name: string;
      category: string;
      fileType: string;
    };
  }) {
    await this.notificationsService.emit({
      instanceId: input.instanceId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      category: 'REPOSITORY',
      eventType: 'PROJECT_ASSET_CREATED',
      priority: 'normal',
      title: 'Novo arquivo no repositório',
      body: `${input.asset.name} foi adicionado ao repositório da obra.`,
      dedupeKey: `project-asset:${input.asset.id}:CREATED`,
      permissionCodes: ['documents.view', 'documents.edit'],
      includeProjectMembers: true,
      metadata: {
        assetId: input.asset.id,
        category: input.asset.category,
        fileType: input.asset.fileType,
      },
    });
  }

  private async emitAssetUpdatedNotification(input: {
    instanceId: string;
    projectId: string;
    actorUserId?: string;
    asset: {
      id: string;
      name: string;
      category: string;
      fileType: string;
    };
  }) {
    await this.notificationsService.emit({
      instanceId: input.instanceId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      category: 'REPOSITORY',
      eventType: 'PROJECT_ASSET_UPDATED',
      priority: 'normal',
      title: 'Arquivo do repositório atualizado',
      body: `${input.asset.name} foi atualizado no repositório da obra.`,
      dedupeKey: `project-asset:${input.asset.id}:UPDATED`,
      permissionCodes: ['documents.view', 'documents.edit'],
      includeProjectMembers: true,
      metadata: {
        assetId: input.asset.id,
        category: input.asset.category,
        fileType: input.asset.fileType,
      },
    });
  }

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
    await this.ensureProject(
      input.projectId,
      input.instanceId,
      input.userId,
      true,
    );
    const createdAsset = await this.prisma.projectAsset.create({
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

    await this.emitAssetCreatedNotification({
      instanceId: input.instanceId,
      projectId: input.projectId,
      actorUserId: input.userId,
      asset: {
        id: createdAsset.id,
        name: createdAsset.name,
        category: createdAsset.category,
        fileType: createdAsset.fileType,
      },
    });

    void this.auditService.log({
      instanceId: input.instanceId,
      userId: input.userId,
      projectId: input.projectId,
      action: 'CREATE',
      model: 'ProjectAsset',
      entityId: createdAsset.id,
      after: JSON.parse(JSON.stringify(createdAsset)) as Record<
        string,
        unknown
      >,
    });

    return createdAsset;
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

    const before = JSON.parse(JSON.stringify(existing)) as Record<
      string,
      unknown
    >;

    const updatedAsset = await this.prisma.projectAsset.update({
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

    await this.emitAssetUpdatedNotification({
      instanceId: input.instanceId,
      projectId: existing.projectId,
      actorUserId: input.userId,
      asset: {
        id: updatedAsset.id,
        name: updatedAsset.name,
        category: updatedAsset.category,
        fileType: updatedAsset.fileType,
      },
    });

    void this.auditService.log({
      instanceId: input.instanceId,
      userId: input.userId,
      projectId: existing.projectId,
      action: 'UPDATE',
      model: 'ProjectAsset',
      entityId: input.id,
      before,
      after: JSON.parse(JSON.stringify(updatedAsset)) as Record<
        string,
        unknown
      >,
    });

    return updatedAsset;
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

    void this.auditService.log({
      instanceId,
      userId,
      projectId: existing.projectId,
      action: 'DELETE',
      model: 'ProjectAsset',
      entityId: id,
      before: JSON.parse(JSON.stringify(existing)) as Record<string, unknown>,
    });

    return { deleted: 1 };
  }
}
