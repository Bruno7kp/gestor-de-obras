import React, { useMemo, useState } from 'react';
import { X, UserPlus, Trash2, Shield, Eye, Mail, Globe } from 'lucide-react';

interface AssignedRole {
  id: string;
  name: string;
  permissions?: Array<{ permission?: { code: string }; code?: string }>;
}

interface ProjectMember {
  id: string;
  roleId: string;
  assignedRole: AssignedRole;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    profileImage: string | null;
    status: string;
    instanceId?: string;
  };
}

interface User {
  id: string;
  name: string;
  email: string;
  profileImage: string | null;
  status: string;
}

interface Role {
  id: string;
  name: string;
  description?: string | null;
}

interface ProjectMembersModalProps {
  projectId: string;
  members: ProjectMember[];
  allUsers: User[];
  allRoles: Role[];
  generalAccessUserIds: string[];
  canEdit: boolean;
  onClose: () => void;
  onMembersChange: () => void;
}

export const ProjectMembersModal: React.FC<ProjectMembersModalProps> = ({
  projectId,
  members,
  allUsers,
  allRoles,
  generalAccessUserIds,
  canEdit,
  onClose,
  onMembersChange,
}) => {
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if the typed email matches a user that's already in _this_ instance
  const isEmailInternal = useMemo(() => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed) return false;
    return allUsers.some((u) => u.email.toLowerCase() === trimmed);
  }, [emailInput, allUsers]);

  const generalAccessSet = useMemo(
    () => new Set(generalAccessUserIds),
    [generalAccessUserIds],
  );

  const memberIds = useMemo(
    () => new Set(members.map((member) => member.user.id)),
    [members],
  );

  const generalAccessUsers = useMemo(
    () => allUsers.filter((user) => generalAccessSet.has(user.id)),
    [allUsers, generalAccessSet],
  );

  const generalOnlyUsers = useMemo(
    () => generalAccessUsers.filter((user) => !memberIds.has(user.id)),
    [generalAccessUsers, memberIds],
  );

  const displayRows = useMemo(
    () => [
      ...members.map((member) => ({
        key: member.id,
        user: member.user,
        roleId: member.roleId,
        roleName: member.assignedRole?.name ?? '—',
        isMember: true,
        isGeneralAccess: generalAccessSet.has(member.user.id),
        isExternal: member.user.instanceId !== undefined && !allUsers.some(u => u.id === member.user.id),
      })),
      ...generalOnlyUsers.map((user) => ({
        key: `general-${user.id}`,
        user,
        roleId: '',
        roleName: 'Obras gerais',
        isMember: false,
        isGeneralAccess: true,
        isExternal: false,
      })),
    ],
    [allUsers, generalAccessSet, generalOnlyUsers, members],
  );

  const handleAddMember = async () => {
    if (!emailInput.trim()) return;
    // External users require a role
    if (!isEmailInternal && !selectedRoleId) return;

    setLoading(true);
    setError(null);

    try {
      const payload: Record<string, string> = { email: emailInput.trim() };
      if (selectedRoleId) payload.roleId = selectedRoleId;

      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Erro ao adicionar membro');
      }

      setIsAddingMember(false);
      setEmailInput('');
      setSelectedRoleId('');
      onMembersChange();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Deseja remover este membro do projeto?')) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/members/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Erro ao remover membro');
      }

      onMembersChange();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRoleId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ roleId: newRoleId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Erro ao atualizar permissão');
      }

      onMembersChange();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Membros do Projeto</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Add Member Section */}
          {canEdit && (
            <div className="mb-6">
              {!isAddingMember ? (
                <button
                  onClick={() => setIsAddingMember(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <UserPlus size={18} />
                  Adicionar Membro
                </button>
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        E-mail do Usuário
                      </label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="usuario@exemplo.com"
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Digite o e-mail do usuário. Ele pode pertencer a qualquer instância.
                      </p>
                    </div>
                    {/* Role selector — only for external users */}
                    {!isEmailInternal && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cargo no Projeto
                        </label>
                        <select
                          value={selectedRoleId}
                          onChange={(e) => setSelectedRoleId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Selecione um cargo</option>
                          {allRoles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Obrigatório para usuários externos.
                        </p>
                      </div>
                    )}
                    {isEmailInternal && emailInput.trim() && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1">
                        <Shield size={12} />
                        Usuário interno — será adicionado com as permissões que já possui.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddMember}
                        disabled={!emailInput.trim() || (!isEmailInternal && !selectedRoleId) || loading}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {loading ? 'Adicionando...' : 'Adicionar'}
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingMember(false);
                          setEmailInput('');
                          setSelectedRoleId('');
                          setError(null);
                        }}
                        disabled={loading}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Members List */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              {displayRows.length} {displayRows.length === 1 ? 'Usuário' : 'Usuários'}
            </h3>
            <div className="space-y-2">
              {displayRows.length === 0 ? (
                <p className="text-gray-500 text-sm py-4 text-center">
                  Nenhum membro adicionado ainda
                </p>
              ) : (
                displayRows.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold flex-shrink-0 relative">
                      {row.user.profileImage ? (
                        <img
                          src={row.user.profileImage}
                          alt={row.user.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span>{row.user.name.charAt(0).toUpperCase()}</span>
                      )}
                      {row.isExternal && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white">
                          <Globe size={8} className="text-white" />
                        </div>
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{row.user.name}</p>
                      <p className="text-sm text-gray-500 truncate">{row.user.email}</p>
                    </div>

                    {/* Role Selector — only for external members */}
                    {canEdit && row.isMember && row.isExternal ? (
                      <select
                        value={row.roleId}
                        onChange={(e) => handleUpdateRole(row.user.id, e.target.value)}
                        disabled={loading}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {allRoles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    ) : row.isMember && !row.isExternal ? (
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 rounded-lg text-sm text-blue-700">
                        <Shield size={14} />
                        <span>{row.roleName}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 rounded-lg text-sm text-gray-700">
                        {row.isGeneralAccess ? (
                          <>
                            <Shield size={14} />
                            <span>Obras gerais</span>
                          </>
                        ) : (
                          <>
                            <Eye size={14} />
                            <span>{row.roleName}</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Remove Button — external members or internal without general access */}
                    {canEdit && row.isMember && !row.isGeneralAccess && (
                      <button
                        onClick={() => handleRemoveMember(row.user.id)}
                        disabled={loading}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Remover membro"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
