import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
  expirationDate: string;
  status: string;
}

@Injectable()
export class GlobalSettingsService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.globalSettings.update({
      where: { id: existing.id },
      data: {
        defaultCompanyName: input.defaultCompanyName ?? existing.defaultCompanyName,
        companyCnpj: input.companyCnpj ?? existing.companyCnpj,
        userName: input.userName ?? existing.userName,
        language: input.language ?? existing.language,
        currencySymbol: input.currencySymbol ?? existing.currencySymbol,
      },
      include: { certificates: true },
    });
  }

  async addCertificate(input: CreateCertificateInput) {
    const settings = await this.prisma.globalSettings.findFirst({
      where: { instanceId: input.instanceId },
    });

    if (!settings) throw new NotFoundException('Settings nao encontrados');

    return this.prisma.companyCertificate.create({
      data: {
        globalSettingsId: settings.id,
        name: input.name,
        issuer: input.issuer,
        expirationDate: new Date(input.expirationDate),
        status: input.status,
      },
    });
  }

  async removeCertificate(id: string, instanceId: string) {
    const settings = await this.prisma.globalSettings.findFirst({
      where: { instanceId },
      include: { certificates: { where: { id } } },
    });

    if (!settings || settings.certificates.length === 0) {
      throw new NotFoundException('Certificado nao encontrado');
    }

    await this.prisma.companyCertificate.delete({ where: { id } });
    return { deleted: 1 };
  }
}
