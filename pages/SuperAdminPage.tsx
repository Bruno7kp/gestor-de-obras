import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { instancesService, type Instance } from '../services/instancesService';
import { useToast } from '../hooks/useToast';

export const SuperAdminPage: React.FC = () => {
  const { logout } = useAuth();
  const toast = useToast();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'instances' | 'plans' | 'billing'>('instances');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [instanceToDelete, setInstanceToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    status: 'ACTIVE',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    adminPasswordConfirm: '',
  });
  const [formLoading, setFormLoading] = useState(false);

  const loadInstances = async () => {
    try {
      const data = await instancesService.list();
      setInstances(data);
      setError(null);
    } catch (err) {
      setError('Nao foi possivel carregar as instancias.');
      toast.error('Erro ao carregar instâncias');
    }
  };

  const handleCreateInstance = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome da instância é obrigatório');
      return;
    }

    // Check if instance name already exists
    const nameExists = instances.some(
      (instance) => instance.name.toLowerCase() === formData.name.toLowerCase(),
    );
    if (nameExists) {
      toast.error('Já existe uma instância com este nome');
      return;
    }

    if (!formData.adminName.trim()) {
      toast.error('Nome do administrador é obrigatório');
      return;
    }

    if (!formData.adminEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail)) {
      toast.error('Email do administrador inválido');
      return;
    }

    if (!formData.adminPassword.trim() || formData.adminPassword.length < 8) {
      toast.error('Senha deve ter no mínimo 8 caracteres');
      return;
    }

    if (formData.adminPassword !== formData.adminPasswordConfirm) {
      toast.error('Senhas não correspondem');
      return;
    }

    setFormLoading(true);
    try {
      await instancesService.create({
        name: formData.name,
        status: formData.status,
        admin: {
          name: formData.adminName,
          email: formData.adminEmail,
          password: formData.adminPassword,
        },
      });
      setShowCreateModal(false);
      setFormData({ name: '', status: 'ACTIVE', adminName: '', adminEmail: '', adminPassword: '', adminPasswordConfirm: '' });
      toast.success('Instância criada com sucesso');
      await loadInstances();
    } catch (err) {
      toast.error('Erro ao criar instância');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateInstance = async () => {
    if (!selectedInstance) return;
    if (!formData.name.trim()) {
      toast.error('Nome da instância é obrigatório');
      return;
    }

    // Check if new name already exists (excluding current instance)
    const nameExists = instances.some(
      (instance) =>
        instance.id !== selectedInstance.id &&
        instance.name.toLowerCase() === formData.name.toLowerCase(),
    );
    if (nameExists) {
      toast.error('Já existe outra instância com este nome');
      return;
    }

    setFormLoading(true);
    try {
      await instancesService.update(selectedInstance.id, {
        name: formData.name,
        status: formData.status,
      });
      setShowDetailModal(false);
      setSelectedInstance(null);
      setFormData({ name: '', status: 'ACTIVE', adminName: '', adminEmail: '', adminPassword: '', adminPasswordConfirm: '' });
      toast.success('Instância atualizada com sucesso');
      await loadInstances();
    } catch (err) {
      toast.error('Erro ao atualizar instância');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteInstance = (id: string, name: string) => {
    if (id === mainInstanceId) {
      toast.error('A instância principal não pode ser deletada');
      return;
    }
    setInstanceToDelete({ id, name });
    setDeleteConfirmation('');
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!instanceToDelete) return;

    setFormLoading(true);
    try {
      await instancesService.delete(instanceToDelete.id);
      setShowDeleteModal(false);
      setInstanceToDelete(null);
      setDeleteConfirmation('');
      toast.success('Instância deletada com sucesso');
      await loadInstances();
    } catch (err) {
      toast.error('Erro ao deletar instância');
    } finally {
      setFormLoading(false);
    }
  };

  const openDetailModal = (instance: Instance) => {
    setSelectedInstance(instance);
    setFormData({
      name: instance.name,
      status: instance.status || 'ACTIVE',
      adminName: '',
      adminEmail: '',
      adminPassword: '',
      adminPasswordConfirm: '',
    });
    setShowDetailModal(true);
  };

  const planCatalog = useMemo(
    () => [
      {
        id: 'trial',
        name: 'Trial',
        price: 'R$ 0,00',
        cadence: '30 dias',
        highlight: false,
        features: ['1 instancia', 'Suporte basico', 'Exportacao PDF'],
      },
      {
        id: 'pro',
        name: 'Profissional',
        price: 'Em breve',
        cadence: 'Mensal',
        highlight: true,
        features: ['Ate 5 instancias', 'Suporte prioritario', 'Relatorios custom'],
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 'Sob consulta',
        cadence: 'Personalizado',
        highlight: false,
        features: ['Instancias ilimitadas', 'SLA dedicado', 'Gestao multi-empresa'],
      },
    ],
    [],
  );

  const filteredInstances = useMemo(() => {
    if (!searchQuery) return instances;
    const query = searchQuery.toLowerCase();
    return instances.filter((instance) =>
      [instance.name, instance.id, instance.status ?? ''].join(' ').toLowerCase().includes(query),
    );
  }, [instances, searchQuery]);

  // Get the ID of the main instance (the first one created)
  const mainInstanceId = useMemo(() => {
    if (instances.length === 0) return null;
    // Find the instance with the earliest createdAt date
    const sorted = [...instances].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });
    return sorted[0]?.id;
  }, [instances]);

  useEffect(() => {
    let isMounted = true;
    
    const load = async () => {
      try {
        const data = await instancesService.list();
        if (isMounted) setInstances(data);
      } catch (err) {
        if (isMounted) setError('Nao foi possivel carregar as instancias.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Superadmin</p>
          <h1 className="text-2xl font-display font-semibold">Painel de controle</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">Visao geral de instancias, planos e cobranca.</p>
        </div>
        <button
          onClick={() => logout()}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200"
        >
          Sair
        </button>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <section className="grid gap-4 md:grid-cols-3">
          {[
            { label: 'Instancias ativas', value: `${instances.length}`, tone: 'indigo' },
            { label: 'Planos em trial', value: '0', tone: 'emerald' },
            { label: 'Faturamento', value: 'Em breve', tone: 'slate' },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
            >
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{card.label}</p>
              <p className="mt-3 text-2xl font-display font-semibold text-slate-900 dark:text-slate-100">{card.value}</p>
              <div
                className={`mt-4 h-1.5 w-16 rounded-full ${
                  card.tone === 'indigo'
                    ? 'bg-indigo-500/70'
                    : card.tone === 'emerald'
                    ? 'bg-emerald-500/70'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              />
            </div>
          ))}
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Superadmin</p>
              <h2 className="text-xl font-display font-semibold">Gerenciamento global</h2>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-widest">
              <button
                onClick={() => setActiveTab('instances')}
                className={`rounded-full px-4 py-2 ${
                  activeTab === 'instances'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 text-slate-500 hover:text-indigo-600 dark:border-slate-800 dark:text-slate-300'
                }`}
              >
                Instancias
              </button>
              <button
                onClick={() => setActiveTab('plans')}
                className={`rounded-full px-4 py-2 ${
                  activeTab === 'plans'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 text-slate-500 hover:text-indigo-600 dark:border-slate-800 dark:text-slate-300'
                }`}
              >
                Planos
              </button>
              <button
                onClick={() => setActiveTab('billing')}
                className={`rounded-full px-4 py-2 ${
                  activeTab === 'billing'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 text-slate-500 hover:text-indigo-600 dark:border-slate-800 dark:text-slate-300'
                }`}
              >
                Cobranca
              </button>
            </div>
          </div>

          {activeTab === 'instances' && (
            <div className="mt-6 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-300">Controle e status das operacoes.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Buscar instancia..."
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600 focus:border-indigo-300 focus:outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200"
                  />
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="rounded-full bg-indigo-600 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white shadow-lg hover:bg-indigo-700"
                  >
                    Nova instancia
                  </button>
                </div>
              </div>

              {loading && <p className="mt-6 text-sm text-slate-400">Carregando instancias...</p>}
              {error && <p className="mt-6 text-sm text-rose-500">{error}</p>}

              {!loading && !error && (
                <div className="mt-6 grid gap-4">
                  {filteredInstances.map((instance) => (
                    <div key={instance.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{instance.name}</p>
                          <p className="text-xs text-slate-400">{instance.id}</p>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest">
                          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200">
                            {instance.status ?? 'ATIVA'}
                          </span>
                          <button
                            onClick={() => openDetailModal(instance)}
                            className="rounded-full border border-slate-200 px-3 py-1 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:border-slate-800 dark:text-slate-300 dark:hover:text-indigo-400"
                          >
                            Ver detalhes
                          </button>
                          <button
                            onClick={() => handleDeleteInstance(instance.id, instance.name)}
                            disabled={instance.id === mainInstanceId}
                            className={`rounded-full border border-red-200 px-3 py-1 text-red-500 hover:bg-red-50 hover:text-red-600 dark:border-red-900 dark:hover:bg-red-900/20 dark:text-red-400 ${
                              instance.id === mainInstanceId ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            Deletar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredInstances.length === 0 && (
                    <p className="text-sm text-slate-400">Nenhuma instancia encontrada.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'plans' && (
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {planCatalog.map((plan) => (
                <div
                  key={plan.id}
                  className={`rounded-3xl border p-5 shadow-sm ${
                    plan.highlight
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-slate-200 bg-slate-50'
                  } dark:border-slate-800 dark:bg-slate-950/40`}
                >
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{plan.name}</p>
                  <p className="mt-3 text-2xl font-display font-semibold text-slate-900 dark:text-slate-100">{plan.price}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">{plan.cadence}</p>
                  <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <button className="mt-6 w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
                    Editar plano
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
              Modulo de cobranca em preparacao. Nesta etapa, vamos conectar o billing e os eventos de renovacao.
            </div>
          )}
        </section>
      </main>

      {/* Modal de Criar Instância */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Nova Instancia</p>
              <h2 className="text-xl font-display font-semibold text-slate-900 dark:text-white">Criar instância</h2>
            </div>

            <div className="space-y-4 px-6 py-5 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Nome da Instância
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Cliente ABC"
                  className={`mt-2 w-full rounded-2xl border bg-slate-50 px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none dark:bg-slate-950/60 dark:text-white dark:placeholder-slate-500 ${
                    formData.name && instances.some((i) => i.name.toLowerCase() === formData.name.toLowerCase())
                      ? 'border-red-300 focus:border-red-300 dark:border-red-800'
                      : 'border-slate-200 focus:border-indigo-300 dark:border-slate-800'
                  }`}
                />
                {formData.name && instances.some((i) => i.name.toLowerCase() === formData.name.toLowerCase()) && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">✗ Este nome já está em uso</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 focus:border-indigo-300 focus:outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-white"
                >
                  <option value="ACTIVE">Ativa</option>
                  <option value="INACTIVE">Inativa</option>
                  <option value="SUSPENDED">Suspensa</option>
                </select>
              </div>

              <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-3">Dados do Administrador</p>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={formData.adminName}
                  onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  placeholder="Ex: João Silva"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-300 focus:outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-white dark:placeholder-slate-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  placeholder="Ex: admin@cliente.com"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-300 focus:outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-white dark:placeholder-slate-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Senha
                </label>
                <input
                  type="password"
                  value={formData.adminPassword}
                  onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                  placeholder="Mín. 8 caracteres"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-300 focus:outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-white dark:placeholder-slate-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Confirmar Senha
                </label>
                <input
                  type="password"
                  value={formData.adminPasswordConfirm}
                  onChange={(e) => setFormData({ ...formData, adminPasswordConfirm: e.target.value })}
                  placeholder="Confirme a senha"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-300 focus:outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-white dark:placeholder-slate-500"
                />
              </div>
            </div>

            <div className="flex gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ name: '', status: 'ACTIVE', adminName: '', adminEmail: '', adminPassword: '', adminPasswordConfirm: '' });
                }}
                disabled={formLoading}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-900 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateInstance}
                disabled={formLoading}
                className="flex-1 rounded-full bg-indigo-600 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {formLoading ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes/Edição */}
      {showDetailModal && selectedInstance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Detalhes</p>
              <h2 className="text-xl font-display font-semibold text-slate-900 dark:text-white">Editar instância</h2>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  ID da Instância
                </label>
                <input
                  type="text"
                  value={selectedInstance.id}
                  disabled
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Nome da Instância
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`mt-2 w-full rounded-2xl border bg-slate-50 px-4 py-2 text-sm text-slate-900 focus:outline-none dark:bg-slate-950/60 dark:text-white ${
                    formData.name && formData.name !== selectedInstance?.name && instances.some((i) => i.name.toLowerCase() === formData.name.toLowerCase())
                      ? 'border-red-300 focus:border-red-300 dark:border-red-800'
                      : 'border-slate-200 focus:border-indigo-300 dark:border-slate-800'
                  }`}
                />
                {formData.name && formData.name !== selectedInstance?.name && instances.some((i) => i.name.toLowerCase() === formData.name.toLowerCase()) && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">✗ Este nome já está em uso</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 focus:border-indigo-300 focus:outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-white"
                >
                  <option value="ACTIVE">Ativa</option>
                  <option value="INACTIVE">Inativa</option>
                  <option value="SUSPENDED">Suspensa</option>
                </select>
              </div>

              {selectedInstance.createdAt && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Criada em
                  </label>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {new Date(selectedInstance.createdAt).toLocaleDateString('pt-BR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
              <button
                onClick={() => setShowDetailModal(false)}
                disabled={formLoading}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-900 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateInstance}
                disabled={formLoading}
                className="flex-1 rounded-full bg-indigo-600 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {formLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Delete */}
      {showDeleteModal && instanceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <p className="text-[11px] uppercase tracking-[0.3em] text-red-500">Aviso</p>
              <h2 className="text-xl font-display font-semibold text-slate-900 dark:text-white">Deletar instância?</h2>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                Tem certeza que deseja deletar a instância <span className="font-semibold">'{instanceToDelete.name}'</span>?
              </p>
              <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-3 mb-4">
                <p className="text-xs text-red-700 dark:text-red-300">
                  ⚠️ Esta ação é irreversível. Todos os dados associados a esta instância serão permanentemente deletados.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Digite o nome da instância para confirmar
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder={instanceToDelete.name}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-300 focus:outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-white dark:placeholder-slate-500"
                />
                {deleteConfirmation && deleteConfirmation !== instanceToDelete.name && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">O nome não corresponde</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmation('');
                }}
                disabled={formLoading}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-900 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={formLoading || deleteConfirmation !== instanceToDelete.name}
                className="flex-1 rounded-full bg-red-600 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formLoading ? 'Deletando...' : 'Deletar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
