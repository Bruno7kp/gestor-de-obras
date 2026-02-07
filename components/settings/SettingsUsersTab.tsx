import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, Lock, Mail, PlusCircle, Shield, UserCircle2, UserX, UserCheck } from 'lucide-react';
import type { Role, UserAccount } from '../../types';
import { rolesApi } from '../../services/rolesApi';
import { usersApi } from '../../services/usersApi';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../hooks/useToast';

const SYSTEM_ROLE_NAMES = new Set(['ADMIN', 'SUPER_ADMIN']);
const EMAIL_REGEX = /.+@.+\..+/i;
const MIN_PASSWORD_LENGTH = 8;

export const SettingsUsersTab: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    roleId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [userToToggle, setUserToToggle] = useState<UserAccount | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [usersData, rolesData] = await Promise.all([usersApi.list(), rolesApi.list()]);
        if (!mounted) return;
        setUsers(usersData);
        setRoles(rolesData);
      } catch (err) {
        console.error('Erro ao carregar usuarios:', err);
        setError('Nao foi possivel carregar usuarios.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const roleOptions = useMemo(() => roles, [roles]);

  const handleRoleChange = async (entry: UserAccount, roleId: string) => {
    setSavingUserId(entry.id);
    setError(null);
    try {
      const systemRoleIds = (entry.roles ?? [])
        .filter((role) => SYSTEM_ROLE_NAMES.has(role.name))
        .map((role) => role.id);
      const roleIds = Array.from(new Set([roleId, ...systemRoleIds].filter(Boolean)));
      const updated = await usersApi.setRoles(entry.id, roleIds);
      setUsers((prev) => prev.map((item) => (item.id === entry.id ? updated : item)));
      toast.success('Tipo de usuario atualizado!');
    } catch (err) {
      console.error('Erro ao atualizar roles:', err);
      toast.error('Nao foi possivel atualizar o tipo de usuario.');
    } finally {
      setSavingUserId(null);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setUserForm({ name: '', email: '', password: '', roleId: '' });
    setShowUserModal(true);
  };

  const handleOpenEditModal = (entry: UserAccount) => {
    setEditingUser(entry);
    setUserForm({
      name: entry.name ?? '',
      email: entry.email ?? '',
      password: '',
      roleId: entry.roles?.[0]?.id ?? '',
    });
    setShowUserModal(true);
  };

  const handleCloseModal = () => {
    setShowUserModal(false);
    setEditingUser(null);
    setError(null);
  };

  const handleSubmitUser = async () => {
    setError(null);

    if (!userForm.name.trim()) {
      setError('Informe o nome do usuario.');
      return;
    }

    if (!EMAIL_REGEX.test(userForm.email)) {
      setError('Informe um email valido.');
      return;
    }

    if (!editingUser && userForm.password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha deve ter no minimo ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (editingUser && userForm.password && userForm.password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha deve ter no minimo ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    setSubmitting(true);
    try {
      if (editingUser) {
        // Atualiza dados do usuário
        const updateData: any = {
          name: userForm.name.trim(),
          email: userForm.email.trim(),
        };
        if (userForm.password) {
          updateData.password = userForm.password;
        }
        
        const updated = await usersApi.updateUser(editingUser.id, updateData);
        
        // Atualiza o tipo de usuário
        if (userForm.roleId) {
          const systemRoleIds = (editingUser.roles ?? [])
            .filter((role) => SYSTEM_ROLE_NAMES.has(role.name))
            .map((role) => role.id);
          const roleIds = Array.from(new Set([userForm.roleId, ...systemRoleIds].filter(Boolean)));
          const withRoles = await usersApi.setRoles(editingUser.id, roleIds);
          setUsers((prev) => prev.map((item) => (item.id === editingUser.id ? withRoles : item)));
        } else {
          // Remove roles não-sistema
          const systemRoleIds = (editingUser.roles ?? [])
            .filter((role) => SYSTEM_ROLE_NAMES.has(role.name))
            .map((role) => role.id);
          const withRoles = await usersApi.setRoles(editingUser.id, systemRoleIds);
          setUsers((prev) => prev.map((item) => (item.id === editingUser.id ? withRoles : item)));
        }
        
        toast.success('Usuario atualizado com sucesso!');
      } else {
        const created = await usersApi.create({
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          password: userForm.password,
          roleIds: userForm.roleId ? [userForm.roleId] : [],
        });
        
        // Se um tipo de usuário foi selecionado e não veio nas roles, atribui novamente
        if (userForm.roleId && (!created.roles || created.roles.length === 0)) {
          const withRoles = await usersApi.setRoles(created.id, [userForm.roleId]);
          setUsers((prev) => [...prev, withRoles]);
        } else {
          setUsers((prev) => [...prev, created]);
        }
        
        toast.success('Usuario criado com sucesso!');
      }
      handleCloseModal();
    } catch (err) {
      console.error('Erro ao salvar usuario:', err);
      setError(editingUser ? 'Nao foi possivel atualizar o usuario.' : 'Nao foi possivel criar o usuario.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenToggleModal = (entry: UserAccount) => {
    setUserToToggle(entry);
    setShowToggleModal(true);
  };

  const handleCloseToggleModal = () => {
    setShowToggleModal(false);
    setUserToToggle(null);
  };

  const handleConfirmToggleStatus = async () => {
    if (!userToToggle) return;

    const action = userToToggle.status === 'ACTIVE' ? 'desativar' : 'ativar';

    try {
      const updated = await usersApi.toggleStatus(userToToggle.id);
      setUsers((prev) => prev.map((item) => (item.id === userToToggle.id ? updated : item)));
      toast.success(`Usuario ${action === 'desativar' ? 'desativado' : 'ativado'} com sucesso!`);
      handleCloseToggleModal();
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      toast.error('Nao foi possivel alterar o status do usuario.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-400">
        Carregando usuarios...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div className="space-y-2">
          <h3 className="text-xl font-black text-slate-800 dark:text-white">Usuários da instância</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie quem acessa o sistema e quais papeis cada pessoa possui.</p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white shadow-lg hover:scale-105 active:scale-95 transition-all"
        >
          <PlusCircle size={14} />
          Novo Usuario
        </button>
      </div>

      {error && <div className="text-xs font-semibold text-rose-500">{error}</div>}

      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
        <table className="min-w-[1000px] w-full text-left text-[11px]">
          <thead className="text-[10px] uppercase tracking-widest text-slate-400">
            <tr>
              <th className="py-3 pr-4">Usuario</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Tipos de Usuario</th>
              <th className="py-3 px-4">Tipo Principal</th>
              <th className="py-3 pl-4">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((entry) => {
              const selectedRoleId = entry.roles?.[0]?.id ?? '';
              const isSelf = user?.id === entry.id;
              const isActive = entry.status === 'ACTIVE' || !entry.status;
              return (
                <tr key={entry.id} className={`text-slate-700 dark:text-slate-200 ${!isActive ? 'opacity-50' : ''}`}>
                  <td className="py-4 pr-4 font-black">{entry.name}</td>
                  <td className="py-4 px-4 text-slate-500 dark:text-slate-400">{entry.email}</td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                      }`}
                    >
                      {isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-wrap gap-2">
                      {(entry.roles ?? []).map((role) => (
                        <span
                          key={role.id}
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            SYSTEM_ROLE_NAMES.has(role.name)
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {role.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <select
                        className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-[10px] font-black uppercase tracking-widest px-4 py-2 outline-none"
                        value={selectedRoleId}
                        disabled={isSelf || savingUserId === entry.id}
                        onChange={(event) => handleRoleChange(entry, event.target.value)}
                      >
                        <option value="">Sem tipo</option>
                        {roleOptions.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                      {isSelf && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-600 font-semibold uppercase tracking-widest">
                          <Shield size={12} />
                          Voce
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 pl-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditModal(entry)}
                        disabled={isSelf}
                        className="text-blue-500 hover:text-blue-400 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Editar usuario"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleOpenToggleModal(entry)}
                        disabled={isSelf}
                        className={`${
                          isActive ? 'text-rose-500 hover:text-rose-400' : 'text-emerald-500 hover:text-emerald-400'
                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                        title={isActive ? 'Desativar usuario' : 'Ativar usuario'}
                      >
                        {isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showToggleModal && userToToggle && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-lg p-8 max-w-md w-full z-[10000]">
            <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4">
              {userToToggle.status === 'ACTIVE' ? 'Desativar' : 'Ativar'} Usuário
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Deseja {userToToggle.status === 'ACTIVE' ? 'desativar' : 'ativar'} o usuário <strong>{userToToggle.name}</strong>?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCloseToggleModal}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmToggleStatus}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {showUserModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-lg p-8 max-w-md w-full z-[10000]">
            <h3 className="text-lg font-black text-slate-800 dark:text-white mb-6">
              {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest ml-1">
                  Nome
                </label>
                <div className="relative">
                  <UserCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    className="w-full pl-12 pr-6 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white text-sm font-black outline-none"
                    value={userForm.name}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Nome completo"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest ml-1">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email"
                    className="w-full pl-12 pr-6 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white text-sm font-black outline-none"
                    value={userForm.email}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest ml-1">
                  {editingUser ? 'Nova Senha (opcional)' : 'Senha'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="password"
                    className="w-full pl-12 pr-6 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white text-sm font-black outline-none"
                    value={userForm.password}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder={editingUser ? 'Deixe vazio para não alterar' : 'mínimo 8 caracteres'}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest ml-1">
                  Tipo de Usuário
                </label>
                <select
                  className="w-full px-6 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white text-sm font-black outline-none"
                  value={userForm.roleId}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, roleId: e.target.value }))}
                >
                  <option value="">Sem tipo definido</option>
                  {roleOptions.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              {error && <div className="text-xs font-semibold text-rose-500">{error}</div>}
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={handleCloseModal}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitUser}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Salvando...' : editingUser ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
