import type { LaborContract, LaborPayment } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

type LaborContractInput = Omit<LaborContract, 'id' | 'valorPago' | 'status'> & {
  pagamentos?: LaborPayment[];
};

type LaborContractPatch = Partial<LaborContractInput> & {
  pagamentos?: LaborPayment[];
};

const normalizeContract = (input: any): LaborContract => ({
  id: input.id,
  tipo: input.tipo,
  descricao: input.descricao,
  associadoId: input.associadoId,
  valorTotal: input.valorTotal,
  valorPago: input.valorPago ?? 0,
  status: input.status ?? 'pendente',
  dataInicio: input.dataInicio,
  dataFim: input.dataFim ?? undefined,
  linkedWorkItemId: input.linkedWorkItemId ?? input.linkedWorkItemIds?.[0] ?? undefined,
  linkedWorkItemIds: input.linkedWorkItemIds ?? input.linkedWorkItems?.map((item: any) => item.workItemId) ?? (input.linkedWorkItemId ? [input.linkedWorkItemId] : []),
  observacoes: input.observacoes ?? undefined,
  ordem: input.ordem ?? 0,
  pagamentos: input.pagamentos ?? [],
});

export const laborContractsApi = {
  async list(projectId: string): Promise<LaborContract[]> {
    const response = await fetch(`${API_BASE}/labor-contracts?projectId=${projectId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar contratos');
    }

    const data = await response.json();
    return (Array.isArray(data) ? data : []).map(normalizeContract);
  },

  async create(projectId: string, input: LaborContractInput): Promise<LaborContract> {
    const response = await fetch(`${API_BASE}/labor-contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        ...input,
        projectId,
      }),
    });

    if (!response.ok) {
      throw new Error('Falha ao criar contrato');
    }

    return normalizeContract(await response.json());
  },

  async update(id: string, input: LaborContractPatch): Promise<LaborContract> {
    const response = await fetch(`${API_BASE}/labor-contracts/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar contrato');
    }

    return normalizeContract(await response.json());
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/labor-contracts/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao remover contrato');
    }
  },
};
