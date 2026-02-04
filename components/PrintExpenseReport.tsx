
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
      .print-expense-report {
        font-family: '${theme.fontFamily}', sans-serif !important;
        display: block !important;
        width: 100% !important;
        background: white !important;
        color: black !important;
      }
      .expense-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
      }
      .expense-table th, .expense-table td {
        border: 0.5pt solid ${theme.border};
        padding: 5pt;
        font-size: 7pt;
        text-align: left;
      }
      .expense-table thead th {
        background-color: ${theme.header.bg};
        color: ${theme.header.text};
        font-weight: 900;
        text-transform: uppercase;
      }
      .row-revenue { background-color: #f0fdf4 !important; }
      .row-labor { background-color: #eff6ff !important; }
      .row-material { background-color: #f8fafc !important; }
    }
  `;

  return (
    <div className="print-expense-report hidden print:block fixed inset-0 z-0 bg-white">
      <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />
      
      <div className="p-10">
        <div className="flex justify-between items-start border-b-2 pb-6 mb-8" style={{ borderColor: theme.primary }}>
          <div>
            <h1 className="text-2xl font-black uppercase" style={{ color: theme.primary }}>{project.companyName}</h1>
            <p className="text-[8pt] font-bold text-slate-500 uppercase">Relatório de Movimentação Financeira</p>
            <p className="text-[9pt] font-black mt-2">{project.name}</p>
          </div>
          <div className="text-right">
             <p className="text-[8pt] font-bold text-slate-400">Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
             <p className="text-[10pt] font-black uppercase mt-1">Período Corrente</p>
          </div>
        </div>

        {/* KPIs Summary */}
        <div className="grid grid-cols-4 gap-4 mb-10">
          <div className="p-4 border border-slate-200 rounded-lg">
            <p className="text-[6pt] font-black text-slate-400 uppercase">Total Recebido</p>
            <p className="text-[11pt] font-black text-emerald-600">{financial.formatVisual(stats.revenue, currencySymbol)}</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-lg">
            <p className="text-[6pt] font-black text-slate-400 uppercase">Mão de Obra</p>
            <p className="text-[11pt] font-black text-blue-600">{financial.formatVisual(stats.labor, currencySymbol)}</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-lg">
            <p className="text-[6pt] font-black text-slate-400 uppercase">Materiais</p>
            <p className="text-[11pt] font-black text-indigo-600">{financial.formatVisual(stats.material, currencySymbol)}</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
            <p className="text-[6pt] font-black text-slate-400 uppercase">Saldo Líquido</p>
            <p className={`text-[11pt] font-black ${stats.profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{financial.formatVisual(stats.profit, currencySymbol)}</p>
          </div>
        </div>

        <table className="expense-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Entidade/Fornecedor</th>
              <th>Qtd</th>
              <th>Un</th>
              <th style={{ textAlign: 'right' }}>Unitário</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'center' }}>Pago</th>
            </tr>
          </thead>
          <tbody>
            {expenses.filter(e => e.itemType === 'item').map(e => (
              <tr key={e.id} className={e.type === 'revenue' ? 'row-revenue' : (e.type === 'labor' ? 'row-labor' : 'row-material')}>
                <td>{financial.formatDate(e.date)}</td>
                <td className="font-bold">{e.type === 'revenue' ? 'ENTRADA' : (e.type === 'labor' ? 'M.O' : 'MAT')}</td>
                <td>{e.description}</td>
                <td>{e.entityName}</td>
                <td>{e.quantity}</td>
                <td>{e.unit}</td>
                <td style={{ textAlign: 'right' }}>{financial.formatVisual(e.unitPrice, currencySymbol)}</td>
                <td style={{ textAlign: 'right' }} className="font-bold">{financial.formatVisual(e.amount, currencySymbol)}</td>
                <td style={{ textAlign: 'center' }}>{e.isPaid ? 'SIM' : 'NÃO'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Assinaturas */}
        <div className="grid grid-cols-2 gap-20 mt-20">
           <div className="text-center">
              <div className="border-t border-black pt-2">
                <p className="text-[7pt] font-black uppercase">Responsável Financeiro</p>
                <p className="text-[6pt] text-slate-400 font-bold">{project.companyName}</p>
              </div>
           </div>
           <div className="text-center">
              <div className="border-t border-black pt-2">
                <p className="text-[7pt] font-black uppercase">Diretoria / Gestão</p>
                <p className="text-[6pt] text-slate-400 font-bold">Assinatura e Carimbo</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
