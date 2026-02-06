import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { removeLocalUploads } from '../uploads/file.utils';

interface CreateJournalEntryInput {
  id?: string;
  projectId: string;
  instanceId: string;
  timestamp: string;
  type: string;
  category: string;
  title: string;
  description: string;
  weatherStatus?: string | null;
  photoUrls?: string[];
}

@Injectable()
export class JournalService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProject(projectId: string, instanceId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, instanceId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Projeto nao encontrado');
  }

  private async ensureJournal(projectId: string) {
    const existing = await this.prisma.projectJournal.findFirst({
      where: { projectId },
    });

    if (existing) return existing;

    return this.prisma.projectJournal.create({
      data: { projectId },
    });
  }

  async listEntries(projectId: string, instanceId: string) {
    await this.ensureProject(projectId, instanceId);
    const journal = await this.ensureJournal(projectId);
    return this.prisma.journalEntry.findMany({
      where: { projectJournalId: journal.id },
      orderBy: { timestamp: 'desc' },
    });
  }

  async createEntry(input: CreateJournalEntryInput) {
    await this.ensureProject(input.projectId, input.instanceId);
    const journal = await this.ensureJournal(input.projectId);

    return this.prisma.journalEntry.create({
      data: {
        id: input.id,
        projectJournalId: journal.id,
        timestamp: input.timestamp,
        type: input.type,
        category: input.category,
        title: input.title,
        description: input.description,
        weatherStatus: input.weatherStatus ?? null,
        photoUrls: input.photoUrls ?? [],
      },
    });
  }

  async updateEntry(
    id: string,
    instanceId: string,
    data: Partial<CreateJournalEntryInput>,
  ) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, projectJournal: { project: { instanceId } } },
    });
    if (!entry) throw new NotFoundException('Registro nao encontrado');

    return this.prisma.journalEntry.update({
      where: { id },
      data: {
        timestamp: data.timestamp ?? entry.timestamp,
        type: data.type ?? entry.type,
        category: data.category ?? entry.category,
        title: data.title ?? entry.title,
        description: data.description ?? entry.description,
        weatherStatus: data.weatherStatus ?? entry.weatherStatus,
        photoUrls: data.photoUrls ?? entry.photoUrls,
      },
    });
  }

  async deleteEntry(id: string, instanceId: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, projectJournal: { project: { instanceId } } },
      select: { id: true, photoUrls: true },
    });
    if (!entry) throw new NotFoundException('Registro nao encontrado');

    await removeLocalUploads(entry.photoUrls ?? []);
    await this.prisma.journalEntry.delete({ where: { id } });
    return { deleted: 1 };
  }
}
