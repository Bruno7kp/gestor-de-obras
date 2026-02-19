
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useProjectState } from './hooks/useProjectState';
import { projectService } from './services/projectService';
import { biddingService } from './services/biddingService';
import { projectsApi } from './services/projectsApi';
import { notificationsApi } from './services/notificationsApi';
import { workItemsApi } from './services/workItemsApi';
import { measurementSnapshotsApi } from './services/measurementSnapshotsApi';
import type { GlobalSettings, Project, Supplier, UserNotification } from './types';

import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { SettingsView } from './components/SettingsView';
import { ProjectWorkspace, type TabID } from './components/ProjectWorkspace';
import { BiddingView } from './components/BiddingView';
import { SupplierManager } from './components/SupplierManager';

import { Menu } from 'lucide-react';

const PROJECT_TABS: TabID[] = [
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
];

const LAST_PROJECT_TAB_KEY = 'promeasure_last_project_tab_v1';

const resolveProjectTab = (value: string | null): TabID => {
  if (value && PROJECT_TABS.includes(value as TabID)) return value as TabID;
  return 'wbs';
};

const getTabFromPath = (pathname: string): TabID | null => {
  const match = pathname.match(/^\/app\/projects\/[^/]+\/([^/]+)/);
  if (!match) return null;
  return PROJECT_TABS.includes(match[1] as TabID) ? (match[1] as TabID) : null;
};

type ProjectRouteProps = {
  activeProject: Project | null;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  suppliers: Supplier[];
  safeGlobalSettings: GlobalSettings;
  externalProjectIds: Set<string>;
  updateActiveProject: (data: Partial<Project>) => void;
  handleCloseMeasurement: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  notifications: UserNotification[];
  notificationsLoading: boolean;
  unreadNotificationsCount: number;
  onRefreshNotifications: () => Promise<void>;
  onMarkNotificationRead: (id: string) => Promise<void>;
  onMarkAllNotificationsRead: () => Promise<void>;
};

const ProjectRoute: React.FC<ProjectRouteProps> = ({
  activeProject,
  activeProjectId,
  setActiveProjectId,
  suppliers,
  safeGlobalSettings,
  externalProjectIds,
  updateActiveProject,
  handleCloseMeasurement,
  canUndo,
  canRedo,
  undo,
  redo,
  notifications,
  notificationsLoading,
  unreadNotificationsCount,
  onRefreshNotifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
}) => {
  const { projectId, tab } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (projectId && projectId !== activeProjectId) {
      setActiveProjectId(projectId);
    }
  }, [projectId, activeProjectId, setActiveProjectId]);

  if (!projectId) {
    return <Navigate to="/app/dashboard" replace />;
  }

  if (!tab) {
    const savedTab = resolveProjectTab(localStorage.getItem(LAST_PROJECT_TAB_KEY));
    return <Navigate to={`/app/projects/${projectId}/${savedTab}`} replace />;
  }

  const resolvedTab = PROJECT_TABS.includes(tab as TabID) ? (tab as TabID) : 'wbs';

  if (tab !== resolvedTab) {
    const savedTab = resolveProjectTab(localStorage.getItem(LAST_PROJECT_TAB_KEY));
    return <Navigate to={`/app/projects/${projectId}/${savedTab}`} replace />;
  }

  if (!activeProject || activeProject.id !== projectId) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
        Carregando obra...
      </div>
    );
  }

  return (
    <ProjectWorkspace
      project={activeProject}
      globalSettings={safeGlobalSettings as any}
      suppliers={suppliers}
      isExternalProject={externalProjectIds.has(projectId)}
      onUpdateProject={updateActiveProject}
      onCloseMeasurement={handleCloseMeasurement}
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={undo}
      onRedo={redo}
      activeTab={resolvedTab}
      onTabChange={(nextTab) => navigate(`/app/projects/${projectId}/${nextTab}`)}
      notifications={notifications}
      notificationsLoading={notificationsLoading}
      unreadNotificationsCount={unreadNotificationsCount}
      onRefreshNotifications={onRefreshNotifications}
      onMarkNotificationRead={onMarkNotificationRead}
      onMarkAllNotificationsRead={onMarkAllNotificationsRead}
    />
  );
};

