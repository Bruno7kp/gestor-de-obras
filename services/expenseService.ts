
import { ProjectExpense, ExpenseType } from '../types';
import { financial } from '../utils/math';

export const expenseService = {
  /**
   * Calcula o subtotal de uma categoria específica de gasto ou receita
   */
  calculateSubtotal: (expenses: ProjectExpense[], type: ExpenseType): number => {
    // Apenas itens contam para o subtotal (categorias são apenas agregadores visuais na árvore)
    const filtered = expenses.filter(e => e.type === type && e.itemType === 'item');
    return financial.sum(filtered.map(e => e.amount));
  },

  /**
   * Consolida todos os gastos (Materiais + MO)
   */
  calculateTotalExpenses: (expenses: ProjectExpense[]): number => {
    return financial.sum(expenses.filter(e => (e.type === 'labor' || e.type === 'material') && e.itemType === 'item').map(e => e.amount));
  },

  /**
   * Retorna estatísticas detalhadas do fluxo de caixa
   */
  getExpenseStats: (expenses: ProjectExpense[]) => {
    const labor = expenseService.calculateSubtotal(expenses, 'labor');
    const material = expenseService.calculateSubtotal(expenses, 'material');
    const revenue = expenseService.calculateSubtotal(expenses, 'revenue');
    
    const totalOut = financial.round(labor + material);
    const balance = financial.round(revenue - totalOut);

    return {
      labor,
      material,
      revenue,
      totalOut,
      balance,
      laborPercentage: totalOut > 0 ? (labor / totalOut) * 100 : 0,
      materialPercentage: totalOut > 0 ? (material / totalOut) * 100 : 0
    };
  }
};
