import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { instancesService, type Instance } from '../services/instancesService';

export const SuperAdminPage: React.FC = () => {
  const { logout } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'instances' | 'plans' | 'billing'>('instances');
  const [searchQuery, setSearchQuery] = useState('');

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
                  <button className="rounded-full bg-indigo-600 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white shadow-lg">
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
                          <button className="rounded-full border border-slate-200 px-3 py-1 text-slate-500 hover:text-indigo-600 dark:border-slate-800 dark:text-slate-300">
                            Ver detalhes
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
    </div>
  );
};
