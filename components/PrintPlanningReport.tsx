
import React from 'react';
import { Project, DEFAULT_THEME } from '../types';
import { financial } from '../utils/math';
import { HardHat } from 'lucide-react';

interface PrintPlanningReportProps {
  project: Project;
}

export const PrintPlanningReport: React.FC<PrintPlanningReportProps> = ({ project }) => {
  const theme = {
    ...DEFAULT_THEME,
    ...project.theme
  };

  const dynamicStyles = `
    @media print {
      .print-planning-area {
        display: block !important;
        width: 100% !important;
        background: white !important;
        color: black !important;
        font-family: '${theme.fontFamily}', sans-serif !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .planning-report-container {
        display: block !important;
        padding: 10mm !important;
      }
      .planning-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 5mm;
      }
      .planning-table th, .planning-table td {
        border: 0.3pt solid #000;
        padding: 4pt;
        font-size: 7pt;
      }
      .bg-header { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact !important; font-weight: 900; }
      .no-print { display: none !important; }
    }
  `;

  return (
    <div className="print-report-area print-planning-area bg-white min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />
      
      <div className="planning-report-container">
        <div className="flex justify-between items-center border-b-2 pb-4 mb-6" style={{ borderColor: theme.primary }}>
          <div>
            <h1 className="text-xl font-black uppercase" style={{ color: theme.primary }}>Relatório de Planejamento Operacional</h1>
            <p className="text-[8pt] font-bold text-slate-500 uppercase">{project.companyName}</p>
            <p className="text-[9pt] font-black uppercase mt-2">{project.name}</p>
          </div>
          <div className="text-right">
             <p className="text-[7pt] font-bold text-slate-400">Gerado em: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        <section className="mb-8">
          <h3 className="text-[10pt] font-black uppercase border-b mb-3">Metas e Milestones (Cronograma)</h3>
          <table className="planning-table">
            <thead>
              <tr className="bg-header">
                <th style={{ width: '15%' }}>Data</th>
                <th style={{ width: '70%' }}>Título da Meta / Evento Crítico</th>
                <th style={{ width: '15%' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {project.planning.milestones.map(m => (
                <tr key={m.id}>
                  <td>{financial.formatDate(m.date)}</td>
                  <td className="font-bold">{m.title}</td>
                  <td>{m.isCompleted ? 'CONCLUÍDO' : 'PENDENTE'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h3 className="text-[10pt] font-black uppercase border-b mb-3">Previsão de Suprimentos (Insumos)</h3>
          <table className="planning-table">
            <thead>
              <tr className="bg-header">
                <th style={{ width: '40%' }}>Material / Descrição</th>
                <th style={{ width: '10%' }}>Qtd</th>
                <th style={{ width: '15%' }}>Unitário</th>
                <th style={{ width: '15%' }}>Total</th>
                <th style={{ width: '10%' }}>Status</th>
                <th style={{ width: '10%' }}>Pago?</th>
              </tr>
            </thead>
            <tbody>
              {project.planning.forecasts.map(f => (
                <tr key={f.id}>
                  <td className="font-bold">{f.description}</td>
                  <td className="text-center">{f.quantityNeeded} {f.unit}</td>
                  <td className="text-right">{financial.formatVisual(f.unitPrice, theme.currencySymbol)}</td>
                  <td className="text-right">{financial.formatVisual(f.quantityNeeded * f.unitPrice, theme.currencySymbol)}</td>
                  <td className="text-center">{f.status.toUpperCase()}</td>
                  <td className="text-center">{f.isPaid ? 'SIM' : 'NÃO'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
};
