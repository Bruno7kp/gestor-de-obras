
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
  // Mapeia gastos por WBS para comparação técnica
  const expensesByWbs = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(exp => {
      if (!exp.wbs) return;
      // Registra no WBS exato
      map[exp.wbs] = (map[exp.wbs] || 0) + exp.amount;
      
      // Propaga para os níveis superiores (1.1.1 -> 1.1 -> 1)
      const parts = exp.wbs.split('.');
      while (parts.length > 1) {
        parts.pop();
        const parentWbs = parts.join('.');
        map[parentWbs] = (map[parentWbs] || 0) + exp.amount;
      }
    });
    return map;
  }, [expenses]);

  const totalRealCost = financial.sum(expenses.filter(e => e.itemType === 'item').map(e => e.amount));
  const globalMargin = stats.accumulated - totalRealCost;

  return (
    <div className="print-report-area bg-white text-black p-0 leading-tight">
      {/* CABEÇALHO PADRÃO ENGENHARIA */}
      <div className="flex items-start justify-between border-b-4 border-slate-900 pb-4 mb-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-slate-900 text-white flex items-center justify-center rounded-xl">
             <HardHat size={48} />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">{project.companyName}</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Gestão de Obras e Auditoria de Custos</p>
            <div className="flex items-center gap-3 mt-3 text-[9px] font-black text-slate-400">
               <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded"><Ruler size={10}/> ProMeasure ERP v4.0</span>
               <span>Relatório Gerencial de Medição e Resultado Financeiro</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-black uppercase mb-1">Planilha de Medição</h2>
          <div className="inline-block bg-slate-900 text-white px-4 py-1 text-xs font-black rounded-full mb-1">
            BOLETIM Nº {project.measurementNumber}
          </div>
          <p className="text-[10px] font-bold text-slate-500 uppercase">Período: {project.referenceDate}</p>
        </div>
      </div>

      {/* QUADRO DE RESUMO TÉCNICO */}
      <div className="grid grid-cols-4 gap-0 border border-black mb-8 bg-slate-50 rounded-xl overflow-hidden">
        <div className="p-4 border-r border-black">
          <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Empreendimento</label>
          <span className="text-sm font-black uppercase">{project.name}</span>
        </div>
        <div className="p-4 border-r border-black">
          <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Data de Referência</label>
          <span className="text-sm font-black uppercase">{project.referenceDate}</span>
        </div>
        <div className="p-4 border-r border-black bg-slate-100">
          <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Execução Física</label>
          <span className="text-lg font-black text-indigo-700">{stats.progress.toFixed(2)}%</span>
        </div>
        <div className="p-4">
          <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Status Financeiro</label>
          <span className="text-xs font-black uppercase px-2 py-1 bg-emerald-100 text-emerald-700 rounded">Em Conformidade</span>
        </div>
      </div>

      {/* TABELA DE MEDIÇÃO EXECUTIVA */}
      <table className="w-full text-[8px] mb-10 border-collapse">
        <thead>
          <tr className="bg-slate-900 text-white font-black uppercase text-center">
            <th className="border border-black p-2 w-12">WBS</th>
            <th className="border border-black p-2 text-left">DESCRIÇÃO DOS SERVIÇOS</th>
            <th className="border border-black p-2 w-10">UND</th>
            <th className="border border-black p-2 w-28 bg-slate-800">ORÇADO (TOTAL)</th>
            <th className="border border-black p-2 w-28 bg-blue-800">MEDIDO (ACUM.)</th>
            <th className="border border-black p-2 w-28 bg-amber-700">GASTO REAL (FIN)</th>
            <th className="border border-black p-2 w-28 bg-emerald-800">MARGEM / DESVIO</th>
            <th className="border border-black p-2 w-12">% EXEC</th>
          </tr>
        </thead>
        <tbody>
          {data.map(item => {
            const realCost = expensesByWbs[item.wbs] || 0;
            const deviation = (item.accumulatedTotal || 0) - realCost;
            const isCategory = item.type === 'category';

            return (
              <tr key={item.id} className={`${isCategory ? 'bg-slate-100 font-bold' : ''} border-b border-black`}>
                <td className="border border-black p-1.5 text-center font-mono">{item.wbs}</td>
                <td className="border border-black p-1.5 uppercase" style={{ paddingLeft: `${item.depth * 10 + 6}px` }}>
                  {item.name}
                </td>
                <td className="border border-black p-1.5 text-center">{item.unit || '—'}</td>
                <td className="border border-black p-1.5 text-right font-bold">
                  {financial.formatBRL(item.contractTotal).replace('R$', '')}
                </td>
                <td className="border border-black p-1.5 text-right text-blue-800 font-bold">
                  {financial.formatBRL(item.accumulatedTotal || 0).replace('R$', '')}
                </td>
                <td className="border border-black p-1.5 text-right text-amber-900 font-bold">
                  {financial.formatBRL(realCost).replace('R$', '')}
                </td>
                <td className={`border border-black p-1.5 text-right font-black ${deviation >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {financial.formatBRL(deviation).replace('R$', '')}
                </td>
                <td className="border border-black p-1.5 text-center font-black">
                  {item.accumulatedPercentage.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-900 text-white font-black uppercase text-[10px]">
            <td colSpan={3} className="border border-black p-3 text-right">Totais Gerais Consolidados:</td>
            <td className="border border-black p-3 text-right">{financial.formatBRL(stats.contract).replace('R$', '')}</td>
            <td className="border border-black p-3 text-right">{financial.formatBRL(stats.accumulated).replace('R$', '')}</td>
            <td className="border border-black p-3 text-right text-amber-300">{financial.formatBRL(totalRealCost).replace('R$', '')}</td>
            <td className={`border border-black p-3 text-right ${globalMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {financial.formatBRL(globalMargin).replace('R$', '')}
            </td>
            <td className="border border-black p-3 text-center">{stats.progress.toFixed(1)}%</td>
          </tr>
        </tfoot>
      </table>

      {/* DASHBOARD DE KPI EXECUTIVO */}
      <div className="grid grid-cols-4 gap-6 mb-16">
        <SummaryBox label="Orçado Total" value={financial.formatBRL(stats.contract)} color="slate" />
        <SummaryBox label="Medido Técnico" value={financial.formatBRL(stats.accumulated)} color="blue" />
        <SummaryBox label="Desembolso Real" value={financial.formatBRL(totalRealCost)} color="amber" />
        <SummaryBox label="Eficiência Obra" value={financial.formatBRL(globalMargin)} color={globalMargin >= 0 ? 'emerald' : 'rose'} />
      </div>

      {/* ASSINATURAS */}
      <div className="grid grid-cols-3 gap-12 text-center">
        <div>
          <div className="border-t-2 border-black mb-1 mx-6"></div>
          <p className="text-[10px] font-black uppercase tracking-tighter">Responsável Técnico</p>
          <p className="text-[8px] uppercase text-slate-500 font-bold">{project.companyName}</p>
        </div>
        <div>
          <div className="border-t-2 border-black mb-1 mx-6"></div>
          <p className="text-[10px] font-black uppercase tracking-tighter">Fiscalização / Cliente</p>
          <p className="text-[8px] uppercase text-slate-500 font-bold">Aprovação de Campo</p>
        </div>
        <div>
          <div className="border-t-2 border-black mb-1 mx-6"></div>
          <p className="text-[10px] font-black uppercase tracking-tighter">Diretoria Executiva</p>
          <p className="text-[8px] uppercase text-slate-500 font-bold">Liberação de Pagamento</p>
        </div>
      </div>
      
      <div className="mt-10 text-center text-[7px] text-slate-400 font-black uppercase tracking-[0.3em]">
        Emitido pelo ProMeasure ERP em {new Date().toLocaleString('pt-BR')} - Documento Auditável
      </div>
    </div>
  );
};

const SummaryBox = ({ label, value, color }: any) => {
  const themes: any = {
    slate: 'bg-slate-50 border-slate-900',
    blue: 'bg-blue-50 border-blue-900',
    amber: 'bg-amber-50 border-amber-900',
    emerald: 'bg-emerald-50 border-emerald-900',
    rose: 'bg-rose-50 border-rose-900'
  };
  return (
    <div className={`p-4 border-2 rounded-2xl ${themes[color]}`}>
      <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest mb-1">{label}</p>
      <p className="text-base font-black tracking-tighter">{value}</p>
    </div>
  );
};
