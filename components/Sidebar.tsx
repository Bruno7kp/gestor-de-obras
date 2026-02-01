
import React, { useState } from 'react';
import { Home, Cog, PlusCircle, Briefcase, Sun, Moon, Menu, HardHat, X, Folder, ChevronRight, ChevronLeft, ChevronDown, Landmark, AlertCircle } from 'lucide-react';
import { Project, ProjectGroup, CompanyCertificate } from '../types';
import { biddingService } from '../services/biddingService';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  viewMode: string;
  setViewMode: (mode: any) => void;
  projects: Project[];
  groups: ProjectGroup[];
  activeProjectId: string | null;
  onOpenProject: (id: string) => void;
  onCreateProject: (groupId?: string | null) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  certificates: CompanyCertificate[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen, setIsOpen, mobileOpen, setMobileOpen, viewMode, setViewMode,
  projects, groups, activeProjectId, onOpenProject, onCreateProject, isDarkMode, toggleDarkMode, certificates
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const hasAlerts = biddingService.hasGlobalAlerts(certificates);

  const NavItem = ({ active, onClick, icon, label, badge }: any) => (
    <button onClick={onClick} className={`w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all relative ${active ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
      <div className="shrink-0">{icon}</div>
      {isOpen && <span className="text-[11px] font-black uppercase tracking-widest truncate">{label}</span>}
      {badge && <div className="absolute right-3 top-3 w-2 h-2 bg-rose-500 rounded-full animate-pulse border-2 border-white dark:border-slate-900" />}
    </button>
  );

  const GroupTreeItem = ({ group, depth }: { group: ProjectGroup, depth: number }) => {
    const isExpanded = expandedGroups.has(group.id);
    const subGroups = groups.filter(g => g.parentId === group.id);
    const groupProjects = projects.filter(p => p.groupId === group.id);

    return (
      <div className="space-y-1">
        <button 
          onClick={(e) => { e.stopPropagation(); const n = new Set(expandedGroups); n.has(group.id) ? n.delete(group.id) : n.add(group.id); setExpandedGroups(n); }}
          className={`w-full flex items-center gap-2 p-2 rounded-xl text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <div className="shrink-0 text-slate-400">
            {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
          </div>
          <Folder size={14} className="shrink-0 text-amber-500" />
          {isOpen && <span className="text-[10px] font-black uppercase tracking-tight truncate">{group.name}</span>}
        </button>
        {isExpanded && (
          <>
            {subGroups.map(sg => <GroupTreeItem key={sg.id} group={sg} depth={depth + 1} />)}
            {groupProjects.map(p => (
              <button key={p.id} onClick={() => onOpenProject(p.id)} className={`w-full flex items-center gap-2 p-2 rounded-xl transition-all ${activeProjectId === p.id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`} style={{ paddingLeft: `${(depth + 1) * 12 + 18}px` }}>
                <Briefcase size={12} className="shrink-0" />
                {isOpen && <span className="text-[11px] truncate">{p.name}</span>}
              </button>
            ))}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-[110] lg:relative lg:translate-x-0 transition-all duration-300 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col ${isOpen ? 'w-72' : 'w-20'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* HEADER COM BOTÃO DE COLAPSO CORRIGIDO PARA MODO RECOLHIDO */}
        <div className={`h-20 flex items-center border-b border-slate-100 dark:border-slate-800 shrink-0 ${isOpen ? 'justify-between px-6' : 'justify-center px-0'}`}>
          {isOpen && (
            <div className="flex items-center gap-3 animate-in fade-in duration-300">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg"><HardHat size={20} /></div>
              <span className="text-sm font-black tracking-tighter uppercase">ProMeasure</span>
            </div>
          )}
          
          <button 
            onClick={() => setIsOpen(!isOpen)} 
            className={`p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all ${!isOpen ? 'bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700' : ''}`}
            title={isOpen ? "Recolher Sidebar" : "Expandir Sidebar"}
          >
            {isOpen ? <ChevronLeft size={20}/> : <Menu size={20}/>}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          <NavItem active={viewMode === 'global-dashboard'} onClick={() => { setViewMode('global-dashboard'); setMobileOpen(false); }} icon={<Home size={18}/>} label="Dashboard" />
          <NavItem active={viewMode === 'bidding-view'} onClick={() => { setViewMode('bidding-view'); setMobileOpen(false); }} icon={<Landmark size={18}/>} label="Licitações" badge={hasAlerts} />
          <NavItem active={viewMode === 'system-settings'} onClick={() => { setViewMode('system-settings'); setMobileOpen(false); }} icon={<Cog size={18}/>} label="Configurações" />
          
          <div className="py-6 px-3 flex items-center justify-between">
            {isOpen && <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Obras Ativas</h3>}
            <button onClick={() => onCreateProject()} className={`text-indigo-500 hover:scale-110 transition-transform ${!isOpen && 'mx-auto'}`}><PlusCircle size={16}/></button>
          </div>

          <div className="space-y-1">
            {groups.filter(g => !g.parentId).map(g => <GroupTreeItem key={g.id} group={g} depth={0} />)}
            {projects.filter(p => !p.groupId).map(p => (
              <button key={p.id} onClick={() => onOpenProject(p.id)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeProjectId === p.id && viewMode === 'project-workspace' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 font-bold' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'} ${!isOpen && 'justify-center'}`}>
                <Briefcase size={16} className="shrink-0" />
                {isOpen && <span className="text-xs truncate text-left">{p.name}</span>}
              </button>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
          <button onClick={toggleDarkMode} className={`w-full flex items-center gap-3 p-3 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl ${!isOpen && 'justify-center'}`}>
            {isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}
            {isOpen && <span className="text-xs font-bold uppercase tracking-widest">{isDarkMode ? 'Claro' : 'Escuro'}</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
