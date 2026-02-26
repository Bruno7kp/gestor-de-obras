import React, { useState, useMemo, useEffect } from 'react';
import { ExternalProject, Project, ProjectGroup } from '../types';
import { 
  Briefcase, Plus, Edit2, Trash2, AlertTriangle, 
  Folder, ChevronRight, Home, FolderPlus, Save, ChevronLeft, Search,
  FolderInput, X, Check, Target, Layers, GripVertical, List, LayoutGrid,
  Share2
} from 'lucide-react';
import { treeService } from '../services/treeService';
import { projectService } from '../services/projectService';
import { projectsApi } from '../services/projectsApi';
import { projectGroupsApi } from '../services/projectGroupsApi';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { DragDropContext, Droppable, Draggable, DropResult, DraggableProvided } from '@hello-pangea/dnd';

interface DashboardViewProps {
  projects: Project[];
  groups: ProjectGroup[];
  onOpenProject: (id: string) => void;
  onCreateProject: (groupId?: string | null) => void;
  onUpdateProject: (p: Project[]) => void;
  onUpdateGroups: (g: ProjectGroup[]) => void;
  onBulkUpdate: (updates: { projects?: Project[], groups?: ProjectGroup[] }) => void;
  externalProjects: ExternalProject[];
  unreadNotificationsByProject: Record<string, number>;
}

type SortMode = 'custom' | 'name' | 'created';

type ArchivedProjectMeta = {
  groupId: string | null;
  order: number;
};

