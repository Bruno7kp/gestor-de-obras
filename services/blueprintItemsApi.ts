import type { WorkItem } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

type BlueprintItemPayload = {
  id?: string;
  projectId: string;
  parentId?: string | null;
  name: string;
  type: string;
  wbs?: string;
  order?: number;
  unit?: string;
  cod?: string;
  fonte?: string;
  contractQuantity?: number;
  unitPrice?: number;
  unitPriceNoBdi?: number;
  contractTotal?: number;
  previousQuantity?: number;
  previousTotal?: number;
  currentQuantity?: number;
  currentTotal?: number;
  currentPercentage?: number;
  accumulatedQuantity?: number;
  accumulatedTotal?: number;
  accumulatedPercentage?: number;
  balanceQuantity?: number;
  balanceTotal?: number;
};

const toPayload = (item: WorkItem, projectId: string): BlueprintItemPayload => ({
  id: item.id,
  projectId,
  parentId: item.parentId ?? null,
  name: item.name,
  type: item.type,
  wbs: item.wbs,
  order: item.order,
  unit: item.unit,
  cod: item.cod,
  fonte: item.fonte,
  contractQuantity: item.contractQuantity,
  unitPrice: item.unitPrice,
  unitPriceNoBdi: item.unitPriceNoBdi,
  contractTotal: item.contractTotal,
  previousQuantity: item.previousQuantity,
  previousTotal: item.previousTotal,
  currentQuantity: item.currentQuantity,
  currentTotal: item.currentTotal,
  currentPercentage: item.currentPercentage,
  accumulatedQuantity: item.accumulatedQuantity,
  accumulatedTotal: item.accumulatedTotal,
  accumulatedPercentage: item.accumulatedPercentage,
  balanceQuantity: item.balanceQuantity,
  balanceTotal: item.balanceTotal,
});

const withScope = (item: any): WorkItem => ({
  ...item,
  scope: 'quantitativo',
});

export const blueprintItemsApi = {
  async list(projectId: string): Promise<WorkItem[]> {
    const response = await fetch(`${API_BASE}/blueprint-items?projectId=${projectId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar itens de quantitativo');
    }

    const data = await response.json();
    return Array.isArray(data) ? data.map(withScope) : [];
  },

  async create(projectId: string, item: WorkItem): Promise<WorkItem> {
    const response = await fetch(`${API_BASE}/blueprint-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(toPayload(item, projectId)),
    });

    if (!response.ok) {
      throw new Error('Falha ao criar item de quantitativo');
    }

    return withScope(await response.json());
  },

  async batch(projectId: string, items: WorkItem[], replaceFlag = false): Promise<void> {
    const response = await fetch(`${API_BASE}/blueprint-items/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ projectId, items: items.map((item) => toPayload(item, projectId)), replace: replaceFlag }),
    });

    if (!response.ok) {
      throw new Error('Falha ao enviar batch de itens de quantitativo');
    }
  },

  async update(id: string, input: Partial<BlueprintItemPayload>): Promise<WorkItem> {
    const response = await fetch(`${API_BASE}/blueprint-items/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar item de quantitativo');
    }

    return withScope(await response.json());
  },

  async batchUpdate(
    projectId: string,
    updates: Array<{ id: string } & Partial<BlueprintItemPayload>>,
    operation?: string,
  ): Promise<WorkItem[]> {
    const CHUNK_SIZE = 100;
    if (updates.length <= CHUNK_SIZE) {
      const response = await fetch(`${API_BASE}/blueprint-items/batch-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId, updates, operation }),
      });

      if (!response.ok) {
        throw new Error('Falha ao atualizar itens em lote');
      }

      const data = await response.json();
      return Array.isArray(data) ? data.map(withScope) : [];
    }

    const results: WorkItem[] = [];
    for (let index = 0; index < updates.length; index += CHUNK_SIZE) {
      const chunk = updates.slice(index, index + CHUNK_SIZE);
      const response = await fetch(`${API_BASE}/blueprint-items/batch-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId,
          updates: chunk,
          operation: operation ? `${operation}:${Math.floor(index / CHUNK_SIZE) + 1}` : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao atualizar itens em lote');
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        results.push(...data.map(withScope));
      }
    }

    return results;
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/blueprint-items/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao excluir item de quantitativo');
    }
  },
};
