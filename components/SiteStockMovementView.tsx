
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package, Search, ArrowUpCircle, ArrowDownCircle,
  AlertTriangle, RefreshCw, CheckCircle2,
  Send, Clock, XCircle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  History, Boxes, Activity, FileText, Warehouse, Truck,
} from 'lucide-react';
import type { GlobalStockItem, GlobalStockMovement, StockRequest, StockRequestStatus } from '../types';
import { globalStockApi } from '../services/globalStockApi';
import { stockRequestApi } from '../services/stockRequestApi';
import { financial } from '../utils/math';
import { useToast } from '../hooks/useToast';
import { ConfirmModal } from './ConfirmModal';
import { DateFilterPopover } from './DateFilterPopover';

interface SiteStockMovementViewProps {
  projectId: string;
  canEditModule: boolean;
  isReadOnly?: boolean;
  projectName?: string;
}

type TabKey = 'catalog' | 'requests' | 'history';

const STATUS_LABELS: Record<StockRequestStatus, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovada',
  REJECTED: 'Rejeitada',
  PARTIALLY_DELIVERED: 'Entrega Parcial',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelada',
};

const STATUS_COLORS: Record<StockRequestStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  PARTIALLY_DELIVERED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DELIVERED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  CANCELLED: 'bg-slate-100 text-slate-500 dark:bg-slate-900/30 dark:text-slate-400',
};

