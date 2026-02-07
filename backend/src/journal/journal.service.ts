import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { removeLocalUploads } from '../uploads/file.utils';
import { ensureProjectAccess } from '../common/project-access.util';

interface CreateJournalEntryInput {
  id?: string;
  projectId: string;
  instanceId: string;
  userId?: string;
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

  private async ensureProject(
    projectId: string,
    instanceId: string,
    userId?: string,
  ) {
    return ensureProjectAccess(this.prisma, projectId, instanceId, userId);
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

  async listEntries(projectId: string, instanceId: string, userId?: string) {
    await this.ensureProject(projectId, instanceId, userId);
    const journal = await this.ensureJournal(projectId);
    return this.prisma.journalEntry.findMany({
      where: { projectJournalId: journal.id },
      orderBy: { timestamp: 'desc' },
    });
  }

  async createEntry(input: CreateJournalEntryInput) {
    await this.ensureProject(input.projectId, input.instanceId, input.userId);
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
    userId?: string,
  ) {
    let entry = await this.prisma.journalEntry.findFirst({
      where: { id, projectJournal: { project: { instanceId } } },
    });
    if (!entry && userId) {
      entry = await this.prisma.journalEntry.findFirst({
        where: {
          id,
          projectJournal: { project: { members: { some: { userId } } } },
        },
      });
    }
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

  async deleteEntry(id: string, instanceId: string, userId?: string) {
    let entry = await this.prisma.journalEntry.findFirst({
      where: { id, projectJournal: { project: { instanceId } } },
      select: { id: true, photoUrls: true },
    });
    if (!entry && userId) {
      entry = await this.prisma.journalEntry.findFirst({
        where: {
          id,
          projectJournal: { project: { members: { some: { userId } } } },
        },
        select: { id: true, photoUrls: true },
      });
    }
    if (!entry) throw new NotFoundException('Registro nao encontrado');

    await removeLocalUploads(entry.photoUrls ?? []);
    await this.prisma.journalEntry.delete({ where: { id } });
    return { deleted: 1 };
  }
}
