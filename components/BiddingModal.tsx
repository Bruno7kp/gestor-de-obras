
import React, { useState, useEffect } from 'react';
import { BiddingProcess, BiddingStatus } from '../types';
import { financial } from '../utils/math';
import { X, Save, Landmark, FileText, Calendar, DollarSign, Percent, AlignLeft } from 'lucide-react';

interface BiddingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<BiddingProcess>) => void;
  bidding: BiddingProcess | null;
}

const defaultForm: Partial<BiddingProcess> = {
  tenderNumber: '',
  clientName: '',
  object: '',
  openingDate: new Date().toISOString().split('T')[0],
  expirationDate: '',
  estimatedValue: 0,
  ourProposalValue: 0,
  status: 'PROSPECTING',
  bdi: 25,
};

export const BiddingModal: React.FC<BiddingModalProps> = ({ isOpen, onClose, onSave, bidding }) => {
  const [formData, setFormData] = useState<Partial<BiddingProcess>>(defaultForm);
  const [strEstimatedValue, setStrEstimatedValue] = useState(
    financial.formatVisual(defaultForm.estimatedValue || 0, '').trim()
  );
  const [strProposalValue, setStrProposalValue] = useState(
    financial.formatVisual(defaultForm.ourProposalValue || 0, '').trim()
  );

  useEffect(() => {
    if (bidding) {
      setFormData({
        tenderNumber: bidding.tenderNumber,
        clientName: bidding.clientName,
        object: bidding.object,
        openingDate: bidding.openingDate,
        expirationDate: bidding.expirationDate,
        estimatedValue: bidding.estimatedValue,
        ourProposalValue: bidding.ourProposalValue,
        status: bidding.status,
        bdi: bidding.bdi,
      });
      setStrEstimatedValue(financial.formatVisual(bidding.estimatedValue || 0, '').trim());
      setStrProposalValue(financial.formatVisual(bidding.ourProposalValue || 0, '').trim());
    } else {
      setFormData(defaultForm);
      setStrEstimatedValue(financial.formatVisual(defaultForm.estimatedValue || 0, '').trim());
      setStrProposalValue(financial.formatVisual(defaultForm.ourProposalValue || 0, '').trim());
    }
  }, [bidding, isOpen]);

  if (!isOpen) return null;

  const statusOptions: { value: BiddingStatus; label: string }[] = [
    { value: 'PROSPECTING', label: 'Prospecção' },
    { value: 'DRAFTING', label: 'Em Elaboração' },
    { value: 'SUBMITTED', label: 'Enviada' },
    { value: 'WON', label: 'Ganha' },
    { value: 'LOST', label: 'Perdida' },
  ];

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] p-10 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-[1.5rem]"><Landmark size={28}/></div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{bidding ? 'Editar Proposta' : 'Nova Proposta'}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Licitação / Proposta Comercial</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all"><X size={24}/></button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave(formData); }} className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pr-2">

          {/* Row 1: Client + Tender */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Cliente / Órgão</label>
              <div className="relative">
                <Landmark className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                <input required className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} placeholder="Ex: Prefeitura Municipal" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Nº do Edital</label>
              <div className="relative">
                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                <input required className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={formData.tenderNumber} onChange={e => setFormData({...formData, tenderNumber: e.target.value})} placeholder="Ex: PE-001/2025" />
              </div>
            </div>
          </div>

          {/* Row 2: Object */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Objeto da Licitação</label>
            <div className="relative">
              <AlignLeft className="absolute left-4 top-4 text-slate-300" size={18}/>
              <textarea rows={3} className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-medium outline-none focus:border-indigo-500 transition-all resize-none" value={formData.object} onChange={e => setFormData({...formData, object: e.target.value})} placeholder="Descrição do objeto da licitação..." />
            </div>
          </div>

          {/* Row 3: Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Data de Abertura</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                <input type="date" required className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={formData.openingDate} onChange={e => setFormData({...formData, openingDate: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Data de Vencimento</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                <input type="date" className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={formData.expirationDate} onChange={e => setFormData({...formData, expirationDate: e.target.value})} />
              </div>
            </div>
          </div>

          {/* Row 4: Values + BDI */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] border-b pb-2">Valores</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Valor Estimado</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                  <input type="text" inputMode="decimal" className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={strEstimatedValue} onChange={e => {
                    const masked = financial.maskCurrency(e.target.value);
                    setStrEstimatedValue(masked);
                    setFormData({ ...formData, estimatedValue: financial.parseLocaleNumber(masked) });
                  }} placeholder="0,00" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Valor da Proposta</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                  <input type="text" inputMode="decimal" className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={strProposalValue} onChange={e => {
                    const masked = financial.maskCurrency(e.target.value);
                    setStrProposalValue(masked);
                    setFormData({ ...formData, ourProposalValue: financial.parseLocaleNumber(masked) });
                  }} placeholder="0,00" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">BDI (%)</label>
                <div className="relative">
                  <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                  <input type="number" step="0.1" min="0" max="100" className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={formData.bdi || ''} onChange={e => setFormData({...formData, bdi: parseFloat(e.target.value) || 0})} placeholder="25" />
                </div>
              </div>
            </div>
          </div>

          {/* Row 5: Status */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Status</label>
            <select className="w-full px-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none appearance-none focus:border-indigo-500" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as BiddingStatus})}>
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Desistir</button>
            <button type="submit" className="flex-[2] py-5 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
              <Save size={18}/> {bidding ? 'Atualizar Proposta' : 'Salvar Proposta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
