
import * as XLSX from 'xlsx';
import { WorkItem, ItemType, Project, ProjectExpense, ExpenseType } from '../types';
import { financial } from '../utils/math';
import { treeService } from './treeService';

export interface ImportResult {
  items: WorkItem[];
  errors: string[];
  stats: {
    categories: number;
    items: number;
  };
}

export interface ExpenseImportResult {
  expenses: ProjectExpense[];
  errors: string[];
  stats: {
    categories: number;
    items: number;
  };
}

const WBS_HEADERS = ["WBS", "TIPO", "CODIGO", "NOME", "UNIDADE", "QUANTIDADE", "UNITARIO_S_BDI"];
const EXPENSE_HEADERS = ["WBS", "TIPO", "DATA", "DESCRICAO", "ENTIDADE", "UNIDADE", "QUANTIDADE", "UNITARIO", "DESCONTO", "TOTAL", "PAGO"];

export const excelService = {
  downloadTemplate: () => {
    const wb = XLSX.utils.book_new();
    const data = [
      WBS_HEADERS,
      ["1", "category", "INFRA", "1. INFRAESTRUTURA", "", "", ""],
      ["1.1", "category", "MOV-TERRA", "1.1 Movimentação de Terra", "", "", ""],
      ["1.1.1", "item", "SIN-93358", "Escavação manual de valas", "m3", "150", "45.50"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Template_EAP");
    XLSX.writeFile(wb, "ProMeasure_Template_EAP.xlsx");
  },

  downloadExpenseTemplate: () => {
    const wb = XLSX.utils.book_new();
    const data = [
      EXPENSE_HEADERS,
      ["1", "category", "", "MATERIAIS DE CONSTRUÇÃO", "", "", "", "", "", "", ""],
      ["1.1", "category", "", "CIMENTOS E ARGAMASSAS", "", "", "", "", "", "", ""],
      ["1.1.1", "item", "2024-05-20", "Cimento CP-II 50kg", "Votorantim", "saco", "100", "32.50", "0", "3250.00", "S"],
      ["2", "category", "", "MÃO DE OBRA EXTERNA", "", "", "", "", "", "", ""],
      ["2.1", "item", "2024-05-21", "Empreitada Pintura", "João Pinturas", "vb", "1", "5000.00", "500", "4500.00", "N"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Template_Gastos");
    XLSX.writeFile(wb, "ProMeasure_Template_Gastos.xlsx");
  },

  exportExpensesToExcel: (project: Project, rawExpenses: ProjectExpense[], filterType?: ExpenseType) => {
    const wb = XLSX.utils.book_new();
    const filtered = filterType ? rawExpenses.filter(e => e.type === filterType) : rawExpenses;
    
    const tree = treeService.buildTree(filtered);
    const processedTree = tree.map((root, idx) => treeService.processExpensesRecursive(root as ProjectExpense, '', idx));
    const allIds = new Set(filtered.map(e => e.id));
    const fullFlattened = treeService.flattenTree(processedTree, allIds);

    const rows = fullFlattened.map(e => [
      e.wbs,
      e.itemType,
      e.itemType === 'item' ? e.date : "",
      e.description,
      e.itemType === 'item' ? e.entityName : "",
      e.unit || "",
      e.itemType === 'item' ? e.quantity : "",
      e.itemType === 'item' ? e.unitPrice : "",
      e.itemType === 'item' ? (e.discountValue || 0) : "",
      e.amount,
      e.itemType === 'item' ? (e.isPaid ? "S" : "N") : ""
    ]);

    const title = filterType ? `Snapshot_${filterType}` : "Snapshot_Financeiro";
    const ws = XLSX.utils.aoa_to_sheet([EXPENSE_HEADERS, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, title);
    XLSX.writeFile(wb, `${title}_${project.name.replace(/\s+/g, '_')}.xlsx`);
  },

  parseExpensesExcel: async (file: File, type: ExpenseType): Promise<ExpenseImportResult> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result;
          const data = new Uint8Array(buffer as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

          const importedExpenses: ProjectExpense[] = [];
          const dataRows = raw.slice(1).filter(r => r.length > 0 && r[0]);
          const wbsMap = new Map<string, ProjectExpense>();

          dataRows.forEach((row, idx) => {
            const wbs = String(row[0] || "").trim();
            const itemTypeStr = String(row[1] || "item").toLowerCase();
            const itemType = (itemTypeStr === 'category' || itemTypeStr === 'grupo' || itemTypeStr === 'pasta') ? 'category' : 'item';
            
            const parseVal = (v: any) => typeof v === 'number' ? v : parseFloat(String(v || "0").replace(/\./g, '').replace(',', '.')) || 0;

            const qty = itemType === 'item' ? parseVal(row[6]) || 1 : 0;
            const unitPrice = itemType === 'item' ? parseVal(row[7]) : 0;
            const discount = itemType === 'item' ? parseVal(row[8]) : 0;
            const total = itemType === 'item' ? parseVal(row[9]) : 0;

            let expenseDate = new Date().toISOString().split('T')[0];
            if (itemType === 'item') {
              const rawDate = row[2];
              if (rawDate instanceof Date) {
                expenseDate = rawDate.toISOString().split('T')[0];
              } else if (rawDate) {
                expenseDate = String(rawDate);
              }
            }

            const expense: ProjectExpense = {
              id: crypto.randomUUID(),
              parentId: null,
              type,
              itemType,
              wbs,
              order: idx,
              date: expenseDate,
              description: String(row[3] || "Novo Registro"),
              entityName: itemType === 'item' ? String(row[4] || "") : "",
              unit: String(row[5] || (itemType === 'category' ? "" : "un")),
              quantity: qty,
              unitPrice: unitPrice || (qty > 0 ? (total + discount) / qty : 0),
              discountValue: discount,
              discountPercentage: 0, 
              amount: total || (qty * unitPrice - discount),
              isPaid: String(row[10] || "").toUpperCase().startsWith('S') || String(row[10] || "").toUpperCase().startsWith('Y')
            };

            // Recalcular porcentagem de desconto para consistência
            if (expense.amount > 0 && expense.discountValue) {
               const base = expense.amount + expense.discountValue;
               expense.discountPercentage = financial.round((expense.discountValue / base) * 100);
            }

            importedExpenses.push(expense);
            if (wbs) wbsMap.set(wbs, expense);
          });

          // Hierarquia baseada em WBS (ex: 1.1 herda de 1)
          importedExpenses.forEach(exp => {
            if (exp.wbs.includes('.')) {
              const parts = exp.wbs.split('.');
              parts.pop();
              const parentWbs = parts.join('.');
              const parent = wbsMap.get(parentWbs);
              if (parent) exp.parentId = parent.id;
            }
          });

          resolve({ 
            expenses: importedExpenses, 
            errors: [],
            stats: {
              categories: importedExpenses.filter(ex => ex.itemType === 'category').length,
              items: importedExpenses.filter(ex => ex.itemType === 'item').length
            }
          });
        } catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    });
  },

  exportProjectToExcel: (project: Project) => {
    const wb = XLSX.utils.book_new();
    const tree = treeService.buildTree(project.items);
    const processedTree = tree.map((root, idx) => treeService.processRecursive(root, '', idx, project.bdi));
    const allIds = new Set(project.items.map(i => i.id));
    const fullFlattened = treeService.flattenTree(processedTree, allIds);

    const rows = fullFlattened.map(i => [
      i.wbs, 
      i.type,
      i.cod || "", 
      i.name, 
      i.unit, 
      i.contractQuantity, 
      i.unitPriceNoBdi
    ]);

    const ws = XLSX.utils.aoa_to_sheet([WBS_HEADERS, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "EAP_Snapshot");
    XLSX.writeFile(wb, `Snapshot_EAP_${project.name.replace(/\s+/g, '_')}.xlsx`);
  },

  parseAndValidate: async (file: File): Promise<ImportResult> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result;
          const data = new Uint8Array(buffer as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

          const importedItems: WorkItem[] = [];
          const dataRows = raw.slice(1).filter(r => r.length > 0 && r[0]);
          const wbsMap = new Map<string, WorkItem>();

          dataRows.forEach((row, idx) => {
            const wbs = String(row[0] || "").trim();
            const type = (String(row[1] || "item").toLowerCase() === 'category' ? 'category' : 'item') as ItemType;
            const parseVal = (v: any) => typeof v === 'number' ? v : parseFloat(String(v || "0").replace(/\./g, '').replace(',', '.')) || 0;
            
            const qty = parseVal(row[5]);
            const priceNoBdi = parseVal(row[6]);

            const item: WorkItem = {
              id: crypto.randomUUID(),
              parentId: null,
              name: String(row[3] || "Novo Item"),
              type: type,
              wbs: wbs,
              order: idx,
              cod: String(row[2] || ""),
              unit: String(row[4] || (type === 'category' ? "" : "un")),
              contractQuantity: qty,
              unitPriceNoBdi: priceNoBdi,
              unitPrice: 0,
              contractTotal: 0,
              previousQuantity: 0,
              previousTotal: 0,
              currentQuantity: 0,
              currentTotal: 0,
              currentPercentage: 0,
              accumulatedQuantity: 0,
              accumulatedTotal: 0,
              accumulatedPercentage: 0,
              balanceQuantity: 0,
              balanceTotal: 0
            };

            importedItems.push(item);
            if (wbs) wbsMap.set(wbs, item);
          });

          importedItems.forEach(item => {
            if (item.wbs.includes('.')) {
              const parts = item.wbs.split('.');
              parts.pop();
              const parentWbs = parts.join('.');
              const parent = wbsMap.get(parentWbs);
              if (parent) item.parentId = parent.id;
            }
          });

          resolve({ 
            items: importedItems, 
            errors: [], 
            stats: { 
              categories: importedItems.filter(i => i.type === 'category').length, 
              items: importedItems.filter(i => i.type === 'item').length 
            } 
          });
        } catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    });
  }
};