export const DashboardView: React.FC<DashboardViewProps> = (props) => {
  const { getLevel } = usePermissions();
  const dashboardViewKey = 'promeasure_dashboard_view_v1';
  const dashboardLifecycleFilterKey = 'promeasure_dashboard_lifecycle_filter_v1';
  const dashboardOriginFilterKey = 'promeasure_dashboard_origin_filter_v1';
  const dashboardSortModeKey = 'promeasure_dashboard_sort_mode_v1';
  const archivedGroupsKey = 'promeasure_archived_groups_v1';
  const archivedProjectMetaKey = 'promeasure_archived_project_meta_v1';
  const [currentGroupIdActive, setCurrentGroupIdActive] = useState<string | null>(null);
  const [currentGroupIdArchived, setCurrentGroupIdArchived] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<ProjectGroup | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [movingItem, setMovingItem] = useState<{ type: 'group' | 'project', id: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState<{ type: 'group' | 'project', id: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem(dashboardViewKey);
    return saved === 'list' ? 'list' : 'grid';
  });
  const [lifecycleFilter, setLifecycleFilter] = useState<'active' | 'archived'>(() => {
    const saved = localStorage.getItem(dashboardLifecycleFilterKey);
    return saved === 'archived' ? 'archived' : 'active';
  });
  const [originFilter, setOriginFilter] = useState<'all' | 'local' | 'shared'>(() => {
    const saved = localStorage.getItem(dashboardOriginFilterKey);
    return saved === 'local' || saved === 'shared' ? saved : 'all';
  });
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const saved = localStorage.getItem(dashboardSortModeKey);
    return saved === 'name' || saved === 'created' ? saved : 'custom';
  });
  const [archivedGroups, setArchivedGroups] = useState<ProjectGroup[]>(() => {
    const raw = localStorage.getItem(archivedGroupsKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [archivedProjectMeta, setArchivedProjectMeta] = useState<Record<string, ArchivedProjectMeta>>(() => {
    const raw = localStorage.getItem(archivedProjectMetaKey);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });
  const toast = useToast();
  const canRenameProjects = getLevel('projects_general') === 'edit';

  useEffect(() => {
    localStorage.setItem(dashboardViewKey, viewMode);
  }, [dashboardViewKey, viewMode]);

  useEffect(() => {
    localStorage.setItem(dashboardLifecycleFilterKey, lifecycleFilter);
  }, [dashboardLifecycleFilterKey, lifecycleFilter]);

  useEffect(() => {
    localStorage.setItem(dashboardOriginFilterKey, originFilter);
  }, [dashboardOriginFilterKey, originFilter]);

  useEffect(() => {
    localStorage.setItem(dashboardSortModeKey, sortMode);
  }, [dashboardSortModeKey, sortMode]);

  useEffect(() => {
    localStorage.setItem(archivedGroupsKey, JSON.stringify(archivedGroups));
  }, [archivedGroups, archivedGroupsKey]);

  useEffect(() => {
    localStorage.setItem(archivedProjectMetaKey, JSON.stringify(archivedProjectMeta));
  }, [archivedProjectMeta, archivedProjectMetaKey]);

  const currentGroupId = lifecycleFilter === 'archived' ? currentGroupIdArchived : currentGroupIdActive;
  const setCurrentGroupId = (value: string | null) => {
    if (lifecycleFilter === 'archived') {
      setCurrentGroupIdArchived(value);
      return;
    }
    setCurrentGroupIdActive(value);
  };

  const activeGroups = props.groups;
  const lifecycleGroups = lifecycleFilter === 'archived' ? archivedGroups : activeGroups;
  const isCustomSort = sortMode === 'custom';

  const sortByOrder = (a: { order?: number; name?: string }, b: { order?: number; name?: string }) => {
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return (a.name ?? '').localeCompare(b.name ?? '');
  };

  const sortByName = (a: { name?: string }, b: { name?: string }) =>
    (a.name ?? '').localeCompare(b.name ?? '');

  const sortByCreated = (a: { createdAt?: string }, b: { createdAt?: string }) => {
    const aTs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTs - aTs;
  };

  const sortItems = <T extends { order?: number; name?: string; createdAt?: string }>(items: T[]) => {
    const cloned = [...items];
    if (sortMode === 'name') return cloned.sort(sortByName);
    if (sortMode === 'created') return cloned.sort(sortByCreated);
    return cloned.sort(sortByOrder);
  };

  const getNextGroupOrder = (parentId: string | null) => {
    const siblings = lifecycleGroups.filter(g => g.parentId === parentId);
    if (siblings.length === 0) return 0;
    return Math.max(...siblings.map(g => g.order ?? 0)) + 1;
  };

  const getArchivedProjectMeta = (project: Project): ArchivedProjectMeta => {
    return archivedProjectMeta[project.id] ?? { groupId: null, order: project.order ?? 0 };
  };

  const getProjectGroupId = (project: Project) =>
    lifecycleFilter === 'archived'
      ? getArchivedProjectMeta(project).groupId
      : (project.groupId ?? null);

  const getProjectOrder = (project: Project) =>
    lifecycleFilter === 'archived'
      ? getArchivedProjectMeta(project).order
      : (project.order ?? 0);

  const getNextProjectOrder = (groupId: string | null) => {
    const siblings = filteredLocalProjects.filter((project) => getProjectGroupId(project) === groupId);
    if (siblings.length === 0) return 0;
    return Math.max(...siblings.map((project) => getProjectOrder(project))) + 1;
  };

  const filteredLocalProjects = useMemo(
    () =>
      props.projects.filter((project) =>
        lifecycleFilter === 'archived'
          ? Boolean(project.isArchived)
          : !project.isArchived,
      ),
    [props.projects, lifecycleFilter],
  );

  const currentGroups = useMemo(() =>
    lifecycleGroups
      .filter(g => g.parentId === currentGroupId)
      .slice(),
    [lifecycleGroups, currentGroupId]
  );
  
  const currentProjects = useMemo(() =>
    filteredLocalProjects
      .filter((project) => getProjectGroupId(project) === currentGroupId)
      .map((project) => ({
        ...project,
        order: getProjectOrder(project),
      })),
    [filteredLocalProjects, currentGroupId, lifecycleFilter, archivedProjectMeta]
  );

  const sortedCurrentGroups = useMemo(() => sortItems(currentGroups), [currentGroups, sortMode]);
  const sortedCurrentProjects = useMemo(() => sortItems(currentProjects), [currentProjects, sortMode]);

  const dashboardItems = useMemo(() => (
    [
      ...(currentGroupId ? [{ type: 'placeholder' as const, id: 'target-back' }] : []),
      ...sortedCurrentGroups.map((g) => ({ type: 'group' as const, id: g.id })),
      ...sortedCurrentProjects.map((p) => ({ type: 'project' as const, id: p.id })),
    ]
  ), [currentGroupId, sortedCurrentGroups, sortedCurrentProjects]);

  const breadcrumbs = useMemo(() => {
    const list: ProjectGroup[] = [];
    let currentId = currentGroupId;
    while (currentId) {
      const g = lifecycleGroups.find(x => x.id === currentId);
      if (g) {
        list.unshift(g);
        currentId = g.parentId;
      } else break;
    }
    return list;
  }, [currentGroupId, lifecycleGroups]);

  useEffect(() => {
    if (lifecycleFilter !== 'archived') return;

    setArchivedProjectMeta((prev) => {
      const next = { ...prev };
      let changed = false;

      filteredLocalProjects.forEach((project, index) => {
        if (!next[project.id]) {
          next[project.id] = {
            groupId: null,
            order: index,
          };
          changed = true;
        }
      });

      Object.keys(next).forEach((projectId) => {
        if (!filteredLocalProjects.some((project) => project.id === projectId)) {
          delete next[projectId];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [lifecycleFilter, filteredLocalProjects]);

  useEffect(() => {
    if (!currentGroupId) return;
    if (lifecycleGroups.some((group) => group.id === currentGroupId)) return;
    setCurrentGroupId(null);
  }, [currentGroupId, lifecycleGroups]);

  const refreshLists = async () => {
    const [projects, groups] = await Promise.all([
      projectsApi.list(),
      projectGroupsApi.list(),
    ]);
    props.onBulkUpdate({ projects, groups });
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!isCustomSort) return;

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
        if (lifecycleFilter === 'archived') {
          if (type === 'project') {
            setArchivedProjectMeta((prev) => ({
              ...prev,
              [cleanSourceId]: {
                groupId: targetGroupId,
                order: getNextProjectOrder(targetGroupId),
              },
            }));
          } else {
            setArchivedGroups((prev) => prev.map((group) =>
              group.id === cleanSourceId
                ? { ...group, parentId: targetGroupId, order: getNextGroupOrder(targetGroupId) }
                : group,
            ));
          }
          return;
        }

        if (type === 'project') {
          const order = getNextProjectOrder(targetGroupId);
          await projectsApi.update(cleanSourceId, { groupId: targetGroupId, order });
        } else {
          const order = getNextGroupOrder(targetGroupId);
          await projectGroupsApi.update(cleanSourceId, { parentId: targetGroupId, order });
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
        if (lifecycleFilter === 'archived') {
          if (type === 'project') {
            setArchivedProjectMeta((prev) => ({
              ...prev,
              [cleanSourceId]: {
                groupId: targetGroupId,
                order: getNextProjectOrder(targetGroupId),
              },
            }));
          } else {
            setArchivedGroups((prev) => prev.map((group) =>
              group.id === cleanSourceId
                ? { ...group, parentId: targetGroupId, order: getNextGroupOrder(targetGroupId) }
                : group,
            ));
          }
          return;
        }

        if (type === 'project') {
          const order = getNextProjectOrder(targetGroupId);
          await projectsApi.update(cleanSourceId, { groupId: targetGroupId, order });
        } else {
          const order = getNextGroupOrder(targetGroupId);
          await projectGroupsApi.update(cleanSourceId, { parentId: targetGroupId, order });
        }
        await refreshLists();
      } catch (error) {
        console.error('Erro ao mover item:', error);
      }
      return;
    }

    if (
      !searchQuery &&
      result.destination &&
      result.destination.droppableId === 'dashboard-grid' &&
      result.destination.index !== result.source.index
    ) {
      const destinationIndex =
        currentGroupId && result.destination.index === 0
          ? 1
          : result.destination.index;
      const reordered = [...dashboardItems];
      const [moved] = reordered.splice(result.source.index, 1);
      reordered.splice(destinationIndex, 0, moved);

      const groupOrderMap = new Map<string, number>();
      const projectOrderMap = new Map<string, number>();

      let orderIndex = 0;
      reordered.forEach((item) => {
        if (item.type === 'placeholder') return;
        if (item.type === 'group') {
          groupOrderMap.set(item.id, orderIndex);
        } else {
          projectOrderMap.set(item.id, orderIndex);
        }
        orderIndex += 1;
      });

      const groupUpdates = Array.from(groupOrderMap.entries())
        .map(([id, order]) => {
          const existing = lifecycleFilter === 'archived'
            ? archivedGroups.find((group) => group.id === id)
            : props.groups.find((group) => group.id === id);
          if (!existing || existing.order === order) return null;
          return { id, order };
        })
        .filter((item): item is { id: string; order: number } => Boolean(item));

      const projectUpdates = Array.from(projectOrderMap.entries())
        .map(([id, order]) => {
          const existing = lifecycleFilter === 'archived'
            ? filteredLocalProjects.find((project) => project.id === id)
            : props.projects.find((project) => project.id === id);
          if (!existing) return null;
          const existingOrder = lifecycleFilter === 'archived'
            ? getProjectOrder(existing)
            : (existing.order ?? 0);
          if (existingOrder === order) return null;
          return { id, order };
        })
        .filter((item): item is { id: string; order: number } => Boolean(item));

      const updatedGroups = lifecycleFilter === 'archived'
        ? archivedGroups.map((group) => {
            const nextOrder = groupOrderMap.get(group.id);
            if (nextOrder === undefined) return group;
            return group.order === nextOrder ? group : { ...group, order: nextOrder };
          })
        : props.groups.map((group) => {
            const nextOrder = groupOrderMap.get(group.id);
            if (nextOrder === undefined) return group;
            return group.order === nextOrder ? group : { ...group, order: nextOrder };
          });

      const updatedProjects = lifecycleFilter === 'archived'
        ? filteredLocalProjects.map((project) => {
            const nextOrder = projectOrderMap.get(project.id);
            if (nextOrder === undefined) return project;
            return getProjectOrder(project) === nextOrder ? project : { ...project, order: nextOrder };
          })
        : props.projects.map((project) => {
            const nextOrder = projectOrderMap.get(project.id);
            if (nextOrder === undefined) return project;
            return project.order === nextOrder ? project : { ...project, order: nextOrder };
          });

      if (lifecycleFilter === 'archived') {
        setArchivedGroups(updatedGroups);
        setArchivedProjectMeta((prev) => {
          const next = { ...prev };
          projectUpdates.forEach((project) => {
            const previous = next[project.id] ?? { groupId: null, order: 0 };
            next[project.id] = { ...previous, order: project.order };
          });
          return next;
        });
        return;
      }

      const updatedGroupsFromProps = props.groups.map((group) => {
        const nextOrder = groupOrderMap.get(group.id);
        if (nextOrder === undefined) return group;
        return group.order === nextOrder ? group : { ...group, order: nextOrder };
      });

      const updatedProjectsFromProps = props.projects.map((project) => {
        const nextOrder = projectOrderMap.get(project.id);
        if (nextOrder === undefined) return project;
        return project.order === nextOrder ? project : { ...project, order: nextOrder };
      });

      props.onBulkUpdate({ projects: updatedProjectsFromProps, groups: updatedGroupsFromProps });

      try {
        await Promise.all([
          ...groupUpdates.map((group) =>
            projectGroupsApi.update(group.id, { order: group.order }),
          ),
          ...projectUpdates.map((project) =>
            projectsApi.update(project.id, { order: project.order }),
          ),
        ]);
      } catch (error) {
        console.error('Erro ao salvar ordem:', error);
        toast.error('Nao foi possivel salvar a ordem. Tente novamente.');
        await refreshLists();
      }
    }
  };

  const handleConfirmMove = async (targetGroupId: string | null) => {
    if (!movingItem) return;
    try {
      if (lifecycleFilter === 'archived') {
        if (movingItem.type === 'project') {
          setArchivedProjectMeta((prev) => ({
            ...prev,
            [movingItem.id]: {
              groupId: targetGroupId,
              order: getNextProjectOrder(targetGroupId),
            },
          }));
        } else {
          setArchivedGroups((prev) => prev.map((group) =>
            group.id === movingItem.id
              ? { ...group, parentId: targetGroupId, order: getNextGroupOrder(targetGroupId) }
              : group,
          ));
        }
        return;
      }

      if (movingItem.type === 'project') {
        const order = getNextProjectOrder(targetGroupId);
        await projectsApi.update(movingItem.id, { groupId: targetGroupId, order });
      } else {
        const order = getNextGroupOrder(targetGroupId);
        await projectGroupsApi.update(movingItem.id, { parentId: targetGroupId, order });
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
      if (lifecycleFilter === 'archived') {
        const newGroup: ProjectGroup = {
          id: crypto.randomUUID(),
          name: 'Nova Pasta',
          parentId: currentGroupId,
          order: getNextGroupOrder(currentGroupId),
          createdAt: new Date().toISOString(),
        };
        setArchivedGroups((prev) => [...prev, newGroup]);
        return;
      }

      const newGroup = await projectGroupsApi.create({
        name: 'Nova Pasta',
        parentId: currentGroupId,
        order: getNextGroupOrder(currentGroupId),
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
        if (lifecycleFilter === 'archived') {
          setArchivedGroups((prev) => prev.map((group) =>
            group.id === editingGroup.id ? { ...group, name: newName.trim() } : group,
          ));
          setEditingGroup(null);
          return;
        }

        const updatedGroup = await projectGroupsApi.update(editingGroup.id, { name: newName.trim() });
        props.onUpdateGroups(props.groups.map(g => g.id === editingGroup.id ? updatedGroup : g));
        setEditingGroup(null);
      } else if (editingProject) {
        if (lifecycleFilter === 'archived') {
          toast.warning('Obras arquivadas são somente leitura. Reative para editar.');
          setEditingProject(null);
          return;
        }

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
        if (lifecycleFilter === 'archived') {
          const deletingId = isDeleting.id;
          setArchivedGroups((prev) => prev
            .filter((group) => group.id !== deletingId)
            .map((group) =>
              group.parentId === deletingId ? { ...group, parentId: null } : group,
            ));
          setArchivedProjectMeta((prev) => {
            const next = { ...prev };
            Object.keys(next).forEach((projectId) => {
              if (next[projectId]?.groupId === deletingId) {
                next[projectId] = { ...next[projectId], groupId: null };
              }
            });
            return next;
          });
          if (currentGroupId === deletingId) setCurrentGroupId(null);
          return;
        }

        await projectGroupsApi.remove(isDeleting.id);
        await refreshLists();
        if (currentGroupId === isDeleting.id) setCurrentGroupId(null);
      } else {
        if (lifecycleFilter === 'archived') {
          toast.warning('Obras arquivadas são somente leitura. Reative para remover.');
          return;
        }

        await projectsApi.remove(isDeleting.id);
        const updatedList = props.projects.filter(p => p.id !== isDeleting.id);
        props.onUpdateProject(updatedList);
      }
    } catch (error) {
      console.error('Erro ao excluir item:', error);
      if (isDeleting.type === 'project') {
        toast.error('Nao foi possivel remover a obra. Tente novamente.');
      } else {
        toast.error('Nao foi possivel remover a pasta. Tente novamente.');
      }
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredGroups = searchQuery 
    ? lifecycleGroups
        .filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .slice()
    : [];
    
  const filteredProjects = searchQuery
    ? filteredLocalProjects
        .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice()
        .sort(sortByOrder)
    : [];

  const filteredExternalProjects = searchQuery
    ? props.externalProjects
        .filter((p) => p.projectName.toLowerCase().includes(searchQuery.toLowerCase()))
        .filter((project) =>
          lifecycleFilter === 'archived'
            ? Boolean(project.isArchived)
            : !project.isArchived,
        )
    : props.externalProjects.filter((project) =>
        lifecycleFilter === 'archived'
          ? Boolean(project.isArchived)
          : !project.isArchived,
      );

  const showLocalArea = originFilter === 'all' || originFilter === 'local';
  const showSharedArea = originFilter === 'all' || originFilter === 'shared';
  const sortedFilteredGroups = useMemo(() => sortItems(filteredGroups), [filteredGroups, sortMode]);
  const sortedFilteredProjects = useMemo(() => sortItems(filteredProjects), [filteredProjects, sortMode]);

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-12 animate-in fade-in duration-500 bg-slate-50 dark:bg-slate-950 custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <header>
              <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white">Central de Obras</h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                {lifecycleFilter === 'archived' ? 'Área de obras arquivadas.' : 'Gestão hierárquica por portfólio.'}
              </p>
            </header>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar..." 
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 w-full sm:w-64 transition-all"
                />
              </div>
              <button onClick={handleCreateFolder} disabled={!showLocalArea} className="p-3 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-800 hover:text-indigo-600 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <FolderPlus size={18} />
              </button>
              <button onClick={() => props.onCreateProject(currentGroupId)} disabled={lifecycleFilter === 'archived' || !showLocalArea} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all">
                <Plus size={16} /> Nova Obra
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
             <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
               <button
                 onClick={() => setLifecycleFilter('active')}
                 className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${lifecycleFilter === 'active' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
                 title="Obras ativas"
               >
                 Obras Ativas
               </button>
               <button
                 onClick={() => setLifecycleFilter('archived')}
                 className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${lifecycleFilter === 'archived' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
                 title="Obras arquivadas"
               >
                 Arquivadas
               </button>
             </div>
             <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
               <button
                 onClick={() => setOriginFilter('all')}
                 className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${originFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
               >
                 Todas
               </button>
               <button
                 onClick={() => setOriginFilter('local')}
                 className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${originFilter === 'local' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
               >
                 Locais
               </button>
               <button
                 onClick={() => setOriginFilter('shared')}
                 className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${originFilter === 'shared' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
               >
                 Compart.
               </button>
             </div>
             <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
               <button
                 onClick={() => setSortMode('custom')}
                 className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${sortMode === 'custom' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
                 title="Ordenação personalizada"
               >
                 Ordem Personalizada
               </button>
               <button
                 onClick={() => setSortMode('name')}
                 className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${sortMode === 'name' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
                 title="Ordenar por nome"
               >
                 Nome
               </button>
               <button
                 onClick={() => setSortMode('created')}
                 className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${sortMode === 'created' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
                 title="Ordenar por data de cadastro"
               >
                 Cadastro
               </button>
             </div>
             <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
               <button
                 onClick={() => setViewMode('grid')}
                 className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
                 title="Grade"
               >
                 <LayoutGrid size={16} />
               </button>
               <button
                 onClick={() => setViewMode('list')}
                 className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
                 title="Lista"
               >
                 <List size={16} />
               </button>
             </div>
          </div>
        </div>

        {!showLocalArea && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-500">
            Exibindo apenas obras compartilhadas.
          </div>
        )}

        {showLocalArea && (
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

          <Droppable droppableId="dashboard-grid" direction={viewMode === 'list' ? 'vertical' : 'horizontal'} isCombineEnabled={isCustomSort}>
            {(provided) => (
              <div 
                {...provided.droppableProps} 
                ref={provided.innerRef}
                className={viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                  : 'flex flex-col gap-3'
                }
              >
                {!searchQuery && currentGroupId && (
                  <Draggable draggableId="target-back" index={0} isDragDisabled={true}>
                    {(p, s) => (
                      <div
                        ref={p.innerRef}
                        {...p.draggableProps}
                        onClick={() => setCurrentGroupId(breadcrumbs[breadcrumbs.length - 2]?.id || null)}
                        className={`bg-white dark:bg-slate-900 border-2 border-dashed rounded-[2rem] p-6 flex flex-col items-center justify-center transition-all group cursor-pointer ${viewMode === 'list' ? 'h-auto' : 'h-full'} ${s.combineTargetFor ? 'bg-indigo-50 border-indigo-500 ring-4 ring-indigo-500/20 scale-105' : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-indigo-600 hover:bg-slate-50'}`}
                      >
                        <ChevronLeft size={32} className={`${s.combineTargetFor ? 'animate-bounce' : 'group-hover:-translate-x-1'} transition-transform`} /> 
                        <span className="text-[10px] font-black uppercase tracking-widest mt-2">Mover para fora</span>
                      </div>
                    )}
                  </Draggable>
                )}

                {searchQuery ? (
                  <>
                    {sortedFilteredGroups.map((g, idx) => (
                      <Draggable key={`grp-${g.id}`} draggableId={`grp-${g.id}`} index={idx} isDragDisabled={!isCustomSort}>
                        {(p) => (
                          viewMode === 'grid' ? (
                            <FolderCard 
                              provided={p} 
                              group={g} 
                              onOpen={() => { setCurrentGroupId(g.id); setSearchQuery(''); }} 
                              onRename={() => { setEditingGroup(g); setNewName(g.name); }} 
                              onDelete={() => setIsDeleting({ type: 'group', id: g.id })} 
                              onMove={() => setMovingItem({ type: 'group', id: g.id })} 
                              canRename={canRenameProjects}
                              canMove={isCustomSort}
                            />
                          ) : (
                            <FolderRow
                              provided={p}
                              group={g}
                              onOpen={() => { setCurrentGroupId(g.id); setSearchQuery(''); }}
                              onRename={() => { setEditingGroup(g); setNewName(g.name); }}
                              onDelete={() => setIsDeleting({ type: 'group', id: g.id })}
                              onMove={() => setMovingItem({ type: 'group', id: g.id })}
                              canRename={canRenameProjects}
                              canMove={isCustomSort}
                            />
                          )
                        )}
                      </Draggable>
                    ))}
                    {sortedFilteredProjects.map((p, idx) => (
                      <Draggable key={`prj-${p.id}`} draggableId={`prj-${p.id}`} index={idx + sortedFilteredGroups.length} isDragDisabled={!isCustomSort}>
                        {(pr) => (
                          viewMode === 'grid' ? (
                            <ProjectCard 
                              provided={pr} 
                              project={p} 
                              unreadCount={props.unreadNotificationsByProject[p.id] ?? 0}
                              onOpen={() => props.onOpenProject(p.id)} 
                              onRename={() => { setEditingProject(p); setNewName(p.name); }} 
                              onDelete={() => setIsDeleting({ type: 'project', id: p.id })} 
                              onMove={() => setMovingItem({ type: 'project', id: p.id })} 
                              canRename={canRenameProjects && lifecycleFilter !== 'archived'}
                              canDelete={lifecycleFilter !== 'archived'}
                              canMove={isCustomSort}
                            />
                          ) : (
                            <ProjectRow
                              provided={pr}
                              project={p}
                              unreadCount={props.unreadNotificationsByProject[p.id] ?? 0}
                              onOpen={() => props.onOpenProject(p.id)}
                              onRename={() => { setEditingProject(p); setNewName(p.name); }}
                              onDelete={() => setIsDeleting({ type: 'project', id: p.id })}
                              onMove={() => setMovingItem({ type: 'project', id: p.id })}
                              canRename={canRenameProjects && lifecycleFilter !== 'archived'}
                              canDelete={lifecycleFilter !== 'archived'}
                              canMove={isCustomSort}
                            />
                          )
                        )}
                      </Draggable>
                    ))}
                  </>
                ) : (
                  <>
                    {sortedCurrentGroups.map((g, idx) => {
                      const baseIdx = (currentGroupId ? 1 : 0) + idx;
                      return (
                        <Draggable key={`grp-${g.id}`} draggableId={`grp-${g.id}`} index={baseIdx} isDragDisabled={!isCustomSort}>
                          {(p) => (
                            viewMode === 'grid' ? (
                              <FolderCard 
                                provided={p} 
                                group={g} 
                                onOpen={() => setCurrentGroupId(g.id)} 
                                onRename={() => { setEditingGroup(g); setNewName(g.name); }} 
                                onDelete={() => setIsDeleting({ type: 'group', id: g.id })} 
                                onMove={() => setMovingItem({ type: 'group', id: g.id })} 
                                canRename={canRenameProjects}
                                canMove={isCustomSort}
                              />
                            ) : (
                              <FolderRow
                                provided={p}
                                group={g}
                                onOpen={() => setCurrentGroupId(g.id)}
                                onRename={() => { setEditingGroup(g); setNewName(g.name); }}
                                onDelete={() => setIsDeleting({ type: 'group', id: g.id })}
                                onMove={() => setMovingItem({ type: 'group', id: g.id })}
                                canRename={canRenameProjects}
                                canMove={isCustomSort}
                              />
                            )
                          )}
                        </Draggable>
                      );
                    })}
                    {sortedCurrentProjects.map((p, idx) => {
                      const baseIdx = (currentGroupId ? 1 : 0) + sortedCurrentGroups.length + idx;
                      return (
                        <Draggable key={`prj-${p.id}`} draggableId={`prj-${p.id}`} index={baseIdx} isDragDisabled={!isCustomSort}>
                          {(pr) => (
                            viewMode === 'grid' ? (
                              <ProjectCard 
                                provided={pr} 
                                project={p} 
                                unreadCount={props.unreadNotificationsByProject[p.id] ?? 0}
                                onOpen={() => props.onOpenProject(p.id)} 
                                onRename={() => { setEditingProject(p); setNewName(p.name); }} 
                                onDelete={() => setIsDeleting({ type: 'project', id: p.id })} 
                                onMove={() => setMovingItem({ type: 'project', id: p.id })} 
                                canRename={canRenameProjects && lifecycleFilter !== 'archived'}
                                canDelete={lifecycleFilter !== 'archived'}
                                canMove={isCustomSort}
                              />
                            ) : (
                              <ProjectRow
                                provided={pr}
                                project={p}
                                unreadCount={props.unreadNotificationsByProject[p.id] ?? 0}
                                onOpen={() => props.onOpenProject(p.id)}
                                onRename={() => { setEditingProject(p); setNewName(p.name); }} 
                                onDelete={() => setIsDeleting({ type: 'project', id: p.id })}
                                onMove={() => setMovingItem({ type: 'project', id: p.id })}
                                canRename={canRenameProjects && lifecycleFilter !== 'archived'}
                                canDelete={lifecycleFilter !== 'archived'}
                                canMove={isCustomSort}
                              />
                            )
                          )}
                        </Draggable>
                      );
                    })}
                    {sortedCurrentGroups.length === 0 && sortedCurrentProjects.length === 0 && !currentGroupId && <EmptyState />}
                  </>
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        )}

        {showSharedArea && (filteredExternalProjects.length > 0 && (searchQuery || !currentGroupId || !showLocalArea)) && (
          <ExternalProjectsSection
            projects={filteredExternalProjects}
            viewMode={viewMode}
            onOpenProject={props.onOpenProject}
            unreadNotificationsByProject={props.unreadNotificationsByProject}
          />
        )}
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
          groups={lifecycleGroups}
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
const FolderCard = ({ group, onOpen, onRename, onDelete, onMove, provided, canRename, canMove }: { 
  group: ProjectGroup, 
  onOpen: () => void, 
  onRename: () => void, 
  onDelete: () => void, 
  onMove: () => void, 
  provided: DraggableProvided,
  canRename: boolean,
  canMove: boolean,
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
        {canMove && <button title="Mover" onClick={e => { e.stopPropagation(); onMove(); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><FolderInput size={16}/></button>}
        {canRename && (
          <button title="Renomear" onClick={e => { e.stopPropagation(); onRename(); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 size={16}/></button>
        )}
        <button title="Excluir" onClick={e => { e.stopPropagation(); onDelete(); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button>
      </div>
    </div>
    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight truncate">{group.name}</h3>
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Diretório Estrutural</p>
  </div>
);

const ProjectIconBadge = ({ unreadCount }: { unreadCount: number }) => {
  if (unreadCount <= 0) return null;

  return (
    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black leading-none flex items-center justify-center border-2 border-white dark:border-slate-900">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );
};

const ProjectCard = ({ project, unreadCount, onOpen, onRename, onDelete, onMove, provided, canRename, canDelete, canMove }: {
  project: Project,
  unreadCount: number,
  onOpen: () => void,
  onRename: () => void,
  onDelete: () => void,
  onMove: () => void,
  provided: DraggableProvided,
  canRename: boolean,
  canDelete: boolean,
  canMove: boolean,
}) => {
  const wbsItems = project.items?.filter(i => i.scope !== 'quantitativo') || [];
  const stats = wbsItems.length
    ? treeService.calculateBasicStats(wbsItems, project.bdi || 0)
    : { progress: project.progress ?? 0 };
  return (
    <div 
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={onOpen} 
      className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all cursor-pointer relative overflow-hidden h-full"
    >
      <div className="flex justify-between items-start mb-8">
        <div className="relative">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-2xl group-hover:scale-110 transition-transform"><Briefcase size={24}/></div>
          <ProjectIconBadge unreadCount={unreadCount} />
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
          {canMove && <button title="Mover" onClick={e => { e.stopPropagation(); onMove(); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><FolderInput size={16}/></button>}
          {canRename && (
            <button title="Renomear" onClick={e => { e.stopPropagation(); onRename(); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 size={16}/></button>
          )}
          {canDelete && <button title="Excluir" onClick={e => { e.stopPropagation(); onDelete(); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button>}
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

const FolderRow = ({ group, onOpen, onRename, onDelete, onMove, provided, canRename, canMove }: {
  group: ProjectGroup,
  onOpen: () => void,
  onRename: () => void,
  onDelete: () => void,
  onMove: () => void,
  provided: DraggableProvided,
  canRename: boolean,
  canMove: boolean,
}) => (
  <div
    ref={provided.innerRef}
    {...provided.draggableProps}
    {...provided.dragHandleProps}
    onClick={onOpen}
    className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
  >
    <div className="flex items-center gap-4 min-w-0">
      <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-xl">
        <Folder size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase text-slate-400">Pasta</p>
        <h3 className="text-sm font-black text-slate-800 dark:text-white truncate">{group.name}</h3>
      </div>
    </div>
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
      {canMove && <button title="Mover" onClick={e => { e.stopPropagation(); onMove(); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><FolderInput size={16}/></button>}
      {canRename && (
        <button title="Renomear" onClick={e => { e.stopPropagation(); onRename(); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 size={16}/></button>
      )}
      <button title="Excluir" onClick={e => { e.stopPropagation(); onDelete(); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button>
    </div>
  </div>
);

const ProjectRow = ({ project, unreadCount, onOpen, onRename, onDelete, onMove, provided, canRename, canDelete, canMove }: {
  project: Project,
  unreadCount: number,
  onOpen: () => void,
  onRename: () => void,
  onDelete: () => void,
  onMove: () => void,
  provided: DraggableProvided,
  canRename: boolean,
  canDelete: boolean,
  canMove: boolean,
}) => {
  const wbsItems = project.items?.filter(i => i.scope !== 'quantitativo') || [];
  const stats = wbsItems.length
    ? treeService.calculateBasicStats(wbsItems, project.bdi || 0)
    : { progress: project.progress ?? 0 };
  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={onOpen}
      className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="relative">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-xl">
            <Briefcase size={18} />
          </div>
          <ProjectIconBadge unreadCount={unreadCount} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase text-slate-400">Obra</p>
          <h3 className="text-sm font-black text-slate-800 dark:text-white truncate">{project.name}</h3>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-3">
          <div className="text-[9px] font-black uppercase text-slate-400">Avanço</div>
          <div className="w-28 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500" style={{ width: `${stats.progress}%` }} />
          </div>
          <div className="text-xs font-black text-indigo-600">{stats.progress.toFixed(1)}%</div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          {canMove && <button title="Mover" onClick={e => { e.stopPropagation(); onMove(); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><FolderInput size={16}/></button>}
          {canRename && (
            <button title="Renomear" onClick={e => { e.stopPropagation(); onRename(); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 size={16}/></button>
          )}
          {canDelete && <button title="Excluir" onClick={e => { e.stopPropagation(); onDelete(); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button>}
        </div>
      </div>
    </div>
  );
};

const ExternalProjectsSection = ({
  projects,
  viewMode,
  onOpenProject,
  unreadNotificationsByProject,
}: {
  projects: ExternalProject[];
  viewMode: 'grid' | 'list';
  onOpenProject: (id: string) => void;
  unreadNotificationsByProject: Record<string, number>;
}) => (
  <div className="mt-8 space-y-4">
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
        Compartilhados
      </span>
      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
    </div>
    <div className={viewMode === 'grid'
      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
      : 'flex flex-col gap-3'
    }
    >
      {projects.map((project) => (
        viewMode === 'grid'
          ? (
            <ExternalProjectCard
              key={project.projectId}
              project={project}
              unreadCount={unreadNotificationsByProject[project.projectId] ?? 0}
              onOpen={() => onOpenProject(project.projectId)}
            />
          )
          : (
            <ExternalProjectRow
              key={project.projectId}
              project={project}
              unreadCount={unreadNotificationsByProject[project.projectId] ?? 0}
              onOpen={() => onOpenProject(project.projectId)}
            />
          )
      ))}
    </div>
  </div>
);

const ExternalProjectCard = ({ project, unreadCount, onOpen }: {
  project: ExternalProject;
  unreadCount: number;
  onOpen: () => void;
}) => (
  <div
    onClick={onOpen}
    className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all cursor-pointer relative overflow-hidden h-full"
  >
    <div className="flex justify-between items-start mb-6">
      <div className="relative">
        <div className="p-4 bg-teal-50 dark:bg-teal-900/20 text-teal-600 rounded-2xl group-hover:scale-110 transition-transform">
          <Share2 size={24} />
        </div>
        <ProjectIconBadge unreadCount={unreadCount} />
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 dark:bg-teal-900/20 px-2 py-1 rounded-full">
        Compartilhado
      </span>
    </div>
    <h3 className="text-sm font-black text-slate-800 dark:text-white truncate uppercase tracking-tight">{project.projectName}</h3>
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{project.companyName}</p>
    <p className="text-[9px] font-bold text-slate-400 mt-4">{project.instanceName}</p>
  </div>
);

const ExternalProjectRow = ({ project, unreadCount, onOpen }: {
  project: ExternalProject;
  unreadCount: number;
  onOpen: () => void;
}) => (
  <div
    onClick={onOpen}
    className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
  >
    <div className="flex items-center gap-4 min-w-0">
      <div className="relative">
        <div className="p-2.5 bg-teal-50 dark:bg-teal-900/20 text-teal-600 rounded-xl">
          <Share2 size={18} />
        </div>
        <ProjectIconBadge unreadCount={unreadCount} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase text-slate-400">Compartilhado</p>
        <h3 className="text-sm font-black text-slate-800 dark:text-white truncate">{project.projectName}</h3>
        <p className="text-[9px] font-bold text-slate-400 truncate">{project.instanceName}</p>
      </div>
    </div>
    <div className="text-[9px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 dark:bg-teal-900/20 px-2 py-1 rounded-full">
      Externo
    </div>
  </div>
);

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
