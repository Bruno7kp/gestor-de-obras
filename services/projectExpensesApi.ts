import type { ProjectExpense } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

export const projectExpensesApi = {
  async getMaterialSuggestions(projectId: string, query: string, limit = 8, supplierId?: string) {
    const params = new URLSearchParams({
      projectId,
      q: query,
      limit: String(limit),
    });

    if (supplierId) {
      params.set('supplierId', supplierId);
    }

    const response = await fetch(`${API_BASE}/project-expenses/material-suggestions?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar sugestões de material');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

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
      let message = 'Falha ao criar despesa';
      try {
        const text = await response.text();
        if (text) {
          try {
            const data = JSON.parse(text);
            if (data?.message) {
              message = Array.isArray(data.message) ? data.message.join(', ') : String(data.message);
            } else if (data?.error) {
              message = String(data.error);
            } else {
              message = text;
            }
          } catch {
            message = text;
          }
        }
      } catch {
        // keep default message
      }
      throw new Error(message);
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

  async batch(projectId: string, expenses: ProjectExpense[], replaceTypes?: string[]): Promise<void> {
    const response = await fetch(`${API_BASE}/project-expenses/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ projectId, expenses: expenses.map(e => ({ ...e })), replaceTypes }),
    });

    if (!response.ok) {
      throw new Error('Falha ao enviar batch de despesas');
    }
  },

  async remove(id: string) {
    const response = await fetch(`${API_BASE}/project-expenses/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      let msg = 'Falha ao excluir despesa';
      try {
        const body = await response.json();
        if (body.message) msg = typeof body.message === 'string' ? body.message : body.message[0];
      } catch { /* ignore parse errors */ }
      throw new Error(msg);
    }
  },
};
