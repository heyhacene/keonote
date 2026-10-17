'use client';

import React from 'react';
import {
  Sparkles,
  Settings,
  Sun,
  Moon,
  Search,
  Plus,
  Mic,
  BrainCircuit,
} from 'lucide-react';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenVoiceRecord: () => void;
  onOpenNewTextNote: () => void;
  onOpenSecondBrain: () => void;
  onOpenSettings: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export function Navbar({
  searchQuery,
  onSearchChange,
  onOpenVoiceRecord,
  onOpenNewTextNote,
  onOpenSecondBrain,
  onOpenSettings,
  darkMode,
  onToggleDarkMode,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-150 dark:border-slate-800 transition-colors w-full">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2 sm:gap-3 min-w-0">
        {/* LOGO & NOM */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-keo-700 via-keo-600 to-amber-400 text-white flex items-center justify-center shadow-md shadow-keo-600/25 shrink-0">
            <Mic className="w-5 h-5 text-amber-200" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-base tracking-tight text-gray-900 dark:text-white">
              Keo <span className="text-keo-600 dark:text-keo-400">Note</span>
            </h1>
            <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-keo-50 dark:bg-keo-950/60 text-keo-700 dark:text-keo-300 border border-keo-200/60 dark:border-keo-800/50">
              <Sparkles className="w-3 h-3 text-amber-500" />
              IA Gemini
            </span>
          </div>
        </div>

        {/* BARRE DE RECHERCHE CENTRALE (DESKTOP) */}
        <div className="flex-1 max-w-md relative hidden md:block">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher par titre, contenu, tâche, tag..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 hover:bg-gray-100/80 dark:bg-slate-800 dark:hover:bg-slate-800/90 border border-gray-200 dark:border-slate-700 rounded-2xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-keo-500 outline-none transition"
          />
        </div>

        {/* ACTIONS DU HEADER */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* BOUTON VOCAL RAPIDE */}
          <button
            type="button"
            onClick={onOpenVoiceRecord}
            className="px-2.5 sm:px-3 py-2 bg-gradient-to-r from-keo-600 to-purple-600 hover:from-keo-700 hover:to-purple-700 text-white rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-keo-600/30 active:scale-95 shrink-0"
            title="Enregistrer un mémo vocal instantané"
          >
            <Mic className="w-4 h-4 text-amber-300 animate-pulse" />
            <span className="hidden sm:inline">Mémo Vocal</span>
          </button>

          {/* BOUTON NOTE ÉCRITE */}
          <button
            type="button"
            onClick={onOpenNewTextNote}
            className="p-2 sm:px-3 sm:py-2 bg-gray-100 hover:bg-gray-200/80 dark:bg-slate-800 dark:hover:bg-slate-750 text-gray-700 dark:text-gray-200 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 border border-gray-200/70 dark:border-slate-700 shrink-0"
            title="Créer une note écrite"
          >
            <Plus className="w-4 h-4 text-keo-600 dark:text-keo-400" />
            <span className="hidden sm:inline">Écrire</span>
          </button>

          {/* SECOND CERVEAU IA */}
          <button
            type="button"
            onClick={onOpenSecondBrain}
            className="p-2 text-amber-600 hover:text-amber-700 dark:text-amber-400 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl transition shrink-0"
            title="Poser une question à votre Second Cerveau"
          >
            <BrainCircuit className="w-4 h-4" />
          </button>

          {/* SÉPARATEUR */}
          <div className="h-5 w-px bg-gray-200 dark:bg-slate-700 mx-0.5 shrink-0" />

          {/* PARAMÈTRES */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-750 border border-gray-200/60 dark:border-slate-700 rounded-2xl transition shrink-0"
            title="Paramètres & Clé Gemini"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* THÈME */}
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-2xl transition shrink-0"
            title="Basculer le thème"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