const App: React.FC = () => {
  const { 
    projects, biddings, groups, suppliers, activeProject, activeProjectId, setActiveProjectId, 
    globalSettings, setGlobalSettings, externalProjects,
    updateActiveProject, updateProjects, updateGroups, updateSuppliers, updateBiddings, updateCertificates, bulkUpdate,
    undo, redo, canUndo, canRedo
  } = useProjectState();

  const safeGlobalSettings = globalSettings || {
    defaultCompanyName: 'Sua Empresa de Engenharia',
    companyCnpj: '',
    userName: 'Usuário',
    language: 'pt-BR',
    currencySymbol: 'R$',
    certificates: []
  };
  const externalProjectIds = useMemo(
    () => new Set(externalProjects.map(ep => ep.projectId)),
    [externalProjects],
  );

  const isActiveExternal = useMemo(
    () => !!activeProjectId && externalProjectIds.has(activeProjectId),
    [activeProjectId, externalProjectIds],
  );

  // Projects without the externally-loaded ones (they only show in "Compartilhado")
  const ownProjects = useMemo(
    () => projects.filter(p => !externalProjectIds.has(p.id)),
    [projects, externalProjectIds],
  );
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('promeasure_theme') === 'dark');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [isClosingMeasurement, setIsClosingMeasurement] = useState(false);
  const [unreadNotificationsByProject, setUnreadNotificationsByProject] = useState<Record<string, number>>({});
  const [projectNotifications, setProjectNotifications] = useState<UserNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const allVisibleProjectIds = useMemo(
    () => Array.from(new Set([...ownProjects.map((project) => project.id), ...externalProjects.map((project) => project.projectId)])),
    [ownProjects, externalProjects],
  );

  useEffect(() => {
    const tabFromPath = getTabFromPath(location.pathname);
    if (tabFromPath) {
      localStorage.setItem(LAST_PROJECT_TAB_KEY, tabFromPath);
    }
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem('promeasure_theme', isDarkMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const handleOpenProject = useCallback((id: string) => {
    setActiveProjectId(id);
    const savedTab = resolveProjectTab(localStorage.getItem(LAST_PROJECT_TAB_KEY));
    navigate(`/app/projects/${id}/${savedTab}`);
    setMobileMenuOpen(false);
  }, [setActiveProjectId, navigate]);

  const handleBackToDashboard = useCallback(() => {
    setActiveProjectId(null);
    navigate('/app/dashboard');
  }, [setActiveProjectId, navigate]);

  const refreshUnreadCounts = useCallback(async () => {
    if (allVisibleProjectIds.length === 0) {
      setUnreadNotificationsByProject({});
      return;
    }

    try {
      const entries = await Promise.all(
        allVisibleProjectIds.map(async (projectId) => {
          const unread = await notificationsApi.list({ projectId, unreadOnly: true, limit: 200 });
          return [projectId, unread.length] as const;
        }),
      );
      setUnreadNotificationsByProject(Object.fromEntries(entries));
    } catch {
      setUnreadNotificationsByProject({});
    }
  }, [allVisibleProjectIds]);

  const refreshActiveProjectNotifications = useCallback(async () => {
    if (!activeProjectId) {
      setProjectNotifications([]);
      return;
    }

    setNotificationsLoading(true);
    try {
      const data = await notificationsApi.list({ projectId: activeProjectId, limit: 200 });
      setProjectNotifications(data);
      setUnreadNotificationsByProject((prev) => ({
        ...prev,
        [activeProjectId]: data.filter((notification) => !notification.isRead).length,
      }));
    } catch {
      setProjectNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  }, [activeProjectId]);

  const handleMarkNotificationRead = useCallback(async (id: string) => {
    await notificationsApi.markRead(id);
    setProjectNotifications((prev) => {
      const current = prev.find((notification) => notification.id === id);
      const next = prev.map((notification) =>
        notification.id === id ? { ...notification, isRead: true, readAt: new Date().toISOString() } : notification,
      );

      if (activeProjectId && current && !current.isRead) {
        setUnreadNotificationsByProject((counts) => ({
          ...counts,
          [activeProjectId]: Math.max(0, (counts[activeProjectId] ?? 0) - 1),
        }));
      }

      return next;
    });
  }, [activeProjectId]);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    if (!activeProjectId) return;
    await notificationsApi.markAllRead(activeProjectId);
    setProjectNotifications((prev) => prev.map((notification) => ({
      ...notification,
      isRead: true,
      readAt: notification.readAt ?? new Date().toISOString(),
    })));
    setUnreadNotificationsByProject((prev) => ({
      ...prev,
      [activeProjectId]: 0,
    }));
  }, [activeProjectId]);

  useEffect(() => {
    void refreshUnreadCounts();
  }, [refreshUnreadCounts]);

  useEffect(() => {
    void refreshActiveProjectNotifications();
  }, [refreshActiveProjectNotifications]);

  const handleCloseMeasurement = useCallback(async () => {
    if (!activeProject || isClosingMeasurement) return;
    setIsClosingMeasurement(true);

    try {
      const updated = projectService.closeMeasurement(activeProject);
      updateActiveProject(updated);

      const snapshot = updated.history?.[0];
      if (snapshot) {
        try {
          await measurementSnapshotsApi.create(activeProject.id, snapshot);
        } catch (error) {
          console.error('Erro ao salvar snapshot:', error);
        }
      }

      try {
        await projectsApi.update(activeProject.id, {
          measurementNumber: updated.measurementNumber,
          referenceDate: updated.referenceDate,
        });
      } catch (error) {
        console.error('Erro ao atualizar medição do projeto:', error);
      }

      try {
        await Promise.all(
          updated.items.map(item =>
            workItemsApi.update(item.id, {
              parentId: item.parentId,
              order: item.order,
              wbs: item.wbs,
              contractQuantity: item.contractQuantity,
              unitPrice: item.unitPrice,
              unitPriceNoBdi: item.unitPriceNoBdi,
              contractTotal: item.contractTotal,
              previousQuantity: item.previousQuantity,
              previousTotal: item.previousTotal,
              currentQuantity: item.currentQuantity,
              currentTotal: item.currentTotal,
              currentPercentage: item.currentPercentage,
              accumulatedQuantity: item.accumulatedQuantity,
              accumulatedTotal: item.accumulatedTotal,
              accumulatedPercentage: item.accumulatedPercentage,
              balanceQuantity: item.balanceQuantity,
              balanceTotal: item.balanceTotal,
            }),
          ),
        );
      } catch (error) {
        console.error('Erro ao atualizar itens apos fechamento:', error);
      }
    } finally {
      setIsClosingMeasurement(false);
    }
  }, [activeProject, isClosingMeasurement, updateActiveProject]);

  const handleCreateProject = useCallback(async (groupId?: string | null) => {
    try {
      const newProj = await projectsApi.create({
        name: 'Nova Obra',
        companyName: safeGlobalSettings.defaultCompanyName,
        groupId: groupId || null,
      });
      updateProjects([...projects, newProj]);
      handleOpenProject(newProj.id);
    } catch (error) {
      console.error('Erro ao criar projeto:', error);
    }
  }, [projects, safeGlobalSettings.defaultCompanyName, updateProjects, handleOpenProject]);

  const handleCreateProjectFromBidding = useCallback((bidding: any) => {
    const newProj = biddingService.convertToProject(bidding, safeGlobalSettings.defaultCompanyName);
    updateProjects([...projects, newProj]);
    handleOpenProject(newProj.id);
  }, [projects, safeGlobalSettings.defaultCompanyName, updateProjects, handleOpenProject]);

  const headerTitle = useMemo(() => {
    if (location.pathname.startsWith('/app/biddings')) return 'Setor de Licitações';
    if (location.pathname.startsWith('/app/suppliers')) return 'Base de Fornecedores';
    if (location.pathname.startsWith('/app/settings')) return 'Configurações de Sistema';
    if (location.pathname.startsWith('/app/projects')) return 'Obra em Gestão';
    return 'Portal de Obras';
  }, [location.pathname]);

  return (
    <div className={`flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 ${isDarkMode ? 'dark' : ''}`}>
      
      <Sidebar 
        isOpen={sidebarOpen} setIsOpen={setSidebarOpen}
        mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen}
        projects={ownProjects} groups={groups} activeProjectId={activeProjectId}
        isActiveExternal={isActiveExternal}
        externalProjects={externalProjects}
        onOpenProject={handleOpenProject} onCreateProject={handleCreateProject}
        onBackToDashboard={handleBackToDashboard}
        isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        certificates={safeGlobalSettings.certificates}
        unreadNotificationsByProject={unreadNotificationsByProject}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="no-print lg:hidden h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 shrink-0 z-50">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-slate-600 dark:text-slate-300"><Menu size={24} /></button>
          <span className="ml-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 truncate">
            {headerTitle}
          </span>
        </header>
        <Routes>
          <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <DashboardView
                projects={ownProjects}
                groups={groups}
                externalProjects={externalProjects}
                onOpenProject={handleOpenProject}
                onCreateProject={handleCreateProject}
                onUpdateProject={updateProjects}
                onUpdateGroups={updateGroups}
                onBulkUpdate={bulkUpdate}
                unreadNotificationsByProject={unreadNotificationsByProject}
              />
            }
          />
          <Route
            path="biddings"
            element={
              <BiddingView
                biddings={biddings}
                certificates={safeGlobalSettings.certificates}
                onUpdateBiddings={updateBiddings}
                onUpdateCertificates={updateCertificates}
                onCreateProjectFromBidding={handleCreateProjectFromBidding}
              />
            }
          />
          <Route
            path="suppliers"
            element={<SupplierManager suppliers={suppliers} projects={projects} onUpdateSuppliers={updateSuppliers} />}
          />
          <Route
            path="settings/:tab?"
            element={<SettingsView settings={safeGlobalSettings as any} onUpdate={setGlobalSettings} projectCount={projects.length} />}
          />
          <Route
            path="projects/:projectId/:tab?"
            element={
              <ProjectRoute
                activeProject={activeProject}
                activeProjectId={activeProjectId}
                setActiveProjectId={setActiveProjectId}
                suppliers={suppliers}
                safeGlobalSettings={safeGlobalSettings as GlobalSettings}
                externalProjectIds={externalProjectIds}
                updateActiveProject={updateActiveProject}
                handleCloseMeasurement={handleCloseMeasurement}
                canUndo={canUndo}
                canRedo={canRedo}
                undo={undo}
                redo={redo}
                notifications={projectNotifications}
                notificationsLoading={notificationsLoading}
                unreadNotificationsCount={activeProjectId ? (unreadNotificationsByProject[activeProjectId] ?? 0) : 0}
                onRefreshNotifications={refreshActiveProjectNotifications}
                onMarkNotificationRead={handleMarkNotificationRead}
                onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
              />
            }
          />
          <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
