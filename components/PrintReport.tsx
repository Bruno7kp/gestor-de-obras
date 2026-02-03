import React from 'react';
import { Project, WorkItem, ProjectExpense, DEFAULT_THEME } from '../types';
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
  const theme = {
    ...DEFAULT_THEME,
    ...project.theme,
    header: { ...DEFAULT_THEME.header, ...(project.theme?.header || {}) },
    category: { ...DEFAULT_THEME.category, ...(project.theme?.category || {}) },
    footer: { ...DEFAULT_THEME.footer, ...(project.theme?.footer || {}) },
    kpiHighlight: { ...DEFAULT_THEME.kpiHighlight, ...(project.theme?.kpiHighlight || {}) }
  };

  const currencySymbol = theme.currencySymbol || 'R$';

  const finalStats = {
    ...stats,
    contract: project.contractTotalOverride ?? stats.contract,
    current: project.currentTotalOverride ?? stats.current,
  };

  const dynamicStyles = `
    @media print {
      .print-report-area {
        font-family: '${theme.fontFamily}', sans-serif !important;
        background-color: white !important;
        display: block !important;
        width: 100% !important;
        overflow: visible !important;
        color: #000;
      }

      .report-table {
        border-collapse: collapse !important;
        width: 100% !important;
        page-break-after: auto !important;
        table-layout: fixed !important;
      }

      .report-table thead {
        display: table-header-group !important; /* Repete cabeçalho */
      }

      .report-table tfoot {
        display: table-row-group !important; /* IMPEDE a repetição do footer em todas as páginas */
      }

      .report-table tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .report-table th, .report-table td {
        border: 0.4pt solid ${theme.border} !important;
        padding: 3pt 2pt !important;
        font-size: 5.5pt !important;
        text-transform: uppercase;
        word-wrap: break-word;
      }

      .report-table thead th {
        background-color: ${theme.header.bg} !important;
        color: ${theme.header.text} !important;
        font-weight: 900;
        -webkit-print-color-adjust: exact !important;
      }

      .bg-medi-period {
        background-color: ${theme.accent} !important;
        color: ${theme.accentText} !important;
        -webkit-print-color-adjust: exact !important;
      }

      .row-category {
        background-color: ${theme.category.bg} !important;
        color: ${theme.category.text} !important;
        font-weight: 700;
        -webkit-print-color-adjust: exact !important;
      }

      .footer-total-row {
        background-color: ${theme.footer.bg} !important;
        color: ${theme.footer.text} !important;
        font-weight: 700;
        -webkit-print-color-adjust: exact !important;
      }

      .col-wbs { width: 25pt; }
      .col-cod { width: 35pt; }
      .col-fonte { width: 32pt; }
      .col-desc { width: auto; text-align: left !important; }
      .col-und { width: 20pt; }
      .col-price { width: 45pt; }
      .col-qty { width: 30pt; }
      .col-total { width: 55pt; }
      .col-perc { width: 25pt; }
    }
  `;

  return (
    <div className="print-report-area">
      <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />

      <div className="report-master-container p-4">
        {/* CABEÇALHO */}
        <div className="flex justify-between items-start mb-6 border-b-2 pb-4" style={{ borderColor: theme.primary }}>
          <div className="flex items-center gap-6">
            {project.logo ? (
              <img src={project.logo} className="h-14 w-auto" alt="Logo" />
            ) : (
              <div className="w-12 h-12 bg-black text-white flex items-center justify-center rounded" style={{ backgroundColor: theme.primary }}>
                <HardHat size={24} />
              </div>
            )}
            <div>
              <h1 className="text-xl font-black uppercase leading-none" style={{ color: theme.primary }}>{companyName || project.companyName}</h1>
              <p className="text-[7pt] font-bold text-slate-500 uppercase mt-1">CNPJ: {companyCnpj || '00.000.000/0000-00'}</p>
            </div>
          </div>

          <div className="text-right">
            <h2 className="text-xl font-black uppercase leading-none" style={{ color: theme.primary }}>Planilha de Medição</h2>
            <div className="mt-2 flex items-center gap-2 justify-end">
               <span className="px-3 py-0.5 rounded text-[8pt] font-black text-white uppercase" style={{ backgroundColor: theme.accent }}>Medição Nº {project.measurementNumber}</span>
               <span className="text-[8pt] font-bold text-slate-400 uppercase">{project.referenceDate}</span>
            </div>
          </div>
        </div>

        {/* TABELA PRINCIPAL */}
        <table className="report-table">
          <thead>
            <tr>
              <th rowSpan={2} className="col-wbs">ITEM</th>
              <th rowSpan={2} className="col-cod">CÓD</th>
              <th rowSpan={2} className="col-fonte">FONTE</th>
              <th rowSpan={2} className="col-desc">DESCRIÇÃO DOS SERVIÇOS</th>
              <th rowSpan={2} className="col-und">UND</th>
              <th colSpan={2}>UNITÁRIO ({currencySymbol})</th>
              <th colSpan={2}>CONTRATO</th>
              <th colSpan={2}>ANTERIOR</th>
              <th colSpan={2} className="bg-medi-period">ATUAL</th>
              <th colSpan={2}>ACUMULADO</th>
              <th rowSpan={2} className="col-perc">%</th>
            </tr>
            <tr>
              <th className="col-price">S/ BDI</th>
              <th className="col-price">C/ BDI</th>
              <th className="col-qty">QTD</th>
              <th className="col-total">TOTAL</th>
              <th className="col-qty">QTD</th>
              <th className="col-total">TOTAL</th>
              <th className="col-qty bg-medi-period">QTD</th>
              <th className="col-total bg-medi-period">TOTAL</th>
              <th className="col-qty">QTD</th>
              <th className="col-total">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => {
              const isCat = item.type === 'category';
              return (
                <tr key={item.id} className={isCat ? 'row-category' : 'row-item'}>
                  <td className="text-center font-mono">{item.wbs}</td>
                  <td className="text-center">{item.cod || '-'}</td>
                  <td className="text-center">{item.fonte || '-'}</td>
                  <td className="col-desc" style={{ paddingLeft: isCat ? '2pt' : (item.depth * 8 + 4) + 'pt' }}>{item.name}</td>
                  <td className="text-center">{isCat ? '-' : item.unit}</td>
                  <td className="text-right">{!isCat ? financial.formatVisual(item.unitPriceNoBdi, '') : '-'}</td>
                  <td className="text-right">{!isCat ? financial.formatVisual(item.unitPrice, '') : '-'}</td>
                  <td className="text-center">{!isCat ? item.contractQuantity : '-'}</td>
                  <td className="text-right">{financial.formatVisual(item.contractTotal, '')}</td>
                  <td className="text-center">{!isCat ? item.previousQuantity : '-'}</td>
                  <td className="text-right">{financial.formatVisual(item.previousTotal, '')}</td>
                  <td className="text-center">{!isCat ? (item.currentQuantity || '-') : '-'}</td>
                  <td className="text-right">{financial.formatVisual(item.currentTotal, '')}</td>
                  <td className="text-center">{!isCat ? item.accumulatedQuantity : '-'}</td>
                  <td className="text-right">{financial.formatVisual(item.accumulatedTotal, '')}</td>
                  <td className="text-center">{item.accumulatedPercentage.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="footer-total-row">
              <td colSpan={8} className="p-2 pr-4 text-right">TOTAIS CONSOLIDADOS:</td>
              <td className="text-right">{financial.formatVisual(finalStats.contract, '')}</td>
              <td></td>
              <td className="text-right">{financial.formatVisual(finalStats.accumulated - finalStats.current, '')}</td>
              <td className="bg-medi-period"></td>
              <td className="text-right bg-medi-period" style={{ color: theme.accentText }}>{financial.formatVisual(finalStats.current, '')}</td>
              <td></td>
              <td className="text-right">{financial.formatVisual(finalStats.accumulated, '')}</td>
              <td className="text-center">{finalStats.progress.toFixed(1)}%</td>
            </tr>
          </tfoot>
        </table>

        {/* ASSINATURAS */}
        {project.config?.showSignatures && (
          <div className="grid grid-cols-3 gap-10 mt-12 no-break">
            <div className="text-center">
              <div className="w-full border-t border-black mb-1"></div>
              <div className="text-[7pt] font-black uppercase">Responsável Técnico</div>
              <div className="text-[5pt] text-slate-400 font-bold uppercase">CONTRATADA</div>
            </div>
            <div className="text-center">
              <div className="w-full border-t border-black mb-1"></div>
              <div className="text-[7pt] font-black uppercase">Fiscalização / Gestão</div>
              <div className="text-[5pt] text-slate-400 font-bold uppercase">CONTRATANTE</div>
            </div>
            <div className="text-center">
              <div className="w-full border-t border-black mb-1"></div>
              <div className="text-[7pt] font-black uppercase">Aprovação Final</div>
              <div className="text-[5pt] text-slate-400 font-bold uppercase">DIRETORIA</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};