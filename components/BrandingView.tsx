
import React from 'react';
import { Project, PDFTheme } from '../types';
import { ThemeEditor } from './ThemeEditor';
import { Percent, Palette } from 'lucide-react';

interface BrandingViewProps {
  project: Project;
  onUpdateProject: (data: Partial<Project>) => void;
  isReadOnly?: boolean;
}

export const BrandingView: React.FC<BrandingViewProps> = ({ 
  project, onUpdateProject, isReadOnly 
}) => {
  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-10">
      {/* CONFIGURAÇÃO DE BDI */}
      <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-4 bg-emerald-600 rounded-2xl text-white shadow-lg shadow-emerald-500/20"><Percent size={24} /></div>
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white">Taxa de BDI</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Benefícios e Despesas Indiretas</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-10">
          <div className="flex-1 w-full">
            <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-2">Percentual (%)</label>
            <div className="relative">
              <input 
                disabled={isReadOnly}
                type="number" 
                step="0.01" 
                className="w-full px-8 py-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-4xl font-black focus:border-indigo-500 outline-none pr-20 dark:text-slate-100 transition-all disabled:opacity-50" 
                value={project.bdi} 
                onChange={(e) => onUpdateProject({ bdi: parseFloat(e.target.value) || 0 })} 
              />
              <span className="absolute right-8 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">%</span>
            </div>
          </div>
          <div className="p-8 bg-indigo-50 dark:bg-indigo-900/20 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-800 text-center flex flex-col justify-center min-w-[200px]">
            <p className="text-[9px] font-black text-indigo-400 uppercase mb-2 tracking-widest">Fator Multiplicador</p>
            <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{(1 + project.bdi/100).toFixed(4)}x</p>
          </div>
        </div>
      </div>

      {/* EDITOR DE TEMAS */}
      <ThemeEditor 
        theme={project.theme} 
        onChange={(theme: PDFTheme) => !isReadOnly && onUpdateProject({ theme })} 
      />
    </div>
  );
};
