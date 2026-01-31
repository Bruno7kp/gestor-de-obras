
export type ItemType = 'category' | 'item';

export interface WorkItem {
  id: string;
  parentId: string | null;
  name: string;
  type: ItemType;
  wbs: string;
  order: number;
  
  // Especificações Técnicas
  unit: string;
  cod?: string;
  fonte?: string;
  
  // Valores de Contrato
  contractQuantity: number;
  unitPrice: number; // C/ BDI
  unitPriceNoBdi: number; // S/ BDI
  contractTotal: number;

  // Medição
  previousQuantity: number; 
  previousTotal: number;
  
  currentQuantity: number; 
  currentTotal: number;
  currentPercentage: number;

  // Totais Acumulados
  accumulatedQuantity: number;
  accumulatedTotal: number;
  accumulatedPercentage: number;
  
  // Saldo
  balanceQuantity: number;
  balanceTotal: number;

  children?: WorkItem[];
}

export interface PDFTheme {
  primary: string;
  secondary: string;
  headerBg: string;
  headerText: string;
  rowCategory: string;
  rowItem: string;
  rowTotal: string;
  border: string;
}

export interface MeasurementSnapshot {
  measurementNumber: number;
  date: string;
  items: WorkItem[];
  totals: {
    contract: number;
    period: number;
    accumulated: number;
    progress: number;
  };
}

export const DEFAULT_THEME: PDFTheme = {
  primary: '#2563eb',
  secondary: '#64748b',
  headerBg: '#0f172a',
  headerText: '#ffffff',
  rowCategory: '#f8fafc',
  rowItem: '#ffffff',
  rowTotal: '#1e293b',
  border: '#e2e8f0'
};

export interface Project {
  id: string;
  name: string;
  companyName: string;
  measurementNumber: number;
  referenceDate: string;
  logo: string | null;
  items: WorkItem[];
  history: MeasurementSnapshot[];
  theme: PDFTheme;
  bdi: number;
  config: {
    strict: boolean;
    printCards: boolean;
    printSubtotals: boolean;
  };
}
