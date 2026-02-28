
export type ItemType = 'category' | 'item';
export type WorkItemScope = 'wbs' | 'quantitativo';

export interface WorkItem {
  id: string;
  parentId: string | null;
  name: string;
  type: ItemType;
  scope: WorkItemScope;
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
export type WorkforceRole = 'Engenheiro' | 'Mestre' | 'Encarregado' | 'Eletricista' | 'Encanador' | 'Pedreiro' | 'Servente' | 'Carpinteiro';

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
  createdById?: string;
  createdBy?: Pick<UserAccount, 'id' | 'name' | 'profileImage'> | null;
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
  linkedWorkItemId?: string; // FK para WorkItem (legacy)
  linkedWorkItemIds?: string[]; // FK(s) para WorkItem
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
export type ProjectAssetCategory =
  | 'PLANTA_BAIXA'
  | 'MEMORIAL'
  | 'ART'
  | 'DOCUMENTO_DIVERSO';

export interface ProjectAsset {
  id: string;
  name: string;
  category?: ProjectAssetCategory;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  data: string;
  createdById?: string;
  createdBy?: Pick<UserAccount, 'id' | 'name' | 'profileImage'> | null;
}

// --- FINANCEIRO ---
export type ExpenseType = 'labor' | 'material' | 'revenue' | 'other';
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
  issValue?: number;
  issPercentage?: number;
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
  createdBy?: { id: string; name: string; profileImage?: string | null };
}

export interface MaterialForecast {
  id: string;
  description: string;
  calculationMemory?: string;
  unit: string;
  quantityNeeded: number;
  unitPrice: number;
  discountValue?: number;
  discountPercentage?: number;
  estimatedDate: string;
  purchaseDate?: string;
  deliveryDate?: string;
  status: 'pending' | 'ordered' | 'delivered';
  isPaid: boolean;
  isCleared: boolean;
  order: number;
  supplierId?: string;
  supplyGroupId?: string;
  categoryId?: string;
  paymentProof?: string; // URL do comprovante de pagamento
  supplyGroup?: SupplyGroup;
  createdById?: string;
  createdBy?: Pick<UserAccount, 'id' | 'name' | 'profileImage'> | null;
}

export interface SupplyGroup {
  id: string;
  title?: string | null;
  estimatedDate: string;
  purchaseDate?: string | null;
  deliveryDate?: string | null;
  status: 'pending' | 'ordered' | 'delivered';
  isPaid: boolean;
  isCleared: boolean;
  supplierId?: string;
  paymentProof?: string | null;
  invoiceDoc?: string | null;
  forecasts?: MaterialForecast[];
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
  progressPercent?: number | null;
  progressStage?: string | null;
  progressItem?: string | null;
  weatherStatus?: WeatherType;
  photoUrls: string[];
  createdById?: string;
  createdBy?: Pick<UserAccount, 'id' | 'name' | 'profileImage'> | null;
}

export interface ProjectJournal {
  entries: JournalEntry[];
}

// --- NOTIFICAÇÕES ---
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';
export type NotificationFrequency = 'immediate' | 'digest' | 'off';

