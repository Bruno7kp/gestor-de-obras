import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ArrowDownCircle, ArrowUpCircle, History, Truck, FileText,
  RefreshCw, Search, X, Globe,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useCrossInstanceStock } from '../hooks/useCrossInstanceStock';
import { useToast } from '../hooks/useToast';
import { globalStockApi } from '../services/globalStockApi';
import { financial } from '../utils/math';
import { Pagination } from './Pagination';
import { DateFilterPopover } from './DateFilterPopover';
import type { GlobalStockMovement } from '../types';

const PAGE_SIZE = 30;

/* ------------------------------------------------------------------ */
/*  Stock Log Page — Movimentações                                     */
/* ------------------------------------------------------------------ */
export const StockLogPage: React.FC = () => {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const itemIdParam = searchParams.get('itemId') || '';
  const itemNameParam = searchParams.get('itemName') || '';
  const externalInstanceId = searchParams.get('instanceId') || undefined;
  const externalInstanceName = searchParams.get('instanceName') || undefined;

  // Resolved permissions (cross-instance when external, home otherwise)
  const { canView } = useCrossInstanceStock(externalInstanceId);
  const canFinancial = canView('global_stock_financial');

  const [movements, setMovements] = useState<GlobalStockMovement[]>([]);
  const [movementsTotal, setMovementsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [logFilter, setLogFilter] = useState<'all' | 'physical' | 'financial'>('all');
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search input
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const mv = await globalStockApi.listMovements({
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        search: debouncedSearch || undefined,
        globalStockItemId: itemIdParam || undefined,
        dateStart: dateStart || undefined,
        dateEnd: dateEnd || undefined,
        instanceId: externalInstanceId,
      });
      setMovements(mv.movements);
      setMovementsTotal(mv.total);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, itemIdParam, dateStart, dateEnd, externalInstanceId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Reset page when logFilter changes (client-side)
  useEffect(() => { setPage(1); }, [logFilter]);

  // Reset page when date filters change
  useEffect(() => { setPage(1); }, [dateStart, dateEnd]);

  const filteredMovements = useMemo(() => {
    if (logFilter === 'all') return movements;
    if (logFilter === 'physical') return movements.filter(m => m.type === 'entry' || m.type === 'exit');
    return movements.filter(m => m.unitPrice != null);
  }, [movements, logFilter]);

  const totalPages = Math.max(1, Math.ceil(movementsTotal / PAGE_SIZE));

  const clearItemFilter = () => {
    searchParams.delete('itemId');
    searchParams.delete('itemName');
    setSearchParams(searchParams, { replace: true });
    setPage(1);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-12 animate-in fade-in duration-500 bg-slate-50 dark:bg-slate-950 custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* EXTERNAL INSTANCE BANNER */}
        {externalInstanceId && (
          <div className="flex items-center gap-3 px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl">
            <Globe size={18} className="text-amber-600 shrink-0" />
            <p className="flex-1 text-sm font-bold text-amber-700 dark:text-amber-300">
              Visualizando movimentações de <span className="font-black">{externalInstanceName ?? 'outra instância'}</span>
            </p>
          </div>
        )}

        {/* HEADER */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
              Movimentações{externalInstanceName ? ` — ${externalInstanceName}` : ''}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Log de entradas e saídas do estoque global.</p>
          </div>
        </div>

        {/* KPI + FILTERS */}
        <div className="flex flex-wrap items-stretch gap-3">
          <div className="flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <History size={16} className="text-indigo-500" />
            <div className="leading-tight">
              <p className="text-sm font-black text-slate-800 dark:text-white">{movementsTotal}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Total Movimentações</p>
            </div>
          </div>
          <div className="flex-1" />
          {/* Search + Date filter */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar item, obra, fornecedor…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-48 bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:bg-white dark:focus:bg-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-xs font-bold"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-1 p-0.5 text-slate-400 hover:text-slate-600 transition-all">
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
            <DateFilterPopover
              dateStart={dateStart}
              dateEnd={dateEnd}
              onDateStartChange={setDateStart}
              onDateEndChange={setDateEnd}
            />
          </div>
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
              {[
                { key: 'all' as const, label: 'Todas' },
                { key: 'physical' as const, label: 'Físicas' },
                { key: 'financial' as const, label: 'Financeiras' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setLogFilter(f.key)}
                  className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${
                    logFilter === f.key ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button onClick={loadData} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all" title="Atualizar">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Item filter badge */}
        {itemIdParam && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-xs font-bold text-indigo-700 dark:text-indigo-300">
              <Search size={12} /> Filtrando por: {itemNameParam || 'Item'}
              <button onClick={clearItemFilter} className="p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all" title="Limpar filtro">
                <X size={12} />
              </button>
            </span>
          </div>
        )}

        {/* CONTENT */}
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw size={24} className="animate-spin text-slate-400 mx-auto" />
          </div>
        ) : filteredMovements.length === 0 ? (
          <p className="text-center py-20 text-[10px] font-bold uppercase tracking-widest text-slate-400">Nenhuma movimentação registrada</p>
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
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={movementsTotal}
            />
          </div>
        )}
      </div>
    </div>
  );
};
