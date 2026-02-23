
import React, { useMemo } from 'react';
import { Project, DEFAULT_THEME } from '../types';
import { financial } from '../utils/math';

type SuppliesPrintMode = 'complete' | 'pending' | 'ordered';

interface PrintPlanningReportProps {
  project: Project;
  printMode?: SuppliesPrintMode;
  onlyUnpaid?: boolean;
}

export const PrintPlanningReport: React.FC<PrintPlanningReportProps> = ({
  project,
  printMode = 'complete',
  onlyUnpaid = false,
}) => {
  const forecastStatusLabel: Record<'pending' | 'ordered' | 'delivered', string> = {
    pending: 'Pendente',
    ordered: 'Comprado',
    delivered: 'No Local',
  };

  const printModeLabel: Record<SuppliesPrintMode, string> = {
    complete: 'Completo',
    pending: 'A comprar',
    ordered: 'Pedidos de compra',
  };

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
      .planning-summary {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 3mm;
        margin-bottom: 4mm;
      }
      .planning-summary-card {
        border: 0.3pt solid #000;
        background: #f8fafc !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        border-radius: 2mm;
        padding: 3mm;
      }
      .planning-summary-label {
        font-size: 6.5pt;
        font-weight: 800;
        text-transform: uppercase;
        color: #475569;
      }
      .planning-summary-value {
        margin-top: 1.5mm;
        font-size: 10pt;
        font-weight: 900;
        color: #0f172a;
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

  const calculateForecastNetTotal = (quantityNeeded: number, unitPrice: number, discountValue: number) => {
    const gross = (quantityNeeded || 0) * (unitPrice || 0);
    return Math.max(0, financial.normalizeMoney(gross - (discountValue || 0)));
  };

  const reportForecasts = useMemo(() => {
    return (project.planning.forecasts || []).filter((forecast) => {
      if (printMode === 'pending' && forecast.status !== 'pending') return false;
      if (printMode === 'ordered' && forecast.status !== 'ordered') return false;
      if (onlyUnpaid && forecast.isPaid) return false;
      return true;
    });
  }, [project.planning.forecasts, printMode, onlyUnpaid]);

  const totals = useMemo(() => {
    const total = reportForecasts.reduce(
      (acc, forecast) => acc + calculateForecastNetTotal(forecast.quantityNeeded, forecast.unitPrice, forecast.discountValue || 0),
      0,
    );
    const totalPaid = reportForecasts
      .filter((forecast) => forecast.isPaid)
      .reduce(
        (acc, forecast) => acc + calculateForecastNetTotal(forecast.quantityNeeded, forecast.unitPrice, forecast.discountValue || 0),
        0,
      );

    return {
      total,
      totalPaid,
      totalUnpaid: Math.max(0, financial.normalizeMoney(total - totalPaid)),
      itemsCount: reportForecasts.length,
    };
  }, [reportForecasts]);

  return (
    <div className="print-report-area print-planning-area bg-white min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />
      
      <div className="planning-report-container">
        <div className="flex justify-between items-center border-b-2 pb-4 mb-6" style={{ borderColor: theme.primary }}>
          <div>
            <h1 className="text-xl font-black uppercase" style={{ color: theme.primary }}>Relatório de Suprimentos</h1>
            <p className="text-[8pt] font-bold text-slate-500 uppercase">{project.companyName}</p>
            <p className="text-[9pt] font-black uppercase mt-2">{project.name}</p>
            <p className="text-[7pt] font-bold text-slate-400 mt-1 uppercase">Modo: {printModeLabel[printMode]}{onlyUnpaid ? ' • Apenas não pagos' : ''}</p>
          </div>
          <div className="text-right">
             <p className="text-[7pt] font-bold text-slate-400">Gerado em: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        <section>
          <div className="planning-summary">
            <div className="planning-summary-card">
              <p className="planning-summary-label">Total geral</p>
              <p className="planning-summary-value">{financial.formatVisual(totals.total, theme.currencySymbol)}</p>
            </div>
            <div className="planning-summary-card">
              <p className="planning-summary-label">Total pago</p>
              <p className="planning-summary-value">{financial.formatVisual(totals.totalPaid, theme.currencySymbol)}</p>
            </div>
            <div className="planning-summary-card">
              <p className="planning-summary-label">Total não pago</p>
              <p className="planning-summary-value">{financial.formatVisual(totals.totalUnpaid, theme.currencySymbol)}</p>
            </div>
            <div className="planning-summary-card">
              <p className="planning-summary-label">Qtd. de itens</p>
              <p className="planning-summary-value">{totals.itemsCount}</p>
            </div>
          </div>

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
              {reportForecasts.map(f => (
                <tr key={f.id}>
                  <td className="font-bold">{f.description}</td>
                  <td className="text-center">{financial.formatQuantity(f.quantityNeeded)} {f.unit}</td>
                  <td className="text-right">{financial.formatVisual(f.unitPrice, theme.currencySymbol)}</td>
                  <td className="text-right">{financial.formatVisual(calculateForecastNetTotal(f.quantityNeeded, f.unitPrice, f.discountValue || 0), theme.currencySymbol)}</td>
                  <td className="text-center">{forecastStatusLabel[f.status]}</td>
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
