
import React, { useState, useMemo } from 'react';
import { Project, ProjectGroup } from '../types';
import { 
  Briefcase, Plus, Edit2, Trash2, X, AlertTriangle, 
  Folder, ChevronRight, Home, FolderPlus, Save, ChevronLeft,
  Search, ArrowUpRight
} from 'lucide-react';
import { treeService } from '../services/treeService';

interface DashboardViewProps {
  projects: Project[];
  groups: ProjectGroup[];
  onOpenProject: (id: string) => void;
  onCreateProject: () => void;
  onUpdateProjects: (p: Project[]) => void;
  onUpdateGroups: (g: ProjectGroup[]) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ 
  projects, groups, onOpenProject, onCreateProject, onUpdateProjects, onUpdateGroups 
}) => {
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<ProjectGroup | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState<{ type: 'group' | 'project', id: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Itens do nível atual
  const currentGroups = groups.filter(g => g.parentId === currentGroupId);
  const currentProjects = projects.filter(p => p.groupId === currentGroupId);

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    const list: ProjectGroup[] = [];
    let currentId = currentGroupId;
    while (currentId) {
      const g = groups.find(x => x.id === currentId);
      if (g) {
        list.unshift(g);
        currentId = g.parentId;
      } else break;
    }
    return list;
  }, [currentGroupId, groups]);

  const handleCreateGroup = () => {
    const newGroup: ProjectGroup = {
      id: crypto.randomUUID(),
      parentId: currentGroupId,
      name: 'Nova Pasta',
      order: currentGroups.length
    };
    onUpdateGroups([...groups, newGroup]);
  };

  const handleConfirmRename = () => {
    if (!newName.trim()) return;
    if (editingGroup) {
      onUpdateGroups(groups.map(g => g.id === editingGroup.id ? { ...g, name: newName.trim() } : g));
      setEditingGroup(null);
    } else if (editingProject) {
      onUpdateProjects(projects.map(p => p.id === editingProject.id ? { ...p, name: newName.trim() } : p));
      setEditingProject(null);
    }
  };

  const handleConfirmDelete = () => {
    if (!isDeleting) return;
    if (isDeleting.type === 'group') {
      // Deleta grupo e move subpastas/obras para o pai ou raiz
      const groupToDelete = groups.find(g => g.id === isDeleting.id);
      const newParentId = groupToDelete?.parentId || null;
      
      onUpdateGroups(groups.filter(g => g.id !== isDeleting.id).map(g => g.parentId === isDeleting.id ? { ...g, parentId: newParentId } : g));
      onUpdateProjects(projects.map(p => p.groupId === isDeleting.id ? { ...p, groupId: newParentId } : p));
    } else {
      onUpdateProjects(projects.filter(p => p.id !== isDeleting.id));
    }
    setIsDeleting(null);
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return {
      groups: groups.filter(g => g.name.toLowerCase().includes(q)),
      projects: projects.filter(p => p.name.toLowerCase().includes(q))
    };
  }, [searchQuery, groups, projects]);

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-12 custom-scrollbar animate-in fade-in duration-500 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white">Central de Obras</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium font-sans">Gestão hierárquica de portfólio.</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar tudo..." 
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 w-full sm:w-64"
                />
             </div>
             <button onClick={handleCreateGroup} className="p-3 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-800 hover:text-indigo-600 transition-colors shadow-sm" title="Nova Pasta">
                <FolderPlus size={18} />
             </button>
             <button onClick={onCreateProject} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all">
                <Plus size={16} /> Nova Obra
             </button>
          </div>
        </div>

        {/* BREADCRUMBS OU BUSCA */}
        {!searchQuery && (
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <button onClick={() => setCurrentGroupId(null)} className={`flex items-center gap-1 hover:text-indigo-600 transition-colors ${!currentGroupId ? 'text-indigo-600' : ''}`}>
              <Home size={14} /> Raiz
            </button>
            {breadcrumbs.map(b => (
              <React.Fragment key={b.id}>
                <ChevronRight size={12} className="opacity-40" />
                <button onClick={() => setCurrentGroupId(b.id)} className="hover:text-indigo-600 transition-colors">
                  {b.name}
                </button>
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* CONTEÚDO PRINCIPAL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {searchQuery ? (
            /* VISUALIZAÇÃO DE BUSCA */
            <>
              {filteredItems?.groups.map(g => (
                <GroupCard 
                  key={g.id} group={g} 
                  onOpen={() => { setCurrentGroupId(g.id); setSearchQuery(''); }}
                  onRename={() => { setEditingGroup(g); setNewName(g.name); }}
                  onDelete={() => setIsDeleting({ type: 'group', id: g.id })}
                />
              ))}
              {filteredItems?.projects.map(p => (
                <ProjectCard 
                  key={p.id} project={p}
                  onOpen={() => onOpenProject(p.id)}
                  onRename={() => { setEditingProject(p); setNewName(p.name); }}
                  onDelete={() => setIsDeleting({ type: 'project', id: p.id })}
                />
              ))}
            </>
          ) : (
            /* VISUALIZAÇÃO ESTRUTURADA */
            <>
              {currentGroupId && (
                <button 
                  onClick={() => setCurrentGroupId(breadcrumbs[breadcrumbs.length - 2]?.id || null)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all border-dashed"
                >
                  <ChevronLeft size={24} /> <span className="text-[10px] font-black uppercase tracking-widest ml-2">Voltar</span>
                </button>
              )}
              
              {currentGroups.map(g => (
                <GroupCard 
                  key={g.id} group={g} 
                  onOpen={() => setCurrentGroupId(g.id)}
                  onRename={() => { setEditingGroup(g); setNewName(g.name); }}
                  onDelete={() => setIsDeleting({ type: 'group', id: g.id })}
                />
              ))}
              
              {currentProjects.map(p => (
                <ProjectCard 
                  key={p.id} project={p}
                  onOpen={() => onOpenProject(p.id)}
                  onRename={() => { setEditingProject(p); setNewName(p.name); }}
                  onDelete={() => setIsDeleting({ type: 'project', id: p.id })}
                />
              ))}

              {currentGroups.length === 0 && currentProjects.length === 0 && (
                <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-300 dark:text-slate-800">
                  <Folder size={48} className="opacity-20 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Pasta vazia</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MODAL DE RENOMEAR (GENÉRICO) */}
      {(editingGroup || editingProject) && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={() => { setEditingGroup(null); setEditingProject(null); }}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-black mb-6">Renomear {editingGroup ? 'Pasta' : 'Obra'}</h2>
            <input 
              autoFocus
              className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black focus:border-indigo-500 outline-none transition-all mb-6"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirmRename()}
            />
            <button onClick={handleConfirmRename} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
              <Save size={16} /> Salvar Alterações
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE EXCLUSÃO */}
      {isDeleting && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={() => setIsDeleting(null)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><AlertTriangle size={32} /></div>
            <h2 className="text-xl font-black mb-2">Excluir permanentemente?</h2>
            <p className="text-slate-500 text-sm mb-8">Ao excluir uma pasta, os itens contidos serão movidos para o nível anterior. Obras excluídas não podem ser recuperadas.</p>
            <div className="flex gap-3">
              <button onClick={() => setIsDeleting(null)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
              <button onClick={handleConfirmDelete} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const GroupCard = ({ group, onOpen, onRename, onDelete }: any) => (
  <div onClick={onOpen} className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all cursor-pointer relative overflow-hidden">
    <div className="flex justify-between items-start mb-6">
      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-2xl"><Folder size={20}/></div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={e => { e.stopPropagation(); onRename(); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 size={14}/></button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-2 text-slate-400 hover:text-rose-600"><Trash2 size={14}/></button>
      </div>
    </div>
    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight truncate">{group.name}</h3>
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Pasta do Sistema</p>
  </div>
);

const ProjectCard = ({ project, onOpen, onRename, onDelete }: any) => {
  const stats = treeService.calculateBasicStats(project.items, project.bdi);
  return (
    <div onClick={onOpen} className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all cursor-pointer relative overflow-hidden">
      <div className="flex justify-between items-start mb-6">
        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-2xl"><Briefcase size={20}/></div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={e => { e.stopPropagation(); onRename(); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 size={14}/></button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-2 text-slate-400 hover:text-rose-600"><Trash2 size={14}/></button>
        </div>
      </div>
      <h3 className="text-sm font-black text-slate-800 dark:text-white truncate uppercase tracking-tight">{project.name}</h3>
      <div className="mt-4 space-y-2">
        <div className="flex justify-between items-end text-[8px] font-black uppercase tracking-widest text-slate-400">
           <span>Execução</span>
           <span className="text-indigo-600">{stats.progress.toFixed(1)}%</span>
        </div>
        <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${stats.progress}%` }} />
        </div>
      </div>
    </div>
  );
};
