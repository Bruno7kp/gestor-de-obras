
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

      .report-master-container {
        display: block !important;
        width: 100% !important;
        overflow: visible !important;
      }

      .report-table {
        border-collapse: collapse !important;
        width: 100% !important;
        /* Safari: Evita que a tabela inteira tente caber em uma página só */
        page-break-after: auto !important;
      }

      .report-table thead {
        display: table-header-group !important;
      }

      .report-table tr {
        /* Safari/WebKit: break-inside avoid é ignorado se houver flex no pai */
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        -webkit-column-break-inside: avoid !important;
      }

      .report-table td, .report-table th {
        /* Safari: Garante que o conteúdo da célula não quebre no meio */
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        word-wrap: break-word;
        overflow-wrap: break-word;
      }

      /* Estilos Visuais */
      .report-table th, .report-table td {
        border: 0.4pt solid ${theme.border} !important;
        padding: 3pt 2pt !important;
        font-size: 5.5pt !important;
        text-transform: uppercase;
      }

      .report-table thead th {
        background-color: ${theme.header.bg};
        color: ${theme.header.text} !important;
        font-weight: 900;
        text-align: center;
        -webkit-print-color-adjust: exact !important;
      }

      .report-table tfoot {
        display: table-row-group !important; /* IMPEDE a repetição do footer em todas as páginas */
      }

      .bg-medi-period {
        background-color: ${theme.accent} !important;
        color: ${theme.accentText} !important;
        -webkit-print-color-adjust: exact !important;
      }

      .row-category {
        background-color: ${theme.category.bg} !important;
        color: ${theme.category.text} !important;
        -webkit-print-color-adjust: exact !important;
        font-weight: 700;
      }

      .row-item td {
        font-weight: 400;
      }

      .row-category .cell-medi-period {
        background-color: ${theme.accent}1A !important; 
        -webkit-print-color-adjust: exact !important;
      }

      .row-item .cell-medi-period {
        background-color: ${theme.accent}0A !important; 
        -webkit-print-color-adjust: exact !important;
      }

      .footer-total-row {
        background-color: ${theme.footer.bg} !important;
        color: ${theme.footer.text} !important;
        font-weight: 700;
        -webkit-print-color-adjust: exact !important;
      }

      .kpi-box {
        border: 0.5pt solid ${theme.border} !important;
        background-color: #f8fafc !important;
        -webkit-print-color-adjust: exact !important;
      }

      .kpi-accent {
        border: 1pt solid ${theme.accent} !important;
        color: ${theme.accent} !important;
        background-color: white !important;
        -webkit-print-color-adjust: exact !important;
      }

      .no-break {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .signature-line {
        border-top: 0.5pt solid #000 !important;
      }

      .col-wbs { width: 25pt; }
      .col-cod { width: 35pt; }
      .col-fonte { width: 32pt; }
      .col-desc { width: 140pt; text-align: left !important; white-space: normal !important; }
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

      <div className="report-master-container">
        {/* CABEÇALHO */}
        <div className="flex justify-between items-start mb-4 border-b pb-4" style={{ borderColor: theme.primary, display: 'flex' }}>
          <div className="flex items-center gap-6" style={{ display: 'flex', alignItems: 'center' }}>
            {project.logo ? (
              <img src={project.logo} className="h-14 w-auto" alt="Logo" />
            ) : (
              <div className="w-12 h-12 bg-black text-white flex items-center justify-center rounded" style={{ backgroundColor: theme.primary, display: 'flex' }}>
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
            <div className="mt-2 flex items-center gap-2 justify-end" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <span className="px-3 py-0.5 rounded text-[8pt] font-black text-white uppercase" style={{ backgroundColor: theme.accent }}>Medição Nº {project.measurementNumber}</span>
              <span className="text-[8pt] font-bold text-slate-400 uppercase">Data: {project.referenceDate}</span>
            </div>
          </div>
        </div>

        {/* INFOS OBRA */}
        <div className="flex mb-4 text-[6pt] font-black uppercase" style={{ display: 'flex' }}>
          <div className="flex-1 p-2">
            <div className="text-[8pt] text-slate-400">Obra</div>
            <div className="text-[8pt] dark:text-black">{project.name}</div>
          </div>
          <div className="flex-1 p-2">
            <div className="text-[8pt] text-slate-400">Local</div>
            <div className="text-[8pt] dark:text-black">{project.location || '-'}</div>
          </div>
          <div className="w-32 p-2 text-right">
            <div className="text-[8pt] text-slate-400">Progresso Físico</div>
            <div className="text-[8pt]" style={{ color: theme.accent }}>{finalStats.progress.toFixed(2)}% Concluído</div>
          </div>
        </div>

        {/* TABELA */}
        <table className="report-table">
          <thead>
            <tr>
              <th rowSpan={2} className="col-wbs">ITEM</th>
              <th rowSpan={2} className="col-cod">CÓD</th>
              <th rowSpan={2} className="col-fonte">FONTE</th>
              <th rowSpan={2} className="col-desc">DESCRIÇÃO</th>
              <th rowSpan={2} className="col-und">UND</th>
              <th colSpan={2}>UNITÁRIO ({currencySymbol})</th>
              <th rowSpan={2} className="col-qty">QTD</th>
              <th rowSpan={2} className="col-total">TOTAL</th>
              <th colSpan={2}>ACUM. ANTERIOR</th>
              <th colSpan={2} className="bg-medi-period">MEDIÇÃO PERÍODO</th>
              <th colSpan={2}>ACUM. TOTAL</th>
              <th colSpan={2}>SALDO REAMN.</th>
              <th rowSpan={2} className="col-perc">%</th>
            </tr>
            <tr>
              <th className="col-price">S/ BDI</th>
              <th className="col-price">C/ BDI</th>
              <th className="col-qty">QTD</th>
              <th className="col-total">TOTAL</th>
              <th className="col-qty bg-medi-period">QTD</th>
              <th className="col-total bg-medi-period">TOTAL</th>
              <th className="col-qty">QTD</th>
              <th className="col-total">TOTAL</th>
              <th className="col-qty">QTD</th>
              <th className="col-total">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => {
              const isCat = item.type === 'category';
              return (
                <tr key={item.id} className={isCat ? 'row-category' : 'row-item'}>
                  <td className="text-center">{item.wbs}</td>
                  <td className="text-center">{item.cod || '-'}</td>
                  <td className="text-center">{item.fonte || '-'}</td>
                  <td className="col-desc" style={{ paddingLeft: isCat ? '2pt' : (item.depth * 6 + 6) + 'pt' }}>{item.name}</td>
                  <td className="text-center">{isCat ? '-' : item.unit}</td>
                  <td className="text-right">{!isCat ? financial.formatVisual(item.unitPriceNoBdi, currencySymbol) : '-'}</td>
                  <td className="text-right">{!isCat ? financial.formatVisual(item.unitPrice, currencySymbol) : '-'}</td>
                  <td className="text-center">{!isCat ? item.contractQuantity : '-'}</td>
                  <td className="text-right">{financial.formatVisual(item.contractTotal, currencySymbol)}</td>
                  <td className="text-center">{!isCat ? item.previousQuantity : '-'}</td>
                  <td className="text-right">{financial.formatVisual(item.previousTotal, currencySymbol)}</td>
                  <td className="text-center cell-medi-period">{!isCat ? (item.currentQuantity || '-') : '-'}</td>
                  <td className="text-right cell-medi-period">{financial.formatVisual(item.currentTotal, currencySymbol)}</td>
                  <td className="text-center">{!isCat ? item.accumulatedQuantity : '-'}</td>
                  <td className="text-right">{financial.formatVisual(item.accumulatedTotal, currencySymbol)}</td>
                  <td className="text-center">{!isCat ? item.balanceQuantity : '-'}</td>
                  <td className="text-right">{financial.formatVisual(item.balanceTotal, currencySymbol)}</td>
                  <td className="text-center">{item.accumulatedPercentage.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="footer-total-row">
              <td colSpan={8} className="p-2 pr-4 text-right">TOTAIS CONSOLIDADOS</td>
              <td className="text-right">{financial.formatVisual(finalStats.contract, currencySymbol)}</td>
              <td></td>
              <td className="text-right">{financial.formatVisual(finalStats.accumulated - finalStats.current, currencySymbol)}</td>
              <td className="bg-medi-period"></td>
              <td className="text-right bg-medi-period" style={{ color: theme.accentText }}>{financial.formatVisual(finalStats.current, currencySymbol)}</td>
              <td></td>
              <td className="text-right">{financial.formatVisual(finalStats.accumulated, currencySymbol)}</td>
              <td></td>
              <td className="text-right">{financial.formatVisual(finalStats.balance, currencySymbol)}</td>
              <td className="text-center">{finalStats.progress.toFixed(1)}%</td>
            </tr>
          </tfoot>
        </table>

        {/* KPIs FINANCEIROS */}
        <div className="grid grid-cols-4 gap-4 mt-6 no-break" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="p-3 text-center rounded bg-slate-50 border" style={{ border: '0.5pt solid #ccc' }}>
            <div className="text-[4.5pt] text-slate-400 uppercase font-bold">Valor Contrato</div>
            <div className="text-[8pt] font-black dark:text-black">{financial.formatVisual(finalStats.contract, currencySymbol)}</div>
          </div>
          <div className="p-3 text-center rounded bg-white border" style={{ border: `1pt solid ${theme.accent}`, color: theme.accent }}>
            <div className="text-[4.5pt] uppercase font-bold">Medição no Período</div>
            <div className="text-[8pt] font-black">{financial.formatVisual(finalStats.current, currencySymbol)}</div>
          </div>
          <div className="p-3 text-center rounded bg-white border" style={{ border: '0.5pt solid #ccc' }}>
            <div className="text-[4.5pt] text-slate-400 uppercase font-bold">Acumulado Atual</div>
            <div className="text-[8pt] font-black dark:text-black">{financial.formatVisual(finalStats.accumulated, currencySymbol)}</div>
          </div>
          <div className="p-3 text-center rounded bg-white border" style={{ border: '0.5pt solid #ccc' }}>
            <div className="text-[4.5pt] text-slate-400 uppercase font-bold">Saldo a Executar</div>
            <div className="text-[8pt] font-black dark:text-black">{financial.formatVisual(finalStats.balance, currencySymbol)}</div>
          </div>
        </div>

        {/* ASSINATURAS */}
        {project.config?.showSignatures && (
          <div className="grid grid-cols-3 gap-10 mt-10 no-break" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="text-center">
              <div className="signature-line w-full mb-1"></div>
              <div className="text-[7pt] font-black uppercase dark:text-black">Responsável Técnico</div>
              <div className="text-[5pt] text-slate-400 font-bold">CONTRATADA</div>
            </div>
            <div className="text-center">
              <div className="signature-line w-full mb-1"></div>
              <div className="text-[7pt] font-black uppercase dark:text-black">Fiscalização de Obra</div>
              <div className="text-[5pt] text-slate-400 font-bold">Assinatura e Carimbo</div>
            </div>
            <div className="text-center">
              <div className="signature-line w-full mb-1"></div>
              <div className="text-[7pt] font-black uppercase dark:text-black">Gestor do Contrato</div>
              <div className="text-[5pt] text-slate-400 font-bold">CONTRATANTE</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};