
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Cog, PlusCircle, Briefcase, Sun, Moon, Menu, HardHat, Folder, ChevronRight, ChevronLeft, ChevronDown, Landmark, Truck, Shield, User, LogOut, ChevronUp, Lock } from 'lucide-react';
import { Project, ProjectGroup, CompanyCertificate } from '../types';
import { biddingService } from '../services/biddingService';
import { useAuth } from '../auth/AuthContext';
import { usePermissions } from '../hooks/usePermissions';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
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
  isOpen, setIsOpen, mobileOpen, setMobileOpen,
  projects, groups, activeProjectId, onOpenProject, onCreateProject, isDarkMode, toggleDarkMode, certificates
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { canView, getLevel } = usePermissions();
  // Inicializa estado do localStorage para persistir pastas abertas
  // Fix: Explicitly type Set in lazy initializer to avoid 'Set<unknown>' inference
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('promeasure_sidebar_expanded_v4');
    return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
  });

  useEffect(() => {
    localStorage.setItem('promeasure_sidebar_expanded_v4', JSON.stringify(Array.from(expandedGroups)));
  }, [expandedGroups]);

  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!accountRef.current) return;
      if (accountRef.current.contains(event.target as Node)) return;
      setAccountOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const hasAlerts = biddingService.hasGlobalAlerts(certificates);
  const isSuperAdmin = user?.roles?.includes('SUPER_ADMIN');
  const accountName = user?.name || user?.email || 'Usuario';
  const instanceDisplayName = user?.instanceName || '';

  const handleLogout = async () => {
    await logout();
    setAccountOpen(false);
    setMobileOpen(false);
    navigate('/login');
  };

  const NavItem = ({ active, onClick, icon, label, badge }: any) => (
    <button onClick={onClick} className={`w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all relative ${active ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
      <div className="shrink-0">{icon}</div>
      {isOpen && <span className="text-[11px] font-black uppercase tracking-widest truncate">{label}</span>}
      {badge && <div className="absolute right-3 top-3 w-2 h-2 bg-rose-500 rounded-full animate-pulse border-2 border-white dark:border-slate-900" />}
    </button>
  );

  // Fix: Explicitly type GroupTreeItem as React.FC to handle React's intrinsic key prop and satisfy strict TS checks
  const GroupTreeItem: React.FC<{ group: ProjectGroup, depth: number }> = ({ group, depth }) => {
    const isExpanded = expandedGroups.has(group.id);
    const subGroups = groups.filter(g => g.parentId === group.id);
    const groupProjects = projects.filter(p => p.groupId === group.id);

    return (
      <div className="space-y-1">
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            const n = new Set<string>(expandedGroups); 
            n.has(group.id) ? n.delete(group.id) : n.add(group.id); 
            setExpandedGroups(n); 
          }}
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
              <button key={p.id} onClick={() => onOpenProject(p.id)} className={`w-full flex items-center gap-2 p-2 rounded-xl transition-all ${activeProjectId === p.id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 font-bold' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`} style={{ paddingLeft: `${(depth + 1) * 12 + 18}px` }}>
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
          <NavItem
            active={location.pathname.startsWith('/app/dashboard') || location.pathname === '/app'}
            onClick={() => { navigate('/app/dashboard'); setMobileOpen(false); }}
            icon={<Home size={18}/>}
            label="Dashboard"
          />
          {canView('biddings') && (
            <NavItem
              active={location.pathname.startsWith('/app/biddings')}
              onClick={() => { navigate('/app/biddings'); setMobileOpen(false); }}
              icon={<Landmark size={18}/>}
              label={`Licitações ${getLevel('biddings') === 'view' ? '(leitura)' : ''}`}
              badge={hasAlerts && canView('biddings')}
            />
          )}
          {canView('suppliers') && (
            <NavItem
              active={location.pathname.startsWith('/app/suppliers')}
              onClick={() => { navigate('/app/suppliers'); setMobileOpen(false); }}
              icon={<Truck size={18}/>}
              label={`Fornecedores ${getLevel('suppliers') === 'view' ? '(leitura)' : ''}`}
            />
          )}
          
          <div className="py-6 px-3 flex items-center justify-between">
            {isOpen && <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Obras Ativas</h3>}
            <button onClick={() => onCreateProject()} className={`text-indigo-500 hover:scale-110 transition-transform ${!isOpen && 'mx-auto'}`}><PlusCircle size={16}/></button>
          </div>

          <div className="space-y-1">
            {groups.filter(g => !g.parentId).map(g => <GroupTreeItem key={g.id} group={g} depth={0} />)}
            {projects.filter(p => !p.groupId).map(p => (
              <button key={p.id} onClick={() => onOpenProject(p.id)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeProjectId === p.id && location.pathname.startsWith('/app/projects') ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 font-bold' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'} ${!isOpen && 'justify-center'}`}>
                <Briefcase size={16} className="shrink-0" />
                {isOpen && <span className="text-xs truncate text-left">{p.name}</span>}
              </button>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="relative" ref={accountRef}>
            <button
              onClick={() => setAccountOpen((prev) => !prev)}
              className={`w-full flex items-center gap-3 p-3 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all ${!isOpen && 'justify-center'}`}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
            >
              <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
                <User size={16} />
              </div>
              {isOpen && (
                <div className="flex-1 min-w-0">
                  {instanceDisplayName && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {instanceDisplayName}
                    </p>
                  )}
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{accountName}</p>
                </div>
              )}
              {isOpen && (
                <ChevronUp
                  size={16}
                  className={`text-slate-400 transition-transform ${accountOpen ? '' : 'rotate-180'}`}
                />
              )}
            </button>

            {accountOpen && (
              <div
                className={`absolute ${isOpen ? 'right-0' : 'left-0'} bottom-14 w-64 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden z-50`}
                role="menu"
              >
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  {instanceDisplayName && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {instanceDisplayName}
                    </p>
                  )}
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{accountName}</p>
                </div>
                <div className="p-2 flex flex-col gap-1">
                  <button
                    onClick={() => {
                      setAccountOpen(false);
                      setMobileOpen(false);
                      navigate('/app/settings');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    role="menuitem"
                  >
                    <Cog size={16} />
                    <span className="text-xs font-black uppercase tracking-widest">Configuracoes</span>
                  </button>
                  <button
                    onClick={() => {
                      toggleDarkMode();
                      setAccountOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    role="menuitem"
                  >
                    {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                    <span className="text-xs font-black uppercase tracking-widest">Trocar tema</span>
                  </button>
                  {isSuperAdmin && (
                    <button
                      onClick={() => {
                        setAccountOpen(false);
                        setMobileOpen(false);
                        navigate('/superadmin');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      role="menuitem"
                    >
                      <Shield size={16} />
                      <span className="text-xs font-black uppercase tracking-widest">Superadmin</span>
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                    role="menuitem"
                  >
                    <LogOut size={16} />
                    <span className="text-xs font-black uppercase tracking-widest">Sair</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
