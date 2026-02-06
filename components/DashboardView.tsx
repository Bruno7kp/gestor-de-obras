import React, { useState, useMemo } from 'react';
import { Project, ProjectGroup } from '../types';
import { 
  Briefcase, Plus, Edit2, Trash2, AlertTriangle, 
  Folder, ChevronRight, Home, FolderPlus, Save, ChevronLeft, Search,
  FolderInput, X, Check, Target, Layers, GripVertical
} from 'lucide-react';
import { treeService } from '../services/treeService';
import { projectService } from '../services/projectService';
import { projectsApi } from '../services/projectsApi';
import { projectGroupsApi } from '../services/projectGroupsApi';
import { DragDropContext, Droppable, Draggable, DropResult, DraggableProvided } from '@hello-pangea/dnd';

interface DashboardViewProps {
  projects: Project[];
  groups: ProjectGroup[];
  onOpenProject: (id: string) => void;
  onCreateProject: (groupId?: string | null) => void;
  onUpdateProject: (p: Project[]) => void;
  onUpdateGroups: (g: ProjectGroup[]) => void;
  onBulkUpdate: (updates: { projects?: Project[], groups?: ProjectGroup[] }) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = (props) => {
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<ProjectGroup | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [movingItem, setMovingItem] = useState<{ type: 'group' | 'project', id: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState<{ type: 'group' | 'project', id: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const currentGroups = useMemo(() => 
    props.groups.filter(g => g.parentId === currentGroupId), 
    [props.groups, currentGroupId]
  );
  
  const currentProjects = useMemo(() => 
    props.projects.filter(p => p.groupId === currentGroupId), 
    [props.projects, currentGroupId]
  );

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

  const refreshLists = async () => {
    const [projects, groups] = await Promise.all([
      projectsApi.list(),
      projectGroupsApi.list(),
    ]);
    props.onBulkUpdate({ projects, groups });
  };

  const handleDragEnd = async (result: DropResult) => {
    const sourceId = result.draggableId;
    const cleanSourceId = sourceId.replace('grp-', '').replace('prj-', '');
    const type = sourceId.startsWith('grp-') ? 'group' : 'project';

    if (result.combine) {
      const targetId = result.combine.draggableId;
      let targetGroupId: string | null = null;
      
      if (targetId === 'target-root') {
        targetGroupId = null;
      } else if (targetId === 'target-back') {
        targetGroupId = breadcrumbs[breadcrumbs.length - 2]?.id || null;
      } else if (targetId.startsWith('grp-')) {
        targetGroupId = targetId.replace('grp-', '');
      } else {
        return;
      }

      if (cleanSourceId === targetGroupId) return;

      try {
        if (type === 'project') {
          await projectsApi.update(cleanSourceId, { groupId: targetGroupId });
        } else {
          await projectGroupsApi.update(cleanSourceId, { parentId: targetGroupId });
        }
        await refreshLists();
      } catch (error) {
        console.error('Erro ao mover item:', error);
      }
      return;
    }

    if (result.destination && result.destination.droppableId.startsWith('breadcrumb-')) {
      const targetGroupId = result.destination.droppableId === 'breadcrumb-root' 
        ? null 
        : result.destination.droppableId.replace('breadcrumb-', '');

      try {
        if (type === 'project') {
          await projectsApi.update(cleanSourceId, { groupId: targetGroupId });
        } else {
          await projectGroupsApi.update(cleanSourceId, { parentId: targetGroupId });
        }
        await refreshLists();
      } catch (error) {
        console.error('Erro ao mover item:', error);
      }
      return;
    }
  };

  const handleConfirmMove = async (targetGroupId: string | null) => {
    if (!movingItem) return;
    try {
      if (movingItem.type === 'project') {
        await projectsApi.update(movingItem.id, { groupId: targetGroupId });
      } else {
        await projectGroupsApi.update(movingItem.id, { parentId: targetGroupId });
      }
      await refreshLists();
    } catch (error) {
      console.error('Erro ao mover item:', error);
    } finally {
      setMovingItem(null);
    }
  };

  const handleCreateFolder = async () => {
    try {
      const newGroup = await projectGroupsApi.create({
        name: 'Nova Pasta',
        parentId: currentGroupId,
        order: currentGroups.length,
      });
      props.onUpdateGroups([...props.groups, newGroup]);
    } catch (error) {
      console.error('Erro ao criar pasta:', error);
    }
  };

  const handleConfirmRename = async () => {
    if (!newName.trim()) return;
    try {
      if (editingGroup) {
        const updatedGroup = await projectGroupsApi.update(editingGroup.id, { name: newName.trim() });
        props.onUpdateGroups(props.groups.map(g => g.id === editingGroup.id ? updatedGroup : g));
        setEditingGroup(null);
      } else if (editingProject) {
        const updatedProject = await projectsApi.update(editingProject.id, { name: newName.trim() });
        props.onUpdateProject(props.projects.map(p => p.id === editingProject.id ? { ...p, ...updatedProject } : p));
        setEditingProject(null);
      }
    } catch (error) {
      console.error('Erro ao renomear item:', error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!isDeleting) return;
    try {
      if (isDeleting.type === 'group') {
        await projectGroupsApi.remove(isDeleting.id);
        await refreshLists();
        if (currentGroupId === isDeleting.id) setCurrentGroupId(null);
      } else {
        await projectsApi.remove(isDeleting.id);
        const updatedList = props.projects.filter(p => p.id !== isDeleting.id);
        props.onUpdateProject(updatedList);
      }
    } catch (error) {
      console.error('Erro ao excluir item:', error);
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredGroups = searchQuery 
    ? props.groups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];
    
  const filteredProjects = searchQuery
    ? props.projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-12 animate-in fade-in duration-500 bg-slate-50 dark:bg-slate-950 custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-8">
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

        <DragDropContext onDragEnd={handleDragEnd}>
          {!searchQuery && (
            <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 overflow-x-auto no-scrollbar py-2">
              <Droppable droppableId="breadcrumb-root">
                {(provided, snapshot) => (
                  <div 
                    ref={provided.innerRef} 
                    {...provided.droppableProps}
                    className={`transition-all rounded-lg px-2 py-1 ${snapshot.isDraggingOver ? 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-500 ring-dashed scale-110' : ''}`}
                  >
                    <button onClick={() => setCurrentGroupId(null)} className={`flex items-center gap-1 hover:text-indigo-600 transition-colors ${!currentGroupId ? 'text-indigo-600 font-black' : ''}`}>
                      <Home size={14} /> Raiz
                    </button>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              {breadcrumbs.map((b, idx) => (
                <React.Fragment key={b.id}>
                  <ChevronRight size={12} className="opacity-40" />
                  <Droppable droppableId={`breadcrumb-${b.id}`}>
                    {(provided, snapshot) => (
                      <div 
                        ref={provided.innerRef} 
                        {...provided.droppableProps}
                        className={`transition-all rounded-lg px-2 py-1 ${snapshot.isDraggingOver ? 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-500 ring-dashed scale-110' : ''}`}
                      >
                        <button 
                          onClick={() => setCurrentGroupId(b.id)} 
                          className={`hover:text-indigo-600 transition-colors whitespace-nowrap ${idx === breadcrumbs.length - 1 ? 'text-indigo-500 font-black' : ''}`}
                        >
                          {b.name}
                        </button>
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </React.Fragment>
              ))}
            </nav>
          )}

          <Droppable droppableId="dashboard-grid" direction="horizontal" isCombineEnabled>
            {(provided) => (
              <div 
                {...provided.droppableProps} 
                ref={provided.innerRef}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              >
                {!searchQuery && currentGroupId && (
                  <Draggable draggableId="target-back" index={0} isDragDisabled={true}>
                    {(p, s) => (
                      <div
                        ref={p.innerRef}
                        {...p.draggableProps}
                        onClick={() => setCurrentGroupId(breadcrumbs[breadcrumbs.length - 2]?.id || null)}
                        className={`bg-white dark:bg-slate-900 border-2 border-dashed rounded-[2rem] p-6 flex flex-col items-center justify-center transition-all group h-full cursor-pointer ${s.combineTargetFor ? 'bg-indigo-50 border-indigo-500 ring-4 ring-indigo-500/20 scale-105' : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-indigo-600 hover:bg-slate-50'}`}
                      >
                        <ChevronLeft size={32} className={`${s.combineTargetFor ? 'animate-bounce' : 'group-hover:-translate-x-1'} transition-transform`} /> 
                        <span className="text-[10px] font-black uppercase tracking-widest mt-2">Mover para cima</span>
                      </div>
                    )}
                  </Draggable>
                )}

                {searchQuery ? (
                  <>
                    {filteredGroups.map((g, idx) => (
                      <Draggable key={`grp-${g.id}`} draggableId={`grp-${g.id}`} index={idx}>
                        {(p) => (
                          <FolderCard 
                            provided={p} 
                            group={g} 
                            onOpen={() => { setCurrentGroupId(g.id); setSearchQuery(''); }} 
                            onRename={() => { setEditingGroup(g); setNewName(g.name); }} 
                            onDelete={() => setIsDeleting({ type: 'group', id: g.id })} 
                            onMove={() => setMovingItem({ type: 'group', id: g.id })} 
                          />
                        )}
                      </Draggable>
                    ))}
                    {filteredProjects.map((p, idx) => (
                      <Draggable key={`prj-${p.id}`} draggableId={`prj-${p.id}`} index={idx + filteredGroups.length}>
                        {(pr) => (
                          <ProjectCard 
                            provided={pr} 
                            project={p} 
                            onOpen={() => props.onOpenProject(p.id)} 
                            onRename={() => { setEditingProject(p); setNewName(p.name); }} 
                            onDelete={() => setIsDeleting({ type: 'project', id: p.id })} 
                            onMove={() => setMovingItem({ type: 'project', id: p.id })} 
                          />
                        )}
                      </Draggable>
                    ))}
                  </>
                ) : (
                  <>
                    {currentGroups.map((g, idx) => {
                      const baseIdx = (currentGroupId ? 1 : 0) + idx;
                      return (
                        <Draggable key={`grp-${g.id}`} draggableId={`grp-${g.id}`} index={baseIdx}>
                          {(p) => (
                            <FolderCard 
                              provided={p} 
                              group={g} 
                              onOpen={() => setCurrentGroupId(g.id)} 
                              onRename={() => { setEditingGroup(g); setNewName(g.name); }} 
                              onDelete={() => setIsDeleting({ type: 'group', id: g.id })} 
                              onMove={() => setMovingItem({ type: 'group', id: g.id })} 
                            />
                          )}
                        </Draggable>
                      );
                    })}
                    {currentProjects.map((p, idx) => {
                      const baseIdx = (currentGroupId ? 1 : 0) + currentGroups.length + idx;
                      return (
                        <Draggable key={`prj-${p.id}`} draggableId={`prj-${p.id}`} index={baseIdx}>
                          {(pr) => (
                            <ProjectCard 
                              provided={pr} 
                              project={p} 
                              onOpen={() => props.onOpenProject(p.id)} 
                              onRename={() => { setEditingProject(p); setNewName(p.name); }} 
                              onDelete={() => setIsDeleting({ type: 'project', id: p.id })} 
                              onMove={() => setMovingItem({ type: 'project', id: p.id })} 
                            />
                          )}
                        </Draggable>
                      );
                    })}
                    {currentGroups.length === 0 && currentProjects.length === 0 && !currentGroupId && <EmptyState />}
                  </>
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {(editingGroup || editingProject) && (
        <RenameDialog 
          name={newName} 
          setName={setNewName} 
          title={editingGroup ? 'Pasta' : 'Obra'} 
          onCancel={() => { setEditingGroup(null); setEditingProject(null); }} 
          onConfirm={handleConfirmRename} 
        />
      )}

      {movingItem && (
        <MoveDialog 
          groups={props.groups}
          activeItem={movingItem}
          onCancel={() => setMovingItem(null)}
          onConfirm={handleConfirmMove}
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

// SUB-COMPONENTES
const FolderCard = ({ group, onOpen, onRename, onDelete, onMove, provided }: { 
  group: ProjectGroup, 
  onOpen: () => void, 
  onRename: () => void, 
  onDelete: () => void, 
  onMove: () => void, 
  provided: DraggableProvided 
}) => (
  <div 
    ref={provided.innerRef}
    {...provided.draggableProps}
    {...provided.dragHandleProps}
    onClick={onOpen} 
    className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all cursor-pointer relative overflow-hidden h-full"
  >
    <div className="flex justify-between items-start mb-8">
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-2xl group-hover:scale-110 transition-transform"><Folder size={24}/></div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
        <button title="Mover" onClick={e => { e.stopPropagation(); onMove(); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><FolderInput size={16}/></button>
        <button title="Renomear" onClick={e => { e.stopPropagation(); onRename(); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 size={16}/></button>
        <button title="Excluir" onClick={e => { e.stopPropagation(); onDelete(); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button>
      </div>
    </div>
    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight truncate">{group.name}</h3>
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Diretório Estrutural</p>
  </div>
);

const ProjectCard = ({ project, onOpen, onRename, onDelete, onMove, provided }: {
  project: Project,
  onOpen: () => void,
  onRename: () => void,
  onDelete: () => void,
  onMove: () => void,
  provided: DraggableProvided
}) => {
  const stats = treeService.calculateBasicStats(project.items, project.bdi || 0);
  return (
    <div 
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={onOpen} 
      className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all cursor-pointer relative overflow-hidden h-full"
    >
      <div className="flex justify-between items-start mb-8">
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-2xl group-hover:scale-110 transition-transform"><Briefcase size={24}/></div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
          <button title="Mover" onClick={e => { e.stopPropagation(); onMove(); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><FolderInput size={16}/></button>
          <button title="Renomear" onClick={e => { e.stopPropagation(); onRename(); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 size={16}/></button>
          <button title="Excluir" onClick={e => { e.stopPropagation(); onDelete(); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button>
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

const MoveDialog = ({ groups, activeItem, onCancel, onConfirm }: any) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onCancel}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl"><FolderInput size={20}/></div>
             <div>
               <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase">Mover Item</h2>
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Selecione o destino</p>
             </div>
          </div>
          <button onClick={onCancel} className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all"><X size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-100 dark:border-slate-800 rounded-2xl p-2 mb-6">
          <button 
            onClick={() => setSelectedGroupId(null)}
            className={`w-full flex items-center justify-between p-4 rounded-xl transition-all mb-1 ${selectedGroupId === null ? 'bg-indigo-600 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
          >
            <div className="flex items-center gap-3">
              <Home size={16}/>
              <span className="text-xs font-black uppercase">Diretório Raiz</span>
            </div>
            {selectedGroupId === null && <Check size={16}/>}
          </button>

          <div className="space-y-1">
            {groups.map((g: ProjectGroup) => (
              <button 
                key={g.id}
                disabled={activeItem.type === 'group' && activeItem.id === g.id}
                onClick={() => setSelectedGroupId(g.id)}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed ${selectedGroupId === g.id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
              >
                <div className="flex items-center gap-3">
                  <Folder size={16} className={selectedGroupId === g.id ? 'text-white' : 'text-amber-500'}/>
                  <span className="text-xs font-bold truncate">{g.name}</span>
                </div>
                {selectedGroupId === g.id && <Check size={16}/>}
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={() => onConfirm(selectedGroupId)} 
          className="w-full py-5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Target size={16} /> Confirmar Transferência
        </button>
      </div>
    </div>
  );
};

const RenameDialog = ({ name, setName, title, onCancel, onConfirm }: any) => (
  <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onCancel}>
    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
      <h2 className="text-xl font-black mb-6 text-slate-800 dark:text-white">Renomear {title}</h2>
      <input autoFocus className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black focus:border-indigo-500 outline-none transition-all mb-6" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && onConfirm()} />
      <button onClick={onConfirm} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"><Save size={16} className="inline mr-2" /> Salvar</button>
    </div>
  </div>
);

const DeleteConfirmDialog = ({ onCancel, onConfirm }: any) => (
  <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onCancel}>
    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-10 border border-slate-200 dark:border-slate-800 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
      <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6"><AlertTriangle size={40} /></div>
      <h2 className="text-2xl font-black mb-3 text-slate-800 dark:text-white">Remover Item?</h2>
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
