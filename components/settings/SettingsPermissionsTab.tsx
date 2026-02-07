import React, { useEffect, useMemo, useState } from 'react';
import { PlusCircle, RefreshCw, Save, Trash2 } from 'lucide-react';
import type { PermissionLevel, Role } from '../../types';
import { rolesApi } from '../../services/rolesApi';
import { useToast } from '../../hooks/useToast';

const PERMISSION_MODULES = [
  { key: 'biddings', label: 'Licitacoes' },
  { key: 'suppliers', label: 'Fornecedores' },
  { key: 'projects_general', label: 'Obras gerais' },
  { key: 'projects_specific', label: 'Obras especificas' },
  { key: 'wbs', label: 'Planilha EAP' },
  { key: 'technical_analysis', label: 'Analise Tecnica' },
  { key: 'financial_flow', label: 'Fluxo Financeiro' },
  { key: 'supplies', label: 'Suprimentos' },
  { key: 'workforce', label: 'Mao de Obra' },
  { key: 'planning', label: 'Planejamento' },
  { key: 'journal', label: 'Diario de Obra' },
  { key: 'documents', label: 'Documentos' },
  { key: 'project_settings', label: 'Ajustes do projeto' },
  { key: 'global_settings', label: 'Configuracoes gerais' },
];

const DEFAULT_ROLE_NAMES = new Set(['Gestor Principal', 'Gestor de Suprimentos', 'Arquiteto']);
const SYSTEM_ROLE_NAMES = new Set(['ADMIN', 'SUPER_ADMIN']);

const resolveLevel = (role: Role, moduleKey: string): PermissionLevel => {
  const codes = new Set((role.permissions ?? []).map((permission) => permission.code));
  if (codes.has(`${moduleKey}.edit`)) return 'edit';
  if (codes.has(`${moduleKey}.view`)) return 'view';
  return 'none';
};

const buildCodes = (levels: Record<string, PermissionLevel>) => {
  const codes: string[] = [];
  PERMISSION_MODULES.forEach((module) => {
    const level = levels[module.key] ?? 'none';
    if (level === 'view' || level === 'edit') {
      codes.push(`${module.key}.view`);
    }
    if (level === 'edit') {
      codes.push(`${module.key}.edit`);
    }
  });
  return codes;
};

