
import React, { useState } from 'react';
import { Project } from '../types';
import { Briefcase, Plus, Edit2, Trash2, X, AlertTriangle, CheckCircle2, Save } from 'lucide-react';
import { treeService } from '../services/treeService';

interface DashboardViewProps {
  projects: Project[];
  onOpenProject: (id: string) => void;
  onCreateProject: () => void;
  onUpdateProjects: (p: Project[]) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ projects, onOpenProject, onCreateProject, onUpdateProjects }) => {
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [newName, setNewName] = useState('');

  const handleStartRename = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    setEditingProject(p);
    setNewName(p.name);
  };

  const handleConfirmRename = () => {
    if (!editingProject || !newName.trim()) return;
    const updated = projects.map(p => p.id === editingProject.id ? { ...p, name: newName.trim() } : p);
    onUpdateProjects(updated);
    setEditingProject(null);
  };

  const handleStartDelete = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    setDeletingProject(p);
  };

  const handleConfirmDelete = () => {
    if (!deletingProject) return;
    onUpdateProjects(projects.filter(p => p.id !== deletingProject.id));
    setDeletingProject(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-12 custom-scrollbar animate-in fade-in duration-500 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white">Central de Obras</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium font-sans">Você tem {projects.length} projetos em andamento.</p>
          </div>
          <button onClick={onCreateProject} className="flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all">
            <Plus size={16} /> Nova Obra
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[3rem]">
            <Briefcase size={48} className="mb-4 opacity-20" />
            <p className="font-bold uppercase tracking-widest text-[10px]">Nenhum projeto encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map(p => {
              const stats = treeService.calculateBasicStats(p.items, p.bdi);
              return (
                <div key={p.id} onClick={() => onOpenProject(p.id)} className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] p-8 shadow-sm hover:shadow-2xl hover:border-indigo-500 transition-all cursor-pointer relative overflow-hidden">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl transition-colors"><Briefcase size={20}/></div>
                    <div className="flex gap-1 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={(e) => handleStartRename(e, p)} className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"><Edit2 size={16}/></button>
                      <button type="button" onClick={(e) => handleStartDelete(e, p)} className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"><Trash2 size={16}/></button>
                    </div>
                  </div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white mb-1 truncate">{p.name}</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mb-6">Medição: #{p.measurementNumber}</p>
                  <div className="space-y-4">
                    <div className="flex justify-between items-end text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-400 dark:text-slate-500">Execução</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-sans">{stats.progress.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 dark:bg-indigo-400 transition-all duration-1000" style={{ width: `${stats.progress}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DE RENOMEAR OBRA */}
      {editingProject && (
        <div 
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setEditingProject(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-8 pt-8 pb-4 flex items-center justify-between border-b border-slate-50 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl">
                  <Edit2 size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black dark:text-white tracking-tight">Editar Nome</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Identificação da Obra</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingProject(null)} 
                className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-8">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">Nome do Empreendimento</label>
              <input 
                autoFocus
                className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white text-sm font-black focus:border-indigo-500 outline-none transition-all"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()}
              />
            </div>
            <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
              <button 
                type="button"
                onClick={handleConfirmRename} 
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Save size={18} /> Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {deletingProject && (
        <div 
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setDeletingProject(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8 text-center flex flex-col items-center">
              <div className="w-20 h-20 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-[2rem] flex items-center justify-center mb-6">
                <AlertTriangle size={40} />
              </div>
              <h2 className="text-2xl font-black dark:text-white tracking-tight mb-2">Excluir Projeto?</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium px-4">
                Você está prestes a apagar permanentemente a obra <span className="font-black text-slate-800 dark:text-slate-200">"{deletingProject.name}"</span>. Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
              <button 
                type="button"
                onClick={handleConfirmDelete} 
                className="w-full py-5 bg-rose-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={18} /> Sim, Excluir Definitivamente
              </button>
              <button 
                type="button"
                onClick={() => setDeletingProject(null)} 
                className="w-full py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                Cancelar e Manter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
