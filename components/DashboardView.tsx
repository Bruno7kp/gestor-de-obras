import React, { useState, useMemo } from 'react';
import { Project, ProjectGroup } from '../types';
import { 
  Briefcase, Plus, Edit2, Trash2, AlertTriangle, 
  Folder, ChevronRight, Home, FolderPlus, Save, ChevronLeft, Search
} from 'lucide-react';
import { treeService } from '../services/treeService';
import { projectService } from '../services/projectService';
// 1. Importe o hook de estado global
import { useProjectState } from '../hooks/useProjectState';

interface DashboardViewProps {
  projects: Project[];
  groups: ProjectGroup[];
  onOpenProject: (id: string) => void;
  onCreateProject: (groupId?: string | null) => void;
  // Note que onUpdateProject e outros podem ser removidos das props se você usar o dispatch direto
}

export const DashboardView: React.FC<DashboardViewProps> = (props) => {
  // 2. Acesse o dispatch global
  const { dispatch } = useProjectState();
  
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<ProjectGroup | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState<{ type: 'group' | 'project', id: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const currentGroups = props.groups.filter(g => g.parentId === currentGroupId);
  const currentProjects = props.projects.filter(p => p.groupId === currentGroupId);

  const breadcrumbs = useMemo(() => {
    const list: ProjectGroup[] = [];
    let currentId = currentGroupId;
    while (currentId) {
      const g = props.groups.find(x => x.id === currentId);
      if (g) {
        list.unshift(g);
        currentId = g.parentId;
      } else break;
    }
    return list;
  }, [currentGroupId, props.groups]);

  const handleCreateFolder = () => {
    const newGroup = projectService.createGroup('Nova Pasta', currentGroupId, currentGroups.length);
    // 3. Use dispatch para atualizar grupos
    dispatch({ type: 'SET_GROUPS', payload: [...props.groups, newGroup] });
  };

  const handleConfirmRename = () => {
    if (!newName.trim()) return;
    if (editingGroup) {
      const updatedGroups = props.groups.map(g => g.id === editingGroup.id ? { ...g, name: newName.trim() } : g);
      dispatch({ type: 'SET_GROUPS', payload: updatedGroups });
      setEditingGroup(null);
    } else if (editingProject) {
      const updatedProjects = props.projects.map(p => p.id === editingProject.id ? { ...p, name: newName.trim() } : p);
      // 4. Use dispatch para atualizar projetos
      dispatch({ type: 'SET_PROJECTS', payload: updatedProjects });
      setEditingProject(null);
    }
  };

  const handleConfirmDelete = () => {
    if (!isDeleting) return;

    if (isDeleting.type === 'group') {
      const { updatedGroups, updatedProjects, newParentId } = projectService.getReassignedItems(isDeleting.id, props.groups, props.projects);
      
      // 5. Atualização em massa via dispatch
      dispatch({ type: 'SET_GROUPS', payload: updatedGroups });
      dispatch({ type: 'SET_PROJECTS', payload: updatedProjects });
      
      if (currentGroupId === isDeleting.id) setCurrentGroupId(newParentId);
    } else {
      // 6. Exclusão de projeto individual via dispatch
      dispatch({ type: 'DELETE_PROJECT', payload: isDeleting.id });
    }
    setIsDeleting(null);
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return {
      groups: props.groups.filter(g => g.name.toLowerCase().includes(q)),
      projects: props.projects.filter(p => p.name.toLowerCase().includes(q))
    };
  }, [searchQuery, props.groups, props.projects]);

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-12 animate-in fade-in duration-500 bg-slate-50 dark:bg-slate-950 custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* TOP ACTION BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <header>
            <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white">Central de Obras</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Gestão hierárquica por portfólio.</p>
          </header>
          <div className="flex items-center gap-3">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar..." 
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 w-full sm:w-64 transition-all"
                />
             </div>
             <button onClick={handleCreateFolder} className="p-3 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-800 hover:text-indigo-600 shadow-sm transition-all">
                <FolderPlus size={18} />
             </button>
             <button onClick={() => props.onCreateProject(currentGroupId)} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all">
                <Plus size={16} /> Nova Obra
             </button>
          </div>
        </div>

        {/* BREADCRUMBS NAVIGATION */}
        {!searchQuery && (
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 overflow-x-auto no-scrollbar py-2">
            <button onClick={() => setCurrentGroupId(null)} className={`flex items-center gap-1 hover:text-indigo-600 transition-colors ${!currentGroupId ? 'text-indigo-600' : ''}`}>
              <Home size={14} /> Raiz
            </button>
            {breadcrumbs.map(b => (
              <React.Fragment key={b.id}>
                <ChevronRight size={12} className="opacity-40" />
                <button onClick={() => setCurrentGroupId(b.id)} className="hover:text-indigo-600 transition-colors whitespace-nowrap">{b.name}</button>
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* MAIN GRID AREA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {searchQuery ? (
            /* SEARCH VIEW */
            <>
              {filteredItems?.groups.map(g => (
                <FolderCard key={g.id} group={g} onOpen={() => { setCurrentGroupId(g.id); setSearchQuery(''); }} onRename={() => { setEditingGroup(g); setNewName(g.name); }} onDelete={() => setIsDeleting({ type: 'group', id: g.id })} />
              ))}
              {filteredItems?.projects.map(p => (
                <ProjectCard key={p.id} project={p} onOpen={() => props.onOpenProject(p.id)} onRename={() => { setEditingProject(p); setNewName(p.name); }} onDelete={() => setIsDeleting({ type: 'project', id: p.id })} />
              ))}
            </>
          ) : (
            /* BROWSE VIEW */
            <>
              {currentGroupId && (
                <button onClick={() => setCurrentGroupId(breadcrumbs[breadcrumbs.length - 2]?.id || null)} className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 border-dashed rounded-[2rem] p-6 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all hover:bg-slate-50 group">
                  <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" /> 
                  <span className="text-[10px] font-black uppercase tracking-widest ml-2">Voltar</span>
                </button>
              )}
              {currentGroups.map(g => (
                <FolderCard key={g.id} group={g} onOpen={() => setCurrentGroupId(g.id)} onRename={() => { setEditingGroup(g); setNewName(g.name); }} onDelete={() => setIsDeleting({ type: 'group', id: g.id })} />
              ))}
              {currentProjects.map(p => (
                <ProjectCard key={p.id} project={p} onOpen={() => props.onOpenProject(p.id)} onRename={() => { setEditingProject(p); setNewName(p.name); }} onDelete={() => setIsDeleting({ type: 'project', id: p.id })} />
              ))}
              {currentGroups.length === 0 && currentProjects.length === 0 && <EmptyState />}
            </>
          )}
        </div>
      </div>

      {/* MODALS OVERLAY */}
      {(editingGroup || editingProject) && (
        <RenameDialog 
          name={newName} 
          setName={setNewName} 
          title={editingGroup ? 'Pasta' : 'Obra'} 
          onCancel={() => { setEditingGroup(null); setEditingProject(null); }} 
          onConfirm={handleConfirmRename} 
        />
      )}

      {isDeleting && (
        <DeleteConfirmDialog 
          onCancel={() => setIsDeleting(null)} 
          onConfirm={handleConfirmDelete} 
        />
      )}
    </div>
  );
};

// SUB-COMPONENTS
const FolderCard = ({ group, onOpen, onRename, onDelete }: any) => (
  <div onClick={onOpen} className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all cursor-pointer relative overflow-hidden">
    <div className="flex justify-between items-start mb-8">
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-2xl group-hover:scale-110 transition-transform"><Folder size={24}/></div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
        <button onClick={e => { e.stopPropagation(); onRename(); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 size={16}/></button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button>
      </div>
    </div>
    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight truncate">{group.name}</h3>
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Diretório Estrutural</p>
  </div>
);

const ProjectCard = ({ project, onOpen, onRename, onDelete }: any) => {
  const stats = treeService.calculateBasicStats(project.items, project.bdi);
  return (
    <div onClick={onOpen} className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all cursor-pointer relative overflow-hidden">
      <div className="flex justify-between items-start mb-8">
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-2xl group-hover:scale-110 transition-transform"><Briefcase size={24}/></div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
          <button onClick={e => { e.stopPropagation(); onRename(); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 size={16}/></button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button>
        </div>
      </div>
      <h3 className="text-sm font-black text-slate-800 dark:text-white truncate uppercase tracking-tight">{project.name}</h3>
      <div className="mt-6 space-y-2">
        <div className="flex justify-between items-end text-[8px] font-black uppercase tracking-widest text-slate-400">
           <span>Avanço Físico</span>
           <span className="text-indigo-600">{stats.progress.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 transition-all duration-1000 ease-out" style={{ width: `${stats.progress}%` }} />
        </div>
      </div>
    </div>
  );
};

const RenameDialog = ({ name, setName, title, onCancel, onConfirm }: any) => (
  <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onCancel}>
    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
      <h2 className="text-xl font-black mb-6">Renomear {title}</h2>
      <input autoFocus className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black focus:border-indigo-500 outline-none transition-all mb-6" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && onConfirm()} />
      <button onClick={onConfirm} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"><Save size={16} className="inline mr-2" /> Salvar</button>
    </div>
  </div>
);

const DeleteConfirmDialog = ({ onCancel, onConfirm }: any) => (
  <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onCancel}>
    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-10 border border-slate-200 dark:border-slate-800 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
      <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6"><AlertTriangle size={40} /></div>
      <h2 className="text-2xl font-black mb-3">Remover Item?</h2>
      <p className="text-slate-500 text-sm mb-10 leading-relaxed">Esta ação não pode ser desfeita. Para pastas, as obras internas serão preservadas e movidas para o nível superior.</p>
      <div className="flex gap-4">
        <button onClick={onCancel} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 rounded-2xl">Cancelar</button>
        <button onClick={onConfirm} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-rose-500/20 active:scale-95 transition-all">Excluir</button>
      </div>
    </div>
  </div>
);

const EmptyState = () => (
  <div className="col-span-full py-20 text-center opacity-30 select-none flex flex-col items-center">
    <Folder size={64} className="mb-4" />
    <p className="text-xs font-black uppercase tracking-[0.2em]">Diretório sem conteúdo</p>
  </div>
);
