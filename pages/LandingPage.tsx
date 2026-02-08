import React from 'react';
import { Link } from 'react-router-dom';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-indigo-300/40 blur-[160px] dark:bg-indigo-600/20" />
          <div className="absolute top-40 -left-24 h-96 w-96 rounded-full bg-sky-200/50 blur-[160px] dark:bg-sky-500/20" />
          <div className="absolute bottom-0 right-1/3 h-80 w-80 rounded-full bg-emerald-200/40 blur-[160px] dark:bg-emerald-500/20" />
        </div>

        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-lg">
              PM
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Canteiro Digital</p>
              <p className="text-lg font-semibold">Gestão Inteligente</p>
            </div>
          </div>
          <nav className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
            <Link className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-slate-600 shadow-sm hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200" to="/login">
              Entrar
            </Link>
            <Link className="rounded-full bg-indigo-600 px-4 py-2 text-white shadow-lg hover:scale-[1.02]" to="/signup">
              Assinar plano
            </Link>
          </nav>
        </header>

        <section className="relative z-10 mx-auto grid max-w-6xl gap-10 px-6 pb-16 pt-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.3em] text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300">
              Novo fluxo SaaS
            </div>
            <h1 className="text-4xl font-display font-semibold leading-tight md:text-5xl">
              Uma plataforma de obras pensada para empresas que precisam de controle absoluto.
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Centralize medição, custos, contratos e compliance em uma única base. Assine um plano e ative sua instância em minutos.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/signup"
                className="rounded-full bg-indigo-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg"
              >
                Quero minha instância
              </Link>
              <Link
                to="/login"
                className="rounded-full border border-slate-200 bg-white/70 px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-600 shadow-sm hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              >
                Já sou cliente
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { title: 'Fluxo de medição', detail: 'Snapshots automáticos e auditoria completa.' },
                { title: 'EAP inteligente', detail: 'Cálculo hierárquico com integridade total.' },
                { title: 'Gestão multi-instância', detail: 'Controle centralizado para grupos.' },
              ].map((item) => (
                <div key={item.title} className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900/70">
            <div className="space-y-5">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Visão geral</p>
              <h2 className="text-2xl font-display font-semibold">Seu cockpit de engenharia</h2>
              <p className="text-sm text-slate-500 dark:text-slate-300">
                Monitoramento em tempo real, com previsão financeira e alertas automatizados por etapa.
              </p>
              <div className="space-y-3">
                {["Custos vs orçamento", "Diário de obra inteligente", "Governança por perfis"].map((line) => (
                  <div key={line} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200">
                    <span className="h-2 w-2 rounded-full bg-indigo-500" />
                    <span>{line}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
                Entrega imediata: configure sua instância, importe seus dados e siga para a operação.
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          {["Essencial", "Profissional", "Enterprise"].map((plan, index) => (
            <div key={plan} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Plano {plan}</p>
              <p className="mt-4 text-2xl font-display font-semibold">{index === 2 ? 'Sob consulta' : 'Em breve'}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Preços e detalhes serão liberados no onboarding.</p>
              <Link
                to="/signup"
                className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
              >
                Conversar com time
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-6 py-8 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-950">
        Canteiro Digital - Gestão de Engenharia
      </footer>
    </div>
  );
};
