
import React, { useState, useMemo, useRef } from 'react';
import { Project, WorkItem, ItemType } from '../types';
import { treeService } from '../services/treeService';
import { excelService, ImportResult } from '../services/excelService';
import { financial } from '../utils/math';
import { TreeTable } from './TreeTable';
import { 
  Plus, Layers, Search, FileSpreadsheet, UploadCloud, Download, 
  X, CheckCircle2, AlertCircle, Package
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processedTree = useMemo(() => {
    const tree = treeService.buildTree(project.items);
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
    onUpdateProject({ items: [...project.items, ...importSummary.items] });
    setImportSummary(null);
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
          <button 
            type="button"
            disabled={isReadOnly}
            onClick={() => onOpenModal('category', null, null)} 
            className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-black uppercase tracking-widest text-[9px] rounded-xl disabled:opacity-30"
          >
            <Layers size={14} className="inline mr-1"/> Novo Grupo
          </button>
          
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
          onToggle={id => { const n = new Set(expandedIds); n.has(id) ? n.delete(id) : n.add(id); setExpandedIds(n); }} 
          onExpandAll={() => setExpandedIds(new Set(project.items.filter(i => i.type === 'category').map(i => i.id)))}
          onCollapseAll={() => setExpandedIds(new Set())}
          onDelete={id => !isReadOnly && onUpdateProject({ items: project.items.filter(i => i.id !== id && i.parentId !== id) })}
          onUpdateQuantity={(id, qty) => !isReadOnly && onUpdateProject({ items: project.items.map(it => it.id === id ? { ...it, currentQuantity: qty } : it) })}
          onUpdatePercentage={(id, pct) => !isReadOnly && onUpdateProject({ items: project.items.map(it => it.id === id ? { ...it, currentQuantity: financial.round((pct/100) * it.contractQuantity), currentPercentage: pct } : it) })}
          
          onUpdateTotal={(id, total) => {
            if (isReadOnly) return;
            onUpdateProject({ 
              items: project.items.map(it => {
                if (it.id === id && it.contractQuantity > 0) {
                  const newUnitPrice = financial.round(total / it.contractQuantity);
                  const newUnitPriceNoBdi = financial.round(newUnitPrice / (1 + project.bdi/100));
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
                  const newUnitPrice = financial.round(total / it.currentQuantity);
                  const newUnitPriceNoBdi = financial.round(newUnitPrice / (1 + project.bdi/100));
                  return { ...it, unitPrice: newUnitPrice, unitPriceNoBdi: newUnitPriceNoBdi };
                }
                return it;
              }) 
            });
          }}
          
          onAddChild={(pid, type) => !isReadOnly && onOpenModal(type, null, pid)}
          onEdit={item => !isReadOnly && onOpenModal(item.type, item, item.parentId)}
          onReorder={(src, tgt, pos) => !isReadOnly && onUpdateProject({ items: treeService.reorderItems(project.items, src, tgt, pos) })}
          searchQuery={searchQuery}
          isReadOnly={isReadOnly}
        />
      </div>

      {importSummary && (
        <div 
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setImportSummary(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-8 pt-8 pb-4 flex items-center justify-between border-b border-slate-50 dark:border-slate-800">
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

            <div className="p-8 space-y-6">
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

              <p className="text-xs text-slate-500 font-medium text-center px-4">
                Estes itens serão adicionados à planilha atual. Os cálculos de BDI e totais serão atualizados automaticamente após a confirmação.
              </p>
            </div>

            <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
              <button 
                type="button" 
                onClick={confirmImport} 
                className="w-full py-5 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} /> Confirmar Importação
              </button>
              <button 
                type="button" 
                onClick={() => setImportSummary(null)} 
                className="w-full py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                Cancelar e Descartar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
