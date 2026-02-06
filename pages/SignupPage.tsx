import React from 'react';
import { Link } from 'react-router-dom';

export const SignupPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-6 py-16 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex flex-col gap-4">
          <Link to="/" className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Voltar para o site</Link>
          <h1 className="text-4xl font-display font-semibold">Assine seu plano</h1>
          <p className="text-lg text-slate-500 dark:text-slate-300">
            O onboarding e feito com nosso time para garantir configuracao perfeita. Escolha um plano e envie sua solicitacao.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {["Start", "Performance", "Elite"].map((plan, index) => (
            <div key={plan} className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Plano {plan}</p>
              <p className="mt-4 text-3xl font-display font-semibold">{index === 2 ? 'Sob consulta' : 'Em breve'}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-500 dark:text-slate-300">
                <li>Instancias dedicadas</li>
                <li>Suporte especializado</li>
                <li>Treinamento incluido</li>
              </ul>
              <button className="mt-6 w-full rounded-full bg-indigo-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg">
                Solicitar proposta
              </button>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Contato direto</p>
          <p className="mt-2 text-lg text-slate-600 dark:text-slate-200">
            Precisa migrar dados ou integrar times? Fale conosco e montamos um plano personalizado.
          </p>
          <button className="mt-6 rounded-full border border-slate-200 bg-slate-50 px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-600 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            Agendar demonstracao
          </button>
        </div>
      </div>
    </div>
  );
};
