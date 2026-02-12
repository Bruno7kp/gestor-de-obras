import type { MaterialForecast, ProjectExpense, Supplier } from '../types';

export interface MaterialSuggestion {
  label: string;
  normalizedLabel: string;
  unit?: string;
  lastUnitPrice?: number;
  supplierId?: string;
  supplierName?: string;
  usageCount: number;
  lastDate?: string;
  source: 'forecast' | 'expense' | 'mixed';
}

export interface MaterialAutocompleteSource {
  forecasts: MaterialForecast[];
  expenses: ProjectExpense[];
  suppliers: Supplier[];
}

export interface MaterialAutocompleteProvider {
  search: (query: string, limit?: number) => Promise<MaterialSuggestion[]>;
}

export interface RemoteMaterialAutocompleteApi {
  searchMaterialSuggestions: (query: string, limit?: number) => Promise<MaterialSuggestion[]>;
}

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const parseDate = (value?: string) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const extractMaterialDescription = (description: string) => {
  const parts = description.split(':');
  if (parts.length <= 1) return description.trim();
  return parts.slice(1).join(':').trim() || description.trim();
};

export const createLocalMaterialAutocompleteProvider = (
  source: MaterialAutocompleteSource,
): MaterialAutocompleteProvider => {
  const suppliersById = new Map(source.suppliers.map((supplier) => [supplier.id, supplier] as const));

  return {
    async search(query: string, limit = 8) {
      const normalizedQuery = normalizeText(query);
      if (!normalizedQuery || normalizedQuery.length < 2) return [];

      const bucket = new Map<string, MaterialSuggestion>();

      for (const forecast of source.forecasts) {
        const label = forecast.description?.trim();
        if (!label) continue;
        const normalizedLabel = normalizeText(label);
        if (!normalizedLabel.includes(normalizedQuery)) continue;

        const supplier = forecast.supplierId ? suppliersById.get(forecast.supplierId) : undefined;
        const date = forecast.deliveryDate || forecast.purchaseDate || forecast.estimatedDate;
        const prev = bucket.get(normalizedLabel);

        if (!prev) {
          bucket.set(normalizedLabel, {
            label,
            normalizedLabel,
            unit: forecast.unit || undefined,
            lastUnitPrice: forecast.unitPrice || 0,
            supplierId: forecast.supplierId || undefined,
            supplierName: supplier?.name,
            usageCount: 1,
            lastDate: date,
            source: 'forecast',
          });
          continue;
        }

        const prevDate = parseDate(prev.lastDate);
        const nextDate = parseDate(date);
        bucket.set(normalizedLabel, {
          ...prev,
          usageCount: prev.usageCount + 1,
          unit: prev.unit || forecast.unit || undefined,
          lastUnitPrice: nextDate >= prevDate ? forecast.unitPrice : prev.lastUnitPrice,
          supplierId: prev.supplierId || forecast.supplierId || undefined,
          supplierName: prev.supplierName || supplier?.name,
          lastDate: nextDate >= prevDate ? date : prev.lastDate,
          source: prev.source === 'expense' ? 'mixed' : 'forecast',
        });
      }

      for (const expense of source.expenses) {
        if (expense.type !== 'material' || expense.itemType !== 'item') continue;
        const label = extractMaterialDescription(expense.description || '');
        if (!label) continue;

        const normalizedLabel = normalizeText(label);
        if (!normalizedLabel.includes(normalizedQuery)) continue;

        const prev = bucket.get(normalizedLabel);
        if (!prev) {
          bucket.set(normalizedLabel, {
            label,
            normalizedLabel,
            unit: expense.unit || undefined,
            lastUnitPrice: expense.unitPrice || 0,
            supplierName: expense.entityName || undefined,
            usageCount: 1,
            lastDate: expense.date,
            source: 'expense',
          });
          continue;
        }

        const prevDate = parseDate(prev.lastDate);
        const nextDate = parseDate(expense.date);
        bucket.set(normalizedLabel, {
          ...prev,
          usageCount: prev.usageCount + 1,
          unit: prev.unit || expense.unit || undefined,
          lastUnitPrice: nextDate >= prevDate ? expense.unitPrice : prev.lastUnitPrice,
          supplierName: prev.supplierName || expense.entityName || undefined,
          lastDate: nextDate >= prevDate ? expense.date : prev.lastDate,
          source: prev.source === 'forecast' ? 'mixed' : 'expense',
        });
      }

      return Array.from(bucket.values())
        .sort((a, b) => {
          const aStarts = a.normalizedLabel.startsWith(normalizedQuery) ? 1 : 0;
          const bStarts = b.normalizedLabel.startsWith(normalizedQuery) ? 1 : 0;
          if (aStarts !== bStarts) return bStarts - aStarts;
          if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;
          return parseDate(b.lastDate) - parseDate(a.lastDate);
        })
        .slice(0, limit);
    },
  };
};

export const createRemoteMaterialAutocompleteProvider = (
  api: RemoteMaterialAutocompleteApi,
): MaterialAutocompleteProvider => ({
  async search(query: string, limit = 8) {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery || normalizedQuery.length < 2) return [];
    const result = await api.searchMaterialSuggestions(query, limit);
    return result.map((suggestion) => ({
      ...suggestion,
      normalizedLabel: suggestion.normalizedLabel || normalizeText(suggestion.label || ''),
    }));
  },
});

export const createFallbackMaterialAutocompleteProvider = (
  primary: MaterialAutocompleteProvider,
  fallback: MaterialAutocompleteProvider,
): MaterialAutocompleteProvider => ({
  async search(query: string, limit = 8) {
    try {
      const primaryResults = await primary.search(query, limit);
      if (primaryResults.length > 0) return primaryResults;
    } catch {
      // fallback below
    }
    return fallback.search(query, limit);
  },
});
