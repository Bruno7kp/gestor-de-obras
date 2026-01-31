
import React, { useState, useMemo, useRef } from 'react';
import { Project, WorkItem, ItemType } from '../types';
import { treeService } from '../services/treeService';
import { excelService } from '../services/excelService';
import { financial } from '../utils/math';
import { TreeTable } from './TreeTable';
import { 
  Plus, Layers, Search, FileSpreadsheet, UploadCloud, Download, 
  Maximize2, Minimize2 
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processedTree = useMemo(() => {
    const tree = treeService.buildTree(project.items);
    return tree.map((root, idx) => treeService.processRecursive(root, '', idx, project.bdi));
  }, [project.items, project.bdi]);

  const flattenedList = useMemo(() => 
    treeService.flattenTree(processedTree, expandedIds)
  , [processedTree, expandedIds]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) {
          setIsImporting(true);
          excelService.parseAndValidate(file)
            .then(res => onUpdateProject({ items: [...project.items, ...res.items] }))
            .finally(() => setIsImporting(false));
        }
      }} />

      {/* TOOLBAR DA PLANILHA */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button 
            disabled={isReadOnly}
            onClick={() => onOpenModal('item', null, null)} 
            className="px-6 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-lg shadow-indigo-500/10 disabled:opacity-30"
          >
            <Plus size={14} className="inline mr-1"/> Novo Item
          </button>
          <button 
            disabled={isReadOnly}
            onClick={() => onOpenModal('category', null, null)} 
            className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-black uppercase tracking-widest text-[9px] rounded-xl disabled:opacity-30"
          >
            <Layers size={14} className="inline mr-1"/> Novo Grupo
          </button>
          
          <div className="hidden sm:block w-px h-6 bg-slate-100 dark:bg-slate-800 mx-1" />
          
          <button onClick={() => excelService.downloadTemplate()} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Download Template Excel">
            <FileSpreadsheet size={18}/>
          </button>
          <button 
            disabled={isReadOnly || isImporting}
            onClick={() => fileInputRef.current?.click()} 
            className="p-2 text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-30" 
            title="Importar de Excel"
          >
            {isImporting ? <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <UploadCloud size={18}/>}
          </button>
          <button onClick={() => excelService.exportProjectToExcel(project, flattenedList)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Exportar para Excel">
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
          onAddChild={(pid, type) => !isReadOnly && onOpenModal(type, null, pid)}
          onEdit={item => !isReadOnly && onOpenModal(item.type, item, item.parentId)}
          onReorder={(src, tgt, pos) => !isReadOnly && onUpdateProject({ items: treeService.reorderItems(project.items, src, tgt, pos) })}
          searchQuery={searchQuery}
          isReadOnly={isReadOnly}
        />
      </div>
    </div>
  );
};
