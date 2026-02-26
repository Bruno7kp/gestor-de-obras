import type { StockItem, StockMovement } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

// Map backend ENTRY/EXIT enum to frontend entry/exit strings
function normalizeMovement(m: any): StockMovement {
  return {
    ...m,
    type: (m.type === 'ENTRY' ? 'entry' : 'exit') as StockMovement['type'],
  };
}

function normalizeItem(item: any): StockItem {
  return {
    ...item,
    movements: (item.movements ?? []).map(normalizeMovement),
  };
}

export const stockApi = {
  async list(projectId: string): Promise<StockItem[]> {
    const response = await fetch(
      `${API_BASE}/stock?projectId=${encodeURIComponent(projectId)}`,
      { method: 'GET', credentials: 'include' },
    );
    if (!response.ok) throw new Error('Falha ao carregar estoque');
    const data = await response.json();
    return (data as any[]).map(normalizeItem);
  },

  async create(
    projectId: string,
    input: { name: string; unit?: string; minQuantity?: number },
  ): Promise<StockItem> {
    const response = await fetch(`${API_BASE}/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ projectId, ...input }),
    });
    if (!response.ok) throw new Error('Falha ao criar item de estoque');
    return normalizeItem(await response.json());
  },

  async update(
    id: string,
    input: { name?: string; unit?: string; minQuantity?: number },
  ): Promise<StockItem> {
    const response = await fetch(`${API_BASE}/stock/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error('Falha ao atualizar item de estoque');
    return normalizeItem(await response.json());
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/stock/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Falha ao excluir item de estoque');
  },

  async addMovement(
    itemId: string,
    input: {
      type: 'entry' | 'exit';
      quantity: number;
      responsible?: string;
      notes?: string;
      date?: string;
    },
  ): Promise<StockItem> {
    const response = await fetch(`${API_BASE}/stock/${itemId}/movements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...input,
        type: input.type === 'entry' ? 'ENTRY' : 'EXIT',
      }),
    });
    if (!response.ok) throw new Error('Falha ao registrar movimentação');
    return normalizeItem(await response.json());
  },

  async updateMovement(
    movementId: string,
    input: {
      quantity?: number;
      responsible?: string;
      notes?: string;
      date?: string;
    },
  ): Promise<StockItem> {
    const response = await fetch(`${API_BASE}/stock/movements/${movementId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error('Falha ao atualizar movimentação');
    return normalizeItem(await response.json());
  },

  async deleteMovement(movementId: string): Promise<StockItem> {
    const response = await fetch(`${API_BASE}/stock/movements/${movementId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Falha ao excluir movimentação');
    return normalizeItem(await response.json());
  },

  async loadMoreMovements(
    itemId: string,
    skip: number,
    take = 10,
  ): Promise<{ movements: StockMovement[]; total: number }> {
    const response = await fetch(
      `${API_BASE}/stock/${itemId}/movements?skip=${skip}&take=${take}`,
      { method: 'GET', credentials: 'include' },
    );
    if (!response.ok) throw new Error('Falha ao carregar movimentações');
    const data = await response.json();
    return {
      movements: (data.movements ?? []).map(normalizeMovement),
      total: data.total,
    };
  },

  async reorder(
    projectId: string,
    items: Array<{ id: string; order: number }>,
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/stock/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ projectId, items }),
    });
    if (!response.ok) throw new Error('Falha ao reordenar estoque');
  },
};
