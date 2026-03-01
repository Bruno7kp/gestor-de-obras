import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type JsonRecord = Record<string, unknown>;

export interface AuditLogInput {
  instanceId: string;
  userId?: string | null;
  projectId?: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  model: string;
  entityId: string;
  before?: JsonRecord | null;
  after?: JsonRecord | null;
  metadata?: JsonRecord | null;
}

/** Fields that are never interesting in audit diffs */
const IGNORED_DIFF_FIELDS = new Set(['updatedAt', 'createdAt', 'updatedById']);

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fire-and-forget audit log entry.
   * Call this AFTER the mutation succeeds so we never block the main operation.
   */
  log(input: AuditLogInput): void {
    const changes = this.computeChanges(input);

    this.prisma.auditLog
      .create({
        data: {
          instanceId: input.instanceId,
          userId: input.userId ?? null,
          projectId: input.projectId ?? null,
          action: input.action,
          model: input.model,
          entityId: input.entityId,
          changes: (changes as Prisma.InputJsonValue) ?? undefined,
          metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
        },
      })
      .catch((err: Error) => {
        console.error('[AuditService] Failed to write audit log:', err.message);
      });
  }

  /** Paginated list of audit entries with optional filters */
  async list(params: {
    instanceId: string;
    model?: string;
    entityId?: string;
    projectId?: string;
    userId?: string;
    action?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = { instanceId: params.instanceId };
    if (params.model) where.model = params.model;
    if (params.entityId) where.entityId = params.entityId;
    if (params.projectId) where.projectId = params.projectId;
    if (params.userId) where.userId = params.userId;
    if (params.action) where.action = params.action;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, profileImage: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: items,
      total,
      page,
      pageSize: limit,
    };
  }

  /** Single audit entry detail */
  async findById(id: string) {
    return this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, profileImage: true } },
      },
    });
  }

  // ─── Private helpers ───────────────────────────────────

  private computeChanges(
    input: AuditLogInput,
  ): Record<string, { from: unknown; to: unknown }> | null {
    if (input.action === 'CREATE' && input.after) {
      // For creates, store all non-null fields as "to" values
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const [key, value] of Object.entries(input.after)) {
        if (IGNORED_DIFF_FIELDS.has(key)) continue;
        if (value != null && value !== '' && value !== 0 && value !== false) {
          changes[key] = { from: null, to: value };
        }
      }
      return Object.keys(changes).length > 0 ? changes : null;
    }

    if (input.action === 'UPDATE' && input.before && input.after) {
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const [key, value] of Object.entries(input.after)) {
        if (IGNORED_DIFF_FIELDS.has(key)) continue;
        const prev: unknown = input.before[key];
        if (!this.isEqual(prev, value)) {
          changes[key] = { from: prev ?? null, to: value ?? null };
        }
      }
      return Object.keys(changes).length > 0 ? changes : null;
    }

    if (input.action === 'DELETE' && input.before) {
      // For deletes, store key identifying fields
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const [key, value] of Object.entries(input.before)) {
        if (IGNORED_DIFF_FIELDS.has(key)) continue;
        if (value != null && value !== '' && value !== 0 && value !== false) {
          changes[key] = { from: value, to: null };
        }
      }
      return Object.keys(changes).length > 0 ? changes : null;
    }

    return null;
  }

  private isEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null && b == null) return true;
    if (typeof a === 'number' && typeof b === 'number') {
      return Math.abs(a - b) < 0.0001;
    }
    if (typeof a === 'object' && typeof b === 'object') {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    return false;
  }
}
