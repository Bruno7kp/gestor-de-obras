
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

export type PDFBoxTheme = {
  bg: string;
  text: string;
};

export interface PDFTheme {
  fontFamily: 'Inter' | 'Roboto' | 'JetBrains Mono' | 'Merriweather';
  primary: string; 
  accent: string;  
  accentText: string;
  border: string;
  currencySymbol: string;
  header: PDFBoxTheme;
  category: PDFBoxTheme;
  footer: PDFBoxTheme;
  kpiHighlight: PDFBoxTheme;
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
  type: ExpenseType; 
  itemType: ItemType; 
  wbs: string;
  order: number;
  date: string; 
  paymentDate?: string; 
  description: string; 
  entityName: string; 
  unit: string;
  quantity: number;
  unitPrice: number;
  discountValue?: number;
  discountPercentage?: number;
  amount: number; 
  isPaid?: boolean; 
  linkedWorkItemId?: string;
  children?: ProjectExpense[];
}

export interface ProjectPlanning {
  tasks: PlanningTask[];
  forecasts: MaterialForecast[];
  milestones: Milestone[];
}

export interface PlanningTask {
  id: string;
  categoryId: string | null;
  description: string;
  isCompleted: boolean;
  dueDate: string;
  createdAt: string;
  completedAt?: string;
}

export type ForecastStatus = 'pending' | 'ordered' | 'delivered';

export interface MaterialForecast {
  id: string;
  description: string;
  quantityNeeded: number;
  unit: string;
  estimatedDate: string;
  status: ForecastStatus;
}

export interface Milestone {
  id: string;
  title: string;
  date: string;
  isCompleted: boolean;
}

export interface ProjectJournal {
  entries: JournalEntry[];
}

export type JournalCategory = 'PROGRESS' | 'FINANCIAL' | 'INCIDENT' | 'WEATHER';
export type WeatherType = 'sunny' | 'rainy' | 'cloudy' | 'storm';

export interface JournalEntry {
  id: string;
  timestamp: string;
  type: 'AUTO' | 'MANUAL';
  category: JournalCategory;
  title: string;
  description: string;
  weatherStatus?: WeatherType;
  photoUrls?: string[];
  linkedItemId?: string;
}

export interface BiddingProcess {
  id: string;
  tenderNumber: string;
  clientName: string;
  object: string;
  openingDate: string;
  visitDate?: string;
  expirationDate: string;
  estimatedValue: number;
  ourProposalValue: number;
  status: BiddingStatus;
  items: WorkItem[];
  assets: ProjectAsset[];
  bdi: number;
}

export type BiddingStatus = 'PROSPECTING' | 'DRAFTING' | 'SUBMITTED' | 'WON' | 'LOST';

export interface CompanyCertificate {
  id: string;
  name: string;
  issuer: string;
  expirationDate: string;
  fileData?: string;
  status: 'valid' | 'warning' | 'expired';
}

export const DEFAULT_THEME: PDFTheme = {
  fontFamily: 'Inter',
  primary: '#000000',
  accent: '#2563eb',
  accentText: '#ffffff',
  border: '#000000',
  currencySymbol: 'R$',
  header: { bg: '#0f172a', text: '#ffffff' },
  category: { bg: '#f1f5f9', text: '#000000' },
  footer: { bg: '#0f172a', text: '#ffffff' },
  kpiHighlight: { bg: '#eff6ff', text: '#1d4ed8' }
};

export interface GlobalSettings {
  defaultCompanyName: string;
  companyCnpj: string;
  userName: string;
  language: 'pt-BR' | 'en-US';
  currencySymbol: string;
  certificates: CompanyCertificate[];
}

export interface ProjectGroup {
  id: string;
  parentId: string | null;
  name: string;
  order: number;
  children?: ProjectGroup[];
}

export interface Project {
  id: string;
  groupId: string | null;
  name: string;
  companyName: string;
  location: string;
  measurementNumber: number;
  referenceDate: string;
  logo: string | null;
  items: WorkItem[];
  history: MeasurementSnapshot[];
  theme: PDFTheme;
  bdi: number;
  assets: ProjectAsset[];
  expenses: ProjectExpense[];
  planning: ProjectPlanning;
  journal: ProjectJournal;
  contractTotalOverride?: number; // Ajuste manual global contrato
  currentTotalOverride?: number;  // Ajuste manual global período
  config: {
    strict: boolean;
    printCards: boolean;
    printSubtotals: boolean;
  };
}
