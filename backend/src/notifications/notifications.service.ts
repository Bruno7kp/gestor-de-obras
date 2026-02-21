import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

interface EmitNotificationInput {
  instanceId: string;
  projectId?: string | null;
  actorUserId?: string;
  category: string;
  eventType: string;
  title: string;
  body: string;
  priority?: NotificationPriority;
  metadata?: Prisma.InputJsonValue;
  dedupeKey?: string;
  specificUserIds?: string[];
  permissionCodes?: string[];
  includeProjectMembers?: boolean;
}

interface UpsertPreferenceInput {
  userId: string;
  instanceId: string;
  projectId?: string | null;
  category: string;
  eventType?: string;
  channelInApp?: boolean;
  channelEmail?: boolean;
  frequency?: 'immediate' | 'digest' | 'off';
  minPriority?: NotificationPriority;
  isEnabled?: boolean;
}

interface PreferenceResolved {
  channelInApp: boolean;
  channelEmail: boolean;
  frequency: 'immediate' | 'digest' | 'off';
  minPriority: NotificationPriority;
  isEnabled: boolean;
}

export interface NotificationActor {
  id: string;
  name: string;
  profileImage: string | null;
}

export interface DigestPreviewGroup {
  key: string;
  projectId: string | null;
  category: string;
  eventType: string;
  count: number;
  highestPriority: NotificationPriority;
  firstTriggeredAt: string;
  lastTriggeredAt: string;
  sampleTitles: string[];
}

