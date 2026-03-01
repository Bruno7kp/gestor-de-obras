import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Clock, Filter, History, Loader2, Plus, Pencil, Trash2, User } from 'lucide-react';
import type { AuditLogEntry, AuditLogChange, UserAccount } from '../types';
import { auditApi } from '../services/auditApi';
import { usersApi } from '../services/usersApi';
import { Pagination } from '../components/Pagination';

/* ── Model labels (PT-BR) ─────────────────────────────────── */
const MODEL_LABELS: Record<string, string> = {
  Project: 'Obra',
  WorkItem: 'Item da EAP',
  ProjectExpense: 'Despesa',
  Supplier: 'Fornecedor',
  BiddingProcess: 'Cotação',
  WorkforceMember: 'Mão de obra',
  LaborContract: 'Contrato',
  LaborPayment: 'Pagamento',
  StockItem: 'Estoque (obra)',
  StockMovement: 'Movimentação de estoque',
  GlobalStockItem: 'Estoque geral',
  PlanningTask: 'Tarefa',
  MaterialForecast: 'Previsão',
  Milestone: 'Marco',
  SupplyGroup: 'Grupo de insumos',
  ProjectPlanning: 'Planejamento',
  MeasurementSnapshot: 'Medição',
  ProjectAsset: 'Documento',
  StockRequest: 'Requisição',
  PurchaseRequest: 'Compra',
  StaffDocument: 'Documento de funcionário',
  WorkItemResponsibility: 'Responsabilidade',
  JournalEntry: 'Diário de obra',
  ProjectMember: 'Membro do projeto',
  Role: 'Perfil de acesso',
  User: 'Usuário',
  Instance: 'Instância',
  ProjectGroup: 'Grupo de obras',
  GlobalSettings: 'Config. gerais',
  CompanyCertificate: 'Certificado',
};

const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; badge: string }> = {
  CREATE: {
    label: 'Criação',
    icon: <Plus size={12} />,
    badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  },
  UPDATE: {
    label: 'Alteração',
    icon: <Pencil size={12} />,
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  },
  DELETE: {
    label: 'Exclusão',
    icon: <Trash2 size={12} />,
    badge: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
  },
};

type ActionFilter = 'TODOS' | 'CREATE' | 'UPDATE' | 'DELETE';

const FILTERS: { key: ActionFilter; label: string }[] = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'CREATE', label: 'Criação' },
  { key: 'UPDATE', label: 'Alteração' },
  { key: 'DELETE', label: 'Exclusão' },
];

