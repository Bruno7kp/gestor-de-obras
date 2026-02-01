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

  // CSS Técnico para Impressão de Alta Precisão
  const dynamicStyles = `
    .print-report-area {
      font-family: '${theme.fontFamily}', sans-serif !important;
      font-size: 8pt !important;
      color: #000 !important;
      width: 100% !important;
    }
    
    .print-report-area h1 { font-size: 14pt !important; font-weight: 900 !important; color: ${theme.primary} !important; }
    .print-report-area h2 { font-size: 12pt !important; font-weight: 800 !important; color: ${theme.primary} !important; }

    .print-border { border: 0.5pt solid ${theme.border} !important; }
    .print-primary-border { border-bottom: 2pt solid ${theme.primary} !important; }

    .print-header-bg { 
      background-color: ${theme.header.bg} !important; 
      color: ${theme.header.text} !important; 
      -webkit-print-color-adjust: exact !important;
    }
    
    .print-accent-bg { 
      background-color: ${theme.accent} !important; 
      color: ${theme.accentText} !important; 
      -webkit-print-color-adjust: exact !important;
    }
    
    .print-accent-text { color: ${theme.accent} !important; }

    .print-category-bg { 
      background-color: ${theme.category.bg} !important; 
      color: ${theme.category.text} !important; 
      -webkit-print-color-adjust: exact !important;
    }
    
    .print-footer-bg { 
      background-color: ${theme.footer.bg} !important; 
      color: ${theme.footer.text} !important; 
      -webkit-print-color-adjust: exact !important;
    }

    /* Dimensionamento de Células */
    .print-report-area table td, .print-report-area table th {
      padding: 2pt 3pt !important;
      vertical-align: middle !important;
      border: 0.2pt solid ${theme.border} !important;
      font-size: 6pt !important;
      line-height: 1.1 !important;
    }

    .col-wbs { width: 25pt !important; text-align: center !important; }
    .col-cod { width: 35pt !important; text-align: center !important; }
    .col-fonte { width: 35pt !important; text-align: center !important; }
    .col-desc { min-width: 120pt !important; text-align: left !important; }
    .col-unit { width: 20pt !important; text-align: center !important; }
    .col-val { width: 45pt !important; text-align: right !important; }
    .col-qty { width: 30pt !important; text-align: center !important; }

    .kpi-box {
      border: 1pt solid ${theme.border} !important;
      padding: 6pt !important;
      text-align: center !important;
    }

    .kpi-highlight {
      border: 1.5pt solid ${theme.accent} !important;
      background-color: ${theme.accent}08 !important;
      color: ${theme.accent} !important;
    }
  `;

  return (
    <div className="print-report-area bg-white text-black p-0">
      <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />
      
      {/* CABEÇALHO PRINCIPAL */}
      <div className="flex items-center justify-between print-primary-border pb-4 mb-4 no-break">
        <div className="flex items-center gap-6">
          {project.logo ? (
            <img src={project.logo} className="h-16 w-auto object-contain" alt="Logo" />
          ) : (
            <div className="w-14 h-14 print-header-bg flex items-center justify-center rounded">
              <HardHat size={36} />
            </div>
          )}
          <div>
            <h1 className="uppercase tracking-tighter leading-none m-0">
              {companyName || project.companyName}
            </h1>
            <p className="text-[7pt] font-bold text-slate-600 uppercase tracking-widest mt-1 m-0">
              {companyCnpj ? `CNPJ: ${companyCnpj}` : 'Relatório Técnico de Medição'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="uppercase m-0">Folha de Medição</h2>
          <div className="mt-1">
            <span className="px-3 py-1 rounded font-black print-accent-bg text-[7pt]">
              MEDIÇÃO Nº {project.measurementNumber}
            </span>
            <span className="text-slate-500 font-bold ml-4 text-[7pt]">DATA: {project.referenceDate || '—'}</span>
          </div>
        </div>
      </div>

      {/* QUADRO DE INFORMAÇÕES DA OBRA */}
      <div className="grid grid-cols-3 gap-0 mb-4 print-border no-break">
        <div className="p-2 border-r print-border">
          <label className="block text-[5pt] font-black text-slate-400 uppercase">Empreendimento</label>
          <span className="font-bold uppercase text-[8pt]">{project.name}</span>
        </div>
        <div className="p-2 border-r print-border text-center">
          <label className="block text-[5pt] font-black text-slate-400 uppercase">Localização</label>
          <span className="font-bold uppercase text-[7pt]">{project.location || 'Não Informada'}</span>
        </div>
        <div className="p-2 text-right">
          <label className="block text-[5pt] font-black text-slate-400 uppercase">Status Físico</label>
          <span className="font-black print-accent-text text-[9pt]">{stats.progress.toFixed(2)}% Concluído</span>
        </div>
      </div>

      {/* TABELA DE DADOS TÉCNICOS */}
      <table className="w-full">
        <thead>
          <tr className="print-header-bg font-black uppercase text-center">
            <th rowSpan={2} className="col-wbs">ITEM</th>
            <th rowSpan={2} className="col-cod">CÓDIGO</th>
            <th rowSpan={2} className="col-fonte">FONTE</th>
            <th rowSpan={2} className="col-desc">DESCRIÇÃO DOS SERVIÇOS</th>
            <th rowSpan={2} className="col-unit">UND</th>
            <th colSpan={2}>UNITÁRIO (R$)</th>
            <th rowSpan={2} className="col-qty">QTD. CONTR.</th>
            <th rowSpan={2} className="col-val">TOTAL CONTR.</th>
            <th colSpan={2}>ACUM. ANTERIOR</th>
            <th colSpan={2}>NO PERÍODO</th>
            <th colSpan={2}>ACUM. TOTAL</th>
            <th rowSpan={2} className="col-qty">%</th>
          </tr>
          <tr className="print-header-bg font-bold text-[5pt] text-center">
            <th className="col-val">S/ BDI</th>
            <th className="col-val">C/ BDI</th>
            <th className="col-qty">QTD.</th>
            <th className="col-val">VALOR</th>
            <th className="col-qty">QTD.</th>
            <th className="col-val">VALOR</th>
            <th className="col-qty">QTD.</th>
            <th className="col-val">VALOR</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const isCategory = item.type === 'category';
            return (
              <tr key={item.id} className={`${isCategory ? 'print-category-bg font-black' : ''}`}>
                <td className="col-wbs font-mono">{item.wbs}</td>
                <td className="col-cod">{item.cod || '-'}</td>
                <td className="col-fonte uppercase">{item.fonte || '-'}</td>
                <td className="col-desc uppercase" style={{ paddingLeft: isCategory ? '3pt' : '10pt' }}>
                  {item.name.trim()}
                </td>
                <td className="col-unit font-bold">{item.unit || '-'}</td>
                
                <td className="col-val">{!isCategory ? financial.formatVisual(item.unitPriceNoBdi) : '-'}</td>
                <td className="col-val font-bold">{!isCategory ? financial.formatVisual(item.unitPrice) : '-'}</td>

                <td className="col-qty">{!isCategory ? item.contractQuantity : '-'}</td>
                <td className="col-val font-black">{financial.formatVisual(item.contractTotal)}</td>

                <td className="col-qty">{!isCategory ? item.previousQuantity : '-'}</td>
                <td className="col-val">{financial.formatVisual(item.previousTotal)}</td>

                {/* REALCE DO PERÍODO */}
                <td className="col-qty font-black print-accent-text" style={{ backgroundColor: theme.accent + '08' }}>
                  {!isCategory ? item.currentQuantity : '-'}
                </td>
                <td className="col-val font-black print-accent-text" style={{ backgroundColor: theme.accent + '08' }}>
                  {financial.formatVisual(item.currentTotal)}
                </td>

                <td className="col-qty font-bold">{!isCategory ? item.accumulatedQuantity : '-'}</td>
                <td className="col-val font-bold">{financial.formatVisual(item.accumulatedTotal)}</td>

                <td className="col-qty font-black text-center">{item.accumulatedPercentage.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="print-footer-bg font-black uppercase text-[7pt]">
            <td colSpan={8} className="text-right">TOTAIS CONSOLIDADOS DA OBRA:</td>
            <td className="text-right">{financial.formatVisual(stats.contract)}</td>
            <td></td>
            <td className="text-right">{financial.formatVisual(stats.accumulated - stats.current)}</td>
            <td></td>
            <td className="text-right">{financial.formatVisual(stats.current)}</td>
            <td></td>
            <td className="text-right">{financial.formatVisual(stats.accumulated)}</td>
            <td className="text-center">{stats.progress.toFixed(1)}%</td>
          </tr>
        </tfoot>
      </table>

      {/* DASHBOARD KPI DO DOCUMENTO */}
      <div className="grid grid-cols-4 gap-4 mt-6 no-break">
        <div className="kpi-box">
          <div className="text-[5pt] font-black uppercase opacity-50 mb-1">Total do Contrato</div>
          <div className="text-[10pt] font-black">{financial.formatBRL(stats.contract)}</div>
        </div>
        <div className="kpi-box kpi-highlight">
          <div className="text-[5pt] font-black uppercase mb-1">Medição do Período</div>
          <div className="text-[10pt] font-black">{financial.formatBRL(stats.current)}</div>
        </div>
        <div className="kpi-box">
          <div className="text-[5pt] font-black uppercase opacity-50 mb-1">Acumulado Atual</div>
          <div className="text-[10pt] font-black">{financial.formatBRL(stats.accumulated)}</div>
        </div>
        <div className="kpi-box">
          <div className="text-[5pt] font-black uppercase opacity-50 mb-1">Saldo a Executar</div>
          <div className="text-[10pt] font-black">{financial.formatBRL(stats.balance)}</div>
        </div>
      </div>

      {/* BLOCO DE ASSINATURAS E RESPONSABILIDADE */}
      <div className="mt-12 grid grid-cols-3 gap-10 text-center no-break">
        <div className="space-y-1">
          <div className="border-t border-black w-full mb-2"></div>
          <p className="text-[7pt] font-black uppercase m-0">RESPONSÁVEL TÉCNICO (CONTRATADA)</p>
          <p className="text-[6pt] text-slate-500 font-bold m-0">NOME / CREA / CAU</p>
        </div>
        <div className="space-y-1">
          <div className="border-t border-black w-full mb-2"></div>
          <p className="text-[7pt] font-black uppercase m-0">FISCALIZAÇÃO (CONTRATANTE)</p>
          <p className="text-[6pt] text-slate-500 font-bold m-0">ASSINATURA E CARIMBO</p>
        </div>
        <div className="space-y-1">
          <div className="border-t border-black w-full mb-2"></div>
          <p className="text-[7pt] font-black uppercase m-0">APROVAÇÃO FINANCEIRA</p>
          <p className="text-[6pt] text-slate-500 font-bold m-0">CONFORMIDADE DE MEDIÇÃO</p>
        </div>
      </div>
    </div>
  );
};