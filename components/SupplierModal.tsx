
import React, { useState, useEffect } from 'react';
import { Supplier } from '../types';
import { X, Save, Truck, Building2, Phone, Mail, CreditCard, User, AlignLeft } from 'lucide-react';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Supplier>) => void;
  supplier: Supplier | null;
}

export const SupplierModal: React.FC<SupplierModalProps> = ({ isOpen, onClose, onSave, supplier }) => {
  const [formData, setFormData] = useState<Partial<Supplier>>({
    name: '', cnpj: '', category: 'Material', contactName: '', email: '', phone: '', notes: ''
  });

  useEffect(() => {
    if (supplier) setFormData(supplier);
    else setFormData({ name: '', cnpj: '', category: 'Material', contactName: '', email: '', phone: '', notes: '' });
  }, [supplier, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] p-10 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-[1.5rem]"><Truck size={28}/></div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{supplier ? 'Editar Parceiro' : 'Novo Fornecedor'}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Base de Suprimentos Estratégica</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all"><X size={24}/></button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave(formData); }} className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Razão Social / Nome</label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                <input required className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Comercial Hidráulica LTDA" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">CNPJ / CPF</label>
              <div className="relative">
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                <input className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})} placeholder="00.000.000/0000-00" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Categoria de Atuação</label>
              <select className="w-full px-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none appearance-none focus:border-indigo-500" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})}>
                <option value="Material">Fornecimento de Materiais</option>
                <option value="Serviço">Prestação de Serviços</option>
                <option value="Locação">Locação de Equipamentos</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] border-b pb-2">Contato Direto</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="relative">
                 <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                 <input className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={formData.contactName} onChange={e => setFormData({...formData, contactName: e.target.value})} placeholder="Nome do Vendedor/Gestor" />
               </div>
               <div className="relative">
                 <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                 <input className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="(00) 00000-0000" />
               </div>
               <div className="col-span-full relative">
                 <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                 <input className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="comercial@empresa.com.br" />
               </div>
            </div>
          </div>

          <div>
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Observações Técnicas / Notas</label>
             <div className="relative">
                <AlignLeft className="absolute left-4 top-4 text-slate-300" size={18}/>
                <textarea rows={3} className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-medium outline-none focus:border-indigo-500 transition-all resize-none" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Ex: Melhores prazos para materiais hidráulicos, aceita faturamento 28 dias..." />
             </div>
          </div>

          <div className="flex gap-4 pt-4">
             <button type="button" onClick={onClose} className="flex-1 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Desistir</button>
             <button type="submit" className="flex-[2] py-5 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
               <Save size={18}/> {supplier ? 'Atualizar Cadastro' : 'Salvar Fornecedor'}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};
