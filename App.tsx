
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useProjectState } from './hooks/useProjectState';
import { projectService } from './services/projectService';
import { biddingService } from './services/biddingService';
import { projectsApi } from './services/projectsApi';
import { workItemsApi } from './services/workItemsApi';
import { measurementSnapshotsApi } from './services/measurementSnapshotsApi';

import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { SettingsView } from './components/SettingsView';
import { ProjectWorkspace, type TabID } from './components/ProjectWorkspace';
import { BiddingView } from './components/BiddingView';
import { SupplierManager } from './components/SupplierManager';

import { Menu } from 'lucide-react';

const App: React.FC = () => {
  const { 
    projects, biddings, groups, suppliers, activeProject, activeProjectId, setActiveProjectId, 
    globalSettings, setGlobalSettings,
    updateActiveProject, updateProjects, updateGroups, updateSuppliers, updateBiddings, updateCertificates, bulkUpdate,
    undo, redo, canUndo, canRedo
  } = useProjectState();

  const safeGlobalSettings = globalSettings || {
    defaultCompanyName: 'Sua Empresa de Engenharia',
    companyCnpj: '',
    userName: 'Usuário ProMeasure',
    language: 'pt-BR',
    currencySymbol: 'R$',
    certificates: []
  };

  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('promeasure_theme') === 'dark');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const projectTabs: TabID[] = [
    'wbs',
    'stats',
    'expenses',
    'workforce',
    'labor-contracts',
    'planning',
    'journal',
    'documents',
    'branding',
  ];

  useEffect(() => {
    localStorage.setItem('promeasure_theme', isDarkMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const handleOpenProject = useCallback((id: string) => {
    setActiveProjectId(id);
    navigate(`/app/projects/${id}/wbs`);
    setMobileMenuOpen(false);
  }, [setActiveProjectId, navigate]);

  const handleCloseMeasurement = useCallback(async () => {
    if (!activeProject) return;
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
      console.error('Erro ao atualizar medicao do projeto:', error);
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
  }, [activeProject, updateActiveProject]);

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

  const ProjectRoute: React.FC = () => {
    const { projectId, tab } = useParams();

    useEffect(() => {
      if (projectId && projectId !== activeProjectId) {
        setActiveProjectId(projectId);
      }
    }, [projectId, activeProjectId, setActiveProjectId]);

    if (!projectId) {
      return <Navigate to="/app/dashboard" replace />;
    }

    if (!tab) {
      return <Navigate to={`/app/projects/${projectId}/wbs`} replace />;
    }

    const resolvedTab = projectTabs.includes(tab as TabID) ? (tab as TabID) : 'wbs';

    if (tab !== resolvedTab) {
      return <Navigate to={`/app/projects/${projectId}/wbs`} replace />;
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
        onUpdateProject={updateActiveProject}
        onCloseMeasurement={handleCloseMeasurement}
        canUndo={canUndo} 
        canRedo={canRedo} 
        onUndo={undo} 
        onRedo={redo}
        activeTab={resolvedTab}
        onTabChange={(nextTab) => navigate(`/app/projects/${projectId}/${nextTab}`)}
      />
    );
  };

  return (
    <div className={`flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 ${isDarkMode ? 'dark' : ''}`}>
      
      <Sidebar 
        isOpen={sidebarOpen} setIsOpen={setSidebarOpen}
        mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen}
        projects={projects} groups={groups} activeProjectId={activeProjectId}
        onOpenProject={handleOpenProject} onCreateProject={handleCreateProject}
        isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        certificates={safeGlobalSettings.certificates}
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
                projects={projects}
                groups={groups}
                onOpenProject={handleOpenProject}
                onCreateProject={handleCreateProject}
                onUpdateProject={updateProjects}
                onUpdateGroups={updateGroups}
                onBulkUpdate={bulkUpdate}
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
            element={<SupplierManager suppliers={suppliers} onUpdateSuppliers={updateSuppliers} />}
          />
          <Route
            path="settings/:tab?"
            element={<SettingsView settings={safeGlobalSettings as any} onUpdate={setGlobalSettings} projectCount={projects.length} />}
          />
          <Route path="projects/:projectId/:tab?" element={<ProjectRoute />} />
          <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
