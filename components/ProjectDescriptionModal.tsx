import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Save, FileText, User } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

interface ProjectDescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  description: string;
  responsavel: string;
  onSave: (html: string, responsavel: string) => Promise<void>;
  canEdit: boolean;
}

const QUILL_MODULES = {
  toolbar: [
    ['bold'],
    ['link'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['clean'],
  ],
};

const QUILL_FORMATS = ['bold', 'link', 'list'];

export const ProjectDescriptionModal: React.FC<ProjectDescriptionModalProps> = ({
  isOpen,
  onClose,
  description,
  responsavel,
  onSave,
  canEdit,
}) => {
  const [draft, setDraft] = useState(description);
  const [responsavelDraft, setResponsavelDraft] = useState(responsavel);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(description);
      setResponsavelDraft(responsavel);
    }
  }, [isOpen, description, responsavel]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(draft, responsavelDraft);
      onClose();
    } finally {
      setSaving(false);
    }
  }, [draft, responsavelDraft, onSave, onClose]);

  const hasChanges = useMemo(
    () => draft !== description || responsavelDraft !== responsavel,
    [draft, description, responsavelDraft, responsavel],
  );

  const isEmpty = useMemo(() => {
    if (!description) return true;
    const stripped = description.replace(/<[^>]*>/g, '').trim();
    return stripped.length === 0;
  }, [description]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[3000] bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-[3001] flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="pointer-events-auto bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh] animate-in fade-in slide-in-from-bottom-4 duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600">
                <FileText size={18} />
              </div>
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">
                Descrição da Obra
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {/* Responsável / Empreiteiro field */}
            <div className="mb-4">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                <User size={12} />
                Responsável / Empreiteiro
              </label>
              {canEdit ? (
                <input
                  type="text"
                  value={responsavelDraft}
                  onChange={(e) => setResponsavelDraft(e.target.value)}
                  placeholder="Nome do responsável ou empreiteiro…"
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none transition-all focus:border-indigo-500"
                />
              ) : (
                <p className="px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200">
                  {responsavel || <span className="text-slate-400 italic">Não definido</span>}
                </p>
              )}
            </div>

            {/* Description editor */}
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
              <FileText size={12} />
              Descrição
            </label>
            {canEdit ? (
              <div className="project-description-editor">
                <ReactQuill
                  theme="snow"
                  value={draft}
                  onChange={setDraft}
                  modules={QUILL_MODULES}
                  formats={QUILL_FORMATS}
                  placeholder="Descreva esta obra…"
                />
              </div>
            ) : (
              isEmpty ? (
                <p className="text-xs text-slate-400 italic">Nenhuma descrição adicionada.</p>
              ) : (
                <div
                  className="project-description-readonly prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-200 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: description }}
                />
              )
            )}
          </div>

          {/* Footer */}
          {canEdit && (
            <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                <Save size={12} />
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Scoped styles for Quill editor */}
      <style>{`
        .project-description-editor .ql-toolbar {
          border: none !important;
          border-bottom: 1px solid rgb(226 232 240) !important;
          border-radius: 1rem 1rem 0 0;
          background: rgb(248 250 252);
          padding: 8px 12px !important;
        }
        .dark .project-description-editor .ql-toolbar {
          border-bottom-color: rgb(51 65 85) !important;
          background: rgb(30 41 59);
        }
        .project-description-editor .ql-container {
          border: none !important;
          border-radius: 0 0 1rem 1rem;
          font-family: inherit;
          font-size: 0.875rem;
          min-height: 180px;
        }
        .project-description-editor .ql-editor {
          min-height: 180px;
          max-height: 300px;
          overflow-y: auto;
          line-height: 1.7;
          color: rgb(51 65 85);
          padding: 16px;
        }
        .dark .project-description-editor .ql-editor {
          color: rgb(226 232 240);
        }
        .project-description-editor .ql-editor.ql-blank::before {
          color: rgb(148 163 184);
          font-style: italic;
        }
        .project-description-editor .ql-toolbar .ql-stroke {
          stroke: rgb(100 116 139);
        }
        .project-description-editor .ql-toolbar .ql-fill {
          fill: rgb(100 116 139);
        }
        .project-description-editor .ql-toolbar button:hover .ql-stroke,
        .project-description-editor .ql-toolbar button.ql-active .ql-stroke {
          stroke: rgb(79 70 229);
        }
        .project-description-editor .ql-toolbar button:hover .ql-fill,
        .project-description-editor .ql-toolbar button.ql-active .ql-fill {
          fill: rgb(79 70 229);
        }
        .dark .project-description-editor .ql-toolbar .ql-stroke {
          stroke: rgb(148 163 184);
        }
        .dark .project-description-editor .ql-toolbar .ql-fill {
          fill: rgb(148 163 184);
        }
        .project-description-editor .ql-editor a {
          color: rgb(79 70 229);
          text-decoration: underline;
        }
        .project-description-editor {
          border: 2px solid rgb(226 232 240);
          border-radius: 1rem;
          overflow: hidden;
          transition: border-color 0.15s;
        }
        .project-description-editor:focus-within {
          border-color: rgb(99 102 241);
        }
        .dark .project-description-editor {
          border-color: rgb(51 65 85);
        }
        .dark .project-description-editor:focus-within {
          border-color: rgb(99 102 241);
        }

        .project-description-readonly p {
          margin-bottom: 0.5em;
        }
        .project-description-readonly a {
          color: rgb(79 70 229);
          text-decoration: underline;
        }
        .dark .project-description-readonly a {
          color: rgb(129 140 248);
        }
      `}</style>
    </>
  );
};
