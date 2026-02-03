
import { ProjectExpense, ExpenseType } from '../types';
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
    
    // Somente receitas MARCADAS COMO RECEBIDAS (isPaid === true) entram na conta do sistema
    const revenue = financial.sum(items.filter(e => e.type === 'revenue' && e.isPaid).map(e => e.amount));
    
    const totalOut = financial.round(labor + material);
    
    const paidOut = financial.sum(items.filter(e => (e.type === 'labor' || e.type === 'material') && e.isPaid).map(e => e.amount));
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
  }
};
