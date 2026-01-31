
import * as XLSX from 'xlsx';
import { WorkItem, ItemType, Project } from '../types';
import { financial } from '../utils/math';

export interface ImportResult {
  items: WorkItem[];
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
      ["1.1.2", "item", "SIN-96995", "Reaterro manual de valas", "m3", "80", "28.30"],
      ["1.2", "category", "FUND", "1.2 Fundações Profundas", "", "", ""],
      ["1.2.1", "category", "ESTACAS", "1.2.1 Estacas de Concreto", "", "", ""],
      ["1.2.1.1", "item", "SIN-95892", "Estaca Strauss diâmetro 32cm", "m", "120", "85.00"],
      ["2", "category", "SUP-EST", "2. SUPERESTRUTURA", "", "", ""],
      ["2.1", "item", "SIN-92762", "Armação de pilar ou viga", "kg", "850", "12.40"],
      ["2.2", "item", "SIN-10191", "Concreto usinado fck 30mpa", "m3", "25", "480.00"],
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 45 }, { wch: 10 }, { wch: 15 }, { wch: 20 }];
    
    XLSX.utils.book_append_sheet(wb, ws, "Planilha_EAP");
    XLSX.writeFile(wb, "ProMeasure_Template_Profissional.xlsx");
  },

  exportProjectToExcel: (project: Project, flattenedItems: (WorkItem & { depth: number })[]) => {
    const wb = XLSX.utils.book_new();
    
    const reportHeader = [
      [project.companyName.toUpperCase()],
      ["RELATÓRIO DE MEDIÇÃO CONSOLIDADO"],
      [`Projeto: ${project.name}`],
      [`Medição: #${project.measurementNumber} | BDI Aplicado: ${project.bdi}%`],
      [],
      ["WBS", "CÓD.", "DESCRIÇÃO", "UND", "QTD CONTRATO", "P. UNIT (C/ BDI)", "VALOR TOTAL CONTRATO", "TOTAL NO PERÍODO", "TOTAL ACUMULADO", "% ACUM."]
    ];

    const rows = flattenedItems.map(item => [
      item.wbs,
      item.cod || "",
      "  ".repeat(item.depth) + item.name,
      item.unit || "-",
      item.type === 'item' ? item.contractQuantity : "-",
      item.type === 'item' ? item.unitPrice : "-",
      item.contractTotal,
      item.currentTotal,
      item.accumulatedTotal,
      (item.accumulatedPercentage / 100)
    ]);

    const ws = XLSX.utils.aoa_to_sheet([...reportHeader, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Planilha_Orcamentaria");
    XLSX.writeFile(wb, `Medicao_${project.measurementNumber}_${project.name}.xlsx`);
  },

  parseAndValidate: async (file: File): Promise<ImportResult> => {
    console.log("[ExcelImport] Iniciando importação do arquivo:", file.name);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onerror = (err) => {
        console.error("[ExcelImport] Erro no FileReader:", err);
        reject(new Error("Falha ao ler o arquivo físico. O arquivo pode estar corrompido ou em uso."));
      };

      reader.onload = (e) => {
        try {
          const buffer = e.target?.result;
          if (!buffer) throw new Error("O conteúdo do arquivo está vazio.");
          
          console.log("[ExcelImport] Arquivo lido. Iniciando processamento XLSX...");
          const data = new Uint8Array(buffer as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          if (!workbook.SheetNames.length) throw new Error("O arquivo Excel não possui planilhas.");
          
          const sheetName = workbook.SheetNames[0];
          console.log("[ExcelImport] Processando planilha:", sheetName);
          const worksheet = workbook.Sheets[sheetName];
          
          const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
          console.log(`[ExcelImport] Total de linhas brutas encontradas: ${rows.length}`);

          if (rows.length < 2) throw new Error("A planilha selecionada não possui dados suficientes (mínimo cabeçalho + 1 linha).");

          const normalize = (val: any) => String(val || "").toLowerCase().trim()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_");

          const parseNumber = (val: any): number => {
            if (typeof val === 'number') return val;
            let str = String(val || "0").trim();
            if (!str || str === "0") return 0;

            str = str.replace(/[R$\s]/g, "");
            const hasComma = str.includes(',');
            const hasDot = str.includes('.');

            if (hasComma && hasDot) {
              if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
                return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
              } else {
                return parseFloat(str.replace(/,/g, "")) || 0;
              }
            } else if (hasComma) {
              return parseFloat(str.replace(",", ".")) || 0;
            } else if (hasDot) {
              return parseFloat(str) || 0;
            }
            return parseFloat(str) || 0;
          };

          const aliases: Record<string, string[]> = {
            wbs: ["wbs", "item", "posicao", "nivel", "n_"],
            name: ["nome", "descricao", "servico", "discriminacao", "item", "nome_do_servico"],
            qty: ["quantidade", "qtd", "volume", "contrato"],
            price: ["preco", "unitario", "valor", "pu", "s_bdi", "preco_unitario_s_bdi"],
            unit: ["unidade", "und", "un"],
            type: ["tipo", "classe", "categoria"],
            cod: ["codigo", "ref", "cod", "sinapi"]
          };

          let colMap: Record<string, number> = { wbs: -1, name: -1, qty: -1, price: -1, unit: -1, type: -1, cod: -1 };
          let headerIdx = -1;

          // Busca pelo cabeçalho nas primeiras 50 linhas
          for (let i = 0; i < Math.min(rows.length, 50); i++) {
            const row = rows[i].map(c => normalize(c));
            let matches = 0;
            
            Object.entries(aliases).forEach(([key, list]) => {
              const idx = row.findIndex(cell => list.some(a => cell === a || cell.includes(a)));
              if (idx !== -1) { 
                colMap[key] = idx; 
                matches++; 
              }
            });

            // Se encontrarmos nome e pelo menos mais um campo, assumimos que é o cabeçalho
            if (matches >= 2 && colMap.name !== -1) { 
              headerIdx = i; 
              console.log(`[ExcelImport] Cabeçalho detectado na linha ${i + 1}. Mapeamento:`, colMap);
              break; 
            }
          }

          if (headerIdx === -1) {
            throw new Error("Não foi possível identificar as colunas obrigatórias (Nome/Descrição e pelo menos mais uma). Verifique se os cabeçalhos estão na primeira página.");
          }

          const rawData = rows.slice(headerIdx + 1).filter(r => String(r[colMap.name] || "").trim() !== "");
          console.log(`[ExcelImport] Total de linhas de dados após filtragem: ${rawData.length}`);
          
          const items: WorkItem[] = [];
          const wbsToId: Record<string, string> = {};

          rawData.forEach((row, index) => {
            const wbs = colMap.wbs !== -1 ? String(row[colMap.wbs] || "").trim() : (index + 1).toString();
            const id = crypto.randomUUID();
            wbsToId[wbs] = id;
            
            const qty = parseNumber(row[colMap.qty]);
            const price = parseNumber(row[colMap.price]);
            const typeRaw = colMap.type !== -1 ? normalize(row[colMap.type]) : "";
            
            // Heurística para detectar se é categoria: Tem o tipo explícito ou Qtd e Preço são zero/vazio
            const type: ItemType = (typeRaw.includes('cat') || typeRaw.includes('grupo') || (qty === 0 && price === 0)) 
              ? 'category' 
              : 'item';

            items.push({
              id,
              parentId: null,
              name: String(row[colMap.name]).trim(),
              type,
              wbs: wbs,
              order: index,
              unit: colMap.unit !== -1 ? String(row[colMap.unit] || "un").trim() : (type === 'item' ? 'un' : ''),
              cod: colMap.cod !== -1 ? String(row[colMap.cod] || "").trim() : "",
              contractQuantity: qty,
              unitPrice: 0,
              unitPriceNoBdi: price,
              contractTotal: 0,
              previousQuantity: 0, previousTotal: 0, currentQuantity: 0, currentTotal: 0, currentPercentage: 0,
              accumulatedQuantity: 0, accumulatedTotal: 0, accumulatedPercentage: 0, balanceQuantity: 0, balanceTotal: 0
            });
          });

          // Reconstrução da hierarquia baseada no WBS (ex: 1.1 -> pai é 1)
          items.forEach(item => {
            if (item.wbs.includes('.')) {
              const parts = item.wbs.split('.');
              const parentWbs = parts.slice(0, -1).join('.');
              if (wbsToId[parentWbs]) {
                item.parentId = wbsToId[parentWbs];
              }
            }
          });

          console.log("[ExcelImport] Processamento concluído com sucesso.");
          resolve({
            items,
            errors: [],
            stats: {
              items: items.filter(i => i.type === 'item').length,
              categories: items.filter(i => i.type === 'category').length
            }
          });
        } catch (err: any) {
          console.error("[ExcelImport] Erro durante o processamento:", err);
          reject(err);
        }
      };
      
      reader.readAsArrayBuffer(file);
    });
  }
};
