'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Download,
  Upload,
  Sparkles,
  ExternalLink,
  Shield,
  Smartphone,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { getGeminiApiKey, saveGeminiApiKey } from '@/lib/storage';
import { getDirectKeoNoteApkUrl, getDirectKeoNoteApkFilename, fetchLatestKeoNoteApk, LatestApkRelease } from '@/lib/apkUpdate';
import { Note } from '@/types/note';

interface SettingsModalProps {
  isOpen: boolean;
  notes: Note[];
  onClose: () => void;
  onImportNotes: (imported: Note[]) => void;
}

export function SettingsModal({
  isOpen,
  notes,
  onClose,
  onImportNotes,
}: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [latestApk, setLatestApk] = useState<LatestApkRelease | null>(null);

  useEffect(() => {
    if (isOpen) {
      setApiKey(getGeminiApiKey());
      setKeySaved(false);
      setTestResult(null);
      fetchLatestKeoNoteApk().then((apk) => setLatestApk(apk));
    }
  }, [isOpen]);

  const handleSaveKey = () => {
    saveGeminiApiKey(apiKey);
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2500);
  };

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      setTestResult('Veuillez renseigner une clé API avant de tester.');
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Dis simplement "Clé API valide !" en français.' }] }],
          }),
        }
      );
      if (res.ok) {
        setTestResult('Succès : Votre clé Gemini fonctionne parfaitement ! 🎉');
      } else {
        const err = await res.json().catch(() => ({}));
        setTestResult(`Erreur API (${res.status}) : ${err.error?.message || 'Clé non reconnue'}`);
      }
    } catch (e: any) {
      setTestResult(`Erreur de connexion : ${e.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(notes, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `keonote-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          onImportNotes(parsed);
          alert(`${parsed.length} note(s) importée(s) avec succès !`);
          onClose();
        } else {
          alert('Format de fichier invalide.');
        }
      } catch (err) {
        alert('Impossible de lire ce fichier JSON.');
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-150 dark:border-slate-700 animate-in fade-in zoom-in-95">
        {/* HEADER */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-keo-100 dark:bg-keo-950/60 text-keo-700 dark:text-keo-300 rounded-xl">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                Paramètres & Clé IA
              </h3>
              <p className="text-[11px] text-gray-400">
                Configuration Gemini, Sauvegardes & Application
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENU */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* CONFIGURATION CLÉ GEMINI */}
          <div className="p-4 bg-gradient-to-r from-keo-50/60 via-purple-50/40 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-850 rounded-2xl border border-keo-200/70 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-keo-600 text-white rounded-lg">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-gray-900 dark:text-white">
                    Clé API Google Gemini (100% Gratuite)
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Nécessaire pour la structuration automatique & Second Cerveau
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Collez votre clé API Gemini (AIzaSy...)"
                className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-keo-500 font-mono"
              />

              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-keo-600 dark:text-keo-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>Créer ma clé gratuite sur Google AI Studio</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestKey}
                    disabled={isTesting}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>{isTesting ? 'Test...' : 'Tester'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveKey}
                    className="px-3.5 py-1.5 bg-keo-600 hover:bg-keo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{keySaved ? 'Enregistrée !' : 'Enregistrer'}</span>
                  </button>
                </div>
              </div>

              {testResult && (
                <div className={`p-2.5 rounded-xl text-xs mt-2 ${
                  testResult.startsWith('Succès')
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                }`}>
                  {testResult}
                </div>
              )}
            </div>
          </div>

          {/* APPLICATION ANDROID & MISE À JOUR */}
          <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-700 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500 text-white rounded-lg">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-gray-900 dark:text-white">
                  Application Android (APK)
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Téléchargement direct avec numéro de build
                </p>
              </div>
            </div>

            <div>
              <a
                href={latestApk ? latestApk.downloadUrl : getDirectKeoNoteApkUrl()}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="w-full py-2.5 px-3 bg-keo-600 hover:bg-keo-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>
                  {latestApk
                    ? `Télécharger ${latestApk.filename}`
                    : `Télécharger ${getDirectKeoNoteApkFilename()}`}
                </span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>
            </div>
          </div>

          {/* SAUVEGARDE & EXPORT */}
          <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-700 space-y-3">
            <h4 className="font-bold text-xs text-gray-900 dark:text-white uppercase tracking-wider">
              Sauvegardes & Import
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExportJson}
                className="py-2 px-3 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-750 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 transition flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-keo-600" />
                <span>Exporter JSON</span>
              </button>

              <label className="py-2 px-3 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-750 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 transition flex items-center justify-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-amber-500" />
                <span>Importer JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJson}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
