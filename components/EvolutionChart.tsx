
import React, { useMemo } from 'react';
import { MeasurementSnapshot } from '../types';

interface EvolutionChartProps {
  history: MeasurementSnapshot[];
  currentProgress: number;
}

export const EvolutionChart: React.FC<EvolutionChartProps> = ({ history, currentProgress }) => {
  // Garantir que temos dados para plotar
  const dataPoints = useMemo(() => {
    const points = (history || []).map((h, i) => ({
      x: i + 1,
      y: h.totals.progress || 0,
      label: `M#${h.measurementNumber}`
    }));

    // Injetar o ponto atual da medição em aberto
    points.push({
      x: points.length + 1,
      y: currentProgress || 0,
      label: "Agora"
    });

    // Se houver apenas 1 ponto (o atual), injetamos um zero inicial para visualização
    if (points.length === 1) {
      return [{ x: 0, y: 0, label: "Início" }, ...points];
    }
    
    return points;
  }, [history, currentProgress]);

  const width = 800;
  const height = 300;
  const padding = 50;

  // Funções de escala
  const getX = (val: number) => padding + (val * ((width - padding * 2) / (dataPoints.length - 1 || 1)));
  // Ajuste para lidar com dataPoints.length = 1 via index
  const getXByIndex = (idx: number) => padding + (idx * ((width - padding * 2) / (dataPoints.length - 1 || 1)));
  const getY = (val: number) => height - padding - ((val / 100) * (height - padding * 2));

  // Desenho dos caminhos SVG
  const linePath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getXByIndex(i)} ${getY(p.y)}`).join(' ');
  const areaPath = `${linePath} L ${getXByIndex(dataPoints.length - 1)} ${height - padding} L ${getXByIndex(0)} ${height - padding} Z`;

  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Curva de Evolução Acumulada</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Acompanhamento físico-financeiro reativo</p>
        </div>
        <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl border border-indigo-100 dark:border-indigo-800">
           <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Execução: {currentProgress.toFixed(2)}%</span>
        </div>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid Lines */}
          {[0, 25, 50, 75, 100].map(v => (
            <g key={v}>
              <line 
                x1={padding} y1={getY(v)} x2={width - padding} y2={getY(v)} 
                stroke="currentColor" strokeDasharray="4 4" className="text-slate-100 dark:text-slate-800" 
              />
              <text x={padding - 10} y={getY(v) + 4} textAnchor="end" className="text-[10px] font-bold fill-slate-400">{v}%</text>
            </g>
          ))}

          {/* Area e Linha */}
          <path d={areaPath} fill="url(#areaGrad)" />
          <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

          {/* Pontos */}
          {dataPoints.map((p, i) => (
            <g key={i}>
              <circle cx={getXByIndex(i)} cy={getY(p.y)} r="6" className="fill-white dark:fill-slate-900 stroke-indigo-500 stroke-[3px]" />
              <text x={getXByIndex(i)} y={height - 20} textAnchor="middle" className="text-[9px] font-black fill-slate-400 uppercase tracking-widest">{p.label}</text>
              
              {/* Tooltip Hover Simples */}
              <title>{p.label}: {p.y.toFixed(2)}%</title>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};
