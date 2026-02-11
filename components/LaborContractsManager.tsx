import React, { useState, useMemo, useEffect } from 'react';
import { Project, LaborContract, LaborPayment, WorkforceMember, ProjectExpense, WorkItem } from '../types';
import { laborContractService } from '../services/laborContractService';
import { uploadService } from '../services/uploadService';
import { laborContractsApi } from '../services/laborContractsApi';
import { ConfirmModal } from './ConfirmModal';
import { ExpenseAttachmentZone } from './ExpenseAttachmentZone';
import { useToast } from '../hooks/useToast';
import { uiPreferences } from '../utils/uiPreferences';
import { financial } from '../utils/math';
import { treeService } from '../services/treeService';
import { useAuth } from '../auth/AuthContext';
import { 
  Briefcase, Plus, Search, Trash2, Edit2, DollarSign, Calendar, 
  CheckCircle2, Clock, AlertCircle, User, FileText, Download, X,
  TrendingUp, TrendingDown, Wallet, ChevronDown, ChevronUp, ChevronRight, CreditCard
} from 'lucide-react';

interface LaborContractsManagerProps {
  project: Project;
  onUpdateProject: (data: Partial<Project>) => void;
  onAddExpense?: (expense: ProjectExpense) => Promise<void> | void;
  onUpdateExpense?: (id: string, data: Partial<ProjectExpense>) => Promise<void> | void;
  isReadOnly?: boolean;
}

