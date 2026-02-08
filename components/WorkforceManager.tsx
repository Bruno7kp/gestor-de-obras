
import React, { useState, useMemo } from 'react';
import { Project, WorkforceMember, WorkforceRole, WorkItem } from '../types';
import { workforceService } from '../services/workforceService';
import { workforceApi } from '../services/workforceApi';
import { usePermissions } from '../hooks/usePermissions';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from '../hooks/useToast';
import { 
  Plus, Search, Trash2, Edit2, ShieldCheck, AlertCircle, HardHat, FileText,
  X, UserCircle, Briefcase, User, Lock
} from 'lucide-react';

interface WorkforceManagerProps {
  project: Project;
  onUpdateProject: (data: Partial<Project>) => void;
}

export const WorkforceManager: React.FC<WorkforceManagerProps> = ({ project, onUpdateProject }) => {
  const { canEdit, getLevel } = usePermissions();
  const canEditWorkforce = canEdit('workforce');
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
      {!canEditWorkforce && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
          <Lock size={18} className="text-amber-600 flex-shrink-0" />
          <span className="text-amber-800">Você tem apenas permissão de leitura. Para editar colaboradores, solicite acesso ao administrador.</span>
        </div>
      )}

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
            onClick={() => { setEditingMember(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-8 py-3.5 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl hover:scale-105 transition-all"
          >
            <Plus size={18} /> Adicionar Colaborador
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredMembers.map(member => {
          const status = workforceService.getMemberGlobalStatus(member);
          return (
            <div key={member.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all group flex items-center gap-6">
               <div className="relative">
                 {member.foto ? (
                   <img src={member.foto} className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md" />
                 ) : (
                   <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300">
                     <UserCircle size={32} />
                   </div>
                 )}
                 <div className={`absolute -bottom-1 -right-1 p-1 rounded-lg text-white shadow-lg ${
                   status === 'apto' ? 'bg-emerald-500' : status === 'vencido' ? 'bg-rose-500' : 'bg-amber-500'
                 }`}>
                   {status === 'apto' ? <ShieldCheck size={12}/> : <AlertCircle size={12}/>}
                 </div>
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
                  <button onClick={() => { setEditingMember(member); setIsModalOpen(true); }} className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 rounded-xl transition-all"><Edit2 size={16}/></button>
                  <button onClick={() => setConfirmDeleteId(member.id)} className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-500 rounded-xl transition-all"><Trash2 size={16}/></button>
               </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <MemberModal 
          member={editingMember} 
          onClose={() => setIsModalOpen(false)} 
          onSave={handleSave} 
          allWorkItems={project.items.filter(i => i.type === 'item')}
        />
      )}

      <ConfirmModal
        isOpen={!!confirmDeleteId}
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
                  <div className="max-h-[220px] overflow-y-auto border-2 border-slate-100 dark:border-slate-800 rounded-3xl p-4 bg-slate-50 dark:bg-slate-950 space-y-2">
                     {allWorkItems.map((item: WorkItem) => (
                       <label key={item.id} className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-0"
                            checked={data.linkedWorkItemIds.includes(item.id)}
                            onChange={(e) => {
                              const ids = e.target.checked 
                                ? [...data.linkedWorkItemIds, item.id]
                                : data.linkedWorkItemIds.filter(id => id !== item.id);
                              setData({...data, linkedWorkItemIds: ids});
                            }}
                          />
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-indigo-600">{item.wbs} - {item.name}</span>
                       </label>
                     ))}
                  </div>
               </div>
            </div>

            <div className="space-y-4">
               <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={14}/> Controle Documental
                  </h3>
                  <button type="button" onClick={() => setData({...data, documentos: [...data.documentos, { id: crypto.randomUUID(), nome: 'Nova Certidão', dataVencimento: '', status: 'pendente' }]})} className="text-[9px] font-black uppercase text-indigo-600">+ Adicionar Documento</button>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {data.documentos.map(doc => (
                    <div key={doc.id} className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center gap-4">
                       <input className="bg-transparent text-[10px] font-black uppercase w-full outline-none" value={doc.nome} onChange={e => setData({...data, documentos: data.documentos.map(d => d.id === doc.id ? {...d, nome: e.target.value} : d)})} />
                       <input type="date" className="bg-transparent text-[10px] font-black outline-none w-32" value={doc.dataVencimento} onChange={e => setData({...data, documentos: data.documentos.map(d => d.id === doc.id ? {...d, dataVencimento: e.target.value} : d)})} />
                       <button onClick={() => setData({...data, documentos: data.documentos.filter(d => d.id !== doc.id)})} className="text-rose-400 hover:text-rose-600"><Trash2 size={16}/></button>
                    </div>
                  ))}
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

