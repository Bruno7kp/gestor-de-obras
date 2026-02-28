
import React, { useMemo, useState } from 'react';
import { ProjectAsset, ProjectAssetCategory } from '../types';
import { FileText, Download, Trash2, Eye, UploadCloud, Search, AlertCircle, Loader2, X, LayoutGrid, List, Pencil } from 'lucide-react';
import { uploadService } from '../services/uploadService';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../auth/AuthContext';

interface AssetManagerProps {
  assets: ProjectAsset[];
  onAdd: (asset: ProjectAsset) => void;
  onUpdate: (id: string, data: Partial<ProjectAsset>) => void;
  onDelete: (id: string) => void;
  isReadOnly?: boolean;
}

export const AssetManager: React.FC<AssetManagerProps> = ({ assets, onAdd, onUpdate, onDelete, isReadOnly }) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renameAsset, setRenameAsset] = useState<{ id: string; stem: string; ext: string } | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ProjectAssetCategory>('DOCUMENTO_DIVERSO');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | ProjectAssetCategory>('ALL');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
    const saved = localStorage.getItem('asset_view_mode');
    return saved === 'table' ? 'table' : 'cards';
  });
  const toast = useToast();

  const handleViewModeChange = (mode: 'cards' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('asset_view_mode', mode);
  };

  const categories: { id: ProjectAssetCategory; label: string }[] = [
    { id: 'PLANTA_BAIXA', label: 'Planta Baixa' },
    { id: 'MEMORIAL', label: 'Memorial' },
    { id: 'ART', label: 'ART' },
    { id: 'NOTA_FISCAL', label: 'Nota Fiscal' },
    { id: 'MEDICAO', label: 'Medição' },
    { id: 'DOCUMENTO_DIVERSO', label: 'Documento Diverso' },
  ];

  const categoryLabelMap: Record<ProjectAssetCategory, string> = {
    PLANTA_BAIXA: 'Planta Baixa',
    MEMORIAL: 'Memorial',
    ART: 'ART',
    NOTA_FISCAL: 'Nota Fiscal',
    MEDICAO: 'Medição',
    DOCUMENTO_DIVERSO: 'Documento Diverso',
  };

  const handleRename = () => {
    if (!renameAsset || !renameAsset.stem.trim()) return;
    const finalName = renameAsset.stem.trim() + renameAsset.ext;
    onUpdate(renameAsset.id, { name: finalName });
    setRenameAsset(null);
  };

  const openRenameModal = (asset: { id: string; name: string }) => {
    const dotIndex = asset.name.lastIndexOf('.');
    const stem = dotIndex > 0 ? asset.name.slice(0, dotIndex) : asset.name;
    const ext = dotIndex > 0 ? asset.name.slice(dotIndex) : '';
    setRenameAsset({ id: asset.id, stem, ext });
  };

  const resetUploadModal = () => {
    setSelectedFile(null);
    setSelectedCategory('DOCUMENTO_DIVERSO');
    setIsUploadModalOpen(false);
  };

  const handleFileUpload = async () => {
    const file = selectedFile;
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.warning("Arquivo muito grande (Máx 5MB).");
      return;
    }

    setIsUploading(true);
    try {
      const uploaded = await uploadService.uploadFile(file);
      onAdd({
        id: crypto.randomUUID(),
        name: file.name,
        category: selectedCategory,
        fileType: file.type,
        fileSize: file.size,
        uploadDate: new Date().toLocaleDateString('pt-BR'),
        data: uploaded.url,
        createdById: user?.id,
        createdBy: user
          ? { id: user.id, name: user.name || 'Usuário', profileImage: user.profileImage ?? null }
          : null,
      });
      resetUploadModal();
      toast.success('Documento enviado com sucesso.');
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      toast.error('Falha ao enviar arquivo. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const openPreview = (asset: ProjectAsset) => {
    const win = window.open();
    if (win) {
      win.document.write(`<iframe src="${asset.data}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    }
  };

  const filteredAssets = useMemo(
    () => assets.filter((asset) => {
      const byName = asset.name.toLowerCase().includes(searchQuery.toLowerCase());
      const byCategory = categoryFilter === 'ALL' || (asset.category ?? 'DOCUMENTO_DIVERSO') === categoryFilter;
      return byName && byCategory;
    }),
    [assets, categoryFilter, searchQuery],
  );

  return (
    <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">Repositório Técnico</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Plantas e Memoriais</p>
        </div> 
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input placeholder="Buscar..." className="w-full bg-slate-50 dark:bg-slate-800 border-none pl-11 pr-4 py-3 rounded-xl text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className={`shrink-0 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all ${isReadOnly || isUploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            <span>{isUploading ? 'Processando...' : 'Adicionar'}</span>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1">
        <FilterBtn
          active={categoryFilter === 'ALL'}
          onClick={() => setCategoryFilter('ALL')}
          label="Tudo"
        />
        {categories.map((category) => (
          <FilterBtn
            key={category.id}
            active={categoryFilter === category.id}
            onClick={() => setCategoryFilter(category.id)}
            label={category.label}
          />
        ))}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => handleViewModeChange('cards')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'cards' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-600'}`}
            title="Visão em cards"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            onClick={() => handleViewModeChange('table')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-600'}`}
            title="Visão em tabela"
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {filteredAssets.length === 0 ? (
            <div className="py-16 sm:py-20 flex flex-col items-center justify-center text-slate-400">
              <FileText size={48} className="mb-4 opacity-20" />
              <p className="font-bold uppercase tracking-widest text-[9px]">Sem documentos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Nome</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Categoria</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Tamanho</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Data</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Enviado por</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map(asset => (
                    <tr key={asset.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 rounded-lg shrink-0"><FileText size={14} /></div>
                          <span className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[200px]" title={asset.name}>{asset.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[8px] font-black uppercase tracking-widest text-slate-500">
                          {categoryLabelMap[asset.category ?? 'DOCUMENTO_DIVERSO']}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[10px] font-bold text-slate-500">{(asset.fileSize / 1024).toFixed(0)} KB</td>
                      <td className="px-6 py-4 text-[10px] font-bold text-slate-500">{asset.uploadDate}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          {asset.createdBy?.profileImage ? (
                            <img src={asset.createdBy.profileImage} alt={asset.createdBy.name ?? 'Usuário'} className="w-5 h-5 rounded-full object-cover border border-slate-200" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[8px] font-black text-slate-600 dark:text-slate-300">
                              {(asset.createdBy?.name ?? '?').slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <span className="text-[10px] font-bold text-slate-500 truncate max-w-[100px]">{asset.createdBy?.name ?? 'Não identificado'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openPreview(asset)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all" title="Visualizar"><Eye size={14} /></button>
                          <a href={asset.data} download={asset.name} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all" title="Baixar"><Download size={14} /></a>
                          {!isReadOnly && <button onClick={() => openRenameModal(asset)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all" title="Renomear"><Pencil size={14} /></button>}
                          {!isReadOnly && <button onClick={() => setConfirmDeleteId(asset.id)} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all" title="Excluir"><Trash2 size={14} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        {filteredAssets.length === 0 ? (
          <div className="col-span-full py-16 sm:py-20 bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400">
             <FileText size={48} className="mb-4 opacity-20" />
             <p className="font-bold uppercase tracking-widest text-[9px]">Sem documentos</p>
          </div>
        ) : (
          filteredAssets.map(asset => (
            <div key={asset.id} className="group bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 hover:border-indigo-500 transition-all shadow-sm relative overflow-hidden">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 rounded-xl"><FileText size={20} /></div>
                <div className="flex items-center gap-1">
                  {!isReadOnly && <button onClick={() => openRenameModal(asset)} className="p-2 text-slate-300 hover:text-amber-600 transition-all" title="Renomear"><Pencil size={14} /></button>}
                  {!isReadOnly && <button onClick={() => setConfirmDeleteId(asset.id)} className="p-2 text-slate-300 hover:text-rose-600 transition-all"><Trash2 size={16} /></button>}
                </div>
              </div>
              <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-white truncate mb-1" title={asset.name}>{asset.name}</h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-2">{(asset.fileSize / 1024).toFixed(0)} KB • {asset.uploadDate}</p>
              <div className="flex items-center justify-between mb-4 gap-3">
                <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[8px] font-black uppercase tracking-widest text-slate-500">
                  {categoryLabelMap[asset.category ?? 'DOCUMENTO_DIVERSO']}
                </span>
                <div className="flex items-center gap-1.5 min-w-0">
                  {asset.createdBy?.profileImage ? (
                    <img
                      src={asset.createdBy.profileImage}
                      alt={asset.createdBy.name ?? 'Usuário'}
                      className="w-5 h-5 rounded-full object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[8px] font-black text-slate-600 dark:text-slate-300">
                      {(asset.createdBy?.name ?? '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 truncate max-w-[110px]">
                    {asset.createdBy?.name ?? 'Não identificado'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => openPreview(asset)} className="flex items-center justify-center gap-2 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-all"><Eye size={12} /> Ver</button>
                <a href={asset.data} download={asset.name} className="flex items-center justify-center gap-2 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"><Download size={12} /> Baixar</a>
              </div>
            </div>
          ))
        )}
      </div>
      )}

      {renameAsset && (
        <div className="fixed inset-0 z-[1800] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" onClick={() => setRenameAsset(null)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-white">Renomear Documento</h3>
              <button onClick={() => setRenameAsset(null)} className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Nome de exibição</label>
                <div className="flex items-center gap-0">
                  <input
                    type="text"
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-l-xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                    value={renameAsset.stem}
                    onChange={(e) => setRenameAsset({ ...renameAsset, stem: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }}
                    autoFocus
                  />
                  {renameAsset.ext && (
                    <span className="bg-slate-100 dark:bg-slate-700 border border-l-0 border-slate-200 dark:border-slate-700 rounded-r-xl px-3 py-3 text-xs font-bold text-slate-400 select-none">
                      {renameAsset.ext}
                    </span>
                  )}
                </div>
              </div>
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRenameAsset(null)}
                  className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleRename}
                  disabled={!renameAsset.stem.trim()}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-40"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Excluir documento"
        message="Deseja realmente excluir este documento? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => {
          if (confirmDeleteId) {
            onDelete(confirmDeleteId);
            toast.success('Documento removido com sucesso.');
          }
          setConfirmDeleteId(null);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {isUploadModalOpen && (
        <div className="fixed inset-0 z-[1800] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" onClick={resetUploadModal}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-white">Novo Documento</h3>
              <button onClick={resetUploadModal} className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Categoria</label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as ProjectAssetCategory)}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Arquivo</label>
                <input
                  type="file"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  disabled={isUploading}
                />
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-2">Máximo 5MB</p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={resetUploadModal}
                  className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleFileUpload()}
                  disabled={!selectedFile || isUploading}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-40"
                >
                  {isUploading ? 'Enviando...' : 'Salvar Documento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FilterBtn = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
  <button
    onClick={onClick}
    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
      active
        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20'
        : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-600'
    }`}
  >
    {label}
  </button>
);
