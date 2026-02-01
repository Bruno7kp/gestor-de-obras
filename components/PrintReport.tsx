import React from 'react';
import { Project, WorkItem, ProjectExpense } from '../types';
import { financial } from '../utils/math';
import { HardHat } from 'lucide-react';

interface PrintReportProps {
  project: Project;
  companyName: string; 
  companyCnpj: string;
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

export const PrintReport: React.FC<PrintReportProps> = ({ project, companyName, companyCnpj, data, stats }) => {
  const theme = project.theme;

  // Motor de CSS Dinâmico para aplicação de Branding e ocupação total de página
  const dynamicStyles = `
    .print-report-area {
      font-family: '${theme.fontFamily}', sans-serif !important;
      width: 100% !important;
      max-width: none !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }
    
    .print-report-area h1, .print-report-area h2, .print-report-area h3 {
      color: ${theme.primary} !important;
    }

    .print-primary-border { border-color: ${theme.primary} !important; }
    .print-border { border-color: ${theme.border} !important; }

    .print-header-bg { 
      background-color: ${theme.header.bg} !important; 
      color: ${theme.header.text} !important; 
    }
    
    .print-accent-bg { 
      background-color: ${theme.accent} !important; 
      color: ${theme.accentText} !important; 
    }
    
    .print-accent-text { 
      color: ${theme.accent} !important; 
    }

    .print-category-bg { 
      background-color: ${theme.category.bg} !important; 
      color: ${theme.category.text} !important; 
    }
    
    .print-footer-bg { 
      background-color: ${theme.footer.bg} !important; 
      color: ${theme.footer.text} !important; 
    }

    .kpi-highlight-border { border-color: ${theme.accent} !important; }
    .kpi-highlight-bg { background-color: ${theme.accent}08 !important; }
    .kpi-highlight-text { color: ${theme.accent} !important; }

    /* Garantia de ocupação total de tabela */
    .print-report-area table {
      width: 100% !important;
      max-width: 100% !important;
      table-layout: auto !important;
    }

    /* Garantia contra cortes de página */
    table tr { page-break-inside: avoid !important; }
    .no-break { 
      page-break-inside: avoid !important; 
      break-inside: avoid !important; 
    }
  `;

  return (
    <div className="print-report-area bg-white text-black p-0 leading-tight">
      <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />
      
      {/* CABEÇALHO INSTITUCIONAL */}
      <div className="flex items-center justify-between border-b-2 print-primary-border pb-3 mb-4 no-break">
        <div className="flex items-center gap-4">
          {project.logo ? (
            <img src={project.logo} className="w-24 h-16 object-contain" alt="Logo Empresa" />
          ) : (
            <div className="w-12 h-12 bg-black text-white flex items-center justify-center rounded print-header-bg">
              <HardHat size={32} />
            </div>
          )}
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight leading-none">
              {companyName || project.companyName}
            </h1>
            <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1">
              {companyCnpj ? `CNPJ: ${companyCnpj}` : 'Gestão de Medição Técnica'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-black uppercase">Planilha de Medição</h2>
          <div className="text-[9px] font-bold">
            <span className="px-2 py-0.5 rounded mr-2 uppercase print-accent-bg">
              Medição Nº {project.measurementNumber}
            </span>
            <span className="text-slate-500 uppercase">Data: {project.referenceDate || '—'}</span>
          </div>
        </div>
      </div>

      {/* DADOS DO EMPREENDIMENTO */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-[9px] border print-border p-2 bg-slate-50 rounded no-break">
        <div>
          <label className="block text-[7px] font-black text-slate-400 uppercase">Obra</label>
          <span className="font-bold uppercase">{project.name}</span>
        </div>
        <div className="text-center">
          <label className="block text-[7px] font-black text-slate-400 uppercase">Localização / Endereço</label>
          <span className="font-bold uppercase">{project.location || '-'}</span>
        </div>
        <div className="text-right">
          <label className="block text-[7px] font-black text-slate-400 uppercase">Avanço Físico Global</label>
          <span className="font-black print-accent-text">{stats.progress.toFixed(2)}% Concluído</span>
        </div>
      </div>

      {/* TABELA DE MEDIÇÃO PADRÃO */}
      <table className="w-full text-[6.5px] border-collapse border print-border mb-6">
        <thead>
          <tr className="font-black uppercase text-center print-header-bg">
            <th rowSpan={2} className="border print-border p-1 w-8">ITEM</th>
            <th rowSpan={2} className="border print-border p-1 w-10">Cód</th>
            <th rowSpan={2} className="border print-border p-1 w-10">Fonte</th>
            <th rowSpan={2} className="border print-border p-1 text-left min-w-[150px]">Descrição</th>
            <th rowSpan={2} className="border print-border p-1 w-8">Und</th>
            <th colSpan={2} className="border print-border p-1">Unitário (R$)</th>
            <th rowSpan={2} className="border print-border p-1 w-12">Qtd. Contr.</th>
            <th rowSpan={2} className="border print-border p-1 w-20">Total Contr. (R$)</th>
            <th colSpan={2} className="border print-border p-1">Acum. Anterior</th>
            <th colSpan={2} className="border print-border p-1">Medição Período</th>
            <th colSpan={2} className="border print-border p-1">Acum. Total</th>
            <th colSpan={2} className="border print-border p-1">Saldo Reman.</th>
            <th rowSpan={2} className="border print-border p-1 w-8">% Exec..</th>
          </tr>
          <tr className="font-bold text-[6px] uppercase print-header-bg" style={{ filter: 'brightness(92%)' }}>
            <th className="border print-border p-0.5 w-14">S/ BDI</th>
            <th className="border print-border p-0.5 w-14">C/ BDI</th>
            <th className="border print-border p-0.5 w-10">Quant.</th>
            <th className="border print-border p-0.5 w-16">Total (R$)</th>
            <th className="border print-border p-0.5 w-10">Quant.</th>
            <th className="border print-border p-0.5 w-16">Total (R$)</th>
            <th className="border print-border p-0.5 w-10">Quant.</th>
            <th className="border print-border p-0.5 w-16">Total (R$)</th>
            <th className="border print-border p-0.5 w-10">Quant.</th>
            <th className="border print-border p-0.5 w-16">Total (R$)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const isCategory = item.type === 'category';

            return (
              <tr key={item.id} className={`${isCategory ? 'print-category-bg font-bold' : ''} border-b print-border text-center`}>
                <td className="border print-border p-1 font-mono text-[7px]">{item.wbs}</td>
                <td className="border print-border p-1">{item.cod || '-'}</td>
                <td className="border print-border p-1 uppercase">{item.fonte || '-'}</td>
                <td className="border print-border p-1 text-left uppercase">{item.name.trim()}</td>
                <td className="border print-border p-1 font-bold">{item.unit || '-'}</td>
                
                <td className="border print-border p-1 text-right">
                  {!isCategory ? financial.formatVisual(item.unitPriceNoBdi) : '-'}
                </td>
                <td className="border print-border p-1 text-right font-bold">
                  {!isCategory ? financial.formatVisual(item.unitPrice) : '-'}
                </td>

                <td className="border print-border p-1">
                  {!isCategory ? item.contractQuantity : '-'}
                </td>
                <td className="border print-border p-1 text-right font-bold">
                  {financial.formatVisual(item.contractTotal)}
                </td>

                <td className="border print-border p-1 bg-slate-50/50">
                  {!isCategory ? item.previousQuantity : '-'}
                </td>
                <td className="border print-border p-1 text-right bg-slate-50/50">
                  {financial.formatVisual(item.previousTotal)}
                </td>

                {/* REALCE DINÂMICO DE MEDIÇÃO */}
                <td className="border print-border p-1 print-accent-text font-black" style={{ backgroundColor: theme.accent + '08' }}>
                  {!isCategory ? item.currentQuantity : '-'}
                </td>
                <td className="border print-border p-1 text-right print-accent-text font-black" style={{ backgroundColor: theme.accent + '08' }}>
                  {financial.formatVisual(item.currentTotal)}
                </td>

                <td className="border print-border p-1 bg-slate-50/50 font-bold">
                  {!isCategory ? item.accumulatedQuantity : '-'}
                </td>
                <td className="border print-border p-1 text-right bg-slate-50/50 font-bold">
                  {financial.formatVisual(item.accumulatedTotal)}
                </td>

                <td className="border print-border p-1">
                  {!isCategory ? item.balanceQuantity : '-'}
                </td>
                <td className="border print-border p-1 text-right">
                  {financial.formatVisual(item.balanceTotal)}
                </td>

                <td className="border print-border p-1 font-black">
                  {item.accumulatedPercentage.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-black uppercase text-[8px] print-footer-bg">
            <td colSpan={8} className="border print-border p-2 text-right">Consolidado Geral da Medição</td>
            <td className="border print-border p-2 text-right">{financial.formatVisual(stats.contract)}</td>
            <td className="border print-border p-2"></td>
            <td className="border print-border p-2 text-right">{financial.formatVisual(stats.accumulated - stats.current)}</td>
            <td className="border print-border p-2" style={{ opacity: 0.3 }}></td>
            <td className="border print-border p-2 text-right" style={{ opacity: 0.8 }}>{financial.formatVisual(stats.current)}</td>
            <td className="border print-border p-2"></td>
            <td className="border print-border p-2 text-right">{financial.formatVisual(stats.accumulated)}</td>
            <td className="border print-border p-2"></td>
            <td className="border print-border p-2 text-right">{financial.formatVisual(stats.balance)}</td>
            <td className="border print-border p-2 text-center">{stats.progress.toFixed(1)}%</td>
          </tr>
        </tfoot>
      </table>

      {/* DASHBOARD DE KPI NO RODAPÉ */}
      <div className="grid grid-cols-4 gap-4 mb-8 no-break">
        <div className="p-3 border print-border rounded flex flex-col items-center">
          <span className="text-[7px] font-black uppercase opacity-60">Valor Total Contrato</span>
          <span className="text-xs font-black">{financial.formatBRL(stats.contract)}</span>
        </div>
        <div className="p-3 border-2 kpi-highlight-border kpi-highlight-bg rounded flex flex-col items-center">
          <span className="text-[7px] font-black uppercase kpi-highlight-text">Medição do Período</span>
          <span className="text-xs font-black kpi-highlight-text">{financial.formatBRL(stats.current)}</span>
        </div>
        <div className="p-3 border print-border rounded flex flex-col items-center">
          <span className="text-[7px] font-black uppercase opacity-60">Acumulado Atual</span>
          <span className="text-xs font-black">{financial.formatBRL(stats.accumulated)}</span>
        </div>
        <div className="p-3 border print-border rounded flex flex-col items-center">
          <span className="text-[7px] font-black uppercase opacity-60">Saldo a Executar</span>
          <span className="text-xs font-black">{financial.formatBRL(stats.balance)}</span>
        </div>
      </div>

      {/* CAMPOS DE ASSINATURA */}
      <div className="mt-12 grid grid-cols-3 gap-8 text-center no-break">
        <div className="space-y-1">
          <div className="border-t print-border w-48 mx-auto"></div>
          <p className="text-[8px] font-black uppercase">Responsável Técnico</p>
          <p className="text-[7px] font-bold text-slate-500 tracking-tighter">CREA/CAU: __________________</p>
        </div>
        <div className="space-y-1">
          <div className="border-t print-border w-48 mx-auto"></div>
          <p className="text-[8px] font-black uppercase">Fiscalização / Contratante</p>
          <p className="text-[7px] font-bold text-slate-500 tracking-tighter">Assinatura e Carimbo</p>
        </div>
        <div className="space-y-1">
          <div className="border-t print-border w-48 mx-auto"></div>
          <p className="text-[8px] font-black uppercase">Gestor do Contrato</p>
          <p className="text-[7px] font-bold text-slate-500 tracking-tighter">Liberação Financeira</p>
        </div>
      </div>
    </div>
  );
};