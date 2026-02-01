
import React, { useMemo } from 'react';
import { Project, WorkItem, ProjectExpense } from '../types';
import { financial } from '../utils/math';
import { HardHat, Ruler, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

interface PrintReportProps {
  project: Project;
  data: (WorkItem & { depth: number })[];
  expenses: ProjectExpense[];
  stats: {
    contract: number;
    current: number;
    accumulated: number;
    balance: number;
    progress: number;
  };
}

export const PrintReport: React.FC<PrintReportProps> = ({ project, data, expenses, stats }) => {
  // Mapeia gastos por WBS para comparação rápida
  const expensesRollup = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(exp => {
      if (!exp.wbs) return;
      // Adiciona o valor ao WBS exato e a todos os seus pais
      const parts = exp.wbs.split('.');
      for (let i = 1; i <= parts.length; i++) {
        const parentWbs = parts.slice(0, i).join('.');
        map[parentWbs] = (map[parentWbs] || 0) + exp.amount;
      }
    });
    return map;
  }, [expenses]);

  const totalRealCost = financial.sum(expenses.filter(e => e.itemType === 'item').map(e => e.amount));
  const globalResult = stats.accumulated - totalRealCost;

  return (
    <div className="print-report-area bg-white text-black p-0 leading-tight">
      {/* CABEÇALHO PROFISSIONAL */}
      <div className="flex items-center justify-between border-b-4 border-slate-900 pb-4 mb-6">
        <div className="flex items-center gap-5">
          {project.logo ? (
            <img src={project.logo} className="w-20 h-20 object-contain" />
          ) : (
            <div className="w-16 h-16 bg-slate-900 text-white flex items-center justify-center rounded-lg">
              <HardHat size={40} />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">{project.companyName}</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Gestão Integrada de Engenharia e Custos</p>
            <div className="flex items-center gap-3 mt-2 text-[9px] font-black text-slate-400">
               <span className="flex items-center gap-1"><Ruler size={10}/> ProMeasure PRO v4.0</span>
               <span className="w-1 h-1 bg-slate-300 rounded-full" />
               <span>Relatório de Auditoria Física e Financeira</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-black uppercase mb-1">Boletim de Medição</h2>
          <div className="inline-block bg-slate-900 text-white px-3 py-1 text-xs font-black rounded mb-1">
            EDIÇÃO Nº {project.measurementNumber}
          </div>
          <p className="text-[9px] font-bold text-slate-500">Ref: {project.referenceDate}</p>
        </div>
      </div>

      {/* QUADRO DE IDENTIFICAÇÃO DA OBRA */}
      <div className="grid grid-cols-3 gap-0 border border-black mb-6 bg-slate-50 rounded-lg overflow-hidden">
        <div className="p-3 border-r border-black">
          <label className="text-[7px] font-black uppercase text-slate-400 block mb-1">Empreendimento</label>
          <span className="text-xs font-black uppercase">{project.name}</span>
        </div>
        <div className="p-3 border-r border-black">
          <label className="text-[7px] font-black uppercase text-slate-400 block mb-1">Status da Medição</label>
          <span className="text-xs font-black text-blue-700 uppercase">Período de Referência Atual</span>
        </div>
        <div className="p-3 bg-slate-100">
          <label className="text-[7px] font-black uppercase text-slate-400 block mb-1">Progresso Físico Global</label>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black">{stats.progress.toFixed(2)}%</span>
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-slate-900" style={{ width: `${stats.progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* TABELA DE MEDIÇÃO E CUSTO REAL */}
      <table className="w-full text-[7.5px] mb-8 border-collapse">
        <thead>
          <tr className="bg-slate-900 text-white font-black uppercase">
            <th className="border border-black p-1 w-10">WBS</th>
            <th className="border border-black p-1 text-left">DESCRIÇÃO DOS SERVIÇOS</th>
            <th className="border border-black p-1 w-10">UND</th>
            <th className="border border-black p-1 w-24">ORÇADO (TOTAL)</th>
            <th className="border border-black p-1 w-24 bg-blue-800">MEDIDO (ACUM.)</th>
            <th className="border border-black p-1 w-24 bg-amber-700">GASTO REAL (FIN)</th>
            <th className="border border-black p-1 w-24 bg-emerald-800">MARGEM / DESVIO</th>
            <th className="border border-black p-1 w-10">%</th>
          </tr>
        </thead>
        <tbody>
          {data.map(item => {
            const realCost = expensesRollup[item.wbs] || 0;
            const deviation = (item.accumulatedTotal || 0) - realCost;
            const isCategory = item.type === 'category';

            return (
              <tr key={item.id} className={`${isCategory ? 'bg-slate-100 font-bold' : ''} border-b border-slate-300`}>
                <td className="border border-black p-1 text-center font-mono">{item.wbs}</td>
                <td className="border border-black p-1 uppercase" style={{ paddingLeft: `${item.depth * 8 + 4}px` }}>
                  {item.name}
                </td>
                <td className="border border-black p-1 text-center">{item.unit || '—'}</td>
                <td className="border border-black p-1 text-right font-bold">
                  {financial.formatBRL(item.contractTotal)}
                </td>
                <td className="border border-black p-1 text-right text-blue-800 font-bold">
                  {financial.formatBRL(item.accumulatedTotal || 0)}
                </td>
                <td className="border border-black p-1 text-right text-amber-900 font-bold">
                  {financial.formatBRL(realCost)}
                </td>
                <td className={`border border-black p-1 text-right font-black ${deviation >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {financial.formatBRL(deviation)}
                </td>
                <td className="border border-black p-1 text-center font-black">
                  {item.accumulatedPercentage.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-900 text-white font-black uppercase text-[9px]">
            <td colSpan={3} className="border border-black p-2 text-right uppercase tracking-widest">Totais Gerais Consolidados</td>
            <td className="border border-black p-2 text-right">{financial.formatBRL(stats.contract)}</td>
            <td className="border border-black p-2 text-right">{financial.formatBRL(stats.accumulated)}</td>
            <td className="border border-black p-2 text-right">{financial.formatBRL(totalRealCost)}</td>
            <td className={`border border-black p-2 text-right ${globalResult >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {financial.formatBRL(globalResult)}
            </td>
            <td className="border border-black p-2 text-center">{stats.progress.toFixed(1)}%</td>
          </tr>
        </tfoot>
      </table>

      {/* DASHBOARD DE KPI NO RODAPÉ */}
      <div className="grid grid-cols-4 gap-4 mb-10 no-break">
        <SummaryBox 
          label="Contratado Total" 
          value={financial.formatBRL(stats.contract)} 
          color="slate" 
          icon={<Ruler size={16}/>}
        />
        <SummaryBox 
          label="Medido Acumulado" 
          value={financial.formatBRL(stats.accumulated)} 
          color="blue" 
          icon={<TrendingUp size={16}/>}
        />
        <SummaryBox 
          label="Custo Real Incorrido" 
          value={financial.formatBRL(totalRealCost)} 
          color="amber" 
          icon={<AlertCircle size={16}/>}
        />
        <SummaryBox 
          label="Resultado Líquido" 
          value={financial.formatBRL(globalResult)} 
          color={globalResult >= 0 ? 'emerald' : 'rose'} 
          icon={<CheckCircle size={16}/>}
        />
      </div>

      {/* ASSINATURAS */}
      <div className="mt-12 grid grid-cols-3 gap-10 text-center no-break">
        <div>
          <div className="border-t border-black mb-1 mx-4"></div>
          <p className="text-[8px] font-black uppercase tracking-widest">Responsável Técnico</p>
          <p className="text-[7px] uppercase font-bold text-slate-500">{project.companyName}</p>
        </div>
        <div>
          <div className="border-t border-black mb-1 mx-4"></div>
          <p className="text-[8px] font-black uppercase tracking-widest">Fiscalização / Cliente</p>
          <p className="text-[7px] uppercase font-bold text-slate-500">Aprovação de Campo</p>
        </div>
        <div>
          <div className="border-t border-black mb-1 mx-4"></div>
          <p className="text-[8px] font-black uppercase tracking-widest">Diretoria Executiva</p>
          <p className="text-[7px] uppercase font-bold text-slate-500">Liberação Financeira</p>
        </div>
      </div>
      
      <div className="mt-6 text-center text-[6px] text-slate-400 uppercase font-bold">
        Documento gerado automaticamente pelo Sistema ProMeasure PRO - Todos os direitos reservados.
      </div>
    </div>
  );
};

const SummaryBox = ({ label, value, color, icon }: any) => {
  const colors: any = {
    slate: 'bg-slate-50 border-slate-900 text-slate-900',
    blue: 'bg-blue-50 border-blue-900 text-blue-900',
    amber: 'bg-amber-50 border-amber-900 text-amber-900',
    emerald: 'bg-emerald-50 border-emerald-900 text-emerald-900',
    rose: 'bg-rose-50 border-rose-900 text-rose-900'
  };

  return (
    <div className={`p-3 border-2 rounded-xl flex items-center gap-3 ${colors[color]}`}>
      <div className="shrink-0 opacity-40">{icon}</div>
      <div>
        <label className="text-[7px] font-black uppercase block opacity-60 tracking-wider mb-1">{label}</label>
        <span className="text-sm font-black tracking-tighter leading-none">{value}</span>
      </div>
    </div>
  );
};
