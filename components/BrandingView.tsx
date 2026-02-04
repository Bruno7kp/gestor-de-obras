
import React, { useRef } from 'react';
import { Project, PDFTheme } from '../types';
import { ThemeEditor } from './ThemeEditor';
import { 
  Percent, MapPin, Upload, 
  Image as ImageIcon, Trash2, FileText, 
  CheckCircle2, Building2, Palette, Settings2,
  ToggleRight, ToggleLeft, Cpu, Globe, CreditCard
} from 'lucide-react';

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

  const toggleConfig = (key: keyof typeof project.config) => {
    onUpdateProject({
      config: {
        ...project.config,
        [key]: !project.config[key]
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-16 animate-in fade-in duration-700 pb-24 px-4">
      {/* HEADER DA PÁGINA */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-10">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-indigo-600 rounded-[1.5rem] text-white shadow-xl shadow-indigo-500/20">
            <Settings2 size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">Ajustes do Projeto</h1>
            <p className="text-slate-500 font-medium mt-2">Identidade institucional, engenharia e engine visual.</p>
          </div>
        </div>
      </header>

      {/* CATEGORIA 1: PERFIL INSTITUCIONAL (EMPRESA RESPONSÁVEL) */}
      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <Building2 className="text-indigo-500" size={20} />
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Perfil Institucional (Contratada)</h2>
        </div>

        <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest ml-1">Razão Social / Nome Fantasia</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      disabled={isReadOnly}
                      className="w-full pl-12 pr-6 py-5 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white text-sm font-black focus:border-indigo-500 outline-none transition-all"
                      value={project.companyName}
                      onChange={(e) => onUpdateProject({ companyName: e.target.value })}
                      placeholder="Empresa responsável por esta obra"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest ml-1">CNPJ da Empresa</label>
                  <div className="relative">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      disabled={isReadOnly}
                      className="w-full pl-12 pr-6 py-5 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white text-sm font-black focus:border-indigo-500 outline-none transition-all"
                      value={project.companyCnpj}
                      onChange={(e) => onUpdateProject({ companyCnpj: e.target.value })}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                </div>
              </div>

              {/* UPLOAD DE LOGOMARCA */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Logomarca do Projeto</label>
                  {project.logo && (
                    <button 
                      onClick={() => onUpdateProject({ logo: null })}
                      className="text-xs font-bold text-rose-500 hover:underline"
                    >
                      Remover
                    </button>
                  )}
                </div>
                <div 
                  className="flex-1 min-h-[140px] rounded-[2rem] border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center relative overflow-hidden group hover:border-indigo-500 transition-all cursor-pointer bg-slate-50 dark:bg-slate-950"
                  onClick={() => !isReadOnly && fileInputRef.current?.click()}
                >
                  {project.logo ? (
                    <img src={project.logo} className="w-full h-full object-contain p-6" alt="Logo" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Upload size={20} />
                      <span className="text-[9px] font-black uppercase tracking-widest">PNG/JPG (2MB)</span>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={isReadOnly} />
                </div>
              </div>
           </div>
        </div>
      </section>

      {/* CATEGORIA 2: ENGENHARIA & LOCALIZAÇÃO */}
      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <Cpu className="text-emerald-500" size={20} />
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Engenharia & Localização</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* TAXA DE BDI */}
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-xl"><Percent size={20} /></div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Taxa de BDI</h3>
            </div>
            <div className="relative">
              <input 
                disabled={isReadOnly}
                type="number" 
                step="0.01" 
                className="w-full px-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-3xl font-black focus:border-emerald-500 outline-none pr-16 dark:text-slate-100 transition-all" 
                value={project.bdi} 
                onChange={(e) => onUpdateProject({ bdi: parseFloat(e.target.value) || 0 })} 
              />
              <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xl font-black text-slate-300">%</span>
            </div>
          </div>

          {/* LOCALIZAÇÃO */}
          <div className="md:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl"><MapPin size={20} /></div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Localização da Obra</h3>
            </div>
            <input 
              disabled={isReadOnly}
              type="text" 
              className="w-full px-6 py-5 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black focus:border-indigo-500 outline-none dark:text-slate-100 transition-all" 
              value={project.location} 
              placeholder="Ex: Curitiba - PR / Av. Batel, 1200"
              onChange={(e) => onUpdateProject({ location: e.target.value })} 
            />
          </div>
        </div>
      </section>

      {/* CATEGORIA 3: OPÇÕES DE RELATÓRIO */}
      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <FileText className="text-blue-500" size={20} />
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Configurações de Compliance</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button 
                onClick={() => toggleConfig('showSignatures')}
                disabled={isReadOnly}
                className={`flex items-center justify-between p-6 rounded-3xl border-2 transition-all ${project.config?.showSignatures ? 'border-indigo-100 bg-indigo-50/50 dark:bg-indigo-900/10 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' : 'border-slate-100 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-400'}`}
              >
                <div className="flex items-center gap-3">
                  <FileText size={18} />
                  <span className="text-xs font-black uppercase tracking-widest">Habilitar Bloco de Assinaturas</span>
                </div>
                {project.config?.showSignatures ? <ToggleRight size={28} className="text-indigo-600" /> : <ToggleLeft size={28} />}
              </button>

              <button 
                onClick={() => toggleConfig('printSubtotals')}
                disabled={isReadOnly}
                className={`flex items-center justify-between p-6 rounded-3xl border-2 transition-all ${project.config?.printSubtotals ? 'border-indigo-100 bg-indigo-50/50 dark:bg-indigo-900/10 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' : 'border-slate-100 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-400'}`}
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={18} />
                  <span className="text-xs font-black uppercase tracking-widest">Exibir Subtotais por Grupo</span>
                </div>
                {project.config?.printSubtotals ? <ToggleRight size={28} className="text-indigo-600" /> : <ToggleLeft size={28} />}
              </button>
        </div>
      </section>

      {/* CATEGORIA 4: ESTÉTICA & DESIGN (FULL WIDTH) */}
      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <Palette className="text-rose-500" size={20} />
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Design & Engine Visual do PDF</h2>
        </div>

        <div className="bg-white dark:bg-slate-900 p-2 sm:p-10 rounded-[3.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <ThemeEditor 
            theme={project.theme} 
            onChange={(theme: PDFTheme) => !isReadOnly && onUpdateProject({ theme })} 
          />
        </div>
      </section>
    </div>
  );
};
