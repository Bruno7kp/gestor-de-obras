
import React from 'react';
import { Project, WorkItem } from '../types';
import { financial } from '../utils/math';
import { HardHat } from 'lucide-react';

interface PrintReportProps {
  project: Project;
  data: (WorkItem & { depth: number })[];
  stats: {
    contract: number;
    current: number;
    accumulated: number;
    balance: number;
    progress: number;
  };
}

export const PrintReport: React.FC<PrintReportProps> = ({ project, data, stats }) => {
  // Cálculo de acumulado anterior geral para exibição
  const previousTotalHeader = financial.sum(project.history?.map(h => h.totals.period) || []);

  return (
    <div className="print-only font-sans p-2">
      {/* CABEÇALHO INSTITUCIONAL (Layout Anterior) */}
      <div className="print-header flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-black flex items-center justify-center text-white rounded shadow-sm">
            <HardHat size={32} />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase leading-tight tracking-tighter">{project.companyName}</h1>
            <p className="text-xs font-bold text-slate-600">SISTEMA INTEGRADO DE MEDIÇÃO DE OBRAS</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-black uppercase tracking-tight">Boletim de Medição</h2>
          <p className="text-sm font-bold">MEDICÃO Nº: {project.measurementNumber}</p>
          <p className="text-[10px] font-medium text-slate-500 uppercase">REFERÊNCIA: {project.referenceDate}</p>
        </div>
      </div>

      {/* DADOS DO PROJETO (Grid 3 Colunas) */}
      <div className="grid grid-cols-3 gap-4 mb-6 border p-4 bg-slate-50 rounded">
        <div>
          <label className="text-[8px] font-black uppercase text-slate-500 block">Empreendimento</label>
          <span className="text-xs font-bold uppercase">{project.name}</span>
        </div>
        <div>
          <label className="text-[8px] font-black uppercase text-slate-500 block">Status da Obra</label>
          <span className="text-xs font-bold">{stats.progress.toFixed(2)}% Concluído</span>
        </div>
        <div>
          <label className="text-[8px] font-black uppercase text-slate-500 block">Emitido em</label>
          <span className="text-xs font-bold">{new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</span>
        </div>
      </div>

      {/* TABELA DE MEDIÇÃO (Estrutura Detalhada do PDF) */}
      <table className="print-table mb-8 w-full border-collapse border border-black">
        <thead className="bg-slate-900 text-white uppercase text-[6px] font-black">
          <tr>
            <th rowSpan={2} className="border border-black p-1 w-8">ITEM</th>
            <th rowSpan={2} className="border border-black p-1 w-12">CÓD</th>
            <th rowSpan={2} className="border border-black p-1 w-12">FONTE</th>
            <th rowSpan={2} className="border border-black p-1">DESCRIÇÃO DOS SERVIÇOS</th>
            <th rowSpan={2} className="border border-black p-1 w-10">UND</th>
            <th rowSpan={2} className="border border-black p-1 w-14">UNIT (S/BDI)</th>
            <th rowSpan={2} className="border border-black p-1 w-14">UNIT (C/BDI)</th>
            <th rowSpan={2} className="border border-black p-1 w-14">QTD. CONTRATADO</th>
            <th rowSpan={2} className="border border-black p-1 w-20">TOTAL CONTRATADO</th>
            <th colSpan={2} className="border border-black p-1 bg-slate-800">ACUM. ANTERIOR</th>
            <th colSpan={2} className="border border-black p-1 bg-blue-900">MEDIÇÃO ATUAL</th>
            <th colSpan={2} className="border border-black p-1 bg-emerald-900">ACUM. TOTAL</th>
            <th colSpan={2} className="border border-black p-1 bg-rose-900">SALDO</th>
            <th rowSpan={2} className="border border-black p-1 w-10">% EXEC.</th>
          </tr>
          <tr className="bg-slate-800">
            <th className="border border-black p-0.5 text-[5px]">QTD</th>
            <th className="border border-black p-0.5 text-[5px]">TOTAL (R$)</th>
            <th className="border border-black p-0.5 text-[5px] bg-blue-800">QTD</th>
            <th className="border border-black p-0.5 text-[5px] bg-blue-800">TOTAL (R$)</th>
            <th className="border border-black p-0.5 text-[5px] bg-emerald-800">QTD</th>
            <th className="border border-black p-0.5 text-[5px] bg-emerald-800">TOTAL (R$)</th>
            <th className="border border-black p-0.5 text-[5px] bg-rose-800">QTD</th>
            <th className="border border-black p-0.5 text-[5px] bg-rose-800">TOTAL (R$)</th>
          </tr>
        </thead>
        <tbody className="text-[6.5px]">
          {data.map(item => (
            <tr key={item.id} className={`${item.type === 'category' ? 'bg-slate-100 font-bold' : ''} break-inside-avoid`}>
              <td className="border border-black text-center font-mono">{item.wbs}</td>
              <td className="border border-black text-center">{item.cod || '—'}</td>
              <td className="border border-black text-center uppercase">{item.fonte || '—'}</td>
              <td className="border border-black text-left px-1 uppercase" style={{ paddingLeft: `${item.depth * 8 + 4}px` }}>
                {item.name}
              </td>
              <td className="border border-black text-center uppercase">{item.unit || '—'}</td>
              <td className="border border-black text-right">{item.type === 'item' ? financial.formatBRL(item.unitPriceNoBdi).replace('R$', '') : '—'}</td>
              <td className="border border-black text-right">{item.type === 'item' ? financial.formatBRL(item.unitPrice).replace('R$', '') : '—'}</td>
              <td className="border border-black text-center">{item.type === 'item' ? item.contractQuantity : '—'}</td>
              <td className="border border-black text-right">{financial.formatBRL(item.contractTotal).replace('R$', '')}</td>
              
              <td className="border border-black text-center text-slate-500">{item.type === 'item' ? (item.previousQuantity || '—') : '—'}</td>
              <td className="border border-black text-right text-slate-500">{financial.formatBRL(item.previousTotal).replace('R$', '')}</td>
              
              <td className="border border-black text-center font-bold">{item.type === 'item' ? (item.currentQuantity || '—') : '—'}</td>
              <td className="border border-black text-right font-bold">{financial.formatBRL(item.currentTotal).replace('R$', '')}</td>
              
              <td className="border border-black text-center font-bold bg-slate-50">{item.type === 'item' ? (item.accumulatedQuantity || '—') : '—'}</td>
              <td className="border border-black text-right font-bold bg-slate-50">{financial.formatBRL(item.accumulatedTotal).replace('R$', '')}</td>
              
              <td className="border border-black text-center text-slate-400">{item.type === 'item' ? (item.balanceQuantity || '—') : '—'}</td>
              <td className="border border-black text-right text-slate-400">{financial.formatBRL(item.balanceTotal).replace('R$', '')}</td>
              
              <td className="border border-black text-center font-black">
                {item.accumulatedPercentage.toFixed(1)}%
              </td>
            </tr>
          ))}
          {/* RODAPÉ FINANCEIRO (Totais Consolidados) */}
          <tr className="bg-black text-white font-black uppercase text-[7px]">
            <td colSpan={8} className="border border-black p-2 text-right">TOTAL GERAL CONSOLIDADO:</td>
            <td className="border border-black p-2 text-right">{financial.formatBRL(stats.contract)}</td>
            <td className="border border-black p-2 text-center">—</td>
            <td className="border border-black p-2 text-right">{financial.formatBRL(previousTotalHeader)}</td>
            <td className="border border-black p-2 text-center">—</td>
            <td className="border border-black p-2 text-right text-blue-400">{financial.formatBRL(stats.current)}</td>
            <td className="border border-black p-2 text-center">—</td>
            <td className="border border-black p-2 text-right text-emerald-400">{financial.formatBRL(stats.accumulated)}</td>
            <td className="border border-black p-2 text-center">—</td>
            <td className="border border-black p-2 text-right text-rose-400">{financial.formatBRL(stats.balance)}</td>
            <td className="border border-black p-2 text-center">{stats.progress.toFixed(2)}%</td>
          </tr>
        </tbody>
      </table>

      {/* QUADRO DE RESUMO FINAL (Layout Anterior) */}
      <div className="signature-box grid grid-cols-4 gap-4 mb-12 no-break">
        <div className="border border-slate-200 p-4 text-center rounded bg-slate-50">
          <p className="text-[8px] font-black uppercase text-slate-500 mb-2">Valor Contrato</p>
          <p className="text-sm font-black">{financial.formatBRL(stats.contract)}</p>
        </div>
        <div className="border border-blue-200 p-4 text-center rounded bg-blue-50">
          <p className="text-[8px] font-black uppercase text-blue-500 mb-2">Medição Atual</p>
          <p className="text-sm font-black text-blue-700">{financial.formatBRL(stats.current)}</p>
        </div>
        <div className="border border-emerald-200 p-4 text-center rounded bg-emerald-50">
          <p className="text-[8px] font-black uppercase text-emerald-500 mb-2">Acumulado Total</p>
          <p className="text-sm font-black text-emerald-700">{financial.formatBRL(stats.accumulated)}</p>
        </div>
        <div className="border border-rose-200 p-4 text-center rounded bg-rose-50">
          <p className="text-[8px] font-black uppercase text-rose-500 mb-2">Saldo Remanescente</p>
          <p className="text-sm font-black text-rose-700">{financial.formatBRL(stats.balance)}</p>
        </div>
      </div>

      {/* ASSINATURAS (Layout Anterior) */}
      <div className="signature-box grid grid-cols-3 gap-12 mt-16 break-inside-avoid">
        <div className="text-center">
          <div className="border-t border-black mb-2"></div>
          <p className="text-[9px] font-black uppercase tracking-tight">Responsável Técnico</p>
          <p className="text-[7px] text-slate-500 uppercase">{project.companyName}</p>
        </div>
        <div className="text-center">
          <div className="border-t border-black mb-2"></div>
          <p className="text-[9px] font-black uppercase tracking-tight">Fiscalização / Cliente</p>
          <p className="text-[7px] text-slate-500 uppercase">Assinatura e Carimbo</p>
        </div>
        <div className="text-center">
          <div className="border-t border-black mb-2"></div>
          <p className="text-[9px] font-black uppercase tracking-tight">Gestão do Contrato</p>
          <p className="text-[7px] text-slate-500 uppercase">Data: ____/____/____</p>
        </div>
      </div>
    </div>
  );
};
