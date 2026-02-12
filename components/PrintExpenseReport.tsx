
import React from 'react';
import { Project, ProjectExpense, DEFAULT_THEME } from '../types';
import { financial } from '../utils/math';
import { Landmark, TrendingDown, TrendingUp, Coins } from 'lucide-react';

interface PrintExpenseReportProps {
  project: Project;
  expenses: ProjectExpense[];
  stats: any;
}

export const PrintExpenseReport: React.FC<PrintExpenseReportProps> = ({ project, expenses, stats }) => {
  const theme = {
    ...DEFAULT_THEME,
    ...project.theme
  };

  const currencySymbol = theme.currencySymbol || 'R$';

  const dynamicStyles = `
    @media print {
      .print-expense-report-area {
        display: block !important;
        position: static !important;
        width: 100% !important;
        background: white !important;
        color: black !important;
        font-family: '${theme.fontFamily}', sans-serif !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      .expense-report-container {
        display: block !important;
        padding: 10mm !important;
      }

      .expense-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 5mm;
        page-break-after: auto;
      }

      .expense-table thead {
        display: table-header-group !important;
      }

      .expense-table tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .expense-table th, .expense-table td {
        border: 0.3pt solid ${theme.border} !important;
        padding: 4pt 3pt !important;
        font-size: 6.5pt !important;
        text-align: left;
        word-wrap: break-word;
        overflow-wrap: break-word;
      }

      .expense-table thead th {
        background-color: ${theme.header.bg} !important;
        color: ${theme.header.text} !important;
        font-weight: 900;
        text-transform: uppercase;
        -webkit-print-color-adjust: exact !important;
      }

      .row-revenue { background-color: #f0fdf4 !important; -webkit-print-color-adjust: exact !important; }
      .row-labor { background-color: #eff6ff !important; -webkit-print-color-adjust: exact !important; }
      .row-material { background-color: #f8fafc !important; -webkit-print-color-adjust: exact !important; }
      .row-other { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact !important; }

      .kpi-grid {
        display: grid !important;
        grid-template-columns: repeat(4, 1fr) !important;
        gap: 3mm !important;
        margin-bottom: 5mm !important;
      }

      .kpi-card {
        padding: 3pt !important;
        border: 0.3pt solid #ddd !important;
        border-radius: 4pt !important;
        text-align: center;
      }

      .signature-area {
        margin-top: 15mm !important;
        display: grid !important;
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 20mm !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .signature-block {
        text-align: center;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .signature-line {
        border-top: 0.3pt solid black !important;
        margin-bottom: 2pt;
      }

      .no-print, button { display: none !important; }
    }
  `;

  return (
    <div className="print-report-area print-expense-report-area bg-white min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />
      
      <div className="expense-report-container">
        {/* Header Institucional */}
        <div className="flex justify-between items-end border-b-2 pb-4 mb-6" style={{ borderColor: theme.primary }}>
          <div>
            <h1 className="text-xl font-black uppercase leading-none" style={{ color: theme.primary }}>{project.companyName}</h1>
            <p className="text-[7pt] font-bold text-slate-500 uppercase mt-1">Relatório Consolidado de Fluxo Financeiro</p>
            <p className="text-[8pt] font-black mt-2 uppercase tracking-tight">{project.name}</p>
          </div>
          <div className="text-right">
             <p className="text-[7pt] font-bold text-slate-400">Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
             <p className="text-[8pt] font-black uppercase text-indigo-600">Gestão de Custos v0.5</p>
          </div>
        </div>

        {/* KPIs Summary */}
        <div className="kpi-grid grid grid-cols-4 gap-4 mb-6">
          <div className="kpi-card p-3 border border-slate-100 rounded-lg">
            <p className="text-[5pt] font-black text-slate-400 uppercase tracking-widest">Total Recebido</p>
            <p className="text-[10pt] font-black text-emerald-600">{financial.formatVisual(stats.revenue, currencySymbol)}</p>
          </div>
          <div className="kpi-card p-3 border border-slate-100 rounded-lg">
            <p className="text-[5pt] font-black text-slate-400 uppercase tracking-widest">Mão de Obra</p>
            <p className="text-[10pt] font-black text-blue-600">{financial.formatVisual(stats.labor, currencySymbol)}</p>
          </div>
          <div className="kpi-card p-3 border border-slate-100 rounded-lg">
            <p className="text-[5pt] font-black text-slate-400 uppercase tracking-widest">Materiais</p>
            <p className="text-[10pt] font-black text-indigo-600">{financial.formatVisual(stats.material, currencySymbol)}</p>
          </div>
          <div className="kpi-card p-3 border border-slate-200 bg-slate-50 rounded-lg">
            <p className="text-[5pt] font-black text-slate-400 uppercase tracking-widest">Saldo Período</p>
            <p className={`text-[10pt] font-black ${stats.profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {financial.formatVisual(stats.profit, currencySymbol)}
            </p>
          </div>
        </div>

        {/* Tabela Principal */}
        <table className="expense-table">
          <thead>
            <tr>
              <th style={{ width: '12%' }}>Data</th>
              <th style={{ width: '8%' }}>Tipo</th>
              <th style={{ width: '35%' }}>Descrição do Lançamento</th>
              <th style={{ width: '20%' }}>Fornecedor / Entidade</th>
              <th style={{ width: '5%', textAlign: 'center' }}>Qtd</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Unitário</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Líquido</th>
            </tr>
          </thead>
          <tbody>
            {expenses.filter(e => e.itemType === 'item').map(e => (
              <tr
                key={e.id}
                className={e.type === 'revenue'
                  ? 'row-revenue'
                  : (e.type === 'labor'
                    ? 'row-labor'
                    : (e.type === 'other' ? 'row-other' : 'row-material'))}
              >
                <td>{financial.formatDate(e.date)}</td>
                <td className="font-bold">{e.type === 'revenue' ? 'ENT' : (e.type === 'labor' ? 'M.O' : (e.type === 'other' ? 'OUT' : 'MAT'))}</td>
                <td>{e.description}</td>
                <td className="text-slate-600">{e.entityName || '—'}</td>
                <td style={{ textAlign: 'center' }}>{financial.formatQuantity(e.quantity)} {e.unit}</td>
                <td style={{ textAlign: 'right' }}>{financial.formatVisual(e.unitPrice, currencySymbol)}</td>
                <td style={{ textAlign: 'right' }} className="font-bold">{financial.formatVisual(e.amount, currencySymbol)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Rodapé de Assinaturas */}
        <div className="signature-area grid grid-cols-2 gap-20 mt-16">
           <div className="signature-block">
              <div className="signature-line w-full mb-1"></div>
              <p className="text-[7pt] font-black uppercase">Responsável Financeiro</p>
              <p className="text-[6pt] text-slate-400 font-bold uppercase">{project.companyName}</p>
           </div>
           <div className="signature-block">
              <div className="signature-line w-full mb-1"></div>
              <p className="text-[7pt] font-black uppercase">Gestão Operacional</p>
              <p className="text-[6pt] text-slate-400 font-bold uppercase">Conferência e Aprovação</p>
           </div>
        </div>
      </div>
    </div>
  );
};
