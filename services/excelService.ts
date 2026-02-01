
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

const WBS_HEADERS = ["WBS", "TIPO_ITEM", "CODIGO", "NOME", "UNIDADE", "QUANTIDADE", "UNITARIO_S_BDI"];
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
    
    // Template Complexo de Demonstração
    const data = [
      EXPENSE_HEADERS,
      // GRUPO 1: MATERIAIS (MA)
      ["1", "category", "MA", "", "01. MATERIAIS DE CONSTRUÇÃO E INSUMOS", "", "", "", "", "", "", ""],
      ["1.1", "category", "MA", "", "01.1 INFRAESTRUTURA E CIVIL", "", "", "", "", "", "", ""],
      ["1.1.1", "item", "MA", "2024-06-01", "Cimento CP-II 50kg (Votorantim)", "Depósito Silva", "sc", "100", "34.90", "150.00", "3340.00", "S"],
      ["1.1.2", "item", "MA", "2024-06-02", "Areia Média Lavada", "Pedreira Vale", "m3", "15", "110.00", "0", "1650.00", "S"],
      ["1.1.3", "item", "MA", "2024-06-03", "Aço CA-50 10.0mm", "Gerdau Store", "kg", "500", "7.85", "250.00", "3675.00", "N"],
      ["1.2", "category", "MA", "", "01.2 ELÉTRICA E HIDRÁULICA", "", "", "", "", "", "", ""],
      ["1.2.1", "item", "MA", "2024-06-05", "Cabo Flexível 2,5mm (Rolo 100m)", "Elétrica Central", "un", "10", "189.90", "100.00", "1799.00", "S"],
      ["1.2.2", "item", "MA", "2024-06-05", "Tubo PVC 100mm Esgoto", "Tigre Oficial", "un", "25", "45.00", "0", "1125.00", "S"],
      
      // GRUPO 2: MÃO DE OBRA (MO)
      ["2", "category", "MO", "", "02. MÃO DE OBRA E SERVIÇOS TÉCNICOS", "", "", "", "", "", "", ""],
      ["2.1", "category", "MO", "", "02.1 EQUIPE INTERNA", "", "", "", "", "", "", ""],
      ["2.1.1", "item", "MO", "2024-06-15", "Folha de Pagamento - Junho", "Colaboradores Diversos", "vb", "1", "12500.00", "0", "12500.00", "S"],
      ["2.2", "category", "MO", "", "02.2 TERCEIRIZADOS E EMPREITADAS", "", "", "", "", "", "", ""],
      ["2.2.1", "item", "MO", "2024-06-18", "Instalação de Forro de Gesso", "Gesso Decor Ltda", "m2", "145", "45.00", "500.00", "6025.00", "N"],
      ["2.2.2", "item", "MO", "2024-06-20", "Pintura Externa - Etapa 01", "Pinturas Rápidas", "vb", "1", "8500.00", "850.00", "7650.00", "S"],

      // GRUPO 3: RECEITAS (RE)
      ["3", "category", "RE", "", "03. FATURAMENTO E APORTES (RECEITAS)", "", "", "", "", "", "", ""],
      ["3.1", "item", "RE", "2024-06-10", "Medição #01 - Cliente Residencial", "Família Souza", "vb", "1", "25000.00", "0", "25000.00", "S"],
      ["3.2", "item", "RE", "2024-06-25", "Adiantamento para Acabamentos", "Família Souza", "vb", "1", "15000.00", "0", "15000.00", "N"],
      ["3.3", "item", "RE", "2024-06-28", "Reembolso Materiais Extras", "Condomínio Edgard", "vb", "1", "2450.00", "0", "2450.00", "S"]
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Estilização básica de larguras de coluna (apenas para o arquivo gerado)
    ws['!cols'] = [
      { wch: 10 }, // WBS
      { wch: 15 }, // TIPO_REGISTRO
      { wch: 12 }, // CATEGORIA
      { wch: 12 }, // DATA
      { wch: 40 }, // DESCRICAO
      { wch: 25 }, // ENTIDADE
      { wch: 8 },  // UNIDADE
      { wch: 12 }, // QUANTIDADE
      { wch: 15 }, // UNITARIO
      { wch: 12 }, // DESCONTO
      { wch: 15 }, // TOTAL_LIQUIDO
      { wch: 8 }   // PAGO
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Modelo_Financeiro_Completo");
    XLSX.writeFile(wb, "Template_Financeiro_ProMeasure_PRO.xlsx");
  },

  exportExpensesToExcel: (project: Project, rawExpenses: ProjectExpense[], filterType?: ExpenseType) => {
    const wb = XLSX.utils.book_new();
    const filtered = filterType ? rawExpenses.filter(e => e.type === filterType) : rawExpenses;
    
    const tree = treeService.buildTree(filtered);
    const processedTree = tree.map((root, idx) => treeService.processExpensesRecursive(root as ProjectExpense, '', idx));
    const allIds = new Set(filtered.map(e => e.id));
    const fullFlattened = treeService.flattenTree(processedTree, allIds);

    const rows = fullFlattened.map(e => {
      const typeLabel = e.type === 'labor' ? 'MO' : (e.type === 'revenue' ? 'RE' : 'MA');
      return [
        e.wbs,
        e.itemType,
        typeLabel,
        e.itemType === 'item' ? e.date : "",
        e.description,
        e.itemType === 'item' ? e.entityName : "",
        e.unit || "",
        e.itemType === 'item' ? e.quantity : "",
        e.itemType === 'item' ? e.unitPrice : "",
        e.itemType === 'item' ? (e.discountValue || 0) : "",
        e.amount,
        e.itemType === 'item' ? (e.isPaid ? "S" : "N") : ""
      ];
    });

    const title = filterType ? `Export_${filterType}` : "Export_Financeiro_Geral";
    const ws = XLSX.utils.aoa_to_sheet([EXPENSE_HEADERS, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, title);
    XLSX.writeFile(wb, `${title}_${project.name.replace(/\s+/g, '_')}.xlsx`);
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

          const stats = {
            categories: 0,
            items: 0,
            byType: { labor: 0, material: 0, revenue: 0 }
          };

          dataRows.forEach((row, idx) => {
            const wbs = String(row[0] || "").trim();
            const itemTypeStr = String(row[1] || "item").toLowerCase();
            const itemType = (itemTypeStr === 'category' || itemTypeStr === 'grupo' || itemTypeStr === 'pasta') ? 'category' : 'item';
            
            const catLabel = String(row[2] || "MA").toUpperCase();
            const type: ExpenseType = catLabel === 'MO' ? 'labor' : (catLabel === 'RE' ? 'revenue' : 'material');
            
            const qty = itemType === 'item' ? parseVal(row[7]) : 0;
            const unitPrice = itemType === 'item' ? parseVal(row[8]) : 0;
            const disc = itemType === 'item' ? parseVal(row[9]) : 0;
            const total = itemType === 'item' ? parseVal(row[10]) : 0;

            let expenseDate = new Date().toISOString().split('T')[0];
            if (itemType === 'item') {
              const rawDate = row[3];
              if (rawDate instanceof Date) {
                expenseDate = rawDate.toISOString().split('T')[0];
              } else if (rawDate) {
                expenseDate = String(rawDate).trim();
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
              description: String(row[4] || "Importado"),
              entityName: itemType === 'item' ? String(row[5] || "") : "",
              unit: String(row[6] || (itemType === 'category' ? "" : "un")),
              quantity: qty || (itemType === 'item' ? 1 : 0),
              unitPrice: unitPrice || (total + disc),
              discountValue: disc,
              discountPercentage: 0,
              amount: total || (qty * unitPrice - disc),
              isPaid: String(row[11] || "").toUpperCase().startsWith('S')
            };

            if (expense.unitPrice > 0 && expense.quantity > 0) {
              const base = expense.unitPrice * expense.quantity;
              expense.discountPercentage = base > 0 ? financial.round((expense.discountValue! / base) * 100) : 0;
            }

            importedExpenses.push(expense);
            if (wbs) wbsMap.set(wbs, expense);

            if (itemType === 'category') stats.categories++; else stats.items++;
            stats.byType[type]++;
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
