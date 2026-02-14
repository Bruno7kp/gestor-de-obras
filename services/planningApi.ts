import type { MaterialForecast, Milestone, PlanningTask, SupplyGroup } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

export const planningApi = {
  async listTasks(projectId: string): Promise<PlanningTask[]> {
    const response = await fetch(`${API_BASE}/planning/tasks?projectId=${projectId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar tarefas');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async createTask(projectId: string, task: PlanningTask): Promise<PlanningTask> {
    const response = await fetch(`${API_BASE}/planning/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        ...task,
        projectId,
      }),
    });

    if (!response.ok) {
      throw new Error('Falha ao criar tarefa');
    }

    return response.json();
  },

  async updateTask(id: string, input: Partial<PlanningTask>) {
    const response = await fetch(`${API_BASE}/planning/tasks/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar tarefa');
    }

    return response.json();
  },

  async deleteTask(id: string) {
    const response = await fetch(`${API_BASE}/planning/tasks/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao remover tarefa');
    }
  },

  async listForecasts(projectId: string): Promise<MaterialForecast[]> {
    const response = await fetch(`${API_BASE}/planning/forecasts?projectId=${projectId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar previsoes');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async listSupplyGroups(projectId: string): Promise<SupplyGroup[]> {
    const response = await fetch(`${API_BASE}/planning/supply-groups?projectId=${projectId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar grupos de suprimentos');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async createSupplyGroup(
    projectId: string,
    payload: {
      title?: string | null;
      supplierId?: string | null;
      estimatedDate: string;
      purchaseDate?: string | null;
      deliveryDate?: string | null;
      status: 'pending' | 'ordered' | 'delivered';
      isPaid: boolean;
      isCleared: boolean;
      paymentProof?: string | null;
      invoiceDoc?: string | null;
      items: Array<{
        id?: string;
        description: string;
        unit: string;
        quantityNeeded: number;
        unitPrice: number;
        discountValue?: number;
        discountPercentage?: number;
        categoryId?: string | null;
        order?: number;
      }>;
    },
  ): Promise<SupplyGroup> {
    const response = await fetch(`${API_BASE}/planning/supply-groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        projectId,
        ...payload,
      }),
    });

    if (!response.ok) {
      throw new Error('Falha ao criar grupo de suprimentos');
    }

    return response.json();
  },

  async updateSupplyGroup(id: string, input: Partial<Omit<SupplyGroup, 'id' | 'forecasts'>>) {
    const response = await fetch(`${API_BASE}/planning/supply-groups/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar grupo de suprimentos');
    }

    return response.json();
  },

  async convertForecastsToGroup(
    projectId: string,
    payload: {
      forecastIds: string[];
      title?: string | null;
      supplierId?: string | null;
      estimatedDate: string;
      purchaseDate?: string | null;
      deliveryDate?: string | null;
      status: 'pending' | 'ordered' | 'delivered';
      isPaid: boolean;
      isCleared: boolean;
      paymentProof?: string | null;
      invoiceDoc?: string | null;
    },
  ): Promise<SupplyGroup> {
    const response = await fetch(`${API_BASE}/planning/supply-groups/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        projectId,
        ...payload,
      }),
    });

    if (!response.ok) {
      throw new Error('Falha ao converter suprimentos para grupo');
    }

    return response.json();
  },

  async createForecast(projectId: string, forecast: MaterialForecast): Promise<MaterialForecast> {
    const response = await fetch(`${API_BASE}/planning/forecasts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        ...forecast,
        projectId,
      }),
    });

    if (!response.ok) {
      throw new Error('Falha ao criar previsao');
    }

    return response.json();
  },

  async updateForecast(id: string, input: Partial<MaterialForecast>) {
    const response = await fetch(`${API_BASE}/planning/forecasts/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar previsao');
    }

    return response.json();
  },

  async deleteForecast(id: string) {
    const response = await fetch(`${API_BASE}/planning/forecasts/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao remover previsao');
    }
  },

  async listMilestones(projectId: string): Promise<Milestone[]> {
    const response = await fetch(`${API_BASE}/planning/milestones?projectId=${projectId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar marcos');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async createMilestone(projectId: string, milestone: Milestone): Promise<Milestone> {
    const response = await fetch(`${API_BASE}/planning/milestones`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        ...milestone,
        projectId,
      }),
    });

    if (!response.ok) {
      throw new Error('Falha ao criar marco');
    }

    return response.json();
  },

  async updateMilestone(id: string, input: Partial<Milestone>) {
    const response = await fetch(`${API_BASE}/planning/milestones/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar marco');
    }

    return response.json();
  },

  async deleteMilestone(id: string) {
    const response = await fetch(`${API_BASE}/planning/milestones/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao remover marco');
    }
  },

  async replace(projectId: string, payload: { tasks?: any[]; forecasts?: any[]; milestones?: any[] }): Promise<void> {
    const response = await fetch(`${API_BASE}/planning/replace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ projectId, ...payload }),
    });

    if (!response.ok) {
      throw new Error('Falha ao substituir planejamento');
    }
  },
};