export const SiteStockMovementView: React.FC<SiteStockMovementViewProps> = ({
  projectId,
  canEditModule,
  isReadOnly,
  projectName,
}) => {
  const toast = useToast();
  const canEdit = canEditModule && !isReadOnly;

  const [tab, setTab] = useState<TabKey>('history');
  const [loading, setLoading] = useState(true);

  // Catalog state
  const [catalog, setCatalog] = useState<GlobalStockItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Request modal state
  const [requestModal, setRequestModal] = useState<{
    item: GlobalStockItem;
    quantity: string;
    notes: string;
    decimals?: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Requests state
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [requestFilter, setRequestFilter] = useState<StockRequestStatus | 'ALL'>('ALL');

  // Movement history state
  const [movements, setMovements] = useState<GlobalStockMovement[]>([]);
  const [movementTotal, setMovementTotal] = useState(0);
  const [movementPage, setMovementPage] = useState(0);
  const PAGE_SIZE = 20;
  const [movDateStart, setMovDateStart] = useState('');
  const [movDateEnd, setMovDateEnd] = useState('');

  // Consumption summary state
  const [consumptionSummary, setConsumptionSummary] = useState<
    Array<{ itemId: string; name: string; unit: string; entry: number; exit: number }>
  >([]);
  const [summarySearch, setSummarySearch] = useState('');

  // Expandable details
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);

  /* ── loaders ── */
  const loadCatalog = useCallback(async () => {
    try {
      const items = await globalStockApi.list();
      setCatalog(items);
    } catch {
      toast.error('Erro ao carregar catálogo de materiais');
    }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const data = await stockRequestApi.list({ projectId });
      setRequests(data);
    } catch {
      toast.error('Erro ao carregar requisições');
    }
  }, [projectId]);

  const loadConsumptionSummary = useCallback(async () => {
    try {
      const data = await globalStockApi.getProjectConsumption(projectId);
      setConsumptionSummary(data);
    } catch {
      toast.error('Erro ao carregar resumo de consumo');
    }
  }, [projectId]);

  const loadMovements = useCallback(async (page = 0) => {
    try {
      const data = await globalStockApi.listMovements({
        projectId,
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
        dateStart: movDateStart || undefined,
        dateEnd: movDateEnd || undefined,
      });
      if (page === 0) {
        setMovements(data.movements);
      } else {
        setMovements((prev) => [...prev, ...data.movements]);
      }
      setMovementTotal(data.total);
      setMovementPage(page);
    } catch {
      toast.error('Erro ao carregar histórico de movimentações');
    }
  }, [projectId, movDateStart, movDateEnd]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([loadCatalog(), loadRequests(), loadMovements(0), loadConsumptionSummary()]);
      setLoading(false);
    };
    load();
  }, [loadCatalog, loadRequests, loadMovements, loadConsumptionSummary]);

  /* ── derived data ── */
  const filteredCatalog = useMemo(() => {
    if (!searchTerm) return catalog;
    const q = searchTerm.toLowerCase();
    return catalog.filter((i) => i.name.toLowerCase().includes(q));
  }, [catalog, searchTerm]);

  const filteredRequests = useMemo(() => {
    if (requestFilter === 'ALL') return requests;
    return requests.filter((r) => r.status === requestFilter);
  }, [requests, requestFilter]);

  const kpis = useMemo(() => {
    const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
    const approvedCount = requests.filter((r) => r.status === 'APPROVED').length;
    const awaitingDelivery = requests.filter((r) => r.status === 'APPROVED' || r.status === 'PARTIALLY_DELIVERED').length;
    const totalMov = movementTotal;
    return { pendingCount, approvedCount, awaitingDelivery, totalMov, catalogSize: catalog.length };
  }, [requests, movementTotal, catalog]);

  /* ── handlers ── */
  const handleRequest = async () => {
    if (!requestModal) return;
    const qty = financial.parseLocaleNumber(requestModal.quantity);
    if (!qty || qty <= 0) {
      toast.error('Informe uma quantidade válida');
      return;
    }

    try {
      setSubmitting(true);
      const created = await stockRequestApi.create({
        projectId,
        globalStockItemId: requestModal.item.id,
        quantity: qty,
        notes: requestModal.notes || undefined,
      });
      setRequests((prev) => [created, ...prev]);
      toast.success(`Requisição de ${requestModal.item.name} enviada ao almoxarifado`);
      setRequestModal(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar requisição');
    } finally {
      setSubmitting(false);
    }
  };

  const statusIcon = (status: GlobalStockItem['status']) => {
    switch (status) {
      case 'CRITICAL':
        return <AlertTriangle size={12} className="text-amber-500" />;
      case 'OUT_OF_STOCK':
        return <XCircle size={12} className="text-rose-500" />;
      default:
        return <CheckCircle2 size={12} className="text-emerald-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  const TabBtn: React.FC<{ id: TabKey; label: string; icon: React.ReactNode; badge?: number }> = ({
    id, label, icon, badge,
  }) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
        tab === id
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
          : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
      }`}
    >
      {icon} {label}
      {badge !== undefined && badge > 0 && (
        <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
          tab === id ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="flex flex-wrap items-stretch gap-3">
        <div className="flex-1 min-w-[140px] flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Warehouse size={16} className="text-indigo-500" />
          <div className="leading-tight">
            <p className="text-sm font-black text-slate-800 dark:text-white">{kpis.catalogSize}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Catálogo</p>
          </div>
        </div>
        <div className="flex-1 min-w-[140px] flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Clock size={16} className="text-amber-500" />
          <div className="leading-tight">
            <p className="text-sm font-black text-slate-800 dark:text-white">{kpis.pendingCount}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Pendentes</p>
          </div>
        </div>
        <div className="flex-1 min-w-[140px] flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <CheckCircle2 size={16} className="text-emerald-500" />
          <div className="leading-tight">
            <p className="text-sm font-black text-slate-800 dark:text-white">{kpis.approvedCount}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Aprovadas</p>
          </div>
        </div>
        {kpis.awaitingDelivery > 0 && (
          <div className="flex-1 min-w-[140px] flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <Truck size={16} className="text-blue-500" />
            <div className="leading-tight">
              <p className="text-sm font-black text-slate-800 dark:text-white">{kpis.awaitingDelivery}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Aguardando Envio</p>
            </div>
          </div>
        )}
        <div className="flex-1 min-w-[140px] flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Activity size={16} className="text-blue-500" />
          <div className="leading-tight">
            <p className="text-sm font-black text-slate-800 dark:text-white">{kpis.totalMov}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Movimentos</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <TabBtn id="history" label="Consumo" icon={<History size={14} />} />
        <TabBtn id="catalog" label="Catálogo" icon={<Package size={14} />} />
        <TabBtn id="requests" label="Requisições" icon={<FileText size={14} />} badge={kpis.pendingCount} />
      </div>

      {/* ═════════════ CATALOG TAB ═════════════ */}
      {tab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Buscar material no estoque global..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-xs font-bold"
              />
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <button
              onClick={loadCatalog}
              className="p-2.5 text-slate-400 hover:text-indigo-600 transition-all"
              title="Atualizar catálogo"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="hidden lg:grid grid-cols-[1fr_100px_120px_100px_140px] gap-4 px-8 py-4 bg-slate-50/50 dark:bg-slate-800/50 items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Material</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Unidade</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Disponível</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ação</span>
            </div>

            {filteredCatalog.length === 0 ? (
              <div className="p-20 text-center">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package size={32} className="text-slate-300" />
                </div>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                  {searchTerm ? 'Nenhum material encontrado' : 'Catálogo vazio'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCatalog.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-1 lg:grid-cols-[1fr_100px_120px_100px_140px] gap-2 lg:gap-4 px-6 lg:px-8 py-4 items-center hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{item.name}</p>
                      {item.supplier && (
                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">Fornecedor: {item.supplier.name}</p>
                      )}
                    </div>

                    <div className="text-center">
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {item.unit}
                      </span>
                    </div>

                    <div className="text-center">
                      <span className={`text-sm font-black ${
                        item.status === 'OUT_OF_STOCK' ? 'text-rose-500' :
                        item.status === 'CRITICAL' ? 'text-amber-500' :
                        'text-slate-700 dark:text-slate-200'
                      }`}>
                        {financial.formatQuantity(item.currentQuantity)}
                      </span>
                    </div>

                    <div className="flex justify-center">
                      <div className="flex items-center gap-1">
                        {statusIcon(item.status)}
                        <span className={`text-[9px] font-black uppercase tracking-widest ${
                          item.status === 'OUT_OF_STOCK' ? 'text-rose-500' :
                          item.status === 'CRITICAL' ? 'text-amber-500' :
                          'text-emerald-500'
                        }`}>
                          {item.status === 'OUT_OF_STOCK' ? 'Esgotado' :
                           item.status === 'CRITICAL' ? 'Crítico' : 'OK'}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      {canEdit && (
                        <button
                          onClick={() => setRequestModal({ item, quantity: '', notes: '' })}
                          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                        >
                          <Send size={12} /> Solicitar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═════════════ REQUESTS TAB ═════════════ */}
      {tab === 'requests' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['ALL', 'PENDING', 'APPROVED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'REJECTED', 'CANCELLED'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setRequestFilter(f)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  requestFilter === f
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                    : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {f === 'ALL' ? 'Todas' : STATUS_LABELS[f]}
                {f !== 'ALL' && (
                  <span className="ml-1.5 opacity-60">
                    ({requests.filter((r) => r.status === f).length})
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={loadRequests}
              className="ml-auto p-2 text-slate-400 hover:text-indigo-600 transition-all"
              title="Atualizar requisições"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {filteredRequests.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FileText size={28} className="text-slate-300" />
                </div>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                  Nenhuma requisição {requestFilter !== 'ALL' ? STATUS_LABELS[requestFilter].toLowerCase() : ''}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRequests.map((req) => (
                  <div key={req.id}>
                    <div
                      className="flex items-center gap-4 px-6 lg:px-8 py-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedRequest(expandedRequest === req.id ? null : req.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                          {req.itemName}
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                          Qtd: {financial.formatQuantity(req.quantity)}
                          {req.globalStockItem?.unit && ` ${req.globalStockItem.unit}`}
                          {' · '}
                          {new Date(req.date).toLocaleDateString('pt-BR')}
                        </p>
                      </div>

                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${STATUS_COLORS[req.status]}`}>
                        {STATUS_LABELS[req.status]}
                      </span>

                      {expandedRequest === req.id ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                    </div>

                    {expandedRequest === req.id && (
                      <div className="mx-6 lg:mx-8 mb-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Solicitado por</p>
                            <div className="flex items-center gap-2">
                              {req.requestedBy?.profileImage ? (
                                <img src={req.requestedBy.profileImage} alt="" className="w-5 h-5 rounded-full object-cover" />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                                  <span className="text-[8px] font-black text-white">{req.requestedBy?.name?.charAt(0).toUpperCase() ?? '?'}</span>
                                </div>
                              )}
                              <span className="font-bold text-slate-600 dark:text-slate-300">{req.requestedBy?.name ?? '—'}</span>
                            </div>
                          </div>

                          {req.approvedBy && (
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                {req.status === 'APPROVED' ? 'Aprovado por' : 'Processado por'}
                              </p>
                              <div className="flex items-center gap-2">
                                {req.approvedBy.profileImage ? (
                                  <img src={req.approvedBy.profileImage} alt="" className="w-5 h-5 rounded-full object-cover" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                                    <span className="text-[8px] font-black text-white">{req.approvedBy.name.charAt(0).toUpperCase()}</span>
                                  </div>
                                )}
                                <span className="font-bold text-slate-600 dark:text-slate-300">{req.approvedBy.name}</span>
                              </div>
                            </div>
                          )}

                          {req.approvedAt && (
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Data processamento</p>
                              <span className="font-bold text-slate-600 dark:text-slate-300">
                                {new Date(req.approvedAt).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          )}

                          {req.globalStockItem && (
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Estoque atual</p>
                              <span className={`font-black ${
                                req.globalStockItem.status === 'OUT_OF_STOCK' ? 'text-rose-500' :
                                req.globalStockItem.status === 'CRITICAL' ? 'text-amber-500' :
                                'text-emerald-500'
                              }`}>
                                {financial.formatQuantity(req.globalStockItem.currentQuantity)} {req.globalStockItem.unit}
                              </span>
                            </div>
                          )}

                          {req.notes && (
                            <div className="col-span-2 md:col-span-3">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Observação</p>
                              <span className="font-medium text-slate-600 dark:text-slate-300">{req.notes}</span>
                            </div>
                          )}

                          {req.status === 'REJECTED' && req.rejectionReason && (
                            <div className="col-span-2 md:col-span-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl px-3 py-2">
                              <p className="text-[9px] font-black uppercase tracking-widest text-rose-500 mb-1">Motivo da rejeição</p>
                              <span className="text-rose-700 dark:text-rose-300 font-medium">{req.rejectionReason}</span>
                            </div>
                          )}

                          {/* Delivery progress */}
                          {(req.status === 'APPROVED' || req.status === 'PARTIALLY_DELIVERED' || req.status === 'DELIVERED' || req.status === 'CANCELLED') && (
                            <div className="col-span-2 md:col-span-3">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Progresso de Envio</p>
                              <div className="flex items-center gap-3 mb-2">
                                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 rounded-full transition-all"
                                    style={{ width: `${req.quantity > 0 ? Math.round(((req.quantityDelivered ?? 0) / req.quantity) * 100) : 0}%` }}
                                  />
                                </div>
                                <span className="text-[9px] font-black text-slate-500 tabular-nums whitespace-nowrap">
                                  {financial.formatQuantity(req.quantityDelivered ?? 0)} / {financial.formatQuantity(req.quantity)} {req.globalStockItem?.unit ?? 'un'}
                                </span>
                              </div>
                              {req.deliveries && req.deliveries.length > 0 && (
                                <div className="space-y-1 mt-1">
                                  {req.deliveries.map((d, i) => (
                                    <p key={d.id ?? i} className="text-[9px] text-slate-400">
                                      <Truck size={9} className="inline mr-1 text-blue-400" />
                                      {financial.formatQuantity(d.quantity)} {req.globalStockItem?.unit ?? 'un'} — {new Date(d.deliveredAt).toLocaleDateString('pt-BR')} por {d.createdBy?.name ?? '—'}
                                      {d.notes && <span className="italic ml-1">({d.notes})</span>}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═════════════ CONSUMPTION HISTORY TAB ═════════════ */}
      {tab === 'history' && (
        <div className="space-y-6">
          {/* ── Consumption Summary Table ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Visão geral · {consumptionSummary.length} {consumptionSummary.length !== 1 ? 'materiais' : 'material'}
              </p>
              <div className="flex items-center gap-2">
                {consumptionSummary.length > 5 && (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Filtrar material..."
                      value={summarySearch}
                      onChange={(e) => setSummarySearch(e.target.value)}
                      className="w-44 pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-lg outline-none transition-all text-[10px] font-bold"
                    />
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                )}
                <button
                  onClick={loadConsumptionSummary}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 transition-all"
                  title="Atualizar resumo"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              {consumptionSummary.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Boxes size={24} className="text-slate-300" />
                  </div>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                    Nenhum material consumido nesta obra
                  </p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="hidden lg:grid grid-cols-[1fr_80px_100px] gap-4 px-8 py-3 bg-slate-50/50 dark:bg-slate-800/50 items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Material</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Unidade</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Consumido</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {consumptionSummary
                      .filter((row) =>
                        !summarySearch || row.name.toLowerCase().includes(summarySearch.toLowerCase()),
                      )
                      .map((row) => {
                        const total = row.entry + row.exit;
                        return (
                          <div
                            key={row.itemId}
                            className="grid grid-cols-2 lg:grid-cols-[1fr_80px_100px] gap-2 lg:gap-4 px-6 lg:px-8 py-3 items-center hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{row.name}</p>
                            </div>
                            <div className="text-center">
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-black uppercase tracking-widest text-slate-500">
                                {row.unit}
                              </span>
                            </div>
                            <div className="text-center">
                              <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                                {financial.formatQuantity(total)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Movement Log ── */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {movementTotal} movimentaç{movementTotal !== 1 ? 'ões' : 'ão'} nesta obra
            </p>
            <div className="flex items-center gap-2">
              <DateFilterPopover
                dateStart={movDateStart}
                dateEnd={movDateEnd}
                onDateStartChange={setMovDateStart}
                onDateEndChange={setMovDateEnd}
              />
              <button
                onClick={() => loadMovements(0)}
                className="p-2 text-slate-400 hover:text-indigo-600 transition-all"
                title="Atualizar"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {movements.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <History size={28} className="text-slate-300" />
                </div>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                  Nenhuma movimentação registrada
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {movements.map((mov) => (
                  <div key={mov.id} className="flex items-center gap-4 px-6 lg:px-8 py-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <div className={`p-2 rounded-xl ${
                      mov.type === 'entry'
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
                        : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600'
                    }`}>
                      {mov.type === 'entry' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                        {mov.globalStockItem?.name ?? 'Material'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                          mov.type === 'entry' ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {mov.type === 'entry' ? 'Entrada' : 'Saída'} · {financial.formatQuantity(mov.quantity)}
                        </span>
                        {mov.originDestination && (
                          <span className="text-[9px] text-slate-400 font-medium">
                            {mov.type === 'entry' ? 'de' : 'para'} {mov.originDestination}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      {mov.invoiceNumber && (
                        <p className="text-[9px] font-bold text-blue-600 dark:text-blue-400">NF {mov.invoiceNumber}</p>
                      )}
                      {mov.responsible && (
                        <p className="text-[9px] text-slate-400 font-medium">{mov.responsible}</p>
                      )}
                      <p className="text-[9px] text-slate-400">
                        {new Date(mov.date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}

                {movements.length < movementTotal && (
                  <button
                    onClick={() => loadMovements(movementPage + 1)}
                    className="w-full flex items-center justify-center gap-2 py-4 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all"
                  >
                    <ChevronDown size={14} /> Ver mais ({movementTotal - movements.length} restantes)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═════════════ REQUEST MODAL ═════════════ */}
      {requestModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-800 dark:text-white">Solicitar Material</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">
                {requestModal.item.name} ({requestModal.item.unit})
              </p>
            </div>

            <div className="px-8 py-6 space-y-5">
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <Boxes size={16} className="text-slate-400" />
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Disponível no Estoque</p>
                  <p className={`text-sm font-black ${
                    requestModal.item.status === 'OUT_OF_STOCK' ? 'text-rose-500' :
                    requestModal.item.status === 'CRITICAL' ? 'text-amber-500' :
                    'text-emerald-600'
                  }`}>
                    {financial.formatQuantity(requestModal.item.currentQuantity)} {requestModal.item.unit}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quantidade *</label>
                  <div className="inline-flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg py-0.5 px-0.5">
                    <button type="button" onClick={() => setRequestModal(prev => prev ? { ...prev, decimals: financial.clampDecimals((prev.decimals ?? 2) - 1, 2, 6), quantity: financial.maskDecimal(prev.quantity.replace(/\D/g, ''), financial.clampDecimals((prev.decimals ?? 2) - 1, 2, 6)) } : prev)} className="px-1.5 py-0.5 text-slate-500 dark:text-slate-300 rounded hover:bg-white dark:hover:bg-slate-700"><ChevronLeft size={10} /></button>
                    <span className="text-[8px] font-black text-slate-400 tabular-nums w-4 text-center">{requestModal.decimals ?? 2}</span>
                    <button type="button" onClick={() => setRequestModal(prev => prev ? { ...prev, decimals: financial.clampDecimals((prev.decimals ?? 2) + 1, 2, 6), quantity: financial.maskDecimal(prev.quantity.replace(/\D/g, ''), financial.clampDecimals((prev.decimals ?? 2) + 1, 2, 6)) } : prev)} className="px-1.5 py-0.5 text-slate-500 dark:text-slate-300 rounded hover:bg-white dark:hover:bg-slate-700"><ChevronRight size={10} /></button>
                  </div>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={requestModal.quantity}
                  onChange={(e) => setRequestModal({ ...requestModal, quantity: financial.maskDecimal(e.target.value, requestModal.decimals ?? 2) })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold"
                  placeholder="0,00"
                  autoFocus
                />
                {financial.parseLocaleNumber(requestModal.quantity) > requestModal.item.currentQuantity && requestModal.item.currentQuantity > 0 && (
                  <p className="text-[9px] text-amber-500 font-bold mt-1 flex items-center gap-1">
                    <AlertTriangle size={10} /> Quantidade excede o estoque disponível — o almoxarifado decidirá se atende
                  </p>
                )}
                {requestModal.item.status === 'OUT_OF_STOCK' && (
                  <p className="text-[9px] text-rose-500 font-bold mt-1 flex items-center gap-1">
                    <AlertTriangle size={10} /> Material esgotado — o almoxarifado receberá a requisição para providência
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                  Observação
                </label>
                <textarea
                  value={requestModal.notes}
                  onChange={(e) => setRequestModal({ ...requestModal, notes: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-medium resize-none"
                  rows={3}
                  placeholder="Para que será utilizado, urgência, etc."
                />
              </div>
            </div>

            <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setRequestModal(null)}
                className="px-5 py-2.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-black uppercase tracking-widest transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleRequest}
                disabled={submitting || !requestModal.quantity || financial.parseLocaleNumber(requestModal.quantity) <= 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                Enviar Requisição
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
