
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
import JSZip from 'jszip';
import { 
  Briefcase, Plus, FileText, Calendar, DollarSign, 
  TrendingUp, Search, Filter, ShieldCheck, AlertCircle, 
  ArrowUpRight, Trash2, CheckCircle2, Clock, Landmark, ExternalLink, Pencil,
  Eye, Download, Paperclip, X, Loader2
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
  const [fileListModal, setFileListModal] = useState<{ certName: string; urls: string[]; mode: 'view' | 'download' } | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

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

  const getFileName = (url: string) => {
    try {
      const parts = url.split('/');
      const raw = parts[parts.length - 1];
      return decodeURIComponent(raw.replace(/^\d+-/, ''));
    } catch {
      return url.split('/').pop() || 'arquivo';
    }
  };

  const handleViewFiles = (cert: CompanyCertificate) => {
    const urls = cert.attachmentUrls ?? [];
    if (urls.length === 0) return;
    if (urls.length === 1) {
      window.open(urls[0], '_blank', 'noopener,noreferrer');
    } else {
      setFileListModal({ certName: cert.name, urls, mode: 'view' });
    }
  };

  const triggerSingleDownload = async (url: string) => {
    try {
      const response = await fetch(url, { credentials: 'include' });
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = getFileName(url);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('Erro ao baixar arquivo:', err);
      toast.error('Erro ao baixar o arquivo.');
    }
  };

  const triggerZipDownload = async (urls: string[], zipName: string) => {
    setIsDownloadingZip(true);
    try {
      const zip = new JSZip();
      const nameCount: Record<string, number> = {};

      await Promise.all(
        urls.map(async (url) => {
          try {
            const response = await fetch(url, { credentials: 'include' });
            const blob = await response.blob();
            let name = getFileName(url);
            if (nameCount[name]) {
              nameCount[name]++;
              const dotIdx = name.lastIndexOf('.');
              name = dotIdx > 0
                ? `${name.slice(0, dotIdx)} (${nameCount[name]})${name.slice(dotIdx)}`
                : `${name} (${nameCount[name]})`;
            } else {
              nameCount[name] = 1;
            }
            zip.file(name, blob);
          } catch (err) {
            console.error('Erro ao baixar arquivo para zip:', url, err);
          }
        }),
      );

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = `${zipName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast.success('Arquivos baixados com sucesso.');
    } catch (err) {
      console.error('Erro ao criar zip:', err);
      toast.error('Erro ao criar arquivo zip.');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleDownloadFiles = (cert: CompanyCertificate) => {
    const urls = cert.attachmentUrls ?? [];
    if (urls.length === 0) return;
    if (urls.length === 1) {
      void triggerSingleDownload(urls[0]);
    } else {
      void triggerZipDownload(urls, cert.name);
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
            {/* KPI GRID + ACTION BAR */}
            <div className="flex flex-wrap items-stretch gap-3">
              <KpiCard label="Propostas Total" value={financial.formatBRL(stats.totalPipeline)} icon={<TrendingUp size={16}/>} color="indigo" />
              <KpiCard label="Contratos Ganhos" value={financial.formatBRL(stats.wonValue)} icon={<CheckCircle2 size={16}/>} color="emerald" />
              <KpiCard label="Em Aberto" value={financial.formatBRL(stats.openValue)} icon={<Clock size={16}/>} color="amber" />
              <KpiCard label="Taxa de Vitórias" value={`${stats.winRate.toFixed(1)}%`} icon={<Briefcase size={16}/>} color="blue" />
              <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input placeholder="Buscar edital ou cliente..." className="pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-700 border-2 focus:border-indigo-500 rounded-xl outline-none transition-all text-xs font-bold w-56" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                {canEditBiddings && (
                  <button onClick={handleAddBidding} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all whitespace-nowrap">
                    <Plus size={14} /> Nova Proposta
                  </button>
                )}
              </div>
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
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${getStatusColor(b.status)}`}>{getStatusLabel(b.status)}</span>
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
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              {(cert.attachmentUrls ?? []).length > 0 && (
                                <>
                                  <button
                                    onClick={() => handleViewFiles(cert)}
                                    className="p-2 text-slate-300 hover:text-indigo-500 transition-all"
                                    title="Visualizar arquivo(s)"
                                  >
                                    <Eye size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDownloadFiles(cert)}
                                    className="p-2 text-slate-300 hover:text-emerald-500 transition-all"
                                    title="Baixar arquivo(s)"
                                  >
                                    <Download size={16} />
                                  </button>
                                </>
                              )}
                              {canEditBiddings && (
                                <>
                                  <button onClick={() => handleEditCertificate(cert)} className="p-2 text-slate-300 hover:text-indigo-500 transition-all"><Pencil size={16}/></button>
                                  <button onClick={() => requestDeleteCertificate(cert)} className="p-2 text-slate-300 hover:text-rose-500 transition-all"><Trash2 size={16}/></button>
                                </>
                              )}
                            </div>
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

      {/* File list modal for multi-file view/download */}
      {fileListModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={() => setFileListModal(null)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl">
                  <Paperclip size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">
                    {fileListModal.mode === 'view' ? 'Visualizar Arquivos' : 'Baixar Arquivos'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{fileListModal.certName}</p>
                </div>
              </div>
              <button onClick={() => setFileListModal(null)} className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
              {fileListModal.urls.map((url, index) => (
                <div key={url + index} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group">
                  <div className="flex items-center gap-3 min-w-0">
                    <Paperclip size={14} className="text-slate-400 shrink-0" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{getFileName(url)}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {fileListModal.mode === 'view' ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                        title="Visualizar"
                      >
                        <ExternalLink size={15} />
                      </a>
                    ) : (
                      <button
                        onClick={() => void triggerSingleDownload(url)}
                        className="p-2 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all"
                        title="Baixar"
                      >
                        <Download size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setFileListModal(null)}
                className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
              >
                Fechar
              </button>
              {fileListModal.mode === 'download' && (
                <button
                  onClick={() => {
                    void triggerZipDownload(fileListModal.urls, fileListModal.certName);
                    setFileListModal(null);
                  }}
                  disabled={isDownloadingZip}
                  className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isDownloadingZip ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  Baixar Todos (.zip)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const KpiCard = ({ label, value, icon, color }: any) => {
  const colors: any = {
    indigo: 'text-indigo-500',
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    blue: 'text-blue-500',
  };
  const c = colors[color] ?? colors.indigo;
  return (
    <div className="flex-1 flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className={c}>{icon}</div>
      <div className="leading-tight">
        <p className="text-sm font-black text-slate-800 dark:text-white">{value}</p>
        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
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

const getStatusLabel = (status: BiddingStatus) => {
  switch(status) {
    case 'PROSPECTING': return 'Prospecção';
    case 'DRAFTING': return 'Em Elaboração';
    case 'SUBMITTED': return 'Enviada';
    case 'WON': return 'Ganha';
    case 'LOST': return 'Perdida';
    default: return status;
  }
};
