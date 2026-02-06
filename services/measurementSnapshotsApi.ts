import type { MeasurementSnapshot } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

export const measurementSnapshotsApi = {
  async list(projectId: string): Promise<MeasurementSnapshot[]> {
    const response = await fetch(`${API_BASE}/measurement-snapshots?projectId=${projectId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar snapshots');
    }

    const data = await response.json();
    return Array.isArray(data)
      ? data.map((snap: any) => ({
          measurementNumber: snap.measurementNumber,
          date: snap.date,
          items: snap.items ?? snap.itemsSnapshot ?? [],
          totals: snap.totals ?? {},
        }))
      : [];
  },

  async create(projectId: string, snapshot: MeasurementSnapshot) {
    const response = await fetch(`${API_BASE}/measurement-snapshots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        projectId,
        measurementNumber: snapshot.measurementNumber,
        date: snapshot.date,
        itemsSnapshot: snapshot.items,
        totals: snapshot.totals,
      }),
    });

    if (!response.ok) {
      throw new Error('Falha ao salvar snapshot');
    }

    return response.json();
  },
};
