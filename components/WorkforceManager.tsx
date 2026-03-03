
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Project, WorkforceMember, WorkItem, Contractor } from '../types';
import { workforceApi } from '../services/workforceApi';
import { contractorsApi } from '../services/contractorsApi';
import { treeService } from '../services/treeService';
import { usePermissions } from '../hooks/usePermissions';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from '../hooks/useToast';
import { uiPreferences } from '../utils/uiPreferences';
import { 
  Plus, Search, Trash2, Edit2, HardHat,
  X, UserCircle, Briefcase, User, ChevronDown, ChevronRight, Loader2,
  LayoutGrid, Table
} from 'lucide-react';

const CARGO_OPTIONS = ['Carpinteiro', 'Eletricista', 'Encanador', 'Encarregado', 'Engenheiro', 'Mestre', 'Pedreiro', 'Pintor', 'Servente'];

interface WorkforceManagerProps {
  project: Project;
  contractors: Contractor[];
  onUpdateProject: (data: Partial<Project>) => void;
  onContractorCreated?: (c: Contractor) => void;
  isReadOnly?: boolean;
}

export const WorkforceManager: React.FC<WorkforceManagerProps> = ({ project, contractors, onUpdateProject, onContractorCreated, isReadOnly = false }) => {
  const { canEdit, getLevel } = usePermissions();
  const canEditWorkforce = canEdit('workforce') && !isReadOnly;
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<WorkforceMember | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => (uiPreferences.getString('workforce_view_mode') as 'cards' | 'table') || 'cards');

  const handleViewMode = (mode: 'cards' | 'table') => {
    setViewMode(mode);
    uiPreferences.setString('workforce_view_mode', mode);
  };

  const workforce = project.workforce || [];
  const laborContracts = project.laborContracts || [];
  const expenses = project.expenses || [];

  const filteredMembers = useMemo(() => {
    return workforce.filter(m => {
      const matchesSearch = m.nome.toLowerCase().includes(search.toLowerCase()) || 
        m.cpf_cnpj.includes(search) ||
        (m.cargo || '').toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    });
  }, [workforce, search]);

  const stats = useMemo(() => ({
    total: workforce.length,
  }), [workforce]);

  const paidByMember = useMemo(() => {
    const paidExpenseIds = new Set(
      expenses
        .filter(e => e.type === 'labor' && (e.isPaid || e.status === 'PAID'))
        .map(e => e.id)
    );

    return laborContracts.reduce<Record<string, number>>((acc, contract) => {
      const paidTotal = (contract.pagamentos || []).reduce((sum, payment) => {
        if (!paidExpenseIds.has(payment.id)) return sum;
        return sum + (payment.valor || 0);
      }, 0);

      if (paidTotal > 0) {
        acc[contract.associadoId] = (acc[contract.associadoId] || 0) + paidTotal;
      }

      return acc;
    }, {});
  }, [laborContracts, expenses]);

  const refreshWorkforce = async () => {
    const list = await workforceApi.list(project.id);
    onUpdateProject({ workforce: list });
  };

  const handleSave = async (member: WorkforceMember) => {
    if (!canEditWorkforce) {
      toast.warning('Obra arquivada: edição, cadastro e remoção estão bloqueados.');
      return;
    }

    const previous = workforce;
    const exists = workforce.some(m => m.id === member.id);
    const optimistic = exists
      ? workforce.map(m => m.id === member.id ? member : m)
      : [...workforce, member];

    onUpdateProject({ workforce: optimistic });

    try {
      if (exists) {
        const prevMember = workforce.find(m => m.id === member.id);
        await workforceApi.update(member.id, {
          foto: member.foto ?? null,
        });

        if (prevMember) {
          const prevDocs = prevMember.documentos ?? [];
          const nextDocs = member.documentos ?? [];

          const removedDocs = prevDocs.filter(doc => !nextDocs.find(next => next.id === doc.id));
          const addedDocs = nextDocs.filter(doc => !prevDocs.find(prev => prev.id === doc.id));

          const updatedDocs = nextDocs.filter(doc => {
            const prev = prevDocs.find(prevDoc => prevDoc.id === doc.id);
            if (!prev) return false;
            return prev.nome !== doc.nome || prev.dataVencimento !== doc.dataVencimento || prev.status !== doc.status || prev.arquivoUrl !== doc.arquivoUrl;
          });

          await Promise.all(removedDocs.map(doc => workforceApi.removeDocument(member.id, doc.id)));
          await Promise.all(updatedDocs.map(doc => workforceApi.removeDocument(member.id, doc.id)));
          await Promise.all([
            ...addedDocs,
            ...updatedDocs,
          ].map(doc => workforceApi.addDocument(member.id, {
            id: doc.id,
            nome: doc.nome,
            dataVencimento: doc.dataVencimento,
            arquivoUrl: doc.arquivoUrl,
            status: doc.status,
          })));

          const prevLinks = prevMember.linkedWorkItemIds ?? [];
          const nextLinks = member.linkedWorkItemIds ?? [];

          const linksChanged = prevLinks.length !== nextLinks.length ||
            prevLinks.some(id => !nextLinks.includes(id)) ||
            nextLinks.some(id => !prevLinks.includes(id));

          if (linksChanged) {
            await workforceApi.syncResponsibilities(member.id, nextLinks);
          }
        }
      } else {
        await workforceApi.create(project.id, {
          contractorId: member.contractorId ?? null,
          foto: member.foto ?? null,
          documentos: member.documentos,
          linkedWorkItemIds: member.linkedWorkItemIds,
        });
      }

      await refreshWorkforce();
    } catch (error) {
      console.error('Erro ao salvar colaborador:', error);
      onUpdateProject({ workforce: previous });
    }

    setIsModalOpen(false);
    setEditingMember(null);
  };

  const removeMember = async (id: string) => {
    if (!canEditWorkforce) {
      toast.warning('Obra arquivada: edição, cadastro e remoção estão bloqueados.');
      return;
    }

    setConfirmDeleteId(null);
    const previous = workforce;
    onUpdateProject({ workforce: workforce.filter(m => m.id !== id) });
    try {
      await workforceApi.remove(id);
      await refreshWorkforce();
      toast.success('Funcionário removido com sucesso.');
    } catch (error) {
      console.error('Erro ao remover colaborador:', error);
      onUpdateProject({ workforce: previous });
      toast.error('Erro ao remover funcionário.');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-1 w-full gap-4">
          <div className="relative flex-1 md:max-w-md">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
             <input placeholder="Buscar por nome, cargo ou CPF..." className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm outline-none focus:ring-4 focus:ring-indigo-500/10" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            <button
              onClick={() => handleViewMode('cards')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'cards' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Visualização em cards"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => handleViewMode('table')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Visualização em tabela"
            >
              <Table size={16} />
            </button>
          </div>
          <span className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">
            {stats.total} Prestadores
          </span>
          <button 
            onClick={() => { if (canEditWorkforce) { setEditingMember(null); setIsModalOpen(true); } }}
            disabled={!canEditWorkforce}
            className={`flex items-center gap-2 px-8 py-3.5 font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl transition-all ${
              canEditWorkforce
                ? 'bg-indigo-600 text-white hover:scale-105'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Plus size={18} /> Adicionar Prestador
          </button>
        </div>
      </div>

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredMembers.map(member => (
            <div key={member.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all group flex items-center gap-6">
               <div className="relative">
                 {member.foto ? (
                   <img src={member.foto} className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md" />
                 ) : (
                   <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300">
                     <UserCircle size={32} />
                   </div>
                 )}
               </div>

               <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase truncate">{member.nome || 'Sem Nome'}</h3>
                    {!!member.cargo && (
                      <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900 text-indigo-600 text-[8px] font-black uppercase rounded-lg border border-indigo-100 dark:border-indigo-800">{member.cargo}</span>
                    )}
                  </div>
                  <p className="text-[13px] font-bold text-slate-400 uppercase mt-1 truncate">{member.contractor?.name || member.empresa_vinculada || 'Autônomo'}{member.cpf_cnpj ? ` • ${member.cpf_cnpj}` : ''}</p>
                  <p className="text-[12px] text-indigo-500 font-bold mt-1">Responsável por {member.linkedWorkItemIds.length} itens da EAP</p>
                  <p className="text-[12px] text-slate-500 font-bold mt-1">
                    Total pago: R$ {(paidByMember[member.id] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
               </div>

               <div className="flex gap-2">
                  <button disabled={!canEditWorkforce} onClick={() => { if (canEditWorkforce) { setEditingMember(member); setIsModalOpen(true); } }} className={`p-3 rounded-xl transition-all ${canEditWorkforce ? 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600' : 'bg-slate-100 dark:bg-slate-900 text-slate-300 cursor-not-allowed'}`}><Edit2 size={16}/></button>
                  <button disabled={!canEditWorkforce} onClick={() => { if (canEditWorkforce) setConfirmDeleteId(member.id); }} className={`p-3 rounded-xl transition-all ${canEditWorkforce ? 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-500' : 'bg-slate-100 dark:bg-slate-900 text-slate-300 cursor-not-allowed'}`}><Trash2 size={16}/></button>
               </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">Cargo</th>
                  <th className="px-6 py-4">Empresa / Prestador</th>
                  <th className="px-6 py-4">CPF / CNPJ</th>
                  <th className="px-6 py-4">Itens EAP</th>
                  <th className="px-6 py-4">Total Pago</th>
                  {canEditWorkforce && <th className="px-6 py-4 text-center">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredMembers.map(member => (
                  <tr key={member.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {member.foto ? (
                          <img src={member.foto} className="w-9 h-9 rounded-xl object-cover border border-white shadow-sm" />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300">
                            <UserCircle size={20} />
                          </div>
                        )}
                        <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">{member.nome || 'Sem Nome'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {member.cargo ? (
                        <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[8px] font-black uppercase rounded-lg border border-indigo-100 dark:border-indigo-800">{member.cargo}</span>
                      ) : (
                        <span className="text-[9px] text-slate-300 dark:text-slate-600 italic">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{member.contractor?.name || member.empresa_vinculada || 'Autônomo'}</span>
                    </td>
                    <td className="px-6 py-4">
                      {member.cpf_cnpj ? (
                        <span className="text-[10px] font-bold text-slate-400 tracking-wide">{member.cpf_cnpj}</span>
                      ) : (
                        <span className="text-[9px] text-slate-300 dark:text-slate-600 italic">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-indigo-500">{member.linkedWorkItemIds.length}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">R$ {(paidByMember[member.id] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </td>
                    {canEditWorkforce && (
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => { setEditingMember(member); setIsModalOpen(true); }} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-all"><Edit2 size={14}/></button>
                          <button onClick={() => setConfirmDeleteId(member.id)} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-500 transition-all"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <MemberModal 
          member={editingMember} 
          contractors={contractors}
          onClose={() => setIsModalOpen(false)} 
          onSave={handleSave} 
          allWorkItems={project.items}
          projectInstanceId={project.instanceId}
          onContractorCreated={onContractorCreated}
        />
      )}

      <ConfirmModal
        isOpen={!!confirmDeleteId && canEditWorkforce}
        title="Excluir funcionário"
        message="Deseja realmente excluir este funcionário do quadro permanente? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => confirmDeleteId && removeMember(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
};

const MemberModal = ({ member, contractors, onClose, onSave, allWorkItems, projectInstanceId, onContractorCreated }: any) => {
  const toast = useToast();
  const [data, setData] = useState<WorkforceMember>(
    member || {
      id: crypto.randomUUID(),
      nome: '',
      cpf_cnpj: '',
      empresa_vinculada: '',
      contractorId: undefined,
      contractor: undefined,
      cargo: '',
      documentos: [],
      linkedWorkItemIds: [],
      foto: undefined,
    },
  );
  const [contractorSearch, setContractorSearch] = useState(member?.contractor?.name || member?.empresa_vinculada || '');
  const [showContractorDropdown, setShowContractorDropdown] = useState(false);
  const contractorInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Inline contractor creation state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newType, setNewType] = useState<'PJ' | 'Autônomo'>('PJ');
  const [newCargo, setNewCargo] = useState('');
  const [newCpfCnpj, setNewCpfCnpj] = useState('');
  const [creatingContractor, setCreatingContractor] = useState(false);

  const workTree = useMemo(() => treeService.buildTree(allWorkItems), [allWorkItems]);

  const collectCategoryIds = (nodes: WorkItem[]): string[] => {
    return nodes.flatMap((node) => {
      const childIds = collectCategoryIds(node.children ?? []);
      return node.type === 'category' ? [node.id, ...childIds] : childIds;
    });
  };

  const categoryIds = useMemo(() => collectCategoryIds(workTree as WorkItem[]), [workTree]);

  const EAP_SHOW_ITEMS_KEY = 'workforce_eap_show_items';
  const [showItems, setShowItems] = useState<boolean>(() => {
    return uiPreferences.getString(EAP_SHOW_ITEMS_KEY) === '1';
  });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const contractorSuggestions = useMemo(() => {
    if (!contractorSearch.trim()) return (contractors as Contractor[]) || [];
    return ((contractors as Contractor[]) || []).filter(c =>
      c.name.toLowerCase().includes(contractorSearch.toLowerCase())
    );
  }, [contractors, contractorSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          contractorInputRef.current && !contractorInputRef.current.contains(e.target as Node)) {
        setShowContractorDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectContractor = (c: Contractor) => {
    setData({
      ...data,
      contractorId: c.id,
      contractor: c,
      empresa_vinculada: c.name,
      nome: c.name,
      cpf_cnpj: c.cnpj || data.cpf_cnpj,
      cargo: c.type === 'Autônomo' ? c.cargo || '' : '',
    });
    setContractorSearch(c.name);
    setShowContractorDropdown(false);
  };

  const clearContractor = () => {
    if (member) return;
    setData({ ...data, contractorId: undefined, contractor: undefined, empresa_vinculada: '', nome: '', cpf_cnpj: '', cargo: '' });
    setContractorSearch('');
    setShowCreateForm(false);
  };

  const hasNoResults = contractorSearch.trim().length > 0 && contractorSuggestions.length === 0 && !member;

  const handleCreateContractor = useCallback(async () => {
    const trimmedName = contractorSearch.trim();
    if (!trimmedName) return;
    setCreatingContractor(true);
    try {
      const created = await contractorsApi.create({
        name: trimmedName,
        type: newType,
        cargo: newType === 'Autônomo' ? newCargo : undefined,
        cnpj: newCpfCnpj,
        instanceId: projectInstanceId,
      });
      onContractorCreated?.(created);
      setData({
        ...data,
        contractorId: created.id,
        contractor: created,
        empresa_vinculada: created.name,
        nome: created.name,
        cpf_cnpj: created.cnpj || '',
        cargo: created.type === 'Autônomo' ? created.cargo || '' : '',
      });
      setContractorSearch(created.name);
      setShowContractorDropdown(false);
      setShowCreateForm(false);
      setNewType('PJ');
      setNewCargo('');
      setNewCpfCnpj('');
      toast.success(`Prestador "${trimmedName}" cadastrado com sucesso.`);
    } catch {
      toast.error('Erro ao cadastrar prestador.');
    } finally {
      setCreatingContractor(false);
    }
  }, [contractorSearch, newType, newCargo, newCpfCnpj, projectInstanceId, onContractorCreated, data]);

  const handleSaveDirect = () => {
    if (!data.contractorId) return;
    onSave(data);
  };

  const getItemIds = (node: WorkItem): string[] => {
    const children = node.children ?? [];
    const childIds = children.flatMap(getItemIds);
    if (node.type === 'item') return [node.id, ...childIds];
    return childIds;
  };

  const toggleItemIds = (ids: string[], checked: boolean) => {
    if (ids.length === 0) return;
    const current = new Set(data.linkedWorkItemIds);
    ids.forEach((id) => {
      if (checked) current.add(id);
      else current.delete(id);
    });
    setData({ ...data, linkedWorkItemIds: Array.from(current) });
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderTreeNode = (node: WorkItem, depth: number) => {
    const isCategory = node.type === 'category';

    // When items are hidden, skip non-category leaf nodes
    if (!isCategory && !showItems) return null;

    const itemIds = getItemIds(node);
    const checked = itemIds.length > 0 && itemIds.every((id) => data.linkedWorkItemIds.includes(id));
    const indeterminate =
      itemIds.length > 0 &&
      itemIds.some((id) => data.linkedWorkItemIds.includes(id)) &&
      !checked;
    const isExpanded = isCategory && expandedIds.has(node.id);
    const hasChildren = isCategory && (node.children?.length ?? 0) > 0;

    return (
      <div key={node.id} className="space-y-2">
        <label
          className={`flex items-center gap-3 cursor-pointer group ${itemIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{ marginLeft: `${depth * 1.25}rem` }}
        >
          {isCategory && hasChildren && showItems ? (
            <button
              type="button"
              className="p-1 rounded-md text-slate-400 bg-slate-100 dark:bg-slate-800 group-hover:text-indigo-600"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                toggleExpanded(node.id);
              }}
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : isCategory ? (
            <div className="w-5" />
          ) : (
            <div className="w-5" />
          )}
          <input
            type="checkbox"
            className="w-4 h-4 rounded text-indigo-600 focus:ring-0"
            checked={checked}
            disabled={itemIds.length === 0}
            ref={(el) => {
              if (el) el.indeterminate = indeterminate;
            }}
            onChange={(e) => toggleItemIds(itemIds, e.target.checked)}
          />
          <span className={`text-[10px] font-bold ${isCategory ? 'text-slate-700 dark:text-slate-300 uppercase' : 'text-slate-600 dark:text-slate-400'} group-hover:text-indigo-600`}>
            {node.wbs} - {node.name}
          </span>
        </label>
        {isCategory && (showItems ? isExpanded : true) && node.children?.map((child) => renderTreeNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[3rem] p-10 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
         <h2 className="text-2xl font-black mb-8 dark:text-white uppercase tracking-tight">{member ? 'Editar Colaborador' : 'Novo Cadastro'}</h2>
         
         <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-6">
                  <div className="relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Profissional ou Empresa Vinculada</label>
                    <input 
                      ref={contractorInputRef}
                      className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500" 
                      value={contractorSearch} 
                      onChange={e => {
                        if (member) return;
                        setContractorSearch(e.target.value);
                        setShowContractorDropdown(true);
                        if (!e.target.value.trim()) {
                          clearContractor();
                        }
                      }}
                      onFocus={() => !member && setShowContractorDropdown(true)}
                      placeholder="Digite para buscar prestador..."
                      readOnly={!!member}
                    />
                    {data.contractorId && !member && (
                      <button 
                        type="button"
                        onClick={clearContractor}
                        className="absolute right-3 top-[2.6rem] text-slate-400 hover:text-rose-500"
                      >
                        <X size={14} />
                      </button>
                    )}
                    {showContractorDropdown && contractorSuggestions.length > 0 && (
                      <div ref={dropdownRef} className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl max-h-48 overflow-y-auto">
                        {contractorSuggestions.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left px-5 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors flex items-center gap-3"
                            onMouseDown={(e) => { e.preventDefault(); selectContractor(c); }}
                          >
                            <span className="text-xs font-black text-slate-700 dark:text-slate-200">{c.name}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">{c.type}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {showContractorDropdown && hasNoResults && !showCreateForm && (
                      <div ref={dropdownRef} className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl p-4">
                        <p className="text-[10px] font-bold text-slate-400 mb-3">
                          Nenhum prestador encontrado.
                        </p>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); setShowCreateForm(true); setShowContractorDropdown(false); }}
                          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors w-full justify-center"
                        >
                          <Plus size={14} /> Cadastrar "{contractorSearch.trim()}"
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Inline contractor creation form */}
                  {showCreateForm && !data.contractorId && (
                    <div className="p-5 bg-indigo-50 dark:bg-indigo-950/30 border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Novo Prestador: {contractorSearch.trim()}</h4>
                        <button type="button" onClick={() => setShowCreateForm(false)} className="text-slate-400 hover:text-rose-500">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Tipo</label>
                          <select
                            value={newType}
                            onChange={(e) => { setNewType(e.target.value as 'PJ' | 'Autônomo'); if (e.target.value === 'PJ') setNewCargo(''); }}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 dark:text-white"
                          >
                            <option value="PJ">Empreiteiro (PJ)</option>
                            <option value="Autônomo">Prestador Autônomo</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">CPF / CNPJ</label>
                          <input
                            value={newCpfCnpj}
                            onChange={(e) => setNewCpfCnpj(e.target.value)}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 dark:text-white"
                            placeholder="00.000.000/0000-00"
                          />
                        </div>
                      </div>
                      {newType === 'Autônomo' && (
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Cargo</label>
                          <select
                            value={newCargo}
                            onChange={(e) => setNewCargo(e.target.value)}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 dark:text-white"
                          >
                            <option value="">Selecione o cargo</option>
                            {CARGO_OPTIONS.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleCreateContractor}
                        disabled={creatingContractor}
                        className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {creatingContractor ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        {creatingContractor ? 'Cadastrando...' : 'Cadastrar e Vincular'}
                      </button>
                    </div>
                  )}

                  {!showCreateForm && (
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">CPF / CNPJ</label>
                         <input className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-sm font-black outline-none text-slate-500" value={data.cpf_cnpj} readOnly />
                       </div>
                       <div>
                         <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Cargo / Função</label>
                         <input className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-sm font-black outline-none text-slate-500" value={data.cargo || '-'} readOnly />
                       </div>
                    </div>
                  )}
               </div>

               <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Vínculo de Responsabilidade Técnica (EAP)</label>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !showItems;
                        setShowItems(next);
                        uiPreferences.setString(EAP_SHOW_ITEMS_KEY, next ? '1' : '0');
                        if (!next) setExpandedIds(new Set());
                      }}
                      className={`px-3 py-1.5 text-[9px] font-black uppercase border rounded-lg transition-colors ${
                        showItems
                          ? 'text-indigo-600 border-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-700'
                          : 'text-slate-500 border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 dark:border-slate-700'
                      }`}
                    >
                      {showItems ? 'Apenas Grupos' : 'Mostrar Itens'}
                    </button>
                    {showItems && (
                      <>
                        <button
                          type="button"
                          onClick={() => setExpandedIds(new Set(categoryIds))}
                          className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-500 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 dark:border-slate-700 transition-colors"
                        >
                          Expandir tudo
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedIds(new Set())}
                          className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-500 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 dark:border-slate-700 transition-colors"
                        >
                          Recolher
                        </button>
                      </>
                    )}
                  </div>
                  <div className="max-h-[240px] overflow-y-auto border-2 border-slate-100 dark:border-slate-800 rounded-3xl p-4 bg-slate-50 dark:bg-slate-950 space-y-2">
                     {workTree.map((node: WorkItem) => renderTreeNode(node, 0))}
                  </div>
               </div>
            </div>

         </div>

         <div className="flex gap-4 pt-8 border-t dark:border-slate-800 mt-auto">
            <button onClick={onClose} className="flex-1 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
            <button onClick={handleSaveDirect} disabled={!data.contractorId} className={`flex-[2] py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl transition-all ${data.contractorId ? 'bg-indigo-600 text-white active:scale-95' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}>Salvar Cadastro</button>
         </div>
      </div>
    </div>
  );
};

