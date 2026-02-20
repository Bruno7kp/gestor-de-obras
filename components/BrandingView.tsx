
import React, { useRef, useState, useEffect } from 'react';
import { Project, PDFTheme } from '../types';
import { ThemeEditor } from './ThemeEditor';
import { uploadService } from '../services/uploadService';
import { projectsApi } from '../services/projectsApi';
import { financial } from '../utils/math';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { 
  Percent, MapPin, Upload, 
  Image as ImageIcon, Trash2, FileText, 
  CheckCircle2, Building2, Palette, Settings2,
  ToggleRight, ToggleLeft, Cpu, Globe, CreditCard, Archive, RotateCcw, AlertTriangle
} from 'lucide-react';

interface BrandingViewProps {
  project: Project;
  onUpdateProject: (data: Partial<Project>) => void;
  isReadOnly?: boolean;
}

export const BrandingView: React.FC<BrandingViewProps> = ({ 
  project, onUpdateProject, isReadOnly 
}) => {
  const { canEdit } = usePermissions();
  const toast = useToast();
  const canEditBranding = canEdit('project_settings') && !isReadOnly;
  const canManageLifecycle = canEdit('project_settings');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [strBdi, setStrBdi] = useState(financial.formatVisual(project.bdi || 0, '').trim());
  const [lifecycleAction, setLifecycleAction] = useState<'archive' | 'reactivate' | null>(null);
  const [lifecycleNameInput, setLifecycleNameInput] = useState('');
  const [lifecycleSubmitting, setLifecycleSubmitting] = useState(false);

  useEffect(() => {
    setStrBdi(financial.formatVisual(project.bdi || 0, '').trim());
  }, [project.bdi]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.warning("A imagem deve ter no máximo 2MB.");
      return;
    }

    try {
      const uploaded = await uploadService.uploadFile(file);
      onUpdateProject({ logo: uploaded.url });
    } catch (error) {
      console.error('Erro ao enviar logomarca:', error);
      toast.error('Falha ao enviar imagem. Tente novamente.');
    }
  };

  const toggleConfig = (key: keyof typeof project.config) => {
    onUpdateProject({
      config: {
        ...project.config,
        [key]: !project.config[key]
      }
    });
  };

  const handleSubmitLifecycle = async () => {
    if (!lifecycleAction || !canManageLifecycle || lifecycleSubmitting) return;

    setLifecycleSubmitting(true);
    try {
      const updated = await projectsApi.updateLifecycle(project.id, {
        action: lifecycleAction,
        projectNameConfirmation: lifecycleNameInput,
      });

      onUpdateProject({
        isArchived: updated.isArchived,
        archivedAt: updated.archivedAt ?? null,
      });

      toast.success(
        lifecycleAction === 'archive'
          ? 'Obra encerrada e arquivada com sucesso.'
          : 'Obra reativada com sucesso.',
      );
      setLifecycleAction(null);
      setLifecycleNameInput('');
    } catch (error) {
      console.error('Erro ao alterar ciclo de vida da obra:', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel alterar o status da obra.');
    } finally {
      setLifecycleSubmitting(false);
    }
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
                type="text"
                inputMode="decimal"
                className="w-full px-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-3xl font-black focus:border-emerald-500 outline-none pr-16 dark:text-slate-100 transition-all" 
                value={strBdi}
                onChange={(e) => {
                  const masked = financial.maskCurrency(e.target.value);
                  setStrBdi(masked);
                  onUpdateProject({ bdi: financial.parseLocaleNumber(masked) || 0 });
                }} 
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

      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-rose-500" size={20} />
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Ciclo de Vida da Obra</h2>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Status atual:
            <span className={`ml-2 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${project.isArchived ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'}`}>
              {project.isArchived ? 'Arquivada' : 'Ativa'}
            </span>
          </p>

          {canManageLifecycle && (
            <div className="flex flex-wrap gap-3">
              {!project.isArchived ? (
                <button
                  onClick={() => {
                    setLifecycleAction('archive');
                    setLifecycleNameInput('');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-rose-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all"
                >
                  <Archive size={16} /> Encerrar e Arquivar Obra
                </button>
              ) : (
                <button
                  onClick={() => {
                    setLifecycleAction('reactivate');
                    setLifecycleNameInput('');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all"
                >
                  <RotateCcw size={16} /> Reativar Obra
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {lifecycleAction && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" onClick={() => setLifecycleAction(null)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">
              {lifecycleAction === 'archive' ? 'Encerrar obra' : 'Reativar obra'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Digite exatamente <span className="font-black text-slate-700 dark:text-slate-200">{project.name}</span> para confirmar.
            </p>
            <input
              value={lifecycleNameInput}
              onChange={(e) => setLifecycleNameInput(e.target.value)}
              className="mt-4 w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/30"
              placeholder="Digite o nome da obra"
              autoFocus
            />
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setLifecycleAction(null)}
                className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitLifecycle}
                disabled={lifecycleSubmitting || lifecycleNameInput.trim() !== project.name.trim()}
                className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl text-white transition-all ${lifecycleAction === 'archive' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {lifecycleSubmitting ? 'Processando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
