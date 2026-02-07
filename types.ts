
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

// --- GESTÃO DE MÃO DE OBRA ---
export type WorkforceRole = 'Engenheiro' | 'Mestre' | 'Encarregado' | 'Eletricista' | 'Encanador' | 'Pedreiro' | 'Servente';

export interface StaffDocument {
  id: string;
  nome: string;
  dataVencimento: string;
  arquivoUrl?: string;
  status: 'apto' | 'pendente' | 'vencido';
}

export interface WorkforceMember {
  id: string;
  nome: string;
  cpf_cnpj: string;
  empresa_vinculada: string;
  foto?: string;
  cargo: WorkforceRole;
  documentos: StaffDocument[];
  linkedWorkItemIds: string[]; // Vínculo com IDs da EAP para responsabilidade técnica
}

// --- CONTRATOS DE MÃO DE OBRA (NOVO) ---
export type LaborContractType = 'empreita' | 'diaria';
export type LaborPaymentStatus = 'pago' | 'parcial' | 'pendente';

export interface LaborPayment {
  id: string;
  data: string;
  valor: number;
  descricao: string;
  comprovante?: string; // URL
}

export interface LaborContract {
  id: string;
  tipo: LaborContractType;
  descricao: string;
  associadoId: string; // FK para WorkforceMember
  valorTotal: number;
  valorPago: number;
  status: LaborPaymentStatus;
  dataInicio: string;
  dataFim?: string;
  pagamentos: LaborPayment[];
  linkedWorkItemId?: string; // FK para WorkItem
  observacoes?: string;
  ordem: number;
}

// --- TEMA E VISUAL ---
export interface PDFTheme {
  primary: string;
  accent: string;
  accentText: string;
  border: string;
  fontFamily: 'Inter' | 'Roboto' | 'JetBrains Mono' | 'Merriweather';
  header: { bg: string; text: string };
  category: { bg: string; text: string };
  footer: { bg: string; text: string };
  kpiHighlight: { bg: string; text: string };
  currencySymbol?: string;
}

export const DEFAULT_THEME: PDFTheme = {
  primary: '#1e293b',
  accent: '#4f46e5',
  accentText: '#ffffff',
  border: '#e2e8f0',
  fontFamily: 'Inter',
  header: { bg: '#1e293b', text: '#ffffff' },
  category: { bg: '#f8fafc', text: '#1e293b' },
  footer: { bg: '#0f172a', text: '#ffffff' },
  kpiHighlight: { bg: '#eff6ff', text: '#1e40af' },
  currencySymbol: 'R$'
};

// --- MEDIÇÕES E HISTÓRICO ---
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

// --- DOCUMENTOS E ATIVOS ---
export interface ProjectAsset {
  id: string;
  name: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  data: string;
}

// --- FINANCEIRO ---
export type ExpenseType = 'labor' | 'material' | 'revenue';
export type ExpenseStatus = 'PENDING' | 'PAID' | 'DELIVERED';

export interface ProjectExpense {
  id: string;
  parentId: string | null;
  type: ExpenseType;
  itemType: 'category' | 'item';
  wbs: string;
  order: number;
  date: string;
  description: string;
  entityName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  isPaid: boolean;
  status: ExpenseStatus;
  paymentDate?: string;
  paymentProof?: string;
  invoiceDoc?: string;
  deliveryDate?: string;
  discountValue?: number;
  discountPercentage?: number;
  linkedWorkItemId?: string;
  children?: ProjectExpense[];
}

// --- PLANEJAMENTO E CANTEIRO ---
export type TaskStatus = 'todo' | 'doing' | 'done';

export interface PlanningTask {
  id: string;
  categoryId: string | null;
  description: string;
  status: TaskStatus;
  isCompleted: boolean;
  dueDate: string;
  createdAt: string;
  completedAt?: string;
}

export interface MaterialForecast {
  id: string;
  description: string;
  unit: string;
  quantityNeeded: number;
  unitPrice: number;
  estimatedDate: string;
  purchaseDate?: string;
  deliveryDate?: string;
  status: 'pending' | 'ordered' | 'delivered';
  isPaid: boolean;
  order: number;
  supplierId?: string;
  paymentProof?: string; // URL do comprovante de pagamento
}

export interface Milestone {
  id: string;
  title: string;
  date: string;
  isCompleted: boolean;
}

export interface ProjectPlanning {
  tasks: PlanningTask[];
  forecasts: MaterialForecast[];
  milestones: Milestone[];
  schedule?: {
    [workItemId: string]: {
      [period: string]: {
        plannedPercent: number;
      };
    };
  };
}

// --- DIÁRIO DE OBRA ---
export type JournalCategory = 'PROGRESS' | 'FINANCIAL' | 'INCIDENT' | 'WEATHER';
export type WeatherType = 'sunny' | 'cloudy' | 'rainy' | 'storm';

export interface JournalEntry {
  id: string;
  timestamp: string;
  type: 'AUTO' | 'MANUAL';
  category: JournalCategory;
  title: string;
  description: string;
  weatherStatus?: WeatherType;
  photoUrls: string[];
}

export interface ProjectJournal {
  entries: JournalEntry[];
}

// --- ESTRUTURA GLOBAL ---
export interface ProjectGroup {
  id: string;
  parentId: string | null;
  name: string;
  order: number;
  children?: ProjectGroup[];
}

export interface CompanyCertificate {
  id: string;
  name: string;
  issuer: string;
  expirationDate: string;
  status: 'valid' | 'warning' | 'expired';
}

export interface GlobalSettings {
  defaultCompanyName: string;
  companyCnpj: string;
  userName: string;
  language: 'pt-BR' | 'en-US';
  currencySymbol: string;
  certificates: CompanyCertificate[];
}

export type PermissionLevel = 'none' | 'view' | 'edit';

export interface Permission {
  id: string;
  code: string;
  description?: string | null;
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  instanceId?: string;
  permissions?: Permission[];
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  status?: string;
  instanceId?: string;
  profileImage?: string | null;
  roles?: Role[];
}

// --- CROSS-INSTANCE PROJECT ACCESS ---
export interface ExternalProject {
  projectId: string;
  projectName: string;
  companyName: string;
  instanceId: string;
  instanceName: string;
  assignedRole: {
    id: string;
    name: string;
    permissions: string[];
  };
}

// --- LICITAÇÕES ---
export type BiddingStatus = 'PROSPECTING' | 'DRAFTING' | 'SUBMITTED' | 'WON' | 'LOST';

export interface BiddingProcess {
  id: string;
  tenderNumber: string;
  clientName: string;
  object: string;
  openingDate: string;
  expirationDate: string;
  estimatedValue: number;
  ourProposalValue: number;
  status: BiddingStatus;
  items: WorkItem[];
  assets: ProjectAsset[];
  bdi: number;
}

// --- FORNECEDORES ---
export interface Supplier {
  id: string;
  name: string;
  cnpj: string;
  contactName: string;
  email: string;
  phone: string;
  category: 'Material' | 'Serviço' | 'Locação' | 'Outros';
  rating: number;
  notes: string;
  order: number;
}

// --- PROJETO ---
export interface Project {
  id: string;
  instanceId?: string;
  groupId: string | null;
  name: string;
  companyName: string;
  companyCnpj: string;
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
  workforce: WorkforceMember[];
  laborContracts: LaborContract[]; // NOVO
  planning: ProjectPlanning;
  journal: ProjectJournal;
  contractTotalOverride?: number;
  currentTotalOverride?: number;
  config: {
    strict: boolean;
    printCards: boolean;
    printSubtotals: boolean;
    showSignatures: boolean;
  };
}
