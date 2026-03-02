import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { removeLocalUpload, removeLocalUploads } from '../uploads/file.utils';
import {
  ensureProjectAccess,
  ensureProjectWritable,
} from '../common/project-access.util';

interface CreateWorkforceInput {
  projectId: string;
  instanceId: string;
  userId?: string;
  nome?: string;
  cpf_cnpj?: string;
  empresa_vinculada?: string;
  contractorId?: string | null;
  foto?: string | null;
  cargo?: string;
  documentos?: Array<{
    nome: string;
    dataVencimento: string;
    arquivoUrl?: string | null;
    status: string;
  }>;
  linkedWorkItemIds?: string[];
}

interface UpdateWorkforceInput extends Partial<CreateWorkforceInput> {
  id: string;
  instanceId: string;
  userId?: string;
}

@Injectable()
export class WorkforceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

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

  private async ensureMember(
    id: string,
    instanceId: string,
    userId?: string,
    writable = false,
  ) {
    let member = await this.prisma.workforceMember.findFirst({
      where: { id, project: { instanceId } },
    });
    if (!member && userId) {
      member = await this.prisma.workforceMember.findFirst({
        where: { id, project: { members: { some: { userId } } } },
      });
    }
    if (!member) throw new NotFoundException('Membro nao encontrado');
    if (writable) {
      await ensureProjectWritable(this.prisma, member.projectId);
    }
    return member;
  }

  private async resolveProjectInstanceId(
    projectId: string,
    instanceId: string,
    userId?: string,
  ) {
    let project = await this.prisma.project.findFirst({
      where: { id: projectId, instanceId },
      select: { id: true, instanceId: true },
    });

    if (!project && userId) {
      project = await this.prisma.project.findFirst({
        where: { id: projectId, members: { some: { userId } } },
        select: { id: true, instanceId: true },
      });
    }

    if (!project) {
      throw new NotFoundException('Projeto nao encontrado');
    }

    return project.instanceId;
  }

  private async ensureContractor(
    contractorId: string,
    projectId: string,
    instanceId: string,
    userId?: string,
  ) {
    const projectInstanceId = await this.resolveProjectInstanceId(
      projectId,
      instanceId,
      userId,
    );

    const contractor = await this.prisma.contractor.findFirst({
      where: { id: contractorId, instanceId: projectInstanceId },
      select: {
        id: true,
        name: true,
        cnpj: true,
        type: true,
        cargo: true,
      },
    });

    if (!contractor) {
      throw new NotFoundException('Prestador nao encontrado');
    }

    return contractor;
  }

  private hydrateMember(
    member: {
      id: string;
      nome: string;
      cpf_cnpj: string;
      empresa_vinculada: string;
      contractorId: string | null;
      foto: string | null;
      cargo: string;
      documentos?: any[];
      responsabilidades?: Array<{ workItemId: string }>;
      contractor?: {
        id: string;
        name: string;
        cnpj: string;
        type: string;
        cargo: string | null;
      } | null;
    },
  ) {
    if (!member.contractor) return member;

    return {
      ...member,
      nome: member.contractor.name,
      empresa_vinculada: member.contractor.name,
      cpf_cnpj: member.contractor.cnpj || member.cpf_cnpj,
      cargo:
        member.contractor.type === 'Autônomo'
          ? member.contractor.cargo || member.cargo
          : '',
    };
  }

  async findAll(projectId: string, instanceId: string, userId?: string) {
    await this.ensureProject(projectId, instanceId, userId);
    const members = await this.prisma.workforceMember.findMany({
      where: { projectId },
      include: {
        documentos: true,
        responsabilidades: true,
        contractor: {
          select: { id: true, name: true, cnpj: true, type: true, cargo: true },
        },
      },
      orderBy: { nome: 'asc' },
    });

    return members.map((member) => this.hydrateMember(member));
  }

  async create(input: CreateWorkforceInput) {
    await this.ensureProject(
      input.projectId,
      input.instanceId,
      input.userId,
      true,
    );

    if (!input.contractorId) {
      throw new NotFoundException('Prestador e obrigatorio para incluir na equipe');
    }

    const contractor = await this.ensureContractor(
      input.contractorId,
      input.projectId,
      input.instanceId,
      input.userId,
    );

    const existingByContractor = await this.prisma.workforceMember.findFirst({
      where: { projectId: input.projectId, contractorId: contractor.id },
      select: { id: true },
    });

    if (existingByContractor) {
      const existing = await this.prisma.workforceMember.findUnique({
        where: { id: existingByContractor.id },
        include: {
          documentos: true,
          responsabilidades: true,
          contractor: {
            select: {
              id: true,
              name: true,
              cnpj: true,
              type: true,
              cargo: true,
            },
          },
        },
      });

      return existing ? this.hydrateMember(existing) : existing;
    }

    const member = await this.prisma.workforceMember.create({
      data: {
        projectId: input.projectId,
        nome: contractor.name,
        cpf_cnpj: contractor.cnpj || '',
        empresa_vinculada: contractor.name,
        contractorId: contractor.id,
        foto: input.foto ?? null,
        cargo: contractor.type === 'Autônomo' ? contractor.cargo || '' : '',
        createdById: input.userId ?? null,
      },
    });

    if (input.documentos?.length) {
      await this.prisma.staffDocument.createMany({
        data: input.documentos.map((doc) => ({
          nome: doc.nome,
          dataVencimento: doc.dataVencimento,
          arquivoUrl: doc.arquivoUrl ?? null,
          status: doc.status,
          workforceMemberId: member.id,
        })),
      });
    }

    if (input.linkedWorkItemIds?.length) {
      await this.prisma.workItemResponsibility.createMany({
        data: input.linkedWorkItemIds.map((workItemId) => ({
          workItemId,
          workforceMemberId: member.id,
        })),
        skipDuplicates: true,
      });
    }

    return this.prisma.workforceMember
      .findUnique({
        where: { id: member.id },
        include: {
          documentos: true,
          responsabilidades: true,
          contractor: {
            select: {
              id: true,
              name: true,
              cnpj: true,
              type: true,
              cargo: true,
            },
          },
        },
      })
      .then((result) => {
        void this.auditService.log({
          instanceId: input.instanceId,
          userId: input.userId,
          projectId: input.projectId,
          action: 'CREATE',
          model: 'WorkforceMember',
          entityId: member.id,
          after: member as Record<string, unknown>,
        });
        return result ? this.hydrateMember(result) : result;
      });
  }

  async update(input: UpdateWorkforceInput) {
    const existing = await this.ensureMember(
      input.id,
      input.instanceId,
      input.userId,
      true,
    );

    return this.prisma.workforceMember
      .update({
        where: { id: existing.id },
        data: {
          foto: input.foto ?? existing.foto,
          updatedById: input.userId ?? null,
        },
      })
      .then((updated) => {
        void this.auditService.log({
          instanceId: input.instanceId,
          userId: input.userId,
          projectId: existing.projectId,
          action: 'UPDATE',
          model: 'WorkforceMember',
          entityId: input.id,
          before: existing as Record<string, unknown>,
          after: updated as Record<string, unknown>,
        });
        return updated;
      });
  }

  async addDocument(
    id: string,
    instanceId: string,
    document: {
      nome: string;
      dataVencimento: string;
      arquivoUrl?: string | null;
      status: string;
    },
    userId?: string,
  ) {
    await this.ensureMember(id, instanceId, userId, true);
    return this.prisma.staffDocument.create({
      data: {
        workforceMemberId: id,
        nome: document.nome,
        dataVencimento: document.dataVencimento,
        arquivoUrl: document.arquivoUrl ?? null,
        status: document.status,
      },
    });
  }

  async removeDocument(
    id: string,
    documentId: string,
    instanceId: string,
    userId?: string,
  ) {
    await this.ensureMember(id, instanceId, userId, true);

    let doc = await this.prisma.staffDocument.findFirst({
      where: {
        id: documentId,
        workforceMember: { id, project: { instanceId } },
      },
      select: { id: true, arquivoUrl: true },
    });
    if (!doc && userId) {
      doc = await this.prisma.staffDocument.findFirst({
        where: {
          id: documentId,
          workforceMember: { id, project: { members: { some: { userId } } } },
        },
        select: { id: true, arquivoUrl: true },
      });
    }

    if (!doc) throw new NotFoundException('Documento nao encontrado');

    await removeLocalUpload(doc.arquivoUrl);
    await this.prisma.staffDocument.delete({ where: { id: documentId } });

    void this.auditService.log({
      instanceId,
      userId,
      action: 'DELETE',
      model: 'StaffDocument',
      entityId: documentId,
      before: JSON.parse(JSON.stringify(doc)) as Record<string, unknown>,
    });

    return { deleted: 1 };
  }

  async addResponsibility(
    id: string,
    workItemId: string,
    instanceId: string,
    userId?: string,
  ) {
    await this.ensureMember(id, instanceId, userId, true);
    return this.prisma.workItemResponsibility.upsert({
      where: {
        workItemId_workforceMemberId: {
          workItemId,
          workforceMemberId: id,
        },
      },
      update: {},
      create: {
        workforceMemberId: id,
        workItemId,
      },
    });
  }

  async removeResponsibility(
    id: string,
    workItemId: string,
    instanceId: string,
    userId?: string,
  ) {
    await this.ensureMember(id, instanceId, userId, true);
    await this.prisma.workItemResponsibility.deleteMany({
      where: {
        workforceMemberId: id,
        workItemId,
      },
    });

    void this.auditService.log({
      instanceId,
      userId,
      action: 'DELETE',
      model: 'WorkItemResponsibility',
      entityId: `${id}:${workItemId}`,
      before: { workforceMemberId: id, workItemId } as Record<string, unknown>,
    });

    return { deleted: 1 };
  }

  async syncResponsibilities(
    id: string,
    workItemIds: string[],
    instanceId: string,
    userId?: string,
  ) {
    await this.ensureMember(id, instanceId, userId, true);

    const existing = await this.prisma.workItemResponsibility.findMany({
      where: { workforceMemberId: id },
      select: { workItemId: true },
    });
    const existingIds = new Set(existing.map((r) => r.workItemId));
    const desiredIds = new Set(workItemIds);

    const toAdd = workItemIds.filter((wid) => !existingIds.has(wid));
    const toRemove = existing
      .map((r) => r.workItemId)
      .filter((wid) => !desiredIds.has(wid));

    if (toRemove.length > 0) {
      await this.prisma.workItemResponsibility.deleteMany({
        where: {
          workforceMemberId: id,
          workItemId: { in: toRemove },
        },
      });
    }

    if (toAdd.length > 0) {
      await this.prisma.workItemResponsibility.createMany({
        data: toAdd.map((workItemId) => ({
          workforceMemberId: id,
          workItemId,
        })),
        skipDuplicates: true,
      });
    }

    void this.auditService.log({
      instanceId,
      userId,
      action: 'UPDATE',
      model: 'WorkItemResponsibility',
      entityId: id,
      before: { workItemIds: [...existingIds] } as Record<string, unknown>,
      after: { workItemIds } as Record<string, unknown>,
    });

    return { synced: workItemIds.length };
  }

  async remove(id: string, instanceId: string, userId?: string) {
    let member = await this.prisma.workforceMember.findFirst({
      where: { id, project: { instanceId } },
      include: { documentos: { select: { arquivoUrl: true } } },
    });
    if (!member && userId) {
      member = await this.prisma.workforceMember.findFirst({
        where: { id, project: { members: { some: { userId } } } },
        include: { documentos: { select: { arquivoUrl: true } } },
      });
    }

    if (!member) throw new NotFoundException('Membro nao encontrado');

    await ensureProjectWritable(this.prisma, member.projectId);

    await removeLocalUpload(member.foto);
    await removeLocalUploads(member.documentos.map((doc) => doc.arquivoUrl));

    await this.prisma.staffDocument.deleteMany({
      where: { workforceMemberId: id },
    });
    await this.prisma.workItemResponsibility.deleteMany({
      where: { workforceMemberId: id },
    });
    await this.prisma.workforceMember.delete({ where: { id } });

    void this.auditService.log({
      instanceId,
      userId,
      projectId: member.projectId,
      action: 'DELETE',
      model: 'WorkforceMember',
      entityId: id,
      before: member as Record<string, unknown>,
    });

    return { deleted: 1 };
  }
}
