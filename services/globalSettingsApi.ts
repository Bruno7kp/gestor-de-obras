import type { CompanyCertificate, GlobalSettings } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

const normalizeAttachmentUrls = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  }

  if (typeof value === 'string' && value.trim()) {
    if (value.startsWith('{') && value.endsWith('}')) {
      return value
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [value.trim()];
  }

  return [];
};

const normalizeCertificate = (cert: any): CompanyCertificate => ({
  ...cert,
  attachmentUrls: normalizeAttachmentUrls(cert?.attachmentUrls),
});

export const globalSettingsApi = {
  async get(): Promise<GlobalSettings> {
    const response = await fetch(`${API_BASE}/global-settings`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar configuracoes');
    }

    const data = await response.json();
    return {
      defaultCompanyName: data.defaultCompanyName ?? 'Sua Empresa de Engenharia',
      companyCnpj: data.companyCnpj ?? '',
      userName: data.userName ?? 'Administrador',
      language: data.language ?? 'pt-BR',
      currencySymbol: data.currencySymbol ?? 'R$',
      certificates: (data.certificates ?? []).map(normalizeCertificate),
    };
  },

  async update(input: Partial<GlobalSettings>): Promise<GlobalSettings> {
    const response = await fetch(`${API_BASE}/global-settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar configuracoes');
    }

    const data = await response.json();
    return {
      defaultCompanyName: data.defaultCompanyName ?? 'Sua Empresa de Engenharia',
      companyCnpj: data.companyCnpj ?? '',
      userName: data.userName ?? 'Administrador',
      language: data.language ?? 'pt-BR',
      currencySymbol: data.currencySymbol ?? 'R$',
      certificates: (data.certificates ?? []).map(normalizeCertificate),
    };
  },

  async addCertificate(input: Omit<CompanyCertificate, 'id'>): Promise<CompanyCertificate> {
    const response = await fetch(`${API_BASE}/global-settings/certificates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao criar certidao');
    }

    return normalizeCertificate(await response.json());
  },

  async removeCertificate(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/global-settings/certificates/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao remover certidao');
    }
  },

  async updateCertificate(id: string, input: Partial<Omit<CompanyCertificate, 'id'>>): Promise<CompanyCertificate> {
    const response = await fetch(`${API_BASE}/global-settings/certificates/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar certidao');
    }

    return normalizeCertificate(await response.json());
  },
};
