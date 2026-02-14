
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, JournalEntry, JournalCategory, WeatherType, ProjectJournal, WorkItem } from '../types';
import { journalService } from '../services/journalService';
import { journalApi } from '../services/journalApi';
import { uploadService } from '../services/uploadService';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../auth/AuthContext';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from '../hooks/useToast';
import { uiPreferences } from '../utils/uiPreferences';
import { 
  BookOpen, Camera, CloudRain, Cloud, Zap, 
  Trash2, Search, Filter, History, Loader2,
  AlertCircle, DollarSign, BarChart, Send, X, ShieldCheck, Edit3, Sun,
  ArrowUp, ArrowDown
} from 'lucide-react';

interface JournalViewProps {
  project: Project;
  onUpdateJournal: (journal: ProjectJournal) => void;
  allWorkItems: WorkItem[];
}

export const JournalView: React.FC<JournalViewProps> = ({ project, onUpdateJournal, allWorkItems }) => {
  const { user } = useAuth();
  const { canEdit, getLevel } = usePermissions();
  const canEditJournal = canEdit('journal');
  const toast = useToast();

  const journalFilterKey = `journal_filter_${project.id}`;
  const journalSortKey = `journal_sort_${project.id}`;
  const [filter, setFilter] = useState<JournalCategory | 'ALL'>(() => {
    const saved = uiPreferences.getString(journalFilterKey);
    return saved === 'ALL' || saved === 'PROGRESS' || saved === 'FINANCIAL' || saved === 'INCIDENT' || saved === 'WEATHER'
      ? (saved as JournalCategory | 'ALL')
      : 'ALL';
  });
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>(() => {
    const saved = uiPreferences.getString(journalSortKey);
    return saved === 'asc' || saved === 'desc' ? saved : 'desc';
  });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  
  // Quick Composer State
  const [isExpanded, setIsExpanded] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<JournalEntry>>({
    title: '',
    description: '',
    category: 'PROGRESS',
    progressPercent: 0,
    weatherStatus: 'sunny',
    photoUrls: []
  });
  const [editEntryDraft, setEditEntryDraft] = useState<Partial<JournalEntry>>({
    title: '',
    description: '',
    category: 'PROGRESS',
    progressPercent: 0,
    weatherStatus: 'sunny',
    photoUrls: []
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const journal = project.journal;

  const getInitials = (name?: string | null) => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '';
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  };

  useEffect(() => {
    const saved = uiPreferences.getString(journalFilterKey);
    if (saved === 'ALL' || saved === 'PROGRESS' || saved === 'FINANCIAL' || saved === 'INCIDENT' || saved === 'WEATHER') {
      setFilter(saved as JournalCategory | 'ALL');
    } else {
      setFilter('ALL');
    }
  }, [journalFilterKey, project.id]);

  useEffect(() => {
    uiPreferences.setString(journalFilterKey, filter);
  }, [filter, journalFilterKey]);

  useEffect(() => {
    uiPreferences.setString(journalSortKey, sortOrder);
  }, [journalSortKey, sortOrder]);

  useEffect(() => {
    setPage(1);
  }, [filter, search, sortOrder]);

  // Filtragem e Paginação
  const filteredEntries = useMemo(() => { 
    return journal.entries.filter(e => {
      const matchFilter = filter === 'ALL' || e.category === filter;
      const matchSearch = e.title.toLowerCase().includes(search.toLowerCase()) || 
                          e.description.toLowerCase().includes(search.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [journal.entries, filter, search]);

  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
    });
  }, [filteredEntries, sortOrder]);

  const visibleEntries = useMemo(() => {
    return journalService.getPaginatedEntries(sortedEntries, 1, page * PAGE_SIZE);
  }, [sortedEntries, page]);

  const latestProgressEntry = useMemo(() => {
    return journal.entries
      .filter((entry) => entry.category === 'PROGRESS' && typeof entry.progressPercent === 'number')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }, [journal.entries]);

  const latestProgressPercent = latestProgressEntry?.progressPercent ?? 0;

  const normalizeProgressPercent = (value: number) => {
    if (!Number.isFinite(value)) return 0;
    const clamped = Math.max(0, Math.min(100, value));
    return Math.round(clamped * 100) / 100;
  };

  const resetComposer = () => {
    setNewEntry({
      title: '',
      description: '',
      category: 'PROGRESS',
      progressPercent: latestProgressPercent,
      weatherStatus: 'sunny',
      photoUrls: [],
    });
    setIsExpanded(false);
  };

  const closeEditModal = () => {
    setEditingEntry(null);
    setEditEntryDraft({
      title: '',
      description: '',
      category: 'PROGRESS',
      progressPercent: 0,
      weatherStatus: 'sunny',
      photoUrls: [],
    });
  };

  const startEditEntry = (entry: JournalEntry) => {
    if (entry.type !== 'MANUAL') return;
    setEditingEntry(entry);
    setEditEntryDraft({
      title: entry.title,
      description: entry.description,
      category: entry.category === 'FINANCIAL' ? 'PROGRESS' : entry.category,
      progressPercent: entry.progressPercent ?? latestProgressPercent,
      weatherStatus: entry.weatherStatus ?? 'sunny',
      photoUrls: entry.photoUrls ?? [],
    });
  };

  // Handlers
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'new' | 'edit') => {
    // Fix: Explicitly cast Array.from result to File[] to satisfy strict TS checks on file.size
    const files = Array.from(e.target.files || []) as File[];
    for (const file of files) {
      if (file.size > 2 * 1024 * 1024) {
        toast.warning("Imagem muito pesada (Max 2MB)");
        continue;
      }

      try {
        const uploaded = await uploadService.uploadFile(file);
        if (target === 'edit') {
          setEditEntryDraft(prev => ({
            ...prev,
            photoUrls: [...(prev.photoUrls || []), uploaded.url],
          }));
        } else {
          setNewEntry(prev => ({
            ...prev,
            photoUrls: [...(prev.photoUrls || []), uploaded.url],
          }));
        }
      } catch (error) {
        console.error('Erro ao enviar foto:', error);
        toast.error('Falha ao enviar imagem. Tente novamente.');
      }
    }

    e.target.value = '';
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.description) return;

    const normalizedCategory = (newEntry.category === 'FINANCIAL' ? 'PROGRESS' : (newEntry.category ?? 'PROGRESS')) as JournalCategory;
    const resolvedProgressPercent = normalizedCategory === 'PROGRESS'
      ? normalizeProgressPercent(Number(newEntry.progressPercent ?? latestProgressPercent))
      : undefined;

    const entryToSave: JournalEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'MANUAL',
      category: normalizedCategory,
      title: newEntry.title || `Registro de ${new Date().toLocaleDateString('pt-BR')}`,
      description: newEntry.description,
      progressPercent: resolvedProgressPercent,
      weatherStatus: normalizedCategory === 'WEATHER' ? (newEntry.weatherStatus ?? 'sunny') : undefined,
      photoUrls: newEntry.photoUrls || [],
      createdById: user?.id,
      createdBy: user?.id && user?.name ? { id: user.id, name: user.name, profileImage: user.profileImage ?? null } : undefined,
    };

    try {
      const created = await journalApi.create(project.id, entryToSave);
      onUpdateJournal({ entries: [created, ...journal.entries] });
    } catch (error) {
      console.error('Erro ao criar registro do diario:', error);
      onUpdateJournal({ entries: [entryToSave, ...journal.entries] });
    }

    resetComposer();
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry || !editEntryDraft.description) return;

    const normalizedCategory = (editEntryDraft.category === 'FINANCIAL'
      ? 'PROGRESS'
      : (editEntryDraft.category ?? 'PROGRESS')) as JournalCategory;
    const resolvedProgressPercent = normalizedCategory === 'PROGRESS'
      ? normalizeProgressPercent(
          Number(
            editEntryDraft.progressPercent
            ?? editingEntry.progressPercent
            ?? latestProgressPercent,
          ),
        )
      : null;

    const updatePayload: Partial<JournalEntry> = {
      title: editEntryDraft.title || editingEntry.title,
      description: editEntryDraft.description,
      category: normalizedCategory,
      progressPercent: resolvedProgressPercent,
      weatherStatus: normalizedCategory === 'WEATHER' ? (editEntryDraft.weatherStatus ?? 'sunny') : undefined,
      photoUrls: editEntryDraft.photoUrls || [],
    };

    const optimisticEntry: JournalEntry = {
      ...editingEntry,
      ...updatePayload,
      progressPercent: resolvedProgressPercent,
      weatherStatus: updatePayload.category === 'WEATHER'
        ? (updatePayload.weatherStatus as WeatherType | undefined)
        : undefined,
      photoUrls: updatePayload.photoUrls ?? [],
    };

    onUpdateJournal({
      entries: journal.entries.map((entry) =>
        entry.id === editingEntry.id ? optimisticEntry : entry,
      ),
    });

    try {
      const updated = await journalApi.update(editingEntry.id, updatePayload);
      onUpdateJournal({
        entries: journal.entries.map((entry) =>
          entry.id === editingEntry.id ? updated : entry,
        ),
      });
      toast.success('Registro atualizado com sucesso.');
    } catch (error) {
      console.error('Erro ao atualizar registro do diario:', error);
      toast.warning('Registro editado localmente; falha ao sincronizar no servidor.');
    }

    closeEditModal();
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);
    const previous = journal.entries;
    onUpdateJournal({ entries: previous.filter((entry) => entry.id !== id) });
    try {
      await journalApi.remove(id);
      toast.success('Registro removido com sucesso.');
    } catch (error) {
      console.error('Erro ao remover registro do diario:', error);
      onUpdateJournal({ entries: previous });
      toast.error('Erro ao remover registro.');
    }
  };

  const CategoryIcon = ({ cat }: { cat: JournalCategory }) => {
    switch (cat) {
      case 'PROGRESS': return <BarChart size={18} className="text-blue-500" />;
      case 'FINANCIAL': return <DollarSign size={18} className="text-emerald-500" />;
      case 'INCIDENT': return <AlertCircle size={18} className="text-rose-500" />;
      case 'WEATHER': return <Cloud size={18} className="text-amber-500" />;
    }
  };

  const WeatherIcon = ({ type }: { type: WeatherType }) => {
    switch (type) {
      case 'sunny': return <Sun size={14} className="text-amber-500" />;
      case 'rainy': return <CloudRain size={14} className="text-blue-400" />;
      case 'cloudy': return <Cloud size={14} className="text-slate-400" />;
      case 'storm': return <Zap size={14} className="text-indigo-500" />;
    }
  };

  const getWeatherLabel = (type: WeatherType) => {
    switch (type) {
      case 'sunny': return 'Ensolarado';
      case 'cloudy': return 'Nublado';
      case 'rainy': return 'Chuvoso';
      case 'storm': return 'Tempestade';
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* QUICK COMPOSER (Social Media Style) */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden transition-all">
        <form onSubmit={handlePost}>
          <div className="p-6">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/20">
                <BookOpen size={24} />
              </div>
              <div className="flex-1 space-y-4">
                <textarea 
                  placeholder="O que aconteceu na obra hoje?"
                  className="w-full bg-transparent border-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 text-sm font-medium focus:ring-0 resize-none min-h-[60px]"
                  value={newEntry.description}
                  onFocus={() => setIsExpanded(true)}
                  onChange={e => setNewEntry({...newEntry, description: e.target.value})}
                />
                
                {isExpanded && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 pt-2 border-t border-slate-50 dark:border-slate-800">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <select 
                        className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-[10px] font-black uppercase tracking-widest outline-none px-4 py-2"
                        value={newEntry.category}
                        onChange={e => {
                          const category = e.target.value as JournalCategory;
                          setNewEntry({
                            ...newEntry,
                            category,
                            progressPercent: category === 'PROGRESS'
                              ? Number(newEntry.progressPercent ?? latestProgressPercent)
                              : undefined,
                          });
                        }}
                      >
                        <option value="PROGRESS">Progresso</option>
                        <option value="INCIDENT">Ocorrência</option>
                        <option value="WEATHER">Clima</option>
                      </select>

                      {newEntry.category === 'PROGRESS' && (
                        <label className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-[10px] font-black uppercase tracking-widest outline-none px-4 py-2 flex items-center gap-2 text-slate-500">
                          <span>%</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            className="w-full bg-transparent text-[11px] font-black outline-none"
                            value={newEntry.progressPercent ?? latestProgressPercent}
                            onChange={(e) => setNewEntry({
                              ...newEntry,
                              progressPercent: normalizeProgressPercent(Number(e.target.value || 0)),
                            })}
                          />
                        </label>
                      )}
                      
                      {newEntry.category === 'WEATHER' && (
                        <select 
                          className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-[10px] font-black uppercase tracking-widest outline-none px-4 py-2"
                          value={newEntry.weatherStatus}
                          onChange={e => setNewEntry({...newEntry, weatherStatus: e.target.value as WeatherType})}
                        >
                          <option value="sunny">Ensolarado</option>
                          <option value="cloudy">Nublado</option>
                          <option value="rainy">Chuvoso</option>
                          <option value="storm">Tempestade</option>
                        </select>
                      )}
                    </div>

                    {/* Photo Previews */}
                    {newEntry.photoUrls && newEntry.photoUrls.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {newEntry.photoUrls.map((url, i) => (
                          <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                            <img src={url} className="w-full h-full object-cover" />
                            <button 
                              type="button" 
                              onClick={() => setNewEntry(prev => ({ ...prev, photoUrls: prev.photoUrls?.filter((_, idx) => idx !== i) }))}
                              className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-rose-500 transition-colors"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all"
              >
                <Camera size={20} />
                <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={(e) => handlePhotoUpload(e, 'new')} />
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              {isExpanded && (
                <button type="button" onClick={resetComposer} className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-4">Cancelar</button>
              )}
              <button 
                type="submit"
                disabled={!newEntry.description}
                className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 disabled:opacity-30 active:scale-95 transition-all"
              >
                Publicar <Send size={14} />
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-3">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Último progresso cadastrado</h3>
          <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{latestProgressPercent.toFixed(2)}%</span>
        </div>
        <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all duration-300"
            style={{ width: `${latestProgressPercent}%` }}
          />
        </div>
        {!latestProgressEntry && (
          <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Nenhum progresso cadastrado ainda.</p>
        )}
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto md:flex-1">
          <FilterBtn active={filter === 'ALL'} onClick={() => setFilter('ALL')} label="Tudo" />
          <FilterBtn active={filter === 'PROGRESS'} onClick={() => setFilter('PROGRESS')} label="Avanço" />
          <FilterBtn active={filter === 'INCIDENT'} onClick={() => setFilter('INCIDENT')} label="Ocorrências" />
          <FilterBtn active={filter === 'WEATHER'} onClick={() => setFilter('WEATHER')} label="Clima" />
        </div>
        <div className="flex w-full md:w-auto items-center gap-2">
          <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
            <button
              type="button"
              title="Ordenar por data decrescente"
              aria-label="Ordenar por data decrescente"
              onClick={() => setSortOrder('desc')}
              className={`p-2 rounded-lg transition-all ${sortOrder === 'desc' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <ArrowDown size={14} />
            </button>
            <button
              type="button"
              title="Ordenar por data crescente"
              aria-label="Ordenar por data crescente"
              onClick={() => setSortOrder('asc')}
              className={`p-2 rounded-lg transition-all ${sortOrder === 'asc' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <ArrowUp size={14} />
            </button>
          </div>
          <div className="relative w-full md:w-64">
             <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
             <input 
               placeholder="Buscar no histórico..."
               className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
               value={search}
               onChange={e => setSearch(e.target.value)}
             />
          </div>
        </div>
      </div>

      {/* TIMELINE FEED */}
      <div className="relative space-y-8 before:absolute before:left-[23px] before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
        {visibleEntries.map((entry) => (
          <div key={entry.id} className="relative pl-14 group">
            {/* Marker */}
            <div className={`absolute left-0 w-12 h-12 rounded-2xl border-4 border-slate-50 dark:border-slate-950 shadow-md flex items-center justify-center z-10 transition-transform group-hover:scale-110 ${
              entry.type === 'AUTO' ? 'bg-slate-100 dark:bg-slate-800' : 'bg-white dark:bg-slate-900'
            }`}>
              <CategoryIcon cat={entry.category} />
            </div>

            {/* Entry Card */}
            <div className={`bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-all group-hover:shadow-xl relative ${
              entry.type === 'AUTO' ? 'border-l-4 border-l-slate-200 dark:border-l-slate-700' : ''
            }`}>
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight">{entry.title}</h3>
                    {entry.type === 'AUTO' && (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[8px] font-black uppercase tracking-[0.2em] rounded-full">
                        <ShieldCheck size={10} /> Auditoria
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span className="flex items-center gap-1.5"><History size={12}/> {new Date(entry.timestamp).toLocaleString('pt-BR')}</span>
                    {entry.category === 'PROGRESS' && typeof entry.progressPercent === 'number' && (
                      <span className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-3">
                        <BarChart size={12} /> {entry.progressPercent.toFixed(2)}%
                      </span>
                    )}
                    {entry.weatherStatus && (
                      <span className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-3">
                        <WeatherIcon type={entry.weatherStatus} /> {getWeatherLabel(entry.weatherStatus)}
                      </span>
                    )}
                  </div>
                  {entry.createdBy?.name && (
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {entry.createdBy.profileImage ? (
                        <img
                          src={entry.createdBy.profileImage}
                          alt={entry.createdBy.name}
                          className="w-6 h-6 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-black">
                          {getInitials(entry.createdBy.name)}
                        </div>
                      )}
                      <span>Cadastrado por {entry.createdBy.name}</span>
                    </div>
                  )}
                </div>
                
                {/* Actions (Only for Manual) */}
                <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                  {entry.type === 'MANUAL' && (
                    <button
                      type="button"
                      onClick={() => startEditEntry(entry)}
                      className="p-2.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
                    >
                      <Edit3 size={18} />
                    </button>
                  )}
                  <button type="button" onClick={() => setConfirmDeleteId(entry.id)} className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">{entry.description}</p>
              </div>

              {entry.category === 'PROGRESS' && typeof entry.progressPercent === 'number' && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <span>Progresso do dia</span>
                    <span>{entry.progressPercent.toFixed(2)}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600"
                      style={{ width: `${entry.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {entry.photoUrls && entry.photoUrls.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-3">
                  {entry.photoUrls.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightboxImage(url)}
                      className="w-28 h-28 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm hover:scale-105 transition-transform cursor-pointer"
                    >
                      <img src={url} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* LOAD MORE BUTTON */}
        {sortedEntries.length > visibleEntries.length && (
          <div className="flex justify-center pt-8">
            <button 
              onClick={() => setPage(p => p + 1)}
              className="px-10 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 shadow-lg hover:shadow-indigo-500/10 transition-all flex items-center gap-2"
            >
              <Loader2 size={16} className="animate-spin" /> Carregar Registros Anteriores
            </button>
          </div>
        )}

        {visibleEntries.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-slate-300 opacity-40 select-none">
            <History size={64} className="mb-4" />
            <p className="text-xs font-black uppercase tracking-[0.2em]">O diário está vazio</p>
          </div>
        )}
      </div>

      {/* DOCUMENTATION: COMO ADICIONAR NOVOS TRIGGERS AUTO
          Para adicionar novas automações no diário:
          1. Abra 'services/journalService.ts'.
          2. Implemente uma nova função 'check[Evento]Deltas'.
          3. Chame esta função dentro de 'updateActiveProject' no hook 'useProjectState.ts'.
          Exemplos recomendados: Atraso de cronograma, estouro de orçamento por categoria,
          ou anexação de documentos técnicos importantes.
      */}

      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Excluir registro"
        message="Deseja realmente excluir este registro do diário? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {lightboxImage && (
        <div
          className="fixed inset-0 z-[2500] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-6 right-6 p-2 rounded-xl bg-black/40 text-white hover:bg-black/60 transition-all"
            aria-label="Fechar imagem"
          >
            <X size={20} />
          </button>
          <img
            src={lightboxImage}
            alt="Imagem do diário"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {editingEntry && (
        <div className="fixed inset-0 z-[2400] bg-slate-950/70 backdrop-blur-sm p-4 flex items-center justify-center" onClick={closeEditModal}>
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSaveEdit}>
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Editar Registro</h3>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  aria-label="Fechar modal"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <input
                  type="text"
                  placeholder="Título do registro"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-indigo-500/10"
                  value={editEntryDraft.title || ''}
                  onChange={(e) => setEditEntryDraft({ ...editEntryDraft, title: e.target.value })}
                />

                <textarea
                  placeholder="Descreva o ocorrido"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 resize-none min-h-[140px]"
                  value={editEntryDraft.description || ''}
                  onChange={(e) => setEditEntryDraft({ ...editEntryDraft, description: e.target.value })}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none px-4 py-3"
                    value={editEntryDraft.category}
                    onChange={(e) => {
                      const category = e.target.value as JournalCategory;
                      setEditEntryDraft({
                        ...editEntryDraft,
                        category,
                        progressPercent: category === 'PROGRESS'
                          ? Number(editEntryDraft.progressPercent ?? editingEntry.progressPercent ?? latestProgressPercent)
                          : undefined,
                      });
                    }}
                  >
                    <option value="PROGRESS">Progresso</option>
                    <option value="INCIDENT">Ocorrência</option>
                    <option value="WEATHER">Clima</option>
                  </select>

                  {editEntryDraft.category === 'PROGRESS' && (
                    <label className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none px-4 py-3 flex items-center gap-2 text-slate-500">
                      <span>%</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        className="w-full bg-transparent text-[11px] font-black outline-none"
                        value={editEntryDraft.progressPercent ?? editingEntry.progressPercent ?? latestProgressPercent}
                        onChange={(e) => setEditEntryDraft({
                          ...editEntryDraft,
                          progressPercent: normalizeProgressPercent(Number(e.target.value || 0)),
                        })}
                      />
                    </label>
                  )}

                  {editEntryDraft.category === 'WEATHER' && (
                    <select
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none px-4 py-3"
                      value={editEntryDraft.weatherStatus}
                      onChange={(e) => setEditEntryDraft({ ...editEntryDraft, weatherStatus: e.target.value as WeatherType })}
                    >
                      <option value="sunny">Ensolarado</option>
                      <option value="cloudy">Nublado</option>
                      <option value="rainy">Chuvoso</option>
                      <option value="storm">Tempestade</option>
                    </select>
                  )}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-all"
                  >
                    <Camera size={14} /> Adicionar fotos
                  </button>
                  <input
                    type="file"
                    ref={editFileInputRef}
                    className="hidden"
                    multiple
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, 'edit')}
                  />
                </div>

                {editEntryDraft.photoUrls && editEntryDraft.photoUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {editEntryDraft.photoUrls.map((url, index) => (
                      <div key={`${url}-${index}`} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                        <img src={url} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setEditEntryDraft(prev => ({ ...prev, photoUrls: prev.photoUrls?.filter((_, idx) => idx !== index) }))}
                          className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-rose-500 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-5 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!editEntryDraft.description}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 disabled:opacity-40"
                >
                  Salvar edição <Send size={12} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// HELPERS
const FilterBtn = ({ active, onClick, label }: any) => (
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
