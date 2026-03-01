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
  /** In-memory throttle map: key → last-written timestamp */
  private readonly throttleMap = new Map<string, number>();
  /** Default throttle window: 2 minutes */
  private static readonly THROTTLE_MS = 2 * 60 * 1000;

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

  /**
   * Throttled audit log: skips if an identical operation was logged
   * within the last `windowMs` milliseconds (default 2 min).
   * The throttle key is built from model + entityId + action + operation.
   */
  logThrottled(
    input: AuditLogInput,
    throttleKey?: string,
    windowMs?: number,
  ): void {
    const opValue = (input.metadata as Record<string, unknown> | null)
      ?.operation;
    const key =
      throttleKey ||
      `${input.model}:${input.entityId}:${input.action}:${typeof opValue === 'string' ? opValue : ''}`;
    const now = Date.now();
    const lastWrite = this.throttleMap.get(key);

    if (lastWrite && now - lastWrite < (windowMs ?? AuditService.THROTTLE_MS)) {
      return; // Skip — too recent
    }

    this.throttleMap.set(key, now);
    this.log(input);

    // Periodic cleanup of stale keys (every 1000 entries)
    if (this.throttleMap.size > 1000) {
      const cutoff = now - (windowMs ?? AuditService.THROTTLE_MS) * 2;
      for (const [k, ts] of this.throttleMap) {
        if (ts < cutoff) this.throttleMap.delete(k);
      }
    }
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

  /** Single audit entry detail (instance-scoped) */
  async findById(id: string, instanceId: string) {
    return this.prisma.auditLog.findFirst({
      where: { id, instanceId },
      include: {
        user: { select: { id: true, name: true, profileImage: true } },
      },
    });
  }

  /** Return distinct model names that have audit entries for this instance */
  async distinctModels(instanceId: string): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { instanceId },
      distinct: ['model'],
      select: { model: true },
      orderBy: { model: 'asc' },
    });
    return rows.map((r) => r.model);
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
