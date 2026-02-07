import React from 'react';
import { Coins, ShieldCheck, Trash2 } from 'lucide-react';
import type { GlobalSettings } from '../../types';

interface SettingsGlobalTabProps {
  settings: GlobalSettings;
  onUpdate: (s: GlobalSettings) => void;
  projectCount: number;
}

export const SettingsGlobalTab: React.FC<SettingsGlobalTabProps> = ({ settings, onUpdate, projectCount }) => {
  return (
    <div className="grid grid-cols-1 gap-8">
      <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
            <Coins size={24} />
          </div>
          <div>
            <h3 className="font-black uppercase text-xs tracking-widest text-slate-800 dark:text-white">Regionalizacao</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Formatacao padrao do sistema</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest ml-1">Idioma / Regiao</label>
            <select
              className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white text-sm font-black outline-none appearance-none"
              value={settings.language}
              onChange={(e) => onUpdate({ ...settings, language: e.target.value as GlobalSettings['language'] })}
            >
              <option value="pt-BR">Portugues (Brasil)</option>
              <option value="en-US">English (US)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest ml-1">Simbolo Monetario</label>
            <div className="relative">
              <Coins className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white text-sm font-black focus:border-indigo-500 outline-none transition-all"
                value={settings.currencySymbol}
                onChange={(e) => onUpdate({ ...settings, currencySymbol: e.target.value })}
                placeholder="R$"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <ShieldCheck size={24} />
            </div>
            <h3 className="font-black uppercase text-xs tracking-widest text-slate-800 dark:text-white">Seguranca de Dados</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            O ProMeasure opera em modo "Privacy First". Seus projetos ({projectCount}) ficam protegidos no servidor com controle de acesso por instancia.
          </p>
          <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Sincronizacao</span>
            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-widest">Ativa</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl">
              <Trash2 size={24} />
            </div>
            <h3 className="font-black uppercase text-xs tracking-widest text-slate-800 dark:text-white">Zona de Perigo</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            A limpeza total de dados agora depende de um fluxo administrativo no servidor.
          </p>
          <div className="w-full py-4 bg-rose-50 dark:bg-rose-900/10 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-xl text-[10px] font-black uppercase tracking-widest text-center">
            Solicite ao administrador
          </div>
        </div>
      </div>
    </div>
  );
};
