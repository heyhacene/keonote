'use client';

import React, { useState } from 'react';
import {
  Pin,
  Mic,
  FileText,
  CheckSquare,
  Square,
  Sparkles,
  MoreVertical,
  Trash2,
  Archive,
  Edit3,
  Play,
  Pause,
  Clock,
  Share2,
} from 'lucide-react';
import { Note, NoteTodoItem } from '@/types/note';

interface NoteCardProps {
  note: Note;
  onToggleTodo: (noteId: string, todoId: string) => void;
  onTogglePin: (noteId: string) => void;
  onToggleArchive: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onEditNote: (note: Note) => void;
  onTagClick: (tag: string) => void;
  onRetryProcessing?: (note: Note) => void;
  onOpenSettings?: () => void;
}

export function NoteCard({
  note,
  onToggleTodo,
  onTogglePin,
  onToggleArchive,
  onDeleteNote,
  onEditNote,
  onTagClick,
  onRetryProcessing,
  onOpenSettings,
}: NoteCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const togglePlayAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const isPlaceholderContent =
    note.content === 'Mémo vocal enregistré' ||
    note.content === 'Mémo vocal enregistré...' ||
    note.content.startsWith('Enregistrement audio capturé');

  return (
    <div
      onClick={() => onEditNote(note)}
      className={`group relative bg-white dark:bg-slate-800 rounded-3xl p-4 sm:p-5 border transition-all duration-200 hover:shadow-lg cursor-pointer flex flex-col justify-between ${
        note.status === 'processing'
          ? 'border-purple-300 dark:border-purple-700 ring-2 ring-purple-400/20 shadow-md'
          : note.isPinned
          ? 'border-keo-400/80 dark:border-keo-600/80 shadow-sm shadow-keo-500/10'
          : 'border-gray-200/70 dark:border-slate-700/80 hover:border-keo-300 dark:hover:border-slate-600'
      }`}
    >
      {/* HEADER DE LA NOTE */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {note.type === 'voice' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/40">
                <Mic className="w-3 h-3 text-amber-500" />
                <span>Mémo</span>
                {note.audioDurationSec && (
                  <span className="opacity-75 font-mono">{note.audioDurationSec}s</span>
                )}
              </span>
            )}
            <span className="text-[11px] text-gray-400 dark:text-slate-400 font-medium flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(note.createdAt)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(note.id);
              }}
              className={`p-1.5 rounded-xl transition ${
                note.isPinned
                  ? 'text-keo-600 dark:text-keo-400 bg-keo-50 dark:bg-keo-950/60'
                  : 'text-gray-300 hover:text-gray-600 dark:text-slate-600 dark:hover:text-slate-300'
              }`}
              title={note.isPinned ? 'Détacher' : 'Épingler en haut'}
            >
              <Pin className={`w-3.5 h-3.5 ${note.isPinned ? 'fill-current rotate-45' : ''}`} />
            </button>

            {/* BOUTON MENU */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {showMenu && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-150 dark:border-slate-700 py-1.5 z-20 animate-in fade-in zoom-in-95"
                >
                  {note.audioData && onRetryProcessing && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onRetryProcessing(note);
                      }}
                      className="w-full px-3 py-1.5 text-xs text-left font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 flex items-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Retranscrire par IA</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onEditNote(note);
                    }}
                    className="w-full px-3 py-1.5 text-xs text-left font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-keo-500" />
                    <span>Modifier</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onToggleArchive(note.id);
                    }}
                    className="w-full px-3 py-1.5 text-xs text-left font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Archive className="w-3.5 h-3.5 text-amber-500" />
                    <span>{note.isArchived ? 'Désarchiver' : 'Archiver'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      if (confirm('Supprimer définitivement cette note ?')) {
                        onDeleteNote(note.id);
                      }
                    }}
                    className="w-full px-3 py-1.5 text-xs text-left font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BANNIÈRE DE TRAITEMENT IA EN ARRIÈRE-PLAN */}
        {note.status === 'processing' && (
          <div className="mb-3 p-2.5 bg-gradient-to-r from-purple-50/90 via-keo-50/80 to-amber-50/90 dark:from-purple-950/50 dark:via-keo-950/50 dark:to-amber-950/50 border border-purple-200 dark:border-purple-800/60 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-spin shrink-0" />
              <span className="text-xs font-bold text-purple-900 dark:text-purple-200 truncate">
                Retranscription & structuration IA...
              </span>
            </div>
            <span className="text-[10px] text-purple-600 dark:text-purple-300 font-bold animate-pulse shrink-0 ml-2">
              En cours
            </span>
          </div>
        )}

        {/* BANNIÈRE SI ERREUR DE TRAITEMENT */}
        {note.status === 'error' && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="mb-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-2xl space-y-2 text-xs"
          >
            <p className="text-[11px] font-medium text-red-700 dark:text-red-300 leading-snug">
              {note.processingError || 'Échec de retranscription IA'}
            </p>
            <div className="flex items-center gap-2">
              {onRetryProcessing && (
                <button
                  type="button"
                  onClick={() => onRetryProcessing(note)}
                  className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-[11px] flex items-center gap-1 transition"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Réessayer l'IA</span>
                </button>
              )}
              {onOpenSettings && note.processingError?.toLowerCase().includes('clé') && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 rounded-xl font-bold text-[11px] transition"
                >
                  Configurer la clé ⚙️
                </button>
              )}
            </div>
          </div>
        )}

        {/* TITRE */}
        <h3 className="font-extrabold text-sm sm:text-base text-gray-900 dark:text-white leading-snug mb-1.5 line-clamp-2">
          {note.title}
        </h3>

        {/* RÉSUMÉ IA */}
        {note.summary && note.summary !== 'Mémo vocal enregistré...' && (
          <div className="mb-3 p-2.5 bg-keo-50/60 dark:bg-keo-950/30 rounded-2xl border border-keo-100/80 dark:border-keo-900/30 flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-keo-600 dark:text-keo-400 shrink-0 mt-0.5" />
            <p className="text-xs text-keo-900 dark:text-keo-200 font-medium leading-relaxed line-clamp-2">
              {note.summary}
            </p>
          </div>
        )}

        {/* LECTEUR AUDIO SI MÉMO VOCAL */}
        {note.audioData && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="mb-3 p-2 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-700 flex items-center justify-between gap-2"
          >
            <audio
              ref={audioRef}
              src={note.audioData}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
            <button
              type="button"
              onClick={togglePlayAudio}
              className="p-1.5 bg-keo-600 hover:bg-keo-700 text-white rounded-xl transition flex items-center justify-center shrink-0"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <div className="flex-1 text-[11px] font-medium text-gray-600 dark:text-gray-300 truncate">
              {isPlaying ? 'Lecture en cours...' : 'Écouter l’enregistrement'}
            </div>
            {onRetryProcessing && note.status !== 'processing' && (
              <button
                type="button"
                onClick={() => onRetryProcessing(note)}
                className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/70 dark:hover:bg-purple-900/80 text-purple-700 dark:text-purple-300 rounded-xl text-[10px] font-bold transition flex items-center gap-1 shrink-0"
                title="Retranscrire et structurer cet audio avec l'IA Gemini"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>{isPlaceholderContent ? 'Retranscrire IA' : 'Relancer IA'}</span>
              </button>
            )}
          </div>
        )}

        {/* CONTENU TEXTE */}
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-4 mb-3 whitespace-pre-line">
          {note.content}
        </p>

        {/* LISTE DE TÂCHES INTERACTIVE */}
        {note.todos && note.todos.length > 0 && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="mb-3 space-y-1.5 pt-1 border-t border-gray-100 dark:border-slate-750"
          >
            {note.todos.slice(0, 4).map((todo) => (
              <button
                key={todo.id}
                type="button"
                onClick={() => onToggleTodo(note.id, todo.id)}
                className="w-full flex items-center gap-2 text-left group/item"
              >
                {todo.completed ? (
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-gray-400 group-hover/item:text-keo-500 shrink-0" />
                )}
                <span
                  className={`text-xs truncate ${
                    todo.completed
                      ? 'line-through text-gray-400 dark:text-slate-500'
                      : 'text-gray-700 dark:text-gray-200'
                  }`}
                >
                  {todo.text}
                </span>
              </button>
            ))}
            {note.todos.length > 4 && (
              <p className="text-[10px] text-gray-400 pl-5 italic">
                +{note.todos.length - 4} autre(s) action(s)...
              </p>
            )}
          </div>
        )}
      </div>

      {/* TAGS FOOTER */}
      {note.tags && note.tags.length > 0 && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-gray-100 dark:border-slate-750"
        >
          {note.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onTagClick(tag)}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-keo-50 hover:text-keo-600 dark:hover:bg-slate-600 text-gray-600 dark:text-gray-300 transition"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
