
import React, { useMemo } from 'react';
import { Project } from '../types';
import { treeService } from '../services/treeService';
import { financial } from '../utils/math';
import { EvolutionChart } from './EvolutionChart';
import { 
  Briefcase, PieChart, Wallet, DollarSign, Database, 
  ArrowUpRight, TrendingDown 
} from 'lucide-react';

interface StatsViewProps {
  project: Project;
}

export const StatsView: React.FC<StatsViewProps> = ({ project }) => {
  const stats = useMemo(() => 
    treeService.calculateBasicStats(project.items, project.bdi)
  , [project.items, project.bdi]);

  const expensesTotal = useMemo(() => 
    financial.sum(project.expenses.map(e => e.amount))
  , [project.expenses]);

  const margin = financial.round(stats.accumulated - expensesTotal);
  const marginPercent = stats.accumulated > 0 ? (margin / stats.accumulated) * 100 : 0;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <KpiCard label="Valor Contrato" value={financial.formatBRL(stats.contract)} icon={<Briefcase size={20}/>} progress={100} color="indigo" />
        <KpiCard label="Executado Total" value={financial.formatBRL(stats.accumulated)} icon={<PieChart size={20}/>} progress={stats.progress} color="emerald" />
        <KpiCard label="Gastos Reais" value={financial.formatBRL(expensesTotal)} icon={<Wallet size={20}/>} progress={stats.contract > 0 ? (expensesTotal / stats.contract) * 100 : 0} color="rose" />
        
        {/* CARD DE MARGEM COM LÓGICA DE COR DINÂMICA */}
        <div className={`p-8 rounded-[32px] border shadow-sm flex flex-col justify-between transition-all ${margin >= 0 ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-800' : 'bg-rose-50/50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-800'}`}>
          <div className="flex justify-between items-start">
            <div className={`p-3 rounded-xl ${margin >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'}`}>
               <DollarSign size={20}/>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 opacity-80">Margem Obra</span>
          </div>
          <div className="mt-6">
            <p className={`text-2xl font-black tracking-tighter ${margin >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{financial.formatBRL(margin)}</p>
            <div className="flex items-center gap-1 mt-1">
              {margin >= 0 ? <ArrowUpRight size={12} className="text-emerald-500 dark:text-emerald-400"/> : <TrendingDown size={12} className="text-rose-500 dark:text-rose-400"/>}
              <span className={`text-[10px] font-bold uppercase ${margin >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>{marginPercent.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <KpiCard label="Saldo Remanescente" value={financial.formatBRL(stats.balance)} icon={<Database size={20}/>} progress={100 - stats.progress} color="slate" />
      </div>

      <EvolutionChart history={project.history || []} currentProgress={stats.progress} />
    </div>
  );
};

const KpiCard = ({ label, value, icon, progress, color }: any) => {
  return (
    <div className={`p-8 rounded-[32px] border shadow-sm hover:shadow-xl transition-all relative overflow-hidden group bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800`}>
      <div className="flex justify-between items-start mb-6">
        <div className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors`}>{icon}</div>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</span>
      </div>
      <p className={`text-2xl font-black tracking-tighter mb-4 text-slate-800 dark:text-white`}>{value}</p>
      <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full opacity-70 transition-all duration-1000 bg-indigo-500 dark:bg-indigo-400`} style={{ width: `${Math.min(100, Math.abs(progress || 0))}%` }} />
      </div>
    </div>
  );
};
