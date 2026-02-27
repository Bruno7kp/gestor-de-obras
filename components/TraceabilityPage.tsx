import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package, Search, ArrowDownCircle, ArrowUpCircle, AlertTriangle,
  ShoppingCart, ClipboardList, History, Truck, FileText,
  Check, X, Clock, RefreshCw, DollarSign,
} from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { stockRequestApi } from '../services/stockRequestApi';
import { purchaseRequestApi } from '../services/purchaseRequestApi';
import { globalStockApi } from '../services/globalStockApi';
import { financial } from '../utils/math';
import { ConfirmModal } from './ConfirmModal';
import type { StockRequest, PurchaseRequest, GlobalStockMovement, Supplier } from '../types';

interface TraceabilityPageProps {
  suppliers: Supplier[];
}

type Tab = 'requests' | 'purchases' | 'log';

/* ------------------------------------------------------------------ */
/*  Complete Purchase Modal                                            */
/* ------------------------------------------------------------------ */
const CompleteModal: React.FC<{
  purchase: PurchaseRequest;
  suppliers: Supplier[];
  onSave: (data: { unitPrice: number; invoiceNumber?: string; supplierId?: string }) => void;
  onClose: () => void;
}> = ({ purchase, suppliers, onSave, onClose }) => {
  const [unitPrice, setUnitPrice] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Confirmar Entrega</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
            {purchase.itemName} — {purchase.quantity} {purchase.globalStockItem?.unit ?? 'un'}
          </p>
        </div>
        <div className="px-8 py-6 space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Preço Unitário *</label>
            <input type="number" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} min={0.01} step="0.01" autoFocus />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Nº Nota Fiscal</label>
            <input className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Ex: NF-001234" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Fornecedor</label>
            <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
              <option value="">Nenhum</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-[10px] font-black uppercase tracking-widest transition-all">Cancelar</button>
          <button
            onClick={() => onSave({ unitPrice: parseFloat(unitPrice) || 0, invoiceNumber: invoiceNumber || undefined, supplierId: supplierId || undefined })}
            disabled={!parseFloat(unitPrice)}
            className="flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            <Check size={16} /> Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  KPI Card                                                           */
