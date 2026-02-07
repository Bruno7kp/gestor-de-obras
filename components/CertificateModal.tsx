
import React, { useState, useEffect } from 'react';
import { CompanyCertificate } from '../types';
import { X, Save, ShieldCheck, Building2, Calendar } from 'lucide-react';

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<CompanyCertificate>) => void;
  certificate: CompanyCertificate | null;
}

const defaultForm: Partial<CompanyCertificate> = {
  name: '',
  issuer: '',
  expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  status: 'valid',
};

export const CertificateModal: React.FC<CertificateModalProps> = ({ isOpen, onClose, onSave, certificate }) => {
  const [formData, setFormData] = useState<Partial<CompanyCertificate>>(defaultForm);

  useEffect(() => {
    if (certificate) {
      setFormData({
        name: certificate.name,
        issuer: certificate.issuer,
        expirationDate: certificate.expirationDate,
        status: certificate.status,
      });
    } else {
      setFormData({
        ...defaultForm,
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
    }
  }, [certificate, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-[1.5rem]"><ShieldCheck size={28}/></div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{certificate ? 'Editar Certidão' : 'Nova Certidão'}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Documentação de Compliance</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all"><X size={24}/></button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave(formData); }} className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pr-2">

          {/* Name */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Nome da Certidão</label>
            <div className="relative">
              <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
              <input required className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: CND Federal" />
            </div>
          </div>

          {/* Issuer */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Órgão Emissor</label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
              <input required className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={formData.issuer} onChange={e => setFormData({...formData, issuer: e.target.value})} placeholder="Ex: Receita Federal" />
            </div>
          </div>

          {/* Expiration Date */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Data de Vencimento</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
              <input type="date" required className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={formData.expirationDate} onChange={e => setFormData({...formData, expirationDate: e.target.value})} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Desistir</button>
            <button type="submit" className="flex-[2] py-5 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
              <Save size={18}/> {certificate ? 'Atualizar Certidão' : 'Salvar Certidão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
