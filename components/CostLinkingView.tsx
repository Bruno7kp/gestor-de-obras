
import React, { useState, useMemo } from 'react';
import { Project, WorkItem, ProjectExpense } from '../types';
import { financial } from '../utils/math';
import { 
  Link2, Link2Off, ArrowRight, Target, Coins, TrendingDown, TrendingUp, 
  AlertCircle, CheckCircle2, Search, Filter, Layers, Calculator
} from 'lucide-react';

interface CostLinkingViewProps {
  project: Project;
  onUpdateProject: (data: Partial<Project>) => void;
}

export const CostLinkingView: React.FC<CostLinkingViewProps> = ({ project, onUpdateProject }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'alert' | 'healthy'>('all');

  const workItems = useMemo(() => project.items.filter(i => i.type === 'item'), [project.items]);
  
  const analysis = useMemo(() => {
    return workItems.map(item => {
      const linkedExpenses = project.expenses.filter(e => e.linkedWorkItemId === item.id);
      const actualCost = financial.sum(linkedExpenses.map(e => e.amount));
      const budgeted = item.contractTotal;
      const diff = budgeted - actualCost;
      const status = diff < 0 ? 'alert' : 'healthy';
      
      return {
        ...item,
        actualCost,
        budgeted,
        diff,
        status,
        linkedCount: linkedExpenses.length
      };
    }).filter(a => {
      const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.wbs.includes(searchTerm);
      const matchesFilter = filterType === 'all' || a.status === filterType;
      return matchesSearch && matchesFilter;
    });
  }, [workItems, project.expenses, searchTerm, filterType]);

  const unlinkedExpenses = useMemo(() => 
    project.expenses.filter(e => e.itemType === 'item' && e.type !== 'revenue' && !e.linkedWorkItemId)
  , [project.expenses]);

  const handleLink = (expenseId: string, workItemId: string | null) => {
    const updatedExpenses = project.expenses.map(e => 
      e.id === expenseId ? { ...e, linkedWorkItemId: workItemId } : e
    );
    onUpdateProject({ expenses: updatedExpenses });
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <header className="bg-indigo-600 rounded-[2.5rem] p-10 text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-white/10 rounded-3xl backdrop-blur-md">
            <Link2 size={36} />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">Conciliação Orçamentária</h2>
            <p className="text-indigo-100 text-sm font-bold uppercase tracking-widest opacity-80">Orçado (Planilha) vs Comprado (Financeiro)</p>
          </div>
        </div>
        <div className="flex gap-4">
           <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white">
             <p className="text-[10px] font-black uppercase opacity-60">Despesas sem Vínculo</p>
             <p className="text-2xl font-black">{unlinkedExpenses.length}</p>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LISTA DE ITENS ORÇADOS (PAINEL ESQUERDO) */}
        <div className="lg:col-span-8 space-y-6">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  placeholder="Pesquisar item da EAP..."
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 text-sm font-bold transition-all"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                 <button onClick={() => setFilterType('all')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'all' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Tudo</button>
                 <button onClick={() => setFilterType('alert')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'alert' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400'}`}>Prejuízo</button>
                 <button onClick={() => setFilterType('healthy')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'healthy' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400'}`}>No Orçamento</button>
              </div>
           </div>

           <div className="space-y-4">
              {analysis.map(item => (
                <div key={item.id} className={`bg-white dark:bg-slate-900 p-6 rounded-[2rem] border transition-all hover:shadow-xl ${item.status === 'alert' ? 'border-rose-200 dark:border-rose-900' : 'border-slate-100 dark:border-slate-800'}`}>
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div className="flex items-start gap-4">
                         <div className={`p-3 rounded-2xl shrink-0 ${item.status === 'alert' ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-500'}`}><Layers size={20}/></div>
                         <div>
                            <div className="flex items-center gap-2">
                               <span className="text-[10px] font-black text-slate-400 font-mono">{item.wbs}</span>
                               <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none">{item.name}</h4>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                               <span className="text-[9px] font-bold text-slate-400 uppercase px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded-full">{item.linkedCount} lançamentos vinculados</span>
                            </div>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className={`text-lg font-black tracking-tighter ${item.diff < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                           {financial.formatVisual(item.diff, 'R$')}
                         </p>
                         <p className="text-[9px] font-black uppercase opacity-40">Margem Estimada</p>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                         <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase">Orçado (Venda)</span>
                            <Calculator size={12} className="text-slate-300"/>
                         </div>
                         <p className="text-sm font-black text-slate-700 dark:text-slate-300">{financial.formatVisual(item.budgeted, 'R$')}</p>
                      </div>
                      <div className={`p-4 rounded-2xl border ${item.status === 'alert' ? 'bg-rose-50/50 border-rose-100 text-rose-700' : 'bg-indigo-50/50 border-indigo-100 text-indigo-700'}`}>
                         <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-black uppercase opacity-60">Gasto Real (Compra)</span>
                            <Coins size={12} className="opacity-40"/>
                         </div>
                         <p className="text-sm font-black">{financial.formatVisual(item.actualCost, 'R$')}</p>
                      </div>
                   </div>

                   <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-slate-50 dark:border-slate-800">
                      {project.expenses.filter(e => e.linkedWorkItemId === item.id).map(exp => (
                        <div key={exp.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl group/chip">
                           <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{exp.description} ({financial.formatVisual(exp.amount, 'R$')})</span>
                           <button onClick={() => handleLink(exp.id, null)} className="text-slate-300 hover:text-rose-500 transition-colors"><Link2Off size={12}/></button>
                        </div>
                      ))}
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* PAINEL DE DESPESAS DISPONÍVEIS (PAINEL DIREITO) */}
        <div className="lg:col-span-4 sticky top-10 space-y-6">
           <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                 <div className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-500 rounded-lg"><AlertCircle size={18}/></div>
                 <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white">Aguardando Vínculo</h3>
              </div>
              
              <div className="space-y-3">
                 {unlinkedExpenses.map(exp => (
                   <div key={exp.id} className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-indigo-400 transition-all">
                      <div className="flex justify-between items-start mb-2">
                         <h5 className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase">{exp.description}</h5>
                         <span className="text-[10px] font-black text-indigo-600">{financial.formatVisual(exp.amount, 'R$')}</span>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-[9px] font-bold text-slate-400 uppercase">{exp.entityName}</span>
                         <select 
                           className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[8px] font-black uppercase px-2 py-1 rounded-lg outline-none focus:border-indigo-500"
                           onChange={(e) => handleLink(exp.id, e.target.value)}
                           value=""
                         >
                            <option value="">Vincular a...</option>
                            {workItems.map(wi => (
                              <option key={wi.id} value={wi.id}>{wi.wbs} - {wi.name}</option>
                            ))}
                         </select>
                      </div>
                   </div>
                 ))}
                 {unlinkedExpenses.length === 0 && (
                   <div className="py-10 text-center opacity-30">
                      <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
                      <p className="text-[10px] font-black uppercase">Tudo conciliado!</p>
                   </div>
                 )}
              </div>
           </div>

           <div className="p-6 bg-indigo-50 dark:bg-indigo-900/10 rounded-[2rem] border border-indigo-100 dark:border-indigo-900">
              <p className="text-[10px] text-indigo-600 font-bold leading-relaxed">
                <strong>Dica:</strong> Vincule notas fiscais e recibos de mão de obra aos itens da planilha para ter o lucro real exato de cada etapa da obra.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};
