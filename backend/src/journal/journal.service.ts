import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { removeLocalUploads } from '../uploads/file.utils';
import {
  ensureProjectAccess,
  ensureProjectWritable,
} from '../common/project-access.util';

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
  progressPercent?: number | null;
  progressStage?: string | null;
  progressItem?: string | null;
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
    writable = false,
  ) {
    await ensureProjectAccess(this.prisma, projectId, instanceId, userId);
    if (writable) {
      await ensureProjectWritable(this.prisma, projectId);
    }
  }

  private async ensureJournal(projectId: string, createIfMissing = true) {
    const existing = await this.prisma.projectJournal.findFirst({
      where: { projectId },
    });

    if (existing) return existing;

    if (!createIfMissing) return null;

    return this.prisma.projectJournal.create({
      data: { projectId },
    });
  }

  async listEntries(projectId: string, instanceId: string, userId?: string) {
    await this.ensureProject(projectId, instanceId, userId);
    const journal = await this.ensureJournal(projectId, false);
    if (!journal) return [];
    return this.prisma.journalEntry.findMany({
      where: { projectJournalId: journal.id },
      orderBy: { timestamp: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true, profileImage: true },
        },
      },
    });
  }

  async createEntry(input: CreateJournalEntryInput) {
    await this.ensureProject(input.projectId, input.instanceId, input.userId, true);
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
        progressPercent: input.progressPercent ?? null,
        progressStage: input.progressStage ?? null,
        progressItem: input.progressItem ?? null,
        weatherStatus: input.weatherStatus ?? null,
        photoUrls: input.photoUrls ?? [],
        createdById: input.userId ?? null,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, profileImage: true },
        },
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
      select: {
        id: true,
        projectJournal: { select: { projectId: true } },
        timestamp: true,
        type: true,
        category: true,
        title: true,
        description: true,
        progressPercent: true,
        progressStage: true,
        progressItem: true,
        weatherStatus: true,
        photoUrls: true,
      },
    });
    if (!entry && userId) {
      entry = await this.prisma.journalEntry.findFirst({
        where: {
          id,
          projectJournal: { project: { members: { some: { userId } } } },
        },
        select: {
          id: true,
          projectJournal: { select: { projectId: true } },
          timestamp: true,
          type: true,
          category: true,
          title: true,
          description: true,
          progressPercent: true,
          progressStage: true,
          progressItem: true,
          weatherStatus: true,
          photoUrls: true,
        },
      });
    }
    if (!entry) throw new NotFoundException('Registro nao encontrado');

    await ensureProjectWritable(this.prisma, entry.projectJournal.projectId);

    return this.prisma.journalEntry.update({
      where: { id },
      data: {
        timestamp: data.timestamp ?? entry.timestamp,
        type: data.type ?? entry.type,
        category: data.category ?? entry.category,
        title: data.title ?? entry.title,
        description: data.description ?? entry.description,
        progressPercent:
          data.progressPercent === undefined
            ? entry.progressPercent
            : data.progressPercent,
        progressStage:
          data.progressStage === undefined
            ? entry.progressStage
            : data.progressStage,
        progressItem:
          data.progressItem === undefined
            ? entry.progressItem
            : data.progressItem,
        weatherStatus: data.weatherStatus ?? entry.weatherStatus,
        photoUrls: data.photoUrls ?? entry.photoUrls,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, profileImage: true },
        },
      },
    });
  }

  async deleteEntry(id: string, instanceId: string, userId?: string) {
    let entry = await this.prisma.journalEntry.findFirst({
      where: { id, projectJournal: { project: { instanceId } } },
      select: {
        id: true,
        photoUrls: true,
        projectJournal: { select: { projectId: true } },
      },
    });
    if (!entry && userId) {
      entry = await this.prisma.journalEntry.findFirst({
        where: {
          id,
          projectJournal: { project: { members: { some: { userId } } } },
        },
        select: {
          id: true,
          photoUrls: true,
          projectJournal: { select: { projectId: true } },
        },
      });
    }
    if (!entry) throw new NotFoundException('Registro nao encontrado');

    await ensureProjectWritable(this.prisma, entry.projectJournal.projectId);

    await removeLocalUploads(entry.photoUrls ?? []);
    await this.prisma.journalEntry.delete({ where: { id } });
    return { deleted: 1 };
  }
}
