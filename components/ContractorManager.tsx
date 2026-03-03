
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Contractor } from '../types';
import { 
  Plus, Search,
  Building2, MapPin, FileText,
  Phone, Mail, User, Trash2, Edit2, 
  CreditCard, Briefcase, CheckCircle2, XCircle,
  X, Landmark, Globe, DollarSign, Copy, Check
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ConfirmModal } from './ConfirmModal';
import { contractorsApi } from '../services/contractorsApi';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { DEFAULT_AUTONOMOUS_CARGOS, mergeCargoOptions } from '../utils/cargoOptions';

interface ContractorManagerProps {
  contractors: Contractor[];
  onUpdateContractors: (list: Contractor[]) => void;
}

export const ContractorManager: React.FC<ContractorManagerProps> = ({ contractors: homeContractors, onUpdateContractors }) => {
  const { getLevel } = usePermissions();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  // Cross-instance support
  const externalInstanceId = searchParams.get('instanceId') || undefined;
  const externalInstanceName = searchParams.get('instanceName') || undefined;
  const isExternal = !!externalInstanceId;

  const [externalContractors, setExternalContractors] = useState<Contractor[]>([]);
  const [externalLoading, setExternalLoading] = useState(false);
  const [cargoOptions, setCargoOptions] = useState<string[]>(DEFAULT_AUTONOMOUS_CARGOS);

  const loadExternalContractors = useCallback(async () => {
    if (!externalInstanceId) return;
    setExternalLoading(true);
    try {
      const list = await contractorsApi.listByInstance(externalInstanceId);
      setExternalContractors(list);
    } catch {
      setExternalContractors([]);
      toast.error('Falha ao carregar prestadores da instância externa');
    } finally {
      setExternalLoading(false);
    }
  }, [externalInstanceId]);

  useEffect(() => {
    if (isExternal) loadExternalContractors();
  }, [isExternal, loadExternalContractors]);

  const loadCargoOptions = useCallback(async () => {
    try {
      const instanceCargos = await contractorsApi.listCargoOptions(
        externalInstanceId || undefined,
      );
      setCargoOptions(
        mergeCargoOptions([...DEFAULT_AUTONOMOUS_CARGOS, ...instanceCargos]),
      );
    } catch {
      setCargoOptions(DEFAULT_AUTONOMOUS_CARGOS);
    }
  }, [externalInstanceId]);

  useEffect(() => {
    loadCargoOptions();
  }, [loadCargoOptions]);

  const contractors = isExternal ? externalContractors : homeContractors;
  const externalCanEdit = searchParams.get('canEdit') === '1';
  const canEdit = isExternal ? externalCanEdit : getLevel('workforce') === 'edit';

  // Unified update: routes to external state or home state
  const updateContractors = useCallback((list: Contractor[]) => {
    if (isExternal) {
      setExternalContractors(list);
    } else {
      onUpdateContractors(list);
    }
  }, [isExternal, onUpdateContractors]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [paymentModalContractor, setPaymentModalContractor] = useState<Contractor | null>(null);

  const filteredContractors = useMemo(() => {
    return contractors.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.cnpj.includes(search) ||
      c.city.toLowerCase().includes(search.toLowerCase()) ||
      c.specialty?.toLowerCase().includes(search.toLowerCase()) ||
      (c.cargo || '').toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => a.order - b.order);
  }, [contractors, search]);

  const stats = useMemo(() => ({
    active: contractors.filter(c => c.status === 'Ativo').length,
    cities: new Set(contractors.map(c => c.city).filter(Boolean)).size,
    total: contractors.length,
  }), [contractors]);

  const handleSave = async (data: Partial<Contractor>) => {
    if (editingContractor) {
      const previous = [...contractors];
      const optimistic = contractors.map(c => c.id === editingContractor.id ? { ...c, ...data } : c);
      updateContractors(optimistic);
      setIsModalOpen(false);
      setEditingContractor(null);

      try {
        const updated = await contractorsApi.update(editingContractor.id, { ...data, instanceId: externalInstanceId });
        updateContractors(contractors.map(c => c.id === editingContractor.id ? updated : c));
        toast.success('Prestador atualizado');
      } catch {
        updateContractors(previous);
        toast.error('Falha ao atualizar prestador');
      }
    } else {
      const tempId = crypto.randomUUID();
      const newContractor: Contractor = {
        id: tempId,
        name: data.name || '',
        cnpj: data.cnpj || '',
        type: (data.type as 'PJ' | 'Autônomo') || 'PJ',
        city: data.city || '',
        specialty: data.specialty,
        cargo: data.type === 'Autônomo' ? data.cargo ?? null : null,
        status: (data.status as 'Ativo' | 'Inativo') || 'Ativo',
        contactName: data.contactName || '',
        email: data.email || '',
        phone: data.phone || '',
        bankName: data.bankName || '',
        bankAgency: data.bankAgency || '',
        bankAccount: data.bankAccount || '',
        pixKey: data.pixKey,
        notes: data.notes || '',
        order: contractors.length,
      };

      const previous = [...contractors];
      updateContractors([...contractors, newContractor]);
      setIsModalOpen(false);
      setEditingContractor(null);

      try {
        const created = await contractorsApi.create({
          name: newContractor.name,
          cnpj: newContractor.cnpj,
          type: newContractor.type,
          city: newContractor.city,
          specialty: newContractor.specialty,
          cargo: newContractor.type === 'Autônomo' ? newContractor.cargo ?? null : null,
          status: newContractor.status,
          contactName: newContractor.contactName,
          email: newContractor.email,
          phone: newContractor.phone,
          bankName: newContractor.bankName,
          bankAgency: newContractor.bankAgency,
          bankAccount: newContractor.bankAccount,
          pixKey: newContractor.pixKey,
          notes: newContractor.notes,
          order: newContractor.order,
          instanceId: externalInstanceId,
        });
        updateContractors([...contractors, created]);
        toast.success('Prestador cadastrado');
      } catch {
        updateContractors(previous);
        toast.error('Falha ao cadastrar prestador');
      }
    }
  };

  const handleDelete = async (id: string) => {
    const previous = [...contractors];
    updateContractors(contractors.filter(c => c.id !== id));
    setConfirmDeleteId(null);

    try {
      await contractorsApi.remove(id, externalInstanceId);
      toast.success('Prestador removido');
    } catch {
      updateContractors(previous);
      toast.error('Falha ao remover prestador');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-12 animate-in fade-in duration-500 bg-slate-50 dark:bg-slate-950 custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
              Gestão de Prestadores
              {isExternal && externalInstanceName && (
                <span className="text-lg text-amber-600 dark:text-amber-400 ml-2">— {externalInstanceName}</span>
              )}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Prestadores de serviço, empreiteiros e contatos operacionais.
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => { setEditingContractor(null); setIsModalOpen(true); }}
              className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-xl shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all"
            >
              <Plus size={18} /> Novo Prestador
            </button>
          )}
        </div>

        {isExternal && externalInstanceName && (
          <div className="flex items-center gap-3 px-5 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl">
            <Globe size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                Prestadores da instância: {externalInstanceName}
              </p>
              <p className="text-[9px] text-amber-600/70 dark:text-amber-400/70 font-medium mt-0.5">
                {canEdit
                  ? 'Você tem permissão para editar os prestadores desta instância.'
                  : 'Visualização dos prestadores de outra empresa (somente leitura).'}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-stretch gap-3">
          <StatCard label="Total Ativos" value={stats.active} icon={<Building2 size={16} />} color="indigo" />
          <StatCard label="Cidades Atendidas" value={stats.cities} icon={<Landmark size={16} />} color="emerald" />
          <StatCard label="Total Cadastrados" value={stats.total} icon={<Briefcase size={16} />} color="amber" />
          <div className="ml-auto flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Buscar prestador..."
                className="pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-700 border-2 focus:border-indigo-500 rounded-xl outline-none transition-all text-xs font-bold w-56"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">

          {filteredContractors.length === 0 ? (
            <div className="p-16 text-center">
              <Briefcase className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={48} />
              <p className="text-sm font-bold text-slate-400">
                {search ? 'Nenhum prestador encontrado para esta busca' : 'Nenhum prestador cadastrado'}
              </p>
              {!search && canEdit && (
                <button
                  onClick={() => { setEditingContractor(null); setIsModalOpen(true); }}
                  className="mt-4 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest"
                >
                  <Plus size={14} className="inline mr-1" /> Cadastrar Primeiro Prestador
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Nome / Razão Social</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">Cidade Base</th>
                    <th className="px-6 py-4">Especialidade</th>
                    <th className="px-6 py-4">Contato</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredContractors.map(contractor => (
                    <tr key={contractor.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                            {contractor.type === 'PJ' ? <Building2 size={20} /> : <User size={20} />}
                          </div>
                          <div>
                            <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight block">{contractor.name}</span>
                            {contractor.cnpj && (
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{contractor.cnpj}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase border ${
                          contractor.type === 'PJ' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800'
                        }`}>
                          {contractor.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {contractor.city ? (
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                            <MapPin size={14} className="text-indigo-500" />
                            {contractor.city}
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-300 dark:text-slate-600 italic">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-1">
                          {contractor.cargo && (
                            <span className="px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800 text-[8px] font-black uppercase rounded-lg">
                              {contractor.cargo}
                            </span>
                          )}
                          {contractor.specialty ? (
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[8px] font-black uppercase rounded-lg">
                              {contractor.specialty}
                            </span>
                          ) : !contractor.cargo ? (
                            <span className="text-[9px] text-slate-300 dark:text-slate-600 italic">—</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {contractor.email && (
                            <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                              <Mail size={10} /> {contractor.email}
                            </div>
                          )}
                          {contractor.phone && (
                            <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                              <Phone size={10} /> {contractor.phone}
                            </div>
                          )}
                          {!contractor.email && !contractor.phone && (
                            <span className="text-[9px] text-slate-300 dark:text-slate-600 italic">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {contractor.status === 'Ativo' ? (
                            <CheckCircle2 size={14} className="text-emerald-500" />
                          ) : (
                            <XCircle size={14} className="text-rose-500" />
                          )}
                          <span className={`text-[9px] font-black uppercase ${contractor.status === 'Ativo' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {contractor.status}
                          </span>
                        </div>
                      </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setPaymentModalContractor(contractor)}
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all"
                              title="Dados de pagamento"
                            >
                              <DollarSign size={16} />
                            </button>
                            {canEdit && (
                              <button 
                                onClick={() => { setEditingContractor(contractor); setIsModalOpen(true); }}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                                title="Editar"
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                            {canEdit && (
                              <button 
                                onClick={() => setConfirmDeleteId(contractor.id)}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
                                title="Excluir"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <ContractorModal
          contractor={editingContractor}
          cargoOptions={cargoOptions}
          onClose={() => { setIsModalOpen(false); setEditingContractor(null); }}
          onSave={handleSave}
        />
      )}

      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Excluir Prestador"
        message="Deseja realmente excluir este prestador? Os membros de equipe vinculados perderão o vínculo."
        variant="danger"
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {paymentModalContractor && (
        <PaymentDataModal
          name={paymentModalContractor.name}
          bankName={paymentModalContractor.bankName}
          bankAgency={paymentModalContractor.bankAgency}
          bankAccount={paymentModalContractor.bankAccount}
          pixKey={paymentModalContractor.pixKey}
          onClose={() => setPaymentModalContractor(null)}
        />
      )}
    </div>
  );
};

const StatCard = ({ label, value, icon, color }: any) => {
  const colors: any = {
    indigo: 'text-indigo-500',
    amber: 'text-amber-500',
    emerald: 'text-emerald-500',
  };
  const c = colors[color] ?? colors.indigo;
  return (
    <div className="flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
      <div className={c}>{icon}</div>
      <div className="leading-tight">
        <p className="text-sm font-black text-slate-800 dark:text-white">{value}</p>
        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
    </div>
  );
};

const PaymentDataModal = ({ name, bankName, bankAgency, bankAccount, pixKey, onClose }: {
  name: string;
  bankName?: string;
  bankAgency?: string;
  bankAccount?: string;
  pixKey?: string;
  onClose: () => void;
}) => {
  const [copied, setCopied] = React.useState<string | null>(null);
  const copyToClipboard = (value: string, field: string) => {
    navigator.clipboard.writeText(value);
    setCopied(field);
    setTimeout(() => setCopied(null), 1500);
  };
  const hasAny = !!(bankName || bankAgency || bankAccount || pixKey);
  const fields = [
    { label: 'Banco', value: bankName, key: 'bank' },
    { label: 'Agência', value: bankAgency, key: 'agency' },
    { label: 'Conta', value: bankAccount, key: 'account' },
    { label: 'Chave PIX', value: pixKey, key: 'pix' },
  ];
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl"><DollarSign size={22} /></div>
            <div>
              <h2 className="text-lg font-black dark:text-white tracking-tight">Dados de Pagamento</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><X size={20} /></button>
        </div>
        <div className="p-8">
          {!hasAny ? (
            <div className="py-8 text-center">
              <CreditCard size={40} className="mx-auto text-slate-200 dark:text-slate-700 mb-3" />
              <p className="text-sm font-bold text-slate-400">Nenhum dado de pagamento cadastrado</p>
              <p className="text-[10px] text-slate-400 mt-1">Edite o cadastro para adicionar dados bancários.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map(f => f.value ? (
                <div key={f.key} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{f.label}</p>
                    <p className="text-sm font-black text-slate-700 dark:text-slate-200 mt-0.5">{f.value}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(f.value!, f.key)}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-xl transition-all"
                    title="Copiar"
                  >
                    {copied === f.key ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                  </button>
                </div>
              ) : null)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─────────────── Modal de Cadastro/Edição ─────────────── */

interface ContractorModalProps {
  contractor: Contractor | null;
  cargoOptions: string[];
  onClose: () => void;
  onSave: (data: Partial<Contractor>) => void;
}

const ContractorModal: React.FC<ContractorModalProps> = ({
  contractor,
  cargoOptions,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(contractor?.name ?? '');
  const [cnpj, setCnpj] = useState(contractor?.cnpj ?? '');
  const [type, setType] = useState<'PJ' | 'Autônomo'>(contractor?.type ?? 'PJ');
  const [status, setStatus] = useState<'Ativo' | 'Inativo'>(contractor?.status ?? 'Ativo');
  const [city, setCity] = useState(contractor?.city ?? '');
  const [specialty, setSpecialty] = useState(contractor?.specialty ?? '');
  const [cargo, setCargo] = useState(contractor?.cargo ?? '');
  const [contactName, setContactName] = useState(contractor?.contactName ?? '');
  const [email, setEmail] = useState(contractor?.email ?? '');
  const [phone, setPhone] = useState(contractor?.phone ?? '');
  const [bankName, setBankName] = useState(contractor?.bankName ?? '');
  const [bankAgency, setBankAgency] = useState(contractor?.bankAgency ?? '');
  const [bankAccount, setBankAccount] = useState(contractor?.bankAccount ?? '');
  const [pixKey, setPixKey] = useState(contractor?.pixKey ?? '');
  const [notes, setNotes] = useState(contractor?.notes ?? '');
  const [showCargoDropdown, setShowCargoDropdown] = useState(false);
  const cargoInputRef = React.useRef<HTMLInputElement>(null);
  const cargoDropdownRef = React.useRef<HTMLDivElement>(null);

  const cargoSuggestions = useMemo(() => {
    if (!cargo.trim()) return cargoOptions;
    const query = cargo.toLowerCase();
    return cargoOptions.filter((option) => option.toLowerCase().includes(query));
  }, [cargo, cargoOptions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        cargoDropdownRef.current &&
        !cargoDropdownRef.current.contains(event.target as Node) &&
        cargoInputRef.current &&
        !cargoInputRef.current.contains(event.target as Node)
      ) {
        setShowCargoDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      cnpj,
      type,
      status,
      city,
      specialty: specialty || undefined,
      cargo: type === 'Autônomo' ? cargo || undefined : undefined,
      contactName,
      email,
      phone,
      bankName,
      bankAgency,
      bankAccount,
      pixKey: pixKey || undefined,
      notes,
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black dark:text-white uppercase tracking-tight">
                {contractor ? 'Editar Prestador' : 'Novo Prestador'}
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Dados Cadastrais e Financeiros</p>
            </div>
            <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Razão Social / Nome *</label>
                <input value={name} onChange={e => setName(e.target.value)} required className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl text-xs font-bold outline-none transition-all dark:text-white" placeholder="Nome da Empresa ou Profissional" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">CNPJ / CPF</label>
                <input value={cnpj} onChange={e => setCnpj(e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl text-xs font-bold outline-none transition-all dark:text-white" placeholder="00.000.000/0000-00" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Tipo de Prestador</label>
                <select value={type} onChange={e => setType(e.target.value as 'PJ' | 'Autônomo')} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl text-xs font-bold outline-none transition-all dark:text-white">
                  <option value="PJ">Empreiteiro (PJ)</option>
                  <option value="Autônomo">Prestador Autônomo</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value as 'Ativo' | 'Inativo')} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl text-xs font-bold outline-none transition-all dark:text-white">
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Cidade Base</label>
                <input value={city} onChange={e => setCity(e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl text-xs font-bold outline-none transition-all dark:text-white" placeholder="Ex: São Paulo" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Especialidade</label>
                <input value={specialty} onChange={e => setSpecialty(e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl text-xs font-bold outline-none transition-all dark:text-white" placeholder="Ex: Elétrica, Hidráulica..." />
              </div>
            </div>

            {type === 'Autônomo' && (
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Cargo (Autônomo)</label>
                  <div className="relative">
                    <input
                      ref={cargoInputRef}
                      value={cargo}
                      onChange={e => {
                        setCargo(e.target.value);
                        setShowCargoDropdown(true);
                      }}
                      onFocus={() => setShowCargoDropdown(true)}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl text-xs font-bold outline-none transition-all dark:text-white"
                      placeholder="Digite ou selecione o cargo"
                    />
                    {showCargoDropdown && cargoSuggestions.length > 0 && (
                      <div
                        ref={cargoDropdownRef}
                        className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl max-h-48 overflow-y-auto"
                      >
                        {cargoSuggestions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            className="w-full text-left px-5 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors text-xs font-bold text-slate-700 dark:text-slate-200"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              setCargo(option);
                              setShowCargoDropdown(false);
                            }}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Contato</label>
                <input value={contactName} onChange={e => setContactName(e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl text-xs font-bold outline-none transition-all dark:text-white" placeholder="Nome do contato" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">E-mail</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl text-xs font-bold outline-none transition-all dark:text-white" placeholder="email@empresa.com" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Telefone</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl text-xs font-bold outline-none transition-all dark:text-white" placeholder="(00) 00000-0000" />
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700 space-y-6">
              <h3 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                <CreditCard size={14} /> Dados para Pagamento
              </h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Banco</label>
                  <input value={bankName} onChange={e => setBankName(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-slate-900 border-2 border-transparent focus:border-indigo-500 rounded-xl text-xs font-bold outline-none transition-all dark:text-white" placeholder="Itaú, Bradesco..." />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Agência</label>
                  <input value={bankAgency} onChange={e => setBankAgency(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-slate-900 border-2 border-transparent focus:border-indigo-500 rounded-xl text-xs font-bold outline-none transition-all dark:text-white" placeholder="0000" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Conta</label>
                  <input value={bankAccount} onChange={e => setBankAccount(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-slate-900 border-2 border-transparent focus:border-indigo-500 rounded-xl text-xs font-bold outline-none transition-all dark:text-white" placeholder="00000-0" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Chave PIX (Opcional)</label>
                <input value={pixKey} onChange={e => setPixKey(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-slate-900 border-2 border-transparent focus:border-indigo-500 rounded-xl text-xs font-bold outline-none transition-all dark:text-white" placeholder="CNPJ, E-mail, Celular..." />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Observações Internas</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl text-xs font-bold outline-none transition-all dark:text-white resize-none" placeholder="Detalhes sobre contratos, especialidades..." />
            </div>
          </div>

          <div className="p-8 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-4">
            <button type="button" onClick={onClose} className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
            <button type="submit" className="px-10 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all">
              {contractor ? 'Salvar Alterações' : 'Cadastrar Prestador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
