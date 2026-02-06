import React, { useState, useMemo } from 'react';
import { Project, LaborContract, LaborPayment, WorkforceMember } from '../types';
import { laborContractService } from '../services/laborContractService';
import { uploadService } from '../services/uploadService';
import { laborContractsApi } from '../services/laborContractsApi';
import { 
  Briefcase, Plus, Search, Trash2, Edit2, DollarSign, Calendar, 
  CheckCircle2, Clock, AlertCircle, User, FileText, Download, X,
  TrendingUp, TrendingDown, Wallet
} from 'lucide-react';

interface LaborContractsManagerProps {
  project: Project;
  onUpdateProject: (data: Partial<Project>) => void;
  isReadOnly?: boolean;
}

export const LaborContractsManager: React.FC<LaborContractsManagerProps> = ({ 
  project, 
  onUpdateProject,
  isReadOnly = false,
}) => {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<LaborContract | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'empreita' | 'diaria'>('all');

  const contracts = project.laborContracts || [];
  const workforce = project.workforce || [];

  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      const associado = workforce.find(w => w.id === c.associadoId);
      const matchesSearch = 
        c.descricao.toLowerCase().includes(search.toLowerCase()) ||
        associado?.nome.toLowerCase().includes(search.toLowerCase()) || '';
      const matchesType = filterType === 'all' || c.tipo === filterType;
      return matchesSearch && matchesType;
    });
  }, [contracts, workforce, search, filterType]);

  const stats = useMemo(() => 
    laborContractService.getContractStats(contracts),
    [contracts]
  );

  const handleSave = async (contract: LaborContract) => {
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
        const saved = await laborContractsApi.update(contract.id, {
          tipo: updated.tipo,
          descricao: updated.descricao,
          associadoId: updated.associadoId,
          valorTotal: updated.valorTotal,
          dataInicio: updated.dataInicio,
          dataFim: updated.dataFim,
          linkedWorkItemId: updated.linkedWorkItemId,
          observacoes: updated.observacoes,
          ordem: updated.ordem,
          pagamentos: updated.pagamentos,
        });
        onUpdateProject({ laborContracts: newContracts.map(c => c.id === contract.id ? saved : c) });
      } else {
        const created = await laborContractsApi.create(project.id, {
          tipo: updated.tipo,
          descricao: updated.descricao,
          associadoId: updated.associadoId,
          valorTotal: updated.valorTotal,
          dataInicio: updated.dataInicio,
          dataFim: updated.dataFim,
          linkedWorkItemId: updated.linkedWorkItemId,
          observacoes: updated.observacoes,
          ordem: updated.ordem,
          pagamentos: updated.pagamentos,
        });
        onUpdateProject({ laborContracts: [...contracts, created] });
      }
    } catch (error) {
      console.error('Erro ao salvar contrato:', error);
      onUpdateProject({ laborContracts: previous });
    }

    setIsModalOpen(false);
    setEditingContract(null);
  };

  const removeContract = async (id: string) => {
    if (isReadOnly) return;
    if (confirm("Excluir este contrato de mão de obra?")) {
      const previous = contracts;
      onUpdateProject({ laborContracts: contracts.filter(c => c.id !== id) });
      try {
        await laborContractsApi.remove(id);
      } catch (error) {
        console.error('Erro ao remover contrato:', error);
        onUpdateProject({ laborContracts: previous });
      }
    }
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
          label="Saldo" 
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
                    <span>{new Date(contract.dataInicio).toLocaleDateString('pt-BR')}</span>
                    {contract.dataFim && (
                      <>
                        <span className="text-slate-300 mx-2">→</span>
                        <span>{new Date(contract.dataFim).toLocaleDateString('pt-BR')}</span>
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
                    onClick={() => removeContract(contract.id)}
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
                  <p className="text-[9px] font-black text-amber-600 uppercase mb-1">Saldo</p>
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
              {contract.pagamentos.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <FileText size={12} /> Histórico de Pagamentos ({contract.pagamentos.length})
                  </h4>
                  <div className="space-y-2">
                    {contract.pagamentos.slice(-3).map(pag => (
                      <div 
                        key={pag.id} 
                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-white">
                              {pag.descricao || 'Pagamento'}
                            </p>
                            <p className="text-[9px] text-slate-400">
                              {new Date(pag.data).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-black text-emerald-600">
                          R$ {pag.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
          workItems={project.items.filter(i => i.type === 'item')}
          isReadOnly={isReadOnly}
          onClose={() => { setIsModalOpen(false); setEditingContract(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

const ContractModal = ({ contract, workforce, workItems, isReadOnly, onClose, onSave }: any) => {
  const [data, setData] = useState<LaborContract>(
    contract || laborContractService.createContract('empreita')
  );

  const handleAddPayment = () => {
    if (isReadOnly) return;
    const newPayment = laborContractService.createPayment();
    setData({ ...data, pagamentos: [...data.pagamentos, newPayment] });
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
        alert('Falha ao enviar o comprovante. Tente novamente.');
      }
    }
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
                type="number"
                step="0.01"
                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500"
                value={data.valorTotal}
                onChange={e => setData({ ...data, valorTotal: parseFloat(e.target.value) || 0 })}
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

          {/* Vincular Item da EAP (Opcional) */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">
              Vincular Item da EAP (Opcional)
            </label>
            <select
              className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500"
              value={data.linkedWorkItemId || ''}
              onChange={e => setData({ ...data, linkedWorkItemId: e.target.value })}
              disabled={isReadOnly}
            >
              <option value="">Nenhum</option>
              {workItems.map((item: any) => (
                <option key={item.id} value={item.id}>
                  {item.wbs} - {item.name}
                </option>
              ))}
            </select>
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

          {/* Pagamentos */}
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
                        type="number"
                        step="0.01"
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none"
                        value={pag.valor}
                        onChange={e => handleUpdatePayment(pag.id, { valor: parseFloat(e.target.value) || 0 })}
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

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">
                      Comprovante
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
                </div>
              ))}

              {data.pagamentos.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Nenhum pagamento registrado
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-8 border-t-2 dark:border-slate-800 mt-auto">
          <button 
            onClick={onClose}
            className="flex-1 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={() => onSave(data)}
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
    indigo: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40', 
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40', 
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/40',
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/40'
  };
  
  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${colors[color]}`}>
        {icon}
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-black dark:text-white tracking-tighter mb-1">{value}</p>
      <p className="text-[9px] font-bold text-slate-400 uppercase">{sub}</p>
    </div>
  );
};
