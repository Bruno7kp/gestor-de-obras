import type { JournalEntry } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

export const journalApi = {
  async list(projectId: string): Promise<JournalEntry[]> {
    const response = await fetch(`${API_BASE}/journal/entries?projectId=${projectId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar diario');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async create(projectId: string, entry: JournalEntry): Promise<JournalEntry> {
    const response = await fetch(`${API_BASE}/journal/entries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        ...entry,
        projectId,
      }),
    });

    if (!response.ok) {
      throw new Error('Falha ao criar registro');
    }

    return response.json();
  },

  async update(id: string, input: Partial<JournalEntry>) {
    const response = await fetch(`${API_BASE}/journal/entries/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar registro');
    }

    return response.json();
  },

  async remove(id: string) {
    const response = await fetch(`${API_BASE}/journal/entries/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao remover registro');
    }
  },
};
