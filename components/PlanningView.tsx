
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, PlanningTask, MaterialForecast, Milestone, WorkItem, TaskStatus, ProjectPlanning, ProjectExpense, Supplier, SupplyGroup } from '../types';
import { planningApi } from '../services/planningApi';
import { planningService } from '../services/planningService';
import { excelService } from '../services/excelService';
import {
  createFallbackMaterialAutocompleteProvider,
  createLocalMaterialAutocompleteProvider,
  createRemoteMaterialAutocompleteProvider,
  type MaterialSuggestion,
} from '../services/materialAutocompleteService';
import { projectExpensesApi } from '../services/projectExpensesApi';
import { financial } from '../utils/math';
import { 
  CheckCircle2, Circle, Clock, Package, Flag, Plus, 
  Trash2, Calendar, AlertCircle, ShoppingCart, Truck, Search,
  Wand2, ArrowUpRight, Ban, ListChecks, Boxes, Target,
  GripVertical, MoreVertical, Edit2, X, Save, Calculator, Wallet, Link,
  ChevronUp, ChevronDown, List, CalendarDays, Filter, Users, Download, UploadCloud,
  Layers, FlagTriangleRight, Printer, CreditCard, ChevronLeft, ChevronRight,
  Building2, User, FolderTree, FileCheck, ReceiptText, Receipt, FileText, FileSpreadsheet,
  Pin,
  ArrowRight, Loader2
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ExpenseAttachmentZone } from './ExpenseAttachmentZone';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from '../hooks/useToast';
import { uiPreferences } from '../utils/uiPreferences';
import { useAuth } from '../auth/AuthContext';

interface PlanningViewProps {
  project: Project;
  suppliers: Supplier[];
  onUpdatePlanning: (planning: ProjectPlanning) => void;
  onAddExpense: (expense: ProjectExpense) => void;
  onUpdateExpense: (id: string, data: Partial<ProjectExpense>) => void;
  categories: WorkItem[];
  allWorkItems: WorkItem[];
  viewMode?: 'planning' | 'supplies';
  onRequestPrintReport?: () => void;
  fixedSubTab?: 'tasks' | 'forecast' | 'milestones';
  showSubTabs?: boolean;
  isReadOnly?: boolean;
  isProjectArchived?: boolean;
  canEditModule?: boolean;
}

