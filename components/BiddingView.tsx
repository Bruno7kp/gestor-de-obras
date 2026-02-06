
import React, { useState, useMemo } from 'react';
import { BiddingProcess, CompanyCertificate, BiddingStatus } from '../types';
import { biddingService } from '../services/biddingService';
import { financial } from '../utils/math';
import { biddingsApi } from '../services/biddingsApi';
import { globalSettingsApi } from '../services/globalSettingsApi';
import { 
  Briefcase, Plus, FileText, Calendar, DollarSign, 
  TrendingUp, Search, Filter, ShieldCheck, AlertCircle, 
  ArrowUpRight, Trash2, CheckCircle2, Clock, Landmark, ExternalLink
} from 'lucide-react';

interface BiddingViewProps {
  biddings: BiddingProcess[];
  certificates: CompanyCertificate[];
  onUpdateBiddings: (b: BiddingProcess[]) => void;
  onUpdateCertificates: (c: CompanyCertificate[]) => void;
  onCreateProjectFromBidding: (b: BiddingProcess) => void;
}

export const BiddingView: React.FC<BiddingViewProps> = ({ 
  biddings, certificates, onUpdateBiddings, onUpdateCertificates, onCreateProjectFromBidding 
}) => {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'certificates'>('pipeline');
  const [search, setSearch] = useState('');

  const stats = useMemo(() => biddingService.getStats(biddings), [biddings]);

  const filteredBiddings = useMemo(() => {
    return biddings.filter(b => 
      b.clientName.toLowerCase().includes(search.toLowerCase()) || 
      b.tenderNumber.toLowerCase().includes(search.toLowerCase())
    );
  }, [biddings, search]);

  const handleAddBidding = async () => {
    const draft = biddingService.createBidding();
    const previous = biddings;
    onUpdateBiddings([...biddings, draft]);
    try {
      const created = await biddingsApi.create({
        tenderNumber: draft.tenderNumber,
        clientName: draft.clientName,
        object: draft.object,
        openingDate: draft.openingDate,
        expirationDate: draft.expirationDate,
        estimatedValue: draft.estimatedValue,
        ourProposalValue: draft.ourProposalValue,
        status: draft.status,
        bdi: draft.bdi,
        itemsSnapshot: draft.items,
        assetsSnapshot: draft.assets,
      });
      onUpdateBiddings([...previous, created]);
    } catch (error) {
      console.error('Erro ao criar licitacao:', error);
      onUpdateBiddings(previous);
    }
  };

  const handleStatusChange = async (id: string, status: BiddingStatus) => {
    const previous = biddings;
    const updatedList = biddings.map(b => b.id === id ? { ...b, status } : b);
    onUpdateBiddings(updatedList);
    try {
      const updated = await biddingsApi.update(id, { status });
      onUpdateBiddings(updatedList.map(b => b.id === id ? updated : b));
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      onUpdateBiddings(previous);
    }
  };

  const handleAddCertificate = async () => {
    const newCert: CompanyCertificate = {
      id: crypto.randomUUID(),
      name: 'Nova Certidão',
      issuer: 'Órgão Emissor',
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'valid'
    };
    const previous = certificates;
    onUpdateCertificates([...certificates, newCert]);
    try {
      const created = await globalSettingsApi.addCertificate({
        name: newCert.name,
        issuer: newCert.issuer,
        expirationDate: newCert.expirationDate,
        status: newCert.status,
      });
      onUpdateCertificates([...previous, created]);
    } catch (error) {
      console.error('Erro ao criar certidao:', error);
      onUpdateCertificates(previous);
    }
  };

  const handleDeleteCertificate = async (id: string) => {
    const previous = certificates;
    onUpdateCertificates(certificates.filter(c => c.id !== id));
    try {
      await globalSettingsApi.removeCertificate(id);
    } catch (error) {
      console.error('Erro ao remover certidao:', error);
      onUpdateCertificates(previous);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-12 animate-in fade-in duration-500 bg-slate-50 dark:bg-slate-950 custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* HEADER & TABS */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Setor de Licitações</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Gestão de propostas e compliance documental.</p>
          </div>
          <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
             <button onClick={() => setActiveTab('pipeline')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'pipeline' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Pipeline</button>
             <button onClick={() => setActiveTab('certificates')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'certificates' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Certidões</button>
          </div>
        </div>

        {activeTab === 'pipeline' ? (
          <div className="space-y-8">
            {/* KPI GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Pipeline Total" value={financial.formatBRL(stats.totalPipeline)} icon={<TrendingUp size={20}/>} color="indigo" />
              <KpiCard label="Contratos Ganhos" value={financial.formatBRL(stats.wonValue)} icon={<CheckCircle2 size={20}/>} color="emerald" />
              <KpiCard label="Em Aberto" value={financial.formatBRL(stats.openValue)} icon={<Clock size={20}/>} color="amber" />
              <KpiCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} icon={<Briefcase size={20}/>} color="blue" />
            </div>

            {/* ACTION BAR */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
               <div className="relative w-full max-w-md">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                 <input placeholder="Buscar edital ou cliente..." className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs outline-none" value={search} onChange={e => setSearch(e.target.value)} />
               </div>
               <button onClick={handleAddBidding} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all">
                  <Plus size={16} /> Nova Proposta
               </button>
            </div>

            {/* BIDDING LIST */}
            <div className="grid grid-cols-1 gap-4">
              {filteredBiddings.map(b => (
                <div key={b.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all group">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <div className={`p-4 rounded-2xl ${getStatusColor(b.status)} shrink-0`}>
                        <Landmark size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-base font-black dark:text-white uppercase tracking-tight">{b.clientName}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${getStatusColor(b.status)}`}>{b.status}</span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-1">{b.tenderNumber} • {b.object}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Valor Proposta</span>
                        <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{financial.formatBRL(b.ourProposalValue)}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Abertura</span>
                        <p className="text-sm font-black text-slate-700 dark:text-slate-300">{financial.formatDate(b.openingDate)}</p>
                      </div>
                      <div className="flex items-center gap-2 lg:justify-end">
                        {b.status === 'WON' && (
                          <button onClick={() => onCreateProjectFromBidding(b)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all">Criar Projeto</button>
                        )}
                        <select 
                          className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-[9px] font-black uppercase tracking-widest px-4 py-2 outline-none"
                          value={b.status}
                          onChange={e => handleStatusChange(b.id, e.target.value as BiddingStatus)}
                        >
                          <option value="PROSPECTING">Prospecção</option>
                          <option value="DRAFTING">Em Elaboração</option>
                          <option value="SUBMITTED">Enviada</option>
                          <option value="WON">Ganha</option>
                          <option value="LOST">Perdida</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black dark:text-white tracking-tight">Certidões e Compliance</h3>
                <p className="text-sm text-slate-500">Documentação legal para habilitação em editais.</p>
              </div>
              <button onClick={handleAddCertificate} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg active:scale-95 transition-all">
                <Plus size={16} /> Adicionar Certidão
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
               <table className="w-full text-left">
                 <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="px-8 py-5">Certidão</th>
                      <th className="px-8 py-5">Emissor</th>
                      <th className="px-8 py-5">Vencimento</th>
                      <th className="px-8 py-5">Status</th>
                      <th className="px-8 py-5 text-right">Ações</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {certificates.map(cert => {
                      const status = biddingService.checkCertificateStatus(cert);
                      return (
                        <tr key={cert.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${status === 'expired' ? 'bg-rose-100 text-rose-500' : (status === 'warning' ? 'bg-amber-100 text-amber-500' : 'bg-emerald-100 text-emerald-500')}`}>
                                <ShieldCheck size={18} />
                              </div>
                              <span className="text-sm font-black dark:text-white uppercase tracking-tight">{cert.name}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-xs text-slate-500 font-medium">{cert.issuer}</td>
                          <td className="px-8 py-5 text-xs font-black dark:text-slate-300">{financial.formatDate(cert.expirationDate)}</td>
                          <td className="px-8 py-5">
                             <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                               status === 'expired' ? 'bg-rose-100 text-rose-600' : (status === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600')
                             }`}>
                               {status === 'expired' ? 'Vencida' : (status === 'warning' ? 'Próximo' : 'Válida')}
                             </span>
                          </td>
                          <td className="px-8 py-5 text-right">
                             <button onClick={() => handleDeleteCertificate(cert.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                          </td>
                        </tr>
                      );
                    })}
                 </tbody>
               </table>
               {certificates.length === 0 && <div className="py-20 text-center text-slate-300 uppercase text-[10px] font-black">Nenhuma certidão cadastrada.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const KpiCard = ({ label, value, icon, color }: any) => {
  const colors: any = { indigo: 'text-indigo-600 dark:text-indigo-400', emerald: 'text-emerald-600 dark:text-emerald-400', amber: 'text-amber-600 dark:text-amber-400', blue: 'text-blue-600 dark:text-blue-400' };
  return (
    <div className="p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-32">
       <div className="flex justify-between items-start">
          <div className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-lg">{icon}</div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
       </div>
       <p className={`text-xl font-black tracking-tighter ${colors[color]}`}>{value}</p>
    </div>
  );
};

const getStatusColor = (status: BiddingStatus) => {
  switch(status) {
    case 'WON': return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'LOST': return 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400';
    case 'SUBMITTED': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
    case 'DRAFTING': return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  }
};
