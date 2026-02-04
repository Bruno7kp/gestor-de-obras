
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, WorkItem, ItemType } from '../types';
import { treeService } from '../services/treeService';
import { excelService, ImportResult } from '../services/excelService';
import { financial } from '../utils/math';
import { TreeTable } from './TreeTable';
import { 
  Plus, Layers, Search, FileSpreadsheet, UploadCloud, Download, 
  X, CheckCircle2, AlertCircle, Package, RefreshCw, Eraser, Printer
} from 'lucide-react';

interface WbsViewProps {
  project: Project;
  onUpdateProject: (data: Partial<Project>) => void;
  onOpenModal: (type: ItemType, item: WorkItem | null, parentId: string | null) => void;
  isReadOnly?: boolean;
}

export const WbsView: React.FC<WbsViewProps> = ({ 
  project, onUpdateProject, onOpenModal, isReadOnly 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Estados para controle de importação e UI
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(`exp_wbs_${project.id}`);
    return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
  });

  useEffect(() => {
    localStorage.setItem(`exp_wbs_${project.id}`, JSON.stringify(Array.from(expandedIds)));
  }, [expandedIds, project.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && importSummary) setImportSummary(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [importSummary]);

  const processedTree = useMemo(() => {
    const tree = treeService.buildTree<WorkItem>(project.items);
    return tree.map((root, idx) => treeService.processRecursive(root, '', idx, project.bdi));
  }, [project.items, project.bdi]);

  const flattenedList = useMemo(() => 
    treeService.flattenTree(processedTree, expandedIds)
  , [processedTree, expandedIds]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const result = await excelService.parseAndValidate(file);
      setImportSummary(result);
    } catch (err) {
      alert("Erro ao processar o arquivo. Verifique se o formato está correto.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmImport = () => {
    if (!importSummary) return;
    // Substituição total para evitar duplicação
    onUpdateProject({ items: importSummary.items });
    setImportSummary(null);
  };

  const handleForceRecalculate = () => {
    if (window.confirm("Isso irá recalcular todos os preços unitários c/ BDI e limpar os ajustes manuais do rodapé para sincronizar com o BDI atual. Continuar?")) {
      const recalculatedItems = treeService.forceRecalculate(project.items, project.bdi);
      onUpdateProject({ 
        items: recalculatedItems,
        contractTotalOverride: undefined,
        currentTotalOverride: undefined
      });
    }
  };

  const handleClearOverrides = () => {
    onUpdateProject({ 
      contractTotalOverride: undefined,
      currentTotalOverride: undefined
    });
  };

  // HANDLERS COM VALIDAÇÃO DE REGRA DE NEGÓCIO (CLAMPS)
  const updateItemQuantity = (id: string, qty: number) => {
    if (isReadOnly) return;
    onUpdateProject({
      items: project.items.map(it => {
        if (it.id === id) {
          const maxPossible = Math.max(0, (it.contractQuantity || 0) - (it.previousQuantity || 0));
          const safeQty = Math.min(Math.max(0, qty), maxPossible);
          return { ...it, currentQuantity: safeQty };
        }
        return it;
      })
    });
  };

  const updateItemPercentage = (id: string, pct: number) => {
    if (isReadOnly) return;
    onUpdateProject({
      items: project.items.map(it => {
        if (it.id === id) {
          const prevPct = it.contractQuantity > 0 ? (it.previousQuantity / it.contractQuantity) * 100 : 0;
          const maxPctAllowed = Math.max(0, 100 - prevPct);
          const safePct = Math.min(Math.max(0, pct), maxPctAllowed);
          const calculatedQty = financial.round((safePct / 100) * it.contractQuantity);
          return { ...it, currentQuantity: calculatedQty, currentPercentage: safePct };
        }
        return it;
      })
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />

      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button 
            type="button"
            disabled={isReadOnly}
            onClick={() => onOpenModal('item', null, null)} 
            className="px-6 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-lg shadow-indigo-500/10 disabled:opacity-30"
          >
            <Plus size={14} className="inline mr-1"/> Novo Item
          </button>
          
          <div className="hidden sm:block w-px h-6 bg-slate-100 dark:bg-slate-800 mx-1" />

          <button 
            onClick={handleForceRecalculate}
            disabled={isReadOnly}
            className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-600 hover:text-white transition-all disabled:opacity-30"
            title="Recalcular todos os itens com base no BDI global"
          >
            <RefreshCw size={14} /> Recalcular Tudo
          </button>

          {(project.contractTotalOverride !== undefined || project.currentTotalOverride !== undefined) && (
            <button 
              onClick={handleClearOverrides}
              disabled={isReadOnly}
              className="flex items-center gap-2 px-4 py-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all"
              title="Limpar ajustes manuais do rodapé"
            >
              <Eraser size={14} /> Limpar Ajustes
            </button>
          )}
          
          <div className="hidden sm:block w-px h-6 bg-slate-100 dark:bg-slate-800 mx-1" />
          
          <button type="button" onClick={() => excelService.downloadTemplate()} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Download Template Excel">
            <FileSpreadsheet size={18}/>
          </button>
          <button 
            type="button" 
            disabled={isReadOnly || isImporting}
            onClick={() => fileInputRef.current?.click()} 
            className="p-2 text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-30" 
            title="Importar de Excel"
          >
            {isImporting ? <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <UploadCloud size={18}/>}
          </button>
          <button type="button" onClick={() => excelService.exportProjectToExcel(project)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Exportar para Excel">
            <Download size={18}/>
          </button>

          <div className="w-px h-6 bg-slate-100 dark:bg-slate-800 mx-1" />

          <button 
            onClick={() => window.print()} 
            className="p-3 text-white bg-slate-900 dark:bg-slate-700 hover:scale-105 active:scale-95 rounded-xl transition-all shadow-lg flex items-center gap-2"
            title="Gerar PDF da Planilha"
          >
            <Printer size={16}/>
            <span className="text-[9px] font-black uppercase tracking-widest pr-1 hidden sm:inline">Imprimir Relatório</span>
          </button>
        </div>

        <div className="relative w-full lg:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            placeholder="Buscar na EAP..." 
            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 pl-11 pr-4 py-3 rounded-xl text-xs outline-none focus:border-indigo-500 transition-all dark:text-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} 
          />
        </div>
      </div>

      <div className="table-container">
        <TreeTable 
          data={flattenedList} 
          expandedIds={expandedIds} 
          onToggle={id => { const n = new Set<string>(expandedIds); n.has(id) ? n.delete(id) : n.add(id); setExpandedIds(n); }} 
          onExpandAll={() => setExpandedIds(new Set<string>(project.items.filter(i => i.type === 'category').map(i => i.id)))}
          onCollapseAll={() => setExpandedIds(new Set<string>())}
          onDelete={id => !isReadOnly && onUpdateProject({ items: project.items.filter(i => i.id !== id && i.parentId !== id) })}
          onUpdateQuantity={updateItemQuantity}
          onUpdatePercentage={updateItemPercentage}
          
          onUpdateTotal={(id, total) => {
            if (isReadOnly) return;
            onUpdateProject({ 
              items: project.items.map(it => {
                if (it.id === id && it.contractQuantity > 0) {
                  const newUnitPrice = financial.truncate(total / it.contractQuantity);
                  const newUnitPriceNoBdi = financial.truncate(newUnitPrice / (1 + project.bdi/100));
                  return { ...it, unitPrice: newUnitPrice, unitPriceNoBdi: newUnitPriceNoBdi };
                }
                return it;
              }) 
            });
          }}
          onUpdateCurrentTotal={(id, total) => {
            if (isReadOnly) return;
            onUpdateProject({ 
              items: project.items.map(it => {
                if (it.id === id && it.currentQuantity > 0) {
                  const newUnitPrice = financial.truncate(total / it.currentQuantity);
                  const newUnitPriceNoBdi = financial.truncate(newUnitPrice / (1 + project.bdi/100));
                  return { ...it, unitPrice: newUnitPrice, unitPriceNoBdi: newUnitPriceNoBdi };
                }
                return it;
              }) 
            });
          }}

          onUpdateGrandTotal={(overrides) => {
            if (isReadOnly) return;
            onUpdateProject({
              contractTotalOverride: overrides.contract !== undefined ? overrides.contract : project.contractTotalOverride,
              currentTotalOverride: overrides.current !== undefined ? overrides.current : project.currentTotalOverride,
            });
          }}
          
          onAddChild={(pid, type) => !isReadOnly && onOpenModal(type, null, pid)}
          onEdit={item => !isReadOnly && onOpenModal(item.type, item, item.parentId)}
          onReorder={(src, tgt, pos) => !isReadOnly && onUpdateProject({ items: treeService.reorderItems<WorkItem>(project.items, src, tgt, pos) })}
          searchQuery={searchQuery}
          isReadOnly={isReadOnly}
          currencySymbol={project.theme?.currencySymbol || 'R$'}
          contractTotalOverride={project.contractTotalOverride}
          currentTotalOverride={project.currentTotalOverride}
        />
      </div>

      {importSummary && (
        <div 
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setImportSummary(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 w-full max-md rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-8 pt-8 pb-4 flex items-center justify-between border-b border-slate-50 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl">
                  <UploadCloud size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black dark:text-white tracking-tight">Revisar Importação</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Planilha Processada com Sucesso</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setImportSummary(null)} 
                className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 text-center">
                  <div className="flex justify-center mb-2 text-indigo-500"><Layers size={20}/></div>
                  <p className="text-2xl font-black text-slate-800 dark:text-white">{importSummary.stats.categories}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Grupos/EAP</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 text-center">
                  <div className="flex justify-center mb-2 text-emerald-500"><Package size={20}/></div>
                  <p className="text-2xl font-black text-slate-800 dark:text-white">{importSummary.stats.items}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Serviços/Itens</p>
                </div>
              </div>

              {importSummary.errors.length > 0 && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="text-rose-500 shrink-0" size={18} />
                  <div>
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Alertas Encontrados</p>
                    <ul className="text-[9px] font-bold text-rose-500 space-y-0.5">
                      {importSummary.errors.map((err, i) => <li key={i}>• {err}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl">
                 <p className="text-[10px] font-bold text-blue-600 text-center uppercase leading-tight">
                   A confirmação irá SUBSTITUIR a planilha atual para evitar duplicação de dados, preservando as quantidades de contrato e medições informadas no Excel.
                 </p>
              </div>
            </div>

            <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3 shrink-0">
              <button 
                type="button" 
                onClick={confirmImport} 
                className="w-full py-5 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} /> Confirmar Substituição
              </button>
              <button 
                type="button" 
                onClick={() => setImportSummary(null)} 
                className="w-full py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
