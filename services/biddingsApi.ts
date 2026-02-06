import type { BiddingProcess } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

type BiddingInput = Omit<BiddingProcess, 'id' | 'items' | 'assets'> & {
  itemsSnapshot?: unknown;
  assetsSnapshot?: unknown;
};

type BiddingPatch = Partial<BiddingInput>;

const normalizeBidding = (input: any): BiddingProcess => ({
  id: input.id,
  tenderNumber: input.tenderNumber ?? '',
  clientName: input.clientName ?? '',
  object: input.object ?? '',
  openingDate: input.openingDate ?? '',
  expirationDate: input.expirationDate ?? '',
  estimatedValue: input.estimatedValue ?? 0,
  ourProposalValue: input.ourProposalValue ?? 0,
  status: input.status ?? 'PROSPECTING',
  bdi: input.bdi ?? 25,
  items: input.itemsSnapshot ?? [],
  assets: input.assetsSnapshot ?? [],
});

export const biddingsApi = {
  async list(): Promise<BiddingProcess[]> {
    const response = await fetch(`${API_BASE}/biddings`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar licitacoes');
    }

    const data = await response.json();
    return (Array.isArray(data) ? data : []).map(normalizeBidding);
  },

  async create(input: BiddingInput): Promise<BiddingProcess> {
    const response = await fetch(`${API_BASE}/biddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao criar licitacao');
    }

    return normalizeBidding(await response.json());
  },

  async update(id: string, input: BiddingPatch): Promise<BiddingProcess> {
    const response = await fetch(`${API_BASE}/biddings/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar licitacao');
    }

    return normalizeBidding(await response.json());
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/biddings/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao remover licitacao');
    }
  },
};
