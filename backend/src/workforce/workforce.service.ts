import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { removeLocalUpload, removeLocalUploads } from '../uploads/file.utils';
import {
  ensureProjectAccess,
  ensureProjectWritable,
} from '../common/project-access.util';

interface CreateWorkforceInput {
  projectId: string;
  instanceId: string;
  userId?: string;
  nome: string;
  cpf_cnpj: string;
  empresa_vinculada: string;
  foto?: string | null;
  cargo: string;
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

  async findAll(projectId: string, instanceId: string, userId?: string) {
    await this.ensureProject(projectId, instanceId, userId);
    return this.prisma.workforceMember.findMany({
      where: { projectId },
      include: {
        documentos: true,
        responsabilidades: true,
      },
      orderBy: { nome: 'asc' },
    });
  }

  async create(input: CreateWorkforceInput) {
    await this.ensureProject(input.projectId, input.instanceId, input.userId, true);

    const member = await this.prisma.workforceMember.create({
      data: {
        projectId: input.projectId,
        nome: input.nome,
        cpf_cnpj: input.cpf_cnpj,
        empresa_vinculada: input.empresa_vinculada,
        foto: input.foto ?? null,
        cargo: input.cargo,
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

    return this.prisma.workforceMember.findUnique({
      where: { id: member.id },
      include: { documentos: true, responsabilidades: true },
    });
  }

  async update(input: UpdateWorkforceInput) {
    const existing = await this.ensureMember(
      input.id,
      input.instanceId,
      input.userId,
      true,
    );

    return this.prisma.workforceMember.update({
      where: { id: existing.id },
      data: {
        nome: input.nome ?? existing.nome,
        cpf_cnpj: input.cpf_cnpj ?? existing.cpf_cnpj,
        empresa_vinculada:
          input.empresa_vinculada ?? existing.empresa_vinculada,
        foto: input.foto ?? existing.foto,
        cargo: input.cargo ?? existing.cargo,
      },
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
    return { deleted: 1 };
  }

  async addResponsibility(
    id: string,
    workItemId: string,
    instanceId: string,
    userId?: string,
  ) {
    await this.ensureMember(id, instanceId, userId, true);
    return this.prisma.workItemResponsibility.create({
      data: {
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
    return { deleted: 1 };
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
    return { deleted: 1 };
  }
}
