
import React, { useState, useMemo } from 'react';
import { Project, WorkItem, ProjectPlanning } from '../types';
import { financial } from '../utils/math';
import { treeService } from '../services/treeService';
import { 
  CalendarDays, ChevronLeft, ChevronRight, Calculator, 
  TrendingUp, BarChart3, Lock, Info, Save, Clock
} from 'lucide-react';

interface PhysicalScheduleViewProps {
  project: Project;
  onUpdatePlanning: (planning: ProjectPlanning) => void;
}

export const PhysicalScheduleView: React.FC<PhysicalScheduleViewProps> = ({ project, onUpdatePlanning }) => {
  const [startMonth, setStartMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [numMonths, setNumMonths] = useState(12);

  const periods = useMemo(() => {
    const list: string[] = [];
    const [year, month] = startMonth.split('-').map(Number);
    for (let i = 0; i < numMonths; i++) {
      const d = new Date(year, month - 1 + i, 1);
      list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return list;
  }, [startMonth, numMonths]);

  const treeData = useMemo(() => {
    const tree = treeService.buildTree(project.items);
    const processed = tree.map((root, idx) => treeService.processRecursive(root, '', idx, project.bdi));
    const allIds = new Set(project.items.map(i => i.id));
    return treeService.flattenTree(processed, allIds);
  }, [project.items, project.bdi]);

  const schedule = project.planning.schedule || {};

  const handleUpdatePlanned = (itemId: string, period: string, value: number) => {
    const safeValue = Math.min(100, Math.max(0, value));
    const newSchedule = { ...schedule };
    if (!newSchedule[itemId]) newSchedule[itemId] = {};
    newSchedule[itemId][period] = { 
      ...newSchedule[itemId][period], 
      plannedPercent: safeValue 
    };

    onUpdatePlanning({
      ...project.planning,
      schedule: newSchedule
    });
  };

  const periodTotals = useMemo(() => {
    const totals: { [period: string]: number } = {};
    periods.forEach(p => {
      let sum = 0;
      treeData.forEach(item => {
        if (item.type === 'item') {
          const planned = schedule[item.id]?.[p]?.plannedPercent || 0;
          sum += (planned / 100) * (item.contractTotal || 0);
        }
      });
      totals[p] = sum;
    });
    return totals;
  }, [periods, treeData, schedule]);

  const accumulatedTotals = useMemo(() => {
    const acc: { [period: string]: number } = {};
    let currentAcc = 0;
    periods.forEach(p => {
      currentAcc += periodTotals[p];
      acc[p] = currentAcc;
    });
    return acc;
  }, [periods, periodTotals]);

  const formatPeriodLabel = (p: string) => {
    const [y, m] = p.split('-');
    const date = new Date(Number(y), Number(m) - 1, 1);
    return date.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HEADER DE CONFIGURAÇÃO */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
           <div className="p-4 bg-indigo-600 rounded-2xl text-white shadow-lg">
              <CalendarDays size={28} />
           </div>
           <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Cronograma Físico-Financeiro</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Planejamento de Desembolso Mensal</p>
           </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700">
           <div className="flex flex-col px-3">
              <span className="text-[8px] font-black text-slate-400 uppercase">Mês de Início</span>
              <input 
                type="month" 
                className="bg-transparent text-xs font-black outline-none dark:text-white"
                value={startMonth}
                onChange={e => setStartMonth(e.target.value)}
              />
           </div>
           <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
           <div className="flex flex-col px-3">
              <span className="text-[8px] font-black text-slate-400 uppercase">Duração (Meses)</span>
              <select 
                className="bg-transparent text-xs font-black outline-none dark:text-white appearance-none"
                value={numMonths}
                onChange={e => setNumMonths(Number(e.target.value))}
              >
                {[6, 12, 18, 24, 36].map(v => <option key={v} value={v}>{v} Meses</option>)}
              </select>
           </div>
        </div>
      </div>

      {/* GRID DO CRONOGRAMA */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden shadow-xl flex flex-col">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                <th className="sticky left-0 z-30 bg-slate-900 p-4 text-left border-r border-white/5 min-w-[300px]">Estrutura do Projeto (EAP)</th>
                <th className="p-4 text-right border-r border-white/5 min-w-[120px]">Valor Total</th>
                {periods.map(p => (
                  <th key={p} className="p-4 text-center min-w-[100px] border-r border-white/5 bg-slate-800">
                    {formatPeriodLabel(p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {treeData.map(item => {
                const isCat = item.type === 'category';
                return (
                  <tr key={item.id} className={`${isCat ? 'bg-slate-50/50 dark:bg-slate-800/30' : 'hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10'}`}>
                    <td className={`sticky left-0 z-20 p-3 border-r border-slate-100 dark:border-slate-800 flex items-center gap-2 ${isCat ? 'bg-slate-50 dark:bg-slate-800 font-black' : 'bg-white dark:bg-slate-900 text-slate-600'}`} style={{ paddingLeft: `${item.depth * 1.5 + 0.75}rem` }}>
                      <span className="text-[10px] font-mono text-slate-400">{item.wbs}</span>
                      <span className={`text-[10px] truncate max-w-[200px] ${isCat ? 'uppercase' : ''}`}>{item.name}</span>
                    </td>
                    <td className="p-3 text-right border-r border-slate-100 dark:border-slate-800 font-bold text-[10px] text-slate-500">
                      {financial.formatVisual(item.contractTotal, 'R$')}
                    </td>
                    {periods.map(p => {
                      const distribution = schedule[item.id]?.[p];
                      // Fix: Correct property name from 'plannedPhysical' to 'plannedPercent' as defined in PeriodDistribution interface
                      const plannedValue = isCat ? 0 : (item.contractTotal * (distribution?.plannedPercent || 0) / 100);
                      
                      return (
                        <td key={p} className="p-2 border-r border-slate-100 dark:border-slate-800">
                          {isCat ? (
                            <div className="flex flex-col items-center opacity-30">
                              <Lock size={10} />
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1 group">
                               <div className="relative w-full">
                                  <input 
                                    type="number" 
                                    className="w-full bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-indigo-500 rounded-lg px-2 py-1 text-[10px] font-black text-center outline-none transition-all"
                                    value={distribution?.plannedPercent || ''}
                                    onChange={e => handleUpdatePlanned(item.id, p, parseFloat(e.target.value) || 0)}
                                    placeholder="0"
                                  />
                                  <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] text-slate-400">%</span>
                               </div>
                               {(distribution?.plannedPercent || 0) > 0 && (
                                 <span className="text-[8px] font-bold text-indigo-500">
                                   {financial.formatVisual((distribution!.plannedPercent / 100) * item.contractTotal, 'R$')}
                                 </span>
                               )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            {/* RODAPÉ DE TOTAIS */}
            <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-black text-[10px]">
               <tr>
                  <td colSpan={2} className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-800 p-4 text-right uppercase tracking-widest text-slate-400">Total Mensal Previsto</td>
                  {periods.map(p => (
                    <td key={p} className="p-4 text-center text-indigo-600 dark:text-indigo-400">
                       {financial.formatVisual(periodTotals[p], 'R$')}
                    </td>
                  ))}
               </tr>
               <tr>
                  <td colSpan={2} className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-800 p-4 text-right uppercase tracking-widest text-slate-400">Acumulado Previsto (Curva S)</td>
                  {periods.map(p => (
                    <td key={p} className="p-4 text-center bg-indigo-600 text-white border-r border-white/10">
                       {financial.formatVisual(accumulatedTotals[p], 'R$')}
                    </td>
                  ))}
               </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* PAINEL DE INSIGHTS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
               <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-xl"><Calculator size={20}/></div>
               <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white">Pico de Desembolso</h3>
            </div>
            <p className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">
               {financial.formatVisual(Math.max(...Object.values(periodTotals)), 'R$')}
            </p>
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">Mês de maior custo operacional</p>
         </div>

         <div className="md:col-span-2 bg-indigo-600 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
            <TrendingUp size={120} className="absolute -right-10 -bottom-10 opacity-10" />
            <div className="relative z-10">
               <h3 className="text-xs font-black uppercase tracking-widest opacity-80 mb-6 flex items-center gap-2">
                 <BarChart3 size={16}/> Eficiência de Planejamento
               </h3>
               <div className="grid grid-cols-2 gap-10">
                  <div>
                    <p className="text-[9px] font-black uppercase opacity-60">Previsto p/ Próximo Mês</p>
                    <p className="text-2xl font-black">{financial.formatVisual(periodTotals[periods[0]] || 0, 'R$')}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase opacity-60">Total em Aberto</p>
                    <p className="text-2xl font-black">{financial.formatVisual(accumulatedTotals[periods[periods.length-1]] || 0, 'R$')}</p>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};
