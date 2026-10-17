'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Check,
  Plus,
  Trash2,
  Tag,
  CheckSquare,
  Square,
  AlertCircle,
  FileText,
  Share2,
} from 'lucide-react';
import { Note, NoteTodoItem } from '@/types/note';
import { analyzeVoiceMemoWithGemini } from '@/lib/gemini';
import { getGeminiApiKey } from '@/lib/storage';

interface NoteEditorModalProps {
  isOpen: boolean;
  noteToEdit: Note | null;
  onClose: () => void;
  onSaveNote: (note: Note) => void;
  onShareNote?: (note: Note) => void;
}

export function NoteEditorModal({
  isOpen,
  noteToEdit,
  onClose,
  onSaveNote,
  onShareNote,
}: NoteEditorModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [todos, setTodos] = useState<NoteTodoItem[]>([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTagText, setNewTagText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (noteToEdit) {
      setTitle(noteToEdit.title);
      setContent(noteToEdit.content);
      setSummary(noteToEdit.summary || '');
      setTodos(noteToEdit.todos || []);
      setTags(noteToEdit.tags || []);
    } else {
      setTitle('');
      setContent('');
      setSummary('');
      setTodos([]);
      setTags(['Général']);
    }
    setErrorMsg(null);
  }, [noteToEdit, isOpen]);

  const handleAddTodo = () => {
    if (!newTodoText.trim()) return;
    setTodos([
      ...todos,
      { id: `t-${Date.now()}`, text: newTodoText.trim(), completed: false },
    ]);
    setNewTodoText('');
  };

  const handleRemoveTodo = (id: string) => {
    setTodos(todos.filter((t) => t.id !== id));
  };

  const handleToggleTodo = (id: string) => {
    setTodos(
      todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleAddTag = () => {
    const clean = newTagText.trim().replace(/^#/, '');
    if (!clean || tags.includes(clean)) return;
    setTags([...tags, clean]);
    setNewTagText('');
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleAiEnrich = async () => {
    const hasAudio = Boolean(noteToEdit?.audioData);
    if (!hasAudio && !content.trim() && !title.trim()) {
      setErrorMsg('Écrivez du contenu ou utilisez un mémo vocal pour que l’IA puisse l’analyser.');
      return;
    }
    setIsAiLoading(true);
    setErrorMsg(null);
    try {
      const apiKey = getGeminiApiKey();
      const isPlaceholder =
        content === 'Mémo vocal enregistré' ||
        content === 'Mémo vocal enregistré...' ||
        content.startsWith('Enregistrement audio capturé');

      const textToAnalyze = isPlaceholder ? '' : `${title}\n\n${content}`.trim();
      const res = await analyzeVoiceMemoWithGemini(
        noteToEdit?.audioData,
        textToAnalyze,
        apiKey
      );

      if (res.title) setTitle(res.title);
      if (res.summary) setSummary(res.summary);
      if (res.cleanContent) setContent(res.cleanContent);
      if (res.todos.length > 0) {
        const newItems: NoteTodoItem[] = res.todos.map((item, idx) => ({
          id: `todo-ai-${Date.now()}-${idx}`,
          text: item,
          completed: false,
        }));
        setTodos([...todos, ...newItems]);
      }
      if (res.tags.length > 0) {
        const merged = Array.from(new Set([...tags.filter((t) => t !== 'En traitement'), ...res.tags]));
        setTags(merged);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la retranscription et structuration IA.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSave = () => {
    if (!title.trim() && !content.trim()) {
      setErrorMsg('Veuillez renseigner un titre ou du contenu.');
      return;
    }

    const updatedNote: Note = {
      id: noteToEdit ? noteToEdit.id : `note-${Date.now()}`,
      title: title.trim() || 'Sans titre',
      content: content.trim(),
      summary: summary.trim() || undefined,
      todos,
      tags: tags.length > 0 ? tags : ['Général'],
      type: noteToEdit ? noteToEdit.type : 'text',
      audioData: noteToEdit?.audioData,
      audioDurationSec: noteToEdit?.audioDurationSec,
      isPinned: noteToEdit ? noteToEdit.isPinned : false,
      isArchived: noteToEdit ? noteToEdit.isArchived : false,
      color: noteToEdit ? noteToEdit.color : '#8b5cf6',
      createdAt: noteToEdit ? noteToEdit.createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    onSaveNote(updatedNote);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-150 dark:border-slate-700 animate-in fade-in zoom-in-95">
        {/* HEADER */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-keo-100 dark:bg-keo-950/60 text-keo-700 dark:text-keo-300 rounded-xl">
              <FileText className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">
              {noteToEdit ? 'Modifier la note' : 'Nouvelle note'}
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            {onShareNote && (
              <button
                type="button"
                onClick={() => {
                  const currentObj: Note = {
                    id: noteToEdit ? noteToEdit.id : `note-${Date.now()}`,
                    title: title.trim() || 'Sans titre',
                    content: content.trim(),
                    summary: summary.trim() || undefined,
                    todos,
                    tags: tags.length > 0 ? tags : ['Général'],
                    type: noteToEdit ? noteToEdit.type : 'text',
                    audioData: noteToEdit?.audioData,
                    audioDurationSec: noteToEdit?.audioDurationSec,
                    isPinned: noteToEdit ? noteToEdit.isPinned : false,
                    isArchived: noteToEdit ? noteToEdit.isArchived : false,
                    color: noteToEdit ? noteToEdit.color : '#8b5cf6',
                    createdAt: noteToEdit ? noteToEdit.createdAt : Date.now(),
                    updatedAt: Date.now(),
                  };
                  onShareNote(currentObj);
                }}
                className="py-1.5 px-2.5 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/60 dark:hover:bg-orange-900/70 text-orange-600 dark:text-amber-300 border border-orange-200/80 dark:border-orange-800/50 rounded-xl text-xs font-bold transition flex items-center gap-1"
                title="Partager ou envoyer vers Keo Family"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Partager</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleAiEnrich}
              disabled={isAiLoading}
              className="py-1.5 px-2.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-900/40 rounded-xl text-xs font-bold transition flex items-center gap-1"
              title="Structurer et enrichir avec l'IA Gemini"
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-500 ${isAiLoading ? 'animate-spin' : ''}`} />
              <span>{isAiLoading ? 'IA...' : 'IA'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CORPS DE L'ÉDITEUR */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TITRE */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de la note..."
              className="w-full text-base sm:text-lg font-extrabold bg-transparent text-gray-900 dark:text-white placeholder-gray-400 outline-none"
            />
          </div>

          {/* RÉSUMÉ IA SI PRÉSENT */}
          {summary && (
            <div className="p-3 bg-keo-50/70 dark:bg-keo-950/30 rounded-2xl border border-keo-100 dark:border-keo-900/30 space-y-1">
              <div className="flex items-center gap-1 text-[10px] font-bold text-keo-700 dark:text-keo-300 uppercase">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Résumé IA</span>
              </div>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={2}
                className="w-full text-xs text-keo-900 dark:text-keo-200 bg-transparent resize-none outline-none"
              />
            </div>
          )}

          {/* CONTENU TEXTE */}
          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Écrivez votre note, vos idées, adresses, mémo..."
              rows={6}
              className="w-full text-xs sm:text-sm text-gray-800 dark:text-gray-200 bg-transparent resize-none outline-none leading-relaxed"
            />
            {Array.from(new Set(content.match(/https?:\/\/[^\s]+/g) || [])).length > 0 && (
              <div className="mt-2 p-2.5 bg-keo-50/70 dark:bg-slate-900/80 border border-keo-200/70 dark:border-slate-700 rounded-2xl space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-keo-700 dark:text-keo-300 block">
                  🔗 Lien(s) cliquable(s) dans cette note :
                </span>
                {Array.from(new Set(content.match(/https?:\/\/[^\s]+/g) || [])).map((link, i) => (
                  <a
                    key={i}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs font-bold text-keo-600 dark:text-keo-400 underline break-all hover:text-keo-700"
                  >
                    {link}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* ACTIONS / TO-DOS */}
          <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-700">
            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center justify-between">
              <span>Actions & Tâches à faire</span>
              <span className="text-[10px] font-mono">{todos.length}</span>
            </h4>

            <div className="space-y-1.5">
              {todos.map((todo) => (
                <div key={todo.id} className="flex items-center gap-2 group">
                  <button
                    type="button"
                    onClick={() => handleToggleTodo(todo.id)}
                    className="shrink-0"
                  >
                    {todo.completed ? (
                      <CheckSquare className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  <span
                    className={`flex-1 text-xs ${
                      todo.completed ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {todo.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTodo(todo.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* AJOUT RAPIDE DE TÂCHE */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                placeholder="Ajouter une tâche à cocher..."
                className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-keo-500"
              />
              <button
                type="button"
                onClick={handleAddTodo}
                className="p-2 bg-keo-600 text-white rounded-xl text-xs font-bold hover:bg-keo-700 transition"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* TAGS */}
          <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-700">
            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              <span>Catégories & Tags</span>
            </h4>
            <div className="flex items-center gap-1.5 flex-wrap">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-xl bg-keo-50 dark:bg-slate-700 text-keo-700 dark:text-keo-300"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-red-500 ml-0.5"
                  >
                    &times;
                  </button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newTagText}
                  onChange={(e) => setNewTagText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  placeholder="+ tag"
                  className="w-20 px-2 py-1 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-[11px] outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between gap-2 bg-gray-50/50 dark:bg-slate-900/50">
          <div>
            {onShareNote && (title.trim() || content.trim()) && (
              <button
                type="button"
                onClick={() => {
                  const currentObj: Note = {
                    id: noteToEdit ? noteToEdit.id : `note-${Date.now()}`,
                    title: title.trim() || 'Sans titre',
                    content: content.trim(),
                    summary: summary.trim() || undefined,
                    todos,
                    tags: tags.length > 0 ? tags : ['Général'],
                    type: noteToEdit ? noteToEdit.type : 'text',
                    audioData: noteToEdit?.audioData,
                    audioDurationSec: noteToEdit?.audioDurationSec,
                    isPinned: noteToEdit ? noteToEdit.isPinned : false,
                    isArchived: noteToEdit ? noteToEdit.isArchived : false,
                    color: noteToEdit ? noteToEdit.color : '#8b5cf6',
                    createdAt: noteToEdit ? noteToEdit.createdAt : Date.now(),
                    updatedAt: Date.now(),
                  };
                  onShareNote(currentObj);
                }}
                className="px-3.5 py-2 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-950/70 text-orange-600 dark:text-amber-300 border border-orange-200/70 dark:border-orange-800/50 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Partager / Keo Family</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 bg-keo-600 hover:bg-keo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-keo-600/25 active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Enregistrer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
