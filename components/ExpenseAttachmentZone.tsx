
import React, { useState } from 'react';
import { UploadCloud, FileCheck, X, Loader2, FileText, ImageIcon } from 'lucide-react';
import { uploadService } from '../services/uploadService';
import { useToast } from '../hooks/useToast';

interface ExpenseAttachmentZoneProps {
  label: string;
  onUploadUrl: (url: string) => void;
  currentFile?: string;
  onRemove: () => void;
  accept?: string;
  requiredStatus?: string;
}

export const ExpenseAttachmentZone: React.FC<ExpenseAttachmentZoneProps> = ({ 
  label, onUploadUrl, currentFile, onRemove, accept = "application/pdf, image/*", requiredStatus 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const toast = useToast();

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.warning("Arquivo muito grande. Limite de 3MB.");
      return;
    }

    setIsProcessing(true);
    try {
      const uploaded = await uploadService.uploadFile(file);
      onUploadUrl(uploaded.url);
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      toast.error('Falha ao enviar arquivo. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center px-1">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
        {requiredStatus && (
          <span className="text-[8px] font-black bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded uppercase">Gatilho: {requiredStatus}</span>
        )}
      </div>
      
      {currentFile ? (
        <div className="relative group bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-4 rounded-2xl flex items-center justify-between animate-in zoom-in-95">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500 text-white rounded-lg"><FileCheck size={16}/></div>
              <div>
                <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase block">Documento Anexado</span>
                <button 
                  type="button"
                  onClick={() => {
                    const win = window.open();
                    win?.document.write(`<iframe src="${currentFile}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                  }}
                  className="text-[9px] font-bold text-emerald-600 underline"
                >Visualizar</button>
              </div>
           </div>
           <button onClick={onRemove} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-all"><X size={16}/></button>
        </div>
      ) : (
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
          className={`relative border-2 border-dashed rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
            isDragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50'
          } hover:border-indigo-400`}
          onClick={() => document.getElementById(`file-input-${label}`)?.click()}
        >
          {isProcessing ? (
            <Loader2 size={24} className="animate-spin text-indigo-500" />
          ) : (
            <UploadCloud size={24} className="text-slate-300" />
          )}
          <p className="text-[9px] font-black text-slate-400 uppercase">Arraste ou clique para anexar</p>
          <input 
            id={`file-input-${label}`}
            type="file" 
            className="hidden" 
            accept={accept} 
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} 
          />
        </div>
      )}
    </div>
  );
};
