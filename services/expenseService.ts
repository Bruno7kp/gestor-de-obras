
import { ProjectExpense, ExpenseType, ExpenseStatus } from '../types';
import { financial } from '../utils/math';

export const expenseService = {
  calculateSubtotal: (expenses: ProjectExpense[], type: ExpenseType): number => {
    const filtered = expenses.filter(e => e.type === type && e.itemType === 'item');
    return financial.sum(filtered.map(e => e.amount));
  },

  getExpenseStats: (expenses: ProjectExpense[]) => {
    const items = expenses.filter(e => e.itemType === 'item');
    
    const labor = financial.sum(items.filter(e => e.type === 'labor').map(e => e.amount));
    const material = financial.sum(items.filter(e => e.type === 'material').map(e => e.amount));
    
    const revenue = financial.sum(items.filter(e => e.type === 'revenue' && (e.isPaid || e.status === 'PAID' || e.status === 'DELIVERED')).map(e => e.amount));
    
    const totalOut = financial.round(labor + material);
    
    const paidOut = financial.sum(items.filter(e => (e.type === 'labor' || e.type === 'material') && (e.isPaid || e.status === 'PAID' || e.status === 'DELIVERED')).map(e => e.amount));
    const unpaidOut = financial.round(totalOut - paidOut);
    
    const profit = financial.round(revenue - totalOut);
    const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      labor,
      material,
      revenue,
      totalOut,
      paidOut,
      unpaidOut,
      profit,
      marginPercent,
      distribution: {
        labor: totalOut > 0 ? (labor / totalOut) * 100 : 0,
        material: totalOut > 0 ? (material / totalOut) * 100 : 0
      }
    };
  },

  /**
   * Gera o Pacote de Liberação (Release Package) formatado para exportação.
   * Consolida dados do pedido e imagens vinculadas para auditoria.
   */
  getReleasePackage: (expense: ProjectExpense) => {
    return {
      id: expense.id,
      protocolo: `REL-${expense.id.slice(0, 8).toUpperCase()}`,
      dataGeracao: new Date().toLocaleDateString('pt-BR'),
      fornecedor: expense.entityName,
      descricao: expense.description,
      valor: financial.formatBRL(expense.amount),
      status: expense.status,
      temComprovante: !!expense.paymentProof,
      temNotaFiscal: !!expense.invoiceDoc,
      comprovanteUrl: expense.paymentProof,
      detalhes: `${expense.quantity} ${expense.unit} x ${financial.formatBRL(expense.unitPrice)}`
    };
  }
};
