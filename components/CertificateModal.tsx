
import React, { useState, useEffect, useRef } from 'react';
import { CERTIFICATE_CATEGORIES, CompanyCertificate } from '../types';
import { uploadService } from '../services/uploadService';
import { useToast } from '../hooks/useToast';
import { X, Save, ShieldCheck, Building2, Calendar, UploadCloud, Loader2, Paperclip, Trash2, ExternalLink } from 'lucide-react';

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<CompanyCertificate>) => void;
  certificate: CompanyCertificate | null;
}

const defaultForm: Partial<CompanyCertificate> = {
  name: '',
  issuer: '',
  category: 'OUTROS',
  expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  status: 'valid',
  attachmentUrls: [],
};

const toDateInputValue = (value?: string) => {
  if (!value) return '';
  return value.includes('T') ? value.split('T')[0] : value;
};

export const CertificateModal: React.FC<CertificateModalProps> = ({ isOpen, onClose, onSave, certificate }) => {
  const [formData, setFormData] = useState<Partial<CompanyCertificate>>(defaultForm);
  const [hasNoExpiration, setHasNoExpiration] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const toast = useToast();
  const attachmentUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (certificate) {
      attachmentUrlsRef.current = certificate.attachmentUrls ?? [];
      setFormData({
        name: certificate.name,
        issuer: certificate.issuer,
        category: certificate.category ?? 'OUTROS',
        expirationDate: toDateInputValue(certificate.expirationDate),
        status: certificate.status,
        attachmentUrls: attachmentUrlsRef.current,
      });
      setHasNoExpiration(!certificate.expirationDate);
    } else {
      attachmentUrlsRef.current = [];
      setHasNoExpiration(false);
      setFormData({
        ...defaultForm,
        category: 'OUTROS',
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        attachmentUrls: attachmentUrlsRef.current,
      });
    }
  }, [certificate, isOpen]);

  const handleFilesUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of Array.from(files)) {
        const uploaded = await uploadService.uploadFile(file);
        if (uploaded?.url) {
          uploadedUrls.push(uploaded.url);
        }
      }

      if (uploadedUrls.length > 0) {
        attachmentUrlsRef.current = Array.from(
          new Set([...(attachmentUrlsRef.current ?? []), ...uploadedUrls]),
        );
        setFormData((prev) => ({
          ...prev,
          attachmentUrls: attachmentUrlsRef.current,
        }));
      }
      toast.success(`${uploadedUrls.length} arquivo(s) enviado(s) com sucesso.`);
    } catch (error) {
      console.error('Erro ao enviar arquivos da certidão:', error);
      toast.error('Falha ao enviar um ou mais arquivos.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (url: string) => {
    attachmentUrlsRef.current = (attachmentUrlsRef.current ?? []).filter(
      (item) => item !== url,
    );
    setFormData((prev) => ({
      ...prev,
      attachmentUrls: attachmentUrlsRef.current,
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-[1.5rem]"><ShieldCheck size={28}/></div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{certificate ? 'Editar Certidão' : 'Nova Certidão'}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Documentação de Compliance</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all"><X size={24}/></button>
        </div>

        <form onSubmit={e => {
          e.preventDefault();
          if (isUploading) {
            toast.warning('Aguarde o término do upload dos arquivos.');
            return;
          }
          onSave({
            ...formData,
            expirationDate: hasNoExpiration ? null : (formData.expirationDate ?? null),
            attachmentUrls: attachmentUrlsRef.current,
          });
        }} className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pr-2">

          {/* Name */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Nome da Certidão</label>
            <div className="relative">
              <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
              <input required className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: CND Federal" />
            </div>
          </div>

          {/* Issuer */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Órgão Emissor</label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
              <input required className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={formData.issuer} onChange={e => setFormData({...formData, issuer: e.target.value})} placeholder="Ex: Receita Federal" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Categoria</label>
            <select
              required
              className="w-full px-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all"
              value={formData.category ?? 'OUTROS'}
              onChange={e => setFormData({ ...formData, category: e.target.value as CompanyCertificate['category'] })}
            >
              {CERTIFICATE_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          {/* Expiration Date */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Data de Vencimento</label>
            <label className="flex items-center gap-2 px-1 py-1 mb-3 text-xs font-semibold text-slate-500 cursor-pointer">
              <input
                type="checkbox"
                checked={hasNoExpiration}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setHasNoExpiration(checked);
                  if (checked) {
                    setFormData({ ...formData, expirationDate: null });
                    return;
                  }
                  setFormData({
                    ...formData,
                    expirationDate:
                      typeof formData.expirationDate === 'string' && formData.expirationDate
                        ? formData.expirationDate
                        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  });
                }}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Sem Vencimento
            </label>

            {!hasNoExpiration && (
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                <input type="date" required={!hasNoExpiration} className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={typeof formData.expirationDate === 'string' ? formData.expirationDate : ''} onChange={e => setFormData({...formData, expirationDate: e.target.value})} />
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Arquivos da Certidão</label>
            <label className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-500 hover:text-indigo-600 hover:border-indigo-400 transition-all cursor-pointer">
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              <span className="text-[10px] font-black uppercase tracking-widest">
                {isUploading ? 'Enviando...' : 'Adicionar Arquivos'}
              </span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleFilesUpload(e.target.files);
                  e.currentTarget.value = '';
                }}
              />
            </label>

            {(formData.attachmentUrls ?? []).length > 0 && (
              <div className="mt-3 space-y-2">
                {(formData.attachmentUrls ?? []).map((url, index) => (
                  <div key={url + index} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600"
                    >
                      <Paperclip size={14} className="shrink-0" />
                      <span className="truncate">Arquivo {index + 1}</span>
                      <ExternalLink size={12} className="shrink-0" />
                    </a>
                    <button
                      type="button"
                      onClick={() => removeAttachment(url)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                      title="Remover arquivo"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Desistir</button>
            <button type="submit" disabled={isUploading} className="flex-[2] py-5 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed">
              <Save size={18}/> {certificate ? 'Atualizar Certidão' : 'Salvar Certidão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
