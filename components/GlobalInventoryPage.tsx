import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package, Plus, Search, ArrowDownCircle, ArrowUpCircle, AlertTriangle,
  Truck, ShoppingCart, FileText, Edit2, Trash2, ChevronDown, ChevronRight,
  TrendingUp, RefreshCw, Boxes, DollarSign,
} from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { globalStockApi } from '../services/globalStockApi';
import { purchaseRequestApi } from '../services/purchaseRequestApi';
import { financial } from '../utils/math';
import { ConfirmModal } from './ConfirmModal';
import type { GlobalStockItem, GlobalStockMovement, Supplier, PriceHistoryEntry } from '../types';

interface GlobalInventoryPageProps {
  suppliers: Supplier[];
}

type InventoryMode = 'almoxarifado' | 'financeiro';

/* ------------------------------------------------------------------ */
/*  Global Stock Item Modal                                            */
/* ------------------------------------------------------------------ */
const GlobalStockItemModal: React.FC<{
  item?: GlobalStockItem | null;
  suppliers: Supplier[];
  onSave: (data: { name: string; unit: string; minQuantity: number; supplierId?: string }) => void;
  onClose: () => void;
}> = ({ item, suppliers, onSave, onClose }) => {
  const [name, setName] = useState(item?.name ?? '');
  const [unit, setUnit] = useState(item?.unit ?? 'un');
  const [minQuantity, setMinQuantity] = useState(String(item?.minQuantity ?? 0));
  const [supplierId, setSupplierId] = useState(item?.supplierId ?? '');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      unit: unit.trim() || 'un',
      minQuantity: parseFloat(minQuantity) || 0,
      supplierId: supplierId || undefined,
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
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Qtd Mínima</label>
              <input type="number" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold" value={minQuantity} onChange={e => setMinQuantity(e.target.value)} min={0} step="0.01" />
            </div>
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
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierId, setSupplierId] = useState(item.supplierId ?? '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const previewQty = (parseFloat(quantity) || 0) + item.currentQuantity;
  const newPrice = parseFloat(unitPrice) || 0;
  const previewAvg = previewQty > 0
    ? (item.currentQuantity * item.averagePrice + (parseFloat(quantity) || 0) * newPrice) / previewQty
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
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Quantidade *</label>
              <input type="number" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold" value={quantity} onChange={e => setQuantity(e.target.value)} min={0.01} step="0.01" autoFocus />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Preço Unit. *</label>
              <input type="number" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} min={0.01} step="0.01" />
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
          {parseFloat(quantity) > 0 && parseFloat(unitPrice) > 0 && (
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
            onClick={() => onSave({ quantity: parseFloat(quantity) || 0, unitPrice: parseFloat(unitPrice) || 0, invoiceNumber: invoiceNumber || undefined, supplierId: supplierId || undefined, date })}
            disabled={!parseFloat(quantity) || !parseFloat(unitPrice)}
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

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Solicitar Compra</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{item.name}</p>
        </div>
        <div className="px-8 py-6 space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Quantidade *</label>
            <input type="number" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-bold" value={quantity} onChange={e => setQuantity(e.target.value)} min={0.01} step="0.01" autoFocus />
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Estoque atual</p>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{financial.formatQuantity(item.currentQuantity)} {item.unit}</p>
          </div>
        </div>
        <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-[10px] font-black uppercase tracking-widest transition-all">Cancelar</button>
          <button
            onClick={() => { const qty = parseFloat(quantity); if (qty > 0) onSave(qty); }}
            disabled={!parseFloat(quantity) || parseFloat(quantity) <= 0}
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
/*  KPI Card                                                           */
/* ------------------------------------------------------------------ */
const KpiCard = ({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) => {
  const colors: Record<string, string> = {
    indigo: 'text-indigo-600 dark:text-indigo-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    blue: 'text-blue-600 dark:text-blue-400',
  };
  return (
    <div className="p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-32">
      <div className="flex justify-between items-start">
        <div className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-lg">{icon}</div>
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      </div>
      <p className={`text-xl font-black tracking-tighter ${colors[color] ?? colors.indigo}`}>{value}</p>
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

  const [mode, setMode] = useState<InventoryMode>(
    canFinancial && !canWarehouse ? 'financeiro' : 'almoxarifado',
  );
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
  const handleSaveItem = async (data: { name: string; unit: string; minQuantity: number; supplierId?: string }) => {
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

        {/* KPI GRID */}
        <div className={`grid grid-cols-1 ${showPrices ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-6`}>
          <KpiCard label="Itens Cadastrados" value={kpis.totalItems} icon={<Boxes size={20} />} color="indigo" />
          <KpiCard label="Itens Críticos" value={kpis.critical} icon={<AlertTriangle size={20} />} color="amber" />
          {showPrices && (
            <KpiCard label="Valor em Estoque" value={`R$ ${kpis.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={<DollarSign size={20} />} color="emerald" />
          )}
        </div>

        {/* SEARCH BAR */}
        <div className="flex items-center bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              placeholder="Buscar material por nome..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={loadItems} className="ml-3 p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all" title="Atualizar">
            <RefreshCw size={16} />
          </button>
        </div>

        {/* ITEM LIST */}
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
          <div className="space-y-4">
            {filtered.map(item => {
              const s = statusConfig[item.status] ?? statusConfig.NORMAL;
              const isExpanded = expandedId === item.id;
              return (
                <div key={item.id} className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all overflow-hidden">
                  {/* Item row */}
                  <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer" onClick={() => toggleExpand(item.id)}>
                    <div className="flex items-center gap-5">
                      <div className={`p-4 rounded-2xl shrink-0 ${s.bg}`}>
                        <Package size={24} className={s.text} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-base font-black dark:text-white uppercase tracking-tight">{item.name}</h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${s.bg} ${s.text}`}>{s.label}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                          {financial.formatQuantity(item.currentQuantity)} {item.unit}
                          <span className="mx-1.5">•</span>
                          Mín: {item.minQuantity}
                          {item.supplier && (
                            <>
                              <span className="mx-1.5">•</span>
                              <Truck size={10} className="inline" /> {item.supplier.name}
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {showPrices ? (
                        <div className="text-right">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Preço Médio</span>
                          <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">R$ {item.averagePrice.toFixed(2)}</p>
                          {item.lastPrice != null && (
                            <p className="text-[9px] text-slate-400 font-bold">Última: R$ {item.lastPrice.toFixed(2)}</p>
                          )}
                        </div>
                      ) : (
                        <div className="text-right text-sm text-slate-300 font-black tracking-widest">••••••</div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        {canWarehouseEdit && (
                          <>
                            <button onClick={() => setEntryModal({ open: true, item })} className="p-3 bg-slate-50 dark:bg-slate-800 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all" title="Registrar Entrada (NF)">
                              <ArrowDownCircle size={18} />
                            </button>
                            <button onClick={() => setPurchaseModal({ open: true, item })} className="p-3 bg-slate-50 dark:bg-slate-800 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-xl transition-all" title="Solicitar Compra">
                              <ShoppingCart size={18} />
                            </button>
                            <button onClick={() => setItemModal({ open: true, item })} className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all" title="Editar">
                              <Edit2 size={18} />
                            </button>
                            <button onClick={() => setDeleteConfirm(item)} className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all" title="Remover">
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                        <div className="text-slate-300 ml-1">
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mx-6 lg:mx-8 mb-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 animate-in slide-in-from-top-2 duration-200">
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
        )}
      </div>

      {/* Modals */}
      {itemModal.open && (
        <GlobalStockItemModal
          item={itemModal.item}
          suppliers={suppliers}
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
      <ConfirmModal
        isOpen={!!deleteConfirm}
        title="Excluir item do estoque"
        message={deleteConfirm ? `Deseja realmente excluir "${deleteConfirm.name}" e todo seu histórico? Esta ação não pode ser desfeita.` : ''}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDeleteItem}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
};
