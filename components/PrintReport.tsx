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

  const dynamicStyles = `
    .print-report-area {
      font-family: '${theme.fontFamily}', sans-serif !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 5mm !important;
      background: white !important;
      color: black !important;
      font-size: 8pt !important;
    }

    .print-report-area * {
      box-sizing: border-box !important;
    }

    .print-report-area table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin-bottom: 10px !important;
      table-layout: fixed !important; /* Força ocupação de largura total */
    }

    .print-report-area th, .print-report-area td {
      border: 0.5pt solid ${theme.border} !important;
      padding: 2pt 3pt !important;
      vertical-align: middle !important;
      font-size: 6.5pt !important;
      word-wrap: break-word !important;
    }

    .print-header-bg {
      background-color: ${theme.header.bg} !important;
      color: ${theme.header.text} !important;
      -webkit-print-color-adjust: exact !important;
    }

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

    .text-accent { color: ${theme.accent} !important; }
    .bg-accent { 
      background-color: ${theme.accent} !important; 
      color: ${theme.accentText} !important; 
      -webkit-print-color-adjust: exact !important;
    }

    /* Colunas Específicas */
    .col-wbs { width: 35pt !important; text-align: center; }
    .col-cod { width: 45pt !important; text-align: center; }
    .col-fonte { width: 40pt !important; text-align: center; }
    .col-desc { width: auto !important; text-align: left; }
    .col-und { width: 30pt !important; text-align: center; }
    .col-price { width: 55pt !important; text-align: right; }
    .col-qty { width: 40pt !important; text-align: center; }
    .col-total { width: 65pt !important; text-align: right; }
    .col-perc { width: 35pt !important; text-align: center; }

    .no-break { page-break-inside: avoid !important; }
    
    .border-top-thick { border-top: 2pt solid ${theme.primary} !important; }
  `;

  return (
    <div className="print-report-area">
      <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />
      
      {/* CABEÇALHO GRID 100% LARGURA */}
      <div className="flex items-start justify-between border-b-2 mb-4 pb-4" style={{ borderColor: theme.primary }}>
        <div className="flex items-center gap-5">
          {project.logo ? (
            <img src={project.logo} className="h-16 w-auto object-contain" alt="Logo" />
          ) : (
            <div className="w-14 h-14 bg-black text-white flex items-center justify-center rounded print-header-bg">
              <HardHat size={32} />
            </div>
          )}
          <div className="flex flex-col">
            <h1 className="text-xl font-black uppercase tracking-tight m-0" style={{ color: theme.primary }}>
              {companyName || project.companyName}
            </h1>
            <p className="text-[8pt] font-bold text-slate-600 m-0 uppercase opacity-70">
              {companyCnpj ? `CNPJ: ${companyCnpj}` : 'Controle de Medição Técnica'}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <h2 className="text-xl font-black uppercase m-0" style={{ color: theme.primary }}>Planilha de Medição</h2>
          <div className="mt-2 flex items-center justify-end gap-3">
             <div className="px-4 py-1 rounded bg-accent font-black text-[9pt]">
                MEDIÇÃO Nº {project.measurementNumber}
             </div>
             <span className="text-slate-500 font-bold text-[8pt] uppercase">Data: {project.referenceDate || '—'}</span>
          </div>
        </div>
      </div>

      {/* QUADRO DE INFOS DA OBRA */}
      <div className="flex border border-black mb-4 no-break">
        <div className="flex-1 p-2 border-r border-black">
          <label className="block text-[6pt] font-black text-slate-400 uppercase leading-none mb-1">Obra</label>
          <span className="text-[9pt] font-black uppercase leading-none">{project.name}</span>
        </div>
        <div className="flex-1 p-2 border-r border-black">
          <label className="block text-[6pt] font-black text-slate-400 uppercase leading-none mb-1">Local da Obra</label>
          <span className="text-[8pt] font-bold uppercase leading-none">{project.location || 'Não Informada'}</span>
        </div>
        <div className="w-48 p-2 text-right">
          <label className="block text-[6pt] font-black text-slate-400 uppercase leading-none mb-1">Status Físico Global</label>
          <span className="text-[10pt] font-black text-accent leading-none">{stats.progress.toFixed(2)}% Concluído</span>
        </div>
      </div>

      {/* TABELA DE MEDIÇÃO */}
      <table>
        <thead>
          <tr className="print-header-bg font-black uppercase text-center">
            <th rowSpan={2} className="col-wbs">ITEM</th>
            <th rowSpan={2} className="col-cod">CÓD</th>
            <th rowSpan={2} className="col-fonte">FONTE</th>
            <th rowSpan={2} className="col-desc">DESCRIÇÃO</th>
            <th rowSpan={2} className="col-und">UND</th>
            <th colSpan={2} className="col-price">UNITÁRIO (R$)</th>
            <th rowSpan={2} className="col-qty">QTD. CONTR.</th>
            <th rowSpan={2} className="col-total">TOTAL CONTRATADO</th>
            <th colSpan={2} className="col-total">ACUM. ANTERIOR</th>
            <th colSpan={2} className="col-total bg-accent" style={{ backgroundColor: theme.accent + '22' }}>MEDIÇÃO DO PERÍODO</th>
            <th colSpan={2} className="col-total">ACUM. TOTAL</th>
            <th colSpan={2} className="col-total">SALDO A REALIZAR</th>
            <th rowSpan={2} className="col-perc">% EXEC.</th>
          </tr>
          <tr className="print-header-bg font-bold text-[5pt] text-center">
            <th className="col-price">S/ BDI</th>
            <th className="col-price">C/ BDI</th>
            <th className="col-qty">QUANT.</th>
            <th className="col-total">TOTAL (R$)</th>
            <th className="col-qty text-accent">QUANT.</th>
            <th className="col-total text-accent">TOTAL (R$)</th>
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
              <tr key={item.id} className={`${isCat ? 'print-category-bg font-black' : ''} text-center`}>
                <td className="col-wbs font-mono">{item.wbs}</td>
                <td className="col-cod">{item.cod || '-'}</td>
                <td className="col-fonte">{item.fonte || '-'}</td>
                <td className="col-desc uppercase" style={{ paddingLeft: isCat ? '3pt' : (item.depth * 5 + 8) + 'pt' }}>
                  {item.name.trim()}
                </td>
                <td className="col-und">{isCat ? '-' : item.unit}</td>
                
                <td className="col-price">{!isCat ? financial.formatVisual(item.unitPriceNoBdi) : '-'}</td>
                <td className="col-price font-bold">{!isCat ? financial.formatVisual(item.unitPrice) : '-'}</td>

                <td className="col-qty">{!isCat ? item.contractQuantity : '-'}</td>
                <td className="col-total font-bold">{financial.formatVisual(item.contractTotal)}</td>

                <td className="col-qty">{!isCat ? item.previousQuantity : '-'}</td>
                <td className="col-total">{financial.formatVisual(item.previousTotal)}</td>

                {/* COLUNAS DE MEDIÇÃO ATUAL - DESTAQUE */}
                <td className="col-qty font-black text-accent" style={{ backgroundColor: theme.accent + '08' }}>
                  {!isCat ? (item.currentQuantity === 0 ? '-' : item.currentQuantity) : '-'}
                </td>
                <td className="col-total font-black text-accent" style={{ backgroundColor: theme.accent + '08' }}>
                  {financial.formatVisual(item.currentTotal)}
                </td>

                <td className="col-qty font-bold">{!isCat ? item.accumulatedQuantity : '-'}</td>
                <td className="col-total font-bold">{financial.formatVisual(item.accumulatedTotal)}</td>

                <td className="col-qty">{!isCat ? item.balanceQuantity : '-'}</td>
                <td className="col-total">{financial.formatVisual(item.balanceTotal)}</td>

                <td className="col-perc font-black">{item.accumulatedPercentage.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="print-footer-bg font-black uppercase text-[7.5pt] text-center">
            <td colSpan={8} className="text-right py-3 pr-4">TOTAIS GERAIS DA MEDIÇÃO</td>
            <td className="text-right px-2">{financial.formatVisual(stats.contract)}</td>
            <td></td>
            <td className="text-right px-2">{financial.formatVisual(stats.accumulated - stats.current)}</td>
            <td></td>
            <td className="text-right px-2 bg-accent">{financial.formatVisual(stats.current)}</td>
            <td></td>
            <td className="text-right px-2">{financial.formatVisual(stats.accumulated)}</td>
            <td></td>
            <td className="text-right px-2">{financial.formatVisual(stats.balance)}</td>
            <td className="text-center">{stats.progress.toFixed(1)}%</td>
          </tr>
        </tfoot>
      </table>

      {/* DASHBOARD DE KPI NO RODAPÉ */}
      <div className="grid grid-cols-4 gap-4 mt-6 no-break">
        <KpiBox label="Valor Total Contrato" value={financial.formatBRL(stats.contract)} border={theme.border} />
        <KpiBox label="Medição do Período" value={financial.formatBRL(stats.current)} border={theme.accent} isHighlight color={theme.accent} />
        <KpiBox label="Acumulado Atual" value={financial.formatBRL(stats.accumulated)} border={theme.border} />
        <KpiBox label="Saldo a Executar" value={financial.formatBRL(stats.balance)} border={theme.border} />
      </div>

      {/* BLOCO DE ASSINATURAS */}
      <div className="mt-12 grid grid-cols-3 gap-12 text-center no-break px-10">
        <SignatureField label="RESPONSÁVEL TÉCNICO" sub="CREA/CAU" border={theme.border} />
        <SignatureField label="FISCALIZAÇÃO" sub="Assinatura e Carimbo" border={theme.border} />
        <SignatureField label="GESTOR DO CONTRATO" sub="Liberação Financeira" border={theme.border} />
      </div>
    </div>
  );
};

const KpiBox = ({ label, value, border, isHighlight, color }: any) => (
  <div 
    className="p-3 text-center rounded flex flex-col items-center justify-center bg-white" 
    style={{ border: `${isHighlight ? '1.5pt' : '0.5pt'} solid ${border}`, backgroundColor: isHighlight ? color + '05' : 'transparent' }}
  >
    <span className={`text-[6pt] font-black uppercase mb-1 ${isHighlight ? '' : 'opacity-60'}`} style={{ color: isHighlight ? color : 'black' }}>{label}</span>
    <span className="text-[11pt] font-black" style={{ color: isHighlight ? color : 'black' }}>{value}</span>
  </div>
);

const SignatureField = ({ label, sub, border }: any) => (
  <div className="flex flex-col items-center">
    <div className="w-full border-t border-black mb-2" style={{ borderColor: border }}></div>
    <p className="text-[7pt] font-black uppercase m-0 leading-tight">{label}</p>
    <p className="text-[6pt] font-bold text-slate-500 m-0 uppercase opacity-70">{sub}</p>
  </div>
);