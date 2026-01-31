
import React, { useState } from 'react';
import { Project } from '../types';
import { Briefcase, Plus, Edit2, Trash2 } from 'lucide-react';
import { treeService } from '../services/treeService';

interface DashboardViewProps {
  projects: Project[];
  onOpenProject: (id: string) => void;
  onCreateProject: () => void;
  onUpdateProjects: (p: Project[]) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ projects, onOpenProject, onCreateProject, onUpdateProjects }) => {
  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-12 custom-scrollbar animate-in fade-in duration-500">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white">Central de Obras</h1>
            <p className="text-slate-500 font-medium">Você tem {projects.length} projetos em andamento.</p>
          </div>
          <button onClick={onCreateProject} className="flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all">
            <Plus size={16} /> Nova Obra
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map(p => {
            const stats = treeService.calculateBasicStats(p.items, p.bdi);
            return (
              <div key={p.id} onClick={() => onOpenProject(p.id)} className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] p-8 shadow-sm hover:shadow-2xl hover:border-indigo-500 transition-all cursor-pointer relative overflow-hidden">
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 rounded-2xl"><Briefcase size={20}/></div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); /* Adicionar modal de renomear aqui se necessário */ }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 size={16}/></button>
                    <button onClick={(e) => { e.stopPropagation(); if(confirm("Excluir esta obra?")) onUpdateProjects(projects.filter(proj => proj.id !== p.id)); }} className="p-2 text-slate-400 hover:text-rose-600"><Trash2 size={16}/></button>
                  </div>
                </div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white mb-1 truncate">{p.name}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">Medição: #{p.measurementNumber}</p>
                <div className="space-y-4">
                  <div className="flex justify-between items-end text-[10px] font-black uppercase tracking-widest">
                    <span className="text-slate-400">Execução</span>
                    <span className="text-indigo-600">{stats.progress.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${stats.progress}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
