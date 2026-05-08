import { LaborContract, LaborPayment, LaborContractType, LaborPaymentStatus } from '../types';
import { financial } from '../utils/math';

export const laborContractService = {
  
  createContract(tipo: LaborContractType): LaborContract {
    return {
      id: crypto.randomUUID(),
      tipo,
      descricao: tipo === 'empreita' ? 'Nova Empreita' : 'Nova Quinzena/Diária',
      associadoId: '',
      contractorId: undefined,
      valorTotal: 0,
      valorPago: 0,
      status: 'pendente',
      dataInicio: new Date().toISOString().split('T')[0],
      linkedWorkItemIds: [],
      pagamentos: [],
      ordem: Math.floor(Date.now() / 1000)
    };
  },

  createPayment(): LaborPayment {
    return {
      id: crypto.randomUUID(),
      data: new Date().toISOString().split('T')[0],
      valor: 0,
      descricao: ''
    };
  },

  calculateTotalPaid(pagamentos: LaborPayment[]): number {
    return financial.sum(pagamentos.map(p => p.valor));
  },

  calculateStatus(valorTotal: number, valorPago: number): LaborPaymentStatus {
    if (valorPago === 0) return 'pendente';
    if (valorPago >= valorTotal) return 'pago';
    return 'parcial';
  },

  updateContract(contract: LaborContract): LaborContract {
    const valorPago = this.calculateTotalPaid(contract.pagamentos);
    const status = this.calculateStatus(contract.valorTotal, valorPago);
    return { ...contract, valorPago, status };
  },

  getContractsByAssociado(contracts: LaborContract[], associadoId: string): LaborContract[] {
    return contracts.filter(c => c.associadoId === associadoId);
  },

  getContractStats(contracts: LaborContract[]) {
    const total = contracts.length;
    const empreitas = contracts.filter(c => c.tipo === 'empreita').length;
    const diarias = contracts.filter(c => c.tipo === 'diaria').length;
    const pendentes = contracts.filter(c => c.status === 'pendente').length;
    const valorTotalGeral = financial.sum(contracts.map(c => c.valorTotal));
    const valorPagoGeral = financial.sum(contracts.map(c => c.valorPago));
    const saldo = valorTotalGeral - valorPagoGeral;

    return {
      total,
      empreitas,
      diarias,
      pendentes,
      valorTotalGeral,
      valorPagoGeral,
      saldo
    };
  }
};
