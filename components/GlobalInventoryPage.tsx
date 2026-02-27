import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package, Plus, Search, ArrowDownCircle, ArrowUpCircle, AlertTriangle,
  ShoppingCart, FileText, Edit2, Trash2, ChevronDown, ChevronRight, ChevronLeft,
  TrendingUp, RefreshCw, Boxes, DollarSign,
} from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { globalStockApi } from '../services/globalStockApi';
import { purchaseRequestApi } from '../services/purchaseRequestApi';
import { financial } from '../utils/math';
import type { GlobalStockItem, GlobalStockMovement, Supplier, PriceHistoryEntry } from '../types';

interface GlobalInventoryPageProps {
  suppliers: Supplier[];
}

type InventoryMode = 'almoxarifado' | 'financeiro';

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
/*  Global Stock Item Modal                                            */
/* ------------------------------------------------------------------ */
const GlobalStockItemModal: React.FC<{
  item?: GlobalStockItem | null;
  onSave: (data: { name: string; unit: string; minQuantity: number }) => void;
  onClose: () => void;
}> = ({ item, onSave, onClose }) => {
  const [name, setName] = useState(item?.name ?? '');
  const [unit, setUnit] = useState(item?.unit ?? 'un');
  const [minQtyDecimals, setMinQtyDecimals] = useState(MIN_DECIMALS);
  const [minQuantity, setMinQuantity] = useState(() => financial.maskDecimal(String(Math.round((item?.minQuantity ?? 0) * 100)), MIN_DECIMALS));

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      unit: unit.trim() || 'un',
      minQuantity: financial.parseLocaleNumber(minQuantity),
    });
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">{item ? 'Editar Item' : 'Novo Item'}</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Estoque Global</p>
        </div>
        <div className="px-8 py-6 space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Nome *</label>
            <input className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Unidade</label>
              <input className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold" value={unit} onChange={e => setUnit(e.target.value)} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Qtd Mínima</label>
                <DecimalControls value={minQtyDecimals} onChange={d => { setMinQtyDecimals(d); setMinQuantity(financial.maskDecimal(minQuantity.replace(/\D/g, ''), d)); }} />
              </div>
              <input type="text" inputMode="decimal" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold" value={minQuantity} onChange={e => setMinQuantity(financial.maskDecimal(e.target.value, minQtyDecimals))} />
            </div>
          </div>
        </div>
        <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-[10px] font-black uppercase tracking-widest transition-all">Cancelar</button>
          <button onClick={handleSave} disabled={!name.trim()} className="px-8 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100">Salvar</button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Entry Modal (NF-based)                                             */
