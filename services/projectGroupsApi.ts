import type { ProjectGroup } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

export const projectGroupsApi = {
  async list(): Promise<ProjectGroup[]> {
    const response = await fetch(`${API_BASE}/project-groups`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar grupos');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async create(input: { name: string; parentId?: string | null; order?: number }): Promise<ProjectGroup> {
    const response = await fetch(`${API_BASE}/project-groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao criar grupo');
    }

    return response.json();
  },

  async update(id: string, input: { name?: string; parentId?: string | null; order?: number }): Promise<ProjectGroup> {
    const response = await fetch(`${API_BASE}/project-groups/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar grupo');
    }

    return response.json();
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/project-groups/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao excluir grupo');
    }
  },
};