export interface UserNotification {
  id: string;
  recipientId: string;
  projectId: string | null;
  category: string;
  eventType: string;
  priority: NotificationPriority;
  title: string;
  body: string;
  metadata?: Record<string, unknown> | null;
  actor?: Pick<UserAccount, 'id' | 'name' | 'profileImage'> | null;
  triggeredAt: string;
  createdAt: string;
  isRead: boolean;
  readAt?: string | null;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  projectId: string | null;
  category: string;
  eventType: string;
  channelInApp: boolean;
  channelEmail: boolean;
  frequency: NotificationFrequency;
  minPriority: NotificationPriority;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDigestGroup {
  key: string;
  projectId: string | null;
  category: string;
  eventType: string;
  count: number;
  highestPriority: NotificationPriority;
  firstTriggeredAt: string;
  lastTriggeredAt: string;
  sampleTitles: string[];
}

export interface NotificationDigestPreview {
  windowMinutes: number;
  generatedAt: string;
  totalEvents: number;
  totalGroups: number;
  groupedEvents: number;
  groups: NotificationDigestGroup[];
}

// --- ESTRUTURA GLOBAL ---
export interface ProjectGroup {
  id: string;
  createdAt?: string;
  parentId: string | null;
  name: string;
  order: number;
  children?: ProjectGroup[];
}

export type CertificateCategory =
  | 'HABILITACAO_JURIDICA'
  | 'FISCAL_TRABALHISTA'
  | 'QUALIFICACAO_TECNICA'
  | 'QUALIFICACAO_FINANCEIRA'
  | 'OUTROS';

export const CERTIFICATE_CATEGORIES: Array<{
  value: CertificateCategory;
  label: string;
}> = [
  { value: 'HABILITACAO_JURIDICA', label: 'Habilitação Jurídica' },
  { value: 'FISCAL_TRABALHISTA', label: 'Fiscal e Trabalhista' },
  { value: 'QUALIFICACAO_TECNICA', label: 'Qualificação Técnica' },
  { value: 'QUALIFICACAO_FINANCEIRA', label: 'Qualificação Financeira' },
  { value: 'OUTROS', label: 'Outros' },
];

export interface CompanyCertificate {
  id: string;
  name: string;
  issuer: string;
  category: CertificateCategory;
  expirationDate: string | null;
  status: 'valid' | 'warning' | 'expired';
  attachmentUrls?: string[];
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
  isArchived?: boolean;
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

// --- CONTROLE DE ESTOQUE ---
export type StockMovementType = 'entry' | 'exit';

export interface StockMovement {
  id: string;
  stockItemId: string;
  type: StockMovementType;
  quantity: number;
  date: string;
  responsible: string | null;
  notes: string;
  createdAt?: string;
  createdBy?: { id: string; name: string; profileImage?: string | null };
}

export interface StockItem {
  id: string;
  projectId: string;
  name: string;
  unit: string;
  minQuantity: number;
  currentQuantity: number;
  movements: StockMovement[];
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

// --- ESTOQUE GLOBAL ---
export type GlobalStockStatus = 'NORMAL' | 'CRITICAL' | 'OUT_OF_STOCK';
export type PurchaseRequestStatus = 'PENDING' | 'ORDERED' | 'COMPLETED' | 'CANCELLED';
export type PurchaseRequestPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type StockRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PriceHistoryEntry {
  id: string;
  globalStockItemId: string;
  date: string;
  price: number;
  supplierId?: string | null;
  supplier?: { id: string; name: string } | null;
}

export interface GlobalStockItem {
  id: string;
  instanceId: string;
  name: string;
  unit: string;
  currentQuantity: number;
  minQuantity: number | null;
  averagePrice: number;
  lastPrice: number | null;
  lastEntryDate: string | null;
  supplierId: string | null;
  status: GlobalStockStatus;
  order: number;
  createdAt?: string;
  updatedAt?: string;
  supplier?: { id: string; name: string } | null;
  priceHistory?: PriceHistoryEntry[];
}

export interface GlobalStockMovement {
  id: string;
  globalStockItemId: string;
  type: StockMovementType;
  quantity: number;
  unitPrice: number | null;
  date: string;
  responsible: string | null;
  originDestination: string;
  projectId: string | null;
  invoiceNumber: string | null;
  supplierId: string | null;
  notes: string;
  createdAt?: string;
  createdBy?: { id: string; name: string; profileImage?: string | null };
  project?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
  globalStockItem?: { id: string; name: string; unit: string };
}

export interface PurchaseRequest {
  id: string;
  instanceId: string;
  globalStockItemId: string;
  itemName: string;
  quantity: number;
  date: string;
  status: PurchaseRequestStatus;
  priority: PurchaseRequestPriority;
  notes: string | null;
  requestedById: string;
  processedById: string | null;
  orderedAt: string | null;
  completedAt: string | null;
  invoiceNumber: string | null;
  unitPrice: number | null;
  createdAt?: string;
  updatedAt?: string;
  globalStockItem?: { id: string; name: string; unit: string; currentQuantity: number };
  requestedBy?: { id: string; name: string; profileImage?: string | null };
  processedBy?: { id: string; name: string; profileImage?: string | null } | null;
}

export interface StockRequest {
  id: string;
  instanceId: string;
  projectId: string;
  globalStockItemId: string;
  itemName: string;
  quantity: number;
  date: string;
  status: StockRequestStatus;
  notes: string | null;
  rejectionReason: string | null;
  requestedById: string;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  globalStockItem?: { id: string; name: string; unit: string; currentQuantity: number; status: GlobalStockStatus };
  project?: { id: string; name: string };
  requestedBy?: { id: string; name: string; profileImage?: string | null };
  approvedBy?: { id: string; name: string; profileImage?: string | null } | null;
}

// --- PROJETO ---
export interface Project {
  id: string;
  createdAt?: string;
  instanceId?: string;
  isArchived?: boolean;
  archivedAt?: string | null;
  groupId: string | null;
  order: number;
  progress?: number;
  name: string;
  description?: string;
  responsavel?: string;
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
  stockItems: StockItem[];
  contractTotalOverride?: number;
  currentTotalOverride?: number;
  config: {
    strict: boolean;
    printCards: boolean;
    printSubtotals: boolean;
    showSignatures: boolean;
  };
}