const DEFAULT_PREFERENCE: PreferenceResolved = {
  channelInApp: true,
  channelEmail: false,
  frequency: 'immediate',
  minPriority: 'normal',
  isEnabled: true,
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  private priorityWeight(priority: NotificationPriority) {
    if (priority === 'critical') return 4;
    if (priority === 'high') return 3;
    if (priority === 'normal') return 2;
    return 1;
  }

  private maxPriority(
    a: NotificationPriority,
    b: NotificationPriority,
  ): NotificationPriority {
    return this.priorityWeight(a) >= this.priorityWeight(b) ? a : b;
  }

  private normalizePriority(priority?: string): NotificationPriority {
    if (
      priority === 'critical' ||
      priority === 'high' ||
      priority === 'normal' ||
      priority === 'low'
    ) {
      return priority;
    }
    return 'normal';
  }

  private normalizeFrequency(
    frequency?: string,
  ): 'immediate' | 'digest' | 'off' {
    if (
      frequency === 'immediate' ||
      frequency === 'digest' ||
      frequency === 'off'
    ) {
      return frequency;
    }
    return 'immediate';
  }

  private getPreferenceScore(
    pref: { projectId: string | null; category: string; eventType: string },
    targetProjectId: string | null,
    category: string,
    eventType: string,
  ) {
    let score = 0;
    if (pref.projectId && pref.projectId === targetProjectId) score += 8;
    else if (pref.projectId === null) score += 2;

    if (pref.category === category) score += 4;
    else if (pref.category === '*') score += 1;

    if (pref.eventType === eventType) score += 2;
    else if (pref.eventType === '*') score += 1;

    return score;
  }

  private async resolveCandidateUsers(input: EmitNotificationInput) {
    const explicitUserIds = new Set<string>();

    if (Array.isArray(input.specificUserIds)) {
      input.specificUserIds.forEach((id) => {
        if (id) explicitUserIds.add(id);
      });
    }

    let scopedUserIds: Set<string> | null = null;

    if (input.permissionCodes && input.permissionCodes.length > 0) {
      const byGlobalPermission = await this.prisma.user.findMany({
        where: {
          instanceId: input.instanceId,
          status: 'ACTIVE',
          roles: {
            some: {
              role: {
                permissions: {
                  some: {
                    permission: {
                      code: { in: input.permissionCodes },
                    },
                  },
                },
              },
            },
          },
        },
        select: { id: true },
      });

      const byProjectMembershipPermission = input.projectId
        ? await this.prisma.projectMember.findMany({
            where: {
              projectId: input.projectId,
              user: { status: 'ACTIVE' },
              assignedRole: {
                permissions: {
                  some: {
                    permission: {
                      code: { in: input.permissionCodes },
                    },
                  },
                },
              },
            },
            select: { userId: true },
          })
        : [];

      scopedUserIds = new Set([
        ...byGlobalPermission.map((user) => user.id),
        ...byProjectMembershipPermission.map((member) => member.userId),
      ]);
    }

    if (input.includeProjectMembers && input.projectId) {
      const members = await this.prisma.projectMember.findMany({
        where: { projectId: input.projectId },
        select: { userId: true },
      });

      const privilegedUsers = await this.prisma.user.findMany({
        where: {
          instanceId: input.instanceId,
          status: 'ACTIVE',
          OR: [
            {
              roles: {
                some: {
                  role: {
                    name: { in: ['ADMIN', 'SUPER_ADMIN'] },
                  },
                },
              },
            },
            {
              roles: {
                some: {
                  role: {
                    permissions: {
                      some: {
                        permission: {
                          code: {
                            in: [
                              'projects_general.view',
                              'projects_general.edit',
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
        select: { id: true },
      });

      const memberIds = new Set(members.map((member) => member.userId));
      if (scopedUserIds) {
        scopedUserIds = new Set(
          Array.from(scopedUserIds).filter((userId) => memberIds.has(userId)),
        );
      } else {
        scopedUserIds = memberIds;
      }

      privilegedUsers.forEach((user) => scopedUserIds?.add(user.id));
    }

    const userIds = new Set<string>(explicitUserIds);
    if (scopedUserIds) {
      scopedUserIds.forEach((id) => userIds.add(id));
    }

    if (userIds.size === 0) return [];

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: Array.from(userIds) },
        status: 'ACTIVE',
      },
      select: { id: true, email: true, name: true },
    });

    return users;
  }

  private async resolvePreferences(
    userIds: string[],
    instanceId: string,
    projectId: string | null,
    category: string,
    eventType: string,
  ) {
    if (userIds.length === 0) {
      return new Map<string, PreferenceResolved>();
    }

    const preferences = await this.prisma.notificationPreference.findMany({
      where: {
        userId: { in: userIds },
        user: { instanceId },
        category: { in: [category, '*'] },
        eventType: { in: [eventType, '*'] },
        OR: projectId
          ? [{ projectId }, { projectId: null }]
          : [{ projectId: null }],
      },
      select: {
        userId: true,
        projectId: true,
        category: true,
        eventType: true,
        channelInApp: true,
        channelEmail: true,
        frequency: true,
        minPriority: true,
        isEnabled: true,
      },
    });

    const map = new Map<string, PreferenceResolved>();

    for (const userId of userIds) {
      const userPrefs = preferences.filter((pref) => pref.userId === userId);
      if (userPrefs.length === 0) {
        map.set(userId, DEFAULT_PREFERENCE);
        continue;
      }

      let best = userPrefs[0];
      let bestScore = this.getPreferenceScore(
        best,
        projectId,
        category,
        eventType,
      );

      for (let idx = 1; idx < userPrefs.length; idx += 1) {
        const current = userPrefs[idx];
        const currentScore = this.getPreferenceScore(
          current,
          projectId,
          category,
          eventType,
        );
        if (currentScore > bestScore) {
          best = current;
          bestScore = currentScore;
        }
      }

      map.set(userId, {
        channelInApp: best.channelInApp,
        channelEmail: best.channelEmail,
        frequency: this.normalizeFrequency(best.frequency),
        minPriority: this.normalizePriority(best.minPriority),
        isEnabled: best.isEnabled,
      });
    }

    return map;
  }

  private extractActorFromMetadata(
    metadata: Prisma.JsonValue | null,
  ): NotificationActor | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return null;
    }

    const actor = metadata.actor;
    if (!actor || typeof actor !== 'object' || Array.isArray(actor)) {
      return null;
    }

    const actorObject = actor;
    const id = actorObject.id;
    const name = actorObject.name;
    const profileImage = actorObject.profileImage;

    if (typeof id !== 'string' || typeof name !== 'string') {
      return null;
    }

    return {
      id,
      name,
      profileImage: typeof profileImage === 'string' ? profileImage : null,
    };
  }

  async emit(input: EmitNotificationInput) {
    let effectiveInstanceId = input.instanceId;
    if (input.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { instanceId: true },
      });
      if (project?.instanceId) {
        effectiveInstanceId = project.instanceId;
      }
    }

    const priority = this.normalizePriority(input.priority);
    const projectId = input.projectId ?? null;
    const candidateUsers = await this.resolveCandidateUsers({
      ...input,
      instanceId: effectiveInstanceId,
    });

    const filteredCandidateUsers = input.actorUserId
      ? candidateUsers.filter((user) => user.id !== input.actorUserId)
      : candidateUsers;

    if (filteredCandidateUsers.length === 0) {
      return null;
    }

    const actor = input.actorUserId
      ? await this.prisma.user.findUnique({
          where: { id: input.actorUserId },
          select: { id: true, name: true, profileImage: true },
        })
      : null;

    let metadata = input.metadata;
    if (actor) {
      const metadataObject: Prisma.JsonObject =
        metadata && typeof metadata === 'object' && !Array.isArray(metadata)
          ? { ...(metadata as Prisma.JsonObject) }
          : {};

      metadataObject.actor = {
        id: actor.id,
        name: actor.name,
        profileImage: actor.profileImage,
      };

      metadata = metadataObject as Prisma.InputJsonValue;
    }

    const preferences = await this.resolvePreferences(
      filteredCandidateUsers.map((user) => user.id),
      effectiveInstanceId,
      projectId,
      input.category,
      input.eventType,
    );

    const recipientRows: Array<{
      notificationId: string;
      userId: string;
      channelInApp: boolean;
      channelEmail: boolean;
    }> = [];

    const deliveryRows: Array<{
      notificationId: string;
      userId: string;
      channel: string;
      status: string;
      nextAttemptAt: Date | null;
      payload: Prisma.InputJsonValue;
    }> = [];

    let notificationId: string | null = null;

    if (input.dedupeKey) {
      const dedupeSince = new Date(Date.now() - 10 * 60 * 1000);
      const existing = await this.prisma.notification.findFirst({
        where: {
          instanceId: effectiveInstanceId,
          dedupeKey: input.dedupeKey,
          createdAt: { gte: dedupeSince },
        },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });
      notificationId = existing?.id ?? null;
    }

    if (!notificationId) {
      const created = await this.prisma.notification.create({
        data: {
          instanceId: effectiveInstanceId,
          projectId,
          category: input.category,
          eventType: input.eventType,
          priority,
          title: input.title,
          body: input.body,
          metadata,
          dedupeKey: input.dedupeKey,
          triggeredAt: new Date(),
        },
        select: { id: true },
      });
      notificationId = created.id;
    }

    if (!notificationId) {
      return null;
    }

    for (const user of filteredCandidateUsers) {
      const preference = preferences.get(user.id) ?? DEFAULT_PREFERENCE;

      if (!preference.isEnabled) continue;
      if (
        this.priorityWeight(priority) <
        this.priorityWeight(preference.minPriority)
      ) {
        continue;
      }
      if (preference.frequency === 'off') continue;

      const shouldInApp = preference.channelInApp;
      const shouldEmail = preference.channelEmail;

      if (!shouldInApp && !shouldEmail) continue;

      recipientRows.push({
        notificationId,
        userId: user.id,
        channelInApp: shouldInApp,
        channelEmail: shouldEmail,
      });

      if (shouldEmail) {
        deliveryRows.push({
          notificationId,
          userId: user.id,
          channel: 'email',
          status:
            preference.frequency === 'digest' ? 'digest_pending' : 'pending',
          nextAttemptAt: null,
          payload: {
            email: user.email,
            userName: user.name,
            eventType: input.eventType,
          },
        });
      }
    }

    if (recipientRows.length > 0) {
      await this.prisma.notificationRecipient.createMany({
        data: recipientRows,
        skipDuplicates: true,
      });
    }

    if (deliveryRows.length > 0) {
      await this.prisma.notificationDelivery.createMany({
        data: deliveryRows,
        skipDuplicates: true,
      });
      void this.processPendingEmailDeliveries(25);
    }

    return this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
  }

  async listForUser(
    userId: string,
    instanceId: string,
    projectId?: string,
    unreadOnly?: boolean,
    limit = 50,
    permissions: string[] = [],
  ) {
    const rows = await this.prisma.notificationRecipient.findMany({
      where: {
        userId,
        channelInApp: true,
        ...(unreadOnly ? { isRead: false } : {}),
        notification: {
          ...(projectId ? { projectId } : {}),
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      include: {
        notification: {
          select: {
            id: true,
            projectId: true,
            category: true,
            eventType: true,
            priority: true,
            title: true,
            body: true,
            metadata: true,
            triggeredAt: true,
            createdAt: true,
          },
        },
      },
    });

    const globalPermissions = new Set(permissions);
    const adminRoleCount = await this.prisma.userRole.count({
      where: {
        userId,
        role: {
          instanceId,
          name: { in: ['ADMIN', 'SUPER_ADMIN'] },
        },
      },
    });
    const hasPrincipalAccess =
      adminRoleCount > 0 ||
      globalPermissions.has('projects_general.view') ||
      globalPermissions.has('projects_general.edit');
    const relevantProjectIds = Array.from(
      new Set(
        rows
          .filter(
            (row) =>
              (row.notification.eventType === 'LABOR_CONTRACT_CREATED' ||
                row.notification.eventType ===
                  'LABOR_CONTRACT_STATUS_CHANGED' ||
                row.notification.eventType === 'LABOR_PAYMENT_RECORDED' ||
                row.notification.category === 'WORKFORCE' ||
                row.notification.eventType === 'EXPENSE_PAID' ||
                row.notification.eventType === 'EXPENSE_DELIVERED' ||
                row.notification.eventType === 'MATERIAL_ON_SITE_CONFIRMED' ||
                row.notification.category === 'SUPPLIES' ||
                row.notification.category === 'FINANCIAL' ||
                row.notification.category === 'PLANNING') &&
              !!row.notification.projectId,
          )
          .map((row) => row.notification.projectId as string),
      ),
    );

    const projectMemberships = relevantProjectIds.length
      ? await this.prisma.projectMember.findMany({
          where: {
            userId,
            projectId: { in: relevantProjectIds },
          },
          include: {
            assignedRole: {
              include: {
                permissions: {
                  include: {
                    permission: { select: { code: true } },
                  },
                },
              },
            },
          },
        })
      : [];

    const projectPermissions = new Map<string, Set<string>>();
    for (const member of projectMemberships) {
      projectPermissions.set(
        member.projectId,
        new Set(
          member.assignedRole.permissions.map((rp) => rp.permission.code),
        ),
      );
    }

    const hasAnyPermission = (
      rowProjectId: string | null,
      requiredCodes: string[],
    ) => {
      if (hasPrincipalAccess) {
        return true;
      }
      if (requiredCodes.some((code) => globalPermissions.has(code))) {
        return true;
      }
      if (!rowProjectId) return false;
      const memberPermissions = projectPermissions.get(rowProjectId);
      if (!memberPermissions) return false;
      return requiredCodes.some((code) => memberPermissions.has(code));
    };

    const scopedRows = rows.filter((row) => {
      if (
        row.notification.eventType === 'LABOR_CONTRACT_CREATED' ||
        row.notification.eventType === 'LABOR_CONTRACT_STATUS_CHANGED' ||
        row.notification.eventType === 'LABOR_PAYMENT_RECORDED' ||
        row.notification.category === 'WORKFORCE'
      ) {
        return hasAnyPermission(row.notification.projectId, [
          'workforce.view',
          'workforce.edit',
        ]);
      }

      if (
        row.notification.eventType === 'EXPENSE_PAID' ||
        row.notification.eventType === 'EXPENSE_DELIVERED' ||
        row.notification.eventType === 'MATERIAL_ON_SITE_CONFIRMED' ||
        row.notification.category === 'SUPPLIES' ||
        row.notification.category === 'FINANCIAL'
      ) {
        return hasAnyPermission(row.notification.projectId, [
          'supplies.view',
          'supplies.edit',
        ]);
      }

      if (row.notification.category === 'PLANNING') {
        return hasAnyPermission(row.notification.projectId, [
          'planning.view',
          'planning.edit',
        ]);
      }

      return true;
    });

    return scopedRows.map((row) => ({
      id: row.notification.id,
      recipientId: row.id,
      projectId: row.notification.projectId,
      category: row.notification.category,
      eventType: row.notification.eventType,
      priority: row.notification.priority,
      title: row.notification.title,
      body: row.notification.body,
      metadata: row.notification.metadata,
      actor: this.extractActorFromMetadata(row.notification.metadata),
      triggeredAt: row.notification.triggeredAt,
      createdAt: row.notification.createdAt,
      isRead: row.isRead,
      readAt: row.readAt,
    }));
  }

  async markRead(notificationId: string, userId: string) {
    const target = await this.prisma.notificationRecipient.findFirst({
      where: {
        userId,
        notificationId,
      },
      select: { id: true },
    });

    if (!target) {
      throw new NotFoundException('Notificacao nao encontrada');
    }

    await this.prisma.notificationRecipient.update({
      where: { id: target.id },
      data: { isRead: true, readAt: new Date() },
    });

    return { updated: 1 };
  }

  async markAllRead(userId: string, projectId?: string) {
    const result = await this.prisma.notificationRecipient.updateMany({
      where: {
        userId,
        isRead: false,
        channelInApp: true,
        notification: {
          ...(projectId ? { projectId } : {}),
        },
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updated: result.count };
  }

  async removeForUser(notificationId: string, userId: string) {
    const target = await this.prisma.notificationRecipient.findFirst({
      where: {
        userId,
        notificationId,
      },
      select: { id: true },
    });

    if (!target) {
      throw new NotFoundException('Notificacao nao encontrada');
    }

    await this.prisma.notificationRecipient.delete({
      where: { id: target.id },
    });

    return { deleted: 1 };
  }

  async listPreferences(
    userId: string,
    instanceId: string,
    projectId?: string,
  ) {
    return this.prisma.notificationPreference.findMany({
      where: {
        userId,
        user: { instanceId },
        ...(projectId ? { OR: [{ projectId }, { projectId: null }] } : {}),
      },
      orderBy: [
        { projectId: 'asc' },
        { category: 'asc' },
        { eventType: 'asc' },
      ],
    });
  }

  async upsertPreference(input: UpsertPreferenceInput) {
    const eventType = input.eventType || '*';
    const projectId = input.projectId ?? null;

    const existing = await this.prisma.notificationPreference.findFirst({
      where: {
        userId: input.userId,
        user: { instanceId: input.instanceId },
        projectId,
        category: input.category,
        eventType,
      },
      select: { id: true },
    });

    if (existing) {
      return this.prisma.notificationPreference.update({
        where: { id: existing.id },
        data: {
          channelInApp:
            input.channelInApp === undefined ? undefined : input.channelInApp,
          channelEmail:
            input.channelEmail === undefined ? undefined : input.channelEmail,
          frequency: input.frequency,
          minPriority: input.minPriority,
          isEnabled:
            input.isEnabled === undefined ? undefined : input.isEnabled,
        },
      });
    }

    return this.prisma.notificationPreference.create({
      data: {
        userId: input.userId,
        projectId,
        category: input.category,
        eventType,
        channelInApp:
          input.channelInApp === undefined
            ? DEFAULT_PREFERENCE.channelInApp
            : input.channelInApp,
        channelEmail:
          input.channelEmail === undefined
            ? DEFAULT_PREFERENCE.channelEmail
            : input.channelEmail,
        frequency: this.normalizeFrequency(input.frequency),
        minPriority: this.normalizePriority(input.minPriority),
        isEnabled: input.isEnabled === undefined ? true : input.isEnabled,
      },
    });
  }

  async processPendingEmailDeliveries(limit = 100) {
    const now = new Date();
    const deliveries = await this.prisma.notificationDelivery.findMany({
      where: {
        channel: 'email',
        status: 'pending',
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      include: {
        user: { select: { email: true, name: true } },
        notification: {
          select: {
            title: true,
            body: true,
            category: true,
            priority: true,
            project: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 200),
    });

    let sent = 0;
    let failed = 0;

    for (const delivery of deliveries) {
      try {
        await this.mailService.sendNotificationEmail({
          to: delivery.user.email,
          subject: `[${delivery.notification.priority.toUpperCase()}] ${delivery.notification.title}`,
          html: `<p>Olá ${delivery.user.name},</p><p>${delivery.notification.body}</p><p><strong>Categoria:</strong> ${delivery.notification.category}</p><p><strong>Projeto:</strong> ${delivery.notification.project?.name ?? 'N/A'}</p>`,
        });

        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'sent',
            attempts: { increment: 1 },
            sentAt: new Date(),
            lastError: null,
            nextAttemptAt: null,
          },
        });
        sent += 1;
      } catch (error) {
        const attempts = delivery.attempts + 1;
        const shouldFail = attempts >= 5;
        const retryMinutes = Math.min(60, 2 ** attempts);
        const nextAttemptAt = shouldFail
          ? null
          : new Date(Date.now() + retryMinutes * 60 * 1000);

        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: shouldFail ? 'failed' : 'pending',
            attempts,
            lastError:
              error instanceof Error ? error.message : 'Erro no envio de email',
            nextAttemptAt,
          },
        });

        failed += 1;
      }
    }

    if (deliveries.length > 0) {
      this.logger.log(
        `Processamento de email concluido: ${sent} enviados, ${failed} falhas`,
      );
    }

    return { processed: deliveries.length, sent, failed };
  }

  async getDigestPreview(
    userId: string,
    instanceId: string,
    options?: {
      projectId?: string;
      windowMinutes?: number;
      unreadOnly?: boolean;
      limitGroups?: number;
    },
  ) {
    const windowMinutes = Math.min(
      Math.max(options?.windowMinutes ?? 1440, 5),
      60 * 24 * 30,
    );
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    const limitGroups = Math.min(Math.max(options?.limitGroups ?? 25, 1), 200);

    const rows = await this.prisma.notificationRecipient.findMany({
      where: {
        userId,
        channelInApp: true,
        ...(options?.unreadOnly ? { isRead: false } : {}),
        notification: {
          instanceId,
          createdAt: { gte: since },
          ...(options?.projectId ? { projectId: options.projectId } : {}),
        },
      },
      include: {
        notification: {
          select: {
            id: true,
            projectId: true,
            category: true,
            eventType: true,
            priority: true,
            title: true,
            triggeredAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });

    const groups = new Map<string, DigestPreviewGroup>();

    for (const row of rows) {
      const notification = row.notification;
      const priority = this.normalizePriority(notification.priority);
      const key = `${notification.projectId ?? 'global'}::${notification.category}::${notification.eventType}`;
      const triggeredAtIso = notification.triggeredAt.toISOString();

      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, {
          key,
          projectId: notification.projectId,
          category: notification.category,
          eventType: notification.eventType,
          count: 1,
          highestPriority: priority,
          firstTriggeredAt: triggeredAtIso,
          lastTriggeredAt: triggeredAtIso,
          sampleTitles: [notification.title],
        });
        continue;
      }

      existing.count += 1;
      existing.highestPriority = this.maxPriority(
        existing.highestPriority,
        priority,
      );
      if (triggeredAtIso < existing.firstTriggeredAt) {
        existing.firstTriggeredAt = triggeredAtIso;
      }
      if (triggeredAtIso > existing.lastTriggeredAt) {
        existing.lastTriggeredAt = triggeredAtIso;
      }
      if (
        existing.sampleTitles.length < 3 &&
        !existing.sampleTitles.includes(notification.title)
      ) {
        existing.sampleTitles.push(notification.title);
      }
    }

    const preview = Array.from(groups.values())
      .sort((a, b) => {
        if (a.count !== b.count) return b.count - a.count;
        return b.lastTriggeredAt.localeCompare(a.lastTriggeredAt);
      })
      .slice(0, limitGroups);

    const totalEvents = rows.length;
    const groupedEvents = preview.reduce((sum, group) => sum + group.count, 0);

    return {
      windowMinutes,
      generatedAt: new Date().toISOString(),
      totalEvents,
      totalGroups: preview.length,
      groupedEvents,
      groups: preview,
    };
  }
}
