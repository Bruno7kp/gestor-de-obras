
import React from 'react';
import { Project, WorkItem } from '../types';
import { financial } from '../utils/math';
import { HardHat, Ruler } from 'lucide-react';

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
  const previousTotalHeader = financial.sum(project.history?.map(h => h.totals.period) || []);

  return (
    <div className="print-only print-report-container bg-white text-black p-0">
      {/* HEADER TÉCNICO */}
      <div className="flex items-start justify-between border-b-2 border-black pb-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-black flex items-center justify-center text-white rounded">
             <HardHat size={40} />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter leading-none">{project.companyName}</h1>
            <p className="text-[10px] font-bold mt-1 uppercase text-slate-700">Departamento de Engenharia e Custos</p>
            <div className="flex items-center gap-2 mt-2 text-[9px] font-medium text-slate-600">
              <Ruler size={10} /> <span>Sistema ProMeasure v0.3</span>
            </div>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <div className="bg-black text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded">
            Boletim de Medição #{project.measurementNumber}
          </div>
          <p className="text-xs font-black uppercase mt-1">Obra: {project.name}</p>
          <p className="text-[9px] font-bold text-slate-500 uppercase">Referência: {project.referenceDate}</p>
          <p className="text-[8px] italic text-slate-400">Emitido em: {new Date().toLocaleString('pt-BR')}</p>
        </div>
      </div>

      {/* QUADRO DE RESUMO EXECUTIVO */}
      <div className="grid grid-cols-4 border border-black mb-6 bg-slate-50">
        <div className="p-2 border-r border-black">
          <label className="text-[7px] font-black uppercase text-slate-500 block mb-1">Total Contratado</label>
          <span className="text-sm font-black">{financial.formatBRL(stats.contract)}</span>
        </div>
        <div className="p-2 border-r border-black">
          <label className="text-[7px] font-black uppercase text-slate-500 block mb-1">Medição do Período</label>
          <span className="text-sm font-black text-blue-600">{financial.formatBRL(stats.current)}</span>
        </div>
        <div className="p-2 border-r border-black">
          <label className="text-[7px] font-black uppercase text-slate-500 block mb-1">Execução Acumulada</label>
          <span className="text-sm font-black text-emerald-600">{financial.formatBRL(stats.accumulated)}</span>
        </div>
        <div className="p-2">
          <label className="text-[7px] font-black uppercase text-slate-500 block mb-1">Status Físico</label>
          <span className="text-sm font-black text-indigo-600">{stats.progress.toFixed(2)}% Concluído</span>
        </div>
      </div>

      {/* TABELA DE MEDIÇÃO COMPLETA */}
      <table className="w-full border-collapse border border-black text-[7.5px]">
        <thead>
          <tr className="bg-slate-900 text-white font-black uppercase leading-none">
            <th className="border border-black p-1 w-12" rowSpan={2}>ITEM</th>
            <th className="border border-black p-1" rowSpan={2}>DESCRIÇÃO DO SERVIÇO</th>
            <th className="border border-black p-1 w-10" rowSpan={2}>UND</th>
            <th className="border border-black p-1 w-20" rowSpan={2}>PREÇO UNIT (C/BDI)</th>
            <th className="border border-black p-1 bg-slate-800" colSpan={2}>CONTRATO</th>
            <th className="border border-black p-1 bg-slate-700" colSpan={2}>ACUM. ANTERIOR</th>
            <th className="border border-black p-1 bg-blue-800" colSpan={2}>PERÍODO</th>
            <th className="border border-black p-1 bg-emerald-800" colSpan={2}>ACUM. TOTAL</th>
            <th className="border border-black p-1 bg-rose-800" colSpan={2}>SALDO</th>
            <th className="border border-black p-1 w-10" rowSpan={2}>%</th>
          </tr>
          <tr className="bg-slate-100 text-black font-bold uppercase text-[6.5px]">
            <th className="border border-black p-0.5">QTD</th>
            <th className="border border-black p-0.5">VALOR</th>
            <th className="border border-black p-0.5">QTD</th>
            <th className="border border-black p-0.5">VALOR</th>
            <th className="border border-black p-0.5">QTD</th>
            <th className="border border-black p-0.5">VALOR</th>
            <th className="border border-black p-0.5">QTD</th>
            <th className="border border-black p-0.5">VALOR</th>
            <th className="border border-black p-0.5">QTD</th>
            <th className="border border-black p-0.5">VALOR</th>
          </tr>
        </thead>
        <tbody>
          {data.map(item => (
            <tr key={item.id} className={`${item.type === 'category' ? 'bg-slate-100 font-black' : ''} border-b border-slate-300`}>
              <td className="border border-black p-1 text-center font-mono">{item.wbs}</td>
              <td className="border border-black p-1 uppercase truncate" style={{ paddingLeft: `${item.depth * 8 + 4}px` }}>
                {item.name}
              </td>
              <td className="border border-black p-1 text-center uppercase">{item.unit || '—'}</td>
              <td className="border border-black p-1 text-right">{item.type === 'item' ? financial.formatBRL(item.unitPrice).replace('R$', '') : '—'}</td>
              
              {/* Contrato */}
              <td className="border border-black p-1 text-center">{item.type === 'item' ? item.contractQuantity : '—'}</td>
              <td className="border border-black p-1 text-right">{financial.formatBRL(item.contractTotal).replace('R$', '')}</td>
              
              {/* Anterior */}
              <td className="border border-black p-1 text-center text-slate-500">{item.type === 'item' ? (item.previousQuantity || '0') : '—'}</td>
              <td className="border border-black p-1 text-right text-slate-500">{financial.formatBRL(item.previousTotal).replace('R$', '')}</td>
              
              {/* Período */}
              <td className="border border-black p-1 text-center font-bold text-blue-800">{item.type === 'item' ? (item.currentQuantity || '0') : '—'}</td>
              <td className="border border-black p-1 text-right font-bold text-blue-800">{financial.formatBRL(item.currentTotal).replace('R$', '')}</td>
              
              {/* Acumulado */}
              <td className="border border-black p-1 text-center font-bold text-emerald-800">{item.type === 'item' ? (item.accumulatedQuantity || '0') : '—'}</td>
              <td className="border border-black p-1 text-right font-bold text-emerald-800">{financial.formatBRL(item.accumulatedTotal).replace('R$', '')}</td>
              
              {/* Saldo */}
              <td className="border border-black p-1 text-center text-rose-800">{item.type === 'item' ? (item.balanceQuantity || '0') : '—'}</td>
              <td className="border border-black p-1 text-right text-rose-800">{financial.formatBRL(item.balanceTotal).replace('R$', '')}</td>
              
              <td className="border border-black p-1 text-center font-black">{item.accumulatedPercentage.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-black text-white font-black uppercase text-[8px]">
            <td colSpan={4} className="border border-black p-2 text-right">TOTAIS CONSOLIDADOS:</td>
            <td className="border border-black p-2 text-center">—</td>
            <td className="border border-black p-2 text-right">{financial.formatBRL(stats.contract).replace('R$', '')}</td>
            <td className="border border-black p-2 text-center">—</td>
            <td className="border border-black p-2 text-right opacity-70">{financial.formatBRL(previousTotalHeader).replace('R$', '')}</td>
            <td className="border border-black p-2 text-center">—</td>
            <td className="border border-black p-2 text-right text-blue-400">{financial.formatBRL(stats.current).replace('R$', '')}</td>
            <td className="border border-black p-2 text-center">—</td>
            <td className="border border-black p-2 text-right text-emerald-400">{financial.formatBRL(stats.accumulated).replace('R$', '')}</td>
            <td className="border border-black p-2 text-center">—</td>
            <td className="border border-black p-2 text-right text-rose-400">{financial.formatBRL(stats.balance).replace('R$', '')}</td>
            <td className="border border-black p-2 text-center">{stats.progress.toFixed(2)}%</td>
          </tr>
        </tfoot>
      </table>

      {/* ASSINATURAS */}
      <div className="mt-12 grid grid-cols-3 gap-12 text-center">
        <div>
          <div className="border-t border-black mb-1 mx-4"></div>
          <p className="text-[8px] font-black uppercase">Responsável Técnico (Obra)</p>
          <p className="text-[7px] uppercase">{project.companyName}</p>
        </div>
        <div>
          <div className="border-t border-black mb-1 mx-4"></div>
          <p className="text-[8px] font-black uppercase">Fiscalização / Cliente</p>
          <p className="text-[7px] uppercase">Assinatura e Data</p>
        </div>
        <div>
          <div className="border-t border-black mb-1 mx-4"></div>
          <p className="text-[8px] font-black uppercase">Gestão Administrativa</p>
          <p className="text-[7px] uppercase">Aprovação Final</p>
        </div>
      </div>
    </div>
  );
};
