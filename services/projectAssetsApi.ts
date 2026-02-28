import type { ProjectAsset } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

export const projectAssetsApi = {
  async list(projectId: string): Promise<ProjectAsset[]> {
    const response = await fetch(`${API_BASE}/project-assets?projectId=${projectId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar arquivos');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async create(projectId: string, asset: ProjectAsset): Promise<ProjectAsset> {
    const response = await fetch(`${API_BASE}/project-assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        ...asset,
        projectId,
      }),
    });

    if (!response.ok) {
      throw new Error('Falha ao criar arquivo');
    }

    return response.json();
  },

  async update(id: string, data: Partial<ProjectAsset>): Promise<ProjectAsset> {
    const response = await fetch(`${API_BASE}/project-assets/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar arquivo');
    }

    return response.json();
  },

  async remove(id: string) {
    const response = await fetch(`${API_BASE}/project-assets/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao remover arquivo');
    }
  },
};
