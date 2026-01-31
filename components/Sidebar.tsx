
import React from 'react';
import { Home, Cog, PlusCircle, Briefcase, Sun, Moon, Menu, HardHat, X } from 'lucide-react';
import { Project } from '../types';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  viewMode: string;
  setViewMode: (mode: any) => void;
  projects: Project[];
  activeProjectId: string | null;
  onOpenProject: (id: string) => void;
  onCreateProject: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen, setIsOpen, mobileOpen, setMobileOpen, viewMode, setViewMode,
  projects, activeProjectId, onOpenProject, onCreateProject, isDarkMode, toggleDarkMode
}) => {
  const NavItem = ({ active, onClick, icon, label }: any) => (
    <button onClick={onClick} className={`w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all ${active ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
      <div className="shrink-0">{icon}</div>
      {isOpen && <span className="text-[11px] font-black uppercase tracking-widest truncate">{label}</span>}
    </button>
  );

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-[110] lg:relative lg:translate-x-0 transition-transform duration-300 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col ${isOpen ? 'w-72' : 'w-20'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg"><HardHat size={20} /></div>
            {isOpen && <span className="text-sm font-black tracking-tighter uppercase">ProMeasure</span>}
          </div>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden p-2 text-slate-400"><X size={20} /></button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          <NavItem active={viewMode === 'global-dashboard'} onClick={() => { setViewMode('global-dashboard'); setMobileOpen(false); }} icon={<Home size={18}/>} label="Dashboard" />
          <NavItem active={viewMode === 'system-settings'} onClick={() => { setViewMode('system-settings'); setMobileOpen(false); }} icon={<Cog size={18}/>} label="Ajustes Globais" />
          
          <div className="py-6 px-3 flex items-center justify-between">
            {isOpen && <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Obras</h3>}
            <button onClick={onCreateProject} className="text-indigo-500 hover:scale-110 transition-transform"><PlusCircle size={16}/></button>
          </div>

          <div className="space-y-1">
            {projects.map(p => (
              <button key={p.id} onClick={() => onOpenProject(p.id)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeProjectId === p.id && viewMode === 'project-workspace' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <Briefcase size={16} className="shrink-0" />
                {isOpen && <span className="text-xs truncate text-left">{p.name}</span>}
              </button>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 gap-2 flex flex-col">
          <button onClick={toggleDarkMode} className="w-full flex items-center gap-3 p-3 text-slate-500 hover:bg-slate-50 rounded-xl">
            {isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}
            {isOpen && <span className="text-xs font-bold uppercase tracking-widest">{isDarkMode ? 'Claro' : 'Escuro'}</span>}
          </button>
          <button onClick={() => setIsOpen(!isOpen)} className="hidden lg:flex w-full items-center gap-3 p-3 text-slate-400 hover:bg-slate-50 rounded-xl">
             <Menu size={18} />
             {isOpen && <span className="text-xs font-bold uppercase tracking-widest">Recolher</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
