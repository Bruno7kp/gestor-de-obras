
import React, { useState, useMemo, useRef } from 'react';
import { Project, JournalEntry, JournalCategory, WeatherType, ProjectJournal, WorkItem } from '../types';
import { journalService } from '../services/journalService';
import { journalApi } from '../services/journalApi';
import { 
  BookOpen, Plus, Camera, Sun, CloudRain, Cloud, Zap, 
  Trash2, Search, Filter, History, Loader2,
  AlertCircle, DollarSign, BarChart, Send, X, ShieldCheck, Edit3
} from 'lucide-react';

interface JournalViewProps {
  project: Project;
  onUpdateJournal: (journal: ProjectJournal) => void;
  allWorkItems: WorkItem[];
}

export const JournalView: React.FC<JournalViewProps> = ({ project, onUpdateJournal, allWorkItems }) => {
  const [filter, setFilter] = useState<JournalCategory | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  
  // Quick Composer State
  const [isExpanded, setIsExpanded] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<JournalEntry>>({
    title: '',
    description: '',
    category: 'PROGRESS',
    weatherStatus: 'sunny',
    photoUrls: []
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const journal = project.journal;

  // Filtragem e Paginação
  const filteredEntries = useMemo(() => { 
    return journal.entries.filter(e => {
      const matchFilter = filter === 'ALL' || e.category === filter;
      const matchSearch = e.title.toLowerCase().includes(search.toLowerCase()) || 
                          e.description.toLowerCase().includes(search.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [journal.entries, filter, search]);

  const visibleEntries = useMemo(() => {
    return journalService.getPaginatedEntries(filteredEntries, 1, page * PAGE_SIZE);
  }, [filteredEntries, page]);

  // Handlers
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Fix: Explicitly cast Array.from result to File[] to satisfy strict TS checks on file.size and readAsDataURL
    const files = Array.from(e.target.files || []) as File[];
    files.forEach(file => {
      if (file.size > 2 * 1024 * 1024) return alert("Imagem muito pesada (Max 2MB)");
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setNewEntry(prev => ({ ...prev, photoUrls: [...(prev.photoUrls || []), base64] }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.description) return;

    const entryToSave: JournalEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'MANUAL',
      category: (newEntry.category ?? 'PROGRESS') as JournalCategory,
      title: newEntry.title || `Registro de ${new Date().toLocaleDateString('pt-BR')}`,
      description: newEntry.description,
      weatherStatus: newEntry.category === 'WEATHER' ? (newEntry.weatherStatus ?? 'sunny') : undefined,
      photoUrls: newEntry.photoUrls || [],
    };

    try {
      const created = await journalApi.create(project.id, entryToSave);
      onUpdateJournal({ entries: [created, ...journal.entries] });
    } catch (error) {
      console.error('Erro ao criar registro do diario:', error);
      onUpdateJournal({ entries: [entryToSave, ...journal.entries] });
    }

    // Reset Composer
    setNewEntry({ title: '', description: '', category: 'PROGRESS', weatherStatus: 'sunny', photoUrls: [] });
    setIsExpanded(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Deseja realmente excluir este registro do diário?')) {
      const previous = journal.entries;
      onUpdateJournal({ entries: previous.filter((entry) => entry.id !== id) });
      try {
        await journalApi.remove(id);
      } catch (error) {
        console.error('Erro ao remover registro do diario:', error);
        onUpdateJournal({ entries: previous });
      }
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
                        onChange={e => setNewEntry({...newEntry, category: e.target.value as JournalCategory})}
                      >
                        <option value="PROGRESS">Progresso</option>
                        <option value="FINANCIAL">Financeiro</option>
                        <option value="INCIDENT">Ocorrência</option>
                        <option value="WEATHER">Clima</option>
                      </select>
                      
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
                <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handlePhotoUpload} />
              </button>
              <button type="button" className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all">
                <Sun size={20} />
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              {isExpanded && (
                <button type="button" onClick={() => setIsExpanded(false)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-4">Cancelar</button>
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

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
          <FilterBtn active={filter === 'ALL'} onClick={() => setFilter('ALL')} label="Tudo" />
          <FilterBtn active={filter === 'PROGRESS'} onClick={() => setFilter('PROGRESS')} label="Avanço" />
          <FilterBtn active={filter === 'FINANCIAL'} onClick={() => setFilter('FINANCIAL')} label="Gastos" />
          <FilterBtn active={filter === 'INCIDENT'} onClick={() => setFilter('INCIDENT')} label="Ocorrências" />
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
                    {entry.weatherStatus && (
                      <span className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-3">
                        <WeatherIcon type={entry.weatherStatus} /> {entry.weatherStatus}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Actions (Only for Manual) */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  {entry.type === 'MANUAL' && (
                    <button className="p-2.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all">
                      <Edit3 size={18} />
                    </button>
                  )}
                  <button onClick={() => handleDelete(entry.id)} className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">{entry.description}</p>
              </div>

              {entry.photoUrls && entry.photoUrls.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-3">
                  {entry.photoUrls.map((url, i) => (
                    <div key={i} className="w-28 h-28 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm hover:scale-105 transition-transform cursor-pointer">
                      <img src={url} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* LOAD MORE BUTTON */}
        {filteredEntries.length > visibleEntries.length && (
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