export const LaborContractsManager: React.FC<LaborContractsManagerProps> = ({ 
  project, 
  onUpdateProject,
  onAddExpense,
  onUpdateExpense,
  isReadOnly = false,
}) => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<LaborContract | null>(null);
  const laborFilterKey = `labor_contracts_filter_${project.id}`;
  const [filterType, setFilterType] = useState<'all' | 'empreita' | 'diaria'>(() => {
    const saved = uiPreferences.getString(laborFilterKey);
    return saved === 'all' || saved === 'empreita' || saved === 'diaria' ? saved : 'all';
  });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const paymentsExpandedKey = `labor_contracts_payments_${project.id}`;
  const [expandedPayments, setExpandedPayments] = useState<Record<string, boolean>>({});
  const [editingPayment, setEditingPayment] = useState<{
    contractId: string;
    payment: LaborPayment;
    isNew: boolean;
  } | null>(null);
  const toast = useToast();

  const getInitials = (name?: string | null) => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '';
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  };

  const contracts = project.laborContracts || [];
  const workforce = project.workforce || [];

  useEffect(() => {
    const saved = uiPreferences.getString(laborFilterKey);
    if (saved === 'all' || saved === 'empreita' || saved === 'diaria') {
      setFilterType(saved);
    } else {
      setFilterType('all');
    }
  }, [laborFilterKey, project.id]);

  useEffect(() => {
    uiPreferences.setString(laborFilterKey, filterType);
  }, [filterType, laborFilterKey]);

  useEffect(() => {
    const defaults = contracts.reduce<Record<string, boolean>>((acc, contract) => {
      acc[contract.id] = true;
      return acc;
    }, {});

    try {
      const saved = localStorage.getItem(paymentsExpandedKey);
      const parsed = saved ? JSON.parse(saved) : {};
      setExpandedPayments({ ...defaults, ...parsed });
    } catch {
      setExpandedPayments(defaults);
    }
  }, [paymentsExpandedKey, contracts]);

  useEffect(() => {
    try {
      localStorage.setItem(paymentsExpandedKey, JSON.stringify(expandedPayments));
    } catch {
      // Ignore storage errors (quota/private mode)
    }
  }, [expandedPayments, paymentsExpandedKey]);

  const filteredContracts = useMemo(() => {
    const latestPaymentTime = (contract: LaborContract) => {
      if (!contract.pagamentos?.length) return 0;
      return Math.max(
        ...contract.pagamentos.map(p => parseLocalDate(p.data).getTime() || 0)
      );
    };

    return contracts
      .filter(c => {
        const associado = workforce.find(w => w.id === c.associadoId);
        const matchesSearch = 
          c.descricao.toLowerCase().includes(search.toLowerCase()) ||
          associado?.nome.toLowerCase().includes(search.toLowerCase()) || '';
        const matchesType = filterType === 'all' || c.tipo === filterType;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => latestPaymentTime(b) - latestPaymentTime(a));
  }, [contracts, workforce, search, filterType]);

  const stats = useMemo(() => 
    laborContractService.getContractStats(contracts),
    [contracts]
  );

  const laborFinancialCategories = useMemo(() => {
    return project.expenses.filter(e => e.itemType === 'category' && e.type === 'labor');
  }, [project.expenses]);

  const findExpenseForPayment = (paymentId: string) =>
    project.expenses.find(expense => expense.id === paymentId);

  const buildLaborExpensePayload = (
    contract: LaborContract,
    payment: LaborPayment,
    parentId: string | null,
    isPaid: boolean,
    paymentProof?: string,
  ) => {
    const associado = workforce.find(w => w.id === contract.associadoId);
    const effectiveDate = payment.data || new Date().toISOString().split('T')[0];
    const prefix = contract.tipo === 'empreita' ? 'Empreita M.O.' : 'Diaria M.O.';
    const description = `${prefix}: ${contract.descricao} - ${payment.descricao || 'Pagamento'}`;
    const primaryLinkedWorkItemId = contract.linkedWorkItemIds?.[0] ?? contract.linkedWorkItemId;

    const status: ProjectExpense['status'] = isPaid ? 'PAID' : 'PENDING';

    return {
      parentId,
      type: 'labor' as const,
      itemType: 'item' as const,
      date: effectiveDate,
      paymentDate: isPaid ? effectiveDate : undefined,
      description,
      entityName: associado?.nome || '',
      unit: 'serv',
      quantity: 1,
      unitPrice: payment.valor,
      amount: payment.valor,
      isPaid,
      status,
      paymentProof: isPaid ? paymentProof : undefined,
      linkedWorkItemId: primaryLinkedWorkItemId,
    };
  };

  function parseLocalDate(dateStr: string) {
    if (!dateStr) return new Date(NaN);
    const [year, month, day] = dateStr.split('-').map(Number);
    if (year && month && day) return new Date(year, month - 1, day);
    return new Date(dateStr);
  }

  function formatLocalDate(dateStr?: string) {
    if (!dateStr) return '';
    const date = parseLocalDate(dateStr);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('pt-BR');
  }

  const handleDownloadProof = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleSave = async (
    contract: LaborContract,
    paidPayments?: Array<{ paymentId: string; parentId: string | null }>
  ) => {
    if (isReadOnly) return;
    const updated = laborContractService.updateContract(contract);
    const exists = contracts.find(c => c.id === contract.id);
    const previous = contracts;
    const newContracts = exists
      ? contracts.map(c => c.id === contract.id ? updated : c)
      : [...contracts, updated];
    onUpdateProject({ laborContracts: newContracts });

    try {
      if (exists) {
        const normalizedPayments = user
          ? updated.pagamentos.map((payment) => (
              payment.createdById
                ? payment
                : {
                    ...payment,
                    createdById: user.id,
                    createdBy: { id: user.id, name: user.name, profileImage: user.profileImage ?? null },
                  }
            ))
          : updated.pagamentos;
        const saved = await laborContractsApi.update(contract.id, {
          tipo: updated.tipo,
          descricao: updated.descricao,
          associadoId: updated.associadoId,
          valorTotal: updated.valorTotal,
          dataInicio: updated.dataInicio,
          dataFim: updated.dataFim,
          linkedWorkItemId: updated.linkedWorkItemIds?.[0] ?? updated.linkedWorkItemId,
          linkedWorkItemIds: updated.linkedWorkItemIds ?? (updated.linkedWorkItemId ? [updated.linkedWorkItemId] : []),
          observacoes: updated.observacoes,
          ordem: updated.ordem,
          pagamentos: normalizedPayments,
        });
        onUpdateProject({ laborContracts: newContracts.map(c => c.id === contract.id ? saved : c) });
      } else {
        const normalizedPayments = user
          ? updated.pagamentos.map((payment) => (
              payment.createdById
                ? payment
                : {
                    ...payment,
                    createdById: user.id,
                    createdBy: { id: user.id, name: user.name, profileImage: user.profileImage ?? null },
                  }
            ))
          : updated.pagamentos;
        const created = await laborContractsApi.create(project.id, {
          tipo: updated.tipo,
          descricao: updated.descricao,
          associadoId: updated.associadoId,
          valorTotal: updated.valorTotal,
          dataInicio: updated.dataInicio,
          dataFim: updated.dataFim,
          linkedWorkItemId: updated.linkedWorkItemIds?.[0] ?? updated.linkedWorkItemId,
          linkedWorkItemIds: updated.linkedWorkItemIds ?? (updated.linkedWorkItemId ? [updated.linkedWorkItemId] : []),
          observacoes: updated.observacoes,
          ordem: updated.ordem,
          pagamentos: normalizedPayments,
        });
        onUpdateProject({ laborContracts: [...contracts, created] });

        if (paidPayments?.length && onAddExpense) {
          paidPayments.forEach(({ paymentId, parentId }) => {
            const payment = updated.pagamentos.find(p => p.id === paymentId);
            if (!payment) return;
            const expensePayload = buildLaborExpensePayload(
              created,
              payment,
              parentId,
              true,
              payment.comprovante
            );
            const newExpense: ProjectExpense = {
              id: payment.id,
              parentId,
              type: 'labor',
              itemType: 'item',
              wbs: '',
              order: project.expenses.length,
              date: expensePayload.date,
              description: expensePayload.description,
              entityName: expensePayload.entityName,
              unit: expensePayload.unit,
              quantity: expensePayload.quantity,
              unitPrice: expensePayload.unitPrice,
              amount: expensePayload.amount,
              isPaid: true,
              status: 'PAID',
              paymentDate: expensePayload.paymentDate,
              paymentProof: expensePayload.paymentProof,
              linkedWorkItemId: expensePayload.linkedWorkItemId,
            };
            onAddExpense(newExpense);
          });
        }
      }
    } catch (error) {
      console.error('Erro ao salvar contrato:', error);
      onUpdateProject({ laborContracts: previous });
      toast.error('Erro ao salvar contrato.');
    }

    setIsModalOpen(false);
    setEditingContract(null);
  };

  const removeContract = async (id: string) => {
    if (isReadOnly) return;
    setConfirmDeleteId(null);
    const previous = contracts;
    onUpdateProject({ laborContracts: contracts.filter(c => c.id !== id) });
    try {
      await laborContractsApi.remove(id);
      toast.success('Contrato removido com sucesso.');
    } catch (error) {
      console.error('Erro ao remover contrato:', error);
      onUpdateProject({ laborContracts: previous });
      toast.error('Erro ao remover contrato.');
    }
  };

  const handleOpenPaymentModal = (contractId: string, payment?: LaborPayment) => {
    if (isReadOnly) return;
    const targetPayment = payment ?? {
      ...laborContractService.createPayment(),
      createdById: user?.id,
      createdBy: user?.id && user?.name
        ? { id: user.id, name: user.name, profileImage: user.profileImage ?? null }
        : undefined,
    };
    setExpandedPayments(prev => ({ ...prev, [contractId]: true }));
    setEditingPayment({
      contractId,
      payment: targetPayment,
      isNew: !payment,
    });
  };

  const handleSavePayment = async (
    contractId: string,
    payment: LaborPayment,
    options: { isPaid: boolean; parentId: string | null; paymentProof?: string; isNew: boolean }
  ) => {
    if (isReadOnly) return;
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return;

    const normalizedPayment: LaborPayment = {
      ...payment,
      comprovante: options.isPaid ? options.paymentProof : undefined,
      createdById: payment.createdById ?? user?.id,
      createdBy: payment.createdBy ?? (user?.id && user?.name
        ? { id: user.id, name: user.name, profileImage: user.profileImage ?? null }
        : undefined),
    };

    const nextPayments = options.isNew
      ? [...contract.pagamentos, normalizedPayment]
      : contract.pagamentos.map(p => p.id === payment.id ? normalizedPayment : p);

    const updatedContract = laborContractService.updateContract({
      ...contract,
      pagamentos: nextPayments,
    });

    const previousContracts = contracts;
    const nextContracts = contracts.map(c => c.id === contractId ? updatedContract : c);
    onUpdateProject({ laborContracts: nextContracts });

    const expensePayloadBase = buildLaborExpensePayload(
      contract,
      normalizedPayment,
      options.parentId,
      options.isPaid,
      options.paymentProof
    );

    const existingExpense = findExpenseForPayment(payment.id);

    if (options.isPaid && onAddExpense && onUpdateExpense) {
      if (existingExpense) {
        onUpdateExpense(existingExpense.id, {
          ...expensePayloadBase,
        });
      } else {
        const newExpense: ProjectExpense = {
          id: payment.id,
          parentId: options.parentId,
          type: 'labor',
          itemType: 'item',
          wbs: '',
          order: project.expenses.length,
          date: expensePayloadBase.date,
          description: expensePayloadBase.description,
          entityName: expensePayloadBase.entityName,
          unit: expensePayloadBase.unit,
          quantity: expensePayloadBase.quantity,
          unitPrice: expensePayloadBase.unitPrice,
          amount: expensePayloadBase.amount,
          isPaid: expensePayloadBase.isPaid,
          status: expensePayloadBase.status,
          paymentDate: expensePayloadBase.paymentDate,
          paymentProof: expensePayloadBase.paymentProof,
          linkedWorkItemId: expensePayloadBase.linkedWorkItemId,
        };
        onAddExpense(newExpense);
      }
    }

    try {
      const saved = await laborContractsApi.upsertPayment(contractId, normalizedPayment);
      onUpdateProject({
        laborContracts: nextContracts.map(c => c.id === contractId ? saved : c)
      });
    } catch (error) {
      console.error('Erro ao salvar pagamento:', error);
      onUpdateProject({ laborContracts: previousContracts });
      toast.error('Erro ao salvar pagamento.');
    }

    setEditingPayment(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KpiCard 
          label="Total Contratos" 
          value={stats.total} 
          icon={<Briefcase />} 
          color="indigo" 
          sub={`${stats.empreitas} empreitas • ${stats.diarias} diárias`}
        />
        <KpiCard 
          label="Valor Total" 
          value={`R$ ${stats.valorTotalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`} 
          icon={<Wallet />} 
          color="emerald" 
          sub="Contratado"
        />
        <KpiCard 
          label="Já Pago" 
          value={`R$ ${stats.valorPagoGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`} 
          icon={<TrendingUp />} 
          color="blue" 
          sub={`${((stats.valorPagoGeral/stats.valorTotalGeral)*100 || 0).toFixed(1)}% executado`}
        />
        <KpiCard 
          label="A Pagar" 
          value={`R$ ${stats.saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`} 
          icon={<TrendingDown />} 
          color="amber" 
          sub={`${stats.pendentes} pendentes`}
        />
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex gap-3">
          {(['all', 'empreita', 'diaria'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                filterType === type
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600'
              }`}
            >
              {type === 'all' ? 'Todos' : type === 'empreita' ? 'Empreitas' : 'Diárias'}
            </button>
          ))}
        </div>

        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            placeholder="Buscar por descrição ou associado..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm outline-none focus:ring-4 focus:ring-indigo-500/10" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>

        <button 
          onClick={() => { if (!isReadOnly) { setEditingContract(null); setIsModalOpen(true); } }}
          disabled={isReadOnly}
          className={`flex items-center gap-2 px-8 py-3.5 font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl transition-all ${
            isReadOnly
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:scale-105'
          }`}
        >
          <Plus size={18} /> Novo Contrato
        </button>
      </div>

      {/* Lista de Contratos */}
      <div className="grid grid-cols-1 gap-6">
        {filteredContracts.map(contract => {
          const associado = workforce.find(w => w.id === contract.associadoId);
          const progress = (contract.valorPago / contract.valorTotal) * 100 || 0;
          const isPaymentsOpen = !!expandedPayments[contract.id];
          
          return (
            <div 
              key={contract.id} 
              className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase ${
                      contract.tipo === 'empreita' 
                        ? 'bg-indigo-50 dark:bg-indigo-900 text-indigo-600' 
                        : 'bg-emerald-50 dark:bg-emerald-900 text-emerald-600'
                    }`}>
                      {contract.tipo}
                    </span>
                    <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase ${
                      contract.status === 'pago' 
                        ? 'bg-emerald-50 dark:bg-emerald-900 text-emerald-600'
                        : contract.status === 'parcial'
                        ? 'bg-amber-50 dark:bg-amber-900 text-amber-600'
                        : 'bg-rose-50 dark:bg-rose-900 text-rose-600'
                    }`}>
                      {contract.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white mb-1">
                    {contract.descricao}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <User size={14} />
                    <span className="font-bold">{associado?.nome || 'Associado não encontrado'}</span>
                    <span className="text-slate-300 mx-2">•</span>
                    <Calendar size={14} />
                    <span>{formatLocalDate(contract.dataInicio)}</span>
                    {contract.dataFim && (
                      <>
                        <span className="text-slate-300 mx-2">→</span>
                        <span>{formatLocalDate(contract.dataFim)}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => { if (!isReadOnly) { setEditingContract(contract); setIsModalOpen(true); } }}
                    disabled={isReadOnly}
                    className={`p-3 rounded-xl transition-all ${
                      isReadOnly
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 cursor-not-allowed'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600'
                    }`}
                  >
                    <Edit2 size={16}/>
                  </button>
                  <button 
                    onClick={() => !isReadOnly && setConfirmDeleteId(contract.id)}
                    disabled={isReadOnly}
                    className={`p-3 rounded-xl transition-all ${
                      isReadOnly
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 cursor-not-allowed'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-500'
                    }`}
                  >
                    <Trash2 size={16}/>
                  </button>
                </div>
              </div>

              {/* Valores e Progresso */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Valor Total</p>
                  <p className="text-xl font-black text-slate-800 dark:text-white">
                    R$ {contract.valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl">
                  <p className="text-[9px] font-black text-emerald-600 uppercase mb-1">Pago</p>
                  <p className="text-xl font-black text-emerald-600">
                    R$ {contract.valorPago.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl">
                  <p className="text-[9px] font-black text-amber-600 uppercase mb-1">A Pagar</p>
                  <p className="text-xl font-black text-amber-600">
                    R$ {(contract.valorTotal - contract.valorPago).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </p>
                </div>
              </div>

              {/* Barra de Progresso */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase">Progresso</span>
                  <span className="text-sm font-black text-indigo-600">{progress.toFixed(1)}%</span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-500"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              </div>

              {/* Pagamentos */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2">
                    <FileText size={12} /> Histórico de Pagamentos ({contract.pagamentos.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPaymentModal(contract.id)}
                      disabled={isReadOnly}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                        isReadOnly
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:scale-105'
                      }`}
                    >
                      <Plus size={12} /> Adicionar
                    </button>
                    {contract.pagamentos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpandedPayments(prev => ({
                          ...prev,
                          [contract.id]: !prev[contract.id],
                        }))}
                        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-600"
                      >
                        {isPaymentsOpen ? 'Ocultar' : 'Mostrar'}
                        {isPaymentsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                  </div>
                </div>
                {contract.pagamentos.length === 0 && (
                  <div className="text-center py-6 text-slate-400 text-sm">
                    Nenhum pagamento registrado
                  </div>
                )}
                {contract.pagamentos.length > 0 && isPaymentsOpen && (
                  <div className="space-y-2">
                    {[...contract.pagamentos]
                      .sort((a, b) => parseLocalDate(b.data).getTime() - parseLocalDate(a.data).getTime())
                      .map(pag => (
                      <div 
                        key={pag.id} 
                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          {(() => {
                            const linkedExpense = findExpenseForPayment(pag.id);
                            const isPaid = !!linkedExpense && (linkedExpense.isPaid || linkedExpense.status === 'PAID');
                            return isPaid ? (
                              <CheckCircle2 size={14} className="text-emerald-500" />
                            ) : (
                              <Clock size={14} className="text-amber-500" />
                            );
                          })()}
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-white">
                              {pag.descricao || 'Pagamento'}
                            </p>
                              <div className="flex flex-wrap items-center gap-2 text-[9px] text-slate-400">
                                <span>{formatLocalDate(pag.data)}</span>
                                {pag.createdBy?.name && (
                                  <span className="flex items-center gap-2">
                                    {pag.createdBy.profileImage ? (
                                      <img
                                        src={pag.createdBy.profileImage}
                                        alt={pag.createdBy.name}
                                        className="w-5 h-5 rounded-full object-cover border border-slate-200"
                                      />
                                    ) : (
                                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[9px] font-black">
                                        {getInitials(pag.createdBy.name)}
                                      </span>
                                    )}
                                    <span>Solicitado por {pag.createdBy.name}</span>
                                  </span>
                                )}
                              </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {pag.comprovante && (
                            <button
                              type="button"
                              onClick={() => handleDownloadProof(
                                pag.comprovante!,
                                `COMPR_${contract.descricao}_${pag.descricao || 'Pagamento'}`
                              )}
                              className="p-1.5 text-blue-500 hover:text-blue-700 rounded-lg"
                              title="Baixar comprovante"
                            >
                              <Download size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentModal(contract.id, pag)}
                            disabled={isReadOnly}
                            className={`p-1.5 rounded-lg ${
                              isReadOnly
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-slate-400 hover:text-indigo-600'
                            }`}
                            title="Editar pagamento"
                          >
                            <Edit2 size={14} />
                          </button>
                          <p className="text-sm font-black text-emerald-600">
                            R$ {pag.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredContracts.length === 0 && (
          <div className="text-center py-16 bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
            <Briefcase size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-400 font-bold">
              {search ? 'Nenhum contrato encontrado' : 'Nenhum contrato cadastrado'}
            </p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <ContractModal 
          contract={editingContract}
          workforce={workforce}
          workItems={project.items}
          isReadOnly={isReadOnly}
          financialCategories={laborFinancialCategories}
          onAddExpense={onAddExpense}
          onClose={() => { setIsModalOpen(false); setEditingContract(null); }}
          onSave={handleSave}
        />
      )}

      {editingPayment && (
        <PaymentModal
          contract={contracts.find(c => c.id === editingPayment.contractId)}
          payment={editingPayment.payment}
          isNew={editingPayment.isNew}
          isReadOnly={isReadOnly}
          existingExpense={findExpenseForPayment(editingPayment.payment.id)}
          financialCategories={laborFinancialCategories}
          onAddExpense={onAddExpense}
          onClose={() => setEditingPayment(null)}
          onSave={(payment, options) => handleSavePayment(editingPayment.contractId, payment, {
            ...options,
            isNew: editingPayment.isNew,
          })}
        />
      )}

      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Excluir contrato"
        message="Deseja realmente excluir este contrato de mão de obra? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => confirmDeleteId && removeContract(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
};

const PaymentModal = ({
  contract,
  payment,
  isNew,
  existingExpense,
  financialCategories,
  onAddExpense,
  onClose,
  onSave,
  isReadOnly,
}: any) => {
  const [data, setData] = useState<LaborPayment>(payment);
  const [strValor, setStrValor] = useState(
    financial.formatVisual(payment.valor || 0, '').trim()
  );
  const [parentId, setParentId] = useState<string | null>(existingExpense?.parentId ?? null);
  const [localFinancialCategories, setLocalFinancialCategories] = useState<ProjectExpense[]>(financialCategories ?? []);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const isPaidLocked = !!existingExpense?.isPaid || existingExpense?.status === 'PAID';
  const [isPaid, setIsPaid] = useState<boolean>(isPaidLocked);
  const [paymentProof, setPaymentProof] = useState<string | undefined>(
    existingExpense?.paymentProof || payment.comprovante
  );
  const [confirmPaidOpen, setConfirmPaidOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setLocalFinancialCategories(financialCategories ?? []);
  }, [financialCategories]);

  if (!contract) return null;

  const handleTogglePaid = () => {
    if (isReadOnly || isPaidLocked) return;
    setIsPaid(!isPaid);
  };

  const handleSave = () => {
    if (isReadOnly) return;
    if (isPaid && !isPaidLocked) {
      setConfirmPaidOpen(true);
      setPendingSave(true);
      return;
    }

    onSave(
      { ...data, comprovante: isPaid ? paymentProof : undefined },
      { isPaid, parentId, paymentProof }
    );
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6">
          {isNew ? 'Novo Pagamento' : 'Editar Pagamento'}
        </h2>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col">
              <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Data</label>
              <input
                type="date"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none"
                value={data.data}
                onChange={e => setData({ ...data, data: e.target.value })}
                disabled={isReadOnly}
              />
            </div>

            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Valor (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none"
                value={strValor}
                onChange={e => {
                  const masked = financial.maskCurrency(e.target.value);
                  setStrValor(masked);
                  setData({ ...data, valor: financial.parseLocaleNumber(masked) });
                }}
                disabled={isReadOnly}
              />
            </div>

            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Descrição</label>
              <input
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none"
                value={data.descricao}
                onChange={e => setData({ ...data, descricao: e.target.value })}
                disabled={isReadOnly}
                placeholder="Ex: 1ª Parcela"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase block tracking-widest">
                Vincular ao Grupo Financeiro (Opcional)
              </label>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => { setIsAddingGroup(true); setNewGroupName(''); }}
                  className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-500"
                >
                  Adicionar
                </button>
              )}
            </div>
            <select
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-xs font-bold outline-none appearance-none"
              value={parentId || ''}
              onChange={e => setParentId(e.target.value || null)}
              disabled={isReadOnly}
            >
              <option value="">Nenhum</option>
              {localFinancialCategories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.description}</option>
              ))}
            </select>
            {isAddingGroup && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Nome do grupo"
                />
                <button
                  type="button"
                  onClick={() => {
                    const name = newGroupName.trim();
                    if (!name) return;
                    if (!onAddExpense) {
                      toast.error('Nao foi possivel criar o grupo financeiro.');
                      return;
                    }
                    const newCategory: ProjectExpense = {
                      id: crypto.randomUUID(),
                      parentId: null,
                      type: 'labor',
                      itemType: 'category',
                      wbs: '',
                      order: localFinancialCategories.length,
                      date: new Date().toISOString().split('T')[0],
                      description: name,
                      entityName: '',
                      unit: '',
                      quantity: 0,
                      unitPrice: 0,
                      amount: 0,
                      isPaid: false,
                      status: 'PENDING',
                    };
                    setLocalFinancialCategories((prev) => [...prev, newCategory]);
                    setParentId(newCategory.id);
                    setIsAddingGroup(false);
                    setNewGroupName('');
                    onAddExpense(newCategory);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase"
                >
                  Criar
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAddingGroup(false); setNewGroupName(''); }}
                  className="px-3 py-2 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:text-slate-600"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <CreditCard size={18} className={isPaid ? 'text-emerald-500' : 'text-slate-500'} />
              <span className="text-[10px] font-black text-slate-800 dark:text-white uppercase">Marcar como pago agora?</span>
            </div>
            <button
              type="button"
              onClick={handleTogglePaid}
              className={`w-12 h-6 rounded-full relative transition-all ${isPaid ? 'bg-emerald-500' : 'bg-slate-700'} ${isReadOnly || isPaidLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  isPaid ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {isPaid && (
            <div className="space-y-2">
              <ExpenseAttachmentZone
                label="Recibo de Pagamento (Pix/DOC)"
                requiredStatus="PAID"
                currentFile={paymentProof}
                onUploadUrl={(url) => setPaymentProof(url)}
                onRemove={() => setPaymentProof(undefined)}
              />
            </div>
          )}
        </div>

        <div className="flex gap-4 pt-8 border-t border-slate-200 dark:border-slate-800 mt-8">
          <button
            onClick={onClose}
            className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isReadOnly}
            className={`flex-[2] py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all ${
              isReadOnly
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white active:scale-95'
            }`}
          >
            Salvar Pagamento
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmPaidOpen}
        title="Confirmar pagamento"
        message="Ao marcar como pago, nao sera possivel voltar para pendente. Deseja continuar?"
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        variant="warning"
        onConfirm={() => {
          setIsPaid(true);
          setConfirmPaidOpen(false);
          if (pendingSave) {
            setPendingSave(false);
            onSave(
              { ...data, comprovante: paymentProof },
              { isPaid: true, parentId, paymentProof }
            );
          }
        }}
        onCancel={() => {
          setConfirmPaidOpen(false);
          setPendingSave(false);
          if (!isPaidLocked) setIsPaid(false);
        }}
      />
    </div>
  );
};

const ContractModal = ({ contract, workforce, workItems, isReadOnly, financialCategories, onAddExpense, onClose, onSave }: any) => {
  const initialContract = contract || laborContractService.createContract('empreita');
  const [data, setData] = useState<LaborContract>(initialContract);
  const [localFinancialCategories, setLocalFinancialCategories] = useState<ProjectExpense[]>(financialCategories ?? []);
  const workTree = useMemo(() => treeService.buildTree(workItems), [workItems]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [strValorTotal, setStrValorTotal] = useState(
    financial.formatVisual(initialContract.valorTotal || 0, '').trim()
  );
  const [paymentValues, setPaymentValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (initialContract.pagamentos || []).map(p => [
        p.id,
        financial.formatVisual(p.valor || 0, '').trim()
      ])
    )
  );
  const [paymentPaid, setPaymentPaid] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((initialContract.pagamentos || []).map(p => [p.id, false]))
  );
  const [paymentParentIds, setPaymentParentIds] = useState<Record<string, string | null>>(() =>
    Object.fromEntries((initialContract.pagamentos || []).map(p => [p.id, null]))
  );
  const [addingGroupForPaymentId, setAddingGroupForPaymentId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const toast = useToast();

  useEffect(() => {
    setExpandedIds(new Set());
  }, [contract, workItems]);

  useEffect(() => {
    setLocalFinancialCategories(financialCategories ?? []);
  }, [financialCategories]);

  useEffect(() => {
    if (data.linkedWorkItemIds !== undefined) return;
    const fallback = data.linkedWorkItemId ? [data.linkedWorkItemId] : [];
    setData((prev) => ({ ...prev, linkedWorkItemIds: fallback }));
  }, [data.linkedWorkItemIds, data.linkedWorkItemId]);

  useEffect(() => {
    setPaymentValues(prev => {
      const next = { ...prev };
      data.pagamentos.forEach(p => {
        if (next[p.id] === undefined) {
          next[p.id] = financial.formatVisual(p.valor || 0, '').trim();
        }
      });
      Object.keys(next).forEach(id => {
        if (!data.pagamentos.find(p => p.id === id)) delete next[id];
      });
      return next;
    });
  }, [data.pagamentos]);

  const handleSubmit = () => {
    if (!data.associadoId) {
      toast.error('Selecione o associado responsavel.');
      return;
    }
    if (!data.descricao.trim()) {
      toast.error('Informe a descricao do trabalho.');
      return;
    }
    if (!data.dataInicio) {
      toast.error('Informe a data de inicio.');
      return;
    }

    const paidPayments = (data.pagamentos || [])
      .filter(p => paymentPaid[p.id])
      .map(p => ({ paymentId: p.id, parentId: paymentParentIds[p.id] ?? null }));

    const normalizedLinkedIds =
      data.linkedWorkItemIds ?? (data.linkedWorkItemId ? [data.linkedWorkItemId] : []);
    onSave(
      {
        ...data,
        linkedWorkItemIds: normalizedLinkedIds,
        linkedWorkItemId: normalizedLinkedIds[0] ?? undefined,
      },
      paidPayments,
    );
  };

  const handleAddPayment = () => {
    if (isReadOnly) return;
    const newPayment = laborContractService.createPayment();
    setData({ ...data, pagamentos: [...data.pagamentos, newPayment] });
    setPaymentPaid(prev => ({ ...prev, [newPayment.id]: false }));
    setPaymentParentIds(prev => ({ ...prev, [newPayment.id]: null }));
  };

  const handleUpdatePayment = (id: string, updates: Partial<LaborPayment>) => {
    if (isReadOnly) return;
    setData({
      ...data,
      pagamentos: data.pagamentos.map(p => p.id === id ? { ...p, ...updates } : p)
    });
  };

  const handleRemovePayment = (id: string) => {
    if (isReadOnly) return;
    setData({
      ...data,
      pagamentos: data.pagamentos.filter(p => p.id !== id)
    });
    setPaymentPaid(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPaymentParentIds(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleFileUpload = async (paymentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    const file = e.target.files?.[0];
    if (file) {
      try {
        const response = await uploadService.uploadFile(file);
        if (!response?.url) throw new Error('Upload failed');
        handleUpdatePayment(paymentId, { comprovante: response.url });
      } catch (error) {
        console.error('Falha no upload do comprovante:', error);
        toast.error('Falha ao enviar o comprovante. Tente novamente.');
      }
    }
  };

  const handleCreateFinancialGroup = async (paymentId: string) => {
    if (isReadOnly) return;
    if (!onAddExpense) {
      toast.error('Nao foi possivel criar o grupo financeiro.');
      return;
    }
    const name = newGroupName.trim();
    if (!name) {
      toast.error('Informe o nome do grupo.');
      return;
    }

    const newCategory: ProjectExpense = {
      id: crypto.randomUUID(),
      parentId: null,
      type: 'labor',
      itemType: 'category',
      wbs: '',
      order: localFinancialCategories.length,
      date: new Date().toISOString().split('T')[0],
      description: name,
      entityName: '',
      unit: '',
      quantity: 0,
      unitPrice: 0,
      amount: 0,
      isPaid: false,
      status: 'PENDING',
    };

    setLocalFinancialCategories((prev) => [...prev, newCategory]);
    setPaymentParentIds((prev) => ({ ...prev, [paymentId]: newCategory.id }));
    setAddingGroupForPaymentId(null);
    setNewGroupName('');
    onAddExpense(newCategory);
  };

  const getItemIds = (node: WorkItem): string[] => {
    const children = node.children ?? [];
    const childIds = children.flatMap(getItemIds);
    if (node.type === 'item') return [node.id, ...childIds];
    return childIds;
  };

  const toggleItemIds = (ids: string[], checked: boolean) => {
    if (ids.length === 0) return;
    const current = new Set(data.linkedWorkItemIds ?? []);
    ids.forEach((id) => {
      if (checked) current.add(id);
      else current.delete(id);
    });
    const nextIds = Array.from(current);
    setData({
      ...data,
      linkedWorkItemIds: nextIds,
      linkedWorkItemId: nextIds[0] ?? undefined,
    });
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
    const checked = itemIds.length > 0 && itemIds.every((id) => (data.linkedWorkItemIds ?? []).includes(id));
    const indeterminate =
      itemIds.length > 0 &&
      itemIds.some((id) => (data.linkedWorkItemIds ?? []).includes(id)) &&
      !checked;
    const isCategory = node.type === 'category';
    const isExpanded = isCategory && expandedIds.has(node.id);

    return (
      <div key={node.id} className="space-y-2">
        <label
          className={`flex items-center gap-3 cursor-pointer group ${isCategory ? '' : 'hover:text-indigo-600'}`}
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
            disabled={itemIds.length === 0 || isReadOnly}
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
    <div 
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" 
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-[3rem] p-10 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" 
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-2xl font-black mb-8 dark:text-white uppercase tracking-tight">
          {contract ? 'Editar Contrato' : 'Novo Contrato de Mão de Obra'}
        </h2>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-8">
            <div className="space-y-8">
              {/* Tipo e Informações Básicas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">
                    Tipo de Contrato
                  </label>
                  <div className="flex gap-4">
                    {(['empreita', 'diaria'] as const).map(tipo => (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => setData({ ...data, tipo })}
                        disabled={isReadOnly}
                        className={`flex-1 py-4 rounded-2xl text-sm font-black uppercase transition-all ${
                          data.tipo === tipo
                            ? 'bg-indigo-600 text-white shadow-lg'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}
                      >
                        {tipo}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">
                    Associado Responsável
                  </label>
                  <select
                    className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500"
                    value={data.associadoId}
                    onChange={e => setData({ ...data, associadoId: e.target.value })}
                    disabled={isReadOnly}
                  >
                    <option value="">Selecione...</option>
                    {workforce.map((w: WorkforceMember) => (
                      <option key={w.id} value={w.id}>
                        {w.nome} - {w.cargo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">
                  Descrição do Trabalho
                </label>
                <input
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500"
                  value={data.descricao}
                  onChange={e => setData({ ...data, descricao: e.target.value })}
                  disabled={isReadOnly}
                  placeholder="Ex: Alvenaria Bloco 1, Pedreiro - Janeiro/2026"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">
                    Valor Total (R$)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500"
                    value={strValorTotal}
                    onChange={e => {
                      const masked = financial.maskCurrency(e.target.value);
                      setStrValorTotal(masked);
                      setData({ ...data, valorTotal: financial.parseLocaleNumber(masked) });
                    }}
                    disabled={isReadOnly}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">
                    Data Início
                  </label>
                  <input
                    type="date"
                    className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500"
                    value={data.dataInicio}
                    onChange={e => setData({ ...data, dataInicio: e.target.value })}
                    disabled={isReadOnly}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">
                    Data Fim (opcional)
                  </label>
                  <input
                    type="date"
                    className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500"
                    value={data.dataFim || ''}
                    onChange={e => setData({ ...data, dataFim: e.target.value })}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">
                  Observações
                </label>
                <textarea
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 min-h-[80px]"
                  value={data.observacoes || ''}
                  onChange={e => setData({ ...data, observacoes: e.target.value })}
                  disabled={isReadOnly}
                  placeholder="Informações adicionais..."
                />
              </div>
            </div>

            {/* Vincular Item da EAP (Opcional) */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">
                Vincular Item da EAP (Opcional)
              </label>
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
                {!isReadOnly && (data.linkedWorkItemIds?.length || data.linkedWorkItemId) && (
                  <button
                    type="button"
                    onClick={() => setData({ ...data, linkedWorkItemIds: [], linkedWorkItemId: undefined })}
                    className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-500 border rounded-lg hover:bg-slate-50"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="flex-1 min-h-0 max-h-[400px] overflow-y-auto border-2 border-slate-100 dark:border-slate-800 rounded-3xl p-4 bg-slate-50 dark:bg-slate-950 space-y-2">
                {workTree.length === 0 ? (
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Nenhum item da EAP
                  </p>
                ) : (
                  (workTree as WorkItem[]).map((node) => renderTreeNode(node, 0))
                )}
              </div>
            </div>
          </div>

          {/* Pagamentos (apenas no cadastro) */}
          {!contract && (
            <div className="border-t-2 border-slate-100 dark:border-slate-800 pt-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <FileText size={16}/> Registro de Pagamentos
                </h3>
                <button 
                  type="button"
                  onClick={handleAddPayment}
                  disabled={isReadOnly}
                  className={`flex items-center gap-2 px-6 py-2.5 text-[9px] font-black uppercase rounded-xl transition-all ${
                    isReadOnly
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-emerald-600 text-white hover:scale-105'
                  }`}
                >
                  <Plus size={14} /> Adicionar Pagamento
                </button>
              </div>

              <div className="space-y-4">
                {data.pagamentos.map((pag, idx) => (
                  <div 
                    key={pag.id} 
                    className="p-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-slate-400 uppercase">
                        Pagamento #{idx + 1}
                      </span>
                      <button
                        onClick={() => handleRemovePayment(pag.id)}
                        disabled={isReadOnly}
                        className={`transition-colors ${
                          isReadOnly
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-rose-400 hover:text-rose-600'
                        }`}
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">
                          Data
                        </label>
                        <input
                          type="date"
                          className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none"
                          value={pag.data}
                          onChange={e => handleUpdatePayment(pag.id, { data: e.target.value })}
                          disabled={isReadOnly}
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">
                          Valor (R$)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none"
                          value={paymentValues[pag.id] ?? financial.formatVisual(pag.valor || 0, '').trim()}
                          onChange={e => {
                            const masked = financial.maskCurrency(e.target.value);
                            setPaymentValues(prev => ({ ...prev, [pag.id]: masked }));
                            handleUpdatePayment(pag.id, { valor: financial.parseLocaleNumber(masked) });
                          }}
                          disabled={isReadOnly}
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">
                          Descrição
                        </label>
                        <input
                          className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none"
                          value={pag.descricao}
                          onChange={e => handleUpdatePayment(pag.id, { descricao: e.target.value })}
                          disabled={isReadOnly}
                          placeholder="Ex: 1ª Parcela"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">
                          Marcar como pago?
                        </label>
                        <select
                          className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none"
                          value={paymentPaid[pag.id] ? 'pago' : 'pendente'}
                          onChange={e => setPaymentPaid(prev => ({ ...prev, [pag.id]: e.target.value === 'pago' }))}
                          disabled={isReadOnly}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="pago">Pago</option>
                        </select>
                      </div>

                      {paymentPaid[pag.id] && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase block">
                              Vincular ao Grupo Financeiro (Opcional)
                            </label>
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAddingGroupForPaymentId(pag.id);
                                  setNewGroupName('');
                                }}
                                className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-500"
                              >
                                Adicionar
                              </button>
                            )}
                          </div>
                          <select
                            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none"
                            value={paymentParentIds[pag.id] ?? ''}
                            onChange={e => setPaymentParentIds(prev => ({
                              ...prev,
                              [pag.id]: e.target.value || null,
                            }))}
                            disabled={isReadOnly}
                          >
                            <option value="">Nenhum</option>
                            {localFinancialCategories.map((c: any) => (
                              <option key={c.id} value={c.id}>{c.description}</option>
                            ))}
                          </select>
                          {addingGroupForPaymentId === pag.id && (
                            <div className="mt-3 flex items-center gap-2">
                              <input
                                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                placeholder="Nome do grupo"
                              />
                              <button
                                type="button"
                                onClick={() => handleCreateFinancialGroup(pag.id)}
                                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase"
                              >
                                Criar
                              </button>
                              <button
                                type="button"
                                onClick={() => { setAddingGroupForPaymentId(null); setNewGroupName(''); }}
                                className="px-3 py-2 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:text-slate-600"
                              >
                                Cancelar
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {paymentPaid[pag.id] && (
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">
                          Recibo de Pagamento (Pix/DOC)
                        </label>
                        <div className="flex gap-3">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => handleFileUpload(pag.id, e)}
                            disabled={isReadOnly}
                            className={`flex-1 text-sm ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                          />
                          {pag.comprovante && (
                            <span className="flex items-center gap-2 text-xs text-emerald-600 font-bold">
                              <CheckCircle2 size={14} /> Anexado
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {data.pagamentos.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    Nenhum pagamento registrado
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4 pt-8 border-t-2 dark:border-slate-800 mt-auto">
          <button 
            onClick={onClose}
            className="flex-1 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isReadOnly}
            className={`flex-[2] py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl transition-all ${
              isReadOnly
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white active:scale-95'
            }`}
          >
            Salvar Contrato
          </button>
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({ label, value, icon, color, sub }: any) => {
  const colors: any = { 
    indigo: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-800', 
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800', 
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800',
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800'
  };
  
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <div>
        <p className={`text-xl font-black tracking-tighter ${colors[color].split(' ')[0]}`}>{value}</p>
        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{sub}</p>
      </div>
    </div>
  );
};
