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

  const REPORT_WIDTH = "800pt";
  const currencySymbol = theme.currencySymbol || 'R$';

  const dynamicStyles = `
    .print-report-area {
      font-family: '${theme.fontFamily}', sans-serif !important;
      color: #000 !important;
      background-color: white !important;
      margin: 0 !important;
      padding: 10mm !important;
      height: auto !important;
      min-height: 0 !important;
    }

    .report-master-container {
      width: ${REPORT_WIDTH} !important;
      margin: 0 auto !important;
      background: white !important;
      padding-bottom: 0 !important;
      height: auto !important;
      min-height: 0 !important;
    }

    .report-table {
      border-collapse: collapse !important;
      width: 100% !important;
      table-layout: fixed !important;
      box-sizing: border-box !important;
    }

    .report-table th, .report-table td {
      border: 0.4pt solid ${theme.border} !important;
      padding: 1.5pt 2pt !important;
      font-size: 5pt !important;
      text-transform: uppercase;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      box-sizing: border-box !important;
    }

    .report-table thead th {
      background-color: ${theme.header.bg} !important;
      color: ${theme.header.text} !important;
      font-weight: 900;
      text-align: center;
    }

    .bg-medi-period {
      background-color: ${theme.accent} !important;
      color: ${theme.accentText} !important;
    }

    .cell-medi-period {
      background-color: ${theme.accent}10 !important;
      color: ${theme.accent} !important;
      font-weight: 900;
    }

    .row-category {
      background-color: ${theme.category.bg} !important;
      color: ${theme.category.text} !important;
      font-weight: 900;
    }

    .footer-total-row {
      background-color: ${theme.footer.bg} !important;
      color: ${theme.footer.text} !important;
      font-weight: 900;
      text-align: right;
    }

    .kpi-box {
      border: 0.5pt solid ${theme.border} !important;
    }

    .kpi-accent {
      border: 1pt solid ${theme.accent} !important;
      color: ${theme.accent} !important;
    }

    .signature-line {
      border-top: 0.5pt solid #000 !important;
    }

    /* LARGURAS RÍGIDAS */
    .col-wbs { width: 22pt; }
    .col-cod { width: 35pt; }
    .col-fonte { width: 32pt; }
    .col-desc { width: 150pt; text-align: left !important; white-space: normal !important; }
    .col-und { width: 18pt; }
    .col-price { width: 42pt; }
    .col-qty { width: 28pt; }
    .col-total { width: 50pt; }
    .col-perc { width: 25pt; }
  `;

  return (
    <div className="print-report-area">
      <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />

      <div className="report-master-container">
        {/* CABEÇALHO */}
        <div className="flex justify-between items-start mb-4 border-b pb-4" style={{ borderColor: theme.primary }}>
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
               <span className="text-[8pt] font-bold text-slate-400 uppercase">Data: {project.referenceDate}</span>
            </div>
          </div>
        </div>

        {/* INFOS OBRA */}
        <div className="flex border mb-4 text-[6pt] font-black uppercase overflow-hidden" style={{ borderColor: theme.border }}>
          <div className="flex-1 p-2 border-r" style={{ borderColor: theme.border }}>
            <div className="text-[4.5pt] text-slate-400">Empreendimento</div>
            <div>{project.name}</div>
          </div>
          <div className="flex-1 p-2 border-r" style={{ borderColor: theme.border }}>
            <div className="text-[4.5pt] text-slate-400">Localização</div>
            <div>{project.location || '-'}</div>
          </div>
          <div className="w-32 p-2 text-right">
            <div className="text-[4.5pt] text-slate-400">Progresso Físico</div>
            <div style={{ color: theme.accent }}>{stats.progress.toFixed(2)}% Concluído</div>
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
              <th rowSpan={2} className="col-qty">QTD CONTR</th>
              <th rowSpan={2} className="col-total">TOTAL CONTR</th>
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
                <tr key={item.id} className={isCat ? 'row-category' : ''}>
                  <td className="text-center">{item.wbs}</td>
                  <td className="text-center">{item.cod || '-'}</td>
                  <td className="text-center">{item.fonte || '-'}</td>
                  <td className="col-desc" style={{ paddingLeft: isCat ? '2pt' : (item.depth * 6 + 6) + 'pt' }}>{item.name}</td>
                  <td className="text-center">{isCat ? '-' : item.unit}</td>
                  <td className="text-right">{!isCat ? financial.formatVisual(item.unitPriceNoBdi, currencySymbol) : '-'}</td>
                  <td className="text-right font-bold">{!isCat ? financial.formatVisual(item.unitPrice, currencySymbol) : '-'}</td>
                  <td className="text-center">{!isCat ? item.contractQuantity : '-'}</td>
                  <td className="text-right font-bold">{financial.formatVisual(item.contractTotal, currencySymbol)}</td>
                  <td className="text-center">{!isCat ? item.previousQuantity : '-'}</td>
                  <td className="text-right">{financial.formatVisual(item.previousTotal, currencySymbol)}</td>
                  <td className="text-center cell-medi-period">{!isCat ? (item.currentQuantity || '-') : '-'}</td>
                  <td className="text-right cell-medi-period">{financial.formatVisual(item.currentTotal, currencySymbol)}</td>
                  <td className="text-center font-bold">{!isCat ? item.accumulatedQuantity : '-'}</td>
                  <td className="text-right font-bold">{financial.formatVisual(item.accumulatedTotal, currencySymbol)}</td>
                  <td className="text-center">{!isCat ? item.balanceQuantity : '-'}</td>
                  <td className="text-right">{financial.formatVisual(item.balanceTotal, currencySymbol)}</td>
                  <td className="text-center font-bold">{item.accumulatedPercentage.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="footer-total-row">
              <td colSpan={8} className="p-2 pr-4">TOTAIS CONSOLIDADOS</td>
              <td className="text-right">{financial.formatVisual(stats.contract, currencySymbol)}</td>
              <td></td>
              <td className="text-right">{financial.formatVisual(stats.accumulated - stats.current, currencySymbol)}</td>
              <td></td>
              <td className="text-right" style={{ color: theme.accentText }}>{financial.formatVisual(stats.current, currencySymbol)}</td>
              <td></td>
              <td className="text-right">{financial.formatVisual(stats.accumulated, currencySymbol)}</td>
              <td></td>
              <td className="text-right">{financial.formatVisual(stats.balance, currencySymbol)}</td>
              <td className="text-center">{stats.progress.toFixed(1)}%</td>
            </tr>
          </tfoot>
        </table>

        {/* KPIs FINANCEIROS */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="kpi-box p-3 text-center rounded bg-slate-50">
            <div className="text-[4.5pt] text-slate-400 uppercase font-bold">Valor Contrato</div>
            <div className="text-[10pt] font-black">{financial.formatVisual(stats.contract, currencySymbol)}</div>
          </div>
          <div className="kpi-accent p-3 text-center rounded bg-white">
            <div className="text-[4.5pt] uppercase font-bold">Líquido Medição Período</div>
            <div className="text-[10pt] font-black">{financial.formatVisual(stats.current, currencySymbol)}</div>
          </div>
          <div className="kpi-box p-3 text-center rounded">
            <div className="text-[4.5pt] text-slate-400 uppercase font-bold">Acumulado Atual</div>
            <div className="text-[10pt] font-black">{financial.formatVisual(stats.accumulated, currencySymbol)}</div>
          </div>
          <div className="kpi-box p-3 text-center rounded">
            <div className="text-[4.5pt] text-slate-400 uppercase font-bold">Saldo a Executar</div>
            <div className="text-[10pt] font-black">{financial.formatVisual(stats.balance, currencySymbol)}</div>
          </div>
        </div>

        {/* ASSINATURAS */}
        <div className="grid grid-cols-3 gap-10 mt-10">
          <div className="text-center">
            <div className="signature-line w-full mb-1"></div>
            <div className="text-[7pt] font-black uppercase">Responsável Técnico</div>
            <div className="text-[5pt] text-slate-400 font-bold">CONTRATADA</div>
          </div>
          <div className="text-center">
            <div className="signature-line w-full mb-1"></div>
            <div className="text-[7pt] font-black uppercase">Fiscalização de Obra</div>
            <div className="text-[5pt] text-slate-400 font-bold">Assinatura e Carimbo</div>
          </div>
          <div className="text-center">
            <div className="signature-line w-full mb-1"></div>
            <div className="text-[7pt] font-black uppercase">Gestor do Contrato</div>
            <div className="text-[5pt] text-slate-400 font-bold">CONTRATANTE</div>
          </div>
        </div>
      </div>
    </div>
  );
};