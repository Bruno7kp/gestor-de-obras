
import React, { useState, useMemo, useEffect } from 'react';
import { Project, WorkforceMember, WorkforceRole, WorkItem } from '../types';
import { workforceService } from '../services/workforceService';
import { workforceApi } from '../services/workforceApi';
import { treeService } from '../services/treeService';
import { usePermissions } from '../hooks/usePermissions';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from '../hooks/useToast';
import { 
  Plus, Search, Trash2, Edit2, HardHat,
  X, UserCircle, Briefcase, User, ChevronDown, ChevronRight
} from 'lucide-react';

interface WorkforceManagerProps {
  project: Project;
  onUpdateProject: (data: Partial<Project>) => void;
  isReadOnly?: boolean;
}

export const WorkforceManager: React.FC<WorkforceManagerProps> = ({ project, onUpdateProject, isReadOnly = false }) => {
  const { canEdit, getLevel } = usePermissions();
  const canEditWorkforce = canEdit('workforce') && !isReadOnly;
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<WorkforceMember | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const workforce = project.workforce || [];
  const laborContracts = project.laborContracts || [];
  const expenses = project.expenses || [];

  const filteredMembers = useMemo(() => {
    return workforce.filter(m => 
      m.nome.toLowerCase().includes(search.toLowerCase()) || 
      m.cpf_cnpj.includes(search) ||
      m.cargo.toLowerCase().includes(search.toLowerCase())
    );
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
          nome: member.nome,
          cpf_cnpj: member.cpf_cnpj,
          empresa_vinculada: member.empresa_vinculada,
          foto: member.foto ?? null,
          cargo: member.cargo,
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

          const removedLinks = prevLinks.filter(id => !nextLinks.includes(id));
          const addedLinks = nextLinks.filter(id => !prevLinks.includes(id));

          await Promise.all(removedLinks.map(id => workforceApi.removeResponsibility(member.id, id)));
          await Promise.all(addedLinks.map(id => workforceApi.addResponsibility(member.id, id)));
        }
      } else {
        await workforceApi.create(project.id, {
          nome: member.nome,
          cpf_cnpj: member.cpf_cnpj,
          empresa_vinculada: member.empresa_vinculada,
          foto: member.foto ?? null,
          cargo: member.cargo,
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
        <div className="relative flex-1 w-full md:max-w-md">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
           <input placeholder="Buscar por nome, cargo ou CPF..." className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm outline-none focus:ring-4 focus:ring-indigo-500/10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-4">
          <span className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">
            {stats.total} Colaboradores
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
            <Plus size={18} /> Adicionar Colaborador
          </button>
        </div>
      </div>

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
                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900 text-indigo-600 text-[8px] font-black uppercase rounded-lg border border-indigo-100 dark:border-indigo-800">{member.cargo}</span>
                  </div>
                  <p className="text-[13px] font-bold text-slate-400 uppercase mt-1 truncate">{member.empresa_vinculada || 'Autônomo'} • {member.cpf_cnpj}</p>
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

      {isModalOpen && (
        <MemberModal 
          member={editingMember} 
          onClose={() => setIsModalOpen(false)} 
          onSave={handleSave} 
          allWorkItems={project.items}
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

const MemberModal = ({ member, onClose, onSave, allWorkItems }: any) => {
  const [data, setData] = useState<WorkforceMember>(member || workforceService.createMember('Servente'));
  const workTree = useMemo(() => treeService.buildTree(allWorkItems), [allWorkItems]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setExpandedIds(new Set());
  }, [member, allWorkItems]);

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

  const collectCategoryIds = (nodes: WorkItem[]): string[] => {
    return nodes.flatMap((node) => {
      const childIds = collectCategoryIds(node.children ?? []);
      return node.type === 'category' ? [node.id, ...childIds] : childIds;
    });
  };

  const categoryIds = useMemo(() => collectCategoryIds(workTree as WorkItem[]), [workTree]);

  const renderTreeNode = (node: WorkItem, depth: number) => {
    const itemIds = getItemIds(node);
    const checked = itemIds.length > 0 && itemIds.every((id) => data.linkedWorkItemIds.includes(id));
    const indeterminate =
      itemIds.length > 0 &&
      itemIds.some((id) => data.linkedWorkItemIds.includes(id)) &&
      !checked;
    const isCategory = node.type === 'category';
    const isExpanded = isCategory && expandedIds.has(node.id);

    return (
      <div key={node.id} className="space-y-2">
        <label
          className={`flex items-center gap-3 cursor-pointer group ${itemIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{ marginLeft: `${depth * 1.25}rem` }}
        >
          {isCategory ? (
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
          <span className={`text-[10px] font-bold ${node.type === 'category' ? 'text-slate-700 dark:text-slate-300 uppercase' : 'text-slate-600 dark:text-slate-400'} group-hover:text-indigo-600`}>
            {node.wbs} - {node.name}
          </span>
        </label>
        {isExpanded && node.children?.map((child) => renderTreeNode(child, depth + 1))}
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
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Nome Completo</label>
                    <input className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500" value={data.nome} onChange={e => setData({...data, nome: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">CPF / CNPJ</label>
                       <input className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none" value={data.cpf_cnpj} onChange={e => setData({...data, cpf_cnpj: e.target.value})} />
                     </div>
                     <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Cargo / Função</label>
                       <select className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none" value={data.cargo} onChange={e => setData({...data, cargo: e.target.value as any})}>
                         {['Engenheiro', 'Mestre', 'Encarregado', 'Eletricista', 'Encanador', 'Pedreiro', 'Servente', 'Carpinteiro'].map(r => <option key={r} value={r}>{r}</option>)}
                       </select>
                     </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Empresa Vinculada</label>
                    <input className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none" value={data.empresa_vinculada} onChange={e => setData({...data, empresa_vinculada: e.target.value})} />
                  </div>
               </div>

               <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Vínculo de Responsabilidade Técnica (EAP)</label>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setExpandedIds(new Set(categoryIds))}
                      className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-500 border rounded-lg hover:bg-slate-50"
                    >
                      Expandir tudo
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedIds(new Set())}
                      className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-500 border rounded-lg hover:bg-slate-50"
                    >
                      Recolher
                    </button>
                  </div>
                  <div className="max-h-[240px] overflow-y-auto border-2 border-slate-100 dark:border-slate-800 rounded-3xl p-4 bg-slate-50 dark:bg-slate-950 space-y-2">
                     {workTree.map((node: WorkItem) => renderTreeNode(node, 0))}
                  </div>
               </div>
            </div>

         </div>

         <div className="flex gap-4 pt-8 border-t dark:border-slate-800 mt-auto">
            <button onClick={onClose} className="flex-1 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
            <button onClick={() => onSave(data)} className="flex-[2] py-5 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Salvar Cadastro</button>
         </div>
      </div>
    </div>
  );
};