export const SettingsPermissionsTab: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [levels, setLevels] = useState<Record<string, Record<string, PermissionLevel>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resettingDefaults, setResettingDefaults] = useState(false);
  const toast = useToast();

  const visibleRoles = useMemo(() => roles.filter((role) => !SYSTEM_ROLE_NAMES.has(role.name)), [roles]);

  const hydrateLevels = (items: Role[]) => {
    const next: Record<string, Record<string, PermissionLevel>> = {};
    items.forEach((role) => {
      next[role.id] = PERMISSION_MODULES.reduce((acc, module) => {
        acc[module.key] = resolveLevel(role, module.key);
        return acc;
      }, {} as Record<string, PermissionLevel>);
    });
    setLevels(next);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await rolesApi.list();
        if (!mounted) return;
        setRoles(data);
        hydrateLevels(data);
      } catch (err) {
        console.error('Erro ao carregar tipos de usuario:', err);
        setError('Nao foi possivel carregar os tipos de usuario.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const handleLevelChange = (roleId: string, moduleKey: string, level: PermissionLevel) => {
    setLevels((prev) => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [moduleKey]: level,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updates = await Promise.all(
        visibleRoles.map((role) => rolesApi.setPermissions(role.id, buildCodes(levels[role.id] ?? {}))),
      );
      const merged = roles.map((role) => updates.find((updated) => updated.id === role.id) ?? role);
      setRoles(merged);
      hydrateLevels(merged);
      toast.success('Alteracoes salvas com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar permissoes:', err);
      setError('Nao foi possivel salvar as permissoes.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      setError('Informe um nome para o tipo de usuario.');
      return;
    }
    try {
      const created = await rolesApi.create({
        name: newRoleName.trim(),
        description: newRoleDescription.trim() || undefined,
      });
      const updatedRoles = [...roles, created];
      setRoles(updatedRoles);
      hydrateLevels(updatedRoles);
      setNewRoleName('');
      setNewRoleDescription('');
    } catch (err) {
      console.error('Erro ao criar tipo de usuario:', err);
      setError('Nao foi possivel criar o tipo de usuario.');
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    const target = roles.find((role) => role.id === roleId);
    if (!target) return;
    const confirmed = window.confirm(`Deseja remover o tipo de usuario ${target.name}?`);
    if (!confirmed) return;

    try {
      await rolesApi.remove(roleId);
      const nextRoles = roles.filter((role) => role.id !== roleId);
      setRoles(nextRoles);
      hydrateLevels(nextRoles);
    } catch (err) {
      console.error('Erro ao remover tipo de usuario:', err);
      setError('Nao foi possivel remover o tipo de usuario.');
    }
  };

  const handleResetDefaults = () => {
    setShowResetModal(true);
  };

  const confirmResetDefaults = async () => {
    setResettingDefaults(true);
    try {
      const updated = await rolesApi.resetDefaults();
      setRoles(updated);
      hydrateLevels(updated);
      setShowResetModal(false);
      toast.success('Tipos de usuario restaurados com sucesso!');
    } catch (err) {
      console.error('Erro ao resetar tipos de usuario:', err);
      setError('Nao foi possivel restaurar os tipos de usuario padrao.');
    } finally {
      setResettingDefaults(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-400">
        Carregando permissoes...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div className="space-y-2">
          <h3 className="text-xl font-black text-slate-800 dark:text-white">Permissoes por tipo de usuario</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Defina o nivel de acesso de cada papel da sua instancia.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw size={14} />
            Reverter Padrao
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            {saving ? 'Salvando...' : 'Salvar Alteracoes'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Novo tipo de usuario</h4>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-4">
          <input
            className="px-5 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none"
            placeholder="Nome do tipo de usuario"
            value={newRoleName}
            onChange={(event) => setNewRoleName(event.target.value)}
          />
          <input
            className="px-5 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none"
            placeholder="Descricao (opcional)"
            value={newRoleDescription}
            onChange={(event) => setNewRoleDescription(event.target.value)}
          />
          <button
            onClick={handleCreateRole}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white shadow-lg hover:scale-105 active:scale-95 transition-all"
          >
            <PlusCircle size={14} /> Criar
          </button>
        </div>
        {error && <div className="text-xs font-semibold text-rose-500">{error}</div>}
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
        <table className="min-w-[1200px] w-full text-left text-[11px]">
          <thead className="text-[10px] uppercase tracking-widest text-slate-400">
            <tr>
              <th className="py-3 pr-4">Tipo de Usuario</th>
              {PERMISSION_MODULES.map((module) => (
                <th key={module.key} className="py-3 px-3 whitespace-nowrap">
                  {module.label}
                </th>
              ))}
              <th className="py-3 pl-4">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibleRoles.map((role) => (
              <tr key={role.id} className="text-slate-700 dark:text-slate-200">
                <td className="py-4 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-black">{role.name}</span>
                    {DEFAULT_ROLE_NAMES.has(role.name) && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-600">Padrao</span>
                    )}
                  </div>
                  {role.description && (
                    <div className="text-[10px] text-slate-400 mt-1">{role.description}</div>
                  )}
                </td>
                {PERMISSION_MODULES.map((module) => (
                  <td key={`${role.id}-${module.key}`} className="py-3 px-3">
                    <select
                      className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-[10px] font-black uppercase tracking-widest px-3 py-2 outline-none"
                      value={levels[role.id]?.[module.key] ?? 'none'}
                      onChange={(event) => handleLevelChange(role.id, module.key, event.target.value as PermissionLevel)}
                    >
                      <option value="none">Sem</option>
                      <option value="view">Ver</option>
                      <option value="edit">Editar</option>
                    </select>
                  </td>
                ))}
                <td className="py-3 pl-4">
                  <button
                    onClick={() => handleRemoveRole(role.id)}
                    className="text-rose-500 hover:text-rose-400"
                    title="Remover"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showResetModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-lg p-8 max-w-md z-[10000]">
            <h3 className="text-lg font-black text-slate-800 dark:text-white mb-3">Restaurar tipos de usuario padrao?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
              Deseja restaurar os tipos de usuario padrao? Isso remove todos os tipos de usuario personalizados.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetModal(false)}
                disabled={resettingDefaults}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={confirmResetDefaults}
                disabled={resettingDefaults}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-rose-600 text-white shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {resettingDefaults ? 'Restaurando...' : 'Restaurar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
