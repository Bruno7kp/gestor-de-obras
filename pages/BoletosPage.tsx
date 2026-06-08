import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Download, FileText, Filter, RefreshCw, Receipt } from 'lucide-react';
import type { SupplyBoleto } from '../types';
import { planningApi } from '../services/planningApi';
import { useToast } from '../hooks/useToast';
import { financial } from '../utils/math';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { Pagination } from '../components/Pagination';

const PAGE_SIZE = 20;

export const BoletosPage: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const canEditPlanning = canEdit('planning');

  const [boletos, setBoletos] = useState<SupplyBoleto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState<'todos' | 'pendentes' | 'pagos'>('todos');
  const [filterProject, setFilterProject] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  // Separate lightweight fetch for the project select options (unfiltered, all at once)
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    planningApi.listAllBoletos({ take: 500 })
      .then(({ boletos: all }) => {
        const seen = new Map<string, string>();
        all.forEach(b => {
          const p = b.projectPlanning?.project;
          if (p && !seen.has(p.id)) seen.set(p.id, p.name);
        });
        setProjects(
          Array.from(seen.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const isPaid = filterStatus === 'pagos' ? true : filterStatus === 'pendentes' ? false : undefined;
      const { boletos: data, total: t } = await planningApi.listAllBoletos({
        skip: (p - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        isPaid,
        projectId: filterProject || undefined,
      });
      setBoletos(data);
      setTotal(t);
    } catch {
      toast.error('Erro ao carregar boletos');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterProject]);

  useEffect(() => {
    setPage(1);
    load(1);
  }, [filterStatus, filterProject]);

  useEffect(() => {
    load(page);
  }, [page]);

  const handleTogglePaid = async (boleto: SupplyBoleto) => {
    if (!canEditPlanning) return;
    const newPaid = !boleto.isPaid;
    setToggling(boleto.id);
    setBoletos(prev => prev.map(b => b.id === boleto.id ? { ...b, isPaid: newPaid } : b));
    try {
      await planningApi.updateBoleto(boleto.id, { isPaid: newPaid });
    } catch {
      setBoletos(prev => prev.map(b => b.id === boleto.id ? { ...b, isPaid: boleto.isPaid } : b));
      toast.error('Erro ao atualizar boleto');
    } finally {
      setToggling(null);
    }
  };

  // KPI totals from current page (approximation; backend could provide these separately if needed)
  const countPendente = boletos.filter(b => !b.isPaid).length;
  const totalPendente = boletos.filter(b => !b.isPaid).reduce((s, b) => s + b.amountDue, 0);
  const totalPago = boletos.filter(b => b.isPaid).reduce((s, b) => s + b.amountDue, 0);

  const today = new Date().toISOString().split('T')[0];
  const isOverdue = (dueDate: string) => dueDate < today;
  const isDueSoon = (dueDate: string) => {
    const diff = (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const selectClass = "py-2 px-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer";

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-12 animate-in fade-in duration-500 bg-slate-50 dark:bg-slate-950 custom-scrollbar">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Boletos</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Visão consolidada de todos os boletos das obras.</p>
          </div>
          <button onClick={() => load(page)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all" title="Atualizar">
            <RefreshCw size={16} />
          </button>
        </div>

        {/* KPIs + Filtros */}
        <div className="flex flex-wrap items-stretch gap-3">
          <div className="flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <Clock size={16} className="text-amber-500" />
            <div className="leading-tight">
              <p className="text-md font-black text-slate-800 dark:text-white">{countPendente}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pendentes</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <AlertTriangle size={16} className="text-amber-500" />
            <div className="leading-tight">
              <p className="text-md font-black text-amber-600">R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">A Pagar</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <div className="leading-tight">
              <p className="text-md font-black text-emerald-600">R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pagos</p>
            </div>
          </div>

          <div className="flex-1" />

          {/* Filtros */}
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <Filter size={14} className="text-slate-400 shrink-0" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)} className={selectClass}>
              <option value="todos">Todos</option>
              <option value="pendentes">Pendentes</option>
              <option value="pagos">Pagos</option>
            </select>
            {projects.length > 0 && (
              <>
                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
                <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className={selectClass}>
                  <option value="">Todas as obras</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="py-20 flex justify-center">
            <RefreshCw size={24} className="animate-spin text-slate-400" />
          </div>
        ) : boletos.length === 0 ? (
          <div className="py-20 text-center opacity-30 select-none">
            <Receipt size={64} className="mx-auto mb-4" />
            <p className="text-sm font-black uppercase tracking-widest">Nenhum boleto encontrado</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="hidden lg:grid grid-cols-[1fr_140px_120px_80px_60px_80px] gap-4 px-8 py-4 bg-slate-50/50 dark:bg-slate-800/50">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Descrição</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Obra</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Vencimento</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Valor</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Anexo</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Pago</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {boletos.map(boleto => {
                const overdue = !boleto.isPaid && isOverdue(boleto.dueDate);
                const soon = !boleto.isPaid && !overdue && isDueSoon(boleto.dueDate);
                return (
                  <div
                    key={boleto.id}
                    className={`grid grid-cols-1 lg:grid-cols-[1fr_140px_120px_80px_60px_80px] gap-2 lg:gap-4 px-6 lg:px-8 py-4 items-center transition-colors ${boleto.isPaid ? 'bg-emerald-50/30 dark:bg-emerald-900/5' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'}`}
                  >
                    <div className="min-w-0">
                      <p className={`text-sm font-bold truncate ${boleto.isPaid ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{boleto.description}</p>
                    </div>
                    <div className="text-center">
                      {boleto.projectPlanning?.project && (
                        <button
                          onClick={() => navigate(`/app/projects/${boleto.projectPlanning!.project!.id}/supplies`)}
                          className="text-[10px] font-bold text-indigo-500 hover:underline truncate max-w-[130px] block mx-auto"
                          title={boleto.projectPlanning.project.name}
                        >
                          {boleto.projectPlanning.project.name}
                        </button>
                      )}
                    </div>
                    <div className="text-center">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${boleto.isPaid ? 'text-slate-400' : overdue ? 'text-rose-500' : soon ? 'text-amber-500' : 'text-slate-500'}`}>
                        {financial.formatDate(boleto.dueDate)}
                        {overdue && !boleto.isPaid && <span className="ml-1">(vencido)</span>}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-black ${boleto.isPaid ? 'line-through text-slate-400' : 'text-amber-600'}`}>
                        R$ {boleto.amountDue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-center">
                      {boleto.attachmentUrl ? (
                        <a
                          href={boleto.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
                          title="Ver anexo"
                        >
                          <Download size={14} />
                        </a>
                      ) : (
                        <FileText size={14} className="text-slate-300" />
                      )}
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleTogglePaid(boleto)}
                        disabled={!canEditPlanning || toggling === boleto.id}
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all disabled:opacity-50 ${boleto.isPaid ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400'}`}
                        title={boleto.isPaid ? 'Marcar como não pago' : 'Marcar como pago'}
                      >
                        {boleto.isPaid && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="px-8 pb-6">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total}
                onPageChange={setPage}
                label="Boletos"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
