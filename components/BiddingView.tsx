
import React, { useState, useMemo, useEffect } from 'react';
import { BiddingProcess, CompanyCertificate, BiddingStatus, CERTIFICATE_CATEGORIES } from '../types';
import { biddingService } from '../services/biddingService';
import { financial } from '../utils/math';
import { biddingsApi } from '../services/biddingsApi';
import { globalSettingsApi } from '../services/globalSettingsApi';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { uiPreferences } from '../utils/uiPreferences';
import { BiddingModal } from './BiddingModal';
import { CertificateModal } from './CertificateModal';
import { ConfirmModal } from './ConfirmModal';
import { 
  Briefcase, Plus, FileText, Calendar, DollarSign, 
  TrendingUp, Search, Filter, ShieldCheck, AlertCircle, 
  ArrowUpRight, Trash2, CheckCircle2, Clock, Landmark, ExternalLink, Pencil
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
  const biddingTabKey = 'biddings_tab';
  const [activeTab, setActiveTab] = useState<'pipeline' | 'certificates'>(() => {
    const saved = uiPreferences.getString(biddingTabKey);
    return saved === 'pipeline' || saved === 'certificates' ? saved : 'pipeline';
  });
  const [search, setSearch] = useState('');
  const [biddingModalOpen, setBiddingModalOpen] = useState(false);
  const [editingBidding, setEditingBidding] = useState<BiddingProcess | null>(null);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [editingCert, setEditingCert] = useState<CompanyCertificate | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | CompanyCertificate['category']>('ALL');
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'bidding' | 'certificate'; id: string; name: string } | null>(null);

  const { canEdit } = usePermissions();
  const canEditBiddings = canEdit('biddings');
  const toast = useToast();

  const stats = useMemo(() => biddingService.getStats(biddings), [biddings]);

  useEffect(() => {
    uiPreferences.setString(biddingTabKey, activeTab);
  }, [activeTab, biddingTabKey]);

  const filteredBiddings = useMemo(() => {
    return biddings.filter(b => 
      b.clientName.toLowerCase().includes(search.toLowerCase()) || 
      b.tenderNumber.toLowerCase().includes(search.toLowerCase())
    );
  }, [biddings, search]);

  const filteredCertificates = useMemo(() => {
    if (categoryFilter === 'ALL') return certificates;
    return certificates.filter((certificate) => certificate.category === categoryFilter);
  }, [certificates, categoryFilter]);

  const categoryLabelByValue = useMemo(() => {
    return CERTIFICATE_CATEGORIES.reduce<Record<string, string>>((acc, option) => {
      acc[option.value] = option.label;
      return acc;
    }, {});
  }, []);

  const handleAddBidding = () => {
    setEditingBidding(null);
    setBiddingModalOpen(true);
  };

  const handleEditBidding = (b: BiddingProcess) => {
    setEditingBidding(b);
    setBiddingModalOpen(true);
  };

  const handleSaveBidding = async (data: Partial<BiddingProcess>) => {
    setBiddingModalOpen(false);
    if (editingBidding) {
      // Update
      const previous = biddings;
      const updatedList = biddings.map(b => b.id === editingBidding.id ? { ...b, ...data } : b);
      onUpdateBiddings(updatedList);
      try {
        const updated = await biddingsApi.update(editingBidding.id, {
          tenderNumber: data.tenderNumber,
          clientName: data.clientName,
          object: data.object,
          openingDate: data.openingDate,
          expirationDate: data.expirationDate,
          estimatedValue: data.estimatedValue,
          ourProposalValue: data.ourProposalValue,
          status: data.status,
          bdi: data.bdi,
        });
        onUpdateBiddings(updatedList.map(b => b.id === editingBidding.id ? updated : b));
      } catch (error) {
        console.error('Erro ao atualizar licitacao:', error);
        onUpdateBiddings(previous);
      }
    } else {
      // Create
      const previous = biddings;
      const draft: BiddingProcess = {
        id: crypto.randomUUID(),
        tenderNumber: data.tenderNumber || '',
        clientName: data.clientName || '',
        object: data.object || '',
        openingDate: data.openingDate || '',
        expirationDate: data.expirationDate || '',
        estimatedValue: data.estimatedValue || 0,
        ourProposalValue: data.ourProposalValue || 0,
        status: (data.status as BiddingStatus) || 'PROSPECTING',
        bdi: data.bdi ?? 25,
        items: [],
        assets: [],
      };
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
        });
        onUpdateBiddings([...previous, created]);
      } catch (error) {
        console.error('Erro ao criar licitacao:', error);
        onUpdateBiddings(previous);
      }
    }
  };

  const requestDeleteBidding = (b: BiddingProcess) => {
    setConfirmDelete({ type: 'bidding', id: b.id, name: b.clientName || b.tenderNumber });
  };

  const requestDeleteCertificate = (cert: CompanyCertificate) => {
    setConfirmDelete({ type: 'certificate', id: cert.id, name: cert.name });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const { type, id } = confirmDelete;
    setConfirmDelete(null);

    if (type === 'bidding') {
      const previous = biddings;
      onUpdateBiddings(biddings.filter(b => b.id !== id));
      try {
        await biddingsApi.remove(id);
        toast.success('Proposta removida com sucesso.');
      } catch (error) {
        console.error('Erro ao remover licitacao:', error);
        onUpdateBiddings(previous);
        toast.error('Erro ao remover proposta.');
      }
    } else {
      const previous = certificates;
      onUpdateCertificates(certificates.filter(c => c.id !== id));
      try {
        await globalSettingsApi.removeCertificate(id);
        toast.success('Certidão removida com sucesso.');
      } catch (error) {
        console.error('Erro ao remover certidao:', error);
        onUpdateCertificates(previous);
        toast.error('Erro ao remover certidão.');
      }
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

  const handleAddCertificate = () => {
    setEditingCert(null);
    setCertModalOpen(true);
  };

  const handleEditCertificate = (cert: CompanyCertificate) => {
    setEditingCert(cert);
    setCertModalOpen(true);
  };

  const handleSaveCertificate = async (data: Partial<CompanyCertificate>) => {
    setCertModalOpen(false);
    if (editingCert) {
      // Update
      const previous = certificates;
      const updatedList = certificates.map(c => c.id === editingCert.id ? { ...c, ...data } : c);
      onUpdateCertificates(updatedList);
      try {
        const updated = await globalSettingsApi.updateCertificate(editingCert.id, {
          name: data.name,
          issuer: data.issuer,
          category: data.category,
          expirationDate: data.expirationDate,
          status: data.status,
          attachmentUrls: data.attachmentUrls,
        });
        onUpdateCertificates(updatedList.map(c => {
          if (c.id !== editingCert.id) return c;
          return {
            ...c,
            ...updated,
            attachmentUrls: updated.attachmentUrls ?? [],
          };
        }));
      } catch (error) {
        console.error('Erro ao atualizar certidao:', error);
        onUpdateCertificates(previous);
      }
    } else {
      // Create
      const previous = certificates;
      const newCert: CompanyCertificate = {
        id: crypto.randomUUID(),
        name: data.name || 'Nova Certidão',
        issuer: data.issuer || '',
        category: data.category ?? 'OUTROS',
        expirationDate: data.expirationDate ?? null,
        status: (data.status as CompanyCertificate['status']) || 'valid',
        attachmentUrls: data.attachmentUrls ?? [],
      };
      onUpdateCertificates([...certificates, newCert]);
      try {
        const created = await globalSettingsApi.addCertificate({
          name: newCert.name,
          issuer: newCert.issuer,
          category: newCert.category,
          expirationDate: newCert.expirationDate,
          status: newCert.status,
          attachmentUrls: newCert.attachmentUrls,
        });
        const mergedCreated: CompanyCertificate = {
          ...created,
          attachmentUrls: created.attachmentUrls ?? [],
        };
        onUpdateCertificates([...previous, mergedCreated]);
      } catch (error) {
        console.error('Erro ao criar certidao:', error);
        onUpdateCertificates(previous);
      }
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
             <button onClick={() => setActiveTab('pipeline')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'pipeline' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Propostas</button>
             <button onClick={() => setActiveTab('certificates')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'certificates' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Certidões</button>
          </div>
        </div>

        {activeTab === 'pipeline' ? (
          <div className="space-y-8">
            {/* KPI GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Propostas Total" value={financial.formatBRL(stats.totalPipeline)} icon={<TrendingUp size={20}/>} color="indigo" />
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
               {canEditBiddings && (
                 <button onClick={handleAddBidding} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all">
                    <Plus size={16} /> Nova Proposta
                 </button>
               )}
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
                        {canEditBiddings && (
                          <>
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
                            <button onClick={() => handleEditBidding(b)} className="p-2 text-slate-300 hover:text-indigo-500 transition-all"><Pencil size={16}/></button>
                            <button onClick={() => requestDeleteBidding(b)} className="p-2 text-slate-300 hover:text-rose-500 transition-all"><Trash2 size={16}/></button>
                          </>
                        )}
                        {!canEditBiddings && (
                          <span className="bg-slate-50 dark:bg-slate-800 rounded-xl text-[9px] font-black uppercase tracking-widest px-4 py-2">
                            {b.status === 'PROSPECTING' ? 'Prospecção' : b.status === 'DRAFTING' ? 'Em Elaboração' : b.status === 'SUBMITTED' ? 'Enviada' : b.status === 'WON' ? 'Ganha' : 'Perdida'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black dark:text-white tracking-tight">Certidões e Compliance</h3>
                <p className="text-sm text-slate-500">Documentação legal para habilitação em editais.</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none"
                  value={categoryFilter}
                  onChange={(event) =>
                    setCategoryFilter(event.target.value as 'ALL' | CompanyCertificate['category'])
                  }
                >
                  <option value="ALL">Todas as Categorias</option>
                  {CERTIFICATE_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>

                <button onClick={handleAddCertificate} className={`flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg active:scale-95 transition-all ${!canEditBiddings ? 'hidden' : ''}`}>
                  <Plus size={16} /> Adicionar Certidão
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
               <table className="w-full text-left">
                 <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="px-8 py-5">Certidão</th>
                      <th className="px-8 py-5">Categoria</th>
                      <th className="px-8 py-5">Emissor</th>
                      <th className="px-8 py-5">Vencimento</th>
                      <th className="px-8 py-5">Status</th>
                      <th className="px-8 py-5 text-right">Ações</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredCertificates.map(cert => {
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
                          <td className="px-8 py-5 text-xs text-slate-500 font-medium">{categoryLabelByValue[cert.category] ?? 'Outros'}</td>
                          <td className="px-8 py-5 text-xs text-slate-500 font-medium">{cert.issuer}</td>
                          <td className="px-8 py-5 text-xs font-black dark:text-slate-300">{cert.expirationDate ? financial.formatDate(cert.expirationDate) : 'Sem Vencimento'}</td>
                          <td className="px-8 py-5">
                             <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                               status === 'expired' ? 'bg-rose-100 text-rose-600' : (status === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600')
                             }`}>
                               {status === 'expired' ? 'Vencida' : (status === 'warning' ? 'Próximo' : 'Válida')}
                             </span>
                          </td>
                          <td className="px-8 py-5 text-right">
                             {canEditBiddings && (
                               <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                 <button onClick={() => handleEditCertificate(cert)} className="p-2 text-slate-300 hover:text-indigo-500 transition-all"><Pencil size={16}/></button>
                                 <button onClick={() => requestDeleteCertificate(cert)} className="p-2 text-slate-300 hover:text-rose-500 transition-all"><Trash2 size={16}/></button>
                               </div>
                             )}
                          </td>
                        </tr>
                      );
                    })}
                 </tbody>
               </table>
               {filteredCertificates.length === 0 && <div className="py-20 text-center text-slate-300 uppercase text-[10px] font-black">Nenhuma certidão cadastrada.</div>}
            </div>
          </div>
        )}
      </div>

      <BiddingModal
        isOpen={biddingModalOpen}
        onClose={() => setBiddingModalOpen(false)}
        onSave={handleSaveBidding}
        bidding={editingBidding}
      />

      <CertificateModal
        isOpen={certModalOpen}
        onClose={() => setCertModalOpen(false)}
        onSave={handleSaveCertificate}
        certificate={editingCert}
      />

      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Confirmar exclusão"
        message={confirmDelete ? `Deseja realmente excluir "${confirmDelete.name}"? Esta ação não pode ser desfeita.` : ''}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
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
