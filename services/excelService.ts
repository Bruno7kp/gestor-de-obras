
import * as XLSX from 'xlsx';
import { WorkItem, ItemType, Project, ProjectExpense, ExpenseType } from '../types';
import { financial } from '../utils/math';

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

export const excelService = {
  downloadTemplate: () => {
    const wb = XLSX.utils.book_new();
    const data = [
      ["WBS", "TIPO", "CODIGO", "NOME DO SERVICO", "UNIDADE", "QUANTIDADE", "PRECO UNITARIO S/ BDI"],
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
      ["WBS", "TIPO", "DATA", "DESCRICAO", "FORNECEDOR", "UNIDADE", "QUANTIDADE", "UNITARIO", "TOTAL_PAGO", "PAGO(S/N)"],
      ["1", "category", "", "MATERIAIS DE CONSTRUÇÃO", "", "", "", "", "", ""],
      ["1.1", "category", "", "CIMENTOS E ARGAMASSAS", "", "", "", "", "", ""],
      ["1.1.1", "item", "2024-05-20", "Cimento CP-II 50kg", "Votorantim", "saco", "100", "32.50", "3250.00", "S"],
      ["2", "category", "", "MÃO DE OBRA EXTERNA", "", "", "", "", "", ""],
      ["2.1", "item", "2024-05-21", "Empreitada Pintura", "João Pinturas", "vb", "1", "5000.00", "4500.00", "N"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Template_Gastos");
    XLSX.writeFile(wb, "ProMeasure_Template_Gastos.xlsx");
  },

  exportExpensesToExcel: (project: Project, expenses: ProjectExpense[]) => {
    const wb = XLSX.utils.book_new();
    const header = [
      ["PROJETO:", project.name.toUpperCase()],
      ["RELATÓRIO DE DESPESAS - " + new Date().toLocaleDateString()],
      [],
      ["WBS", "TIPO", "DATA", "DESCRIÇÃO", "ENTIDADE/FORNECEDOR", "UNIDADE", "QUANTIDADE", "P. UNITÁRIO", "TOTAL", "STATUS"]
    ];

    const rows = expenses.map(e => [
      e.wbs,
      e.itemType,
      e.itemType === 'item' ? e.date : "",
      e.description,
      e.itemType === 'item' ? e.entityName : "",
      e.unit || "-",
      e.itemType === 'item' ? e.quantity : "-",
      e.itemType === 'item' ? e.unitPrice : "-",
      e.amount,
      e.itemType === 'item' ? (e.isPaid ? "PAGO" : "PENDENTE") : "-"
    ]);

    const ws = XLSX.utils.aoa_to_sheet([...header, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Gastos");
    XLSX.writeFile(wb, `Gastos_${project.name}.xlsx`);
  },

  parseExpensesExcel: async (file: File, type: ExpenseType): Promise<ExpenseImportResult> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result;
          const data = new Uint8Array(buffer as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

          const importedExpenses: ProjectExpense[] = [];
          const dataRows = raw.slice(1).filter(r => r.length > 0 && r[0]);

          const wbsMap = new Map<string, ProjectExpense>();

          dataRows.forEach((row, idx) => {
            const wbs = String(row[0] || "").trim();
            const itemType = (String(row[1] || "item").toLowerCase() === 'category' ? 'category' : 'item') as ItemType;
            
            const amount = typeof row[8] === 'number' ? row[8] : parseFloat(String(row[8] || "0").replace(',', '.')) || 0;
            const qty = typeof row[6] === 'number' ? row[6] : parseFloat(String(row[6] || "1").replace(',', '.')) || 1;
            const unitPrice = typeof row[7] === 'number' ? row[7] : parseFloat(String(row[7] || "0").replace(',', '.')) || (qty > 0 ? amount / qty : 0);
            
            const expense: ProjectExpense = {
              id: crypto.randomUUID(),
              parentId: null,
              type,
              itemType,
              wbs,
              order: idx,
              date: itemType === 'item' ? String(row[2] || new Date().toISOString().split('T')[0]) : "",
              description: String(row[3] || "Novo Gasto"),
              entityName: itemType === 'item' ? String(row[4] || "") : "",
              unit: String(row[5] || (itemType === 'category' ? "" : "un")),
              quantity: itemType === 'item' ? qty : 0,
              unitPrice: itemType === 'item' ? unitPrice : 0,
              amount: amount,
              isPaid: String(row[9] || "").toUpperCase().startsWith('S')
            };

            importedExpenses.push(expense);
            if (wbs) wbsMap.set(wbs, expense);
          });

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

  exportProjectToExcel: (project: Project, flattenedItems: (WorkItem & { depth: number })[]) => {
    const wb = XLSX.utils.book_new();
    const header = [
      [project.companyName.toUpperCase()],
      ["RELATÓRIO DE MEDIÇÃO"],
      [],
      ["WBS", "CÓD.", "DESCRIÇÃO", "UND", "QTD", "P. UNIT", "TOTAL"]
    ];
    const rows = flattenedItems.map(i => [i.wbs, i.cod || "", i.name, i.unit, i.contractQuantity, i.unitPrice, i.contractTotal]);
    const ws = XLSX.utils.aoa_to_sheet([...header, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Medicao");
    XLSX.writeFile(wb, `Medicao_${project.name}.xlsx`);
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
            
            const qty = typeof row[5] === 'number' ? row[5] : parseFloat(String(row[5] || "0").replace(',', '.')) || 0;
            const priceNoBdi = typeof row[6] === 'number' ? row[6] : parseFloat(String(row[6] || "0").replace(',', '.')) || 0;

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
              unitPrice: 0, // Calculado depois pelo treeService aplicando BDI
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

          // Resolver parentesco via WBS
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
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }
};