export const PlanningView: React.FC<PlanningViewProps> = ({ 
  project,
  suppliers,
  onUpdatePlanning,
  onAddExpense,
  onUpdateExpense,
  categories,
  allWorkItems,
  viewMode = 'planning',
  onRequestPrintReport,
  fixedSubTab,
  showSubTabs = true,
  isReadOnly = false,
  isProjectArchived = false,
  canEditModule = true,
}) => {
  const { user } = useAuth();
  const toast = useToast();
  const canEditPlanning = canEditModule && !isReadOnly && !isProjectArchived;
  const showReadOnlyWarning = () => {
    if (isProjectArchived) {
      toast.warning('Obra arquivada: edição, cadastro e remoção estão bloqueados.');
      return;
    }
    toast.warning('Sem permissão de edição para este módulo.');
  };

  const ensureCanEditPlanning = () => {
    if (canEditPlanning) return true;
    showReadOnlyWarning();
    return false;
  };

  const planningSubTabs: Array<'tasks' | 'forecast' | 'milestones'> = ['tasks', 'forecast', 'milestones'];
  const planningTabKey = `planning_subtab_${project.id}`;
  const suppliesStatusKey = `supplies_status_${project.id}`;
  const supplyGroupsExpandedKey = `supplies_groups_expanded_${project.id}`;
  const isSuppliesView = viewMode === 'supplies';

  const [activeSubTab, setActiveSubTab] = useState<'tasks' | 'forecast' | 'milestones'>(() => {
    if (fixedSubTab) return fixedSubTab;
    if (isSuppliesView) return 'forecast';
    const saved = uiPreferences.getString(planningTabKey);
    return saved && planningSubTabs.includes(saved as 'tasks' | 'forecast' | 'milestones')
      ? (saved as 'tasks' | 'forecast' | 'milestones')
      : 'tasks';
  });
  const [editingTask, setEditingTask] = useState<PlanningTask | null>(null);
  const [confirmingForecast, setConfirmingForecast] = useState<MaterialForecast | null>(null);
  const [forcePaidConfirm, setForcePaidConfirm] = useState(false);
  const [confirmingDeliveryForecast, setConfirmingDeliveryForecast] = useState<MaterialForecast | null>(null);
  const [confirmingClearanceForecast, setConfirmingClearanceForecast] = useState<MaterialForecast | null>(null);
  const [isAddingForecast, setIsAddingForecast] = useState(false);
  const [isAddingSupplyGroup, setIsAddingSupplyGroup] = useState(false);
  const [isConvertingForecastsToGroup, setIsConvertingForecastsToGroup] = useState(false);
  const [isNewOrderPopoverOpen, setIsNewOrderPopoverOpen] = useState(false);
  const [isBatchSelectionMode, setIsBatchSelectionMode] = useState(false);
  const [expandedSupplyGroups, setExpandedSupplyGroups] = useState<Record<string, boolean>>(() => {
    const raw = uiPreferences.getString(supplyGroupsExpandedKey);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, boolean>;
      }
    } catch {
      // ignore invalid storage values
    }
    return {};
  });
  const [supplyGroupsCache, setSupplyGroupsCache] = useState<Record<string, SupplyGroup>>({});
  const [confirmingGroupPurchase, setConfirmingGroupPurchase] = useState<SupplyGroup | null>(null);
  const [confirmingGroupDelivery, setConfirmingGroupDelivery] = useState<SupplyGroup | null>(null);
  const [confirmingGroupClearance, setConfirmingGroupClearance] = useState<SupplyGroup | null>(null);
  const [editingGroupDocs, setEditingGroupDocs] = useState<SupplyGroup | null>(null);
  const [confirmingDeleteSupplyGroup, setConfirmingDeleteSupplyGroup] = useState<SupplyGroup | null>(null);
  const [editingForecast, setEditingForecast] = useState<MaterialForecast | null>(null);
  const [editingSupplyGroup, setEditingSupplyGroup] = useState<SupplyGroup | null>(null);
  const [selectedForecastIds, setSelectedForecastIds] = useState<string[]>([]);
  const [isDeletingForecast, setIsDeletingForecast] = useState<MaterialForecast | null>(null);
  const [isAddingTask, setIsAddingTask] = useState<TaskStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newOrderPopoverRef = useRef<HTMLDivElement>(null);
  
  const [milestoneView, setMilestoneView] = useState<'list' | 'calendar'>('list');
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);

  const [forecastSearch, setForecastSearch] = useState('');
  const [forecastStatusFilter, setForecastStatusFilter] = useState<'pending' | 'ordered' | 'delivered'>(() => {
    const saved = uiPreferences.getString(suppliesStatusKey);
    return saved === 'pending' || saved === 'ordered' || saved === 'delivered' ? saved : 'pending';
  });
  
  const planning = project.planning;

  const getInitials = (name?: string | null) => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '';
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  };

  useEffect(() => {
    if (fixedSubTab) {
      setActiveSubTab(fixedSubTab);
      return;
    }

    if (isSuppliesView) {
      setActiveSubTab('forecast');
      const saved = uiPreferences.getString(suppliesStatusKey);
      if (saved === 'pending' || saved === 'ordered' || saved === 'delivered') {
        setForecastStatusFilter(saved);
      } else {
        setForecastStatusFilter('pending');
      }
      return;
    }

    const saved = uiPreferences.getString(planningTabKey);
    if (saved && planningSubTabs.includes(saved as 'tasks' | 'forecast' | 'milestones')) {
      setActiveSubTab(saved as 'tasks' | 'forecast' | 'milestones');
    } else {
      setActiveSubTab('tasks');
    }
  }, [fixedSubTab, isSuppliesView, planningTabKey, suppliesStatusKey]);

  useEffect(() => {
    if (!fixedSubTab) return;
    if (activeSubTab !== fixedSubTab) {
      setActiveSubTab(fixedSubTab);
    }
  }, [activeSubTab, fixedSubTab]);

  useEffect(() => {
    if (isSuppliesView || fixedSubTab) return;
    uiPreferences.setString(planningTabKey, activeSubTab);
  }, [activeSubTab, fixedSubTab, isSuppliesView, planningTabKey]);

  useEffect(() => {
    if (!isSuppliesView) return;
    uiPreferences.setString(suppliesStatusKey, forecastStatusFilter);
  }, [forecastStatusFilter, isSuppliesView, suppliesStatusKey]);

  useEffect(() => {
    if (!isSuppliesView) return;
    uiPreferences.setString(supplyGroupsExpandedKey, JSON.stringify(expandedSupplyGroups));
  }, [expandedSupplyGroups, isSuppliesView, supplyGroupsExpandedKey]);

  useEffect(() => {
    if (forecastStatusFilter === 'pending') return;
    setIsBatchSelectionMode(false);
    setSelectedForecastIds([]);
    setIsConvertingForecastsToGroup(false);
    setIsNewOrderPopoverOpen(false);
  }, [forecastStatusFilter]);

  useEffect(() => {
    if (!isNewOrderPopoverOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!newOrderPopoverRef.current) return;
      if (newOrderPopoverRef.current.contains(event.target as Node)) return;
      setIsNewOrderPopoverOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isNewOrderPopoverOpen]);

  const financialCategories = useMemo(() => {
    return project.expenses.filter(e => e.itemType === 'category' && e.type === 'material');
  }, [project.expenses]);

  const sortedForecasts = useMemo(() => {
    return [...planning.forecasts].sort((a, b) => a.order - b.order)
      .filter(f => {
        const matchesSearch = f.description.toLowerCase().includes(forecastSearch.toLowerCase());
        const matchesStatus = f.status === forecastStatusFilter;
        return matchesSearch && matchesStatus;
      });
  }, [planning.forecasts, forecastSearch, forecastStatusFilter]);

  useEffect(() => {
    const hasMissingGroupRelation = sortedForecasts.some(
      (forecast) => forecast.supplyGroupId && !forecast.supplyGroup,
    );
    if (!hasMissingGroupRelation) return;

    let active = true;
    void (async () => {
      try {
        const groups = await planningApi.listSupplyGroups(project.id);
        if (!active) return;
        setSupplyGroupsCache((prev) => {
          const next = { ...prev };
          groups.forEach((group) => {
            next[group.id] = group;
          });
          return next;
        });
      } catch {
        // non-blocking: fallback grouping still works with synthetic group data
      }
    })();

    return () => {
      active = false;
    };
  }, [project.id, sortedForecasts]);

  const groupedForecastRows = useMemo(() => {
    const rows: Array<
      | { type: 'single'; forecast: MaterialForecast }
      | { type: 'group'; groupId: string; group: SupplyGroup; forecasts: MaterialForecast[] }
    > = [];

    const bucket = new Map<string, { group: SupplyGroup; forecasts: MaterialForecast[] }>();

    for (const forecast of sortedForecasts) {
      if (!forecast.supplyGroupId) {
        rows.push({ type: 'single', forecast });
        continue;
      }

      const existing = bucket.get(forecast.supplyGroupId);
      if (existing) {
        existing.forecasts.push(forecast);
        continue;
      }

      const resolvedGroup =
        forecast.supplyGroup ||
        supplyGroupsCache[forecast.supplyGroupId] ||
        ({
          id: forecast.supplyGroupId,
          title: null,
          estimatedDate: forecast.estimatedDate,
          purchaseDate: forecast.purchaseDate || null,
          deliveryDate: forecast.deliveryDate || null,
          status: forecast.status,
          isPaid: forecast.isPaid,
          isCleared: forecast.isCleared,
          supplierId: forecast.supplierId,
          paymentProof: null,
          invoiceDoc: null,
          forecasts: [],
        } as SupplyGroup);

      bucket.set(forecast.supplyGroupId, {
        group: resolvedGroup,
        forecasts: [forecast],
      });
      rows.push({
        type: 'group',
        groupId: forecast.supplyGroupId,
        group: resolvedGroup,
        forecasts: bucket.get(forecast.supplyGroupId)!.forecasts,
      });
    }

    return rows;
  }, [sortedForecasts, supplyGroupsCache]);

  const selectableForecastIds = useMemo(
    () =>
      sortedForecasts
        .filter((forecast) => forecast.status === 'pending' && !forecast.supplyGroupId)
        .map((forecast) => forecast.id),
    [sortedForecasts],
  );

  const allSelectableChecked =
    selectableForecastIds.length > 0 &&
    selectableForecastIds.every((id) => selectedForecastIds.includes(id));

  useEffect(() => {
    setSelectedForecastIds((prev) => prev.filter((id) => selectableForecastIds.includes(id)));
  }, [selectableForecastIds]);

  const financialGroupNameById = useMemo(() => {
    const map = new Map<string, string>();
    financialCategories.forEach((category) => {
      map.set(category.id, category.description);
    });
    return map;
  }, [financialCategories]);

  const getForecastNetTotal = (forecast: MaterialForecast) => {
    return calculateForecastNetTotal(
      forecast.quantityNeeded || 0,
      forecast.unitPrice || 0,
      financial.normalizeMoney(forecast.discountValue || 0),
    );
  };

  const buildForecastWithRecalculatedDiscount = (
    forecast: MaterialForecast,
    updates: Partial<MaterialForecast>,
  ): MaterialForecast => {
    const nextQuantity = updates.quantityNeeded ?? forecast.quantityNeeded ?? 0;
    const nextUnitPrice = updates.unitPrice ?? forecast.unitPrice ?? 0;
    const hasDiscountPercentage =
      forecast.discountPercentage !== undefined && forecast.discountPercentage !== null;

    if (!hasDiscountPercentage) {
      return {
        ...forecast,
        ...updates,
      };
    }

    const discountPercentage = financial.normalizePercent(forecast.discountPercentage || 0);
    const gross = (nextQuantity || 0) * (nextUnitPrice || 0);
    const discountValue = financial.normalizeMoney(gross * (discountPercentage / 100));

    return {
      ...forecast,
      ...updates,
      discountPercentage,
      discountValue,
    };
  };

  const applyInlineForecastUpdate = (
    forecast: MaterialForecast,
    updates: Partial<MaterialForecast>,
    syncFinancial = false,
  ) => {
    const nextForecast = buildForecastWithRecalculatedDiscount(forecast, updates);
    onUpdatePlanning(planningService.updateForecast(planning, forecast.id, nextForecast));
    if (syncFinancial) {
      syncExpenseWithForecast(nextForecast);
    }
  };

  const forecastStats = useMemo(() => {
    const list = planning.forecasts || [];
    const totalList = isSuppliesView
      ? list.filter(f => f.status === 'pending')
      : list.filter(f => !f.isCleared);
    const total = totalList
      .reduce((acc, f) => acc + getForecastNetTotal(f), 0);
    
    const countPending = list.filter(f => f.status === 'pending').length;
    const countOrdered = list.filter(f => f.status === 'ordered').length;
    const countDelivered = list.filter(f => f.status === 'delivered').length;
    const countEffective = list.filter(f => f.status !== 'pending').length;

    const pending = list
      .filter(f => f.status === 'ordered' && !f.isPaid)
      .reduce((acc, f) => acc + getForecastNetTotal(f), 0);
    const ordered = list.filter(f => f.status === 'ordered').reduce((acc, f) => acc + getForecastNetTotal(f), 0);
    const delivered = list.filter(f => f.status === 'delivered').reduce((acc, f) => acc + getForecastNetTotal(f), 0);
    const effective = list.filter(f => f.status !== 'pending').reduce((acc, f) => acc + getForecastNetTotal(f), 0);
    
    return { total, pending, ordered, delivered, effective, countPending, countOrdered, countDelivered, countEffective };
  }, [planning.forecasts, isSuppliesView]);

  const handleAutoGenerate = () => {
    const updated = planningService.generateTasksFromWbs(planning, allWorkItems);
    onUpdatePlanning(updated);
  };

  const reorderForecastsInStatus = (
    current: ProjectPlanning,
    status: MaterialForecast['status'],
    orderedIds: string[],
  ) => {
    const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]));
    return {
      ...current,
      forecasts: current.forecasts.map((forecast) => {
        if (forecast.status !== status) return forecast;
        const nextOrder = orderMap.get(forecast.id);
        if (nextOrder === undefined) return forecast;
        return forecast.order === nextOrder ? forecast : { ...forecast, order: nextOrder };
      }),
    };
  };

  const moveForecastToStatusTop = (
    current: ProjectPlanning,
    forecastId: string,
    status: MaterialForecast['status'],
    updates: Partial<MaterialForecast> = {},
  ) => {
    const target = current.forecasts.find((forecast) => forecast.id === forecastId);
    if (!target) return current;

    const updatedForecasts = current.forecasts.map((forecast) =>
      forecast.id === forecastId
        ? { ...forecast, ...updates, status }
        : forecast,
    );

    const statusList = updatedForecasts
      .filter((forecast) => forecast.status === status && forecast.id !== forecastId)
      .sort((a, b) => a.order - b.order);

    const orderedIds = [forecastId, ...statusList.map((forecast) => forecast.id)];
    return reorderForecastsInStatus({ ...current, forecasts: updatedForecasts }, status, orderedIds);
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination, source } = result;
    if (activeSubTab === 'tasks') {
      const newStatus = destination.droppableId as TaskStatus;
      const updated = planningService.updateTask(planning, draggableId, { status: newStatus });
      onUpdatePlanning(updated);
    } else if (activeSubTab === 'forecast') {
      if (forecastSearch.trim()) {
        toast.warning('Limpe a busca para reordenar os suprimentos.');
        return;
      }
      if (destination.index === source.index) return;

      const statusList = planning.forecasts
        .filter((forecast) => forecast.status === forecastStatusFilter)
        .sort((a, b) => a.order - b.order);
      const reordered = [...statusList];
      const [moved] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, moved);

      onUpdatePlanning(reorderForecastsInStatus(planning, forecastStatusFilter, reordered.map((f) => f.id)));
    }
  };

  const moveForecastInStatus = (id: string, direction: 'up' | 'down') => {
    if (forecastSearch.trim()) {
      toast.warning('Limpe a busca para reordenar os suprimentos.');
      return;
    }

    const statusList = planning.forecasts
      .filter((forecast) => forecast.status === forecastStatusFilter)
      .sort((a, b) => a.order - b.order);

    const currentIndex = statusList.findIndex((forecast) => forecast.id === id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= statusList.length) return;

    const reordered = [...statusList];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    onUpdatePlanning(reorderForecastsInStatus(planning, forecastStatusFilter, reordered.map((f) => f.id)));
  };

  const handleAddTask = (data: Partial<PlanningTask>) => {
    if (!ensureCanEditPlanning()) return;
    const createdBy = user?.id && user?.name
      ? { id: user.id, name: user.name, profileImage: user.profileImage ?? null }
      : undefined;
    const updated = planningService.addTask(planning, { ...data, createdBy });
    onUpdatePlanning(updated);
    setIsAddingTask(null);
  };

  const handleUpdateTask = (id: string, data: Partial<PlanningTask>) => {
    if (!ensureCanEditPlanning()) return;
    const updated = planningService.updateTask(planning, id, data);
    onUpdatePlanning(updated);
  };

  const findExpenseForForecast = (forecast: MaterialForecast) => {
    // Priority 1: exact ID match (reliable, avoids false positives with duplicate descriptions)
    const byId = project.expenses.find(expense => expense.id === forecast.id);
    if (byId) return byId;

    // Fallback: description-based match (legacy data where expense.id !== forecast.id).
    // Exclude expenses whose ID matches another forecast — those are already
    // "owned" by that forecast and must not be cross-matched when items share
    // the same name (same lote, different lotes, or no lote at all).
    const suffix = `: ${forecast.description}`;
    const knownForecastIds = new Set(planning.forecasts.map(f => f.id));
    return project.expenses.find(expense =>
      expense.type === 'material' &&
      expense.itemType === 'item' &&
      expense.description.endsWith(suffix) &&
      !knownForecastIds.has(expense.id),
    );
  };

  const handleFinalizePurchase = (
    forecast: MaterialForecast,
    parentId: string | null,
    isPaid: boolean,
    proof?: string,
    purchaseDate?: string,
    discountValue?: number,
    discountPercentage?: number,
  ) => {
    const existingExpense = findExpenseForForecast(forecast);
    const expenseData = planningService.prepareExpenseFromForecast(
      forecast,
      parentId,
      purchaseDate,
      isPaid,
      forecast.id,
      'ordered',
      {
        discountValue,
        discountPercentage,
      },
    );
    const supplierName = suppliers.find(s => s.id === forecast.supplierId)?.name;
    if (supplierName) {
      expenseData.entityName = supplierName;
    }
    if (isPaid && proof) {
      expenseData.paymentProof = proof;
    }
    
    if (existingExpense) {
      onUpdateExpense(existingExpense.id, {
        parentId: parentId ?? existingExpense.parentId,
        date: expenseData.date,
        description: expenseData.description,
        entityName: expenseData.entityName,
        unit: expenseData.unit,
        quantity: expenseData.quantity,
        unitPrice: expenseData.unitPrice,
        discountValue: expenseData.discountValue,
        discountPercentage: expenseData.discountPercentage,
        amount: expenseData.amount,
        isPaid: expenseData.isPaid,
        status: expenseData.status,
        paymentDate: expenseData.paymentDate ?? existingExpense.paymentDate,
        paymentProof: expenseData.paymentProof ?? existingExpense.paymentProof,
      });
    } else {
      onAddExpense(expenseData as ProjectExpense);
    }
    
    const updatedPlanning = moveForecastToStatusTop(planning, forecast.id, 'ordered', {
      isPaid: isPaid,
      paymentProof: proof,
      purchaseDate: purchaseDate || new Date().toISOString().split('T')[0],
      discountValue: expenseData.discountValue ?? forecast.discountValue ?? 0,
      discountPercentage: expenseData.discountPercentage ?? forecast.discountPercentage ?? 0,
    });
    onUpdatePlanning(updatedPlanning);
    setConfirmingForecast(null);
    setForecastStatusFilter('ordered');
  };

  const syncExpenseWithForecast = (forecast: MaterialForecast) => {
    const linkedExpense = findExpenseForForecast(forecast);
    if (!linkedExpense) return;

    const supplierName = suppliers.find((supplier) => supplier.id === forecast.supplierId)?.name;
    const expenseData = planningService.prepareExpenseFromForecast(
      forecast,
      linkedExpense.parentId ?? (forecast.categoryId || null),
      forecast.purchaseDate || linkedExpense.date,
      forecast.isPaid,
      linkedExpense.id,
      forecast.status,
      {
        discountValue: forecast.discountValue,
        discountPercentage: forecast.discountPercentage,
      },
    );

    const nextStatus = forecast.status === 'delivered'
      ? 'DELIVERED'
      : (linkedExpense.status === 'DELIVERED' ? 'DELIVERED' : expenseData.status);

    onUpdateExpense(linkedExpense.id, {
      parentId: expenseData.parentId ?? linkedExpense.parentId,
      date: expenseData.date,
      description: expenseData.description,
      entityName: supplierName || expenseData.entityName || linkedExpense.entityName,
      unit: expenseData.unit,
      quantity: expenseData.quantity,
      unitPrice: expenseData.unitPrice,
      discountValue: expenseData.discountValue,
      discountPercentage: expenseData.discountPercentage,
      amount: expenseData.amount,
      isPaid: expenseData.isPaid,
      status: nextStatus,
      paymentDate: expenseData.paymentDate ?? linkedExpense.paymentDate,
      paymentProof: expenseData.paymentProof ?? linkedExpense.paymentProof,
      deliveryDate:
        forecast.status === 'delivered'
          ? (forecast.deliveryDate || linkedExpense.deliveryDate || new Date().toISOString().split('T')[0])
          : linkedExpense.deliveryDate,
    });
  };

  const syncExpensesWithForecasts = (forecastsToSync: MaterialForecast[]) => {
    forecastsToSync.forEach((forecast) => {
      syncExpenseWithForecast(forecast);
    });
  };

  const syncItemFinancialGroup = (
    forecastId: string,
    categoryId: string | null,
    _description: string,
  ) => {
    const forecast = planning.forecasts.find((item) => item.id === forecastId);
    // Use findExpenseForForecast when the forecast object is available (safe two-pass lookup).
    // Otherwise fall back to ID-only match — bare description matching is unreliable
    // when multiple items share the same name.
    const linkedExpense = forecast
      ? findExpenseForForecast(forecast)
      : project.expenses.find((expense) => expense.id === forecastId);

    if (!linkedExpense) return;

    const nextParentId = categoryId || null;
    const currentParentId = linkedExpense.parentId || null;
    if (currentParentId === nextParentId) return;

    onUpdateExpense(linkedExpense.id, { parentId: nextParentId });
  };

  const refreshForecastsFromApi = async () => {
    try {
      const latestForecasts = await planningApi.listForecasts(project.id);
      syncExpensesWithForecasts(latestForecasts);
      onUpdatePlanning({
        ...planning,
        forecasts: latestForecasts,
      });
    } catch (error) {
      console.error('Erro ao recarregar suprimentos:', error);
      toast.error('Erro ao atualizar lista de suprimentos.');
    }
  };

  const buildFallbackSupplyGroup = (supplyGroupId: string): SupplyGroup | null => {
    const groupedForecasts = planning.forecasts.filter(
      (forecast) => forecast.supplyGroupId === supplyGroupId,
    );

    if (groupedForecasts.length === 0) return null;

    const primary = groupedForecasts[0];
    const cached = supplyGroupsCache[supplyGroupId];

    return {
      id: supplyGroupId,
      title: cached?.title ?? primary.supplyGroup?.title ?? null,
      estimatedDate: cached?.estimatedDate ?? primary.estimatedDate,
      purchaseDate: cached?.purchaseDate ?? primary.purchaseDate ?? null,
      deliveryDate: cached?.deliveryDate ?? primary.deliveryDate ?? null,
      status: cached?.status ?? primary.status,
      isPaid: cached?.isPaid ?? primary.isPaid,
      isCleared: cached?.isCleared ?? primary.isCleared,
      supplierId: cached?.supplierId ?? primary.supplierId,
      paymentProof: cached?.paymentProof ?? primary.paymentProof ?? null,
      invoiceDoc: cached?.invoiceDoc ?? null,
      forecasts: groupedForecasts,
    };
  };

  const openSupplyGroupEditorById = async (supplyGroupId: string) => {
    if (!ensureCanEditPlanning()) return;

    const fallback = buildFallbackSupplyGroup(supplyGroupId);
    if (fallback) {
      setEditingSupplyGroup(fallback);
    }

    try {
      const groups = await planningApi.listSupplyGroups(project.id);
      setSupplyGroupsCache((prev) => {
        const next = { ...prev };
        groups.forEach((group) => {
          next[group.id] = group;
        });
        return next;
      });

      const target = groups.find((group) => group.id === supplyGroupId);
      if (!target) {
        if (!fallback) {
          toast.warning('Grupo de suprimentos não encontrado.');
        }
        return;
      }
      setEditingSupplyGroup(target);
    } catch (error) {
      console.error('Erro ao carregar grupo de suprimentos:', error);
      if (!fallback) {
        toast.error('Erro ao abrir grupo de suprimentos.');
      }
    }
  };

  const openSupplyGroupEditorFromForecast = async (forecast: MaterialForecast) => {
    if (!forecast.supplyGroupId) return;
    await openSupplyGroupEditorById(forecast.supplyGroupId);
  };

  const handleCreateSupplyGroup = async (payload: {
    title?: string | null;
    supplierId?: string | null;
    estimatedDate: string;
    items: Array<{
      description: string;
      calculationMemory?: string | null;
      unit: string;
      quantityNeeded: number;
      unitPrice: number;
      discountValue?: number;
      discountPercentage?: number;
      categoryId?: string | null;
    }>;
  }) => {
    if (!ensureCanEditPlanning()) return;

    try {
      await planningApi.createSupplyGroup(project.id, {
        ...payload,
        purchaseDate: null,
        deliveryDate: null,
        status: 'pending',
        isPaid: false,
        isCleared: false,
        paymentProof: null,
        invoiceDoc: null,
      });

      await refreshForecastsFromApi();
      setSelectedForecastIds([]);
      setIsAddingSupplyGroup(false);
      toast.success('Grupo de suprimentos criado com sucesso.');
    } catch (error) {
      console.error('Erro ao criar grupo de suprimentos:', error);
      toast.error('Erro ao criar grupo de suprimentos.');
    }
  };

  const handleUpdateSupplyGroup = async (
    groupId: string,
    payload: Partial<Omit<SupplyGroup, 'id' | 'forecasts'>>,
  ) => {
    if (!ensureCanEditPlanning()) return;

    try {
      const updatedGroup = await planningApi.updateSupplyGroup(groupId, payload);
      if (updatedGroup?.id) {
        setSupplyGroupsCache((prev) => ({
          ...prev,
          [updatedGroup.id]: updatedGroup,
        }));
      }
      const shouldSyncFinancial =
        payload.status !== undefined ||
        payload.isPaid !== undefined ||
        payload.isCleared !== undefined ||
        payload.paymentProof !== undefined ||
        payload.invoiceDoc !== undefined ||
        payload.purchaseDate !== undefined ||
        payload.deliveryDate !== undefined ||
        payload.supplierId !== undefined;

      if (shouldSyncFinancial) {
        const groupedForecasts = planning.forecasts.filter((forecast) => forecast.supplyGroupId === groupId);
        const supplierName = suppliers.find((supplier) => supplier.id === (payload.supplierId || ''))?.name;

        groupedForecasts.forEach((forecast) => {
          const linkedExpense = findExpenseForForecast(forecast);
          const targetStatus = payload.status || forecast.status;
          const targetIsPaid = payload.isPaid ?? forecast.isPaid;
          const targetPurchaseDate = payload.purchaseDate || forecast.purchaseDate;
          const targetDeliveryDate = payload.deliveryDate || forecast.deliveryDate;

          if (targetStatus !== 'pending') {
            const expenseData = planningService.prepareExpenseFromForecast(
              forecast,
              linkedExpense?.parentId ?? (forecast.categoryId || null),
              targetPurchaseDate || undefined,
              targetIsPaid,
              linkedExpense?.id || forecast.id,
              targetStatus,
              {
                discountValue: forecast.discountValue,
                discountPercentage: forecast.discountPercentage,
              },
            );

            if (supplierName) {
              expenseData.entityName = supplierName;
            }

            if (targetIsPaid && payload.paymentProof) {
              expenseData.paymentProof = payload.paymentProof;
            }

            if (targetStatus === 'delivered') {
              expenseData.status = 'DELIVERED';
              expenseData.deliveryDate = targetDeliveryDate || new Date().toISOString().split('T')[0];
            }

            if (linkedExpense) {
              onUpdateExpense(linkedExpense.id, {
                parentId: expenseData.parentId ?? linkedExpense.parentId,
                date: expenseData.date,
                description: expenseData.description,
                entityName: expenseData.entityName,
                unit: expenseData.unit,
                quantity: expenseData.quantity,
                unitPrice: expenseData.unitPrice,
                discountValue: expenseData.discountValue,
                discountPercentage: expenseData.discountPercentage,
                amount: expenseData.amount,
                isPaid: expenseData.isPaid,
                status: expenseData.status,
                paymentDate: expenseData.paymentDate ?? linkedExpense.paymentDate,
                paymentProof: expenseData.paymentProof ?? linkedExpense.paymentProof,
                deliveryDate: expenseData.deliveryDate ?? linkedExpense.deliveryDate,
                invoiceDoc: payload.isCleared ? (payload.invoiceDoc ?? linkedExpense.invoiceDoc) : linkedExpense.invoiceDoc,
              });
            } else {
              onAddExpense(expenseData as ProjectExpense);
            }
          } else if (linkedExpense && payload.isCleared && payload.invoiceDoc) {
            onUpdateExpense(linkedExpense.id, { invoiceDoc: payload.invoiceDoc });
          }
        });
      }

      await refreshForecastsFromApi();
      setEditingSupplyGroup(null);
      toast.success('Grupo atualizado com sucesso.');
    } catch (error) {
      console.error('Erro ao atualizar grupo de suprimentos:', error);
      toast.error('Erro ao atualizar grupo de suprimentos.');
    }
  };

  const toggleSupplyGroupExpansion = (groupId: string) => {
    setExpandedSupplyGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleFinalizeGroupPurchase = async (
    group: SupplyGroup,
    payload: { purchaseDate: string; isPaid: boolean; paymentProof?: string | null },
  ) => {
    await handleUpdateSupplyGroup(group.id, {
      status: 'ordered',
      purchaseDate: payload.purchaseDate,
      isPaid: payload.isPaid,
      paymentProof: payload.paymentProof ?? null,
    });
    setConfirmingGroupPurchase(null);
    setForecastStatusFilter('ordered');
  };

  const handleFinalizeGroupDelivery = async (group: SupplyGroup) => {
    await handleUpdateSupplyGroup(group.id, {
      status: 'delivered',
      deliveryDate: new Date().toISOString().split('T')[0],
    });
    setConfirmingGroupDelivery(null);
    setForecastStatusFilter('delivered');
  };

  const handleFinalizeGroupClearance = async (group: SupplyGroup, invoiceDoc?: string) => {
    await handleUpdateSupplyGroup(group.id, {
      isCleared: true,
      invoiceDoc: invoiceDoc || null,
    });
    setConfirmingGroupClearance(null);
  };

  const handleDeleteSupplyGroup = async (groupId: string) => {
    if (!ensureCanEditPlanning()) return;

    try {
      await planningApi.deleteSupplyGroup(groupId);
      await refreshForecastsFromApi();
      setEditingSupplyGroup(null);
      setConfirmingDeleteSupplyGroup(null);
      toast.success('Grupo removido com sucesso.');
    } catch (error) {
      console.error('Erro ao remover grupo de suprimentos:', error);
      toast.error('Erro ao remover grupo de suprimentos.');
    }
  };

  const toggleForecastSelection = (forecastId: string) => {
    setSelectedForecastIds((prev) =>
      prev.includes(forecastId)
        ? prev.filter((id) => id !== forecastId)
        : [...prev, forecastId],
    );
  };

  const toggleAllSelectableForecasts = () => {
    if (allSelectableChecked) {
      setSelectedForecastIds([]);
      return;
    }
    setSelectedForecastIds(selectableForecastIds);
  };

  const handleConvertSelectedForecasts = async (payload: {
    title?: string | null;
    supplierId?: string | null;
    estimatedDate: string;
  }) => {
    if (!ensureCanEditPlanning()) return;

    if (selectedForecastIds.length === 0) {
      toast.warning('Selecione ao menos um item para converter.');
      return;
    }

    try {
      const normalizedPayload = {
        ...payload,
        purchaseDate: null,
        deliveryDate: null,
        status: 'pending' as const,
        isPaid: false,
        isCleared: false,
        paymentProof: null,
        invoiceDoc: null,
      };

      await planningApi.convertForecastsToGroup(project.id, {
        forecastIds: selectedForecastIds,
        ...normalizedPayload,
      });

      await refreshForecastsFromApi();
      setSelectedForecastIds([]);
      setIsConvertingForecastsToGroup(false);
      toast.success('Itens convertidos para grupo com sucesso.');
    } catch (error) {
      console.error('Erro ao converter itens para grupo:', error);
      toast.error('Erro ao converter itens para grupo.');
    }
  };

  const handleFinalizeDelivery = (forecast: MaterialForecast) => {
    const deliveryDate = new Date().toISOString().split('T')[0];
    const linkedExpense = findExpenseForForecast(forecast);
    if (linkedExpense) {
      const expenseData = planningService.prepareExpenseFromForecast(
        forecast,
        linkedExpense.parentId ?? null,
        deliveryDate,
        linkedExpense.isPaid,
        linkedExpense.id,
        'delivered'
      );
      onUpdateExpense(linkedExpense.id, {
        status: 'DELIVERED',
        deliveryDate,
        description: expenseData.description,
      });
    }
    onUpdatePlanning(moveForecastToStatusTop(planning, forecast.id, 'delivered', {
      deliveryDate,
    }));
    setConfirmingDeliveryForecast(null);
  };

  const handleFinalizeClearance = (forecast: MaterialForecast, invoiceDoc?: string) => {
    const linkedExpense = findExpenseForForecast(forecast);
    if (!linkedExpense) {
      toast.warning('Nao foi encontrado o item financeiro vinculado.');
      return;
    }
    if (!invoiceDoc) {
      toast.warning('Anexe a nota fiscal para dar baixa.');
      return;
    }
    onUpdateExpense(linkedExpense.id, { invoiceDoc });
    onUpdatePlanning(planningService.updateForecast(planning, forecast.id, { isCleared: true }));
    setConfirmingClearanceForecast(null);
  };

  const handleViewProof = (proof: string) => {
    const win = window.open();
    win?.document.write(`<iframe src="${proof}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
  };

  const [isImportingPlan, setIsImportingPlan] = useState(false);

  const handleImportPlanning = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!ensureCanEditPlanning()) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingPlan(true);
    try {
      const newPlanning = await excelService.parsePlanningExcel(file);
      // send as replace to backend (single request)
      await planningApi.replace(project.id, {
        tasks: newPlanning.tasks,
        forecasts: newPlanning.forecasts,
        milestones: newPlanning.milestones,
      });

      onUpdatePlanning(newPlanning);
    } catch (err) {
      console.error('Erro ao importar planejamento:', err);
      toast.error("Erro ao importar planejamento.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsImportingPlan(false);
    }
  };

  const columns: { id: TaskStatus, label: string, color: string }[] = [
    { id: 'todo', label: 'Planejado', color: 'amber' },
    { id: 'doing', label: 'Executando', color: 'indigo' },
    { id: 'done', label: 'Concluído', color: 'emerald' }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        hidden
        accept=".xlsx, .xls" 
        onChange={handleImportPlanning}
      />
      
      {!isSuppliesView && (
        <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4">
          {showSubTabs ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                  title="Importar Excel"
                >
                  <UploadCloud size={16}/>
                </button>
                <button
                  onClick={() => excelService.exportPlanningToExcel(project)}
                  className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                  title="Exportar Excel"
                >
                  <Download size={16}/>
                </button>
              </div>
            </div>
          ) : (
            <div />
          )}

          {showSubTabs ? (
            <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto no-scrollbar">
              <SubTabBtn active={activeSubTab === 'tasks'} onClick={() => setActiveSubTab('tasks')} label="Quadro Kanban" icon={<ListChecks size={14}/>} />
              <SubTabBtn active={activeSubTab === 'milestones'} onClick={() => setActiveSubTab('milestones')} label="Cronograma" icon={<Target size={14}/>} />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                  title="Importar Excel"
                >
                  <UploadCloud size={16}/>
                </button>
                <button
                  onClick={() => excelService.exportPlanningToExcel(project)}
                  className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                  title="Exportar Excel"
                >
                  <Download size={16}/>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        {activeSubTab === 'tasks' && (
           <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {columns.map(col => (
                <div key={col.id} className="bg-slate-100/50 dark:bg-slate-900/40 rounded-[2.5rem] flex flex-col min-h-[600px] border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-colors">
                  <div className="p-6 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-6 rounded-full bg-${col.color}-500`} />
                      <span className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">{col.label}</span>
                      <span className="bg-white dark:bg-slate-800 text-[10px] font-black px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">{planning.tasks.filter(t => (t.status || (t.isCompleted ? 'done' : 'todo')) === col.id).length}</span>
                    </div>
                    <button onClick={() => { if (!ensureCanEditPlanning()) return; setIsAddingTask(col.id); }} className="p-2 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-600 shadow-sm transition-all"><Plus size={16}/></button>
                  </div>

                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div 
                        {...provided.droppableProps} 
                        ref={provided.innerRef}
                        className={`flex-1 p-4 space-y-3 transition-colors rounded-[2rem] ${snapshot.isDraggingOver ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                      >
                        {planning.tasks
                          .filter(t => (t.status || (t.isCompleted ? 'done' : 'todo')) === col.id)
                          .map((task, index) => (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(p, s) => (
                                <div 
                                  ref={p.innerRef} 
                                  {...p.draggableProps}
                                  onClick={() => { if (!ensureCanEditPlanning()) return; setEditingTask(task); }}
                                  className={`group bg-white dark:bg-slate-900 p-5 rounded-3xl border transition-all cursor-pointer select-none hover:shadow-xl hover:-translate-y-1 ${s.isDragging ? 'shadow-2xl ring-2 ring-indigo-500 z-50' : 'border-slate-100 dark:border-slate-800 shadow-sm'}`}
                                >
                                  <div className="flex items-start justify-between gap-3 mb-3">
                                    <div {...p.dragHandleProps} className="p-1 text-slate-300 hover:text-indigo-500"><GripVertical size={14}/></div>
                                    <button onClick={(e) => { e.stopPropagation(); if (!ensureCanEditPlanning()) return; onUpdatePlanning(planningService.deleteTask(planning, task.id)); }} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-all"><Trash2 size={14}/></button>
                                  </div>
                                  <h4 className={`text-sm font-bold leading-relaxed whitespace-normal break-words ${task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-white'}`}>
                                    {task.description}
                                  </h4>
                                  <div className="mt-4 flex flex-wrap items-center gap-2">
                                     <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                       planningService.getUrgencyLevel(task.dueDate) === 'urgent' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'
                                     }`}>
                                       <Calendar size={10}/> {financial.formatDate(task.dueDate)}
                                     </div>
                                     {task.categoryId && (
                                       <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 px-2 py-1 rounded-lg text-[8px] font-black uppercase">EAP</span>
                                     )}
                                  </div>
                                  {task.createdBy && (
                                    <div className="mt-3 flex items-center gap-2">
                                      {task.createdBy.profileImage ? (
                                        <img src={task.createdBy.profileImage} alt="" className="w-5 h-5 rounded-full object-cover" />
                                      ) : (
                                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center">
                                          <span className="text-[8px] font-black text-white">{task.createdBy.name.charAt(0).toUpperCase()}</span>
                                        </div>
                                      )}
                                      <span className="text-[9px] text-slate-400 font-medium truncate">cadastrado por {task.createdBy.name.split(' ')[0]}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSubTab === 'forecast' && (
          <div className="space-y-4 animate-in fade-in">
             <div className="no-print flex justify-end">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onRequestPrintReport?.()}
                    className="flex items-center gap-2 px-5 py-3 text-slate-700 dark:text-slate-300 text-[9px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 rounded-xl hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all"
                  >
                    <Printer size={16} /> PDF
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 text-slate-400 hover:text-emerald-600"
                    title="Importar Excel"
                  >
                    <UploadCloud size={18} />
                  </button>
                  <button
                    onClick={() => excelService.exportPlanningToExcel(project)}
                    className="p-2.5 text-slate-400 hover:text-blue-600"
                    title="Exportar Excel"
                  >
                    <Download size={18} />
                  </button>
                </div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <ForecastKpi label="Previsão de Suprimentos" value={forecastStats.total} icon={<Boxes size={20}/>} color="indigo" sub="Previsão global de gastos" />
                <ForecastKpi label="Pendente de Pagamento" value={forecastStats.pending} icon={<Clock size={20}/>} color="amber" sub="Ainda não efetivado" />
               <ForecastKpi label="Efetivado/Local" value={forecastStats.effective} icon={<CheckCircle2 size={20}/>} color="emerald" sub="Lançado no financeiro" />
             </div>

             <div className="bg-white dark:bg-slate-900 p-8 rounded-[3.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
                    <div className="flex flex-wrap items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-1">
                      <ProcurementStep 
                        active={forecastStatusFilter === 'pending'} 
                        onClick={() => setForecastStatusFilter('pending')}
                        label="A Comprar"
                        count={forecastStats.countPending}
                        icon={<ShoppingCart size={14}/>}
                        color="amber"
                      />
                      <ArrowRight size={14} className="text-slate-300 mx-1 hidden sm:block"/>
                      <ProcurementStep 
                        active={forecastStatusFilter === 'ordered'} 
                        onClick={() => setForecastStatusFilter('ordered')}
                        label="Pedidos de Compra"
                        count={forecastStats.countOrdered}
                        icon={<Clock size={14}/>}
                        color="blue"
                      />
                      <ArrowRight size={14} className="text-slate-300 mx-1 hidden sm:block"/>
                      <ProcurementStep 
                        active={forecastStatusFilter === 'delivered'} 
                        onClick={() => setForecastStatusFilter('delivered')}
                        label="Recebidos (Local)"
                        count={forecastStats.countDelivered}
                        icon={<Truck size={14}/>}
                        color="emerald"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-end ml-auto gap-2">
                      {forecastStatusFilter === 'pending' && (
                        <div className="relative" ref={newOrderPopoverRef}>
                          <button
                            onClick={() => {
                              if (!ensureCanEditPlanning()) return;
                              setIsNewOrderPopoverOpen((prev) => !prev);
                            }}
                            className="inline-flex items-center gap-2 whitespace-nowrap px-5 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-lg hover:scale-105 transition-transform"
                          >
                            <Plus size={16} /> Novo Pedido <ChevronDown size={14} />
                          </button>
                          {isNewOrderPopoverOpen && (
                            <div className="absolute right-0 mt-2 z-30 w-56 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2">
                              <button
                                onClick={() => {
                                  if (!ensureCanEditPlanning()) return;
                                  setIsAddingSupplyGroup(true);
                                  setIsNewOrderPopoverOpen(false);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Layers size={14} /> Pedido em Lote
                              </button>
                              <button
                                onClick={() => {
                                  if (!ensureCanEditPlanning()) return;
                                  setIsAddingForecast(true);
                                  setIsNewOrderPopoverOpen(false);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Plus size={14} /> Pedido Individual
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                        <input 
                          placeholder="Pesquisar..."
                          className="bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 pl-11 pr-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all w-40"
                          value={forecastSearch}
                          onChange={e => setForecastSearch(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {forecastStatusFilter === 'pending' && (
                    <div className="mb-4 flex items-center justify-start gap-2">
                      <button
                        onClick={() => {
                          if (!ensureCanEditPlanning()) return;
                          setIsBatchSelectionMode((prev) => {
                            const next = !prev;
                            if (!next) {
                              setSelectedForecastIds([]);
                              setIsConvertingForecastsToGroup(false);
                            }
                            return next;
                          });
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${
                          isBatchSelectionMode
                            ? 'bg-slate-700 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-700 dark:border-slate-200'
                            : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <ListChecks size={12} /> {isBatchSelectionMode ? 'Ocultar Seleção' : 'Selecionar Itens'}
                      </button>

                      {isBatchSelectionMode && (
                        <button
                          onClick={() => {
                            if (!ensureCanEditPlanning()) return;
                            setIsConvertingForecastsToGroup(true);
                          }}
                          disabled={selectedForecastIds.length === 0}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Layers size={12} /> Converter em Grupo {selectedForecastIds.length > 0 ? `(${selectedForecastIds.length})` : ''}
                        </button>
                      )}
                    </div>
                  )}

                  <table className="w-full text-left border-separate border-spacing-y-3">
                    <thead>
                      <tr className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 text-center">
                        <th className="pb-2 w-12">
                          {forecastStatusFilter === 'pending' && isBatchSelectionMode && (
                            <input
                              type="checkbox"
                              checked={allSelectableChecked}
                              onChange={toggleAllSelectableForecasts}
                              className="w-4 h-4 rounded border-slate-300"
                              title="Selecionar todos os itens sem grupo"
                            />
                          )}
                        </th>
                        <th className="pb-2 pl-4 text-left">Material / Fornecedor</th>
                        <th className="pb-2">Und</th>
                        <th className="pb-2">Qtd</th>
                        <th className="pb-2">Unitário</th>
                        <th className="pb-2">Total Previsto</th>
                        <th className="pb-2">Status</th>
                        {forecastStatusFilter === 'ordered' && (
                          <th className="pb-2">Pago?</th>
                        )}
                        {forecastStatusFilter === 'delivered' && (
                          <th className="pb-2">Dar Baixa?</th>
                        )}
                        <th className="pb-2 text-right pr-4">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="text-center">
                      {groupedForecastRows.map((row) => {
                        if (row.type === 'single') {
                          const f = row.forecast;
                          const supplier = suppliers.find(s => s.id === f.supplierId);
                          const linkedExpense = findExpenseForForecast(f);
                          const financialGroupId = f.categoryId || linkedExpense?.parentId || undefined;
                          const stageName = financialGroupId ? financialGroupNameById.get(financialGroupId) : undefined;

                          let dateLabel = 'Previsto';
                          let dateValue = f.estimatedDate;
                          let dateColor = 'text-slate-400';
                          let statusText = '';

                          if (f.status === 'ordered') {
                            if (f.isPaid) {
                              dateLabel = 'Pago';
                              dateColor = 'text-indigo-500';
                            } else {
                              dateLabel = 'Comprado';
                              dateColor = 'text-amber-500';
                              statusText = '(A Pagar)';
                            }
                            dateValue = f.purchaseDate || f.estimatedDate;
                          } else if (f.status === 'delivered') {
                            dateLabel = 'Entregue';
                            dateValue = f.deliveryDate || f.estimatedDate;
                            dateColor = 'text-emerald-500';
                          }

                          return (
                            <tr
                              key={f.id}
                              className={`group/row border border-slate-100 dark:border-slate-800 rounded-3xl transition-all shadow-sm ${
                                forecastStatusFilter === 'ordered' && !f.isPaid
                                  ? 'bg-amber-50/60 dark:bg-amber-900/10'
                                  : 'bg-white dark:bg-slate-900'
                              } hover:shadow-md`}
                            >
                              <td className="py-4 pl-2 rounded-l-3xl">
                                <div className="flex items-center justify-center gap-0.5">
                                  {forecastStatusFilter === 'pending' && isBatchSelectionMode && (
                                    <input
                                      type="checkbox"
                                      checked={selectedForecastIds.includes(f.id)}
                                      onChange={() => toggleForecastSelection(f.id)}
                                      className="w-4 h-4 rounded border-slate-300"
                                      title="Selecionar item"
                                    />
                                  )}
                                  <div className="flex flex-col">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        moveForecastInStatus(f.id, 'up');
                                      }}
                                      className="p-0.5 rounded text-slate-300 hover:text-indigo-500"
                                      title="Mover para fora"
                                    >
                                      <ChevronUp size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        moveForecastInStatus(f.id, 'down');
                                      }}
                                      className="p-0.5 rounded text-slate-300 hover:text-indigo-500"
                                      title="Mover para baixo"
                                    >
                                      <ChevronDown size={12} />
                                    </button>
                                  </div>
                                  <div className="p-1 text-slate-200">
                                    <GripVertical size={14}/>
                                  </div>
                                </div>
                              </td>
                              <td className="py-6 px-4 text-left min-w-[250px]">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    {forecastStatusFilter === 'ordered' && !f.isPaid && (
                                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-600" title="Pagamento pendente">
                                        <Clock size={12} />
                                      </span>
                                    )}
                                    <span className="text-sm font-black dark:text-white leading-tight uppercase">{f.description}</span>
                                    {linkedExpense?.invoiceDoc && (
                                      <button onClick={() => handleViewProof(linkedExpense.invoiceDoc!)} className="p-1.5 text-emerald-400 hover:text-emerald-600 rounded-lg" title="Baixar Nota Fiscal">
                                        <Receipt size={14} />
                                      </button>
                                    )}
                                    {f.paymentProof && (
                                      <button onClick={() => handleViewProof(f.paymentProof!)} className="p-1.5 text-blue-400 hover:text-blue-600 rounded-lg" title="Baixar Comprovante">
                                        <Download size={14} />
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-indigo-500 uppercase tracking-widest">
                                      <Building2 size={10} className="shrink-0" />
                                      {supplier ? supplier.name : 'Fornecedor não vinculado'}
                                    </div>
                                    <div className={`flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest ${dateColor}`}>
                                      <Calendar size={9} className="shrink-0" />
                                      {dateLabel}: {financial.formatDate(dateValue)} <span className="ml-1 opacity-70">{statusText}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-slate-400">
                                      <Layers size={9} className="shrink-0" />
                                      ETAPA: {stageName || 'SEM GRUPO'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-6"><span className="text-[10px] font-black uppercase text-slate-400">{f.unit}</span></td>
                              <td className="py-6">
                                <input
                                  type="number"
                                  step="any"
                                  className="w-16 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg px-2 py-1 text-center text-[11px] font-black outline-none focus:border-indigo-500 transition-all dark:text-slate-200"
                                  value={f.quantityNeeded}
                                  onBlur={(e) => {
                                    applyInlineForecastUpdate(
                                      f,
                                      {
                                        quantityNeeded: financial.normalizeQuantity(parseFloat(e.target.value) || 0),
                                      },
                                      true,
                                    );
                                  }}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    applyInlineForecastUpdate(f, {
                                      quantityNeeded: financial.normalizeQuantity(parseFloat(val) || 0),
                                    }, true);
                                  }}
                                />
                              </td>
                              <td className="py-6">
                                <InlineCurrencyInput
                                  value={f.unitPrice}
                                  onUpdate={(val: number) => {
                                    applyInlineForecastUpdate(
                                      f,
                                      { unitPrice: val },
                                      true,
                                    );
                                  }}
                                />
                              </td>
                              <td className="py-6">
                                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                                  {financial.formatVisual(getForecastNetTotal(f), project.theme?.currencySymbol)}
                                </span>
                              </td>
                              <td className="py-6">
                                <div className="flex gap-2 justify-center">
                                  <StatusCircle
                                    active={f.status === 'pending'}
                                    onClick={() => {
                                      if (f.status !== 'pending') {
                                        toast.warning('Comprado não pode voltar para a etapa de a comprar.');
                                        return;
                                      }
                                      onUpdatePlanning(planningService.updateForecast(planning, f.id, { status: 'pending' }));
                                    }}
                                    icon={<AlertCircle size={12}/>}
                                    color="amber"
                                    label="Pendente"
                                  />
                                  <StatusCircle
                                    active={f.status === 'ordered'}
                                    onClick={() => {
                                      if (f.status === 'delivered') {
                                        toast.warning('No Local nao pode voltar para comprado.');
                                        return;
                                      }
                                      setConfirmingForecast(f);
                                    }}
                                    icon={<ShoppingCart size={12}/>}
                                    color="blue"
                                    label="Comprado"
                                  />
                                  <StatusCircle
                                    active={f.status === 'delivered'}
                                    onClick={() => {
                                      if (f.status === 'pending') {
                                        toast.warning('Para marcar como No Local, primeiro registre como Comprado.');
                                        return;
                                      }
                                      if (!f.isPaid) {
                                        toast.warning('Para marcar como No Local, primeiro confirme o pagamento.');
                                        return;
                                      }
                                      if (f.status === 'delivered') return;
                                      setConfirmingDeliveryForecast(f);
                                    }}
                                    icon={<Truck size={12}/>}
                                    color="emerald"
                                    label="No Local"
                                  />
                                </div>
                              </td>
                              {forecastStatusFilter === 'ordered' && (
                                <td className="py-6">
                                  <button
                                    onClick={() => {
                                      if (f.status === 'pending') {
                                        setForcePaidConfirm(false);
                                        setConfirmingForecast(f);
                                        return;
                                      }
                                      if (!f.isPaid) {
                                        setForcePaidConfirm(true);
                                        setConfirmingForecast(f);
                                        return;
                                      }
                                      onUpdatePlanning(planningService.updateForecast(planning, f.id, { isPaid: false }));
                                    }}
                                    className={`p-2.5 rounded-full transition-all ${f.isPaid ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 shadow-sm' : 'text-slate-200 hover:text-rose-400 bg-slate-50 dark:bg-slate-800'}`}
                                  >
                                    {f.isPaid ? <CheckCircle2 size={20}/> : <Circle size={20}/>}
                                  </button>
                                </td>
                              )}
                              {forecastStatusFilter === 'delivered' && (
                                <td className="py-6">
                                  <button
                                    onClick={() => {
                                      if (f.isCleared) return;
                                      const linkedExpense = findExpenseForForecast(f);
                                      if (!linkedExpense) {
                                        toast.warning('Nao foi encontrado o item financeiro vinculado.');
                                        return;
                                      }
                                      setConfirmingClearanceForecast(f);
                                    }}
                                    className={`p-2.5 rounded-full transition-all ${f.isCleared ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 shadow-sm' : 'text-slate-200 hover:text-emerald-400 bg-slate-50 dark:bg-slate-800'}`}
                                  >
                                    {f.isCleared ? <CheckCircle2 size={20}/> : <Circle size={20}/>}
                                  </button>
                                </td>
                              )}
                              <td className="py-6 text-right pr-6 rounded-r-3xl">
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                  {f.paymentProof && (
                                    <button onClick={() => handleViewProof(f.paymentProof!)} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl" title="Baixar Comprovante"><Download size={18}/></button>
                                  )}
                                  <button onClick={() => { if (!ensureCanEditPlanning()) return; setEditingForecast(f); }} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl" title="Editar"><Edit2 size={18}/></button>
                                  <button onClick={() => { if (!ensureCanEditPlanning()) return; setIsDeletingForecast(f); }} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl" title="Excluir"><Trash2 size={18}/></button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        const group = row.group;
                        const groupSupplier = suppliers.find((s) => s.id === group.supplierId);
                        const isExpanded = !!expandedSupplyGroups[row.groupId];
                        const groupTotal = row.forecasts.reduce((acc, item) => acc + getForecastNetTotal(item), 0);

                        return (
                          <React.Fragment key={`group-${row.groupId}`}>
                            <tr
                              className={`group/row transition-all shadow-sm hover:shadow-md ${
                                forecastStatusFilter === 'ordered' && !group.isPaid
                                  ? 'border border-amber-100 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-900/10'
                                  : 'border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/10'
                              }`}
                            >
                              <td className="py-4 pl-2">
                                <button
                                  onClick={() => toggleSupplyGroupExpansion(row.groupId)}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors"
                                  title={isExpanded ? 'Recolher grupo' : 'Expandir grupo'}
                                >
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                              </td>
                              <td className="py-6 px-4 text-left min-w-[250px]">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    {forecastStatusFilter === 'ordered' && !group.isPaid && (
                                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-600" title="Pagamento pendente">
                                        <Clock size={12} />
                                      </span>
                                    )}
                                    <span className="text-sm font-black text-indigo-700 dark:text-indigo-300 uppercase leading-tight">
                                      {group.title?.trim() || `Grupo com ${row.forecasts.length} itens`}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[8px] font-black uppercase tracking-widest">
                                      Lote ({row.forecasts.length})
                                    </span>
                                    {group.invoiceDoc && (
                                      <button onClick={() => handleViewProof(group.invoiceDoc!)} className="p-1.5 text-emerald-400 hover:text-emerald-600 rounded-lg" title="Ver Nota Fiscal">
                                        <Receipt size={14} />
                                      </button>
                                    )}
                                    {group.paymentProof && (
                                      <button onClick={() => handleViewProof(group.paymentProof!)} className="p-1.5 text-blue-400 hover:text-blue-600 rounded-lg" title="Ver Comprovante">
                                        <Download size={14} />
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-indigo-500 uppercase tracking-widest">
                                    <Building2 size={10} className="shrink-0" />
                                    {groupSupplier ? groupSupplier.name : 'Fornecedor não vinculado'}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-slate-400">
                                    <Calendar size={9} className="shrink-0" />
                                    Previsão: {financial.formatDate(group.estimatedDate)}
                                  </div>
                                </div>
                              </td>
                              <td className="py-6"><span className="text-[10px] font-black uppercase text-slate-400">-</span></td>
                              <td className="py-6"><span className="text-[10px] font-black uppercase text-slate-400">{row.forecasts.length} itens</span></td>
                              <td className="py-6"><span className="text-[10px] font-black uppercase text-slate-400">-</span></td>
                              <td className="py-6">
                                <span className="text-sm font-black text-indigo-700 dark:text-indigo-300">
                                  {financial.formatVisual(groupTotal, project.theme?.currencySymbol)}
                                </span>
                              </td>
                              <td className="py-6">
                                <div className="flex gap-2 justify-center">
                                  <StatusCircle
                                    active={group.status === 'pending'}
                                    onClick={() => {
                                      if (group.status !== 'pending') {
                                        toast.warning('Comprado não pode voltar para a etapa de a comprar.');
                                      }
                                    }}
                                    icon={<AlertCircle size={12}/>}
                                    color="amber"
                                    label="Pendente"
                                  />
                                  <StatusCircle
                                    active={group.status === 'ordered'}
                                    onClick={() => {
                                      if (group.status === 'delivered') {
                                        toast.warning('No Local nao pode voltar para comprado.');
                                        return;
                                      }
                                      if (group.status === 'pending') {
                                        setConfirmingGroupPurchase(group);
                                      }
                                    }}
                                    icon={<ShoppingCart size={12}/>}
                                    color="blue"
                                    label="Comprado"
                                  />
                                  <StatusCircle
                                    active={group.status === 'delivered'}
                                    onClick={() => {
                                      if (group.status === 'pending') {
                                        toast.warning('Para marcar como No Local, primeiro registre como Comprado.');
                                        return;
                                      }
                                      if (!group.isPaid) {
                                        toast.warning('Para marcar como No Local, primeiro confirme o pagamento.');
                                        return;
                                      }
                                      if (group.status === 'delivered') return;
                                      setConfirmingGroupDelivery(group);
                                    }}
                                    icon={<Truck size={12}/>}
                                    color="emerald"
                                    label="No Local"
                                  />
                                </div>
                              </td>
                              {forecastStatusFilter === 'ordered' && (
                                <td className="py-6">
                                  <button
                                    onClick={() => setConfirmingGroupPurchase(group)}
                                    className={`p-2.5 rounded-full transition-all ${group.isPaid ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 shadow-sm' : 'text-slate-200 hover:text-emerald-400 bg-slate-50 dark:bg-slate-800'}`}
                                  >
                                    {group.isPaid ? <CheckCircle2 size={20}/> : <Circle size={20}/>}
                                  </button>
                                </td>
                              )}
                              {forecastStatusFilter === 'delivered' && (
                                <td className="py-6">
                                  <button
                                    onClick={() => {
                                      if (group.isCleared) return;
                                      setConfirmingGroupClearance(group);
                                    }}
                                    className={`p-2.5 rounded-full transition-all ${group.isCleared ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 shadow-sm' : 'text-slate-200 hover:text-emerald-400 bg-slate-50 dark:bg-slate-800'}`}
                                  >
                                    {group.isCleared ? <CheckCircle2 size={20}/> : <Circle size={20}/>}
                                  </button>
                                </td>
                              )}
                              <td className="py-6 text-right pr-6">
                                <div className="flex items-center justify-end gap-1 opacity-100 transition-opacity">
                                  {forecastStatusFilter === 'delivered' && (
                                    <button
                                      onClick={() => setEditingGroupDocs(group)}
                                      className="p-2 text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-xl"
                                      title="Documentos do grupo"
                                    >
                                      <FileText size={18}/>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => void openSupplyGroupEditorById(group.id)}
                                    className="p-2 text-indigo-500 hover:bg-indigo-100 rounded-xl"
                                    title="Editar grupo"
                                  >
                                    <Layers size={18}/>
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {isExpanded && row.forecasts.map((item) => {
                              const supplier = suppliers.find(s => s.id === item.supplierId);
                              return (
                                <tr key={item.id} className="border border-slate-100 dark:border-slate-800 transition-all shadow-sm bg-white dark:bg-slate-900/80">
                                  <td className="py-4 pl-2" />
                                  <td className="py-4 px-4 text-left min-w-[250px]">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs font-black dark:text-white uppercase">{item.description}</span>
                                      <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">{supplier ? supplier.name : 'Fornecedor não vinculado'}</span>
                                    </div>
                                  </td>
                                  <td className="py-4"><span className="text-[10px] font-black uppercase text-slate-400">{item.unit}</span></td>
                                  <td className="py-4"><span className="text-[11px] font-black text-slate-600">{item.quantityNeeded}</span></td>
                                  <td className="py-4"><span className="text-[11px] font-black text-slate-600">{financial.formatVisual(item.unitPrice, project.theme?.currencySymbol)}</span></td>
                                  <td className="py-4"><span className="text-xs font-black text-indigo-600">{financial.formatVisual(getForecastNetTotal(item), project.theme?.currencySymbol)}</span></td>
                                  <td className="py-4"><span className="text-[9px] font-black uppercase text-slate-400">No grupo</span></td>
                                  {forecastStatusFilter === 'ordered' && <td className="py-4" />}
                                  {forecastStatusFilter === 'delivered' && <td className="py-4" />}
                                  <td className="py-4 text-right pr-6" />
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                  {groupedForecastRows.length === 0 && (
                    <div className="py-24 flex flex-col items-center justify-center text-slate-300 opacity-40">
                      <Boxes size={64} className="mb-4" />
                      <p className="text-xs font-black uppercase tracking-[0.2em]">Sem suprimentos neste estágio</p>
                    </div>
                  )}
                </div>
            </div>
          </div>
        )}
      </DragDropContext>

      {/* MODAL DE CADASTRO/EDIÇÃO DE SUPRIMENTO (DARK PREMIUM) */}
      {(isAddingForecast || editingForecast) && (
        <ForecastModal 
          onClose={() => { setIsAddingForecast(false); setEditingForecast(null); }}
          projectId={project.id}
          allWorkItems={allWorkItems}
          suppliers={suppliers}
          expenses={project.expenses}
          forecasts={planning.forecasts}
          editingItem={editingForecast}
          onSave={(data: any) => {
            if (editingForecast) {
              const nextForecast = { ...editingForecast, ...data };
              onUpdatePlanning(planningService.updateForecast(planning, editingForecast.id, data));
              syncExpenseWithForecast(nextForecast);
            } else {
              const createdBy = user?.id && user?.name
                ? { id: user.id, name: user.name, profileImage: user.profileImage ?? null }
                : undefined;
              onUpdatePlanning(planningService.addForecast(planning, {
                ...data,
                createdById: user?.id,
                createdBy,
              }));
            }
            setIsAddingForecast(false);
            setEditingForecast(null);
          }}
        />
      )}

      {isAddingSupplyGroup && (
        <SupplyGroupModal
          mode="create"
          projectId={project.id}
          suppliers={suppliers}
          expenses={project.expenses}
          forecasts={planning.forecasts}
          financialCategories={financialCategories}
          onClose={() => setIsAddingSupplyGroup(false)}
          onCreate={handleCreateSupplyGroup}
        />
      )}

      {isConvertingForecastsToGroup && (
        <ConvertForecastsToGroupModal
          suppliers={suppliers}
          selectedCount={selectedForecastIds.length}
          onClose={() => setIsConvertingForecastsToGroup(false)}
          onConvert={handleConvertSelectedForecasts}
        />
      )}

      {editingSupplyGroup && (
        <SupplyGroupModal
          mode="edit"
          projectId={project.id}
          suppliers={suppliers}
          expenses={project.expenses}
          forecasts={planning.forecasts}
          financialCategories={financialCategories}
          group={editingSupplyGroup}
          onClose={() => setEditingSupplyGroup(null)}
          onUpdate={(payload) => handleUpdateSupplyGroup(editingSupplyGroup.id, payload)}
          onDeleteGroup={() => setConfirmingDeleteSupplyGroup(editingSupplyGroup)}
          onSyncItemFinancialGroup={syncItemFinancialGroup}
        />
      )}

      <ConfirmModal
        isOpen={!!confirmingDeleteSupplyGroup}
        title="Remover Grupo"
        message="Deseja remover este grupo e todos os itens vinculados? Esta ação é irreversível."
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => confirmingDeleteSupplyGroup && handleDeleteSupplyGroup(confirmingDeleteSupplyGroup.id)}
        onCancel={() => setConfirmingDeleteSupplyGroup(null)}
      />

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {isDeletingForecast && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsDeletingForecast(null)}>
          <div className="bg-white dark:bg-[#0f111a] w-full max-w-md rounded-[3rem] p-12 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-rose-500/10 blur-[100px] pointer-events-none"></div>
            <div className="relative mb-10">
              <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800/40 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700">
                 <Trash2 size={36} className="text-rose-500" />
              </div>
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-4">Remover Insumo?</h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg font-medium leading-relaxed mb-12">
              Deseja realmente excluir o suprimento <span className="text-slate-900 dark:text-white font-bold">{isDeletingForecast.description}</span>? Esta ação é irreversível.
            </p>
            <div className="flex items-center gap-6 w-full">
               <button onClick={() => setIsDeletingForecast(null)} className="flex-1 py-4 text-slate-500 dark:text-slate-300 font-black uppercase text-xs tracking-widest hover:text-slate-800 dark:hover:text-white transition-colors">Voltar</button>
               <button onClick={() => { onUpdatePlanning(planningService.deleteForecast(planning, isDeletingForecast.id)); setIsDeletingForecast(null); }} className="flex-[2] py-5 bg-rose-600 hover:bg-rose-500 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl shadow-rose-500/20 active:scale-95 transition-all">Excluir Permanente</button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'milestones' && (
        <div className="space-y-8 animate-in fade-in">
           <div className="flex items-center justify-between">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                 <button onClick={() => setMilestoneView('list')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${milestoneView === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-400'}`}><List size={14}/> Lista</button>
                 <button onClick={() => setMilestoneView('calendar')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${milestoneView === 'calendar' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-400'}`}><CalendarDays size={14}/> Calendário</button>
              </div>
              <button onClick={() => { if (!ensureCanEditPlanning()) return; setIsAddingMilestone(true); }} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all">
                <Plus size={16} /> Nova Meta
              </button>
           </div>

           {milestoneView === 'list' ? (
             <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="relative space-y-10 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-1 before:bg-slate-100 dark:before:bg-slate-800">
                  {planning.milestones.map(m => (
                    <div key={m.id} className="relative flex items-center justify-between pl-10">
                      <div className={`absolute left-0 w-7 h-7 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center shadow-md ${m.isCompleted ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`}>
                        <Flag size={12} className="text-white" />
                      </div>
                      <div className={`flex-1 ml-6 bg-slate-50 dark:bg-slate-800/40 p-6 rounded-3xl border transition-all flex items-center justify-between group ${m.isCompleted ? 'border-emerald-200' : 'border-slate-100 dark:border-slate-800'}`}>
                        <div className="flex flex-col gap-1">
                           <h4 className="text-base font-black dark:text-white uppercase tracking-tight">{m.title}</h4>
                           <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                             <Calendar size={14}/> {financial.formatDate(m.date)}
                           </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <button onClick={() => { if (!ensureCanEditPlanning()) return; onUpdatePlanning(planningService.updateMilestone(planning, m.id, { isCompleted: !m.isCompleted })); }} className={`text-[10px] font-black uppercase px-5 py-2 rounded-full border transition-all ${m.isCompleted ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-white dark:bg-slate-700 text-slate-400 border-slate-200 dark:border-slate-600'}`}>
                            {m.isCompleted ? 'Finalizada' : 'Em Aberto'}
                          </button>
                          <button onClick={() => { if (!ensureCanEditPlanning()) return; setEditingMilestone(m); }} className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-white rounded-lg transition-all"><Edit2 size={18}/></button>
                          <button onClick={() => { if (!ensureCanEditPlanning()) return; onUpdatePlanning(planningService.deleteMilestone(planning, m.id)); }} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-white rounded-lg transition-all"><Trash2 size={18}/></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
           ) : (
             <CalendarView milestones={planning.milestones} onEdit={setEditingMilestone} />
           )}
        </div>
      )}

      {/* MODAIS TAREFA E MILESTONE */}
      {(editingTask || isAddingTask) && (
        <TaskModal 
          task={editingTask} 
          initialStatus={isAddingTask}
          onClose={() => { setEditingTask(null); setIsAddingTask(null); }} 
          onSave={(data: Partial<PlanningTask>) => {
            if (!ensureCanEditPlanning()) return;
            if (editingTask) handleUpdateTask(editingTask.id, data);
            else handleAddTask(data);
            setEditingTask(null);
            setIsAddingTask(null);
          }}
        />
      )}

      {(editingMilestone || isAddingMilestone) && (
        <MilestoneModal 
          milestone={editingMilestone}
          onClose={() => { setEditingMilestone(null); setIsAddingMilestone(false); }}
          onSave={(data: Partial<Milestone>) => {
            if (!ensureCanEditPlanning()) return;
            if (editingMilestone) onUpdatePlanning(planningService.updateMilestone(planning, editingMilestone.id, data));
            else onUpdatePlanning(planningService.addMilestone(planning, data));
            setEditingMilestone(null);
            setIsAddingMilestone(false);
          }}
        />
      )}

      {/* MODAL DE EFETIVAR COMPRA (CORRIGIDO E DARK) */}
      {confirmingForecast && (
        <ConfirmForecastModal 
          forecast={confirmingForecast} 
          onClose={() => { setConfirmingForecast(null); setForcePaidConfirm(false); }} 
          onConfirm={(isPaid: boolean, parentId: string | null, proof?: string, purchaseDate?: string, discountValue?: number, discountPercentage?: number) => {
            handleFinalizePurchase(confirmingForecast, parentId, isPaid, proof, purchaseDate, discountValue, discountPercentage);
            setForcePaidConfirm(false);
          }}
          initialDiscountValue={confirmingForecast.discountValue ?? findExpenseForForecast(confirmingForecast)?.discountValue}
          initialDiscountPercentage={confirmingForecast.discountPercentage ?? findExpenseForForecast(confirmingForecast)?.discountPercentage}
          financialCategories={financialCategories}
          onAddExpense={onAddExpense}
          toast={toast}
          forcePaid={forcePaidConfirm}
        />
      )}

      <ConfirmModal
        isOpen={!!confirmingDeliveryForecast}
        title="Confirmar entrega"
        message="Ao marcar como No Local, o status nao podera voltar para Comprado. Deseja continuar?"
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        variant="warning"
        onConfirm={() => confirmingDeliveryForecast && handleFinalizeDelivery(confirmingDeliveryForecast)}
        onCancel={() => setConfirmingDeliveryForecast(null)}
      />

      {confirmingClearanceForecast && (
        <ClearanceModal
          forecast={confirmingClearanceForecast}
          currentInvoiceDoc={findExpenseForForecast(confirmingClearanceForecast)?.invoiceDoc}
          onClose={() => setConfirmingClearanceForecast(null)}
          onConfirm={(invoiceDoc?: string) => handleFinalizeClearance(confirmingClearanceForecast, invoiceDoc)}
        />
      )}

      {confirmingGroupPurchase && (
        <ConfirmSupplyGroupPurchaseModal
          group={confirmingGroupPurchase}
          onClose={() => setConfirmingGroupPurchase(null)}
          onConfirm={(payload) => handleFinalizeGroupPurchase(confirmingGroupPurchase, payload)}
        />
      )}

      <ConfirmModal
        isOpen={!!confirmingGroupDelivery}
        title="Confirmar entrega do grupo"
        message="Ao marcar o grupo como No Local, o status não poderá voltar para Comprado. Deseja continuar?"
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        variant="warning"
        onConfirm={() => confirmingGroupDelivery && handleFinalizeGroupDelivery(confirmingGroupDelivery)}
        onCancel={() => setConfirmingGroupDelivery(null)}
      />

      {confirmingGroupClearance && (
        <SupplyGroupClearanceModal
          group={confirmingGroupClearance}
          onClose={() => setConfirmingGroupClearance(null)}
          onConfirm={(invoiceDoc?: string) => handleFinalizeGroupClearance(confirmingGroupClearance, invoiceDoc)}
        />
      )}

      {editingGroupDocs && (
        <SupplyGroupDocsModal
          group={editingGroupDocs}
          onClose={() => setEditingGroupDocs(null)}
          onSave={async (docs) => {
            await handleUpdateSupplyGroup(editingGroupDocs.id, docs);
            setEditingGroupDocs(null);
          }}
        />
      )}
    </div>
  );
};

const ClearanceModal = ({ forecast, currentInvoiceDoc, onClose, onConfirm }: any) => {
  const [invoiceDoc, setInvoiceDoc] = useState<string | undefined>(currentInvoiceDoc);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white dark:bg-[#0f111a] w-full max-w-xl rounded-[3rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col items-center relative overflow-hidden text-center" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/10 blur-[100px] pointer-events-none"></div>

        <div className="relative mb-6">
           <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/40 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700">
              <FileCheck size={28} className="text-emerald-500" />
           </div>
        </div>

        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">Dar baixa</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
          Anexe a nota fiscal do item <span className="text-slate-900 dark:text-white font-bold">{forecast.description}</span>.
        </p>

        <div className="w-full mb-6">
          <ExpenseAttachmentZone
            label="Nota Fiscal de Compra"
            requiredStatus="DELIVERED"
            currentFile={invoiceDoc}
            onUploadUrl={(url) => setInvoiceDoc(url)}
            onRemove={() => setInvoiceDoc(undefined)}
          />
        </div>

        <div className="flex items-center gap-4 w-full">
          <button onClick={onClose} className="flex-1 py-3 text-slate-500 dark:text-slate-300 font-black uppercase text-xs tracking-widest hover:text-slate-800 dark:hover:text-white transition-colors">Voltar</button>
          <button
            onClick={() => onConfirm(invoiceDoc)}
            className="flex-[2] py-3 rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20 text-white"
          >
            Confirmar Baixa
          </button>
        </div>
      </div>
    </div>
  );
};

const ConfirmSupplyGroupPurchaseModal = ({
  group,
  onClose,
  onConfirm,
}: {
  group: SupplyGroup;
  onClose: () => void;
  onConfirm: (payload: { purchaseDate: string; isPaid: boolean; paymentProof?: string | null }) => Promise<void> | void;
}) => {
  const toast = useToast();
  const [purchaseDate, setPurchaseDate] = useState(group.purchaseDate?.split('T')[0] || new Date().toISOString().split('T')[0]);
  const [isPaid, setIsPaid] = useState(!!group.isPaid);
  const [paymentProof, setPaymentProof] = useState<string | undefined>(group.paymentProof || undefined);

  return (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white dark:bg-[#0f111a] w-full max-w-xl rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6">Efetivar Compra do Grupo</h2>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Data da Compra</label>
            <input
              type="date"
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold outline-none focus:border-indigo-600"
              value={purchaseDate}
              onChange={(event) => setPurchaseDate(event.target.value)}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Marcar como pago agora?</span>
            <button
              type="button"
              onClick={() => setIsPaid((prev) => !prev)}
              className={`w-12 h-6 rounded-full relative transition-all ${isPaid ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isPaid ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          {isPaid && (
            <ExpenseAttachmentZone
              label="Comprovante de Pagamento (Grupo)"
              requiredStatus="PAID"
              currentFile={paymentProof}
              onUploadUrl={(url) => setPaymentProof(url)}
              onRemove={() => setPaymentProof(undefined)}
            />
          )}
        </div>

        <div className="flex items-center gap-3 mt-8">
          <button onClick={onClose} className="flex-1 py-3 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
          <button
            onClick={() => {
              if (isPaid && !paymentProof) {
                toast.warning('Anexe o comprovante para confirmar como pago.');
                return;
              }
              void onConfirm({
                purchaseDate,
                isPaid,
                paymentProof: paymentProof || null,
              });
            }}
            className="flex-[2] py-3 rounded-2xl bg-indigo-600 text-white font-black uppercase text-[10px] tracking-widest"
          >
            Confirmar Pedido
          </button>
        </div>
      </div>
    </div>
  );
};

const SupplyGroupDocsModal = ({
  group,
  onClose,
  onSave,
}: {
  group: SupplyGroup;
  onClose: () => void;
  onSave: (docs: { paymentProof?: string | null; invoiceDoc?: string | null }) => Promise<void> | void;
}) => {
  const [paymentProof, setPaymentProof] = useState<string | undefined>(group.paymentProof || undefined);
  const [invoiceDoc, setInvoiceDoc] = useState<string | undefined>(group.invoiceDoc || undefined);
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white dark:bg-[#0f111a] w-full max-w-xl rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-3">Documentos do Grupo</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Gerencie o comprovante de pagamento e a nota fiscal deste grupo.</p>

        <div className="space-y-4">
          <ExpenseAttachmentZone
            label="Comprovante de Pagamento"
            requiredStatus="PAID"
            currentFile={paymentProof}
            onUploadUrl={(url) => setPaymentProof(url)}
            onRemove={() => setPaymentProof(undefined)}
          />

          <ExpenseAttachmentZone
            label="Nota Fiscal"
            requiredStatus="DELIVERED"
            currentFile={invoiceDoc}
            onUploadUrl={(url) => setInvoiceDoc(url)}
            onRemove={() => setInvoiceDoc(undefined)}
          />
        </div>

        <div className="flex items-center gap-3 mt-8">
          <button onClick={onClose} className="flex-1 py-3 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({
                  paymentProof: paymentProof || null,
                  invoiceDoc: invoiceDoc || null,
                });
              } finally {
                setSaving(false);
              }
            }}
            className="flex-[2] py-3 rounded-2xl bg-indigo-600 text-white font-black uppercase text-[10px] tracking-widest disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SupplyGroupClearanceModal = ({
  group,
  onClose,
  onConfirm,
}: {
  group: SupplyGroup;
  onClose: () => void;
  onConfirm: (invoiceDoc?: string) => Promise<void> | void;
}) => {
  const [invoiceDoc, setInvoiceDoc] = useState<string | undefined>(group.invoiceDoc || undefined);

  return (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white dark:bg-[#0f111a] w-full max-w-xl rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-3">Dar Baixa no Grupo</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Anexe a nota fiscal para concluir a baixa do grupo.</p>

        <ExpenseAttachmentZone
          label="Nota Fiscal do Grupo"
          requiredStatus="DELIVERED"
          currentFile={invoiceDoc}
          onUploadUrl={(url) => setInvoiceDoc(url)}
          onRemove={() => setInvoiceDoc(undefined)}
        />

        <div className="flex items-center gap-3 mt-8">
          <button onClick={onClose} className="flex-1 py-3 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
          <button
            onClick={() => void onConfirm(invoiceDoc)}
            className="flex-[2] py-3 rounded-2xl bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest"
          >
            Confirmar Baixa
          </button>
        </div>
      </div>
    </div>
  );
};

// --- PREMIUM COMPONENTS ---

const ProcurementStep = ({ active, onClick, label, count, icon, color }: any) => {
  const colors: any = {
    amber: active ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600',
    blue: active ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600',
    emerald: active ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
  };

  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${colors[color]}`}
    >
      {icon}
      <span>{label}</span>
      <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black ${active ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
        {count}
      </span>
    </button>
  );
};

const MIN_UNIT_PRICE_DECIMALS = 2;
const MAX_UNIT_PRICE_DECIMALS = 6;
const MIN_QUANTITY_DECIMALS = 2;
const MAX_QUANTITY_DECIMALS = 6;
const QUANTITY_DECIMALS = 2;
type DiscountDriver = 'percent' | 'value';

const countDecimalPlaces = (value: number) => {
  if (!Number.isFinite(value)) return MIN_UNIT_PRICE_DECIMALS;
  const asString = value.toString();
  const index = asString.indexOf('.');
  if (index < 0) return MIN_UNIT_PRICE_DECIMALS;
  return asString.length - index - 1;
};

const resolveUnitPriceScale = (value: number) =>
  financial.clampDecimals(countDecimalPlaces(value), MIN_UNIT_PRICE_DECIMALS, MAX_UNIT_PRICE_DECIMALS);

const resolveQuantityScale = (value: number) =>
  financial.clampDecimals(countDecimalPlaces(value), MIN_QUANTITY_DECIMALS, MAX_QUANTITY_DECIMALS);

const normalizeUnitPriceByScale = (value: number, scale: number) =>
  financial.normalizeMoneyPrecision(value || 0, financial.clampDecimals(scale, MIN_UNIT_PRICE_DECIMALS, MAX_UNIT_PRICE_DECIMALS));

const normalizeQuantityByScale = (value: number, scale: number) =>
  financial.normalizeQuantityPrecision(value || 0, financial.clampDecimals(scale, MIN_QUANTITY_DECIMALS, MAX_QUANTITY_DECIMALS));

const formatUnitPriceByScale = (value: number, scale: number) =>
  financial
    .formatVisualPrecision(
      value || 0,
      '',
      financial.clampDecimals(scale, MIN_UNIT_PRICE_DECIMALS, MAX_UNIT_PRICE_DECIMALS),
      financial.clampDecimals(scale, MIN_UNIT_PRICE_DECIMALS, MAX_UNIT_PRICE_DECIMALS),
    )
    .trim();

const formatQuantityByScale = (value: number, scale = QUANTITY_DECIMALS) =>
  financial
    .formatVisualPrecision(
      value || 0,
      '',
      financial.clampDecimals(scale, MIN_QUANTITY_DECIMALS, MAX_QUANTITY_DECIMALS),
      financial.clampDecimals(scale, MIN_QUANTITY_DECIMALS, MAX_QUANTITY_DECIMALS),
    )
    .trim();

const calculateForecastNetTotal = (quantityNeeded: number, unitPrice: number, discountValue: number) => {
  const gross = (quantityNeeded || 0) * (unitPrice || 0);
  return Math.max(0, financial.normalizeMoney(gross - (discountValue || 0)));
};

const deriveUnitPriceFromNetTotal = (
  quantityNeeded: number,
  totalNet: number,
  discountValue: number,
) => {
  if (quantityNeeded <= 0) {
    return {
      unitPrice: 0,
      decimals: MIN_UNIT_PRICE_DECIMALS,
      achievedTotal: 0,
    };
  }

  const rawUnitPrice = (totalNet + (discountValue || 0)) / quantityNeeded;
  let bestUnitPrice = normalizeUnitPriceByScale(rawUnitPrice, MIN_UNIT_PRICE_DECIMALS);
  let bestDecimals = MIN_UNIT_PRICE_DECIMALS;
  let bestTotal = calculateForecastNetTotal(quantityNeeded, bestUnitPrice, discountValue || 0);
  let bestDelta = Math.abs(bestTotal - totalNet);

  for (let scale = MIN_UNIT_PRICE_DECIMALS; scale <= MAX_UNIT_PRICE_DECIMALS; scale += 1) {
    const candidate = normalizeUnitPriceByScale(rawUnitPrice, scale);
    const candidateTotal = calculateForecastNetTotal(quantityNeeded, candidate, discountValue || 0);
    const delta = Math.abs(candidateTotal - totalNet);

    if (delta < bestDelta) {
      bestDelta = delta;
      bestUnitPrice = candidate;
      bestDecimals = scale;
      bestTotal = candidateTotal;
    }

    if (delta === 0) break;
  }

  return {
    unitPrice: bestUnitPrice,
    decimals: bestDecimals,
    achievedTotal: bestTotal,
  };
};

// --- PREMIUM FORECAST MODAL (DARK) ---
const ForecastModal = ({ onClose, onSave, projectId, allWorkItems, suppliers, expenses, forecasts, editingItem }: any) => {
  const [data, setData] = useState({
    description: editingItem?.description || '',
    calculationMemory: editingItem?.calculationMemory || '',
    quantityNeeded: editingItem?.quantityNeeded || 1,
    unitPrice: editingItem?.unitPrice || 0,
    discountValue: editingItem?.discountValue || 0,
    discountPercentage: editingItem?.discountPercentage || 0,
    unit: editingItem?.unit || 'un',
    isPaid: editingItem?.isPaid || false,
    isCleared: editingItem?.isCleared || false,
    estimatedDate: (editingItem?.estimatedDate || new Date().toISOString()).split('T')[0],
    supplierId: editingItem?.supplierId || '',
    categoryId: editingItem?.categoryId || '',
    paymentProof: editingItem?.paymentProof || ''
  });
  const [strUnitPrice, setStrUnitPrice] = useState(
    formatUnitPriceByScale(editingItem?.unitPrice || 0, resolveUnitPriceScale(editingItem?.unitPrice || 0))
  );
  const [unitPriceDecimals, setUnitPriceDecimals] = useState(
    resolveUnitPriceScale(editingItem?.unitPrice || 0),
  );
  const [quantityDecimals, setQuantityDecimals] = useState(
    resolveQuantityScale(editingItem?.quantityNeeded || 0),
  );
  const [strDiscountValue, setStrDiscountValue] = useState(
    financial.formatVisual(editingItem?.discountValue || 0, '').trim()
  );
  const [strDiscountPercent, setStrDiscountPercent] = useState(
    financial.formatVisual(editingItem?.discountPercentage || 0, '').trim()
  );
  const [discountDriver, setDiscountDriver] = useState<DiscountDriver>('percent');
  const [isEditingTotalNet, setIsEditingTotalNet] = useState(false);
  const [strTotalNet, setStrTotalNet] = useState(
    financial.formatVisual(
      calculateForecastNetTotal(
        editingItem?.quantityNeeded || 1,
        editingItem?.unitPrice || 0,
        editingItem?.discountValue || 0,
      ),
      '',
    ).trim(),
  );
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<MaterialSuggestion[]>([]);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1);
  const [pauseSuggestionsUntilTyping, setPauseSuggestionsUntilTyping] = useState(!!editingItem);
  const suggestionsContainerRef = useRef<HTMLDivElement | null>(null);
  const [manualEdited, setManualEdited] = useState({
    unit: false,
    supplierId: false,
    unitPrice: false,
  });

  const parsedTotalNet = financial.normalizeMoney(financial.parseLocaleNumber(strTotalNet));

  const syncUnitPriceDisplay = (unitPrice: number, decimals: number) => {
    setStrUnitPrice(formatUnitPriceByScale(unitPrice, decimals));
  };

  const syncTotalDisplay = (totalNet: number) => {
    setStrTotalNet(financial.formatVisual(financial.normalizeMoney(totalNet), '').trim());
  };

  const recalcDiscountPercentage = (quantityNeeded: number, unitPrice: number, discountValue: number) => {
    const subtotal = (quantityNeeded || 0) * (unitPrice || 0);
    if (subtotal <= 0) return 0;
    return financial.normalizePercent((discountValue / subtotal) * 100);
  };

  const resolveDiscountFromDriver = (
    subtotal: number,
    driver: DiscountDriver,
    discountValue: number,
    discountPercentage: number,
  ) => {
    if (driver === 'percent') {
      const normalizedPercentage = financial.normalizePercent(discountPercentage || 0);
      const normalizedValue = financial.normalizeMoney(subtotal * (normalizedPercentage / 100));
      return {
        discountValue: normalizedValue,
        discountPercentage: normalizedPercentage,
      };
    }

    const normalizedValue = financial.normalizeMoney(discountValue || 0);
    const normalizedPercentage = subtotal > 0
      ? financial.normalizePercent((normalizedValue / subtotal) * 100)
      : 0;
    return {
      discountValue: normalizedValue,
      discountPercentage: normalizedPercentage,
    };
  };

  const applyTargetNetTotal = (
    quantityNeeded: number,
    targetTotalNet: number,
    driver: DiscountDriver,
    discountValue: number,
    discountPercentage: number,
    options?: {
      keepRawTotalInput?: boolean;
      keepRawDiscountInput?: {
        field: DiscountDriver;
        value: string;
      };
    },
  ) => {
    const targetNet = financial.normalizeMoney(targetTotalNet || 0);
    let resolvedDiscountValue = financial.normalizeMoney(discountValue || 0);
    let resolvedDiscountPercentage = financial.normalizePercent(discountPercentage || 0);

    if (driver === 'percent') {
      const factor = 1 - (resolvedDiscountPercentage / 100);
      const gross = factor > 0 ? targetNet / factor : targetNet;
      resolvedDiscountValue = financial.normalizeMoney(Math.max(0, gross - targetNet));
    }

    const derived = deriveUnitPriceFromNetTotal(quantityNeeded, targetNet, resolvedDiscountValue);
    const reconciled = resolveDiscountFromDriver(
      (quantityNeeded || 0) * (derived.unitPrice || 0),
      driver,
      resolvedDiscountValue,
      resolvedDiscountPercentage,
    );
    resolvedDiscountValue = reconciled.discountValue;
    resolvedDiscountPercentage = reconciled.discountPercentage;

    setUnitPriceDecimals(derived.decimals);
    syncUnitPriceDisplay(derived.unitPrice, derived.decimals);
    if (options?.keepRawDiscountInput?.field === 'value') {
      setStrDiscountValue(options.keepRawDiscountInput.value);
      setStrDiscountPercent(financial.formatVisual(resolvedDiscountPercentage, '').trim());
    } else if (options?.keepRawDiscountInput?.field === 'percent') {
      setStrDiscountPercent(options.keepRawDiscountInput.value);
      setStrDiscountValue(financial.formatVisual(resolvedDiscountValue, '').trim());
    } else {
      setStrDiscountValue(financial.formatVisual(resolvedDiscountValue, '').trim());
      setStrDiscountPercent(financial.formatVisual(resolvedDiscountPercentage, '').trim());
    }
    if (!options?.keepRawTotalInput) {
      syncTotalDisplay(derived.achievedTotal);
    }

    return {
      unitPrice: derived.unitPrice,
      discountValue: resolvedDiscountValue,
      discountPercentage: resolvedDiscountPercentage,
    };
  };

  const autocompleteProvider = useMemo(
    () => {
      const localProvider = createLocalMaterialAutocompleteProvider({
        forecasts,
        expenses,
        suppliers,
      });

      const remoteProvider = createRemoteMaterialAutocompleteProvider({
        searchMaterialSuggestions: (query: string, limit = 8) =>
          projectExpensesApi.getMaterialSuggestions(projectId, query, limit),
      });

      return createFallbackMaterialAutocompleteProvider(remoteProvider, localProvider);
    },
    [forecasts, expenses, suppliers, projectId],
  );

  const applySuggestion = (suggestion: MaterialSuggestion, force = false) => {
    setPauseSuggestionsUntilTyping(true);
    setData((prev: any) => ({
      ...prev,
      description: force ? suggestion.label : (prev.description || suggestion.label),
      calculationMemory:
        force || !(prev.calculationMemory || '').trim()
          ? (suggestion.calculationMemory ?? prev.calculationMemory)
          : prev.calculationMemory,
      unit: force || !manualEdited.unit ? suggestion.unit || prev.unit : prev.unit,
      supplierId:
        force || !manualEdited.supplierId
          ? (suggestion.supplierId ?? prev.supplierId)
          : prev.supplierId,
    }));

    if ((force || !manualEdited.unitPrice) && suggestion.lastUnitPrice !== undefined) {
      const decimals = resolveUnitPriceScale(suggestion.lastUnitPrice || 0);
      const normalized = normalizeUnitPriceByScale(suggestion.lastUnitPrice || 0, decimals);
      setUnitPriceDecimals(decimals);
      syncUnitPriceDisplay(normalized, decimals);
      setData((prev: any) => {
        const nextDiscount = resolveDiscountFromDriver(
          (prev.quantityNeeded || 0) * normalized,
          discountDriver,
          prev.discountValue || 0,
          prev.discountPercentage || 0,
        );
        setStrDiscountValue(financial.formatVisual(nextDiscount.discountValue, '').trim());
        setStrDiscountPercent(financial.formatVisual(nextDiscount.discountPercentage, '').trim());
        return {
          ...prev,
          unitPrice: normalized,
          discountValue: nextDiscount.discountValue,
          discountPercentage: nextDiscount.discountPercentage,
        };
      });
    }

    setSuggestions([]);
    setHighlightedSuggestionIndex(-1);
    setIsSearchingSuggestions(false);
  };

  const visibleSuggestions = useMemo(() => suggestions.slice(0, 5), [suggestions]);

  useEffect(() => {
    setPauseSuggestionsUntilTyping(!!editingItem);
  }, [editingItem?.id]);

  useEffect(() => {
    if (isEditingTotalNet) return;
    const calculated = calculateForecastNetTotal(
      data.quantityNeeded || 0,
      data.unitPrice || 0,
      data.discountValue || 0,
    );
    syncTotalDisplay(calculated);
  }, [isEditingTotalNet, data.quantityNeeded, data.unitPrice, data.discountValue]);

  useEffect(() => {
    syncUnitPriceDisplay(data.unitPrice || 0, unitPriceDecimals);
  }, [unitPriceDecimals]);

  useEffect(() => {
    let active = true;
    const query = data.description?.trim() || '';

    if (pauseSuggestionsUntilTyping) {
      setSuggestions([]);
      setHighlightedSuggestionIndex(-1);
      setIsSearchingSuggestions(false);
      return () => {
        active = false;
      };
    }

    if (query.length < 2) {
      setSuggestions([]);
      setHighlightedSuggestionIndex(-1);
      setIsSearchingSuggestions(false);
      return () => {
        active = false;
      };
    }

    setIsSearchingSuggestions(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await autocompleteProvider.search(query, 6);
        if (!active) return;
        setSuggestions(result);
        setHighlightedSuggestionIndex(result.length > 0 ? 0 : -1);
      } finally {
        if (active) setIsSearchingSuggestions(false);
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [autocompleteProvider, data.description, pauseSuggestionsUntilTyping]);

  useEffect(() => {
    if (highlightedSuggestionIndex < 0) return;
    const container = suggestionsContainerRef.current;
    if (!container) return;

    const target = container.querySelector<HTMLButtonElement>(
      `[data-suggestion-index="${highlightedSuggestionIndex}"]`,
    );
    target?.scrollIntoView({ block: 'nearest' });
  }, [highlightedSuggestionIndex, suggestions.length]);

  const handleDescriptionKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (visibleSuggestions.length === 0) {
      if (event.key === 'Escape') setSuggestions([]);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedSuggestionIndex((prev) =>
        prev < 0 ? 0 : Math.min(prev + 1, visibleSuggestions.length - 1),
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedSuggestionIndex((prev) =>
        prev <= 0 ? 0 : Math.max(prev - 1, 0),
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const target = visibleSuggestions[highlightedSuggestionIndex] ?? visibleSuggestions[0];
      if (target) applySuggestion(target, true);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setSuggestions([]);
      setHighlightedSuggestionIndex(-1);
    }
  };

  const handleDiscountChange = (value: string, field: 'value' | 'percent') => {
    const subtotal = (data.quantityNeeded || 0) * (data.unitPrice || 0);

    if (field === 'percent') {
      const masked = financial.maskDecimal(value, 2);
      setDiscountDriver('percent');
      const discountPercentage = financial.normalizePercent(financial.parseLocaleNumber(masked));
      const discountValue = financial.normalizeMoney(subtotal * (discountPercentage / 100));
      setStrDiscountPercent(masked);
      setStrDiscountValue(financial.formatVisual(discountValue, '').trim());

      if (isEditingTotalNet) {
        const synchronized = applyTargetNetTotal(
          data.quantityNeeded || 0,
          parsedTotalNet,
          'percent',
          discountValue,
          discountPercentage,
          {
            keepRawDiscountInput: {
              field: 'percent',
              value: masked,
            },
          },
        );
        setData(prev => ({
          ...prev,
          ...synchronized,
        }));
      } else {
        setData(prev => ({
          ...prev,
          discountPercentage,
          discountValue,
        }));
      }
      return;
    }

    const masked = financial.maskCurrency(value);
    const discountValue = financial.normalizeMoney(financial.parseLocaleNumber(masked));
    const discountPercentage = subtotal > 0
      ? financial.normalizePercent((discountValue / subtotal) * 100)
      : 0;
    setDiscountDriver('value');
    setStrDiscountValue(masked);
    setStrDiscountPercent(financial.formatVisual(discountPercentage, '').trim());

    if (isEditingTotalNet) {
      const synchronized = applyTargetNetTotal(
        data.quantityNeeded || 0,
        parsedTotalNet,
        'value',
        discountValue,
        discountPercentage,
        {
          keepRawDiscountInput: {
            field: 'value',
            value: masked,
          },
        },
      );
      setData(prev => ({
        ...prev,
        ...synchronized,
      }));
      return;
    }

    setData(prev => ({
      ...prev,
      discountValue,
      discountPercentage,
    }));
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white dark:bg-[#0f111a] w-full max-w-4xl rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden max-h-[95vh] relative" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/5 blur-[120px] pointer-events-none"></div>
        
        <div className="p-10 pb-6 shrink-0 flex items-center justify-between z-10">
          <div className="flex items-center gap-5">
             <div className="p-4 bg-slate-100 dark:bg-slate-800/60 rounded-3xl border border-slate-200 dark:border-slate-700 text-indigo-500 shadow-xl">
                <Boxes size={28}/>
             </div>
             <div>
               <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">{editingItem ? 'Editar Insumo' : 'Novo Suprimento'}</h2>
               <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">Inteligência de Aquisições</p>
             </div>
          </div>
          <button onClick={onClose} className="p-3 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-white transition-all rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/50"><X size={24}/></button>
        </div>

        <div className="p-10 pt-0 overflow-y-auto custom-scrollbar flex-1 relative z-10 space-y-8">
           <div>
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-3 ml-1">Descrição Técnica do Material</label>
              <div className="relative">
                <input 
                  autoFocus 
                  className="w-full px-8 py-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-base font-black outline-none focus:border-indigo-600 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-800" 
                  value={data.description} 
                  onChange={e => {
                    setPauseSuggestionsUntilTyping(false);
                    setData({...data, description: e.target.value});
                  }} 
                  onKeyDown={handleDescriptionKeyDown}
                  placeholder="Ex: Cimento Portland CP-II" 
                />
                {isSearchingSuggestions && (
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                )}
              </div>

              {(isSearchingSuggestions || suggestions.length > 0) && (
                <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 overflow-hidden">
                  {visibleSuggestions.length > 0 && (
                    <div ref={suggestionsContainerRef} className="max-h-56 overflow-y-auto custom-scrollbar divide-y divide-slate-200 dark:divide-slate-800">
                      {visibleSuggestions.map((suggestion, index) => (
                        <button
                          key={suggestion.normalizedLabel}
                          type="button"
                          data-suggestion-index={index}
                          onClick={() => applySuggestion(suggestion, true)}
                          onMouseEnter={() => setHighlightedSuggestionIndex(index)}
                          className={`w-full px-4 py-3 text-left transition-all border-l-2 ${
                            highlightedSuggestionIndex === index
                              ? 'bg-white dark:bg-slate-800 border-indigo-500'
                              : 'border-transparent hover:bg-white dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{suggestion.label}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                {suggestion.unit || 'UN'} • {financial.formatVisual(suggestion.lastUnitPrice || 0, 'R$')} • {suggestion.supplierName || 'Sem fornecedor'}
                              </p>
                            </div>
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{suggestion.usageCount}x</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {visibleSuggestions.length > 0 && (
                    <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                      ↑↓ navegar • Enter aplicar • Esc fechar
                    </div>
                  )}
                </div>
              )}
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-3 ml-1">Vínculo de Fornecedor</label>
                <div className="relative">
                   <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                   <select 
                    className="w-full pl-14 pr-10 py-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-xs font-bold outline-none appearance-none focus:border-indigo-600 transition-all" 
                    value={data.supplierId} 
                    onChange={e => {
                      setManualEdited((prev) => ({ ...prev, supplierId: true }));
                      setData({...data, supplierId: e.target.value});
                    }}
                   >
                     <option value="">Não definido (Spot)</option>
                     {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                   </select>
                   <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" size={16} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-3 ml-1">Previsão de Chegada</label>
                <div className="relative">
                   <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                   <input 
                    type="date" 
                    className="w-full pl-14 pr-6 py-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-xs font-bold outline-none focus:border-indigo-600 transition-all dark:[color-scheme:dark]" 
                    value={data.estimatedDate} 
                    onChange={e => setData({...data, estimatedDate: e.target.value})} 
                   />
                </div>
              </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-3 text-center">Unidade</label>
                <input 
                  className="w-full px-4 py-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-sm font-black text-center uppercase outline-none focus:border-indigo-600" 
                  value={data.unit} 
                  onChange={e => {
                    setManualEdited((prev) => ({ ...prev, unit: true }));
                    setData({...data, unit: e.target.value});
                  }} 
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Quantidade</label>
                  <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl py-0.5 px-1">
                    <button
                      type="button"
                      onClick={() => setQuantityDecimals((prev) => financial.clampDecimals(prev - 1, MIN_QUANTITY_DECIMALS, MAX_QUANTITY_DECIMALS))}
                      className="px-2 py-0.5 text-[10px] font-black text-slate-600 dark:text-slate-200 rounded-lg hover:bg-white dark:hover:bg-slate-700"
                      title="Reduzir casas decimais"
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuantityDecimals((prev) => financial.clampDecimals(prev + 1, MIN_QUANTITY_DECIMALS, MAX_QUANTITY_DECIMALS))}
                      className="px-2 py-0.5 text-[10px] font-black text-slate-600 dark:text-slate-200 rounded-lg hover:bg-white dark:hover:bg-slate-700"
                      title="Aumentar casas decimais"
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
                <input 
                  type="text"
                  inputMode="decimal"
                  className="w-full px-4 py-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-sm font-black text-center outline-none focus:border-indigo-600" 
                  value={formatQuantityByScale(data.quantityNeeded || 0, quantityDecimals)}
                  onChange={e => {
                    const masked = financial.maskDecimal(e.target.value, quantityDecimals);
                    const nextQuantity = normalizeQuantityByScale(
                      financial.parseLocaleNumber(masked),
                      quantityDecimals,
                    );

                    if (isEditingTotalNet) {
                      const synchronized = applyTargetNetTotal(
                        nextQuantity,
                        parsedTotalNet,
                        discountDriver,
                        data.discountValue || 0,
                        data.discountPercentage || 0,
                      );
                      setData({
                        ...data,
                        quantityNeeded: nextQuantity,
                        ...synchronized,
                      });
                      return;
                    }

                    const nextDiscount = resolveDiscountFromDriver(
                      nextQuantity * (data.unitPrice || 0),
                      discountDriver,
                      data.discountValue || 0,
                      data.discountPercentage || 0,
                    );
                    setStrDiscountValue(financial.formatVisual(nextDiscount.discountValue, '').trim());
                    setStrDiscountPercent(financial.formatVisual(nextDiscount.discountPercentage, '').trim());
                    setData({
                      ...data,
                      quantityNeeded: nextQuantity,
                      discountValue: nextDiscount.discountValue,
                      discountPercentage: nextDiscount.discountPercentage,
                    });
                  }} 
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">Preço Unitário</label>
                  <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl py-0.5 px-1">
                    <button
                      type="button"
                      onClick={() => setUnitPriceDecimals((prev) => financial.clampDecimals(prev - 1, MIN_UNIT_PRICE_DECIMALS, MAX_UNIT_PRICE_DECIMALS))}
                      className="px-2 py-0.5 text-[10px] font-black text-slate-600 dark:text-slate-200 rounded-lg hover:bg-white dark:hover:bg-slate-700"
                      title="Reduzir casas decimais"
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnitPriceDecimals((prev) => financial.clampDecimals(prev + 1, MIN_UNIT_PRICE_DECIMALS, MAX_UNIT_PRICE_DECIMALS))}
                      className="px-2 py-0.5 text-[10px] font-black text-slate-600 dark:text-slate-200 rounded-lg hover:bg-white dark:hover:bg-slate-700"
                      title="Aumentar casas decimais"
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase">R$</span>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    className="w-full pl-12 pr-6 py-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-sm font-black text-right outline-none focus:border-indigo-600" 
                    value={strUnitPrice} 
                    disabled={isEditingTotalNet}
                    onChange={e => {
                      setManualEdited((prev) => ({ ...prev, unitPrice: true }));
                      const masked = financial.maskDecimal(e.target.value, unitPriceDecimals);
                      const parsedPrice = normalizeUnitPriceByScale(
                        financial.parseLocaleNumber(masked),
                        unitPriceDecimals,
                      );
                      const nextDiscount = resolveDiscountFromDriver(
                        (data.quantityNeeded || 0) * parsedPrice,
                        discountDriver,
                        data.discountValue || 0,
                        data.discountPercentage || 0,
                      );
                      setStrUnitPrice(masked);
                      setStrDiscountValue(financial.formatVisual(nextDiscount.discountValue, '').trim());
                      setStrDiscountPercent(financial.formatVisual(nextDiscount.discountPercentage, '').trim());
                      syncTotalDisplay(
                        calculateForecastNetTotal(
                          data.quantityNeeded || 0,
                          parsedPrice,
                          nextDiscount.discountValue,
                        ),
                      );
                      setData({
                        ...data,
                        unitPrice: parsedPrice,
                        discountValue: nextDiscount.discountValue,
                        discountPercentage: nextDiscount.discountPercentage,
                      });
                    }}
                    onBlur={() => syncUnitPriceDisplay(data.unitPrice || 0, unitPriceDecimals)}
                  />
                </div>
              </div>
           </div>

           <div>
             <div className="flex items-center justify-between mb-2 px-1">
               <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Total Líquido (R$)</label>
               <button
                 type="button"
                 onClick={() => {
                   const nextMode = !isEditingTotalNet;
                   setIsEditingTotalNet(nextMode);
                   if (nextMode) {
                     const currentTotal = calculateForecastNetTotal(
                       data.quantityNeeded || 0,
                       data.unitPrice || 0,
                       data.discountValue || 0,
                     );
                     syncTotalDisplay(currentTotal);
                   }
                 }}
                 className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
               >
                 {isEditingTotalNet ? 'Editar unitário' : 'Editar total'}
               </button>
             </div>
             <input
               inputMode="decimal"
               disabled={!isEditingTotalNet}
               className="w-full px-4 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 text-xs font-bold outline-none focus:border-indigo-500 transition-all disabled:opacity-70"
               value={strTotalNet}
               onChange={(e) => {
                 const nextRaw = financial.maskCurrency(e.target.value);
                 setStrTotalNet(nextRaw);

                 if (!isEditingTotalNet) return;

                 const targetTotal = financial.normalizeMoney(financial.parseLocaleNumber(nextRaw));
                 const synchronized = applyTargetNetTotal(
                   data.quantityNeeded || 0,
                   targetTotal,
                   discountDriver,
                   data.discountValue || 0,
                   data.discountPercentage || 0,
                     { keepRawTotalInput: true },
                 );
                 setData({
                   ...data,
                   ...synchronized,
                 });
               }}
               onBlur={() => {
                 const totalNet = isEditingTotalNet
                   ? financial.normalizeMoney(financial.parseLocaleNumber(strTotalNet))
                   : calculateForecastNetTotal(
                     data.quantityNeeded || 0,
                     data.unitPrice || 0,
                     data.discountValue || 0,
                   );
                 syncTotalDisplay(totalNet);
               }}
             />
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div>
               <div className="flex items-center justify-between mb-2 ml-1">
                 <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Desconto (%)</label>
                 <button
                   type="button"
                   onClick={() => setDiscountDriver('percent')}
                   className={`p-1 rounded-md border transition-colors ${
                     discountDriver === 'percent'
                       ? 'border-rose-500 text-rose-500 bg-rose-50 dark:bg-rose-900/20'
                       : 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-rose-500'
                   }`}
                   title="Fixar desconto por porcentagem"
                 >
                   <Pin size={12} />
                 </button>
               </div>
               <input
                 inputMode="decimal"
                 className="w-full px-4 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-500 text-xs font-bold outline-none focus:border-rose-500 transition-all"
                 value={strDiscountPercent}
                 onChange={e => handleDiscountChange(e.target.value, 'percent')}
               />
             </div>
             <div>
               <div className="flex items-center justify-between mb-2 ml-1">
                 <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Desconto (R$)</label>
                 <button
                   type="button"
                   onClick={() => setDiscountDriver('value')}
                   className={`p-1 rounded-md border transition-colors ${
                     discountDriver === 'value'
                       ? 'border-rose-500 text-rose-500 bg-rose-50 dark:bg-rose-900/20'
                       : 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-rose-500'
                   }`}
                   title="Fixar desconto por valor"
                 >
                   <Pin size={12} />
                 </button>
               </div>
               <input
                 inputMode="decimal"
                 className="w-full px-4 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-500 text-xs font-bold outline-none focus:border-rose-500 transition-all"
                 value={strDiscountValue}
                 onChange={e => handleDiscountChange(e.target.value, 'value')}
               />
             </div>
           </div>

           <div>
             <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2 ml-1">Memória de Cálculo</label>
             <textarea
               className="w-full px-4 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold outline-none focus:border-indigo-500 transition-all min-h-[96px] resize-y"
               value={data.calculationMemory}
               onChange={(e) => setData({ ...data, calculationMemory: e.target.value })}
               placeholder="Detalhe a memória de cálculo deste suprimento"
             />
           </div>

        </div>

        <div className="p-10 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-6 shrink-0 z-10 bg-slate-50 dark:bg-[#0f111a]/80 backdrop-blur-sm">
           <button 
            onClick={onClose} 
            className="flex-1 py-5 text-slate-500 dark:text-slate-300 font-black uppercase text-xs tracking-widest hover:text-slate-800 dark:hover:text-white transition-colors"
           >
             Cancelar
           </button>
           <button 
            onClick={() => onSave(data)} 
            disabled={!data.description} 
            className="flex-[2] py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-[0_15px_35px_-10px_rgba(79,70,229,0.5)] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed"
           >
             <Save size={20} /> {editingItem ? 'Atualizar Registro' : 'Confirmar Inclusão'}
           </button>
        </div>
      </div>
    </div>
  );
};

type SupplyGroupItemDraft = {
  id?: string;
  description: string;
  calculationMemory: string;
  unit: string;
  quantityNeeded: number;
  unitPrice: number;
  discountValue: number;
  discountPercentage: number;
  discountDriver: DiscountDriver;
  categoryId?: string | null;
  unitPriceDecimals: number;
  quantityDecimals: number;
  isEditingTotalNet: boolean;
};

const SupplyGroupModal = ({
  mode,
  projectId,
  suppliers,
  expenses,
  forecasts,
  financialCategories,
  group,
  onClose,
  onCreate,
  onUpdate,
  onDeleteGroup,
  onSyncItemFinancialGroup,
}: {
  mode: 'create' | 'edit';
  projectId: string;
  suppliers: Supplier[];
  expenses: ProjectExpense[];
  forecasts: MaterialForecast[];
  financialCategories: ProjectExpense[];
  group?: SupplyGroup;
  onClose: () => void;
  onCreate?: (payload: {
    title?: string | null;
    supplierId?: string | null;
    estimatedDate: string;
    items: Array<{
      description: string;
      calculationMemory?: string | null;
      unit: string;
      quantityNeeded: number;
      unitPrice: number;
      discountValue?: number;
      discountPercentage?: number;
      categoryId?: string | null;
    }>;
  }) => Promise<void> | void;
  onUpdate?: (
    payload: Partial<Omit<SupplyGroup, 'id' | 'forecasts'>>,
  ) => Promise<void> | void;
  onDeleteGroup?: () => Promise<void> | void;
  onSyncItemFinancialGroup?: (
    forecastId: string,
    categoryId: string | null,
    description: string,
  ) => Promise<void> | void;
}) => {
  const toast = useToast();
  const [title, setTitle] = useState(group?.title || '');
  const [supplierId, setSupplierId] = useState(group?.supplierId || '');
  const [estimatedDate, setEstimatedDate] = useState(
    (group?.estimatedDate || new Date().toISOString().split('T')[0]).split('T')[0],
  );
  const [saving, setSaving] = useState(false);
  const [draftTotalNetByRow, setDraftTotalNetByRow] = useState<Record<number, string>>({});
  const [draftDiscountPercentByRow, setDraftDiscountPercentByRow] = useState<Record<number, string>>({});
  const [draftDiscountValueByRow, setDraftDiscountValueByRow] = useState<Record<number, string>>({});
  const [expandedMemoryRows, setExpandedMemoryRows] = useState<Record<number, boolean>>({});
  const [confirmingRemoveItemIndex, setConfirmingRemoveItemIndex] = useState<number | null>(null);
  const [suggestionsByRow, setSuggestionsByRow] = useState<Record<number, MaterialSuggestion[]>>({});
  const [loadingSuggestionRow, setLoadingSuggestionRow] = useState<number | null>(null);
  const [manualEditedRows, setManualEditedRows] = useState<Record<number, { unit: boolean; unitPrice: boolean; supplierId: boolean }>>({});
  const suggestionTimersRef = useRef<Record<number, number>>({});

  const autocompleteProvider = useMemo(() => {
    const localProvider = createLocalMaterialAutocompleteProvider({
      forecasts,
      expenses,
      suppliers,
    });

    const remoteProvider = createRemoteMaterialAutocompleteProvider({
      searchMaterialSuggestions: (query: string, limit = 8) =>
        projectExpensesApi.getMaterialSuggestions(projectId, query, limit, supplierId || undefined),
    });

    return createFallbackMaterialAutocompleteProvider(remoteProvider, localProvider);
  }, [forecasts, expenses, suppliers, projectId, supplierId]);

  const [items, setItems] = useState<SupplyGroupItemDraft[]>(() => {
    if (mode === 'edit' && group?.forecasts?.length) {
      return group.forecasts.map((forecast) => ({
        id: forecast.id,
        description: forecast.description,
        calculationMemory: forecast.calculationMemory || '',
        unit: forecast.unit || 'un',
        quantityNeeded: forecast.quantityNeeded || 0,
        unitPrice: forecast.unitPrice || 0,
        discountValue: forecast.discountValue || 0,
        discountPercentage: forecast.discountPercentage || 0,
        discountDriver: 'percent',
        categoryId: forecast.categoryId || '',
        unitPriceDecimals: resolveUnitPriceScale(forecast.unitPrice || 0),
        quantityDecimals: resolveQuantityScale(forecast.quantityNeeded || 0),
        isEditingTotalNet: false,
      }));
    }

    return [
      {
        id: undefined,
        description: '',
        calculationMemory: '',
        unit: 'un',
        quantityNeeded: 1,
        unitPrice: 0,
        discountValue: 0,
        discountPercentage: 0,
        discountDriver: 'percent',
        categoryId: '',
        unitPriceDecimals: MIN_UNIT_PRICE_DECIMALS,
        quantityDecimals: MIN_QUANTITY_DECIMALS,
        isEditingTotalNet: false,
      },
    ];
  });

  const getRowTotal = (item: SupplyGroupItemDraft) => {
    return calculateForecastNetTotal(
      item.quantityNeeded || 0,
      item.unitPrice || 0,
      item.discountValue || 0,
    );
  };

  const totalAmount = useMemo(
    () => items.reduce((acc, item) => acc + getRowTotal(item), 0),
    [items],
  );

  const updateItem = <K extends keyof SupplyGroupItemDraft>(
    index: number,
    key: K,
    value: SupplyGroupItemDraft[K],
  ) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)),
    );
  };

  const markManualEdit = (
    index: number,
    key: 'unit' | 'unitPrice' | 'supplierId',
  ) => {
    setManualEditedRows((prev) => ({
      ...prev,
      [index]: {
        unit: prev[index]?.unit ?? false,
        unitPrice: prev[index]?.unitPrice ?? false,
        supplierId: prev[index]?.supplierId ?? false,
        [key]: true,
      },
    }));
  };

  const applySuggestionToRow = (index: number, suggestion: MaterialSuggestion, force = false) => {
    const manualEdited = manualEditedRows[index];
    setItems((prev) => prev.map((item, idx) => {
      if (idx !== index) return item;
      const decimals = item.unitPriceDecimals || MIN_UNIT_PRICE_DECIMALS;
      const nextUnitPrice = force || !manualEdited?.unitPrice
        ? normalizeUnitPriceByScale(suggestion.lastUnitPrice || item.unitPrice || 0, decimals)
        : item.unitPrice;
      const nextDiscount = resolveRowDiscountFromDriver(
        (item.quantityNeeded || 0) * (nextUnitPrice || 0),
        item.discountDriver,
        item.discountValue || 0,
        item.discountPercentage || 0,
      );
      return {
        ...item,
        description: force ? suggestion.label : (item.description || suggestion.label),
        calculationMemory:
          force || !(item.calculationMemory || '').trim()
            ? (suggestion.calculationMemory ?? item.calculationMemory)
            : item.calculationMemory,
        unit: force || !manualEdited?.unit ? (suggestion.unit || item.unit) : item.unit,
        unitPrice: nextUnitPrice,
        discountValue: nextDiscount.discountValue,
        discountPercentage: nextDiscount.discountPercentage,
      };
    }));
    setSuggestionsByRow((prev) => ({ ...prev, [index]: [] }));
    setLoadingSuggestionRow((prev) => (prev === index ? null : prev));
  };

  const resolveRowDiscountFromDriver = (
    subtotal: number,
    driver: DiscountDriver,
    discountValue: number,
    discountPercentage: number,
  ) => {
    if (driver === 'percent') {
      const normalizedPercentage = financial.normalizePercent(discountPercentage || 0);
      const normalizedValue = financial.normalizeMoney(subtotal * (normalizedPercentage / 100));
      return {
        discountValue: normalizedValue,
        discountPercentage: normalizedPercentage,
      };
    }

    const normalizedValue = financial.normalizeMoney(discountValue || 0);
    const normalizedPercentage = subtotal > 0
      ? financial.normalizePercent((normalizedValue / subtotal) * 100)
      : 0;
    return {
      discountValue: normalizedValue,
      discountPercentage: normalizedPercentage,
    };
  };

  const applyTargetNetTotalToRow = (item: SupplyGroupItemDraft, targetNet: number) => {
    const normalizedTarget = financial.normalizeMoney(targetNet || 0);
    let resolvedDiscountValue = financial.normalizeMoney(item.discountValue || 0);
    let resolvedDiscountPercentage = financial.normalizePercent(item.discountPercentage || 0);

    if (item.discountDriver === 'percent') {
      const factor = 1 - (resolvedDiscountPercentage / 100);
      const gross = factor > 0 ? normalizedTarget / factor : normalizedTarget;
      resolvedDiscountValue = financial.normalizeMoney(Math.max(0, gross - normalizedTarget));
    }

    const derived = deriveUnitPriceFromNetTotal(
      item.quantityNeeded || 0,
      normalizedTarget,
      resolvedDiscountValue,
    );
    const subtotal = (item.quantityNeeded || 0) * (derived.unitPrice || 0);
    const reconciled = resolveRowDiscountFromDriver(
      subtotal,
      item.discountDriver,
      resolvedDiscountValue,
      resolvedDiscountPercentage,
    );

    return {
      ...item,
      unitPrice: derived.unitPrice,
      unitPriceDecimals: derived.decimals,
      discountValue: reconciled.discountValue,
      discountPercentage: reconciled.discountPercentage,
    };
  };

  const handleItemDescriptionChange = (index: number, value: string) => {
    updateItem(index, 'description', value);

    const timer = suggestionTimersRef.current[index];
    if (timer) {
      window.clearTimeout(timer);
    }

    const query = value.trim();
    if (query.length < 2) {
      setSuggestionsByRow((prev) => ({ ...prev, [index]: [] }));
      setLoadingSuggestionRow((prev) => (prev === index ? null : prev));
      return;
    }

    setLoadingSuggestionRow(index);
    suggestionTimersRef.current[index] = window.setTimeout(async () => {
      try {
        const result = await autocompleteProvider.search(query, 6);
        const filtered = supplierId
          ? result.filter((suggestion) => !suggestion.supplierId || suggestion.supplierId === supplierId)
          : result;
        setSuggestionsByRow((prev) => ({ ...prev, [index]: filtered.slice(0, 5) }));
      } finally {
        setLoadingSuggestionRow((prev) => (prev === index ? null : prev));
      }
    }, 220);
  };

  const handleItemUnitPriceChange = (index: number, inputValue: string) => {
    markManualEdit(index, 'unitPrice');

    setItems((prev) => prev.map((item, idx) => {
      if (idx !== index) return item;
      const decimals = item.unitPriceDecimals || MIN_UNIT_PRICE_DECIMALS;
      const masked = financial.maskDecimal(inputValue, decimals);
      const parsed = normalizeUnitPriceByScale(
        financial.parseLocaleNumber(masked),
        decimals,
      );
      const subtotal = (item.quantityNeeded || 0) * parsed;
      const nextDiscount = resolveRowDiscountFromDriver(
        subtotal,
        item.discountDriver,
        item.discountValue || 0,
        item.discountPercentage || 0,
      );
      return {
        ...item,
        unitPrice: parsed,
        discountValue: nextDiscount.discountValue,
        discountPercentage: nextDiscount.discountPercentage,
      };
    }));
  };

  const handleItemDiscountChange = (index: number, inputValue: string, field: 'value' | 'percent') => {
    const masked = field === 'percent'
      ? financial.maskDecimal(inputValue, 2)
      : financial.maskCurrency(inputValue);
    const parsed = financial.parseLocaleNumber(masked);

    if (field === 'percent') {
      setDraftDiscountPercentByRow((prev) => ({ ...prev, [index]: masked }));
      setDraftDiscountValueByRow((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    } else {
      setDraftDiscountValueByRow((prev) => ({ ...prev, [index]: masked }));
      setDraftDiscountPercentByRow((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }

    setItems((prev) => prev.map((item, idx) => {
      if (idx !== index) return item;
      const subtotal = (item.quantityNeeded || 0) * (item.unitPrice || 0);

      if (field === 'percent') {
        const discountPercentage = financial.normalizePercent(parsed);
        const discountValue = financial.normalizeMoney(subtotal * (discountPercentage / 100));

        const nextItem = {
          ...item,
          discountDriver: 'percent' as DiscountDriver,
          discountPercentage,
          discountValue,
        };

        if (!item.isEditingTotalNet) return nextItem;
        const totalNet = getRowTotal(item);
        return applyTargetNetTotalToRow(nextItem, totalNet);
      }

      const discountValue = financial.normalizeMoney(parsed);
      const discountPercentage = subtotal > 0
        ? financial.normalizePercent((discountValue / subtotal) * 100)
        : 0;

      const nextItem = {
        ...item,
        discountDriver: 'value' as DiscountDriver,
        discountValue,
        discountPercentage,
      };

      if (!item.isEditingTotalNet) return nextItem;
      const totalNet = getRowTotal(item);
      return applyTargetNetTotalToRow(nextItem, totalNet);
    }));
  };

  const handleItemTotalNetChange = (index: number, inputValue: string) => {
    const masked = financial.maskCurrency(inputValue);
    setDraftTotalNetByRow((prev) => ({ ...prev, [index]: masked }));
    const target = financial.normalizeMoney(financial.parseLocaleNumber(masked));
    setItems((prev) => prev.map((item, idx) => {
      if (idx !== index) return item;
      if (!item.isEditingTotalNet) return item;
      return applyTargetNetTotalToRow(item, target);
    }));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: undefined,
        description: '',
        calculationMemory: '',
        unit: 'un',
        quantityNeeded: 1,
        unitPrice: 0,
        discountValue: 0,
        discountPercentage: 0,
        discountDriver: 'percent',
        categoryId: '',
        unitPriceDecimals: MIN_UNIT_PRICE_DECIMALS,
        quantityDecimals: MIN_QUANTITY_DECIMALS,
        isEditingTotalNet: false,
      },
    ]);
    setExpandedMemoryRows((prev) => ({ ...prev, [items.length]: false }));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
    setExpandedMemoryRows((prev) => {
      const next: Record<number, boolean> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const numeric = Number(key);
        if (!Number.isFinite(numeric)) return;
        if (numeric < index) next[numeric] = value;
        if (numeric > index) next[numeric - 1] = value;
      });
      return next;
    });
  };

  const requestRemoveItem = (index: number) => {
    setConfirmingRemoveItemIndex(index);
  };

  const normalizeItemsForSave = () =>
    items
      .map((item) => ({
        id: item.id,
        description: item.description.trim(),
        calculationMemory: (item.calculationMemory || '').trim() || null,
        unit: item.unit.trim() || 'un',
        quantityNeeded: financial.normalizeQuantity(item.quantityNeeded || 0),
        unitPrice: normalizeUnitPriceByScale(
          item.unitPrice || 0,
          item.unitPriceDecimals || MIN_UNIT_PRICE_DECIMALS,
        ),
        discountValue: financial.normalizeMoney(item.discountValue || 0),
        discountPercentage: financial.normalizePercent(item.discountPercentage || 0),
        categoryId: item.categoryId || null,
      }))
      .filter((item) => item.description.length > 0);

  const handleSave = async () => {
    if (!estimatedDate) {
      toast.warning('Informe a data prevista de chegada.');
      return;
    }

    if (mode === 'create') {
      const cleanItems = normalizeItemsForSave();
      if (cleanItems.length === 0) {
        toast.warning('Adicione ao menos um item válido ao grupo.');
        return;
      }

      if (!onCreate) return;
      setSaving(true);
      await onCreate({
        title: title.trim() || null,
        supplierId: supplierId || null,
        estimatedDate,
        items: cleanItems,
      });
      setSaving(false);
      return;
    }

    if (!onUpdate) return;
    setSaving(true);
    const cleanItems = normalizeItemsForSave();

    if (!group?.id) {
      setSaving(false);
      return;
    }

    await onUpdate({
      title: title.trim() || null,
      supplierId: supplierId || undefined,
      estimatedDate,
    });

    const originalIds = new Set((group.forecasts || []).map((forecast) => forecast.id));
    const keepIds = new Set(cleanItems.map((item) => item.id).filter(Boolean) as string[]);
    const removedIds = Array.from(originalIds).filter((id) => !keepIds.has(id));

    for (const removedId of removedIds) {
      await planningApi.deleteForecast(removedId);
    }

    for (const item of cleanItems) {
      if (item.id) {
        await planningApi.updateForecast(item.id, {
          description: item.description,
          calculationMemory: item.calculationMemory,
          unit: item.unit,
          quantityNeeded: item.quantityNeeded,
          unitPrice: item.unitPrice,
          discountValue: item.discountValue,
          discountPercentage: item.discountPercentage,
          categoryId: item.categoryId,
          supplierId: supplierId || undefined,
          estimatedDate,
        });
        await onSyncItemFinancialGroup?.(
          item.id,
          item.categoryId || null,
          item.description,
        );
        continue;
      }

      await planningApi.addItemsToSupplyGroup(group.id, [
        {
          description: item.description,
          calculationMemory: item.calculationMemory,
          unit: item.unit,
          quantityNeeded: item.quantityNeeded,
          unitPrice: item.unitPrice,
          discountValue: item.discountValue,
          discountPercentage: item.discountPercentage,
          categoryId: item.categoryId || null,
        },
      ]);
    }

    setSaving(false);
  };

  const itemPendingRemoval = confirmingRemoveItemIndex !== null
    ? items[confirmingRemoveItemIndex]
    : null;

  return (
    <>
    <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white dark:bg-[#0f111a] w-full max-w-6xl rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ReceiptText size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {mode === 'create' ? 'Novo Grupo de Suprimentos' : 'Editar Grupo de Suprimentos'}
              </h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Mesmo fluxo do pedido individual: cadastro inicial e evolução por etapa
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Título do Grupo</label>
              <input
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex: Compra semanal elétrica"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Fornecedor</label>
              <select
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
              >
                <option value="">Não definido (Spot)</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Previsão de Chegada</label>
              <input
                type="date"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                value={estimatedDate}
                onChange={(event) => setEstimatedDate(event.target.value)}
              />
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-600">Itens do Grupo</h3>
              <button onClick={addItem} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest">
                <Plus size={12} /> Linha
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-950/60">
                    <th className="p-3">Descrição</th>
                    <th className="p-3">Und</th>
                    <th className="p-3">Qtd</th>
                    <th className="p-3">Unitário</th>
                    <th className="p-3">Desconto</th>
                    <th className="p-3">Grupo Financeiro</th>
                    <th className="p-3">Total</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <React.Fragment key={item.id ? `supply-group-item-${item.id}` : `supply-group-item-${index}`}>
                    <tr className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-3">
                        <div className="relative">
                          <input
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                            value={item.description}
                            onChange={(event) => handleItemDescriptionChange(index, event.target.value)}
                          />
                          {loadingSuggestionRow === index && (
                            <Loader2 size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                          )}
                          {(suggestionsByRow[index]?.length || 0) > 0 && (
                            <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
                              {suggestionsByRow[index].map((suggestion) => (
                                <button
                                  key={`${suggestion.normalizedLabel}-${suggestion.supplierId || 'none'}`}
                                  type="button"
                                  onClick={() => applySuggestionToRow(index, suggestion, true)}
                                  className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                                >
                                  <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase">{suggestion.label}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                    {suggestion.unit || 'UN'} • {financial.formatVisual(suggestion.lastUnitPrice || 0, 'R$')} • {suggestion.supplierName || 'Sem fornecedor'}
                                  </p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 w-[90px]">
                        <input
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                          value={item.unit}
                          onChange={(event) => {
                            markManualEdit(index, 'unit');
                            updateItem(index, 'unit', event.target.value);
                          }}
                        />
                      </td>
                      <td className="p-3 w-[130px]">
                        <div className="space-y-1.5">
                          <div className="flex w-full items-center justify-between bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                            <button
                              type="button"
                              onClick={() => updateItem(index, 'quantityDecimals', financial.clampDecimals((item.quantityDecimals || MIN_QUANTITY_DECIMALS) - 1, MIN_QUANTITY_DECIMALS, MAX_QUANTITY_DECIMALS))}
                              className="px-1.5 py-1 text-slate-500 dark:text-slate-200 rounded-md hover:bg-white dark:hover:bg-slate-700"
                              title="Reduzir casas decimais"
                            >
                              <ChevronLeft size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => updateItem(index, 'quantityDecimals', financial.clampDecimals((item.quantityDecimals || MIN_QUANTITY_DECIMALS) + 1, MIN_QUANTITY_DECIMALS, MAX_QUANTITY_DECIMALS))}
                              className="px-1.5 py-1 text-slate-500 dark:text-slate-200 rounded-md hover:bg-white dark:hover:bg-slate-700"
                              title="Aumentar casas decimais"
                            >
                              <ChevronRight size={11} />
                            </button>
                          </div>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                            value={formatQuantityByScale(item.quantityNeeded || 0, item.quantityDecimals || MIN_QUANTITY_DECIMALS)}
                            onChange={(event) => {
                              const masked = financial.maskDecimal(event.target.value, item.quantityDecimals || MIN_QUANTITY_DECIMALS);
                              const quantityNeeded = normalizeQuantityByScale(
                                financial.parseLocaleNumber(masked),
                                item.quantityDecimals || MIN_QUANTITY_DECIMALS,
                              );
                              const currentTotal = getRowTotal(item);
                              const nextDiscount = resolveRowDiscountFromDriver(
                                quantityNeeded * (item.unitPrice || 0),
                                item.discountDriver,
                                item.discountValue || 0,
                                item.discountPercentage || 0,
                              );

                              setItems((prev) => prev.map((row, rowIndex) => {
                                if (rowIndex !== index) return row;
                                const nextRow = {
                                  ...row,
                                  quantityNeeded,
                                  discountPercentage: nextDiscount.discountPercentage,
                                  discountValue: nextDiscount.discountValue,
                                };
                                if (!row.isEditingTotalNet) return nextRow;
                                return applyTargetNetTotalToRow(nextRow, currentTotal);
                              }));
                            }}
                          />
                        </div>
                      </td>
                      <td className="p-3 w-[130px]">
                        <div className="space-y-1.5">
                          <div className="flex w-full items-center justify-between bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                            <button
                              type="button"
                              onClick={() => updateItem(index, 'unitPriceDecimals', financial.clampDecimals((item.unitPriceDecimals || MIN_UNIT_PRICE_DECIMALS) - 1, MIN_UNIT_PRICE_DECIMALS, MAX_UNIT_PRICE_DECIMALS))}
                              className="px-1.5 py-1 text-slate-500 dark:text-slate-200 rounded-md hover:bg-white dark:hover:bg-slate-700"
                              title="Reduzir casas decimais"
                            >
                              <ChevronLeft size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => updateItem(index, 'unitPriceDecimals', financial.clampDecimals((item.unitPriceDecimals || MIN_UNIT_PRICE_DECIMALS) + 1, MIN_UNIT_PRICE_DECIMALS, MAX_UNIT_PRICE_DECIMALS))}
                              className="px-1.5 py-1 text-slate-500 dark:text-slate-200 rounded-md hover:bg-white dark:hover:bg-slate-700"
                              title="Aumentar casas decimais"
                            >
                              <ChevronRight size={11} />
                            </button>
                          </div>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 dark:text-slate-500">R$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              disabled={item.isEditingTotalNet}
                              className="w-full pl-8 pr-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 text-right outline-none focus:border-indigo-500 disabled:opacity-70"
                              value={formatUnitPriceByScale(item.unitPrice || 0, item.unitPriceDecimals || MIN_UNIT_PRICE_DECIMALS)}
                              onChange={(event) => handleItemUnitPriceChange(index, event.target.value)}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-3 w-[120px]">
                        <div className="space-y-2">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-rose-400 dark:text-rose-500">%</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="w-full pl-6 pr-12 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] font-black text-rose-600 dark:text-rose-400 outline-none focus:border-rose-500"
                              value={draftDiscountPercentByRow[index] ?? financial.formatVisual(item.discountPercentage || 0, '').trim()}
                              onChange={(event) => handleItemDiscountChange(index, event.target.value, 'percent')}
                              onBlur={() => {
                                setDraftDiscountPercentByRow((prev) => {
                                  const next = { ...prev };
                                  delete next[index];
                                  return next;
                                });
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => updateItem(index, 'discountDriver', 'percent')}
                              className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded border ${
                                item.discountDriver === 'percent'
                                  ? 'border-rose-500 text-rose-500 bg-rose-50 dark:bg-rose-900/20'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-rose-500'
                              }`}
                              title="Fixar desconto por porcentagem"
                            >
                              <Pin size={10} />
                            </button>
                          </div>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-rose-400 dark:text-rose-500">R$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="w-full pl-7 pr-8 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] font-black text-rose-600 dark:text-rose-400 outline-none focus:border-rose-500"
                              value={draftDiscountValueByRow[index] ?? financial.formatVisual(item.discountValue || 0, '').trim()}
                              onChange={(event) => handleItemDiscountChange(index, event.target.value, 'value')}
                              onBlur={() => {
                                setDraftDiscountValueByRow((prev) => {
                                  const next = { ...prev };
                                  delete next[index];
                                  return next;
                                });
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => updateItem(index, 'discountDriver', 'value')}
                              className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded border ${
                                item.discountDriver === 'value'
                                  ? 'border-rose-500 text-rose-500 bg-rose-50 dark:bg-rose-900/20'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-rose-500'
                              }`}
                              title="Fixar desconto por valor"
                            >
                              <Pin size={10} />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 w-[220px]">
                        <select
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                          value={item.categoryId || ''}
                          onChange={(event) => updateItem(index, 'categoryId', event.target.value || '')}
                        >
                          <option value="">Sem grupo</option>
                          {financialCategories.map((category) => (
                            <option key={category.id} value={category.id}>{category.description}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3 w-[170px]">
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => updateItem(index, 'isEditingTotalNet', !item.isEditingTotalNet)}
                            className={`w-full py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                              item.isEditingTotalNet
                                ? 'bg-indigo-600 text-white border-indigo-500'
                                : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {item.isEditingTotalNet ? 'Editar unitário' : 'Editar total'}
                          </button>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-indigo-400 dark:text-indigo-500">R$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              disabled={!item.isEditingTotalNet}
                              className="w-full pl-7 pr-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-black text-indigo-600 dark:text-indigo-400 text-right outline-none focus:border-indigo-500 disabled:opacity-80"
                              value={item.isEditingTotalNet
                                ? (draftTotalNetByRow[index] ?? financial.formatVisual(getRowTotal(item), '').trim())
                                : financial.formatVisual(getRowTotal(item), '').trim()}
                              onChange={(event) => handleItemTotalNetChange(index, event.target.value)}
                              onBlur={() => {
                                setDraftTotalNetByRow((prev) => {
                                  const next = { ...prev };
                                  delete next[index];
                                  return next;
                                });
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-3 w-[64px]">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setExpandedMemoryRows((prev) => ({ ...prev, [index]: !prev[index] }))}
                            className={`p-2 rounded-lg border transition-colors ${
                              expandedMemoryRows[index]
                                ? 'text-indigo-600 border-indigo-200 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300'
                                : 'text-slate-400 border-slate-200 dark:border-slate-700 hover:text-indigo-500'
                            }`}
                            title="Memória de cálculo"
                          >
                            <FileText size={14} />
                          </button>
                          <button
                            onClick={() => requestRemoveItem(index)}
                            className="p-2 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
                            title="Remover linha"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedMemoryRows[index] && (
                      <tr className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
                        <td className="p-3" colSpan={8}>
                          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">
                            Memória de Cálculo
                          </label>
                          <textarea
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 min-h-[84px] resize-y"
                            value={item.calculationMemory}
                            onChange={(event) => updateItem(index, 'calculationMemory', event.target.value)}
                            placeholder="Detalhe a memória de cálculo deste item"
                          />
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70">
                    <td colSpan={6} className="p-3 text-right text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Total do Grupo
                    </td>
                    <td className="p-3 text-sm font-black text-indigo-700 dark:text-indigo-300">
                      {financial.formatVisual(totalAmount, 'R$')}
                    </td>
                    <td className="p-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 flex items-center gap-4">
          {mode === 'edit' && onDeleteGroup && (
            <button
              onClick={() => void onDeleteGroup()}
              className="py-3 px-4 rounded-xl text-[11px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              Remover Grupo
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            Cancelar
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-[2] py-3 rounded-xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all disabled:opacity-50"
          >
            {saving ? 'Salvando...' : mode === 'create' ? 'Criar Grupo' : 'Atualizar Grupo'}
          </button>
        </div>
      </div>
    </div>
    <ConfirmModal
      isOpen={confirmingRemoveItemIndex !== null}
      title="Remover item do grupo"
      message={`Deseja remover ${itemPendingRemoval?.description?.trim() ? `"${itemPendingRemoval.description.trim()}"` : 'este item'}? A remoção só será aplicada ao salvar o grupo.`}
      confirmLabel="Remover"
      cancelLabel="Cancelar"
      variant="warning"
      onConfirm={() => {
        if (confirmingRemoveItemIndex !== null) {
          removeItem(confirmingRemoveItemIndex);
        }
        setConfirmingRemoveItemIndex(null);
      }}
      onCancel={() => setConfirmingRemoveItemIndex(null)}
    />
    </>
  );
};

const ConvertForecastsToGroupModal = ({
  suppliers,
  selectedCount,
  onClose,
  onConvert,
}: {
  suppliers: Supplier[];
  selectedCount: number;
  onClose: () => void;
  onConvert: (payload: {
    title?: string | null;
    supplierId?: string | null;
    estimatedDate: string;
  }) => Promise<void> | void;
}) => {
  const [title, setTitle] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [estimatedDate, setEstimatedDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onConvert({
      title: title.trim() || null,
      supplierId: supplierId || null,
      estimatedDate,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[2200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white dark:bg-[#0f111a] w-full max-w-2xl rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Converter Itens em Grupo</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {selectedCount} {selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Título do Grupo</label>
              <input
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex: Compra semanal"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Fornecedor</label>
              <select
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
              >
                <option value="">Não definido (Spot)</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Previsão</label>
              <input type="date" className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500" value={estimatedDate} onChange={(event) => setEstimatedDate(event.target.value)} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Status, pagamento e baixa serão controlados na linha do grupo após a criação.
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 flex items-center gap-4">
          <button onClick={onClose} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            Cancelar
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving || selectedCount === 0}
            className="flex-[2] py-3 rounded-xl bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all disabled:opacity-50"
          >
            {saving ? 'Convertendo...' : 'Converter Itens'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SubTabBtn = ({ active, onClick, label, icon }: any) => (
  <button 
    onClick={onClick} 
    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
      active
        ? 'bg-indigo-600 text-white shadow-lg'
        : 'text-slate-400 hover:text-slate-600'
    }`}
  >
    {icon} <span>{label}</span>
  </button>
);

const ForecastKpi = ({ label, value, icon, color, sub }: any) => {
  const colors: any = {
    indigo: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-800',
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800',
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800'
  };
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <div>
        <p className={`text-xl font-black tracking-tighter ${colors[color].split(' ')[0]}`}>{financial.formatVisual(value, 'R$')}</p>
        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{sub}</p>
      </div>
    </div>
  );
};

const StatusCircle = ({ active, onClick, icon, color, label }: any) => {
  const colors: any = {
    amber: active ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-400',
    blue: active ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-400',
    emerald: active ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
  };
  return (
    <div className="group/status relative flex justify-center">
      <button 
        onClick={onClick} 
        className={`p-2 rounded-full transition-all ${colors[color]}`}
      >
        {icon}
      </button>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 bg-slate-900 text-white text-[9px] font-black uppercase rounded-lg opacity-0 group-hover/status:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl z-[100] transform group-hover/status:-translate-y-1">
        {label}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
      </span>
    </div>
  );
};

const CalendarView = ({ milestones, onEdit }: { milestones: Milestone[], onEdit: (m: Milestone) => void }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthLabel = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

  const gridDays = useMemo(() => {
    const totalDays = daysInMonth(year, month);
    const startOffset = firstDayOfMonth(year, month);
    const days = [];
    
    for (let i = 0; i < startOffset; i++) days.push(null);
    
    for (let i = 1; i <= totalDays; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayMilestones = milestones.filter(m => m.date.startsWith(dateStr));
      days.push({ day: i, milestones: dayMilestones, dateStr });
    }
    return days;
  }, [currentDate, milestones]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
        <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none">{monthLabel}</h3>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm border border-slate-200 dark:border-slate-700"><ChevronLeft size={20}/></button>
          <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 bg-white dark:bg-slate-700 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">Hoje</button>
          <button onClick={nextMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm border border-slate-200 dark:border-slate-700"><ChevronRight size={20}/></button>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-7 gap-px bg-slate-100 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden">
          {weekDays.map(d => (
            <div key={d} className="bg-white dark:bg-slate-900 py-4 text-center">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{d}</span>
            </div>
          ))}
          
          {gridDays.map((d, i) => (
            <div key={i} className={`bg-white dark:bg-slate-900 min-h-[150px] p-3 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50 ${!d ? 'opacity-30' : ''}`}>
              {d && (
                <div className="flex flex-col gap-2 h-full">
                  <span className={`text-[11px] font-black ${new Date().toDateString() === new Date(d.dateStr).toDateString() ? 'bg-indigo-600 text-white w-7 h-7 flex items-center justify-center rounded-lg shadow-lg' : 'text-slate-400'}`}>
                    {d.day}
                  </span>
                  
                  <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar flex-1 pr-1">
                    {d.milestones.map(m => (
                      <button 
                        key={m.id}
                        onClick={() => onEdit(m)}
                        className={`text-[9px] font-bold p-2 rounded-lg text-left border transition-all ${
                          m.isCompleted 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                            : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:scale-[1.02] hover:bg-indigo-100'
                        }`}
                      >
                        <div className="truncate">{m.title}</div>
                        <div className="text-[7px] opacity-60 uppercase mt-0.5">{m.isCompleted ? 'Finalizado' : 'Aguardando'}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TaskModal = ({ task, initialStatus, onClose, onSave }: any) => {
  const [desc, setDesc] = useState(task?.description || '');
  const [status, setStatus] = useState<TaskStatus>(task?.status || initialStatus || 'todo');
  const [date, setDate] = useState(task?.dueDate?.split('T')[0] || new Date().toISOString().split('T')[0]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-black mb-6 dark:text-white uppercase tracking-tight">{task ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
        <div className="space-y-4">
          <textarea autoFocus className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-bold outline-none focus:border-indigo-500 transition-all" value={desc} onChange={e => setDesc(e.target.value)} placeholder="O que precisa ser feito?" />
          <div className="grid grid-cols-2 gap-4">
            <select className="px-4 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-bold outline-none" value={status} onChange={e => setStatus(e.target.value as any)}>
              <option value="todo">Planejado</option>
              <option value="doing">Executando</option>
              <option value="done">Concluído</option>
            </select>
            <input type="date" className="px-4 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-bold outline-none dark:[color-scheme:dark]" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-8">
           <button onClick={onClose} className="flex-1 py-4 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-black uppercase text-[10px]">Cancelar</button>
           <button onClick={() => onSave({ description: desc, status, dueDate: date })} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all">Salvar</button>
        </div>
      </div>
    </div>
  );
};

const MilestoneModal = ({ milestone, onClose, onSave }: any) => {
  const [title, setTitle] = useState(milestone?.title || '');
  const [date, setDate] = useState(milestone?.date?.split('T')[0] || new Date().toISOString().split('T')[0]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-black mb-6 dark:text-white uppercase tracking-tight">{milestone ? 'Editar Meta' : 'Nova Meta'}</h2>
        <div className="space-y-4">
          <input autoFocus className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-bold outline-none focus:border-indigo-500 transition-all" value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da Meta" />
          <input type="date" className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-bold outline-none focus:border-indigo-500 transition-all" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="flex gap-3 mt-8">
           <button onClick={onClose} className="flex-1 py-4 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-black uppercase text-[10px]">Cancelar</button>
           <button onClick={() => onSave({ title, date })} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all">Salvar</button>
        </div>
      </div>
    </div>
  );
};

// --- CONFIRM PURCHASE MODAL ---
const ConfirmForecastModal = ({ forecast, onClose, onConfirm, financialCategories, onAddExpense, toast, forcePaid, initialDiscountValue = 0, initialDiscountPercentage = 0 }: any) => {
  const [parentId, setParentId] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isPaid, setIsPaid] = useState(!!forecast.isPaid);
  const [paymentProof, setPaymentProof] = useState<string | undefined>(forecast.paymentProof);
  const [confirmPaidOpen, setConfirmPaidOpen] = useState(false);
  const [localFinancialCategories, setLocalFinancialCategories] = useState<ProjectExpense[]>(financialCategories || []);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [strDiscountValue, setStrDiscountValue] = useState(financial.formatVisual(initialDiscountValue || 0, '').trim());
  const [strDiscountPercent, setStrDiscountPercent] = useState(financial.formatVisual(initialDiscountPercentage || 0, '').trim());

  const grossAmount = financial.round((forecast.quantityNeeded || 0) * (forecast.unitPrice || 0));
  const discountValueNumber = financial.parseLocaleNumber(strDiscountValue);
  const netAmount = Math.max(0, financial.round(grossAmount - discountValueNumber));

  useEffect(() => {
    if (forcePaid) {
      setIsPaid(true);
    }
  }, [forcePaid]);

  useEffect(() => {
    setStrDiscountValue(financial.formatVisual(initialDiscountValue || 0, '').trim());
    setStrDiscountPercent(financial.formatVisual(initialDiscountPercentage || 0, '').trim());
  }, [forecast.id, initialDiscountValue, initialDiscountPercentage]);

  useEffect(() => {
    setLocalFinancialCategories(financialCategories || []);
  }, [financialCategories, forecast.id]);

  const handleDiscountChange = (value: string, field: 'value' | 'percent') => {
    const masked = financial.maskCurrency(value);
    if (field === 'percent') {
      const discountPercent = financial.parseLocaleNumber(masked);
      const discountValue = financial.round(grossAmount * (discountPercent / 100));
      setStrDiscountPercent(masked);
      setStrDiscountValue(financial.formatVisual(discountValue, '').trim());
      return;
    }

    const discountValue = financial.parseLocaleNumber(masked);
    const discountPercent = grossAmount > 0 ? financial.round((discountValue / grossAmount) * 100) : 0;
    setStrDiscountValue(masked);
    setStrDiscountPercent(financial.formatVisual(discountPercent, '').trim());
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white dark:bg-[#0f111a] w-full max-w-2xl rounded-[3rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col items-center relative overflow-hidden text-center max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/10 blur-[100px] pointer-events-none"></div>
        
        <div className="relative mb-8">
           <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800/40 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700">
              <Wallet size={32} className="text-indigo-500" />
           </div>
        </div>

        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-4">Efetivar Compra</h2>
        
        <div className="space-y-6 mb-8 w-full text-center">
           <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed">
             Registrar compra de <span className="text-slate-900 dark:text-white font-bold">{forecast.description}</span> no valor de <span className="text-indigo-600 dark:text-indigo-400 font-bold">{financial.formatVisual(grossAmount, 'R$')}</span>.
           </p>
           
           <div className="text-left space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-rose-500 uppercase mb-2 block tracking-widest ml-1">Desconto (%)</label>
                    <input
                      inputMode="decimal"
                      className="w-full px-4 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-500 text-xs font-bold outline-none focus:border-rose-500 transition-all"
                      value={strDiscountPercent}
                      onChange={e => handleDiscountChange(e.target.value, 'percent')}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-rose-500 uppercase mb-2 block tracking-widest ml-1">Desconto (R$)</label>
                    <input
                      inputMode="decimal"
                      className="w-full px-4 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-500 text-xs font-bold outline-none focus:border-rose-500 transition-all"
                      value={strDiscountValue}
                      onChange={e => handleDiscountChange(e.target.value, 'value')}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Valor Líquido</span>
                  <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{financial.formatVisual(netAmount, 'R$')}</span>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 block tracking-widest ml-1">Data da Compra</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600" size={14} />
                    <input 
                      type="date"
                      className="w-full pl-10 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-xs font-bold outline-none appearance-none focus:border-indigo-600 transition-all dark:[color-scheme:dark]"
                      value={purchaseDate}
                      onChange={e => setPurchaseDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <CreditCard size={18} className={isPaid ? "text-emerald-500" : "text-slate-500"} />
                    <span className="text-[10px] font-black text-slate-800 dark:text-white uppercase">Marcar como Pago agora?</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => !forcePaid && setIsPaid(!isPaid)}
                    className={`w-12 h-6 rounded-full relative transition-all ${isPaid ? 'bg-emerald-500' : 'bg-slate-700'} ${forcePaid ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <div
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        isPaid ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {isPaid && (
                  <div className="space-y-2 animate-in slide-in-from-top-2">
                    <ExpenseAttachmentZone 
                        label="Comprovante de Pagamento"
                        requiredStatus="PAID"
                        currentFile={paymentProof}
                      onUploadUrl={(url) => setPaymentProof(url)}
                        onRemove={() => setPaymentProof(undefined)}
                    />
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase block tracking-widest ml-1">Vincular ao Grupo Financeiro (Opcional)</label>
                    <button
                      type="button"
                      onClick={() => { setIsAddingGroup(true); setNewGroupName(''); }}
                      className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-500"
                    >
                      Adicionar
                    </button>
                  </div>
                  <div className="relative">
                    <FolderTree className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600" size={14} />
                    <select 
                      className="w-full pl-10 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-xs font-bold outline-none appearance-none focus:border-indigo-600 transition-all" 
                      value={parentId || ''} 
                      onChange={e => setParentId(e.target.value || null)}
                    >
                      <option value="">Sem grupo (Raiz do Financeiro)</option>
                      {localFinancialCategories.map((c: any) => <option key={c.id} value={c.id}>{c.description}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 pointer-events-none" size={14} />
                  </div>
                  {isAddingGroup && (
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Nome do grupo"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const name = newGroupName.trim();
                          if (!name) return;
                          if (!onAddExpense) {
                            toast.error('Nao foi possivel criar o grupo financeiro.');
                            return;
                          }
                          const newCategory: ProjectExpense = {
                            id: crypto.randomUUID(),
                            parentId: null,
                            type: 'material',
                            itemType: 'category',
                            wbs: '',
                            order: localFinancialCategories.length,
                            date: new Date().toISOString().split('T')[0],
                            description: name,
                            entityName: '',
                            unit: '',
                            quantity: 0,
                            unitPrice: 0,
                            amount: 0,
                            isPaid: false,
                            status: 'PENDING',
                          };
                          setLocalFinancialCategories((prev) => [...prev, newCategory]);
                          setParentId(newCategory.id);
                          setIsAddingGroup(false);
                          setNewGroupName('');
                          onAddExpense(newCategory);
                        }}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase"
                      >
                        Criar
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsAddingGroup(false); setNewGroupName(''); }}
                        className="px-3 py-2 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:text-slate-600"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              </div>
           </div>
        </div>

          <div className="flex items-center gap-4 w-full">
            <button onClick={onClose} className="flex-1 py-4 text-slate-500 dark:text-slate-300 font-black uppercase text-xs tracking-widest hover:text-slate-800 dark:hover:text-white transition-colors">Voltar</button>
            <button 
              onClick={() => {
                if (isPaid && !paymentProof) {
                  toast.warning('Anexe o comprovante de pagamento para confirmar como pago.');
                  return;
                }
                if (forecast.status === 'pending') {
                  setConfirmPaidOpen(true);
                  return;
                }
                onConfirm(
                  isPaid,
                  parentId,
                  paymentProof,
                  purchaseDate,
                  financial.normalizeMoney(financial.parseLocaleNumber(strDiscountValue)),
                  financial.normalizePercent(financial.parseLocaleNumber(strDiscountPercent)),
                );
              }} 
              className={`flex-[2] py-4 rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all ${
                isPaid ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20 text-white' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20 text-white'
              }`}
           >
              {isPaid ? 'Confirmar e Pagar' : 'Confirmar Pedido'}
           </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmPaidOpen}
        title="Efetivar compra"
        message="Ao marcar como comprado, você não poderá voltar para a etapa de pendente. Deseja continuar?"
        confirmLabel="Efetivar"
        cancelLabel="Cancelar"
        variant="warning"
        onConfirm={() => {
          setConfirmPaidOpen(false);
          onConfirm(
            isPaid,
            parentId,
            paymentProof,
            purchaseDate,
            financial.normalizeMoney(financial.parseLocaleNumber(strDiscountValue)),
            financial.normalizePercent(financial.parseLocaleNumber(strDiscountPercent)),
          );
        }}
        onCancel={() => setConfirmPaidOpen(false)}
      />
    </div>
  );
};

// --- INLINE EDITING HELPERS ---
const InlineCurrencyInput = ({ value, onUpdate }: { value: number, onUpdate: (val: number) => void }) => {
  const [localVal, setLocalVal] = useState(financial.formatVisual(value, '').trim());
  
  useEffect(() => {
    setLocalVal(financial.formatVisual(value, '').trim());
  }, [value]);

  return (
    <div className="flex items-center justify-center gap-1.5 px-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 group hover:border-indigo-400 transition-all">
      <span className="text-[9px] font-black text-slate-400">R$</span>
      <input 
        type="text" 
        className="w-20 bg-transparent text-right text-[11px] font-black dark:text-slate-200 outline-none" 
        value={localVal}
        onChange={(e) => setLocalVal(financial.maskCurrency(e.target.value))}
        onBlur={(e) => onUpdate(financial.normalizeMoney(financial.parseLocaleNumber(e.target.value)))}
      />
    </div>
  );
};