/* ------------------------------------------------------------------ */
const KpiCard = ({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) => {
  const colors: Record<string, string> = {
    indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20',
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
  };
  const c = colors[color] ?? colors.indigo;
  return (
    <div className="p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-32">
      <div className="flex justify-between items-start">
        <div className={`p-2 rounded-lg ${c}`}>{icon}</div>
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      </div>
      <p className={`text-xl font-black tracking-tighter ${c.split(' ')[0]}`}>{value}</p>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Reject Modal                                                       */
/* ------------------------------------------------------------------ */
const RejectModal: React.FC<{
  onConfirm: (reason?: string) => void;
  onClose: () => void;
}> = ({ onConfirm, onClose }) => {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Rejeitar Requisição</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Informe o motivo, se desejar</p>
        </div>
        <div className="px-8 py-6">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Motivo (opcional)</label>
          <textarea className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold resize-none" rows={3} value={reason} onChange={e => setReason(e.target.value)} autoFocus placeholder="Ex: Sem orçamento disponível..." />
        </div>
        <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-[10px] font-black uppercase tracking-widest transition-all">Cancelar</button>
          <button
            onClick={() => onConfirm(reason.trim() || undefined)}
            className="flex items-center gap-2 px-8 py-3 bg-rose-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-rose-500/20 hover:scale-105 active:scale-95 transition-all"
          >
            <X size={16} /> Rejeitar
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
export const TraceabilityPage: React.FC<TraceabilityPageProps> = ({ suppliers }) => {
  const { canView, canEdit } = usePermissions();
  const toast = useToast();

  const canWarehouse = canView('global_stock_warehouse');
  const canWarehouseEdit = canEdit('global_stock_warehouse');
  const canFinancial = canView('global_stock_financial');
  const canFinancialEdit = canEdit('global_stock_financial');

  const [tab, setTab] = useState<Tab>('requests');
  const [stockRequests, setStockRequests] = useState<StockRequest[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [movements, setMovements] = useState<GlobalStockMovement[]>([]);
  const [movementsTotal, setMovementsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [logFilter, setLogFilter] = useState<'all' | 'physical' | 'financial'>('all');
  const [completeModal, setCompleteModal] = useState<{ open: boolean; purchase?: PurchaseRequest }>({ open: false });
  const [rejectModal, setRejectModal] = useState<{ open: boolean; requestId?: string }>({ open: false });
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [sr, pr, mv] = await Promise.all([
        canWarehouse ? stockRequestApi.list() : Promise.resolve([]),
        purchaseRequestApi.list(),
        globalStockApi.listMovements({ take: 50 }),
      ]);
      setStockRequests(sr);
      setPurchaseRequests(pr);
      setMovements(mv.movements);
      setMovementsTotal(mv.total);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canWarehouse, canFinancial]);

  useEffect(() => { loadData(); }, [loadData]);

  // -- Derived data
  const pendingStockRequests = useMemo(() => stockRequests.filter(r => r.status === 'PENDING'), [stockRequests]);
  const processedStockRequests = useMemo(() => stockRequests.filter(r => r.status !== 'PENDING'), [stockRequests]);
  const activePurchases = useMemo(() => purchaseRequests.filter(r => r.status === 'PENDING' || r.status === 'ORDERED'), [purchaseRequests]);
  const completedPurchases = useMemo(() => purchaseRequests.filter(r => r.status === 'COMPLETED' || r.status === 'CANCELLED'), [purchaseRequests]);
  const filteredMovements = useMemo(() => {
    if (logFilter === 'all') return movements;
    if (logFilter === 'physical') return movements.filter(m => m.type === 'entry' || m.type === 'exit');
    return movements.filter(m => m.unitPrice != null);
  }, [movements, logFilter]);

  const kpis = useMemo(() => ({
    pendingRequests: pendingStockRequests.length,
    activePurchases: activePurchases.length,
    totalMovements: movementsTotal,
  }), [pendingStockRequests, activePurchases, movementsTotal]);

  // -- Handlers
  const handleApproveRequest = async (id: string) => {
    try {
      const updated = await stockRequestApi.approve(id);
      setStockRequests(prev => prev.map(r => r.id === id ? updated : r));
      toast.success('Requisição aprovada');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRejectRequest = async (reason?: string) => {
    if (!rejectModal.requestId) return;
    try {
      const updated = await stockRequestApi.reject(rejectModal.requestId, reason);
      setStockRequests(prev => prev.map(r => r.id === rejectModal.requestId ? updated : r));
      setRejectModal({ open: false });
      toast.success('Requisição rejeitada');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleMarkOrdered = async (id: string) => {
    try {
      const updated = await purchaseRequestApi.markOrdered(id);
      setPurchaseRequests(prev => prev.map(r => r.id === id ? updated : r));
      toast.success('Pedido marcado como realizado');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleComplete = async (data: { unitPrice: number; invoiceNumber?: string; supplierId?: string }) => {
    if (!completeModal.purchase) return;
    try {
      const updated = await purchaseRequestApi.complete(completeModal.purchase.id, data);
      setPurchaseRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      setCompleteModal({ open: false });
      toast.success('Entrega confirmada — estoque atualizado');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleCancelPurchase = async () => {
    if (!cancelConfirm) return;
    try {
      const updated = await purchaseRequestApi.cancel(cancelConfirm);
      setPurchaseRequests(prev => prev.map(r => r.id === cancelConfirm ? updated : r));
      setCancelConfirm(null);
      toast.success('Solicitação cancelada');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // -- Tab definitions
  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'requests', label: 'Requisições', icon: <ClipboardList size={14} /> },
    { key: 'purchases', label: 'Compras', icon: <ShoppingCart size={14} /> },
    { key: 'log', label: 'Log', icon: <History size={14} /> },
  ];

  // -- Status styles
  const stockRequestStatusConfig: Record<string, { bg: string; text: string; label: string }> = {
    PENDING: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Pendente' },
    APPROVED: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Aprovada' },
    REJECTED: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-400', label: 'Rejeitada' },
  };

  const purchaseStatusConfig: Record<string, { bg: string; text: string; label: string }> = {
    PENDING: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Pendente' },
    ORDERED: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Pedido feito' },
    COMPLETED: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Entregue' },
    CANCELLED: { bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-500 dark:text-slate-400', label: 'Cancelada' },
  };

  const priorityConfig: Record<string, { bg: string; text: string; label: string }> = {
    LOW: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-500', label: 'Baixa' },
    MEDIUM: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600', label: 'Média' },
    HIGH: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-600', label: 'Alta' },
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-12 animate-in fade-in duration-500 bg-slate-50 dark:bg-slate-950 custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Rastreabilidade & Logística</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Acompanhe requisições, compras e movimentações.</p>
          </div>
          <button onClick={loadData} className="flex items-center gap-2 px-6 py-3 text-slate-500 hover:text-indigo-600 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md text-[10px] font-black uppercase tracking-widest transition-all">
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>

        {/* KPI GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <KpiCard label="Requisições Pendentes" value={kpis.pendingRequests} icon={<ClipboardList size={20} />} color="amber" />
          <KpiCard label="Compras Ativas" value={kpis.activePurchases} icon={<ShoppingCart size={20} />} color="purple" />
          <KpiCard label="Total Movimentações" value={kpis.totalMovements} icon={<History size={20} />} color="indigo" />
        </div>

        {/* TABS */}
        <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                tab === t.key ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENT */}
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw size={24} className="animate-spin text-slate-400 mx-auto" />
          </div>
        ) : (
          <>
            {/* ========= REQUESTS TAB ========= */}
            {tab === 'requests' && (
              <div className="space-y-8">
                {/* Pending */}
                <div>
                  <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-1 flex items-center gap-2">
                    <Clock size={14} /> Pendentes ({pendingStockRequests.length})
                  </h2>
                  {pendingStockRequests.length === 0 ? (
                    <div className="py-12 text-center opacity-30 select-none">
                      <ClipboardList size={48} className="mx-auto mb-3" />
                      <p className="text-sm font-black uppercase tracking-widest">Nenhuma requisição pendente</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingStockRequests.map(r => {
                        const item = r.globalStockItem;
                        return (
                          <div key={r.id} className="bg-white dark:bg-slate-900 p-5 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                              <div className="flex items-center gap-4">
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl shrink-0">
                                  <ClipboardList size={22} className="text-amber-600" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <h3 className="text-sm font-black dark:text-white uppercase tracking-tight">{r.itemName}</h3>
                                    <span className="px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Pendente</span>
                                    {item && item.status !== 'NORMAL' && (
                                      <span className="px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-rose-100 dark:bg-rose-900/30 text-rose-600 flex items-center gap-1">
                                        <AlertTriangle size={9} /> Estoque {item.status === 'CRITICAL' ? 'Crítico' : 'Zerado'}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                    {financial.formatQuantity(r.quantity)} {item?.unit ?? 'un'}
                                    <span className="mx-1.5">•</span>
                                    {r.project?.name ?? 'Projeto'}
                                    <span className="mx-1.5">•</span>
                                    {r.requestedBy?.name ?? '—'}
                                    <span className="mx-1.5">•</span>
                                    {new Date(r.date).toLocaleDateString('pt-BR')}
                                  </p>
                                  {r.notes && <p className="text-[10px] text-slate-400 mt-1 italic">{r.notes}</p>}
                                </div>
                              </div>
                              {canWarehouseEdit && (
                                <div className="flex items-center gap-2">
                                  <button onClick={() => handleApproveRequest(r.id)} className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all">
                                    <Check size={14} /> Aprovar
                                  </button>
                                  <button onClick={() => setRejectModal({ open: true, requestId: r.id })} className="flex items-center gap-1.5 px-5 py-2.5 bg-rose-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-lg shadow-rose-500/20 hover:scale-105 active:scale-95 transition-all">
                                    <X size={14} /> Rejeitar
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Processed */}
                <div>
                  <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-1 flex items-center gap-2">
                    <Check size={14} /> Processadas ({processedStockRequests.length})
                  </h2>
                  {processedStockRequests.length === 0 ? (
                    <p className="text-center py-8 text-[10px] font-bold uppercase tracking-widest text-slate-400">Nenhuma requisição processada</p>
                  ) : (
                    <div className="space-y-3">
                      {processedStockRequests.map(r => {
                        const st = stockRequestStatusConfig[r.status] ?? stockRequestStatusConfig.PENDING;
                        return (
                          <div key={r.id} className="bg-white dark:bg-slate-900 p-5 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-all">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                              <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl shrink-0 ${st.bg}`}>
                                  {r.status === 'APPROVED' ? <Check size={20} className={st.text} /> : <X size={20} className={st.text} />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-3">
                                    <h3 className="text-sm font-black dark:text-white uppercase tracking-tight">{r.itemName}</h3>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${st.bg} ${st.text}`}>{st.label}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                    {financial.formatQuantity(r.quantity)} {r.globalStockItem?.unit ?? 'un'}
                                    <span className="mx-1.5">•</span>
                                    {r.project?.name ?? 'Projeto'}
                                    <span className="mx-1.5">•</span>
                                    {new Date(r.date).toLocaleDateString('pt-BR')}
                                  </p>
                                  {r.rejectionReason && (
                                    <p className="text-[9px] text-rose-500 mt-1 italic">Motivo: {r.rejectionReason}</p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                {r.approvedBy && (
                                  <p className="text-[9px] text-slate-400 font-bold">Por {r.approvedBy.name}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ========= PURCHASES TAB ========= */}
            {tab === 'purchases' && (
              <div className="space-y-8">
                {/* Active */}
                <div>
                  <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-1 flex items-center gap-2">
                    <ShoppingCart size={14} /> Pipeline de Compras ({activePurchases.length})
                  </h2>
                  {activePurchases.length === 0 ? (
                    <div className="py-12 text-center opacity-30 select-none">
                      <ShoppingCart size={48} className="mx-auto mb-3" />
                      <p className="text-sm font-black uppercase tracking-widest">Nenhuma compra ativa</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activePurchases.map(p => {
                        const ps = purchaseStatusConfig[p.status] ?? purchaseStatusConfig.PENDING;
                        const pr = priorityConfig[p.priority] ?? priorityConfig.MEDIUM;
                        return (
                          <div key={p.id} className="bg-white dark:bg-slate-900 p-5 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                              <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl shrink-0 ${ps.bg}`}>
                                  <ShoppingCart size={22} className={ps.text} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <h3 className="text-sm font-black dark:text-white uppercase tracking-tight">{p.itemName}</h3>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${ps.bg} ${ps.text}`}>{ps.label}</span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${pr.bg} ${pr.text}`}>{pr.label}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                    {financial.formatQuantity(p.quantity)} {p.globalStockItem?.unit ?? 'un'}
                                    <span className="mx-1.5">•</span>
                                    Solicitado por {p.requestedBy?.name ?? '—'}
                                    <span className="mx-1.5">•</span>
                                    {new Date(p.date).toLocaleDateString('pt-BR')}
                                  </p>
                                  {p.notes && <p className="text-[10px] text-slate-400 mt-1 italic">{p.notes}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {p.status === 'PENDING' && canFinancialEdit && (
                                  <button onClick={() => handleMarkOrdered(p.id)} className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all">
                                    <Truck size={14} /> Pedido Feito
                                  </button>
                                )}
                                {p.status === 'ORDERED' && canWarehouseEdit && (
                                  <button onClick={() => setCompleteModal({ open: true, purchase: p })} className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all">
                                    <Check size={14} /> Confirmar Entrega
                                  </button>
                                )}
                                {(p.status === 'PENDING' || p.status === 'ORDERED') && canFinancialEdit && (
                                  <button onClick={() => setCancelConfirm(p.id)} className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all" title="Cancelar">
                                    <X size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Completed */}
                {completedPurchases.length > 0 && (
                  <div>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-1 flex items-center gap-2">
                      <Check size={14} /> Finalizadas ({completedPurchases.length})
                    </h2>
                    <div className="space-y-3">
                      {completedPurchases.map(p => {
                        const ps = purchaseStatusConfig[p.status] ?? purchaseStatusConfig.COMPLETED;
                        return (
                          <div key={p.id} className="bg-white dark:bg-slate-900 p-5 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-all opacity-75">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                              <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl shrink-0 ${ps.bg}`}>
                                  {p.status === 'COMPLETED' ? <Check size={20} className={ps.text} /> : <X size={20} className={ps.text} />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-3">
                                    <h3 className="text-sm font-black dark:text-white uppercase tracking-tight">{p.itemName}</h3>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${ps.bg} ${ps.text}`}>{ps.label}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                    {financial.formatQuantity(p.quantity)} {p.globalStockItem?.unit ?? 'un'}
                                    {canFinancial && p.unitPrice != null && (
                                      <>
                                        <span className="mx-1.5">•</span>
                                        <DollarSign size={10} className="inline" /> R$ {p.unitPrice.toFixed(2)}
                                      </>
                                    )}
                                    {p.invoiceNumber && (
                                      <>
                                        <span className="mx-1.5">•</span>
                                        <FileText size={10} className="inline" /> {p.invoiceNumber}
                                      </>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] text-slate-400 font-bold">
                                  {p.completedAt ? new Date(p.completedAt).toLocaleDateString('pt-BR') : ''}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========= LOG TAB ========= */}
            {tab === 'log' && (
              <div className="space-y-6">
                {/* Filters */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                  {[
                    { key: 'all' as const, label: 'Todas' },
                    { key: 'physical' as const, label: 'Físicas' },
                    { key: 'financial' as const, label: 'Financeiras' },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setLogFilter(f.key)}
                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                        logFilter === f.key ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Movement log */}
                {filteredMovements.length === 0 ? (
                  <div className="py-12 text-center opacity-30 select-none">
                    <History size={48} className="mx-auto mb-3" />
                    <p className="text-sm font-black uppercase tracking-widest">Nenhuma movimentação registrada</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredMovements.map(m => (
                      <div key={m.id} className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className={`p-2.5 rounded-xl shrink-0 ${m.type === 'entry' ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-rose-50 dark:bg-rose-900/20'}`}>
                              {m.type === 'entry' ? <ArrowDownCircle size={18} className="text-emerald-600" /> : <ArrowUpCircle size={18} className="text-rose-600" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-black dark:text-white">
                                  {m.type === 'entry' ? 'Entrada' : 'Saída'}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">
                                  {financial.formatQuantity(m.quantity)} {m.globalStockItem?.unit ?? 'un'}
                                </span>
                                {m.globalStockItem && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500">
                                    {m.globalStockItem.name}
                                  </span>
                                )}
                              </div>
                              <p className="text-[9px] text-slate-400 font-medium flex items-center gap-2 flex-wrap mt-0.5">
                                {m.originDestination}
                                {m.project && <span>• {m.project.name}</span>}
                                {m.supplier && <span className="flex items-center gap-0.5"><Truck size={9} /> {m.supplier.name}</span>}
                                {canFinancial && m.unitPrice != null && <span>• R$ {m.unitPrice.toFixed(2)}/un</span>}
                                {m.invoiceNumber && <span className="flex items-center gap-0.5"><FileText size={9} /> {m.invoiceNumber}</span>}
                                {m.createdBy && <span>• {m.createdBy.name}</span>}
                              </p>
                            </div>
                          </div>
                          <span className="text-[9px] text-slate-400 whitespace-nowrap font-bold">{new Date(m.date).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Complete Modal */}
      {completeModal.open && completeModal.purchase && (
        <CompleteModal
          purchase={completeModal.purchase}
          suppliers={suppliers}
          onSave={handleComplete}
          onClose={() => setCompleteModal({ open: false })}
        />
      )}
      {/* Reject Modal */}
      {rejectModal.open && (
        <RejectModal
          onConfirm={handleRejectRequest}
          onClose={() => setRejectModal({ open: false })}
        />
      )}
      {/* Cancel Confirm */}
      <ConfirmModal
        isOpen={!!cancelConfirm}
        title="Cancelar solicitação"
        message="Tem certeza que deseja cancelar esta solicitação de compra?"
        confirmLabel="Cancelar solicitação"
        cancelLabel="Voltar"
        variant="danger"
        onConfirm={handleCancelPurchase}
        onCancel={() => setCancelConfirm(null)}
      />
    </div>
  );
};