/* ── Helpers ──────────────────────────────────────────────── */
function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'agora';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}min atrás`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h atrás`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d atrás`;
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
  if (typeof val === 'number') return val.toLocaleString('pt-BR');
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) return new Date(val).toLocaleString('pt-BR');
    if (val.length > 80) return val.slice(0, 77) + '…';
    return val;
  }
  return JSON.stringify(val);
}

/* ── Field label mapping ───────────────────────────────────── */
const FIELD_LABELS: Record<string, string> = {
  name: 'Nome',
  description: 'Descrição',
  unit: 'Unidade',
  quantity: 'Quantidade',
  unitCost: 'Custo unitário',
  totalCost: 'Custo total',
  amount: 'Valor',
  status: 'Status',
  date: 'Data',
  paymentDate: 'Data pagamento',
  dueDate: 'Data de vencimento',
  startDate: 'Data início',
  endDate: 'Data fim',
  progress: 'Progresso',
  weight: 'Peso',
  notes: 'Observações',
  paymentProof: 'Comprovante',
  entityName: 'Entidade',
  supplier: 'Fornecedor',
  supplierId: 'Fornecedor',
  category: 'Categoria',
  categoryPath: 'Caminho',
  role: 'Função',
  dailyRate: 'Diária',
  hourlyRate: 'Hora',
  phone: 'Telefone',
  email: 'E-mail',
  document: 'Documento',
  address: 'Endereço',
  title: 'Título',
  price: 'Preço',
  minStock: 'Estoque mín.',
  currentStock: 'Estoque atual',
};

function getFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/* ── Change diff row ──────────────────────────────────────── */
const ChangeDiffRow: React.FC<{ change: AuditLogChange }> = ({ change }) => (
  <div className="flex items-start gap-2 py-1.5 text-[11px]">
    <span className="font-semibold text-slate-500 dark:text-slate-400 min-w-[90px] shrink-0 pt-0.5">
      {getFieldLabel(change.field)}
    </span>
    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
      {change.from !== undefined && (
        <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 line-through break-all">
          {formatValue(change.from)}
        </span>
      )}
      {change.from !== undefined && change.to !== undefined && (
        <ChevronRight size={10} className="text-slate-400 shrink-0" />
      )}
      {change.to !== undefined && (
        <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 break-all">
          {formatValue(change.to)}
        </span>
      )}
    </div>
  </div>
);

/* ── Single audit entry card ──────────────────────────────── */
const AuditCard: React.FC<{ entry: AuditLogEntry }> = ({ entry }) => {
  const [expanded, setExpanded] = useState(false);
  const config = ACTION_CONFIG[entry.action] ?? ACTION_CONFIG.UPDATE;
  const modelLabel = MODEL_LABELS[entry.model] ?? entry.model;
  const hasChanges = entry.changes && entry.changes.length > 0;

  return (
    <article className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900">
      {/* Header: action badge + model + timestamp */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${config.badge}`}>
            {config.icon}
            {config.label}
          </span>
          <span className="inline-flex px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {modelLabel}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap flex items-center gap-1">
          <Clock size={10} />
          {relativeTime(entry.createdAt)}
        </span>
      </div>

      {/* User */}
      <div className="mt-3 flex items-center gap-2">
        {entry.user ? (
          <>
            {entry.user.profileImage ? (
              <img
                src={entry.user.profileImage}
                alt={entry.user.name}
                className="w-5 h-5 rounded-full object-cover border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-[9px] font-black flex items-center justify-center">
                {getInitials(entry.user.name)}
              </div>
            )}
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
              {entry.user.name}
            </span>
          </>
        ) : (
          <span className="text-[11px] font-semibold text-slate-400 italic">Sistema</span>
        )}
      </div>

      {/* Changes (collapsible) */}
      {hasChanges && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {entry.changes!.length} {entry.changes!.length === 1 ? 'campo alterado' : 'campos alterados'}
          </button>
          {expanded && (
            <div className="mt-2 pl-1 border-l-2 border-slate-200 dark:border-slate-700 ml-1">
              {entry.changes!.map((c, i) => (
                <ChangeDiffRow key={i} change={c} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Metadata hint */}
      {entry.metadata && Object.keys(entry.metadata).length > 0 && !hasChanges && (
        <p className="mt-2 text-[10px] text-slate-400 italic">
          {entry.action === 'DELETE' && entry.metadata.deletedIds
            ? `${(entry.metadata.deletedIds as string[]).length} itens removidos em cascata`
            : JSON.stringify(entry.metadata).slice(0, 120)}
        </p>
      )}

      {/* Full timestamp */}
      <p className="mt-2 text-[10px] text-slate-400">
        {new Date(entry.createdAt).toLocaleString('pt-BR')}
      </p>
    </article>
  );
};

/* ── Main Page ────────────────────────────────────────────── */
export const AuditPage: React.FC = () => {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<ActionFilter>('TODOS');
  const [modelFilter, setModelFilter] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState<string | null>(null);
  const [knownModels, setKnownModels] = useState<string[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const PAGE_SIZE = 30;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Load users + distinct models for filter dropdowns
  useEffect(() => {
    usersApi.list().then(setUsers).catch(() => {});
    auditApi.distinctModels().then(setKnownModels).catch(() => {});
  }, []);

  const fetchData = useCallback(
    async (pageNum: number, action?: ActionFilter, model?: string | null, userId?: string | null) => {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { page: pageNum, pageSize: PAGE_SIZE };
        if (action && action !== 'TODOS') params.action = action;
        if (model) params.model = model;
        if (userId) params.userId = userId;
        const res = await auditApi.list(params as any);
        setEntries(res.data);
        setTotal(res.total);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Load on mount / filter change
  useEffect(() => {
    setPage(1);
    void fetchData(1, filter, modelFilter, userFilter);
  }, [filter, modelFilter, userFilter, fetchData]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      void fetchData(newPage, filter, modelFilter, userFilter);
    },
    [filter, modelFilter, userFilter, fetchData],
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Header */}
      <header className="p-6 pb-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600">
            <History size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-slate-100">
              Histórico de alterações
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
              {total} {total === 1 ? 'registro' : 'registros'}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 space-y-3">
          {/* Action filter */}
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400 shrink-0" />
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                    filter === f.key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-indigo-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* User + Model filters */}
          <div className="flex items-center gap-3 flex-wrap">
            {users.length > 0 && (
              <div className="flex items-center gap-2">
                <User size={14} className="text-slate-400 shrink-0" />
                <select
                  value={userFilter ?? ''}
                  onChange={(e) => setUserFilter(e.target.value || null)}
                  className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-0 outline-none cursor-pointer appearance-none pr-6 hover:bg-slate-200 dark:hover:bg-slate-700"
                  style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'3\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                >
                  <option value="">Todos os usuários</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {knownModels.length > 1 && (
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400 shrink-0" />
                <select
                  value={modelFilter ?? ''}
                  onChange={(e) => setModelFilter(e.target.value || null)}
                  className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-0 outline-none cursor-pointer appearance-none pr-6 hover:bg-slate-200 dark:hover:bg-slate-700"
                  style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'3\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                >
                  <option value="">Todos os tipos</option>
                  {knownModels.map((m) => (
                    <option key={m} value={m}>
                      {MODEL_LABELS[m] ?? m}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-3">
          {loading && entries.length === 0 ? (
            <div className="flex items-center justify-center py-20 gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 size={18} className="animate-spin" />
              Carregando histórico…
            </div>
          ) : entries.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-20">
              Nenhum registro de auditoria encontrado.
            </div>
          ) : (
            <>
              {entries.map((entry) => (
                <AuditCard key={entry.id} entry={entry} />
              ))}
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                totalItems={total}
                label="Histórico"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
