import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login({ email, password, instanceId });
      navigate('/app', { replace: true });
    } catch (err) {
      setError('Nao foi possivel entrar. Verifique seus dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mb-6 text-center">
          <p className="text-[11px] uppercase tracking-[0.4em] text-slate-400">Acesso</p>
          <h1 className="mt-2 text-3xl font-display font-semibold">Entrar no sistema</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Use o código da sua empresa para autenticar.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Email</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-white dark:placeholder:text-slate-500"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="seuemail@empresa.com"
              required
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Senha</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-white dark:placeholder:text-slate-500"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Identificador da empresa</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-white dark:placeholder:text-slate-500"
              value={instanceId}
              onChange={(event) => setInstanceId(event.target.value)}
              type="text"
              placeholder="EMPRESAX"
              required
            />
          </div>

          {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600 dark:border-rose-500 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}

          <button
            type="submit"
            className="w-full rounded-full bg-indigo-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg hover:scale-[1.01] disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-xs text-slate-400">
          <Link to="/" className="hover:text-indigo-600">Voltar</Link>
          <Link to="/signup" className="hover:text-indigo-600">Criar conta</Link>
        </div>
      </div>
    </div>
  );
};
