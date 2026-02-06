
import React, { useState } from 'react';
import { ProjectAsset } from '../types';
import { FileText, Download, Trash2, Eye, UploadCloud, Search, AlertCircle, Loader2 } from 'lucide-react';
import { uploadService } from '../services/uploadService';

interface AssetManagerProps {
  assets: ProjectAsset[];
  onAdd: (asset: ProjectAsset) => void;
  onDelete: (id: string) => void;
  isReadOnly?: boolean;
}

export const AssetManager: React.FC<AssetManagerProps> = ({ assets, onAdd, onDelete, isReadOnly }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Arquivo muito grande (Máx 5MB).");
      return;
    }
    setIsUploading(true);
    try {
      const uploaded = await uploadService.uploadFile(file);
      onAdd({
        id: crypto.randomUUID(),
        name: file.name,
        fileType: file.type,
        fileSize: file.size,
        uploadDate: new Date().toLocaleDateString('pt-BR'),
        data: uploaded.url,
      });
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      alert('Falha ao enviar arquivo. Tente novamente.');
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

  const filteredAssets = assets.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto">
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
          
          <label className={`shrink-0 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-all ${isReadOnly || isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            <span>{isUploading ? 'Processando...' : 'Adicionar'}</span>
            <input type="file" className="hidden" onChange={handleFileUpload} disabled={isReadOnly || isUploading} />
          </label>
        </div>
      </div>

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
                {!isReadOnly && <button onClick={() => onDelete(asset.id)} className="p-2 text-slate-300 hover:text-rose-600 transition-all"><Trash2 size={16} /></button>}
              </div>
              <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-white truncate mb-1" title={asset.name}>{asset.name}</h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-4">{(asset.fileSize / 1024).toFixed(0)} KB • {asset.uploadDate}</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => openPreview(asset)} className="flex items-center justify-center gap-2 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-all"><Eye size={12} /> Ver</button>
                <a href={asset.data} download={asset.name} className="flex items-center justify-center gap-2 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"><Download size={12} /> Baixar</a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
