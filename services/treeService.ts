
import { WorkItem, ProjectExpense, Project } from '../types';
import { financial } from '../utils/math';

export const treeService = {
  buildTree: <T extends { id: string; parentId: string | null; order: number }>(items: T[]): T[] => {
    const itemMap: { [key: string]: any } = {};
    const roots: T[] = [];

    items.forEach(item => {
      itemMap[item.id] = { ...item, children: [] };
    });

    items.forEach(item => {
      const node = itemMap[item.id];
      if (item.parentId && itemMap[item.parentId]) {
        itemMap[item.parentId].children!.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortNodes = (nodes: any[]) => {
      nodes.sort((a, b) => (a.order || 0) - (b.order || 0));
      nodes.forEach(n => {
        if (n.children) sortNodes(n.children);
      });
    };
    
    sortNodes(roots);
    return roots;
  },

  processRecursive: (node: WorkItem, prefix: string = '', index: number = 0, projectBdi: number = 0): WorkItem => {
    const currentPos = index + 1;
    const wbs = prefix ? `${prefix}.${currentPos}` : `${currentPos}`;
    node.wbs = wbs;

    if (node.type === 'category') {
      if (node.children && node.children.length > 0) {
        node.children = node.children.map((child, idx) => 
          treeService.processRecursive(child, wbs, idx, projectBdi)
        );
        
        node.contractTotal = financial.sum(node.children.map(c => c.contractTotal || 0));
        node.previousTotal = financial.sum(node.children.map(c => c.previousTotal || 0));
        node.currentTotal = financial.sum(node.children.map(c => c.currentTotal || 0));
        node.accumulatedTotal = financial.sum(node.children.map(c => c.accumulatedTotal || 0));
        node.balanceTotal = financial.sum(node.children.map(c => c.balanceTotal || 0));
        
        node.accumulatedPercentage = node.contractTotal > 0 
          ? financial.round((node.accumulatedTotal / node.contractTotal) * 100) 
          : 0;
      } else {
        node.contractTotal = node.currentTotal = node.accumulatedTotal = node.balanceTotal = node.accumulatedPercentage = 0;
      }
    } else {
      // Cálculo de precisão unitária
      node.unitPrice = financial.round((node.unitPriceNoBdi || 0) * (1 + (projectBdi || 0) / 100));
      node.contractTotal = financial.round((node.contractQuantity || 0) * node.unitPrice);
      node.previousTotal = financial.round((node.previousQuantity || 0) * node.unitPrice);
      node.currentTotal = financial.round((node.currentQuantity || 0) * node.unitPrice);
      
      node.accumulatedQuantity = financial.round((node.previousQuantity || 0) + (node.currentQuantity || 0));
      node.accumulatedTotal = financial.round(node.accumulatedQuantity * node.unitPrice);
      
      node.balanceQuantity = financial.round((node.contractQuantity || 0) - node.accumulatedQuantity);
      node.balanceTotal = financial.round(node.balanceQuantity * node.unitPrice);
      
      node.currentPercentage = (node.contractQuantity || 0) > 0 
        ? financial.round(((node.currentQuantity || 0) / node.contractQuantity) * 100) 
        : 0;
      node.accumulatedPercentage = node.contractTotal > 0 
        ? financial.round((node.accumulatedTotal / node.contractTotal) * 100) 
        : 0;
    }
    return node;
  },

  // Fix for missing processExpensesRecursive
  processExpensesRecursive: (node: ProjectExpense, prefix: string = '', index: number = 0): ProjectExpense => {
    const currentPos = index + 1;
    const wbs = prefix ? `${prefix}.${currentPos}` : `${currentPos}`;
    node.wbs = wbs;

    if (node.itemType === 'category') {
      if (node.children && node.children.length > 0) {
        node.children = node.children.map((child, idx) => 
          treeService.processExpensesRecursive(child as ProjectExpense, wbs, idx)
        );
        node.amount = financial.sum(node.children.map(c => c.amount || 0));
      } else {
        node.amount = 0;
      }
    }
    return node;
  },

  calculateBasicStats: (items: WorkItem[], bdi: number, project?: Project) => {
    const tree = treeService.buildTree(items);
    const processed = tree.map((r, i) => treeService.processRecursive(r, '', i, bdi));
    
    // Calcula totais reais da planilha
    const rawTotals = {
      contract: financial.sum(processed.map(n => n.contractTotal || 0)),
      current: financial.sum(processed.map(n => n.currentTotal || 0)),
      accumulated: financial.sum(processed.map(n => n.accumulatedTotal || 0)),
      balance: financial.sum(processed.map(n => n.balanceTotal || 0)),
    };

    // Aplica os Overrides (Ajustes manuais do rodapé) para garantir conformidade com o PDF
    const contract = project?.contractTotalOverride ?? rawTotals.contract;
    const current = project?.currentTotalOverride ?? rawTotals.current;
    
    // O saldo é a diferença entre o contrato forçado e o acumulado real
    const balance = financial.round(contract - rawTotals.accumulated);

    return {
      contract,
      current,
      accumulated: rawTotals.accumulated,
      balance,
      progress: contract > 0 ? (rawTotals.accumulated / contract) * 100 : 0
    };
  },

  flattenTree: <T extends { id: string; children?: T[] }>(nodes: T[], expandedIds: Set<string>, depth: number = 0, results: (T & { depth: number })[] = []): (T & { depth: number })[] => {
    nodes.forEach(node => {
      results.push({ ...node, depth });
      const hasChildren = node.children && node.children.length > 0;
      if (hasChildren && expandedIds.has(node.id)) {
        treeService.flattenTree(node.children!, expandedIds, depth + 1, results);
      }
    });
    return results;
  },

  reorderItems: <T extends { id: string; parentId: string | null; order: number }>(items: T[], sourceId: string, targetId: string, position: 'before' | 'after' | 'inside'): T[] => {
    const sourceItem = items.find(i => i.id === sourceId);
    const targetItem = items.find(i => i.id === targetId);

    if (!sourceItem || !targetItem || sourceId === targetId) return items;

    let newParentId: string | null = null;
    let newOrder: number = 0;

    if (position === 'inside') {
      newParentId = targetItem.id;
      const children = items.filter(i => i.parentId === targetItem.id);
      newOrder = children.length;
    } else {
      newParentId = targetItem.parentId;
      newOrder = position === 'after' ? targetItem.order + 1 : targetItem.order;
    }

    return items.map(item => {
      if (item.id === sourceId) {
        return { ...item, parentId: newParentId, order: newOrder };
      }
      if (item.parentId === newParentId && item.order >= newOrder && item.id !== sourceId) {
        return { ...item, order: item.order + 1 };
      }
      return item;
    });
  },

  // Fix for missing moveInSiblings
  moveInSiblings: <T extends { id: string; parentId: string | null; order: number }>(items: T[], id: string, direction: 'up' | 'down'): T[] => {
    const item = items.find(i => i.id === id);
    if (!item) return items;

    const siblings = items
      .filter(i => i.parentId === item.parentId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const currentIndex = siblings.findIndex(i => i.id === id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= siblings.length) return items;

    const targetItem = siblings[targetIndex];
    const oldOrder = item.order;
    const newOrder = targetItem.order;

    return items.map(i => {
      if (i.id === item.id) return { ...i, order: newOrder };
      if (i.id === targetItem.id) return { ...i, order: oldOrder };
      return i;
    });
  }
};
