'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Mic,
  Plus,
  BrainCircuit,
  Search,
  Sparkles,
  Pin,
  CheckSquare,
  FileText,
  Archive,
  Layers,
  Tag,
  X,
  Volume2,
} from 'lucide-react';
import { Note, CategoryFilter } from '@/types/note';
import { loadNotes, saveNotes, getGeminiApiKey } from '@/lib/storage';
import { analyzeVoiceMemoWithGemini } from '@/lib/gemini';
import { Navbar } from '@/components/Navbar';
import { NoteCard } from '@/components/NoteCard';
import { VoiceRecordModal } from '@/components/VoiceRecordModal';
import { NoteEditorModal } from '@/components/NoteEditorModal';
import { SecondBrainModal } from '@/components/SecondBrainModal';
import { SettingsModal } from '@/components/SettingsModal';
import { ShareNoteModal } from '@/components/ShareNoteModal';

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Filtres
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modales
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [isSecondBrainOpen, setIsSecondBrainOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [noteToEdit, setNoteToEdit] = useState<Note | null>(null);
  const [noteToShare, setNoteToShare] = useState<Note | null>(null);

  // Thème
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    const loaded = loadNotes();
    setNotes(loaded);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      saveNotes(notes);
    }
  }, [notes, isLoaded]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Traitement IA en arrière-plan d'une note vocale
  const handleProcessNoteInBackground = async (noteToProcess: Note) => {
    try {
      const apiKey = getGeminiApiKey();
      const isPlaceholder =
        !noteToProcess.content ||
        noteToProcess.content === 'Mémo vocal enregistré' ||
        noteToProcess.content === 'Mémo vocal enregistré...' ||
        noteToProcess.content.startsWith('Enregistrement audio');

      const aiResult = await analyzeVoiceMemoWithGemini(
        noteToProcess.audioData,
        isPlaceholder ? '' : noteToProcess.content,
        apiKey
      );

      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteToProcess.id
            ? {
                ...n,
                title: aiResult.title || 'Note vocale retranscrite',
                summary: aiResult.summary || '',
                content: aiResult.cleanContent || n.content,
                todos: aiResult.todos.map((t, idx) => ({
                  id: `todo-${Date.now()}-${idx}`,
                  text: t,
                  completed: false,
                })),
                tags: aiResult.tags.length > 0 ? aiResult.tags : ['Vocal'],
                status: 'ready',
                processingError: undefined,
                updatedAt: Date.now(),
              }
            : n
        )
      );
    } catch (err: any) {
      console.error('Erreur traitement IA en arrière-plan:', err);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteToProcess.id
            ? {
                ...n,
                title:
                  n.title.startsWith('Mémo vocal en cours')
                    ? 'Mémo vocal (IA en attente)'
                    : n.title,
                status: 'error',
                processingError:
                  err?.message ||
                  'Structuration IA interrompue. Réessayez dans quelques instants.',
                updatedAt: Date.now(),
              }
            : n
        )
      );
    }
  };

  // Gestion des notes
  const handleCreateNote = (newNote: Note) => {
    setNotes((prev) => [newNote, ...prev]);
    if (newNote.status === 'processing') {
      handleProcessNoteInBackground(newNote);
    }
  };

  const handleRetryProcessing = (noteToRetry: Note) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteToRetry.id
          ? { ...n, status: 'processing', processingError: undefined }
          : n
      )
    );
    handleProcessNoteInBackground({
      ...noteToRetry,
      status: 'processing',
      processingError: undefined,
    });
  };

  const handleUpdateNote = (updatedNote: Note) => {
    setNotes(notes.map((n) => (n.id === updatedNote.id ? updatedNote : n)));
  };

  const handleDeleteNote = (noteId: string) => {
    setNotes(notes.filter((n) => n.id !== noteId));
  };

  const handleTogglePin = (noteId: string) => {
    setNotes(
      notes.map((n) => (n.id === noteId ? { ...n, isPinned: !n.isPinned } : n))
    );
  };

  const handleToggleArchive = (noteId: string) => {
    setNotes(
      notes.map((n) =>
        n.id === noteId ? { ...n, isArchived: !n.isArchived } : n
      )
    );
  };

  const handleToggleTodo = (noteId: string, todoId: string) => {
    setNotes(
      notes.map((n) => {
        if (n.id !== noteId) return n;
        return {
          ...n,
          todos: n.todos.map((t) =>
            t.id === todoId ? { ...t, completed: !t.completed } : t
          ),
        };
      })
    );
  };

  const handleOpenEdit = (note: Note) => {
    setNoteToEdit(note);
    setIsEditorModalOpen(true);
  };

  const handleOpenNewText = () => {
    setNoteToEdit(null);
    setIsEditorModalOpen(true);
  };

  // Liste de tous les tags uniques
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((n) => {
      if (!n.isArchived) {
        n.tags?.forEach((t) => tagSet.add(t));
      }
    });
    return Array.from(tagSet);
  }, [notes]);

  // Comptes par catégorie
  const counts = useMemo(() => {
    const active = notes.filter((n) => !n.isArchived);
    return {
      all: active.length,
      voice: active.filter((n) => n.type === 'voice').length,
      todo: active.filter((n) => n.todos && n.todos.length > 0).length,
      pinned: active.filter((n) => n.isPinned).length,
      archived: notes.filter((n) => n.isArchived).length,
    };
  }, [notes]);

  // Notes filtrées
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      // 1. Catégorie
      if (activeCategory === 'archived') {
        if (!n.isArchived) return false;
      } else {
        if (n.isArchived) return false;
        if (activeCategory === 'voice' && n.type !== 'voice') return false;
        if (activeCategory === 'todo' && (!n.todos || n.todos.length === 0)) return false;
        if (activeCategory === 'pinned' && !n.isPinned) return false;
      }

      // 2. Tag
      if (selectedTag && !n.tags?.includes(selectedTag)) return false;

      // 3. Recherche
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = n.title.toLowerCase().includes(q);
        const inContent = n.content.toLowerCase().includes(q);
        const inSummary = n.summary?.toLowerCase().includes(q);
        const inTags = n.tags?.some((t) => t.toLowerCase().includes(q));
        const inTodos = n.todos?.some((t) => t.text.toLowerCase().includes(q));
        if (!inTitle && !inContent && !inSummary && !inTags && !inTodos) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      return b.createdAt - a.createdAt;
    });
  }, [notes, activeCategory, selectedTag, searchQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors w-full max-w-full overflow-x-hidden pb-24 sm:pb-8">
      {/* BARRE DE NAVIGATION */}
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenVoiceRecord={() => setIsVoiceModalOpen(true)}
        onOpenNewTextNote={handleOpenNewText}
        onOpenSecondBrain={() => setIsSecondBrainOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 min-w-0">
        {/* BARRE DE RECHERCHE MOBILE */}
        <div className="md:hidden mb-4 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher dans vos notes..."
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-keo-500 outline-none shadow-xs"
          />
        </div>

        {/* PILLS DE CATÉGORIES (DÉFILEMENT FLUIDE SANS DÉPLACER LA FENÊTRE) */}
        <div className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain no-scrollbar scroll-smooth pb-2 pt-0.5 text-xs w-full max-w-full">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap shrink-0 transition flex items-center gap-1.5 ${
              activeCategory === 'all'
                ? 'bg-keo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200/80 dark:border-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Toutes ({counts.all})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('voice')}
            className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap shrink-0 transition flex items-center gap-1.5 ${
              activeCategory === 'voice'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200/80 dark:border-slate-700'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-amber-400" />
            <span>Vocales ({counts.voice})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('todo')}
            className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap shrink-0 transition flex items-center gap-1.5 ${
              activeCategory === 'todo'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200/80 dark:border-slate-700'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>To-Dos ({counts.todo})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('pinned')}
            className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap shrink-0 transition flex items-center gap-1.5 ${
              activeCategory === 'pinned'
                ? 'bg-keo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200/80 dark:border-slate-700'
            }`}
          >
            <Pin className="w-3.5 h-3.5 text-keo-400" />
            <span>Favoris ({counts.pinned})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('archived')}
            className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap shrink-0 transition flex items-center gap-1.5 ${
              activeCategory === 'archived'
                ? 'bg-gray-700 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200/80 dark:border-slate-700'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Archivées ({counts.archived})</span>
          </button>
        </div>

        {/* LIGNE DE TAGS (SI DISPONIBLES) */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain no-scrollbar scroll-smooth py-2 text-[11px] w-full max-w-full">
            <span className="text-gray-400 dark:text-slate-400 font-semibold shrink-0 flex items-center gap-1">
              <Tag className="w-3 h-3" />
              <span>Tags :</span>
            </span>

            {selectedTag && (
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                className="px-2.5 py-1 rounded-lg bg-keo-600 text-white font-bold whitespace-nowrap shrink-0 flex items-center gap-1 shadow-xs"
              >
                <span>#{selectedTag}</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {allTags.map((tag) => {
              if (tag === selectedTag) return null;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(tag)}
                  className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-keo-50 hover:text-keo-600 dark:bg-slate-800 dark:hover:bg-slate-750 text-gray-600 dark:text-gray-300 whitespace-nowrap shrink-0 transition"
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        )}

        {/* GRILLE DES NOTES */}
        {filteredNotes.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-3xl bg-keo-50 dark:bg-slate-800 text-keo-600 dark:text-keo-400 flex items-center justify-center mb-4 shadow-xs">
              <Mic className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
              Aucune note trouvée
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mb-5">
              {searchQuery
                ? `Aucun résultat pour "${searchQuery}". Essayez un autre mot-clé.`
                : 'Enregistrez votre première idée ou pensée avec le bouton mémo vocal.'}
            </p>
            <button
              type="button"
              onClick={() => setIsVoiceModalOpen(true)}
              className="py-2.5 px-5 bg-gradient-to-r from-keo-600 to-purple-600 hover:from-keo-700 hover:to-purple-700 text-white rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-keo-600/30 active:scale-95"
            >
              <Mic className="w-4 h-4 text-amber-300" />
              <span>Enregistrer un mémo vocal</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 mt-3">
            {filteredNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onToggleTodo={handleToggleTodo}
                onTogglePin={handleTogglePin}
                onToggleArchive={handleToggleArchive}
                onDeleteNote={handleDeleteNote}
                onEditNote={handleOpenEdit}
                onTagClick={(t) => setSelectedTag(t)}
                onRetryProcessing={handleRetryProcessing}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onShareNote={(n) => setNoteToShare(n)}
              />
            ))}
          </div>
        )}
      </main>

      {/* BARRE D'ACTION FLOTTANTE MOBILE (SOUS LE POUCE) */}
      <div className="sm:hidden fixed bottom-4 inset-x-0 flex items-center justify-center pointer-events-none z-30 px-4">
        <div className="pointer-events-auto bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-gray-200 dark:border-slate-700 rounded-full px-4 py-2 shadow-2xl flex items-center gap-4">
          {/* NOTE ÉCRITE */}
          <button
            type="button"
            onClick={handleOpenNewText}
            className="p-3 text-gray-700 dark:text-gray-200 hover:text-keo-600 transition"
            title="Note écrite"
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* GROS BOUTON MICRO CENTRAL */}
          <button
            type="button"
            onClick={() => setIsVoiceModalOpen(true)}
            className="w-14 h-14 rounded-full bg-gradient-to-tr from-keo-700 via-keo-600 to-amber-400 text-white flex items-center justify-center shadow-lg shadow-keo-600/40 active:scale-95 transition -translate-y-2 ring-4 ring-white dark:ring-slate-900"
            title="Enregistrer un mémo vocal"
          >
            <Mic className="w-6 h-6 text-amber-200 animate-pulse" />
          </button>

          {/* SECOND CERVEAU IA */}
          <button
            type="button"
            onClick={() => setIsSecondBrainOpen(true)}
            className="p-3 text-amber-600 dark:text-amber-400 hover:text-amber-500 transition"
            title="Second Cerveau IA"
          >
            <BrainCircuit className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* MODALES */}
      <VoiceRecordModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onNoteCreated={handleCreateNote}
      />

      <NoteEditorModal
        isOpen={isEditorModalOpen}
        noteToEdit={noteToEdit}
        onClose={() => setIsEditorModalOpen(false)}
        onSaveNote={(note) => {
          if (notes.some((n) => n.id === note.id)) {
            handleUpdateNote(note);
          } else {
            handleCreateNote(note);
          }
        }}
        onShareNote={(note) => {
          setIsEditorModalOpen(false);
          setNoteToShare(note);
        }}
      />

      <ShareNoteModal
        isOpen={Boolean(noteToShare)}
        note={noteToShare}
        onClose={() => setNoteToShare(null)}
      />

      <SecondBrainModal
        isOpen={isSecondBrainOpen}
        notes={notes}
        onClose={() => setIsSecondBrainOpen(false)}
        onOpenNote={handleOpenEdit}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        notes={notes}
        onClose={() => setIsSettingsOpen(false)}
        onImportNotes={(imported) => setNotes([...imported, ...notes])}
      />
    </div>
  );
}
