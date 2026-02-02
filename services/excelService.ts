
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
    byType: {
      labor: number;
      material: number;
      revenue: number;
    }
  };
}

const WBS_HEADERS = ["WBS", "TIPO_ITEM", "CODIGO", "NOME", "UNIDADE", "QUANTIDADE", "UNITARIO_S_BDI", "FONTE"];
const EXPENSE_HEADERS = ["WBS", "TIPO_REGISTRO", "CATEGORIA", "DATA", "DESCRICAO", "ENTIDADE", "UNIDADE", "QUANTIDADE", "UNITARIO", "DESCONTO", "TOTAL_LIQUIDO", "PAGO"];

const parseVal = (v: any): number => {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number') return v;
  
  let s = String(v).trim();
  s = s.replace(/R\$\s?/g, '').replace(/\s/g, '');
  
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

export const excelService = {
  downloadTemplate: () => {
    const wb = XLSX.utils.book_new();
    const data = [
      WBS_HEADERS,
      ["1", "category", "INFRA", "1. INFRAESTRUTURA", "", "", "", "Próprio"],
      ["1.1", "category", "MOV-TERRA", "1.1 Movimentação de Terra", "", "", "", "Próprio"],
      ["1.1.1", "item", "SIN-93358", "Escavação manual de valas", "m3", "150", "45.50", "SINAPI"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Template_EAP");
    XLSX.writeFile(wb, "ProMeasure_Template_EAP.xlsx");
  },

  downloadExpenseTemplate: () => {
    const wb = XLSX.utils.book_new();
    const data = [
      EXPENSE_HEADERS,
      ["1", "category", "MA", "", "01. MATERIAIS", "", "", "", "", "", "", ""],
      ["1.1.1", "item", "MA", "2024-06-01", "Cimento CP-II 50kg", "Depósito Silva", "sc", "100", "34.90", "150.00", "3340.00", "S"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Modelo_Financeiro");
    XLSX.writeFile(wb, "Template_Financeiro_ProMeasure.xlsx");
  },

  exportExpensesToExcel: (project: Project, rawExpenses: ProjectExpense[], filterType?: ExpenseType) => {
    const wb = XLSX.utils.book_new();
    const filtered = filterType ? rawExpenses.filter(e => e.type === filterType) : rawExpenses;
    const tree = treeService.buildTree(filtered);
    const processedTree = tree.map((root, idx) => treeService.processExpensesRecursive(root as ProjectExpense, '', idx));
    const allIds = new Set(filtered.map(e => e.id));
    const fullFlattened = treeService.flattenTree(processedTree, allIds);

    const rows = fullFlattened.map(e => [
      e.wbs, e.itemType, e.type, e.itemType === 'item' ? e.date : "", e.description,
      e.itemType === 'item' ? e.entityName : "", e.unit || "", e.itemType === 'item' ? e.quantity : "",
      e.itemType === 'item' ? e.unitPrice : "", e.itemType === 'item' ? (e.discountValue || 0) : "",
      e.amount, e.itemType === 'item' ? (e.isPaid ? "S" : "N") : ""
    ]);
    const ws = XLSX.utils.aoa_to_sheet([EXPENSE_HEADERS, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Export_Financeiro");
    XLSX.writeFile(wb, `Financeiro_${project.name}.xlsx`);
  },

  parseExpensesExcel: async (file: File): Promise<ExpenseImportResult> => {
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
          const stats = { categories: 0, items: 0, byType: { labor: 0, material: 0, revenue: 0 } };

          dataRows.forEach((row, idx) => {
            const wbs = String(row[0] || "").trim();
            const itemType = (String(row[1] || "").toLowerCase() === 'category') ? 'category' : 'item';
            const catLabel = String(row[2] || "MA").toUpperCase();
            const type: ExpenseType = catLabel === 'MO' ? 'labor' : (catLabel === 'RE' ? 'revenue' : 'material');
            const qty = itemType === 'item' ? parseVal(row[7]) : 0;
            const unitPrice = itemType === 'item' ? parseVal(row[8]) : 0;
            const disc = itemType === 'item' ? parseVal(row[9]) : 0;
            const total = itemType === 'item' ? parseVal(row[10]) : 0;
            let expenseDate = new Date().toISOString().split('T')[0];
            if (itemType === 'item' && row[3] instanceof Date) expenseDate = row[3].toISOString().split('T')[0];

            const expense: ProjectExpense = {
              id: crypto.randomUUID(), parentId: null, type, itemType, wbs, order: idx, date: expenseDate,
              description: String(row[4] || "Importado"), entityName: itemType === 'item' ? String(row[5] || "") : "",
              unit: String(row[6] || ""), quantity: qty || 1, unitPrice: unitPrice || (total + disc),
              discountValue: disc, discountPercentage: 0, amount: total || (qty * unitPrice - disc),
              isPaid: String(row[11] || "").toUpperCase().startsWith('S')
            };
            importedExpenses.push(expense);
            if (wbs) wbsMap.set(wbs, expense);
            if (itemType === 'category') stats.categories++; else stats.items++;
            stats.byType[type]++;
          });
          importedExpenses.forEach(exp => {
            if (exp.wbs.includes('.')) {
              const parts = exp.wbs.split('.'); parts.pop();
              const parent = wbsMap.get(parts.join('.'));
              if (parent) exp.parentId = parent.id;
            }
          });
          resolve({ expenses: importedExpenses, errors: [], stats });
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
    const rows = fullFlattened.map(i => [i.wbs, i.type, i.cod || "", i.name, i.unit, i.contractQuantity, i.unitPriceNoBdi, i.fonte || ""]);
    const ws = XLSX.utils.aoa_to_sheet([WBS_HEADERS, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "EAP");
    XLSX.writeFile(wb, `EAP_${project.name}.xlsx`);
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
            const type = (String(row[1] || "").toLowerCase() === 'category' ? 'category' : 'item') as ItemType;
            const qty = parseVal(row[5]);
            const priceNoBdi = parseVal(row[6]);
            // Ajuste aqui: Captura o valor exato ou string vazia se não houver conteúdo
            const fonte = row[7] ? String(row[7]).trim() : "";

            const item: WorkItem = {
              id: crypto.randomUUID(), parentId: null, name: String(row[3] || "Novo Item").trim(),
              type: type, wbs: wbs, order: idx, cod: String(row[2] || "").trim(),
              unit: String(row[4] || ""), contractQuantity: qty, unitPriceNoBdi: priceNoBdi, fonte,
              unitPrice: 0, contractTotal: 0, previousQuantity: 0, previousTotal: 0,
              currentQuantity: 0, currentTotal: 0, currentPercentage: 0,
              accumulatedQuantity: 0, accumulatedTotal: 0, accumulatedPercentage: 0,
              balanceQuantity: 0, balanceTotal: 0
            };
            importedItems.push(item);
            if (wbs) wbsMap.set(wbs, item);
          });
          importedItems.forEach(item => {
            if (item.wbs.includes('.')) {
              const parts = item.wbs.split('.'); parts.pop();
              const parent = wbsMap.get(parts.join('.'));
              if (parent) item.parentId = parent.id;
            }
          });
          resolve({ items: importedItems, errors: [], stats: { 
            categories: importedItems.filter(i => i.type === 'category').length, 
            items: importedItems.filter(i => i.type === 'item').length 
          }});
        } catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    });
  }
};
