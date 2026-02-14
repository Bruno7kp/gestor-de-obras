
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Project, GlobalSettings, WorkItem, Supplier, ProjectAsset, ProjectExpense, ProjectPlanning, PlanningTask, MaterialForecast, Milestone } from '../types';
import {
  Layers, BarChart3, Coins, Users, HardHat, BookOpen, FileText, Sliders, Boxes,
  CheckCircle2, History, Calendar, Lock, ChevronDown,
  ArrowRight, Clock, Undo2, Redo2, RotateCcw, AlertTriangle, X, Target, Info, RefreshCw, Briefcase, Edit2, Check
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { canView as checkCanView, canEdit as checkCanEdit, getPermissionLevel } from '../utils/permissions';
import type { PermissionModule } from '../utils/permissions';
import { WbsView } from './WbsView';
import { StatsView } from './StatsView';
import { ExpenseManager } from './ExpenseManager';
import { WorkforceManager } from './WorkforceManager';
import { LaborContractsManager } from './LaborContractsManager';
import { PlanningView } from './PlanningView';
import { JournalView } from './JournalView';
import { AssetManager } from './AssetManager';
import { BrandingView } from './BrandingView';
import { WorkItemModal } from './WorkItemModal';
import { ProjectMembersBadge } from './ProjectMembersBadge';
import { ProjectMembersModal } from './ProjectMembersModal';
import { PrintReport } from './PrintReport';
import { PrintExpenseReport } from './PrintExpenseReport';
import { PrintPlanningReport } from './PrintPlanningReport';
import { treeService } from '../services/treeService';
import { projectService } from '../services/projectService';
import { financial } from '../utils/math';
import { uiPreferences } from '../utils/uiPreferences';
import { expenseService } from '../services/expenseService';
import { workItemsApi } from '../services/workItemsApi';
import { projectExpensesApi } from '../services/projectExpensesApi';
import { planningApi } from '../services/planningApi';
import { projectAssetsApi } from '../services/projectAssetsApi';
import { projectsApi } from '../services/projectsApi';
import { rolesApi } from '../services/rolesApi';
import { usersApi } from '../services/usersApi';
import { suppliersApi } from '../services/suppliersApi';
import { useToast } from '../hooks/useToast';

interface ProjectWorkspaceProps {
  project: Project;
  globalSettings: GlobalSettings;
  suppliers: Supplier[];
  isExternalProject?: boolean;
  onUpdateProject: (data: Partial<Project>) => void;
  onCloseMeasurement: () => Promise<void> | void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  activeTab: TabID;
  onTabChange: (tab: TabID) => void;
}

export type TabID = 'wbs' | 'stats' | 'expenses' | 'supplies' | 'workforce' | 'labor-contracts' | 'planning' | 'schedule' | 'journal' | 'documents' | 'branding';

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({
  project, globalSettings, suppliers, isExternalProject: isExternalProjectProp = false, onUpdateProject, onCloseMeasurement,
  canUndo, canRedo, onUndo, onRedo, activeTab, onTabChange
}) => {
  const { user } = useAuth();
  const { canView: canViewGlobal, getLevel: getLevelGlobal, loading: permissionsLoading } = usePermissions();
  const toast = useToast();
  const tab = activeTab;
  const [viewingMeasurementId, setViewingMeasurementId] = useState<'current' | number>('current');
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [isClosingInProgress, setIsClosingInProgress] = useState(false);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allRoles, setAllRoles] = useState<any[]>([]);
  const [generalAccessUserIds, setGeneralAccessUserIds] = useState<string[]>([]);
  const [externalSuppliers, setExternalSuppliers] = useState<Supplier[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(project.name);

  const tabsNavRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; scrollLeft: number; moved: boolean } | null>(null);
  const dragBlockUntilRef = useRef(0);
  const tabsScrollRafRef = useRef<number | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'category' | 'item'>('item');
  const [editingItem, setEditingItem] = useState<WorkItem | null>(null);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);
  const brandingDebounceRef = useRef<number | null>(null);
  const pendingBrandingRef = useRef<Partial<Project>>({});

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!tabsNavRef.current) return;
    dragStartRef.current = { x: e.pageX - tabsNavRef.current.offsetLeft, scrollLeft: tabsNavRef.current.scrollLeft, moved: false };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStartRef.current || !tabsNavRef.current) return;
    e.preventDefault();
    const x = e.pageX - tabsNavRef.current.offsetLeft;
    const walk = (x - dragStartRef.current.x) * 1.5;
    if (Math.abs(x - dragStartRef.current.x) > 5) {
      dragStartRef.current.moved = true;
      tabsNavRef.current.scrollLeft = dragStartRef.current.scrollLeft - walk;
    }
  };

  const handleMouseUpOrLeave = () => {
    if (dragStartRef.current?.moved) {
      dragBlockUntilRef.current = Date.now() + 200;
    }
    dragStartRef.current = null;
  };

  const tabsScrollKey = 'project_tabs_scroll_global';

  const saveTabsScroll = useCallback(() => {
    if (!tabsNavRef.current) return;
    uiPreferences.setString(tabsScrollKey, String(tabsNavRef.current.scrollLeft));
  }, [tabsScrollKey]);

  const handleTabsScroll = useCallback(() => {
    if (tabsScrollRafRef.current) {
      window.cancelAnimationFrame(tabsScrollRafRef.current);
    }
    tabsScrollRafRef.current = window.requestAnimationFrame(() => {
      tabsScrollRafRef.current = null;
      saveTabsScroll();
    });
  }, [saveTabsScroll]);


  // Fetch project members, users, and general access list
  useEffect(() => {
    setMembersLoading(true);
    setProjectMembers([]);

    const fetchMembers = async () => {
      try {
        const response = await fetch(`/api/projects/${project.id}/members`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            setProjectMembers(data);
          } else {
            setProjectMembers(data.members ?? []);
            if (Array.isArray(data.generalAccessUsers)) {
              setAllUsers(data.generalAccessUsers);
              setGeneralAccessUserIds(data.generalAccessUsers.map((user: any) => user.id));
            }
            if (Array.isArray(data.roles)) {
              setAllRoles(data.roles);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching project members:', error);
      } finally {
        setMembersLoading(false);
      }
    };

    const fetchUsersAndRoles = async () => {
      try {
        if (isExternalProjectProp) return;

        const [users, roles] = await Promise.all([
          usersApi.list(),
          rolesApi.list(),
        ]);
        setAllUsers(users);
        setAllRoles(roles);

        const rolePermissions = new Map(
          roles.map((role) => [
            role.id,
            new Set((role.permissions ?? []).map((permission) => permission.code)),
          ]),
        );

        const generalUsers = users.filter((user) =>
          (user.roles ?? []).some((role) => {
            const codes = rolePermissions.get(role.id);
            return (
              codes?.has('projects_general.view') ||
              codes?.has('projects_general.edit')
            );
          }),
        );

        setGeneralAccessUserIds(generalUsers.map((user) => user.id));
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchMembers();
    fetchUsersAndRoles();
  }, [project.id, isExternalProjectProp]);

  // For external projects, fetch the suppliers from the project's owning instance
  useEffect(() => {
    if (!isExternalProjectProp) {
      setExternalSuppliers([]);
      return;
    }
    const pid = (project as any).instanceId;
    if (!pid) return;
    suppliersApi.listByInstance(pid).then(setExternalSuppliers).catch(() => setExternalSuppliers([]));
  }, [isExternalProjectProp, (project as any).instanceId]);

  // Merge external suppliers with the ones passed from the parent
  const effectiveSuppliers = useMemo(
    () => (isExternalProjectProp && externalSuppliers.length > 0 ? externalSuppliers : suppliers),
    [isExternalProjectProp, externalSuppliers, suppliers],
  );

  const memberPreviewUsers = useMemo(() => {
    const uniqueUsers = new Map<string, any>();

    projectMembers.forEach((member: any) => {
      if (member?.user?.id) {
        uniqueUsers.set(member.user.id, member.user);
      }
    });

    allUsers
      .filter((user: any) => generalAccessUserIds.includes(user.id))
      .forEach((user: any) => {
        if (user?.id && !uniqueUsers.has(user.id)) {
          uniqueUsers.set(user.id, user);
        }
      });

    return Array.from(uniqueUsers.values());
  }, [projectMembers, allUsers, generalAccessUserIds]);

  const handleMembersChange = async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}/members`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setProjectMembers(data);
        } else {
          setProjectMembers(data.members ?? []);
          if (Array.isArray(data.generalAccessUsers)) {
            setAllUsers(data.generalAccessUsers);
            setGeneralAccessUserIds(data.generalAccessUsers.map((user: any) => user.id));
          }
          if (Array.isArray(data.roles)) {
            setAllRoles(data.roles);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching project members:', error);
    }
  };

  // External project flag is passed from the parent, which knows definitively
  const isExternalProject = isExternalProjectProp;

  // Get the current user's assigned role permissions for this project
  const memberPermissions = useMemo(() => {
    if (!user?.id) return [];
    const member = projectMembers.find((entry) => entry.user?.id === user.id);
    if (!member?.assignedRole?.permissions) return [];
    return member.assignedRole.permissions.map(
      (rp: any) => typeof rp === 'string' ? rp : (rp.permission?.code ?? rp.code),
    ).filter(Boolean);
  }, [projectMembers, user?.id]);

  const isCurrentUserGeneralAccess = useMemo(() => {
    if (!user?.id) return false;
    return generalAccessUserIds.includes(user.id);
  }, [generalAccessUserIds, user?.id]);

  const useMemberPermissions = useMemo(() => {
    if (isExternalProject) return true;
    if (!user?.id) return false;
    return !isCurrentUserGeneralAccess && memberPermissions.length > 0;
  }, [isExternalProject, isCurrentUserGeneralAccess, memberPermissions, user?.id]);

  const canEditMembers = useMemo(() => {
    if (permissionsLoading || membersLoading) return false;
    if (useMemberPermissions) {
      return checkCanEdit(memberPermissions, 'projects_general');
    }
    return getLevelGlobal('projects_general') === 'edit' ||
      checkCanEdit(memberPermissions, 'projects_general');
  }, [permissionsLoading, membersLoading, useMemberPermissions, memberPermissions, getLevelGlobal]);

  // Permission wrappers that handle external vs internal projects
  const canView = useCallback(
    (module: PermissionModule): boolean => {
      if (useMemberPermissions) return checkCanView(memberPermissions, module);
      return canViewGlobal(module);
    },
    [useMemberPermissions, memberPermissions, canViewGlobal],
  );

  const getLevel = useCallback(
    (module: PermissionModule): 'none' | 'view' | 'edit' => {
      if (useMemberPermissions) return getPermissionLevel(memberPermissions, module);
      return getLevelGlobal(module);
    },
    [useMemberPermissions, memberPermissions, getLevelGlobal],
  );

  const currentMemberRole = useMemo(() => {
    if (!user?.id) return null;
    const member = projectMembers.find((entry) => entry.user?.id === user.id);
    return member?.assignedRole?.name ?? null;
  }, [projectMembers, user?.id]);

  const canEditProject = useMemo(() => {
    // While permissions are still loading, don't mark as read-only to avoid flashing banner
    if (membersLoading || permissionsLoading) return true;
    if (useMemberPermissions) {
      // Use the assigned role permissions for project-specific access
      return checkCanEdit(memberPermissions, 'projects_specific') ||
             checkCanEdit(memberPermissions, 'projects_general');
    }
    return getLevelGlobal('projects_general') === 'edit' ||
           checkCanEdit(memberPermissions, 'projects_specific') ||
           checkCanEdit(memberPermissions, 'projects_general');
  }, [membersLoading, permissionsLoading, useMemberPermissions, memberPermissions, getLevelGlobal]);

  const isProjectLoading = permissionsLoading || membersLoading;
  const canEditMeasurements = useMemo(() => {
    if (isProjectLoading) return false;
    if (useMemberPermissions) {
      return checkCanEdit(memberPermissions, 'projects_specific') ||
        checkCanEdit(memberPermissions, 'projects_general');
    }
    return getLevelGlobal('projects_general') === 'edit' ||
      checkCanEdit(memberPermissions, 'projects_specific') ||
      checkCanEdit(memberPermissions, 'projects_general');
  }, [isProjectLoading, useMemberPermissions, memberPermissions, getLevelGlobal]);
  const tabPermissions: Record<TabID, PermissionModule> = {
    wbs: 'wbs',
    stats: 'technical_analysis',
    expenses: 'financial_flow',
    supplies: 'supplies',
    workforce: 'workforce',
    'labor-contracts': 'workforce',
    planning: 'planning',
    schedule: 'schedule',
    journal: 'journal',
    documents: 'documents',
    branding: 'project_settings',
  };

  const availableTabs = useMemo(() => ([
    'wbs',
    'stats',
    'expenses',
    'supplies',
    'workforce',
    'labor-contracts',
    'planning',
    'schedule',
    'journal',
    'documents',
    'branding',
  ] as TabID[]).filter((tabId) => canView(tabPermissions[tabId])), [canView]);

  useLayoutEffect(() => {
    if (isProjectLoading) return;
    const node = tabsNavRef.current;
    if (!node) return;
    const saved = uiPreferences.getString(tabsScrollKey);
    const value = saved ? Number(saved) : node.scrollLeft;
    if (Number.isFinite(value)) {
      const maxScroll = Math.max(0, node.scrollWidth - node.clientWidth);
      node.scrollLeft = Math.min(value, maxScroll);
    }
    const activeBtn = node.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [availableTabs.length, isProjectLoading, tab, tabsScrollKey]);

  const hasTabAccess = availableTabs.includes(tab);

  useEffect(() => {
    if (isProjectLoading) return;
    if (availableTabs.length === 0) return;
    if (!hasTabAccess) {
      onTabChange(availableTabs[0]);
    }
  }, [availableTabs, hasTabAccess, isProjectLoading, onTabChange]);

  const handleStartEditName = () => {
    setNameDraft(project.name);
    setIsEditingName(true);
  };

  const handleCancelEditName = () => {
    setNameDraft(project.name);
    setIsEditingName(false);
  };

  const handleSaveName = async () => {
    const nextName = nameDraft.trim();
    if (!nextName || nextName === project.name) {
      handleCancelEditName();
      return;
    }

    try {
      onUpdateProject({ name: nextName });
      await projectsApi.update(project.id, { name: nextName });
      setIsEditingName(false);
    } catch (error) {
      console.error('Erro ao atualizar nome da obra:', error);
      toast.error('Nao foi possivel atualizar o nome. Tente novamente.');
      setNameDraft(project.name);
      setIsEditingName(false);
    }
  };

  const currentStats = useMemo(() =>
    treeService.calculateBasicStats(project.items, project.bdi, project),
    [project]
  );

  const expenseStats = useMemo(() =>
    expenseService.getExpenseStats(project.expenses),
    [project.expenses]
  );

  const displayData = useMemo(() => {
    if (viewingMeasurementId === 'current') {
      return {
        items: project.items,
        isReadOnly: !canEditProject,
        label: `Medição Nº ${project.measurementNumber}`,
        date: project.referenceDate,
      };
    }
    const snapshot = project.history?.find(h => h.measurementNumber === viewingMeasurementId);
    if (snapshot) return { items: snapshot.items, isReadOnly: true, label: `Medição Nº ${snapshot.measurementNumber}`, date: snapshot.date };
    return { items: project.items, isReadOnly: !canEditProject, label: 'Erro', date: '' };
  }, [project, viewingMeasurementId, canEditProject]);

  const flattenedPrintData = useMemo(() => {
    const tree = treeService.buildTree<WorkItem>(displayData.items);
    const processed = tree.map((root, idx) => treeService.processRecursive(root, '', idx, project.bdi));
    const allIds = new Set<string>(displayData.items.map(i => i.id));
    return treeService.flattenTree(processed, allIds);
  }, [displayData.items, project.bdi]);

  const isHistoryMode = viewingMeasurementId !== 'current';

  const laborContractsTabKey = `labor_contracts_last_tab_${project.id}`;
  const resolveLaborContractsTab = (value: string | null): TabID =>
    value === 'workforce' ? 'workforce' : 'labor-contracts';

  useEffect(() => {
    if (activeTab !== 'labor-contracts' && activeTab !== 'workforce') return;
    uiPreferences.setString(laborContractsTabKey, activeTab);
  }, [activeTab, laborContractsTabKey]);

  const isLatestHistory = viewingMeasurementId !== 'current' &&
    project.history &&
    project.history.length > 0 &&
    viewingMeasurementId === project.history[0].measurementNumber;

  const handleTabClick = (newTab: TabID) => {
    if (Date.now() < dragBlockUntilRef.current) return;
    saveTabsScroll();
    if (newTab === 'labor-contracts') {
      const savedTab = resolveLaborContractsTab(uiPreferences.getString(laborContractsTabKey));
      onTabChange(savedTab);
      return;
    }
    onTabChange(newTab);
  };

  const handleOpenModal = (type: 'category' | 'item', item: WorkItem | null, parentId: string | null) => {
    if (displayData.isReadOnly) return;
    setModalType(type); setEditingItem(item); setTargetParentId(parentId); setIsModalOpen(true);
  };

  const handleSaveWorkItem = async (data: Partial<WorkItem>) => {
    if (editingItem) {
      const updated = { ...editingItem, ...data } as WorkItem;
      onUpdateProject({ items: project.items.map(it => it.id === editingItem.id ? updated : it) });
      try {
        await workItemsApi.update(editingItem.id, {
          parentId: updated.parentId,
          name: updated.name,
          type: updated.type,
          unit: updated.unit,
          cod: updated.cod,
          fonte: updated.fonte,
          contractQuantity: updated.contractQuantity,
          unitPrice: updated.unitPrice,
          unitPriceNoBdi: updated.unitPriceNoBdi,
        });
      } catch (error) {
        console.error('Erro ao salvar item:', error);
      }
    } else {
      const resolvedType = (data.type || modalType) as WorkItem['type'];
      const newItem: WorkItem = {
        id: crypto.randomUUID(),
        parentId: data.parentId ?? targetParentId,
        name: data.name || '',
        type: resolvedType,
        wbs: '',
        order: project.items.length,
        unit: resolvedType === 'category' ? '' : (data.unit || 'un'),
        cod: data.cod,
        fonte: data.fonte,
        contractQuantity: data.contractQuantity || 0,
        unitPrice: data.unitPrice || 0,
        unitPriceNoBdi: data.unitPriceNoBdi || 0,
        contractTotal: 0,
        previousQuantity: 0,
        previousTotal: 0,
        currentQuantity: 0,
        currentTotal: 0,
        currentPercentage: 0,
        accumulatedQuantity: 0,
        accumulatedTotal: 0,
        accumulatedPercentage: 0,
        balanceQuantity: 0,
        balanceTotal: 0,
      };
      try {
        const created = await workItemsApi.create(project.id, newItem);
        onUpdateProject({ items: [...project.items, created] });
      } catch (error) {
        console.error('Erro ao criar item:', error);
        onUpdateProject({ items: [...project.items, newItem] });
      }
    }
  };

  const syncExpenseChanges = useCallback(async (prevExpenses: ProjectExpense[], nextExpenses: ProjectExpense[]) => {
    const prevMap = new Map(prevExpenses.map(expense => [expense.id, expense] as const));
    const nextMap = new Map(nextExpenses.map(expense => [expense.id, expense] as const));

    const removed = prevExpenses.filter(expense => !nextMap.has(expense.id));
    const added = nextExpenses.filter(expense => !prevMap.has(expense.id));

    const updated = nextExpenses
      .map(expense => {
        const prev = prevMap.get(expense.id);
        if (!prev) return null;

        const patch: Partial<ProjectExpense> = {};
        if (prev.parentId !== expense.parentId) patch.parentId = expense.parentId;
        if (prev.type !== expense.type) patch.type = expense.type;
        if (prev.itemType !== expense.itemType) patch.itemType = expense.itemType;
        if (prev.wbs !== expense.wbs) patch.wbs = expense.wbs;
        if (prev.order !== expense.order) patch.order = expense.order;
        if (prev.date !== expense.date) patch.date = expense.date;
        if (prev.description !== expense.description) patch.description = expense.description;
        if (prev.entityName !== expense.entityName) patch.entityName = expense.entityName;
        if (prev.unit !== expense.unit) patch.unit = expense.unit;
        if (prev.quantity !== expense.quantity) patch.quantity = expense.quantity;
        if (prev.unitPrice !== expense.unitPrice) patch.unitPrice = expense.unitPrice;
        if (prev.amount !== expense.amount) patch.amount = expense.amount;
        if (prev.isPaid !== expense.isPaid) patch.isPaid = expense.isPaid;
        if (prev.status !== expense.status) patch.status = expense.status;
        if (prev.paymentDate !== expense.paymentDate) patch.paymentDate = expense.paymentDate;
        if (prev.paymentProof !== expense.paymentProof) patch.paymentProof = expense.paymentProof;
        if (prev.invoiceDoc !== expense.invoiceDoc) patch.invoiceDoc = expense.invoiceDoc;
        if (prev.deliveryDate !== expense.deliveryDate) patch.deliveryDate = expense.deliveryDate;
        if (prev.discountValue !== expense.discountValue) patch.discountValue = expense.discountValue;
        if (prev.discountPercentage !== expense.discountPercentage) patch.discountPercentage = expense.discountPercentage;
        if (prev.linkedWorkItemId !== expense.linkedWorkItemId) patch.linkedWorkItemId = expense.linkedWorkItemId;

        return Object.keys(patch).length > 0 ? { id: expense.id, patch } : null;
      })
      .filter(Boolean) as { id: string; patch: Partial<ProjectExpense> }[];

    try {
      const totalChanges = removed.length + added.length + updated.length;
      // If this is a very large change (import), perform a replace by types in a single batch request
      if (totalChanges > 50) {
        const typesToReplace = Array.from(new Set(nextExpenses.map(e => e.type)));
        await projectExpensesApi.batch(project.id, nextExpenses, typesToReplace);
        return;
      }

      await Promise.all(removed.map(expense => projectExpensesApi.remove(expense.id)));
      await Promise.all(added.map(expense => projectExpensesApi.create(project.id, expense)));
      await Promise.all(updated.map(update => projectExpensesApi.update(update.id, update.patch)));
    } catch (error) {
      console.error('Erro ao sincronizar despesas:', error);
    }
  }, [project.id]);

  const handleExpenseAdd = useCallback(async (expense: ProjectExpense) => {
    try {
      const created = await projectExpensesApi.create(project.id, expense);
      onUpdateProject({ expenses: [...project.expenses, created] });
    } catch (error) {
      console.error('Erro ao criar despesa:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao criar despesa.');
      onUpdateProject({ expenses: [...project.expenses, expense] });
    }
  }, [project.expenses, project.id, onUpdateProject, toast]);

  const handleExpenseAddMany = useCallback(async (expenses: ProjectExpense[]) => {
    onUpdateProject({ expenses: [...project.expenses, ...expenses] });
    try {
      await Promise.all(expenses.map(expense => projectExpensesApi.create(project.id, expense)));
    } catch (error) {
      console.error('Erro ao importar despesas:', error);
    }
  }, [project.expenses, project.id, onUpdateProject]);

  const handleExpenseUpdate = useCallback(async (id: string, data: Partial<ProjectExpense>) => {
    const updatedExpenses = project.expenses.map(expense => expense.id === id ? { ...expense, ...data } : expense);
    onUpdateProject({ expenses: updatedExpenses });
    try {
      await projectExpensesApi.update(id, data);
    } catch (error) {
      console.error('Erro ao atualizar despesa:', error);
    }
  }, [project.expenses, onUpdateProject]);

  const handleExpenseDelete = useCallback(async (id: string) => {
    const updatedExpenses = project.expenses.filter(expense => expense.id !== id && expense.parentId !== id);
    onUpdateProject({ expenses: updatedExpenses });
    try {
      await projectExpensesApi.remove(id);
    } catch (error) {
      console.error('Erro ao excluir despesa:', error);
    }
  }, [project.expenses, onUpdateProject]);

  const handleExpensesReplace = useCallback(async (nextExpenses: ProjectExpense[]) => {
    const prevExpenses = project.expenses;
    onUpdateProject({ expenses: nextExpenses });
    await syncExpenseChanges(prevExpenses, nextExpenses);
  }, [project.expenses, onUpdateProject, syncExpenseChanges]);

  const syncPlanningEntities = useCallback(async (nextPlanning: ProjectPlanning) => {
    const prevPlanning = project.planning;

    const diffItems = <T extends { id: string }>(
      prev: T[],
      next: T[],
      getPatch: (prevItem: T, nextItem: T) => Partial<T>,
      create: (item: T) => Promise<T>,
      update: (id: string, patch: Partial<T>) => Promise<T>,
      remove: (id: string) => Promise<void>,
    ) => {
      const prevMap = new Map(prev.map(item => [item.id, item] as const));
      const nextMap = new Map(next.map(item => [item.id, item] as const));

      const removed = prev.filter(item => !nextMap.has(item.id));
      const added = next.filter(item => !prevMap.has(item.id));
      const updated = next
        .map(item => {
          const prevItem = prevMap.get(item.id);
          if (!prevItem) return null;
          const patch = getPatch(prevItem, item);
          return Object.keys(patch).length > 0 ? { id: item.id, patch } : null;
        })
        .filter(Boolean) as { id: string; patch: Partial<T> }[];

      return { removed, added, updated, create, update, remove };
    };

    const taskDiff = diffItems<PlanningTask>(
      prevPlanning.tasks,
      nextPlanning.tasks,
      (prev, next) => {
        const patch: Partial<PlanningTask> = {};
        if (prev.categoryId !== next.categoryId) patch.categoryId = next.categoryId;
        if (prev.description !== next.description) patch.description = next.description;
        if (prev.status !== next.status) patch.status = next.status;
        if (prev.isCompleted !== next.isCompleted) patch.isCompleted = next.isCompleted;
        if (prev.dueDate !== next.dueDate) patch.dueDate = next.dueDate;
        if (prev.createdAt !== next.createdAt) patch.createdAt = next.createdAt;
        if (prev.completedAt !== next.completedAt) patch.completedAt = next.completedAt;
        return patch;
      },
      (item) => planningApi.createTask(project.id, item),
      (id, patch) => planningApi.updateTask(id, patch),
      (id) => planningApi.deleteTask(id),
    );

    const forecastDiff = diffItems<MaterialForecast>(
      prevPlanning.forecasts,
      nextPlanning.forecasts,
      (prev, next) => {
        const patch: Partial<MaterialForecast> = {};
        if (prev.description !== next.description) patch.description = next.description;
        if (prev.unit !== next.unit) patch.unit = next.unit;
        if (prev.quantityNeeded !== next.quantityNeeded) patch.quantityNeeded = next.quantityNeeded;
        if (prev.unitPrice !== next.unitPrice) patch.unitPrice = next.unitPrice;
        if (prev.discountValue !== next.discountValue) patch.discountValue = next.discountValue;
        if (prev.discountPercentage !== next.discountPercentage) patch.discountPercentage = next.discountPercentage;
        if (prev.estimatedDate !== next.estimatedDate) patch.estimatedDate = next.estimatedDate;
        if (prev.purchaseDate !== next.purchaseDate) patch.purchaseDate = next.purchaseDate;
        if (prev.deliveryDate !== next.deliveryDate) patch.deliveryDate = next.deliveryDate;
        if (prev.status !== next.status) patch.status = next.status;
        if (prev.isPaid !== next.isPaid) patch.isPaid = next.isPaid;
        if (prev.isCleared !== next.isCleared) patch.isCleared = next.isCleared;
        if (prev.order !== next.order) patch.order = next.order;
        if (prev.supplierId !== next.supplierId) patch.supplierId = next.supplierId;
        if (prev.paymentProof !== next.paymentProof) patch.paymentProof = next.paymentProof;
        return patch;
      },
      (item) => planningApi.createForecast(project.id, item),
      (id, patch) => planningApi.updateForecast(id, patch),
      (id) => planningApi.deleteForecast(id),
    );

    const milestoneDiff = diffItems<Milestone>(
      prevPlanning.milestones,
      nextPlanning.milestones,
      (prev, next) => {
        const patch: Partial<Milestone> = {};
        if (prev.title !== next.title) patch.title = next.title;
        if (prev.date !== next.date) patch.date = next.date;
        if (prev.isCompleted !== next.isCompleted) patch.isCompleted = next.isCompleted;
        return patch;
      },
      (item) => planningApi.createMilestone(project.id, item),
      (id, patch) => planningApi.updateMilestone(id, patch),
      (id) => planningApi.deleteMilestone(id),
    );

    try {
      const totalChanges = taskDiff.removed.length + taskDiff.added.length + taskDiff.updated.length + forecastDiff.removed.length + forecastDiff.added.length + forecastDiff.updated.length + milestoneDiff.removed.length + milestoneDiff.added.length + milestoneDiff.updated.length;
      if (totalChanges > 50) {
        // Large change detected (likely an import) — replace whole planning in one request
        await planningApi.replace(project.id, {
          tasks: nextPlanning.tasks,
          forecasts: nextPlanning.forecasts,
          milestones: nextPlanning.milestones,
        });
        return;
      }

      await Promise.all(taskDiff.removed.map(item => taskDiff.remove(item.id)));
      await Promise.all(forecastDiff.removed.map(item => forecastDiff.remove(item.id)));
      await Promise.all(milestoneDiff.removed.map(item => milestoneDiff.remove(item.id)));

      await Promise.all(taskDiff.added.map(item => taskDiff.create(item)));
      await Promise.all(forecastDiff.added.map(item => forecastDiff.create(item)));
      await Promise.all(milestoneDiff.added.map(item => milestoneDiff.create(item)));

      await Promise.all(taskDiff.updated.map(item => taskDiff.update(item.id, item.patch)));
      await Promise.all(forecastDiff.updated.map(item => forecastDiff.update(item.id, item.patch)));
      await Promise.all(milestoneDiff.updated.map(item => milestoneDiff.update(item.id, item.patch)));
    } catch (error) {
      console.error('Erro ao sincronizar planejamento:', error);
    }
  }, [project.id, project.planning]);

  const handleUpdatePlanning = useCallback(async (nextPlanning: ProjectPlanning) => {
    onUpdateProject({ planning: nextPlanning });
    await syncPlanningEntities(nextPlanning);
  }, [onUpdateProject, syncPlanningEntities]);

  const handleAssetAdd = useCallback(async (asset: ProjectAsset) => {
    const nextAssets = [...project.assets, asset];
    onUpdateProject({ assets: nextAssets });
    try {
      const created = await projectAssetsApi.create(project.id, asset);
      onUpdateProject({
        assets: nextAssets.map((item) => (item.id === asset.id ? created : item)),
      });
    } catch (error) {
      console.error('Erro ao criar arquivo:', error);
    }
  }, [project.assets, project.id, onUpdateProject]);

  const handleAssetDelete = useCallback(async (id: string) => {
    const previous = project.assets;
    const nextAssets = previous.filter((asset) => asset.id !== id);
    onUpdateProject({ assets: nextAssets });
    try {
      await projectAssetsApi.remove(id);
    } catch (error) {
      console.error('Erro ao remover arquivo:', error);
      onUpdateProject({ assets: previous });
    }
  }, [project.assets, onUpdateProject]);

  const mergeBrandingPayload = (base: Partial<Project>, next: Partial<Project>) => ({
    ...base,
    ...next,
    config: next.config ? { ...(base.config ?? {}), ...next.config } : base.config,
    theme: next.theme ? { ...(base.theme ?? {}), ...next.theme } : base.theme,
  });

  const handleBrandingUpdate = useCallback((data: Partial<Project>) => {
    onUpdateProject(data);
    pendingBrandingRef.current = mergeBrandingPayload(pendingBrandingRef.current, data);

    if (brandingDebounceRef.current) {
      window.clearTimeout(brandingDebounceRef.current);
    }

    brandingDebounceRef.current = window.setTimeout(async () => {
      const payload = pendingBrandingRef.current;
      pendingBrandingRef.current = {};

      if (Object.keys(payload).length === 0) return;

      try {
        await projectsApi.update(project.id, payload);
      } catch (error) {
        console.error('Erro ao atualizar projeto:', error);
      }
    }, 500);
  }, [project.id, onUpdateProject]);

  const handleConfirmReopen = () => {
    const updated = projectService.reopenLatestMeasurement(project);
    onUpdateProject(updated);
    setViewingMeasurementId('current');
    setIsReopenModalOpen(false);
  };

  const TabBtn: React.FC<{ active: boolean; id: TabID; label: string; icon: React.ReactNode }> = ({ active, id, label, icon }) => (
    <button
      data-tab={id}
      onClick={() => handleTabClick(id)}
      className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap shrink-0 select-none cursor-pointer ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white dark:bg-slate-900 text-slate-500 hover:text-indigo-600 border border-slate-200 dark:border-slate-800'}`}
    >
      <span className={active ? 'text-white' : 'text-slate-400'}>{icon}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-slate-950">

      {/* 1. HEADER DE CONTEXTO */}
      <header className={`no-print border-b p-6 shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-6 z-40 transition-colors ${isHistoryMode ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
        <div className="flex items-center gap-4 min-w-0">
          <div className={`p-3 rounded-2xl shrink-0 ${isHistoryMode ? 'bg-amber-100 text-amber-600' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600'}`}>
            {isHistoryMode ? <History size={24} /> : <HardHat size={24} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              {isEditingName ? (
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') handleCancelEditName();
                  }}
                  className="w-full max-w-[360px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm font-black uppercase tracking-tight text-slate-800 dark:text-white"
                  autoFocus
                />
              ) : (
                <h1 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white leading-none truncate">{project.name}</h1>
              )}
              {!isHistoryMode && canEditMeasurements && (
                isEditingName ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleSaveName}
                      title="Salvar"
                      className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={handleCancelEditName}
                      title="Cancelar"
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleStartEditName}
                    title="Editar nome"
                    className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                  >
                    <Edit2 size={14} />
                  </button>
                )
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <div className="relative z-50">
                <select
                  className={`pl-8 pr-10 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest appearance-none border-2 outline-none cursor-pointer transition-all ${isHistoryMode ? 'bg-amber-200 border-amber-400 text-amber-900 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-500 hover:border-indigo-400'}`}
                  value={viewingMeasurementId}
                  onChange={(e) => setViewingMeasurementId(e.target.value === 'current' ? 'current' : Number(e.target.value))}
                >
                  <option value="current">Período Aberto (Nº {project.measurementNumber})</option>
                  {project.history?.map((h, idx) => (
                    <option key={`${h.measurementNumber}-${idx}`} value={h.measurementNumber}>
                      Histórico: Medição Nº {h.measurementNumber}
                    </option>
                  ))}
                </select>
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50"><Clock size={12} /></div>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-current"><ChevronDown size={14} /></div>
              </div>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest whitespace-nowrap">Ref: {displayData.date}</span>
              {isHistoryMode && <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-100 rounded-md text-[8px] font-black uppercase shadow-sm"><Lock size={10} /> Arquivo Congelado</div>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Project Members Badge */}
          <ProjectMembersBadge
            users={memberPreviewUsers}
            onClick={() => setShowMembersModal(true)}
            canEdit={canEditMembers}
          />

          {!isHistoryMode && (
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl mr-2 border border-slate-200 dark:border-slate-700 shadow-inner">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                title="Desfazer (Undo)"
                className={`p-2.5 rounded-xl transition-all ${canUndo ? 'text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 shadow-sm hover:scale-110 active:scale-90' : 'text-slate-300 dark:text-slate-600 opacity-40 cursor-not-allowed'}`}
              >
                <Undo2 size={18} />
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                title="Refazer (Redo)"
                className={`p-2.5 rounded-xl transition-all ${canRedo ? 'text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 shadow-sm hover:scale-110 active:scale-90' : 'text-slate-300 dark:text-slate-600 opacity-40 cursor-not-allowed'}`}
              >
                <Redo2 size={18} />
              </button>
            </div>
          )}

          {!isHistoryMode ? (
            canEditMeasurements ? (
              <button onClick={() => setIsClosingModalOpen(true)} className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 active:scale-95 transition-all shadow-xl shadow-indigo-500/20">
                <CheckCircle2 size={16} /> Encerrar Período
              </button>
            ) : null
          ) : (
            <div className="flex items-center gap-2">
              {isLatestHistory && canEditMeasurements && (
                <button onClick={() => setIsReopenModalOpen(true)} className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-rose-500 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all shadow-sm">
                  <RotateCcw size={16} /> Reabrir Medição
                </button>
              )}
              <button onClick={() => setViewingMeasurementId('current')} className="flex items-center gap-2 px-6 py-3.5 bg-white border-2 border-amber-400 text-amber-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-50 active:scale-95 transition-all shadow-sm">
                <ArrowRight size={16} /> Voltar ao Período Atual
              </button>
            </div>
          )}
        </div>
      </header>

      {isProjectLoading ? (
        <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm font-semibold">
            <div className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" />
            Carregando obra...
          </div>
        </div>
      ) : availableTabs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="text-center text-slate-500 dark:text-slate-400">
            <p className="text-sm font-semibold">Acesso negado</p>
            <p className="text-xs mt-2">Você não tem permissão para acessar esta obra.</p>
          </div>
        </div>
      ) : !hasTabAccess ? (
        <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="text-sm text-slate-500 dark:text-slate-400">Redirecionando...</div>
        </div>
      ) : (
        <>
          {/* 2. SUB-NAVEGAÇÃO */}
          <nav className="no-print bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shrink-0 sticky top-0 z-20 overflow-hidden">
            <div
              ref={tabsNavRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              onScroll={handleTabsScroll}
              className={`px-6 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing select-none`}
            >
              {canView('wbs') && <TabBtn active={tab === 'wbs'} id="wbs" label="Planilha EAP" icon={<Layers size={16} />} />}
              {canView('technical_analysis') && <TabBtn active={tab === 'stats'} id="stats" label="Análise Técnica" icon={<BarChart3 size={16} />} />}
              {canView('financial_flow') && <TabBtn active={tab === 'expenses'} id="expenses" label="Fluxo Financeiro" icon={<Coins size={16} />} />}
              {canView('supplies') && <TabBtn active={tab === 'supplies'} id="supplies" label="Suprimentos" icon={<Boxes size={16} />} />}
              {canView('workforce') && <TabBtn active={tab === 'labor-contracts' || tab === 'workforce'} id="labor-contracts" label="Contratos M.O." icon={<Briefcase size={16} />} />}
              {canView('planning') && <TabBtn active={tab === 'planning'} id="planning" label="Planejamento" icon={<HardHat size={16} />} />}
              {canView('journal') && <TabBtn active={tab === 'journal'} id="journal" label="Diário de Obra" icon={<BookOpen size={16} />} />}
              {canView('schedule') && <TabBtn active={tab === 'schedule'} id="schedule" label="Cronograma" icon={<Target size={16} />} />}
              {canView('documents') && <TabBtn active={tab === 'documents'} id="documents" label="Repositório" icon={<FileText size={16} />} />}
              {canView('project_settings') && <TabBtn active={tab === 'branding'} id="branding" label="Ajustes" icon={<Sliders size={16} />} />}
            </div>
          </nav>

          <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950 project-fullscreen">
            {/* 3. CONTEÚDO DINÂMICO */}
            <div
              className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar no-print project-scroll"
              style={{ overflowAnchor: 'none' }}
            >
              <div className="max-w-[1600px] mx-auto">
                {(tab === 'labor-contracts' || tab === 'workforce') && canView('workforce') && (
                  <div className="flex items-center justify-end mb-6">
                    <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <button
                        onClick={() => onTabChange('labor-contracts')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          tab === 'labor-contracts'
                            ? 'bg-indigo-600 text-white shadow-lg'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Contratos M.O.
                      </button>
                      <button
                        onClick={() => onTabChange('workforce')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          tab === 'workforce'
                            ? 'bg-indigo-600 text-white shadow-lg'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Equipe Permanente
                      </button>
                    </div>
                  </div>
                )}
                {tab === 'wbs' && <WbsView project={{ ...project, items: displayData.items }} onUpdateProject={onUpdateProject} onOpenModal={handleOpenModal} isReadOnly={displayData.isReadOnly} />}
                {tab === 'stats' && <StatsView project={{ ...project, items: displayData.items }} />}
                {tab === 'expenses' && (
                  <ExpenseManager
                    project={project}
                    suppliers={effectiveSuppliers}
                    expenses={project.expenses}
                    onAdd={handleExpenseAdd}
                    onAddMany={handleExpenseAddMany}
                    onUpdate={handleExpenseUpdate}
                    onDelete={handleExpenseDelete}
                    workItems={displayData.items}
                    measuredValue={treeService.calculateBasicStats(displayData.items, project.bdi).current}
                    onUpdateExpenses={handleExpensesReplace}
                    isReadOnly={displayData.isReadOnly}
                  />
                )}
                {tab === 'supplies' && (
                  <PlanningView
                    project={project}
                    suppliers={effectiveSuppliers}
                    onUpdatePlanning={handleUpdatePlanning}
                    onAddExpense={handleExpenseAdd}
                    onUpdateExpense={handleExpenseUpdate}
                    categories={displayData.items.filter(i => i.type === 'category')}
                    allWorkItems={displayData.items}
                    viewMode="supplies"
                  />
                )}
                {tab === 'labor-contracts' && (
                  <LaborContractsManager
                    project={project}
                    onUpdateProject={onUpdateProject}
                    onAddExpense={handleExpenseAdd}
                    onUpdateExpense={handleExpenseUpdate}
                    isReadOnly={displayData.isReadOnly}
                  />
                )}
                {tab === 'workforce' && <WorkforceManager project={project} onUpdateProject={onUpdateProject} />}
                {tab === 'planning' && (
                  <PlanningView
                    project={project}
                    suppliers={effectiveSuppliers}
                    onUpdatePlanning={handleUpdatePlanning}
                    onAddExpense={handleExpenseAdd}
                    onUpdateExpense={handleExpenseUpdate}
                    categories={displayData.items.filter(i => i.type === 'category')}
                    allWorkItems={displayData.items}
                    fixedSubTab="tasks"
                    showSubTabs={false}
                  />
                )}
                {tab === 'schedule' && (
                  <PlanningView
                    project={project}
                    suppliers={effectiveSuppliers}
                    onUpdatePlanning={handleUpdatePlanning}
                    onAddExpense={handleExpenseAdd}
                    onUpdateExpense={handleExpenseUpdate}
                    categories={displayData.items.filter(i => i.type === 'category')}
                    allWorkItems={displayData.items}
                    fixedSubTab="milestones"
                    showSubTabs={false}
                  />
                )}
                {tab === 'journal' && <JournalView project={project} onUpdateJournal={(j) => onUpdateProject({ journal: j })} allWorkItems={displayData.items} />}
                {tab === 'documents' && <AssetManager assets={project.assets} onAdd={handleAssetAdd} onDelete={handleAssetDelete} isReadOnly={displayData.isReadOnly} />}
                {tab === 'branding' && <BrandingView project={project} onUpdateProject={handleBrandingUpdate} isReadOnly={displayData.isReadOnly} />}
              </div>
            </div>
          </div>
          {/* (Áreas de Impressão e Modais existentes preservados...) */}

          <div className="print-report-area">
            {tab === 'wbs' && (
              <PrintReport
                project={project}
                companyName={project.companyName}
                companyCnpj={project.companyCnpj}
                data={flattenedPrintData}
                expenses={project.expenses}
                stats={currentStats}
              />
            )}
            {tab === 'expenses' && (
              <PrintExpenseReport
                project={project}
                expenses={project.expenses}
                stats={expenseStats}
              />
            )}
            {(tab === 'planning' || tab === 'supplies' || tab === 'schedule') && (
              <PrintPlanningReport
                project={project}
              />
            )}
          </div>

          <WorkItemModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveWorkItem} editingItem={editingItem} type={modalType} initialParentId={targetParentId} categories={treeService.flattenTree(treeService.buildTree(displayData.items.filter(i => i.type === 'category')), new Set(displayData.items.map(i => i.id)))} projectBdi={project.bdi} />

          {isClosingModalOpen && (
            <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsClosingModalOpen(false)}>
              <div className="bg-white dark:bg-[#0f111a] w-full max-w-lg rounded-[3rem] p-12 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center relative overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/10 blur-[100px] pointer-events-none"></div>
                <div className="relative mb-10">
                  <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800/40 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700">
                    <Lock size={36} className="text-indigo-500" />
                  </div>
                </div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-6">Finalizar Período?</h2>
                <div className="space-y-2 mb-12">
                  <p className="text-slate-500 dark:text-slate-400 text-lg font-medium leading-relaxed">
                    A medição <span className="text-slate-900 dark:text-white font-bold">#{project.measurementNumber}</span> será congelada no histórico.
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-lg font-medium leading-relaxed">
                    O valor total faturado no período é <span className="text-slate-900 dark:text-white font-bold">{financial.formatVisual(currentStats.current, project.theme?.currencySymbol)}</span>.
                  </p>
                </div>
                <div className="flex items-center gap-6 w-full">
                  <button onClick={() => setIsClosingModalOpen(false)} className="flex-1 py-4 text-slate-500 dark:text-slate-500 font-black uppercase text-xs tracking-widest hover:text-slate-800 dark:hover:text-white transition-colors">Voltar</button>
                  <button
                    onClick={async () => {
                      if (isClosingInProgress) return;
                      setIsClosingInProgress(true);
                      try {
                        await onCloseMeasurement();
                        setIsClosingModalOpen(false);
                      } finally {
                        setIsClosingInProgress(false);
                      }
                    }}
                    disabled={isClosingInProgress}
                    className="flex-[2] py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-[0_10px_30px_-10px_rgba(79,70,229,0.5)] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isClosingInProgress ? 'Processando...' : 'Confirmar e abrir próxima'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isReopenModalOpen && (
            <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsReopenModalOpen(false)}>
              <div className="bg-white dark:bg-[#0f111a] w-full max-w-lg rounded-[3rem] p-12 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center relative overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-rose-500/10 blur-[100px] pointer-events-none"></div>
                <div className="relative mb-10">
                  <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800/40 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700">
                    <RefreshCw size={36} className="text-rose-500" />
                  </div>
                </div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-6">Reabrir Medição?</h2>
                <div className="space-y-4 mb-12">
                  <p className="text-slate-500 dark:text-slate-400 text-lg font-medium leading-relaxed">
                    Deseja realmente reativar a medição <span className="text-slate-900 dark:text-white font-bold">#{viewingMeasurementId}</span>?
                  </p>
                  <p className="text-rose-500/80 dark:text-rose-400/80 text-sm font-bold uppercase tracking-widest">
                    O período atual será descartado e o histórico voltará um passo.
                  </p>
                </div>
                <div className="flex items-center gap-6 w-full">
                  <button onClick={() => setIsReopenModalOpen(false)} className="flex-1 py-4 text-slate-500 dark:text-slate-500 font-black uppercase text-xs tracking-widest hover:text-slate-800 dark:hover:text-white transition-colors">Cancelar</button>
                  <button onClick={handleConfirmReopen} className="flex-[2] py-5 bg-rose-600 hover:bg-rose-50 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-[0_10px_30px_-10px_rgba(225,29,72,0.5)] active:scale-95 transition-all">Confirmar Reabertura</button>
                </div>
              </div>
            </div>
          )}

          {showMembersModal && (
            <ProjectMembersModal
              projectId={project.id}
              members={projectMembers}
              allUsers={allUsers}
              allRoles={allRoles}
              generalAccessUserIds={generalAccessUserIds}
              canEdit={canEditMembers}
              onClose={() => setShowMembersModal(false)}
              onMembersChange={handleMembersChange}
            />
          )}
        </>
      )}
    </div>
  );
};
