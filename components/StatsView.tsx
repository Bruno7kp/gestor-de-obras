
import React, { useMemo } from 'react';
import { Project } from '../types';
import { treeService } from '../services/treeService';
import { financial } from '../utils/math';
import { EvolutionChart } from './EvolutionChart';
import { 
  Briefcase, PieChart, Activity, TrendingUp, Target, 
  ArrowUpRight, Gauge, Scale, Zap
} from 'lucide-react';

interface StatsViewProps {
  project: Project;
}

export const StatsView: React.FC<StatsViewProps> = ({ project }) => {
  // Stats baseadas na EAP (O que foi vendido vs O que foi produzido)
  const stats = useMemo(() => 
    treeService.calculateBasicStats(project.items, project.bdi, project)
  , [project.items, project.bdi, project.contractTotalOverride, project.currentTotalOverride]);

  // Custos Operacionais (O que foi gasto em insumos/MO para realizar a produção)
  const operationalCosts = useMemo(() => {
    const costItems = project.expenses.filter(e => e.itemType === 'item' && (e.type === 'labor' || e.type === 'material'));
    return financial.sum(costItems.map(e => e.amount));
  }, [project.expenses]);

  // Margem Operacional: Valor Medido (Produção) - Custo Operacional (Gasto)
  const operationalMargin = financial.round(stats.accumulated - operationalCosts);
  const marginPercent = stats.accumulated > 0 ? (operationalMargin / stats.accumulated) * 100 : 0;

  // Eficiência: Para cada 1 real gasto, quanto eu produzi?
  const productionROI = operationalCosts > 0 ? (stats.accumulated / operationalCosts) : 0;

  const currencySymbol = project.theme?.currencySymbol || 'R$';

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* HEADER EXPLICATIVO */}
      <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-500/20 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
              <Gauge size={28} /> Performance da Operação
            </h2>
            <p className="text-indigo-100 text-xs font-medium mt-1 max-w-xl">
              Esta visão analisa a **lucratividade da execução**. Ela compara o valor dos serviços produzidos (Medição) contra o custo real para executá-los, independente de quando o dinheiro entrará no caixa.
            </p>
          </div>
          <div className="flex items-center gap-4 bg-white/10 p-4 rounded-3xl backdrop-blur-md border border-white/10">
             <div className="text-right">
                <p className="text-[9px] font-black uppercase opacity-60">Status do Contrato</p>
                <p className="text-xl font-black">{stats.progress.toFixed(1)}%</p>
             </div>
             <div className="w-px h-8 bg-white/20" />
             <div className="p-2 bg-white/20 rounded-xl">
                <Target size={20} />
             </div>
          </div>
        </div>
        <Zap size={180} className="absolute -right-10 -bottom-10 opacity-10 -rotate-12" />
      </div>

      {/* GRID DE PERFORMANCE OPERACIONAL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <PerfCard 
          label="Produção Acumulada" 
          value={financial.formatVisual(stats.accumulated, currencySymbol)} 
          sub="O que você já mediu"
          icon={<PieChart size={20}/>}
          color="blue"
        />
        <PerfCard 
          label="Custo Operacional" 
          value={financial.formatVisual(operationalCosts, currencySymbol)} 
          sub="O que você gastou"
          icon={<TrendingUp size={20}/>}
          color="rose"
        />
        <PerfCard 
          label="Margem de Execução" 
          value={financial.formatVisual(operationalMargin, currencySymbol)} 
          sub={`${marginPercent.toFixed(1)}% de lucro operacional`}
          icon={<Scale size={20}/>}
          color={operationalMargin >= 0 ? "emerald" : "rose"}
        />
        <PerfCard 
          label="ROI de Produção" 
          value={productionROI.toFixed(2)} 
          sub={`Gera ${currencySymbol} ${productionROI.toFixed(2)} p/ cada 1,00`}
          icon={<Activity size={20}/>}
          color="indigo"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <EvolutionChart history={project.history || []} currentProgress={stats.progress} />
        </div>
        
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Equilíbrio Contratual</h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                    <span className="text-slate-400">Saldo a Produzir</span>
                    <span className="text-indigo-600">{financial.formatVisual(stats.balance, currencySymbol)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${100 - stats.progress}%` }} />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed italic border-t border-slate-50 dark:border-slate-800 pt-4">
                  Este gráfico e os indicadores acima mostram se a obra está "se pagando" tecnicamente. Se o ROI for menor que 1.0, você está gastando mais para produzir do que o valor que o cliente paga pelo serviço.
                </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const PerfCard = ({ label, value, sub, icon, color }: any) => {
  const colors: any = {
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800',
    rose: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800',
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800',
    indigo: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800'
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 border ${colors[color]}`}>
        {icon}
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter leading-none">{value}</p>
      <p className="text-[9px] font-bold text-slate-400 uppercase mt-3">{sub}</p>
    </div>
  );
};
