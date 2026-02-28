import type {
  GlobalStockItem,
  GlobalStockMovement,
  StockMovementType,
} from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

function normalizeMovement(m: any): GlobalStockMovement {
  return {
    ...m,
    type: (m.type === 'ENTRY' ? 'entry' : 'exit') as StockMovementType,
  };
}

function normalizeItem(item: any): GlobalStockItem {
  return { ...item };
}

export const globalStockApi = {
  async list(): Promise<GlobalStockItem[]> {
    const res = await fetch(`${API_BASE}/global-stock`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Falha ao carregar estoque global');
    return (await res.json()).map(normalizeItem);
  },

  async create(input: {
    name: string;
    unit?: string;
    minQuantity?: number | null;
    initialPrice?: number;
    supplierId?: string;
  }): Promise<GlobalStockItem> {
    const res = await fetch(`${API_BASE}/global-stock`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('Falha ao criar item');
    return normalizeItem(await res.json());
  },

  async update(
    id: string,
    input: {
      name?: string;
      unit?: string;
      minQuantity?: number | null;
      supplierId?: string | null;
    },
  ): Promise<GlobalStockItem> {
    const res = await fetch(`${API_BASE}/global-stock/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('Falha ao atualizar item');
    return normalizeItem(await res.json());
  },

  async remove(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/global-stock/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Falha ao remover item');
  },

  async getUsageSummary(id: string): Promise<{
    movementsCount: number;
    purchaseRequestsCount: number;
    stockRequestsCount: number;
    linkedProjects: Array<{ id: string; name: string }>;
  }> {
    const res = await fetch(`${API_BASE}/global-stock/${id}/usage`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Falha ao carregar informações de uso');
    return res.json();
  },

  async addMovement(
    itemId: string,
    input: {
      type: 'ENTRY' | 'EXIT';
      quantity: number;
      unitPrice?: number;
      responsible?: string;
      originDestination?: string;
      projectId?: string;
      invoiceNumber?: string;
      supplierId?: string;
      notes?: string;
      date?: string;
    },
  ): Promise<GlobalStockItem> {
    const res = await fetch(`${API_BASE}/global-stock/${itemId}/movements`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Falha ao registrar movimentação');
    }
    return normalizeItem(await res.json());
  },

  async listMovements(params?: {
    skip?: number;
    take?: number;
    projectId?: string;
  }): Promise<{ movements: GlobalStockMovement[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.skip) query.set('skip', String(params.skip));
    if (params?.take) query.set('take', String(params.take));
    if (params?.projectId) query.set('projectId', params.projectId);

    const res = await fetch(
      `${API_BASE}/global-stock/movements?${query.toString()}`,
      { method: 'GET', credentials: 'include' },
    );
    if (!res.ok) throw new Error('Falha ao carregar movimentações');
    const data = await res.json();
    return {
      movements: (data.movements ?? []).map(normalizeMovement),
      total: data.total ?? 0,
    };
  },

  async listItemMovements(
    itemId: string,
    skip = 0,
    take = 20,
  ): Promise<{ movements: GlobalStockMovement[]; total: number }> {
    const res = await fetch(
      `${API_BASE}/global-stock/${itemId}/movements?skip=${skip}&take=${take}`,
      { method: 'GET', credentials: 'include' },
    );
    if (!res.ok) throw new Error('Falha ao carregar movimentações');
    const data = await res.json();
    return {
      movements: (data.movements ?? []).map(normalizeMovement),
      total: data.total ?? 0,
    };
  },

  async reorder(items: Array<{ id: string; order: number }>): Promise<void> {
    const res = await fetch(`${API_BASE}/global-stock/reorder`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error('Falha ao reordenar');
  },
};
