import type { CompanyCertificate, GlobalSettings } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

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
      certificates: data.certificates ?? [],
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
      certificates: data.certificates ?? [],
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

    return response.json();
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

    return response.json();
  },
};
