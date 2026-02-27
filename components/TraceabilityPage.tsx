import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  GitBranch, ArrowDownCircle, ArrowUpCircle, FileText, CheckCircle,
  XCircle, Clock, ShoppingCart, Truck, Package, RefreshCw,
  ChevronRight, AlertTriangle, Filter,
} from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { globalStockApi } from '../services/globalStockApi';
import { purchaseRequestApi } from '../services/purchaseRequestApi';
import { stockRequestApi } from '../services/stockRequestApi';
import type {
  GlobalStockMovement,
  PurchaseRequest,
  StockRequest,
  Supplier,
} from '../types';

interface TraceabilityPageProps {
  suppliers: Supplier[];
}

type ActiveTab = 'requests' | 'purchases' | 'log';

/* ------------------------------------------------------------------ */
/*  Purchase Complete Modal                                            */
/* ------------------------------------------------------------------ */
const CompleteModal: React.FC<{
  request: PurchaseRequest;
  suppliers: Supplier[];
  onComplete: (data: { unitPrice: number; invoiceNumber?: string; supplierId?: string }) => void;
  onClose: () => void;
}> = ({ request, suppliers, onComplete, onClose }) => {
  const [unitPrice, setUnitPrice] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="p-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold">Confirmar Entrega</h3>
          <p className="text-sm text-gray-500">
            {request.quantity} {request.globalStockItem?.unit ?? 'un'} de "{request.itemName}"
          </p>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Preço Unitário *</label>
            <input type="number" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} min={0.01} step="0.01" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Nº Nota Fiscal</label>
            <input className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Fornecedor</label>
            <select className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
              <option value="">Selecionar...</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {parseFloat(unitPrice) > 0 && (
            <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg text-sm">
              <div className="flex justify-between">
                <span>Total da compra:</span>
                <span className="font-bold">R$ {(request.quantity * parseFloat(unitPrice)).toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancelar</button>
          <button onClick={() => onComplete({ unitPrice: parseFloat(unitPrice), invoiceNumber: invoiceNumber || undefined, supplierId: supplierId || undefined })} disabled={!parseFloat(unitPrice)} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            Confirmar Entrega
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

  const [tab, setTab] = useState<ActiveTab>('requests');
  const [stockRequests, setStockRequests] = useState<StockRequest[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [movements, setMovements] = useState<GlobalStockMovement[]>([]);
  const [movementsTotal, setMovementsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [logFilter, setLogFilter] = useState<'all' | 'physical' | 'financial'>('all');
  const [completeModal, setCompleteModal] = useState<PurchaseRequest | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [sr, pr, mv] = await Promise.all([
        canWarehouse ? stockRequestApi.list() : Promise.resolve([]),
        canWarehouse || canFinancial ? purchaseRequestApi.list() : Promise.resolve([]),
        canWarehouse || canFinancial ? globalStockApi.listMovements({ take: 50 }) : Promise.resolve({ movements: [], total: 0 }),
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

  // -- Stock request handlers (Camily) --
  const handleApproveRequest = async (req: StockRequest) => {
    try {
      const updated = await stockRequestApi.approve(req.id);
      setStockRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      toast.success(`Requisição de "${req.itemName}" aprovada`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRejectRequest = async (req: StockRequest) => {
    const reason = prompt('Motivo da rejeição (opcional):');
    try {
      const updated = await stockRequestApi.reject(req.id, reason || undefined);
      setStockRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      toast.success('Requisição rejeitada');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // -- Purchase request handlers (Giovana) --
  const handleMarkOrdered = async (req: PurchaseRequest) => {
    try {
      const updated = await purchaseRequestApi.markOrdered(req.id);
      setPurchaseRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      toast.success('Pedido marcado como realizado');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleComplete = async (data: { unitPrice: number; invoiceNumber?: string; supplierId?: string }) => {
    if (!completeModal) return;
    try {
      const updated = await purchaseRequestApi.complete(completeModal.id, data);
      setPurchaseRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      setCompleteModal(null);
      toast.success('Entrega confirmada e estoque atualizado');
      // Reload movements to show the new entry
      const mv = await globalStockApi.listMovements({ take: 50 });
      setMovements(mv.movements);
      setMovementsTotal(mv.total);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleCancelPurchase = async (req: PurchaseRequest) => {
    if (!confirm(`Cancelar solicitação de compra de "${req.itemName}"?`)) return;
    try {
      const updated = await purchaseRequestApi.cancel(req.id);
      setPurchaseRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      toast.success('Solicitação cancelada');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Filtered data
  const pendingStockRequests = stockRequests.filter(r => r.status === 'PENDING');
  const processedStockRequests = stockRequests.filter(r => r.status !== 'PENDING');

  const activePurchases = purchaseRequests.filter(r => r.status === 'PENDING' || r.status === 'ORDERED');
  const completedPurchases = purchaseRequests.filter(r => r.status === 'COMPLETED' || r.status === 'CANCELLED');

  const filteredMovements = useMemo(() => {
    if (logFilter === 'all') return movements;
    if (logFilter === 'financial') return movements.filter(m => !!m.invoiceNumber);
    return movements.filter(m => !m.invoiceNumber);
  }, [movements, logFilter]);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock size={14} className="text-amber-500" />;
      case 'ORDERED': return <ShoppingCart size={14} className="text-blue-500" />;
      case 'COMPLETED':
      case 'APPROVED': return <CheckCircle size={14} className="text-green-500" />;
      case 'CANCELLED':
      case 'REJECTED': return <XCircle size={14} className="text-red-500" />;
      default: return null;
    }
  };

  const statusLabel: Record<string, string> = {
    PENDING: 'Pendente',
    ORDERED: 'Pedido Feito',
    COMPLETED: 'Concluído',
    CANCELLED: 'Cancelado',
    APPROVED: 'Aprovado',
    REJECTED: 'Rejeitado',
  };

  const priorityBadge = (p: string) => {
    const map: Record<string, string> = {
      HIGH: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
      MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    };
    return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${map[p] ?? map.LOW}`}>{p === 'HIGH' ? 'Alta' : p === 'MEDIUM' ? 'Média' : 'Baixa'}</span>;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b dark:border-gray-700 flex items-center gap-3">
        <GitBranch className="text-purple-600" size={22} />
        <h2 className="text-lg font-bold flex-1">Rastreabilidade & Logística</h2>
        <button onClick={loadData} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title="Atualizar">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3 flex gap-1 border-b dark:border-gray-700">
        {canWarehouse && (
          <button onClick={() => setTab('requests')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'requests' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Requisições de Obras
            {pendingStockRequests.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                {pendingStockRequests.length}
              </span>
            )}
          </button>
        )}
        {(canWarehouse || canFinancial) && (
          <button onClick={() => setTab('purchases')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'purchases' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Pipeline de Compras
            {activePurchases.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {activePurchases.length}
              </span>
            )}
          </button>
        )}
        <button onClick={() => setTab('log')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'log' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Log de Eventos
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Carregando...</div>
        ) : (
          <>
            {/* == STOCK REQUESTS TAB == */}
            {tab === 'requests' && canWarehouse && (
              <div className="space-y-4">
                {/* Pending */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-500" />
                    Pendentes ({pendingStockRequests.length})
                  </h3>
                  {pendingStockRequests.length === 0 ? (
                    <div className="text-sm text-gray-400 py-3">Nenhuma requisição pendente</div>
                  ) : (
                    <div className="space-y-2">
                      {pendingStockRequests.map(req => (
                        <div key={req.id} className="flex items-center gap-3 p-3 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <Package size={16} className="text-amber-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{req.itemName}</div>
                            <div className="text-xs text-gray-500">
                              {req.quantity} {req.globalStockItem?.unit ?? 'un'} — Obra: {req.project?.name ?? '...'}
                              <span className="ml-2">Disponível: {req.globalStockItem?.currentQuantity ?? '?'}</span>
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              Por: {req.requestedBy?.name ?? '...'} · {new Date(req.date).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                          {canWarehouseEdit && (
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => handleApproveRequest(req)} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700" disabled={(req.globalStockItem?.currentQuantity ?? 0) < req.quantity}>
                                Aprovar
                              </button>
                              <button onClick={() => handleRejectRequest(req)} className="px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                                Rejeitar
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Processed */}
                {processedStockRequests.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">Processadas</h3>
                    <div className="space-y-1.5">
                      {processedStockRequests.slice(0, 20).map(req => (
                        <div key={req.id} className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-sm">
                          {statusIcon(req.status)}
                          <span className="font-medium">{req.itemName}</span>
                          <span className="text-gray-400">·</span>
                          <span className="text-gray-500">{req.quantity} {req.globalStockItem?.unit ?? 'un'}</span>
                          <span className="text-gray-400">·</span>
                          <span className="text-gray-500">{req.project?.name}</span>
                          <span className="ml-auto text-xs text-gray-400">{statusLabel[req.status]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* == PURCHASE PIPELINE TAB == */}
            {tab === 'purchases' && (
              <div className="space-y-4">
                {/* Active purchases */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Em andamento ({activePurchases.length})
                  </h3>
                  {activePurchases.length === 0 ? (
                    <div className="text-sm text-gray-400 py-3">Nenhuma compra em andamento</div>
                  ) : (
                    <div className="space-y-2">
                      {activePurchases.map(req => (
                        <div key={req.id} className="flex items-center gap-3 p-3 border dark:border-gray-700 rounded-lg">
                          {statusIcon(req.status)}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm flex items-center gap-2">
                              {req.itemName}
                              {priorityBadge(req.priority)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {req.quantity} {req.globalStockItem?.unit ?? 'un'}
                              <span className="ml-2">Solicitado por: {req.requestedBy?.name ?? '...'}</span>
                              <span className="ml-2">{new Date(req.date).toLocaleDateString('pt-BR')}</span>
                            </div>
                            {req.status === 'ORDERED' && req.orderedAt && (
                              <div className="text-xs text-blue-500 mt-0.5">
                                Pedido feito em {new Date(req.orderedAt).toLocaleDateString('pt-BR')}
                                {req.processedBy && ` por ${req.processedBy.name}`}
                              </div>
                            )}
                          </div>
                          {canFinancialEdit && (
                            <div className="flex items-center gap-1.5">
                              {req.status === 'PENDING' && (
                                <button onClick={() => handleMarkOrdered(req)} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                  Pedido Feito
                                </button>
                              )}
                              {req.status === 'ORDERED' && (
                                <button onClick={() => setCompleteModal(req)} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">
                                  Confirmar Entrega
                                </button>
                              )}
                              <button onClick={() => handleCancelPurchase(req)} className="px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                                Cancelar
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Completed */}
                {completedPurchases.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">Finalizadas</h3>
                    <div className="space-y-1.5">
                      {completedPurchases.slice(0, 20).map(req => (
                        <div key={req.id} className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-sm">
                          {statusIcon(req.status)}
                          <span className="font-medium">{req.itemName}</span>
                          <span className="text-gray-400">·</span>
                          <span className="text-gray-500">{req.quantity} {req.globalStockItem?.unit ?? 'un'}</span>
                          {req.unitPrice != null && (
                            <>
                              <span className="text-gray-400">·</span>
                              <span className="text-gray-500">R$ {req.unitPrice.toFixed(2)}/un</span>
                            </>
                          )}
                          {req.invoiceNumber && (
                            <span className="flex items-center gap-0.5 text-gray-400 text-xs"><FileText size={10} /> {req.invoiceNumber}</span>
                          )}
                          <span className="ml-auto text-xs text-gray-400">{statusLabel[req.status]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* == EVENT LOG TAB == */}
            {tab === 'log' && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Filter size={14} className="text-gray-400" />
                  <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                    {(['all', 'physical', 'financial'] as const).map(f => (
                      <button key={f} onClick={() => setLogFilter(f)} className={`px-3 py-1 text-xs rounded-md transition-colors ${logFilter === f ? 'bg-white dark:bg-gray-600 shadow font-medium' : 'text-gray-500'}`}>
                        {f === 'all' ? 'Todos' : f === 'physical' ? 'Físico' : 'Financeiro (NF)'}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400 ml-auto">{filteredMovements.length} de {movementsTotal} eventos</span>
                </div>

                {filteredMovements.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">Nenhuma movimentação encontrada</div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredMovements.map(m => (
                      <div key={m.id} className="flex items-start gap-2.5 p-2.5 border dark:border-gray-700 rounded-lg text-sm">
                        <div className="mt-0.5">
                          {m.type === 'entry' ? (
                            <ArrowDownCircle size={16} className="text-green-500" />
                          ) : (
                            <ArrowUpCircle size={16} className="text-red-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm flex items-center gap-2">
                            <span className={m.type === 'entry' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                              {m.type === 'entry' ? 'Entrada' : 'Saída'}
                            </span>
                            <span>{m.quantity} {m.globalStockItem?.unit ?? ''}</span>
                            <span className="text-gray-400">—</span>
                            <span>{m.globalStockItem?.name ?? '...'}</span>
                          </div>
                          <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                            <span>{m.type === 'entry' ? 'De' : 'Para'}: {m.originDestination}</span>
                            {m.project && <span className="flex items-center gap-0.5"><ChevronRight size={10} /> {m.project.name}</span>}
                            {m.responsible && <span>Resp: {m.responsible}</span>}
                            {m.invoiceNumber && <span className="flex items-center gap-0.5"><FileText size={10} /> {m.invoiceNumber}</span>}
                            {m.supplier && <span className="flex items-center gap-0.5"><Truck size={10} /> {m.supplier.name}</span>}
                            {m.unitPrice != null && <span>R$ {m.unitPrice.toFixed(2)}/un</span>}
                          </div>
                          {m.notes && <div className="text-xs text-gray-400 mt-0.5">{m.notes}</div>}
                        </div>
                        <div className="text-xs text-gray-400 whitespace-nowrap flex flex-col items-end">
                          <span>{new Date(m.date).toLocaleDateString('pt-BR')}</span>
                          {m.createdBy && <span>{m.createdBy.name}</span>}
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
      {completeModal && (
        <CompleteModal
          request={completeModal}
          suppliers={suppliers}
          onComplete={handleComplete}
          onClose={() => setCompleteModal(null)}
        />
      )}
    </div>
  );
};
