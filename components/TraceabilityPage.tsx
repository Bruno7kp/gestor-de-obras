import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Package, Search, ArrowDownCircle, ArrowUpCircle, AlertTriangle,
  ShoppingCart, ClipboardList, Truck, FileText,
  Check, X, Clock, RefreshCw, DollarSign, Bell, User,
  ChevronLeft, ChevronRight, Globe,
} from 'lucide-react';
import { Pagination } from './Pagination';
import { DateFilterPopover } from './DateFilterPopover';
import { useCrossInstanceStock } from '../hooks/useCrossInstanceStock';
import { useToast } from '../hooks/useToast';
import { stockRequestApi } from '../services/stockRequestApi';
import { purchaseRequestApi } from '../services/purchaseRequestApi';
import { financial } from '../utils/math';
import { ConfirmModal } from './ConfirmModal';
import type { StockRequest, PurchaseRequest, Supplier } from '../types';

interface TraceabilityPageProps {
  suppliers: Supplier[];
}

type Tab = 'requests' | 'purchases';

const MIN_DECIMALS = 2;
const MAX_DECIMALS = 6;

const DecimalControls: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => (
  <div className="inline-flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg py-0.5 px-0.5">
    <button type="button" onClick={() => onChange(financial.clampDecimals(value - 1, MIN_DECIMALS, MAX_DECIMALS))} className="px-1.5 py-0.5 text-slate-500 dark:text-slate-300 rounded hover:bg-white dark:hover:bg-slate-700" title="Menos casas decimais"><ChevronLeft size={10} /></button>
    <span className="text-[8px] font-black text-slate-400 tabular-nums w-4 text-center">{value}</span>
    <button type="button" onClick={() => onChange(financial.clampDecimals(value + 1, MIN_DECIMALS, MAX_DECIMALS))} className="px-1.5 py-0.5 text-slate-500 dark:text-slate-300 rounded hover:bg-white dark:hover:bg-slate-700" title="Mais casas decimais"><ChevronRight size={10} /></button>
  </div>
);

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
  const [priceDecimals, setPriceDecimals] = useState(MIN_DECIMALS);
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
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Preço Unitário *</label>
              <DecimalControls value={priceDecimals} onChange={d => { setPriceDecimals(d); setUnitPrice(prev => prev ? financial.maskDecimal(prev.replace(/\D/g, ''), d) : prev); }} />
            </div>
            <input type="text" inputMode="decimal" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold" value={unitPrice} onChange={e => setUnitPrice(financial.maskDecimal(e.target.value, priceDecimals))} autoFocus />
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
            onClick={() => onSave({ unitPrice: financial.parseLocaleNumber(unitPrice), invoiceNumber: invoiceNumber || undefined, supplierId: supplierId || undefined })}
            disabled={!financial.parseLocaleNumber(unitPrice)}
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
    indigo: 'text-indigo-500',
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    purple: 'text-purple-500',
    blue: 'text-blue-500',
  };
  const c = colors[color] ?? colors.indigo;
  return (
    <div className="flex-1 flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className={c}>{icon}</div>
      <div className="leading-tight">
        <p className="text-sm font-black text-slate-800 dark:text-white">{value}</p>
        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
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
/*  Purchase From Request Modal                                        */
/* ------------------------------------------------------------------ */
const PurchaseFromRequestModal: React.FC<{
  request: StockRequest;
  onSave: (qty: number, notes: string) => void;
  onClose: () => void;
}> = ({ request, onSave, onClose }) => {
  const deficit = Math.max(0, request.quantity - (request.globalStockItem?.currentQuantity ?? 0));
  const [qtyDecimals, setQtyDecimals] = useState(MIN_DECIMALS);
  const [quantity, setQuantity] = useState(() => financial.maskDecimal(String(Math.round(deficit * 100)), MIN_DECIMALS));
  const [notes, setNotes] = useState(
    `Estoque insuficiente para requisição de ${request.project?.name ?? 'projeto'}.`,
  );
  const parsedQty = financial.parseLocaleNumber(quantity);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Solicitar Compra</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{request.itemName}</p>
        </div>
        <div className="px-8 py-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quantidade *</label>
              <DecimalControls value={qtyDecimals} onChange={d => { setQtyDecimals(d); setQuantity(prev => prev ? financial.maskDecimal(prev.replace(/\D/g, ''), d) : prev); }} />
            </div>
            <input type="text" inputMode="decimal" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold" value={quantity} onChange={e => setQuantity(financial.maskDecimal(e.target.value, qtyDecimals))} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Estoque atual</p>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{financial.formatQuantity(request.globalStockItem?.currentQuantity ?? 0)} {request.globalStockItem?.unit ?? 'un'}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Solicitado</p>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{financial.formatQuantity(request.quantity)} {request.globalStockItem?.unit ?? 'un'}</p>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Observação</label>
            <textarea className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-[10px] font-black uppercase tracking-widest transition-all">Cancelar</button>
          <button
            onClick={() => { if (parsedQty > 0) onSave(parsedQty, notes); }}
            disabled={parsedQty <= 0}
            className="flex items-center gap-2 px-8 py-3 bg-purple-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-purple-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            <ShoppingCart size={16} /> Solicitar
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Deliver Modal                                                      */
/* ------------------------------------------------------------------ */
const DeliverModal: React.FC<{
  request: StockRequest;
  onSave: (data: { quantity: number; notes?: string; createPurchaseForRemaining?: boolean }) => void;
  onClose: () => void;
}> = ({ request, onSave, onClose }) => {
  const delivered = request.quantityDelivered ?? 0;
  const remaining = Math.max(0, request.quantity - delivered);
  const stockAvailable = request.globalStockItem?.currentQuantity ?? 0;
  const maxDeliverable = Math.min(remaining, stockAvailable);
  const [qtyDecimals, setQtyDecimals] = useState(MIN_DECIMALS);
  const [quantity, setQuantity] = useState(() => financial.maskDecimal(String(Math.round(maxDeliverable * 100)), MIN_DECIMALS));
  const [notes, setNotes] = useState('');
  const [createPurchase, setCreatePurchase] = useState(false);
  const parsedQty = financial.parseLocaleNumber(quantity);
  const afterDelivery = delivered + parsedQty;
  const willRemain = Math.max(0, request.quantity - afterDelivery);
  const pctAfter = request.quantity > 0 ? Math.round((afterDelivery / request.quantity) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Registrar Envio</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
            {request.itemName} — {request.project?.name ?? 'Projeto'}
          </p>
        </div>
        <div className="px-8 py-6 space-y-5">
          {/* Info grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Solicitado</p>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{financial.formatQuantity(request.quantity)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Já Enviado</p>
              <p className="text-sm font-bold text-blue-600">{financial.formatQuantity(delivered)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Disponível</p>
              <p className={`text-sm font-bold ${stockAvailable >= remaining ? 'text-emerald-600' : 'text-amber-600'}`}>{financial.formatQuantity(stockAvailable)}</p>
            </div>
          </div>
          {/* Quantity input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quantidade a enviar *</label>
              <DecimalControls value={qtyDecimals} onChange={d => { setQtyDecimals(d); setQuantity(prev => prev ? financial.maskDecimal(prev.replace(/\D/g, ''), d) : prev); }} />
            </div>
            <input type="text" inputMode="decimal" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-blue-500 rounded-xl outline-none transition-all text-sm font-bold" value={quantity} onChange={e => setQuantity(financial.maskDecimal(e.target.value, qtyDecimals))} autoFocus />
            {parsedQty > remaining && (
              <p className="text-[9px] text-rose-500 font-bold mt-1">Quantidade excede o restante ({financial.formatQuantity(remaining)})</p>
            )}
            {parsedQty > stockAvailable && parsedQty <= remaining && (
              <p className="text-[9px] text-rose-500 font-bold mt-1">Quantidade excede o estoque disponível ({financial.formatQuantity(stockAvailable)})</p>
            )}
          </div>
          {/* Progress preview */}
          {parsedQty > 0 && parsedQty <= remaining && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Progresso após envio</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pctAfter}%` }} />
                </div>
                <span className="text-[9px] font-black text-blue-600 tabular-nums">{pctAfter}%</span>
              </div>
              {willRemain > 0 && (
                <p className="text-[9px] text-slate-400 mt-1">Ainda restará {financial.formatQuantity(willRemain)} {request.globalStockItem?.unit ?? 'un'}</p>
              )}
            </div>
          )}
          {/* Notes */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Observação</label>
            <textarea className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-blue-500 rounded-xl outline-none transition-all text-sm font-bold resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Enviado via transporte próprio..." />
          </div>
          {/* Purchase checkbox */}
          {willRemain > 0 && stockAvailable < remaining && (
            <label className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/40 rounded-xl cursor-pointer">
              <input type="checkbox" checked={createPurchase} onChange={e => setCreatePurchase(e.target.checked)} className="mt-0.5 accent-purple-600" />
              <div>
                <p className="text-[10px] font-black text-purple-700 dark:text-purple-300">Solicitar compra para o restante</p>
                <p className="text-[9px] text-purple-500 dark:text-purple-400 mt-0.5">
                  Será criada uma solicitação de compra de {financial.formatQuantity(willRemain)} {request.globalStockItem?.unit ?? 'un'}
                </p>
              </div>
            </label>
          )}
        </div>
        <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-[10px] font-black uppercase tracking-widest transition-all">Cancelar</button>
          <button
            onClick={() => { if (parsedQty > 0 && parsedQty <= remaining) onSave({ quantity: parsedQty, notes: notes.trim() || undefined, createPurchaseForRemaining: createPurchase || undefined }); }}
            disabled={parsedQty <= 0 || parsedQty > remaining || parsedQty > stockAvailable}
            className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            <Truck size={16} /> Enviar
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
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const externalInstanceId = searchParams.get('instanceId') || undefined;
  const externalInstanceName = searchParams.get('instanceName') || undefined;

  // Resolved permissions (cross-instance when external, home otherwise)
  const { canView, canEdit } = useCrossInstanceStock(externalInstanceId);

  const canWarehouse = canView('global_stock_warehouse');
  const canWarehouseEdit = canEdit('global_stock_warehouse');
  const canFinancial = canView('global_stock_financial');
  const canFinancialEdit = canEdit('global_stock_financial');

  const [tab, setTabState] = useState<Tab>(() => {
    const saved = localStorage.getItem('traceability_tab') as Tab | null;
    if (saved === 'requests' || saved === 'purchases') return saved;
    return !canWarehouse && canFinancial ? 'purchases' : 'requests';
  });
  const setTab = (t: Tab) => { setTabState(t); localStorage.setItem('traceability_tab', t); };
  const [stockRequests, setStockRequests] = useState<StockRequest[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [completeModal, setCompleteModal] = useState<{ open: boolean; purchase?: PurchaseRequest }>({ open: false });
  const [rejectModal, setRejectModal] = useState<{ open: boolean; requestId?: string }>({ open: false });
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [approveConfirm, setApproveConfirm] = useState<StockRequest | null>(null);
  const [orderedConfirm, setOrderedConfirm] = useState<PurchaseRequest | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [purchaseFromReq, setPurchaseFromReq] = useState<StockRequest | null>(null);
  const [deliverModal, setDeliverModal] = useState<StockRequest | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [srResult, prResult] = await Promise.allSettled([
      canWarehouse ? stockRequestApi.list({ instanceId: externalInstanceId }) : Promise.resolve([]),
      (canWarehouse || canFinancial) ? purchaseRequestApi.list(undefined, externalInstanceId) : Promise.resolve([]),
    ]);
    if (srResult.status === 'fulfilled') setStockRequests(srResult.value);
    else toast.error('Erro ao carregar requisições');
    if (prResult.status === 'fulfilled') setPurchaseRequests(prResult.value);
    else toast.error('Erro ao carregar solicitações de compra');
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canWarehouse, canFinancial, externalInstanceId]);

  useEffect(() => { loadData(); }, [loadData]);

  // -- Derived data
  const allPendingStockRequests = useMemo(() => stockRequests.filter(r => r.status === 'PENDING'), [stockRequests]);
  const activePurchases = useMemo(() => purchaseRequests.filter(r => r.status === 'PENDING' || r.status === 'ORDERED'), [purchaseRequests]);

  const pendingStockRequests = allPendingStockRequests;

  const awaitingDeliveryRequests = useMemo(() => stockRequests.filter(r => r.status === 'APPROVED' || r.status === 'PARTIALLY_DELIVERED'), [stockRequests]);
  const processedStockRequests = useMemo(() => stockRequests.filter(r => r.status === 'DELIVERED' || r.status === 'REJECTED'), [stockRequests]);
  const completedPurchases = useMemo(() => purchaseRequests.filter(r => r.status === 'COMPLETED' || r.status === 'CANCELLED'), [purchaseRequests]);

  // -- Search & Pagination (client-side)
  const HIST_PAGE_SIZE = 10;
  const [histSearch, setHistSearch] = useState('');
  const [histDateStart, setHistDateStart] = useState('');
  const [histDateEnd, setHistDateEnd] = useState('');
  const [processedPage, setProcessedPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);

  // Reset pages when search/date changes
  useEffect(() => { setProcessedPage(1); setCompletedPage(1); }, [histSearch, histDateStart, histDateEnd]);

  const isWithinHistRange = useCallback((dateStr?: string) => {
    if (!histDateStart && !histDateEnd) return true;
    if (!dateStr) return false;
    const d = dateStr.slice(0, 10);
    if (histDateStart && d < histDateStart) return false;
    if (histDateEnd && d > histDateEnd) return false;
    return true;
  }, [histDateStart, histDateEnd]);

  const filteredProcessed = useMemo(() => {
    let list = processedStockRequests;
    if (histDateStart || histDateEnd) {
      list = list.filter(r => isWithinHistRange(r.date));
    }
    if (histSearch) {
      const q = histSearch.toLowerCase();
      list = list.filter(r =>
        r.itemName.toLowerCase().includes(q) ||
        (r.project?.name ?? '').toLowerCase().includes(q) ||
        (r.approvedBy?.name ?? '').toLowerCase().includes(q) ||
        (r.requestedBy?.name ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [processedStockRequests, histSearch, histDateStart, histDateEnd, isWithinHistRange]);

  const filteredCompleted = useMemo(() => {
    let list = completedPurchases;
    if (histDateStart || histDateEnd) {
      list = list.filter(p => isWithinHistRange(p.completedAt || p.createdAt));
    }
    if (histSearch) {
      const q = histSearch.toLowerCase();
      list = list.filter(p =>
        p.itemName.toLowerCase().includes(q) ||
        (p.globalStockItem?.name ?? '').toLowerCase().includes(q) ||
        (p.invoiceNumber ?? '').toLowerCase().includes(q) ||
        (p.requestedBy?.name ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [completedPurchases, histSearch, histDateStart, histDateEnd, isWithinHistRange]);

  const processedTotalPages = Math.max(1, Math.ceil(filteredProcessed.length / HIST_PAGE_SIZE));
  const completedTotalPages = Math.max(1, Math.ceil(filteredCompleted.length / HIST_PAGE_SIZE));

  const paginatedProcessed = useMemo(() =>
    filteredProcessed.slice((processedPage - 1) * HIST_PAGE_SIZE, processedPage * HIST_PAGE_SIZE),
  [filteredProcessed, processedPage]);

  const paginatedCompleted = useMemo(() =>
    filteredCompleted.slice((completedPage - 1) * HIST_PAGE_SIZE, completedPage * HIST_PAGE_SIZE),
  [filteredCompleted, completedPage]);

  const kpis = useMemo(() => ({
    pendingRequests: pendingStockRequests.length,
    awaitingDelivery: awaitingDeliveryRequests.length,
    activePurchases: activePurchases.length,
  }), [pendingStockRequests, awaitingDeliveryRequests, activePurchases]);

  // -- Handlers
  const handleApproveRequest = async (id: string) => {
    try {
      const updated = await stockRequestApi.approve(id, externalInstanceId);
      setStockRequests(prev => prev.map(r => r.id === id ? updated : r));
      toast.success('Requisição aprovada');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRejectRequest = async (reason?: string) => {
    if (!rejectModal.requestId) return;
    try {
      const updated = await stockRequestApi.reject(rejectModal.requestId, reason, externalInstanceId);
      setStockRequests(prev => prev.map(r => r.id === rejectModal.requestId ? updated : r));
      setRejectModal({ open: false });
      toast.success('Requisição rejeitada');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRequestPurchase = async (qty: number, notes: string) => {
    if (!purchaseFromReq) return;
    try {
      const created = await purchaseRequestApi.create({
        globalStockItemId: purchaseFromReq.globalStockItemId,
        quantity: qty,
        priority: 'MEDIUM',
        notes: notes || undefined,
        stockRequestId: purchaseFromReq.id,
        instanceId: externalInstanceId,
      });
      setPurchaseRequests(prev => [created, ...prev]);
      // Reload stock requests to refresh linkedPurchaseRequests
      if (canWarehouse) {
        stockRequestApi.list({ instanceId: externalInstanceId }).then(setStockRequests).catch(() => {});
      }
      setPurchaseFromReq(null);
      toast.success(`Solicitação de compra criada (${financial.formatQuantity(qty)} ${purchaseFromReq.globalStockItem?.unit ?? 'un'})`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeliver = async (data: { quantity: number; notes?: string; createPurchaseForRemaining?: boolean }) => {
    if (!deliverModal) return;
    try {
      const updated = await stockRequestApi.deliver(deliverModal.id, { ...data, instanceId: externalInstanceId });
      setStockRequests(prev => prev.map(r => r.id === deliverModal.id ? updated : r));
      setDeliverModal(null);
      toast.success(`Entrega registrada — ${financial.formatQuantity(data.quantity)} ${deliverModal.globalStockItem?.unit ?? 'un'}`);
      if (data.createPurchaseForRemaining) {
        const pr = await purchaseRequestApi.list(undefined, externalInstanceId);
        setPurchaseRequests(pr);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleMarkOrdered = async (id: string) => {
    try {
      const updated = await purchaseRequestApi.markOrdered(id, externalInstanceId);
      setPurchaseRequests(prev => prev.map(r => r.id === id ? updated : r));
      toast.success('Pedido marcado como realizado');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleComplete = async (data: { unitPrice: number; invoiceNumber?: string; supplierId?: string }) => {
    if (!completeModal.purchase) return;
    try {
      const updated = await purchaseRequestApi.complete(completeModal.purchase.id, { ...data, instanceId: externalInstanceId });
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
      const updated = await purchaseRequestApi.cancel(cancelConfirm, externalInstanceId);
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
  ];

  // -- Status styles
  const stockRequestStatusConfig: Record<string, { bg: string; text: string; label: string }> = {
    PENDING: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Pendente' },
    APPROVED: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Aprovada' },
    REJECTED: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-400', label: 'Rejeitada' },
    PARTIALLY_DELIVERED: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Entrega Parcial' },
    DELIVERED: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Entregue' },
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

        {/* EXTERNAL INSTANCE BANNER */}
        {externalInstanceId && (
          <div className="flex items-center gap-3 px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl">
            <Globe size={18} className="text-amber-600 shrink-0" />
            <p className="flex-1 text-sm font-bold text-amber-700 dark:text-amber-300">
              Visualizando rastreabilidade de <span className="font-black">{externalInstanceName ?? 'outra instância'}</span>
            </p>
          </div>
        )}

        {/* HEADER */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
              Rastreabilidade & Logística{externalInstanceName ? ` — ${externalInstanceName}` : ''}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Acompanhe requisições, compras e movimentações.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadData} className="flex items-center gap-2 px-6 py-3 text-slate-500 hover:text-indigo-600 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md text-[10px] font-black uppercase tracking-widest transition-all">
              <RefreshCw size={14} /> Atualizar
            </button>
            <button
              onClick={() => setShowDrawer(true)}
              className="relative flex items-center justify-center w-10 h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all"
              title="Notificações pendentes"
            >
              <Bell size={16} className="text-amber-500" />
              {(pendingStockRequests.length > 0 || awaitingDeliveryRequests.length > 0 || activePurchases.length > 0) && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black shadow-lg">
                  {pendingStockRequests.length + awaitingDeliveryRequests.length + activePurchases.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* KPI GRID + TABS */}
        <div className="flex flex-wrap items-stretch gap-3">
          <KpiCard label="Requisições Pendentes" value={kpis.pendingRequests} icon={<ClipboardList size={16} />} color="amber" />
          <KpiCard label="Aguardando Envio" value={kpis.awaitingDelivery} icon={<Truck size={16} />} color="blue" />
          <KpiCard label="Compras Ativas" value={kpis.activePurchases} icon={<ShoppingCart size={16} />} color="purple" />
          <div className="flex-1" />
          {/* Search + Date filter */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar item, obra, solicitante…"
                value={histSearch}
                onChange={e => setHistSearch(e.target.value)}
                className="pl-10 pr-4 py-2 w-48 bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:bg-white dark:focus:bg-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-xs font-bold"
              />
              {histSearch && (
                <button onClick={() => setHistSearch('')} className="absolute right-1 p-0.5 text-slate-400 hover:text-slate-600 transition-all">
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
            <DateFilterPopover
              dateStart={histDateStart}
              dateEnd={histDateEnd}
              onDateStartChange={setHistDateStart}
              onDateEndChange={setHistDateEnd}
            />
          </div>
          <div className="flex items-center bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                  tab === t.key ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
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
                    <p className="text-center py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Nenhuma requisição pendente</p>
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
                                    {item && item.currentQuantity < r.quantity && (
                                      <span className="px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center gap-1">
                                        <AlertTriangle size={9} /> Estoque insuficiente ({financial.formatQuantity(item.currentQuantity)}/{financial.formatQuantity(r.quantity)})
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
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button onClick={() => setApproveConfirm(r)} className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all">
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

                {/* Awaiting Delivery */}
                {awaitingDeliveryRequests.length > 0 && (
                  <div>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-1 flex items-center gap-2">
                      <Truck size={14} /> Aguardando Envio ({awaitingDeliveryRequests.length})
                    </h2>
                    <div className="space-y-3">
                      {awaitingDeliveryRequests.map(r => {
                        const item = r.globalStockItem;
                        const delivered = r.quantityDelivered ?? 0;
                        const remaining = Math.max(0, r.quantity - delivered);
                        const pct = r.quantity > 0 ? Math.round((delivered / r.quantity) * 100) : 0;
                        const st = stockRequestStatusConfig[r.status] ?? stockRequestStatusConfig.APPROVED;
                        const activePurchase = r.linkedPurchaseRequests?.find(p => p.status === 'PENDING' || p.status === 'ORDERED');
                        const hasEnoughStock = item != null && item.currentQuantity >= remaining;
                        return (
                          <div key={r.id} className="bg-white dark:bg-slate-900 p-5 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl shrink-0">
                                  <Truck size={22} className="text-blue-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <h3 className="text-sm font-black dark:text-white uppercase tracking-tight">{r.itemName}</h3>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${st.bg} ${st.text}`}>{st.label}</span>
                                    {hasEnoughStock && (
                                      <span className="px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                        <Check size={9} /> Disponível para Retirada
                                      </span>
                                    )}
                                    {activePurchase && (
                                      <span className="px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center gap-1">
                                        <ShoppingCart size={9} /> Compra {activePurchase.status === 'ORDERED' ? 'pedido feito' : 'pendente'}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                    {financial.formatQuantity(r.quantity)} {item?.unit ?? 'un'}
                                    <span className="mx-1.5">•</span>
                                    {r.project?.name ?? 'Projeto'}
                                    <span className="mx-1.5">•</span>
                                    {r.requestedBy?.name ?? '—'}
                                  </p>
                                  {/* Progress bar */}
                                  <div className="mt-2 flex items-center gap-3">
                                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-[9px] font-black text-slate-500 tabular-nums whitespace-nowrap">
                                      {financial.formatQuantity(delivered)} / {financial.formatQuantity(r.quantity)} ({pct}%)
                                    </span>
                                  </div>
                                  {/* Delivery history */}
                                  {r.deliveries && r.deliveries.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {r.deliveries.map((d, i) => (
                                        <p key={d.id ?? i} className="text-[9px] text-slate-400">
                                          <ArrowUpCircle size={9} className="inline mr-1 text-blue-400" />
                                          {financial.formatQuantity(d.quantity)} {item?.unit ?? 'un'} — {new Date(d.deliveredAt).toLocaleDateString('pt-BR')} por {d.createdBy?.name ?? '—'}
                                          {d.notes && <span className="italic ml-1">({d.notes})</span>}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {canWarehouseEdit && (
                                <div className="flex items-center gap-2 flex-wrap shrink-0">
                                  <div className="text-right mr-2">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Restante</p>
                                    <p className="text-sm font-black text-blue-600">{financial.formatQuantity(remaining)} {item?.unit ?? 'un'}</p>
                                    {item && <p className={`text-[9px] mt-0.5 font-bold ${item.currentQuantity >= remaining ? 'text-emerald-500' : 'text-amber-500'}`}>Disponível: {financial.formatQuantity(item.currentQuantity)}</p>}
                                  </div>
                                  <button onClick={() => setDeliverModal(r)} className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all">
                                    <Truck size={14} /> Enviar
                                  </button>
                                  {!activePurchase && (
                                    <button onClick={() => setPurchaseFromReq(r)} className="flex items-center gap-1.5 px-5 py-2.5 bg-purple-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-lg shadow-purple-500/20 hover:scale-105 active:scale-95 transition-all">
                                      <ShoppingCart size={14} /> Solicitar Compra
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Processed */}
                <div>
                  <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-1 flex items-center gap-2">
                    <Check size={14} /> Processadas ({filteredProcessed.length})
                  </h2>
                  {filteredProcessed.length === 0 ? (
                    <p className="text-center py-8 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {histSearch ? 'Nenhum resultado encontrado' : 'Nenhuma requisição processada'}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {paginatedProcessed.map(r => {
                        const st = stockRequestStatusConfig[r.status] ?? stockRequestStatusConfig.PENDING;
                        return (
                          <div key={r.id} className="bg-white dark:bg-slate-900 p-5 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-all">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                              <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl shrink-0 ${st.bg}`}>
                                  {r.status === 'DELIVERED' ? <Check size={20} className={st.text} /> : <X size={20} className={st.text} />}
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
                      <Pagination
                        currentPage={processedPage}
                        totalPages={processedTotalPages}
                        onPageChange={setProcessedPage}
                        totalItems={filteredProcessed.length}
                        label="Processadas"
                      />
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
                    <ShoppingCart size={14} /> Solicitações de Compras ({activePurchases.length})
                  </h2>
                  {activePurchases.length === 0 ? (
                    <p className="text-center py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Nenhuma compra ativa</p>
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
                                  <button onClick={() => setOrderedConfirm(p)} className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all">
                                    <Truck size={14} /> Pedido Feito
                                  </button>
                                )}
                                {p.status === 'ORDERED' && canFinancialEdit && (
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
                {filteredCompleted.length > 0 && (
                  <div>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-1 flex items-center gap-2">
                      <Check size={14} /> Finalizadas ({filteredCompleted.length})
                    </h2>
                    <div className="space-y-3">
                      {paginatedCompleted.map(p => {
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
                      <Pagination
                        currentPage={completedPage}
                        totalPages={completedTotalPages}
                        onPageChange={setCompletedPage}
                        totalItems={filteredCompleted.length}
                        label="Finalizadas"
                      />
                    </div>
                  </div>
                )}
                {filteredCompleted.length === 0 && histSearch && (
                  <p className="text-center py-8 text-[10px] font-bold uppercase tracking-widest text-slate-400">Nenhum resultado encontrado</p>
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
      {/* Ordered Confirm */}
      <ConfirmModal
        isOpen={!!orderedConfirm}
        title="Confirmar pedido"
        message={orderedConfirm ? `Marcar compra de ${financial.formatQuantity(orderedConfirm.quantity)} ${orderedConfirm.globalStockItem?.unit ?? 'un'} de "${orderedConfirm.itemName}" como pedido realizado?` : ''}
        confirmLabel="Pedido Feito"
        cancelLabel="Voltar"
        variant="warning"
        onConfirm={() => { if (orderedConfirm) { handleMarkOrdered(orderedConfirm.id); setOrderedConfirm(null); } }}
        onCancel={() => setOrderedConfirm(null)}
      />

      {/* Approve Confirm */}
      <ConfirmModal
        isOpen={!!approveConfirm}
        title="Aprovar requisição"
        message={approveConfirm ? `Aprovar requisição de ${financial.formatQuantity(approveConfirm.quantity)} ${approveConfirm.globalStockItem?.unit ?? 'un'} de "${approveConfirm.itemName}"? O material ficará autorizado para envio.` : ''}
        confirmLabel="Aprovar"
        cancelLabel="Voltar"
        variant="success"
        onConfirm={() => { if (approveConfirm) { handleApproveRequest(approveConfirm.id); setApproveConfirm(null); } }}
        onCancel={() => setApproveConfirm(null)}
      />

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

      {/* Purchase from Request Modal */}
      {purchaseFromReq && (
        <PurchaseFromRequestModal
          request={purchaseFromReq}
          onSave={handleRequestPurchase}
          onClose={() => setPurchaseFromReq(null)}
        />
      )}

      {/* Deliver Modal */}
      {deliverModal && (
        <DeliverModal
          request={deliverModal}
          onSave={handleDeliver}
          onClose={() => setDeliverModal(null)}
        />
      )}

      {/* Notifications Drawer */}
      {showDrawer && (
        <>
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[140]" onClick={() => setShowDrawer(false)} />
          <aside className="fixed top-0 right-0 h-screen w-full sm:w-[430px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 z-[150] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <header className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600">
                  <Bell size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-slate-100 truncate">Pendências</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {pendingStockRequests.length + awaitingDeliveryRequests.length + activePurchases.length} itens pendentes
                  </p>
                </div>
              </div>
              <button onClick={() => setShowDrawer(false)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all" title="Fechar">
                <X size={18} />
              </button>
            </header>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
              {/* Pending Stock Requests */}
              {canWarehouse && pendingStockRequests.length > 0 && (
                <section>
                  <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                    <ClipboardList size={14} /> Requisições de Material ({pendingStockRequests.length})
                  </h4>
                  <div className="space-y-2">
                    {pendingStockRequests.map(req => (
                      <button
                        key={req.id}
                        onClick={() => { setTab('requests'); setShowDrawer(false); }}
                        className="w-full text-left border border-slate-200 dark:border-slate-800 rounded-2xl p-4 border-l-4 border-l-amber-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{req.itemName}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {financial.formatQuantity(req.quantity)} {req.globalStockItem?.unit || 'un'}
                              {req.project?.name ? ` — ${req.project.name}` : ''}
                            </p>
                          </div>
                          <span className="shrink-0 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest">Pendente</span>
                        </div>
                        {req.requestedBy && (
                          <div className="flex items-center gap-2 mt-2">
                            {req.requestedBy.profileImage ? (
                              <img src={req.requestedBy.profileImage} alt={req.requestedBy.name} className="w-4 h-4 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-[8px] font-black flex items-center justify-center"><User size={10} /></div>
                            )}
                            <span className="text-[10px] font-semibold text-slate-400 truncate">{req.requestedBy.name}</span>
                            {req.createdAt && <span className="text-[10px] text-slate-400 ml-auto whitespace-nowrap">{new Date(req.createdAt).toLocaleDateString('pt-BR')}</span>}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Awaiting Delivery */}
              {canWarehouse && awaitingDeliveryRequests.length > 0 && (
                <section>
                  <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                    <Truck size={14} /> Aguardando Envio ({awaitingDeliveryRequests.length})
                  </h4>
                  <div className="space-y-2">
                    {awaitingDeliveryRequests.map(req => {
                      const delivered = req.quantityDelivered ?? 0;
                      const pct = req.quantity > 0 ? Math.round((delivered / req.quantity) * 100) : 0;
                      return (
                        <button
                          key={req.id}
                          onClick={() => { setTab('requests'); setShowDrawer(false); }}
                          className="w-full text-left border border-slate-200 dark:border-slate-800 rounded-2xl p-4 border-l-4 border-l-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{req.itemName}</p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {financial.formatQuantity(req.quantity)} {req.globalStockItem?.unit || 'un'}
                                {req.project?.name ? ` — ${req.project.name}` : ''}
                              </p>
                            </div>
                            <span className="shrink-0 px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[9px] font-black uppercase tracking-widest">{pct}%</span>
                          </div>
                          <div className="mt-2 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Active Purchase Requests */}
              {activePurchases.length > 0 && (
                <section>
                  <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                    <ShoppingCart size={14} /> Solicitações de Compra ({activePurchases.length})
                  </h4>
                  <div className="space-y-2">
                    {activePurchases.map(pr => {
                      const isOrdered = pr.status === 'ORDERED';
                      return (
                        <button
                          key={pr.id}
                          onClick={() => { setTab('purchases'); setShowDrawer(false); }}
                          className={`w-full text-left border border-slate-200 dark:border-slate-800 rounded-2xl p-4 border-l-4 ${
                            isOrdered ? 'border-l-blue-400' : 'border-l-purple-400'
                          } hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{pr.itemName}</p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {financial.formatQuantity(pr.quantity)} {pr.globalStockItem?.unit || 'un'}
                              </p>
                            </div>
                            <span className={`shrink-0 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              isOrdered
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                            }`}>{isOrdered ? 'Pedido feito' : 'Pendente'}</span>
                          </div>
                          {pr.requestedBy && (
                            <div className="flex items-center gap-2 mt-2">
                              {pr.requestedBy.profileImage ? (
                                <img src={pr.requestedBy.profileImage} alt={pr.requestedBy.name} className="w-4 h-4 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-[8px] font-black flex items-center justify-center"><User size={10} /></div>
                              )}
                              <span className="text-[10px] font-semibold text-slate-400 truncate">{pr.requestedBy.name}</span>
                              {pr.createdAt && <span className="text-[10px] text-slate-400 ml-auto whitespace-nowrap">{new Date(pr.createdAt).toLocaleDateString('pt-BR')}</span>}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Empty state */}
              {pendingStockRequests.length === 0 && awaitingDeliveryRequests.length === 0 && activePurchases.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Bell size={32} className="mb-3 opacity-40" />
                  <p className="text-xs font-bold">Nenhuma pendência no momento</p>
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
};
