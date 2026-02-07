
import React, { useMemo } from 'react';
import { Cog, Shield, UserCircle2, Users } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { SettingsAccountTab } from './settings/SettingsAccountTab';
import { SettingsGlobalTab } from './settings/SettingsGlobalTab';
import { SettingsPermissionsTab } from './settings/SettingsPermissionsTab';
import { SettingsUsersTab } from './settings/SettingsUsersTab';
import { GlobalSettings } from '../types';

interface SettingsViewProps {
  settings: GlobalSettings;
  onUpdate: (s: GlobalSettings) => void;
  projectCount: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onUpdate, projectCount }) => {
  const { user } = useAuth();
  const { tab } = useParams();
  const navigate = useNavigate();

  const isAdmin = user?.roles.includes('ADMIN') || user?.roles.includes('SUPER_ADMIN') || user?.roles.includes('Gestor Principal');

  const tabs = useMemo(
    () => [
      { key: 'account', label: 'Conta', adminOnly: false, icon: <UserCircle2 size={16} /> },
      { key: 'global-settings', label: 'Configuracoes gerais', adminOnly: true, icon: <Cog size={16} /> },
      { key: 'permissions', label: 'Permissoes', adminOnly: true, icon: <Shield size={16} /> },
      { key: 'users', label: 'Usuarios', adminOnly: true, icon: <Users size={16} /> },
    ],
    [],
  );

  const availableTabs = tabs.filter((item) => !item.adminOnly || isAdmin);
  if (!tab) {
    return <Navigate to="/app/settings/account" replace />;
  }

  const activeTab = tab;
  const resolvedTab = availableTabs.some((item) => item.key === activeTab) ? activeTab : 'account';

  if (activeTab !== resolvedTab) {
    return <Navigate to={`/app/settings/${resolvedTab}`} replace />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-12 animate-in slide-in-from-bottom-4 duration-500 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-6xl mx-auto space-y-10">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl shadow-sm">
              <Cog size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white">Configuracoes da instancia</h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Gerencie conta, permissoes e preferencias globais.</p>
            </div>
          </div>
          <div className="flex flex-wrap bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {availableTabs.map((item) => (
              <button
                key={item.key}
                onClick={() => navigate(`/app/settings/${item.key}`)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  resolvedTab === item.key
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </header>

        {resolvedTab === 'account' && <SettingsAccountTab />}
        {resolvedTab === 'global-settings' && (
          <SettingsGlobalTab settings={settings} onUpdate={onUpdate} projectCount={projectCount} />
        )}
        {resolvedTab === 'permissions' && <SettingsPermissionsTab />}
        {resolvedTab === 'users' && <SettingsUsersTab />}
      </div>
    </div>
  );
};
