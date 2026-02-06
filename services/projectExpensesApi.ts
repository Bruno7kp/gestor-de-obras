import type { ProjectExpense } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

export const projectExpensesApi = {
  async list(projectId: string): Promise<ProjectExpense[]> {
    const response = await fetch(`${API_BASE}/project-expenses?projectId=${projectId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar despesas');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async create(projectId: string, expense: ProjectExpense): Promise<ProjectExpense> {
    const response = await fetch(`${API_BASE}/project-expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        ...expense,
        projectId,
      }),
    });

    if (!response.ok) {
      throw new Error('Falha ao criar despesa');
    }

    return response.json();
  },

  async update(id: string, input: Partial<ProjectExpense>) {
    const response = await fetch(`${API_BASE}/project-expenses/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar despesa');
    }

    return response.json();
  },

  async remove(id: string) {
    const response = await fetch(`${API_BASE}/project-expenses/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao excluir despesa');
    }
  },
};
