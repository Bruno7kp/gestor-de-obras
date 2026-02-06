import type { WorkItem } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

type WorkItemPayload = {
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

const toPayload = (item: WorkItem, projectId: string): WorkItemPayload => ({
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

export const workItemsApi = {
  async list(projectId: string): Promise<WorkItem[]> {
    const response = await fetch(`${API_BASE}/work-items?projectId=${projectId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar itens');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async create(projectId: string, item: WorkItem): Promise<WorkItem> {
    const response = await fetch(`${API_BASE}/work-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(toPayload(item, projectId)),
    });

    if (!response.ok) {
      throw new Error('Falha ao criar item');
    }

    return response.json();
  },

  async update(id: string, input: Partial<WorkItemPayload>): Promise<WorkItem> {
    const response = await fetch(`${API_BASE}/work-items/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar item');
    }

    return response.json();
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/work-items/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao excluir item');
    }
  },
};
