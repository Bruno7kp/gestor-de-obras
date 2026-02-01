
import React from 'react';
import { Project, WorkItem, ProjectExpense } from '../types';
import { financial } from '../utils/math';
import { HardHat, Ruler } from 'lucide-react';

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

export const PrintReport: React.FC<PrintReportProps> = ({ project, data, stats }) => {
  return (
    <div className="print-report-area bg-white text-black p-0 leading-tight">
      {/* CABEÇALHO INSTITUCIONAL */}
      <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
        <div className="flex items-center gap-4">
          {project.logo ? (
            <img src={project.logo} className="w-16 h-16 object-contain" />
          ) : (
            <div className="w-12 h-12 bg-black text-white flex items-center justify-center rounded">
              <HardHat size={32} />
            </div>
          )}
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight leading-none">{project.companyName}</h1>
            <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1">Gestão Integrada de Medição de Obras</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-black uppercase">Planilha de Medição</h2>
          <div className="text-[9px] font-bold">
            <span className="bg-black text-white px-2 py-0.5 rounded mr-2 uppercase">Medição Nº {project.measurementNumber}</span>
            <span className="text-slate-500 uppercase">Data: {project.referenceDate}</span>
          </div>
        </div>
      </div>

      {/* DADOS DO EMPREENDIMENTO */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-[9px] border border-black p-2 bg-slate-50 rounded">
        <div>
          <label className="block text-[7px] font-black text-slate-400 uppercase">Empreendimento</label>
          <span className="font-bold uppercase">{project.name}</span>
        </div>
        <div className="text-center">
          <label className="block text-[7px] font-black text-slate-400 uppercase">Data de Referência</label>
          <span className="font-bold">{project.referenceDate}</span>
        </div>
        <div className="text-right">
          <label className="block text-[7px] font-black text-slate-400 uppercase">Status Físico Global</label>
          <span className="font-black text-blue-700">{stats.progress.toFixed(2)}% Concluído</span>
        </div>
      </div>

      {/* TABELA DE MEDIÇÃO PADRÃO ANEXO */}
      <table className="w-full text-[6.5px] border-collapse border border-black mb-6">
        <thead>
          <tr className="bg-slate-900 text-white font-black uppercase text-center">
            <th rowSpan={2} className="border border-black p-1 w-8">Item</th>
            <th rowSpan={2} className="border border-black p-1 w-10">Cód</th>
            <th rowSpan={2} className="border border-black p-1 w-10">Fonte</th>
            <th rowSpan={2} className="border border-black p-1 text-left min-w-[150px]">Descrição</th>
            <th rowSpan={2} className="border border-black p-1 w-8">Und</th>
            <th colSpan={2} className="border border-black p-1">Unitário (R$)</th>
            <th rowSpan={2} className="border border-black p-1 w-12">Qtd. Contratado</th>
            <th rowSpan={2} className="border border-black p-1 w-20">Total (R$) Contratado</th>
            <th colSpan={2} className="border border-black p-1 bg-slate-800">Acum. Anterior</th>
            <th colSpan={2} className="border border-black p-1 bg-blue-600">Medição do Período</th>
            <th colSpan={2} className="border border-black p-1 bg-slate-800">Acum. Total</th>
            <th colSpan={2} className="border border-black p-1 bg-slate-800">Saldo a Realizar</th>
            <th rowSpan={2} className="border border-black p-1 w-8">% Exec.</th>
          </tr>
          <tr className="bg-slate-800 text-white font-bold text-[6px] uppercase">
            <th className="border border-black p-0.5 w-14">S/ BDI</th>
            <th className="border border-black p-0.5 w-14">C/ BDI</th>
            <th className="border border-black p-0.5 w-10">Quant.</th>
            <th className="border border-black p-0.5 w-16">Total (R$)</th>
            <th className="border border-black p-0.5 w-10 bg-blue-500">Quant.</th>
            <th className="border border-black p-0.5 w-16 bg-blue-500">Total (R$)</th>
            <th className="border border-black p-0.5 w-10">Quant.</th>
            <th className="border border-black p-0.5 w-16">Total (R$)</th>
            <th className="border border-black p-0.5 w-10">Quant.</th>
            <th className="border border-black p-0.5 w-16">Total (R$)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const isCategory = item.type === 'category';
            const rowClass = isCategory ? 'bg-slate-100 font-bold' : '';

            return (
              <tr key={item.id} className={`${rowClass} border-b border-black text-center`}>
                <td className="border border-black p-1 font-mono text-[7px]">{item.wbs}</td>
                <td className="border border-black p-1">{item.cod || '-'}</td>
                <td className="border border-black p-1 uppercase">{item.fonte || '-'}</td>
                <td className="border border-black p-1 text-left uppercase" style={{ paddingLeft: `${item.depth * 8 + 4}px` }}>
                  {item.name}
                </td>
                <td className="border border-black p-1 font-bold">{item.unit || '-'}</td>
                
                {/* PREÇOS UNITÁRIOS */}
                <td className="border border-black p-1 text-right">
                  {!isCategory ? financial.formatVisual(item.unitPriceNoBdi) : '-'}
                </td>
                <td className="border border-black p-1 text-right font-bold">
                  {!isCategory ? financial.formatVisual(item.unitPrice) : '-'}
                </td>

                {/* CONTRATO */}
                <td className="border border-black p-1">
                  {!isCategory ? item.contractQuantity : '-'}
                </td>
                <td className="border border-black p-1 text-right font-bold">
                  {financial.formatVisual(item.contractTotal)}
                </td>

                {/* ANTERIOR */}
                <td className="border border-black p-1 bg-slate-50">
                  {!isCategory ? item.previousQuantity : '-'}
                </td>
                <td className="border border-black p-1 text-right bg-slate-50">
                  {financial.formatVisual(item.previousTotal)}
                </td>

                {/* PERÍODO CORRENTE (Destaque Azul) */}
                <td className="border border-black p-1 bg-blue-50 font-black text-blue-700">
                  {!isCategory ? item.currentQuantity : '-'}
                </td>
                <td className="border border-black p-1 text-right bg-blue-50 font-black text-blue-700">
                  {financial.formatVisual(item.currentTotal)}
                </td>

                {/* ACUMULADO TOTAL */}
                <td className="border border-black p-1 bg-slate-50 font-bold">
                  {!isCategory ? item.accumulatedQuantity : '-'}
                </td>
                <td className="border border-black p-1 text-right bg-slate-50 font-bold">
                  {financial.formatVisual(item.accumulatedTotal)}
                </td>

                {/* SALDO A REALIZAR */}
                <td className="border border-black p-1">
                  {!isCategory ? item.balanceQuantity : '-'}
                </td>
                <td className="border border-black p-1 text-right">
                  {financial.formatVisual(item.balanceTotal)}
                </td>

                {/* % EXEC */}
                <td className="border border-black p-1 font-black">
                  {item.accumulatedPercentage.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-900 text-white font-black uppercase text-[8px]">
            <td colSpan={8} className="border border-black p-2 text-right">Totais Gerais da Medição</td>
            <td className="border border-black p-2 text-right">{financial.formatVisual(stats.contract)}</td>
            <td className="border border-black p-2"></td>
            <td className="border border-black p-2 text-right">{financial.formatVisual(stats.accumulated - stats.current)}</td>
            <td className="border border-black p-2 bg-blue-700"></td>
            <td className="border border-black p-2 text-right bg-blue-700">{financial.formatVisual(stats.current)}</td>
            <td className="border border-black p-2"></td>
            <td className="border border-black p-2 text-right">{financial.formatVisual(stats.accumulated)}</td>
            <td className="border border-black p-2"></td>
            <td className="border border-black p-2 text-right">{financial.formatVisual(stats.balance)}</td>
            <td className="border border-black p-2 text-center">{stats.progress.toFixed(1)}%</td>
          </tr>
        </tfoot>
      </table>

      {/* DASHBOARD DE KPI RESUMIDO NO RODAPÉ */}
      <div className="grid grid-cols-4 gap-4 mb-8 no-break">
        <div className="p-3 border-2 border-black rounded flex flex-col items-center">
          <span className="text-[7px] font-black uppercase opacity-60">Valor Total Contrato</span>
          <span className="text-xs font-black">{financial.formatBRL(stats.contract)}</span>
        </div>
        <div className="p-3 border-2 border-blue-600 bg-blue-50 rounded flex flex-col items-center">
          <span className="text-[7px] font-black uppercase text-blue-600">Medição do Período</span>
          <span className="text-xs font-black text-blue-700">{financial.formatBRL(stats.current)}</span>
        </div>
        <div className="p-3 border-2 border-black rounded flex flex-col items-center">
          <span className="text-[7px] font-black uppercase opacity-60">Acumulado Atual</span>
          <span className="text-xs font-black">{financial.formatBRL(stats.accumulated)}</span>
        </div>
        <div className="p-3 border-2 border-black rounded flex flex-col items-center">
          <span className="text-[7px] font-black uppercase opacity-60">Saldo a Executar</span>
          <span className="text-xs font-black">{financial.formatBRL(stats.balance)}</span>
        </div>
      </div>

      {/* CAMPOS DE ASSINATURA */}
      <div className="mt-12 grid grid-cols-3 gap-8 text-center no-break">
        <div className="space-y-1">
          <div className="border-t border-black w-48 mx-auto"></div>
          <p className="text-[8px] font-black uppercase">Responsável Técnico</p>
          <p className="text-[7px] font-bold text-slate-500 tracking-tighter">CREA/CAU: __________________</p>
        </div>
        <div className="space-y-1">
          <div className="border-t border-black w-48 mx-auto"></div>
          <p className="text-[8px] font-black uppercase">Fiscalização</p>
          <p className="text-[7px] font-bold text-slate-500 tracking-tighter">Assinatura e Carimbo</p>
        </div>
        <div className="space-y-1">
          <div className="border-t border-black w-48 mx-auto"></div>
          <p className="text-[8px] font-black uppercase">Gestor do Contrato</p>
          <p className="text-[7px] font-bold text-slate-500 tracking-tighter">Liberação Financeira</p>
        </div>
      </div>
      
      <div className="mt-8 text-center text-[6px] text-slate-400 font-bold uppercase">
        Relatório gerado pelo sistema ProMeasure PRO v4.0 - Documento para fins de medição e faturamento físico-financeiro.
      </div>
    </div>
  );
};
