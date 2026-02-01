
import React, { useRef } from 'react';
import { Project, PDFTheme } from '../types';
import { ThemeEditor } from './ThemeEditor';
import { Percent, Sliders, AlertTriangle, ShieldCheck, MapPin, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';

interface BrandingViewProps {
  project: Project;
  onUpdateProject: (data: Partial<Project>) => void;
  isReadOnly?: boolean;
}

export const BrandingView: React.FC<BrandingViewProps> = ({ 
  project, onUpdateProject, isReadOnly 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("A imagem deve ter no máximo 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      onUpdateProject({ logo: event.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      <header className="max-w-4xl mx-auto flex items-center gap-4 px-4">
        <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl"><Sliders size={24}/></div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Identidade Visual & Parâmetros</h2>
          <p className="text-slate-500 font-medium">Configure a marca da empresa e o estilo dos relatórios.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto px-4">
        {/* UPLOAD DE LOGOMARCA */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-3 mb-6 self-start w-full">
            <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-lg"><ImageIcon size={20} /></div>
            <div className="text-left">
              <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Logomarca</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Visível no PDF</p>
            </div>
          </div>

          <div 
            className="w-full h-48 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center relative overflow-hidden group hover:border-indigo-500 transition-all cursor-pointer bg-slate-50 dark:bg-slate-950"
            onClick={() => !isReadOnly && fileInputRef.current?.click()}
          >
            {project.logo ? (
              <>
                <img src={project.logo} className="w-full h-full object-contain p-4" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                   <button 
                     onClick={(e) => { e.stopPropagation(); onUpdateProject({ logo: null }); }}
                     className="p-3 bg-rose-600 text-white rounded-xl shadow-lg hover:scale-110 transition-transform"
                   >
                     <Trash2 size={20} />
                   </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Upload size={32} />
                <span className="text-[10px] font-black uppercase tracking-widest">Upload PNG/JPG</span>
              </div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={isReadOnly} />
          </div>
        </div>

        {/* CONFIGURAÇÃO DE LOCALIZAÇÃO */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-lg"><MapPin size={20} /></div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Localização</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Endereço da Obra</p>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <input 
              disabled={isReadOnly}
              type="text" 
              className="w-full px-6 py-5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black focus:border-indigo-500 outline-none dark:text-slate-100 transition-all" 
              value={project.location} 
              placeholder="Ex: São Paulo - SP / Rua Exemplo, 123"
              onChange={(e) => onUpdateProject({ location: e.target.value })} 
            />
            <p className="text-[10px] font-bold text-slate-400 mt-4 text-center uppercase tracking-widest italic">Visível no quadro de dados do empreendimento.</p>
          </div>
        </div>

        {/* CONFIGURAÇÃO DE BDI */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-emerald-600 rounded-xl text-white shadow-lg"><Percent size={20} /></div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Taxa de BDI</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Despesas Indiretas (%)</p>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <div className="relative">
              <input 
                disabled={isReadOnly}
                type="number" 
                step="0.01" 
                className="w-full px-8 py-5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-3xl font-black focus:border-indigo-500 outline-none pr-16 dark:text-slate-100 transition-all" 
                value={project.bdi} 
                onChange={(e) => onUpdateProject({ bdi: parseFloat(e.target.value) || 0 })} 
              />
              <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xl font-black text-slate-300">%</span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 mt-4 text-center uppercase tracking-widest">Fator Multiplicador: <span className="text-indigo-600">{(1 + project.bdi/100).toFixed(4)}x</span></p>
          </div>
        </div>
      </div>

      {/* EDITOR DE TEMAS E FONTES */}
      <ThemeEditor 
        theme={project.theme} 
        onChange={(theme: PDFTheme) => !isReadOnly && onUpdateProject({ theme })} 
      />
    </div>
  );
};