/* ------------------------------------------------------------------ */
const EntryModal: React.FC<{
  item: GlobalStockItem;
  suppliers: Supplier[];
  onSave: (data: { quantity: number; unitPrice: number; invoiceNumber?: string; supplierId?: string; date?: string }) => void;
  onClose: () => void;
}> = ({ item, suppliers, onSave, onClose }) => {
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [qtyDecimals, setQtyDecimals] = useState(MIN_DECIMALS);
  const [priceDecimals, setPriceDecimals] = useState(MIN_DECIMALS);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierId, setSupplierId] = useState(item.supplierId ?? '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const parsedQty = financial.parseLocaleNumber(quantity);
  const parsedPrice = financial.parseLocaleNumber(unitPrice);
  const previewQty = parsedQty + item.currentQuantity;
  const previewAvg = previewQty > 0
    ? (item.currentQuantity * item.averagePrice + parsedQty * parsedPrice) / previewQty
    : item.averagePrice;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Registrar Entrada (NF)</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{item.name}</p>
        </div>
        <div className="px-8 py-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quantidade *</label>
                <DecimalControls value={qtyDecimals} onChange={d => { setQtyDecimals(d); setQuantity(prev => prev ? financial.maskDecimal(prev.replace(/\D/g, ''), d) : prev); }} />
              </div>
              <input type="text" inputMode="decimal" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold" value={quantity} onChange={e => setQuantity(financial.maskDecimal(e.target.value, qtyDecimals))} autoFocus />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Preço Unit. *</label>
                <DecimalControls value={priceDecimals} onChange={d => { setPriceDecimals(d); setUnitPrice(prev => prev ? financial.maskDecimal(prev.replace(/\D/g, ''), d) : prev); }} />
              </div>
              <input type="text" inputMode="decimal" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold" value={unitPrice} onChange={e => setUnitPrice(financial.maskDecimal(e.target.value, priceDecimals))} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Nº Nota Fiscal</label>
            <input className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Ex: NF-001234" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Fornecedor</label>
              <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                <option value="">Nenhum</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Data</label>
              <input type="date" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          {parsedQty > 0 && parsedPrice > 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800">
              <div className="flex justify-between text-sm">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Estoque após entrada</span>
                <span className="font-black text-emerald-700 dark:text-emerald-300">{financial.formatQuantity(previewQty)} {item.unit}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Preço médio estimado</span>
                <span className="font-black text-emerald-700 dark:text-emerald-300">R$ {previewAvg.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
        <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-[10px] font-black uppercase tracking-widest transition-all">Cancelar</button>
          <button
            onClick={() => onSave({ quantity: parsedQty, unitPrice: parsedPrice, invoiceNumber: invoiceNumber || undefined, supplierId: supplierId || undefined, date })}
            disabled={!parsedQty || !parsedPrice}
            className="flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            <ArrowDownCircle size={16} /> Registrar Entrada
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Purchase Request Modal                                             */
/* ------------------------------------------------------------------ */
const PurchaseRequestModal: React.FC<{
  item: GlobalStockItem;
  onSave: (quantity: number) => void;
  onClose: () => void;
}> = ({ item, onSave, onClose }) => {
  const [quantity, setQuantity] = useState('');
  const [qtyDecimals, setQtyDecimals] = useState(MIN_DECIMALS);
  const parsedQty = financial.parseLocaleNumber(quantity);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Solicitar Compra</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{item.name}</p>
        </div>
        <div className="px-8 py-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quantidade *</label>
              <DecimalControls value={qtyDecimals} onChange={d => { setQtyDecimals(d); setQuantity(prev => prev ? financial.maskDecimal(prev.replace(/\D/g, ''), d) : prev); }} />
            </div>
            <input type="text" inputMode="decimal" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold" value={quantity} onChange={e => setQuantity(financial.maskDecimal(e.target.value, qtyDecimals))} autoFocus />
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Estoque atual</p>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{financial.formatQuantity(item.currentQuantity)} {item.unit}</p>
          </div>
        </div>
        <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-[10px] font-black uppercase tracking-widest transition-all">Cancelar</button>
          <button
            onClick={() => { if (parsedQty > 0) onSave(parsedQty); }}
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
/*  Delete Item Modal (type name to confirm)                           */
/* ------------------------------------------------------------------ */
const DeleteItemModal: React.FC<{
  item: GlobalStockItem;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ item, onConfirm, onClose }) => {
  const [typed, setTyped] = useState('');
  const matches = typed.trim().toLowerCase() === item.name.trim().toLowerCase();

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-start gap-4">
          <div className="p-3 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-2xl shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Excluir item do estoque</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Ação irreversível</p>
          </div>
        </div>
        <div className="px-8 py-6 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Deseja realmente excluir <strong className="text-rose-600 dark:text-rose-400">{item.name}</strong> e todo seu histórico de movimentações? Esta ação não pode ser desfeita.
          </p>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Digite <span className="text-rose-600 dark:text-rose-400">{item.name}</span> para confirmar
            </label>
            <input
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-rose-500 rounded-xl outline-none transition-all text-sm font-bold"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={item.name}
              autoFocus
            />
          </div>
        </div>
        <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-[10px] font-black uppercase tracking-widest transition-all">Cancelar</button>
          <button
            onClick={onConfirm}
            disabled={!matches}
            className="flex items-center gap-2 px-8 py-3 bg-rose-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-rose-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            <Trash2 size={16} /> Excluir
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
  const iconColors: Record<string, string> = {
    indigo: 'text-indigo-500',
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    blue: 'text-blue-500',
  };
  const ic = iconColors[color] ?? iconColors.indigo;
  return (
    <div className="flex-1 min-w-[140px] flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className={ic}>{icon}</div>
      <div className="leading-tight">
        <p className="text-sm font-black text-slate-800 dark:text-white">{value}</p>
        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
export const GlobalInventoryPage: React.FC<GlobalInventoryPageProps> = ({ suppliers }) => {
  const { canView, canEdit } = usePermissions();
  const toast = useToast();

  const canWarehouse = canView('global_stock_warehouse');
  const canWarehouseEdit = canEdit('global_stock_warehouse');
  const canFinancial = canView('global_stock_financial');
  const canFinancialEdit = canEdit('global_stock_financial');

  const [mode, setMode] = useState<InventoryMode>(
    canFinancial && !canWarehouse ? 'financeiro' : 'almoxarifado',
  );

  // Sync mode when permissions load asynchronously
  useEffect(() => {
    if (canFinancial && !canWarehouse) setMode('financeiro');
    else if (canWarehouse && !canFinancial) setMode('almoxarifado');
  }, [canFinancial, canWarehouse]);

  const [items, setItems] = useState<GlobalStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [movements, setMovements] = useState<Record<string, GlobalStockMovement[]>>({});

  // Modals
  const [itemModal, setItemModal] = useState<{ open: boolean; item?: GlobalStockItem | null }>({ open: false });
  const [entryModal, setEntryModal] = useState<{ open: boolean; item?: GlobalStockItem | null }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<GlobalStockItem | null>(null);
  const [purchaseModal, setPurchaseModal] = useState<{ open: boolean; item?: GlobalStockItem }>({ open: false });

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await globalStockApi.list();
      setItems(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(q));
  }, [items, search]);

  const kpis = useMemo(() => {
    const totalItems = items.length;
    const critical = items.filter(i => i.status === 'CRITICAL' || i.status === 'OUT_OF_STOCK').length;
    const totalValue = items.reduce((s, i) => s + i.currentQuantity * i.averagePrice, 0);
    return { totalItems, critical, totalValue };
  }, [items]);

  // -- Handlers --
  const handleSaveItem = async (data: { name: string; unit: string; minQuantity: number }) => {
    try {
      if (itemModal.item) {
        const updated = await globalStockApi.update(itemModal.item.id, data);
        setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
        toast.success('Item atualizado');
      } else {
        const created = await globalStockApi.create(data);
        setItems(prev => [created, ...prev]);
        toast.success('Item criado');
      }
      setItemModal({ open: false });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteConfirm) return;
    try {
      await globalStockApi.remove(deleteConfirm.id);
      setItems(prev => prev.filter(i => i.id !== deleteConfirm.id));
      toast.success('Item removido');
    } catch (e: any) {
      toast.error(e.message);
    }
    setDeleteConfirm(null);
  };

  const handleEntry = async (data: { quantity: number; unitPrice: number; invoiceNumber?: string; supplierId?: string; date?: string }) => {
    if (!entryModal.item) return;
    try {
      const updated = await globalStockApi.addMovement(entryModal.item.id, {
        type: 'ENTRY',
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        invoiceNumber: data.invoiceNumber,
        supplierId: data.supplierId,
        date: data.date,
        originDestination: 'Entrada NF',
      });
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
      setEntryModal({ open: false });
      toast.success('Entrada registrada');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRequestPurchase = async (qty: number) => {
    if (!purchaseModal.item) return;
    try {
      await purchaseRequestApi.create({ globalStockItemId: purchaseModal.item.id, quantity: qty });
      setPurchaseModal({ open: false });
      toast.success('Solicitação de compra criada');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!movements[id]) {
      try {
        const data = await globalStockApi.listItemMovements(id, 0, 10);
        setMovements(prev => ({ ...prev, [id]: data.movements }));
      } catch {}
    }
  };

  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    NORMAL: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Normal' },
    CRITICAL: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Crítico' },
    OUT_OF_STOCK: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-400', label: 'Sem estoque' },
  };

  const showPrices = mode === 'financeiro' && canFinancial;

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-12 animate-in fade-in duration-500 bg-slate-50 dark:bg-slate-950 custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Estoque Global</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Controle de materiais centralizado por instância.</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Mode toggle */}
            {canWarehouse && canFinancial && (
              <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <button onClick={() => setMode('almoxarifado')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'almoxarifado' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                  Almoxarifado
                </button>
                <button onClick={() => setMode('financeiro')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'financeiro' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                  Financeiro
                </button>
              </div>
            )}
            {canWarehouseEdit && (
              <button onClick={() => setItemModal({ open: true })} className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-xl shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all">
                <Plus size={18} /> Novo Item
              </button>
            )}
          </div>
        </div>

        {/* KPIs + SEARCH */}
        <div className="flex flex-wrap items-stretch gap-3">
          <KpiCard label="Itens Cadastrados" value={kpis.totalItems} icon={<Boxes size={16} />} color="indigo" />
          <KpiCard label="Itens Críticos" value={kpis.critical} icon={<AlertTriangle size={16} />} color="amber" />
          {showPrices && (
            <KpiCard label="Valor em Estoque" value={`R$ ${kpis.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={<DollarSign size={16} />} color="emerald" />
          )}
          <div className="flex-1 min-w-[200px] flex items-center bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                placeholder="Buscar material..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button onClick={loadItems} className="ml-2 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all" title="Atualizar">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* ITEM TABLE */}
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw size={24} className="animate-spin text-slate-400 mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center opacity-30 select-none">
            <Package size={64} className="mx-auto mb-4" />
            <p className="text-sm font-black uppercase tracking-widest">{search ? 'Nenhum item encontrado' : 'Nenhum item cadastrado'}</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className={`hidden lg:grid ${showPrices ? 'grid-cols-[1fr_80px_110px_100px_120px_160px]' : 'grid-cols-[1fr_80px_110px_100px_160px]'} gap-4 px-8 py-4 bg-slate-50/50 dark:bg-slate-800/50 items-center`}>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Material</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Unidade</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Disponível</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</span>
              {showPrices && <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Preço Médio</span>}
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ações</span>
            </div>

            {/* Table rows */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(item => {
                const s = statusConfig[item.status] ?? statusConfig.NORMAL;
                const isExpanded = expandedId === item.id;
                return (
                  <div key={item.id}>
                    <div
                      className={`grid grid-cols-1 ${showPrices ? 'lg:grid-cols-[1fr_80px_110px_100px_120px_160px]' : 'lg:grid-cols-[1fr_80px_110px_100px_160px]'} gap-2 lg:gap-4 px-6 lg:px-8 py-4 items-center hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer`}
                      onClick={() => toggleExpand(item.id)}
                    >
                      {/* Material name */}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{item.name}</p>
                        <span className="text-[9px] text-slate-400 font-medium mt-0.5 block">Mín: {item.minQuantity}</span>
                      </div>

                      {/* Unit */}
                      <div className="text-center">
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-black uppercase tracking-widest text-slate-500">
                          {item.unit}
                        </span>
                      </div>

                      {/* Quantity */}
                      <div className="text-center">
                        <span className={`text-sm font-black ${
                          item.status === 'OUT_OF_STOCK' ? 'text-rose-500' :
                          item.status === 'CRITICAL' ? 'text-amber-500' :
                          'text-slate-700 dark:text-slate-200'
                        }`}>
                          {financial.formatQuantity(item.currentQuantity)}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="flex justify-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${s.bg} ${s.text}`}>{s.label}</span>
                      </div>

                      {/* Price (financial mode) */}
                      {showPrices && (
                        <div className="text-center">
                          <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">R$ {item.averagePrice.toFixed(2)}</p>
                          {item.lastPrice != null && (
                            <p className="text-[9px] text-slate-400 font-bold">Últ: R$ {item.lastPrice.toFixed(2)}</p>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                        {canFinancialEdit && (
                          <button onClick={() => setEntryModal({ open: true, item })} className="p-2 bg-slate-50 dark:bg-slate-800 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all" title="Registrar Entrada (NF)">
                            <ArrowDownCircle size={15} />
                          </button>
                        )}
                        {canWarehouseEdit && (
                          <>
                            <button onClick={() => setPurchaseModal({ open: true, item })} className="p-2 bg-slate-50 dark:bg-slate-800 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-all" title="Solicitar Compra">
                              <ShoppingCart size={15} />
                            </button>
                            <button onClick={() => setItemModal({ open: true, item })} className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all" title="Editar">
                              <Edit2 size={15} />
                            </button>
                            <button onClick={() => setDeleteConfirm(item)} className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all" title="Remover">
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                        <div className="text-slate-300 ml-0.5">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="mx-6 lg:mx-8 mb-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 animate-in slide-in-from-top-2 duration-200">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-1">Últimas Movimentações</h4>
                        {(!movements[item.id] || movements[item.id].length === 0) ? (
                          <p className="text-center py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Nenhuma movimentação registrada</p>
                        ) : (
                          <div className="space-y-2">
                            {movements[item.id].map(m => (
                              <div key={m.id} className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                <div className="flex items-center gap-3">
                                  <div className={`p-1.5 rounded-lg ${m.type === 'entry' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600'}`}>
                                    {m.type === 'entry' ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                      {m.type === 'entry' ? 'Entrada' : 'Saída'} de {financial.formatQuantity(m.quantity)} {item.unit}
                                    </p>
                                    <p className="text-[9px] text-slate-400 font-medium flex items-center gap-2 flex-wrap">
                                      {m.originDestination}
                                      {showPrices && m.unitPrice != null && <span>• R$ {m.unitPrice.toFixed(2)}/{item.unit}</span>}
                                      {m.invoiceNumber && <span className="flex items-center gap-0.5"><FileText size={9} /> {m.invoiceNumber}</span>}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[9px] text-slate-400 whitespace-nowrap">{new Date(m.date).toLocaleDateString('pt-BR')}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Price history (financial only) */}
                        {showPrices && item.priceHistory && item.priceHistory.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 px-1 flex items-center gap-1.5">
                              <TrendingUp size={12} /> Histórico de Preços
                            </h4>
                            <div className="space-y-2">
                              {item.priceHistory.map((p: PriceHistoryEntry) => (
                                <div key={p.id} className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                  <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600">
                                      <DollarSign size={14} />
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">R$ {p.price.toFixed(2)}</p>
                                      {p.supplier && <p className="text-[9px] text-slate-400 font-medium">{p.supplier.name}</p>}
                                    </div>
                                  </div>
                                  <span className="text-[9px] text-slate-400">{new Date(p.date).toLocaleDateString('pt-BR')}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {itemModal.open && (
        <GlobalStockItemModal
          item={itemModal.item}
          onSave={handleSaveItem}
          onClose={() => setItemModal({ open: false })}
        />
      )}
      {entryModal.open && entryModal.item && (
        <EntryModal
          item={entryModal.item}
          suppliers={suppliers}
          onSave={handleEntry}
          onClose={() => setEntryModal({ open: false })}
        />
      )}
      {purchaseModal.open && purchaseModal.item && (
        <PurchaseRequestModal
          item={purchaseModal.item}
          onSave={handleRequestPurchase}
          onClose={() => setPurchaseModal({ open: false })}
        />
      )}
      {deleteConfirm && (
        <DeleteItemModal
          item={deleteConfirm}
          onConfirm={handleDeleteItem}
          onClose={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
};
