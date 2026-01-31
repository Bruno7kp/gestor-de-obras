
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

export interface ProjectAsset {
  id: string;
  name: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  data: string; 
}

export type ExpenseType = 'labor' | 'material' | 'revenue';

export interface ProjectExpense {
  id: string;
  parentId: string | null;
  type: ExpenseType; // labor, material ou revenue
  itemType: ItemType; // category ou item
  wbs: string;
  order: number;
  date: string;
  description: string; // Nome do gasto/receita ou categoria
  entityName: string; // Fornecedor, Profissional ou Cliente
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number; // Total acumulado ou calculado
  isPaid?: boolean; // Status de pagamento/recebimento
  linkedWorkItemId?: string;
  children?: ProjectExpense[];
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

export interface GlobalSettings {
  defaultCompanyName: string;
  userName: string;
  language: 'pt-BR' | 'en-US';
}

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
  assets: ProjectAsset[];
  expenses: ProjectExpense[];
  config: {
    strict: boolean;
    printCards: boolean;
    printSubtotals: boolean;
  };
}
