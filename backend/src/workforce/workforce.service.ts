import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { removeLocalUpload, removeLocalUploads } from '../uploads/file.utils';

interface CreateWorkforceInput {
  projectId: string;
  instanceId: string;
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
}

@Injectable()
export class WorkforceService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProject(projectId: string, instanceId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, instanceId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Projeto nao encontrado');
  }

  private async ensureMember(id: string, instanceId: string) {
    const member = await this.prisma.workforceMember.findFirst({
      where: { id, project: { instanceId } },
    });
    if (!member) throw new NotFoundException('Membro nao encontrado');
    return member;
  }

  async findAll(projectId: string, instanceId: string) {
    await this.ensureProject(projectId, instanceId);
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
    await this.ensureProject(input.projectId, input.instanceId);

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
    const existing = await this.ensureMember(input.id, input.instanceId);

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
  ) {
    await this.ensureMember(id, instanceId);
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

  async removeDocument(id: string, documentId: string, instanceId: string) {
    await this.ensureMember(id, instanceId);

    const doc = await this.prisma.staffDocument.findFirst({
      where: {
        id: documentId,
        workforceMember: { id, project: { instanceId } },
      },
      select: { id: true, arquivoUrl: true },
    });

    if (!doc) throw new NotFoundException('Documento nao encontrado');

    await removeLocalUpload(doc.arquivoUrl);
    await this.prisma.staffDocument.delete({ where: { id: documentId } });
    return { deleted: 1 };
  }

  async addResponsibility(id: string, workItemId: string, instanceId: string) {
    await this.ensureMember(id, instanceId);
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
  ) {
    await this.ensureMember(id, instanceId);
    await this.prisma.workItemResponsibility.deleteMany({
      where: {
        workforceMemberId: id,
        workItemId,
      },
    });
    return { deleted: 1 };
  }

  async remove(id: string, instanceId: string) {
    const member = await this.prisma.workforceMember.findFirst({
      where: { id, project: { instanceId } },
      include: { documentos: { select: { arquivoUrl: true } } },
    });

    if (!member) throw new NotFoundException('Membro nao encontrado');

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
