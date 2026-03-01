import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { removeLocalUploads } from '../uploads/file.utils';

interface UpdateGlobalSettingsInput {
  instanceId: string;
  defaultCompanyName?: string;
  companyCnpj?: string;
  userName?: string;
  language?: string;
  currencySymbol?: string;
}

interface CreateCertificateInput {
  instanceId: string;
  name: string;
  issuer: string;
  category?: string;
  expirationDate?: string | null;
  status: string;
  attachmentUrls?: unknown;
}

@Injectable()
export class GlobalSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private normalizeAttachmentUrls(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];

      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean);
        }
      } catch {
        // ignore and continue with fallback parsing
      }

      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        return trimmed
          .slice(1, -1)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      }

      return [trimmed];
    }

    if (value && typeof value === 'object') {
      const values = Object.values(value as Record<string, unknown>);
      return values
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  private async cleanupCertificateUploadsIfOrphaned(
    urls: Array<string | null | undefined>,
  ) {
    const unique = Array.from(new Set(urls.filter(Boolean))) as string[];
    if (unique.length === 0) return;

    const orphaned: string[] = [];
    for (const url of unique) {
      const count = await this.prisma.companyCertificate.count({
        where: { attachmentUrls: { has: url } },
      });
      if (count === 0) {
        orphaned.push(url);
      }
    }

    if (orphaned.length > 0) {
      await removeLocalUploads(orphaned);
    }
  }

  async getSettings(instanceId: string) {
    const settings = await this.prisma.globalSettings.findFirst({
      where: { instanceId },
      include: { certificates: true },
    });

    if (settings) return settings;

    return this.prisma.globalSettings.create({
      data: {
        instanceId,
        defaultCompanyName: 'Sua Empresa de Engenharia',
        companyCnpj: '',
        userName: 'Administrador',
        language: 'pt-BR',
        currencySymbol: 'R$',
      },
      include: { certificates: true },
    });
  }

  async updateSettings(input: UpdateGlobalSettingsInput) {
    const existing = await this.prisma.globalSettings.findFirst({
      where: { instanceId: input.instanceId },
    });

    if (!existing) throw new NotFoundException('Settings nao encontrados');

    return this.prisma.globalSettings
      .update({
        where: { id: existing.id },
        data: {
          defaultCompanyName:
            input.defaultCompanyName ?? existing.defaultCompanyName,
          companyCnpj: input.companyCnpj ?? existing.companyCnpj,
          userName: input.userName ?? existing.userName,
          language: input.language ?? existing.language,
          currencySymbol: input.currencySymbol ?? existing.currencySymbol,
        },
        include: { certificates: true },
      })
      .then((updated) => {
        void this.auditService.log({
          instanceId: input.instanceId,
          action: 'UPDATE',
          model: 'GlobalSettings',
          entityId: existing.id,
          before: JSON.parse(JSON.stringify(existing)) as Record<
            string,
            unknown
          >,
          after: JSON.parse(JSON.stringify(updated)) as Record<string, unknown>,
        });
        return updated;
      });
  }

  async addCertificate(input: CreateCertificateInput) {
    const settings = await this.prisma.globalSettings.findFirst({
      where: { instanceId: input.instanceId },
    });

    if (!settings) throw new NotFoundException('Settings nao encontrados');

    const attachmentUrls = this.normalizeAttachmentUrls(input.attachmentUrls);

    const created = await this.prisma.companyCertificate.create({
      data: {
        globalSettingsId: settings.id,
        name: input.name,
        issuer: input.issuer,
        category: input.category ?? 'OUTROS',
        expirationDate: input.expirationDate
          ? new Date(input.expirationDate)
          : null,
        status: input.status,
        attachmentUrls,
      },
    });

    const refreshed = await this.prisma.companyCertificate.findUnique({
      where: { id: created.id },
    });

    const result = refreshed ?? created;

    void this.auditService.log({
      instanceId: input.instanceId,
      action: 'CREATE',
      model: 'CompanyCertificate',
      entityId: result.id,
      after: JSON.parse(JSON.stringify(result)) as Record<string, unknown>,
    });

    return result;
  }

  async updateCertificate(
    id: string,
    input: {
      instanceId: string;
      name?: string;
      issuer?: string;
      category?: string;
      expirationDate?: string | null;
      status?: string;
      attachmentUrls?: unknown;
    },
  ) {
    const settings = await this.prisma.globalSettings.findFirst({
      where: { instanceId: input.instanceId },
      include: { certificates: { where: { id } } },
    });

    if (!settings || settings.certificates.length === 0) {
      throw new NotFoundException('Certificado nao encontrado');
    }

    const existingCertificate = settings.certificates[0];
    const normalizedInputAttachmentUrls =
      input.attachmentUrls !== undefined
        ? this.normalizeAttachmentUrls(input.attachmentUrls)
        : undefined;
    const nextAttachmentUrls =
      normalizedInputAttachmentUrls ?? existingCertificate.attachmentUrls;
    const removedUrls = (existingCertificate.attachmentUrls ?? []).filter(
      (url) => !nextAttachmentUrls.includes(url),
    );

    const updated = await this.prisma.companyCertificate.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.issuer !== undefined && { issuer: input.issuer }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.expirationDate !== undefined && {
          expirationDate: input.expirationDate
            ? new Date(input.expirationDate)
            : null,
        }),
        ...(input.status !== undefined && { status: input.status }),
        ...(normalizedInputAttachmentUrls !== undefined && {
          attachmentUrls: normalizedInputAttachmentUrls,
        }),
      },
    });

    const refreshed = await this.prisma.companyCertificate.findUnique({
      where: { id },
    });

    await this.cleanupCertificateUploadsIfOrphaned(removedUrls);

    const result = refreshed ?? updated;

    void this.auditService.log({
      instanceId: input.instanceId,
      action: 'UPDATE',
      model: 'CompanyCertificate',
      entityId: id,
      before: JSON.parse(JSON.stringify(existingCertificate)) as Record<
        string,
        unknown
      >,
      after: JSON.parse(JSON.stringify(result)) as Record<string, unknown>,
    });

    return result;
  }

  async removeCertificate(id: string, instanceId: string) {
    const settings = await this.prisma.globalSettings.findFirst({
      where: { instanceId },
      include: { certificates: { where: { id } } },
    });

    if (!settings || settings.certificates.length === 0) {
      throw new NotFoundException('Certificado nao encontrado');
    }

    const attachmentUrls = settings.certificates[0].attachmentUrls ?? [];

    await this.prisma.companyCertificate.delete({ where: { id } });
    await this.cleanupCertificateUploadsIfOrphaned(attachmentUrls);

    void this.auditService.log({
      instanceId,
      action: 'DELETE',
      model: 'CompanyCertificate',
      entityId: id,
      before: JSON.parse(JSON.stringify(settings.certificates[0])) as Record<
        string,
        unknown
      >,
    });

    return { deleted: 1 };
  }
}
