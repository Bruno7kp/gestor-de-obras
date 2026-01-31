
import React from 'react';
import { Building2, HardDrive, Trash2, ShieldCheck, Cog } from 'lucide-react';
import { GlobalSettings } from '../types';

interface SettingsViewProps {
  settings: GlobalSettings;
  onUpdate: (s: GlobalSettings) => void;
  projectCount: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onUpdate, projectCount }) => {
  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-12 animate-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-4xl mx-auto space-y-10">
        <header className="flex items-center gap-4">
          <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl"><Cog size={24}/></div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white">Ajustes Globais</h1>
            <p className="text-slate-500 font-medium">Configurações que afetam todo o sistema e novos projetos.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8">
          {/* PERFIL EMPRESA */}
          <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><Building2 size={24}/></div>
              <div>
                <h3 className="font-black uppercase text-xs tracking-widest">Perfil Institucional</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Dados padrão para novos relatórios</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">Nome da Empreiteira</label>
                <input 
                  className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 dark:text-white text-sm font-black focus:border-indigo-500 outline-none transition-all"
                  value={settings.defaultCompanyName}
                  onChange={(e) => onUpdate({ ...settings, defaultCompanyName: e.target.value })}
                  placeholder="Nome da sua empresa"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">Idioma / Região</label>
                <select 
                  className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 dark:text-white text-sm font-black outline-none appearance-none"
                  value={settings.language}
                  onChange={(e) => onUpdate({ ...settings, language: e.target.value as any })}
                >
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="en-US">English (US)</option>
                </select>
              </div>
            </div>
          </section>

          {/* DADOS E PRIVACIDADE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl"><ShieldCheck size={24}/></div>
                <h3 className="font-black uppercase text-xs tracking-widest">Segurança de Dados</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">O ProMeasure opera em modo "Privacy First". Todos os seus projetos ({projectCount}) estão criptografados no cache local do seu navegador.</p>
              <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Sincronização</span>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest">Ativa</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl"><Trash2 size={24}/></div>
                <h3 className="font-black uppercase text-xs tracking-widest">Zona de Perigo</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">Esta ação é irreversível. Ao resetar, você perderá todos os orçamentos e medições salvas.</p>
              <button 
                onClick={() => { if(confirm("CUIDADO: Isso apagará TODOS os projetos. Tem certeza?")) { localStorage.clear(); window.location.reload(); } }}
                className="w-full py-4 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all active:scale-95"
              >
                Resetar Fábrica
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
