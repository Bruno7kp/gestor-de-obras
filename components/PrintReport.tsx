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

  // Estilos Injetados para Precisão Milimétrica (PDF Pro)
  const styles = `
    .print-report-area {
      font-family: '${theme.fontFamily}', sans-serif !important;
      color: #000 !important;
      line-height: 1.2;
    }

    .report-header-title {
      font-size: 18pt !important;
      font-weight: 900 !important;
      letter-spacing: -0.5pt !important;
      text-transform: uppercase;
    }

    .report-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .report-table th, .report-table td {
      border: 0.4pt solid #000 !important;
      padding: 1.5pt 2pt !important;
      vertical-align: middle;
      font-size: 5.8pt !important;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .report-table thead th {
      background-color: ${theme.header.bg} !important;
      color: ${theme.header.text} !important;
      font-weight: 900;
      text-align: center;
      text-transform: uppercase;
      font-size: 5pt !important;
    }

    .report-table .cat-row {
      background-color: ${theme.category.bg} !important;
      color: ${theme.category.text} !important;
      font-weight: 800;
    }

    .report-table .accent-cell {
      background-color: ${theme.accent}15 !important;
      color: ${theme.accent} !important;
      font-weight: 900;
    }

    .kpi-card {
      border: 0.8pt solid #000;
      padding: 6pt;
      text-align: center;
      border-radius: 4pt;
    }

    .kpi-card .label {
      font-size: 5pt;
      font-weight: 900;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 2pt;
    }

    .kpi-card .value {
      font-size: 10pt;
      font-weight: 900;
    }

    /* Larguras Fixas das Colunas (A4 Paisagem = 277mm área útil) */
    .col-item { width: 22pt; }
    .col-cod { width: 35pt; }
    .col-fonte { width: 30pt; }
    .col-desc { width: auto; text-align: left !important; white-space: normal !important; }
    .col-und { width: 18pt; }
    .col-unit { width: 38pt; }
    .col-qty { width: 32pt; }
    .col-total { width: 50pt; }
    .col-perc { width: 22pt; }

    .no-break { page-break-inside: avoid !important; }
  `;

  return (
    <div className="print-report-area">
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      {/* CABEÇALHO TÉCNICO */}
      <div className="flex items-center justify-between mb-4 border-b-2 pb-4" style={{ borderColor: theme.primary }}>
        <div className="flex items-center gap-4">
          {project.logo ? (
            <img src={project.logo} className="h-14 w-auto object-contain" alt="Branding" />
          ) : (
            <div className="w-12 h-12 bg-black text-white flex items-center justify-center rounded">
              <HardHat size={24} />
            </div>
          )}
          <div>
            <div className="report-header-title" style={{ color: theme.primary }}>{companyName || project.companyName}</div>
            <div className="text-[7pt] font-black opacity-60 uppercase tracking-widest">
              CNPJ: {companyCnpj || '12345232143523'}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="report-header-title" style={{ color: theme.primary }}>Planilha de Medição</div>
          <div className="flex items-center justify-end gap-2 mt-1">
            <span className="bg-black text-white px-3 py-0.5 rounded text-[7pt] font-black uppercase" style={{ backgroundColor: theme.header.bg, color: theme.header.text }}>
              Medição nº {project.measurementNumber}
            </span>
            <span className="text-[7pt] font-bold text-slate-500 uppercase">Data: {project.referenceDate}</span>
          </div>
        </div>
      </div>

      {/* QUADRO DE INFOS DA OBRA */}
      <div className="flex border border-black mb-4 font-black uppercase text-[6pt]">
        <div className="flex-1 p-2 border-r border-black">
          <div className="text-[4.5pt] text-slate-400 mb-0.5">Obra</div>
          <div className="text-[8pt]">{project.name}</div>
        </div>
        <div className="flex-1 p-2 border-r border-black">
          <div className="text-[4.5pt] text-slate-400 mb-0.5">Local da Obra</div>
          <div className="text-[7pt]">{project.location || 'Não Definido'}</div>
        </div>
        <div className="w-48 p-2 text-right">
          <div className="text-[4.5pt] text-slate-400 mb-0.5">Status Físico Global</div>
          <div className="text-[8pt]" style={{ color: theme.accent }}>{stats.progress.toFixed(2)}% Concluído</div>
        </div>
      </div>

      {/* TABELA DE MEDIÇÃO (18 COLUNAS) */}
      <table className="report-table">
        <thead>
          <tr>
            <th rowSpan={2} className="col-item">ITEM</th>
            <th rowSpan={2} className="col-cod">CÓD</th>
            <th rowSpan={2} className="col-fonte">FONTE</th>
            <th rowSpan={2} className="col-desc">DESCRIÇÃO</th>
            <th rowSpan={2} className="col-und">UND</th>
            <th colSpan={2}>UNITÁRIO (R$)</th>
            <th rowSpan={2} className="col-qty">QTD. CONTRATADA</th>
            <th rowSpan={2} className="col-total">TOTAL (R$) CONTRATADO</th>
            <th colSpan={2}>ACUM. ANTERIOR</th>
            <th colSpan={2} style={{ backgroundColor: theme.accent }}>MEDIÇÃO DO PERÍODO</th>
            <th colSpan={2}>ACUM. TOTAL</th>
            <th colSpan={2}>SALDO A REALIZAR</th>
            <th rowSpan={2} className="col-perc">% EXEC..</th>
          </tr>
          <tr style={{ filter: 'brightness(90%)' }}>
            <th className="col-unit">S/ BDI</th>
            <th className="col-unit">C/ BDI</th>
            <th className="col-qty">QUANT.</th>
            <th className="col-total">TOTAL (R$)</th>
            <th className="col-qty">QUANT.</th>
            <th className="col-total">TOTAL (R$)</th>
            <th className="col-qty">QUANT.</th>
            <th className="col-total">TOTAL (R$)</th>
            <th className="col-qty">QUANT.</th>
            <th className="col-total">TOTAL (R$)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const isCat = item.type === 'category';
            return (
              <tr key={item.id} className={isCat ? 'cat-row' : ''}>
                <td className="text-center font-mono">{item.wbs}</td>
                <td className="text-center">{item.cod || '-'}</td>
                <td className="text-center uppercase">{item.fonte || '-'}</td>
                <td className="col-desc uppercase" style={{ paddingLeft: isCat ? '2pt' : (item.depth * 5 + 6) + 'pt' }}>
                  {item.name}
                </td>
                <td className="text-center">{isCat ? '-' : item.unit}</td>
                
                <td className="text-right">{!isCat ? financial.formatVisual(item.unitPriceNoBdi) : '-'}</td>
                <td className="text-right font-black">{!isCat ? financial.formatVisual(item.unitPrice) : '-'}</td>

                <td className="text-center">{!isCat ? item.contractQuantity : '-'}</td>
                <td className="text-right font-black">{financial.formatVisual(item.contractTotal)}</td>

                <td className="text-center">{!isCat ? item.previousQuantity : '-'}</td>
                <td className="text-right">{financial.formatVisual(item.previousTotal)}</td>

                <td className="text-center accent-cell">{!isCat ? (item.currentQuantity || '-') : '-'}</td>
                <td className="text-right accent-cell">{financial.formatVisual(item.currentTotal)}</td>

                <td className="text-center font-bold">{!isCat ? item.accumulatedQuantity : '-'}</td>
                <td className="text-right font-bold">{financial.formatVisual(item.accumulatedTotal)}</td>

                <td className="text-center">{!isCat ? item.balanceQuantity : '-'}</td>
                <td className="text-right">{financial.formatVisual(item.balanceTotal)}</td>

                <td className="text-center font-black">{item.accumulatedPercentage.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-black uppercase text-center" style={{ backgroundColor: theme.footer.bg, color: theme.footer.text }}>
            <td colSpan={8} className="text-right py-2 pr-2">TOTAIS GERAIS DA MEDIÇÃO</td>
            <td className="text-right">{financial.formatVisual(stats.contract)}</td>
            <td></td>
            <td className="text-right">{financial.formatVisual(stats.accumulated - stats.current)}</td>
            <td></td>
            <td className="text-right" style={{ color: theme.accentText }}>{financial.formatVisual(stats.current)}</td>
            <td></td>
            <td className="text-right">{financial.formatVisual(stats.accumulated)}</td>
            <td></td>
            <td className="text-right">{financial.formatVisual(stats.balance)}</td>
            <td>{stats.progress.toFixed(1)}%</td>
          </tr>
        </tfoot>
      </table>

      {/* DASHBOARD KPI (RODAPÉ) */}
      <div className="grid grid-cols-4 gap-4 mt-6 no-break">
        <div className="kpi-card">
          <div className="label">Valor Total Contrato</div>
          <div className="value">{financial.formatBRL(stats.contract)}</div>
        </div>
        <div className="kpi-card" style={{ borderColor: theme.accent, backgroundColor: theme.accent + '05' }}>
          <div className="label" style={{ color: theme.accent }}>Medição do Período</div>
          <div className="value" style={{ color: theme.accent }}>{financial.formatBRL(stats.current)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Acumulado Atual</div>
          <div className="value">{financial.formatBRL(stats.accumulated)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Saldo a Executar</div>
          <div className="value">{financial.formatBRL(stats.balance)}</div>
        </div>
      </div>

      {/* ASSINATURAS */}
      <div className="mt-16 grid grid-cols-3 gap-12 text-center no-break px-6">
        <div>
          <div className="border-t border-black mb-1"></div>
          <div className="text-[7pt] font-black uppercase">Responsável Técnico</div>
          <div className="text-[5pt] font-bold text-slate-400">CREA/CAU / CONTRATADA</div>
        </div>
        <div>
          <div className="border-t border-black mb-1"></div>
          <div className="text-[7pt] font-black uppercase">Fiscalização</div>
          <div className="text-[5pt] font-bold text-slate-400">ASSINATURA E CARIMBO / CONTRATANTE</div>
        </div>
        <div>
          <div className="border-t border-black mb-1"></div>
          <div className="text-[7pt] font-black uppercase">Gestor do Contrato</div>
          <div className="text-[5pt] font-bold text-slate-400">LIBERAÇÃO FINANCEIRA</div>
        </div>
      </div>
    </div>
  );
};