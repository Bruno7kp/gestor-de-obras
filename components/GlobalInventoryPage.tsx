import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package, Plus, Search, ArrowDownCircle, ArrowUpCircle, AlertTriangle,
  Truck, ShoppingCart, FileText, Edit2, Trash2, ChevronDown, ChevronRight,
  TrendingUp, XCircle, RefreshCw,
} from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { globalStockApi } from '../services/globalStockApi';
import { purchaseRequestApi } from '../services/purchaseRequestApi';
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="p-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold">{item ? 'Editar Item' : 'Novo Item'}</h3>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Nome *</label>
            <input className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Unidade</label>
              <input className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" value={unit} onChange={e => setUnit(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Qtd Mínima</label>
              <input type="number" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" value={minQuantity} onChange={e => setMinQuantity(e.target.value)} min={0} step="0.01" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Fornecedor</label>
            <select className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
              <option value="">Nenhum</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancelar</button>
          <button onClick={handleSave} disabled={!name.trim()} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Salvar</button>
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="p-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold">Registrar Entrada (NF)</h3>
          <p className="text-sm text-gray-500">{item.name}</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Quantidade *</label>
              <input type="number" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" value={quantity} onChange={e => setQuantity(e.target.value)} min={0.01} step="0.01" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Preço Unitário *</label>
              <input type="number" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} min={0.01} step="0.01" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Nº Nota Fiscal</label>
            <input className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Ex: NF-001234" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Fornecedor</label>
              <select className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                <option value="">Nenhum</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Data</label>
              <input type="date" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          {parseFloat(quantity) > 0 && parseFloat(unitPrice) > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg text-sm space-y-1">
              <div className="flex justify-between"><span>Estoque após entrada:</span><span className="font-medium">{previewQty} {item.unit}</span></div>
              <div className="flex justify-between"><span>Preço médio estimado:</span><span className="font-medium">R$ {previewAvg.toFixed(2)}</span></div>
            </div>
          )}
        </div>
        <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancelar</button>
          <button onClick={() => onSave({ quantity: parseFloat(quantity) || 0, unitPrice: parseFloat(unitPrice) || 0, invoiceNumber: invoiceNumber || undefined, supplierId: supplierId || undefined, date })} disabled={!parseFloat(quantity) || !parseFloat(unitPrice)} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            <ArrowDownCircle size={14} className="inline mr-1" /> Registrar Entrada
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
export const GlobalInventoryPage: React.FC<GlobalInventoryPageProps> = ({ suppliers }) => {
  const { canView, canEdit, getLevel } = usePermissions();
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

  const handleDeleteItem = async (item: GlobalStockItem) => {
    if (!confirm(`Remover "${item.name}" do estoque global?`)) return;
    try {
      await globalStockApi.remove(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success('Item removido');
    } catch (e: any) {
      toast.error(e.message);
    }
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

  const handleRequestPurchase = async (item: GlobalStockItem) => {
    const qtyStr = prompt(`Solicitar compra de "${item.name}".\nQuantidade:`);
    if (!qtyStr) return;
    const qty = parseFloat(qtyStr);
    if (!qty || qty <= 0) { toast.error('Quantidade inválida'); return; }
    try {
      await purchaseRequestApi.create({
        globalStockItemId: item.id,
        quantity: qty,
      });
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

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      NORMAL: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', label: 'Normal' },
      CRITICAL: { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-300', label: 'Crítico' },
      OUT_OF_STOCK: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', label: 'Sem estoque' },
    };
    const s = map[status] ?? map.NORMAL;
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  const showPrices = mode === 'financeiro' && canFinancial;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b dark:border-gray-700 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Package className="text-blue-600" size={22} />
          <h2 className="text-lg font-bold">Estoque Global</h2>
        </div>

        {/* Mode toggle - only show if user has both permissions */}
        {canWarehouse && canFinancial && (
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            <button onClick={() => setMode('almoxarifado')} className={`px-3 py-1.5 text-xs rounded-md transition-colors ${mode === 'almoxarifado' ? 'bg-white dark:bg-gray-600 shadow font-medium' : 'text-gray-500'}`}>
              Almoxarifado
            </button>
            <button onClick={() => setMode('financeiro')} className={`px-3 py-1.5 text-xs rounded-md transition-colors ${mode === 'financeiro' ? 'bg-white dark:bg-gray-600 shadow font-medium' : 'text-gray-500'}`}>
              Financeiro
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button onClick={loadItems} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title="Atualizar">
            <RefreshCw size={16} />
          </button>
          {canWarehouseEdit && (
            <button onClick={() => setItemModal({ open: true })} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus size={14} /> Novo Item
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{kpis.totalItems}</div>
          <div className="text-xs text-blue-600/70">Itens cadastrados</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/30 p-3 rounded-lg">
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{kpis.critical}</div>
          <div className="text-xs text-amber-600/70">Itens críticos</div>
        </div>
        {showPrices && (
          <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg">
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">R$ {kpis.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div className="text-xs text-green-600/70">Valor total do estoque</div>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="px-4 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="Buscar material..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            {search ? 'Nenhum item encontrado' : 'Nenhum item cadastrado'}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => (
              <div key={item.id} className="border dark:border-gray-700 rounded-lg overflow-hidden">
                {/* Item row */}
                <div className="p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => toggleExpand(item.id)}>
                  <div className="text-gray-400">
                    {expandedId === item.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{item.name}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span>{item.currentQuantity} {item.unit}</span>
                      <span>·</span>
                      <span>Mín: {item.minQuantity}</span>
                      {item.supplier && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1"><Truck size={10} /> {item.supplier.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {statusBadge(item.status)}
                  {showPrices ? (
                    <div className="text-right text-sm">
                      <div className="font-medium">R$ {item.averagePrice.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">
                        {item.lastPrice != null ? `Última: R$ ${item.lastPrice.toFixed(2)}` : ''}
                      </div>
                    </div>
                  ) : (
                    <div className="text-right text-sm text-gray-400">••••••</div>
                  )}
                  {/* Actions */}
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {canWarehouseEdit && (
                      <>
                        <button onClick={() => setEntryModal({ open: true, item })} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded" title="Registrar Entrada (NF)">
                          <ArrowDownCircle size={16} />
                        </button>
                        <button onClick={() => handleRequestPurchase(item)} className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded" title="Solicitar Compra">
                          <ShoppingCart size={16} />
                        </button>
                        <button onClick={() => setItemModal({ open: true, item })} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded" title="Editar">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteItem(item)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded" title="Remover">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded: movement history */}
                {expandedId === item.id && (
                  <div className="border-t dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 p-3">
                    <h4 className="text-xs font-medium mb-2 text-gray-500 uppercase">Últimas movimentações</h4>
                    {(!movements[item.id] || movements[item.id].length === 0) ? (
                      <div className="text-xs text-gray-400 py-2">Nenhuma movimentação registrada</div>
                    ) : (
                      <div className="space-y-1.5">
                        {movements[item.id].map(m => (
                          <div key={m.id} className="flex items-center gap-2 text-xs">
                            {m.type === 'entry' ? (
                              <ArrowDownCircle size={12} className="text-green-500 flex-shrink-0" />
                            ) : (
                              <ArrowUpCircle size={12} className="text-red-500 flex-shrink-0" />
                            )}
                            <span className="font-medium">{m.quantity} {item.unit}</span>
                            <span className="text-gray-400">→</span>
                            <span className="text-gray-500 truncate">{m.originDestination}</span>
                            {showPrices && m.unitPrice != null && (
                              <span className="text-gray-400">R$ {m.unitPrice.toFixed(2)}/{item.unit}</span>
                            )}
                            {m.invoiceNumber && (
                              <span className="flex items-center gap-0.5 text-gray-400"><FileText size={10} /> {m.invoiceNumber}</span>
                            )}
                            <span className="text-gray-400 ml-auto">{new Date(m.date).toLocaleDateString('pt-BR')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Price history (financial only) */}
                    {showPrices && item.priceHistory && item.priceHistory.length > 0 && (
                      <div className="mt-3 pt-2 border-t dark:border-gray-700">
                        <h4 className="text-xs font-medium mb-1.5 text-gray-500 uppercase flex items-center gap-1">
                          <TrendingUp size={10} /> Histórico de preços
                        </h4>
                        <div className="space-y-1">
                          {item.priceHistory.map((p: PriceHistoryEntry) => (
                            <div key={p.id} className="flex items-center gap-2 text-xs">
                              <span className="font-medium">R$ {p.price.toFixed(2)}</span>
                              {p.supplier && <span className="text-gray-400">{p.supplier.name}</span>}
                              <span className="text-gray-400 ml-auto">{new Date(p.date).toLocaleDateString('pt-BR')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
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
    </div>
  );
};
