'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  X,
  RotateCcw,
  Check,
  AlertCircle,
  Volume2,
  ShieldCheck,
} from 'lucide-react';
import { VoiceRecordingManager } from '@/lib/audioRecorder';
import { analyzeTranscriptWithGemini } from '@/lib/gemini';
import { getGeminiApiKey } from '@/lib/storage';
import { Note } from '@/types/note';

interface VoiceRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNoteCreated: (note: Note) => void;
}

export function VoiceRecordModal({
  isOpen,
  onClose,
  onNoteCreated,
}: VoiceRecordModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [waveformData, setWaveformData] = useState<number[]>([15, 25, 40, 20, 50, 30, 60, 40, 30, 20, 15, 10]);
  const [duration, setDuration] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recorderRef = useRef<VoiceRecordingManager | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setTranscript('');
      setDuration(0);

      // Si l'autorisation a déjà été accordée précédemment, on peut lancer directement
      if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
        navigator.permissions
          .query({ name: 'microphone' as any })
          .then((perm) => {
            if (perm.state === 'granted') {
              handleStartRecording();
            }
          })
          .catch(() => {});
      }
    } else {
      handleCleanup();
    }
    return () => handleCleanup();
  }, [isOpen]);

  const handleCleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.isRecording) {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    setIsRecording(false);
    setTranscript('');
    setDuration(0);
    setErrorMsg(null);
  };

  const handleStartRecording = async () => {
    setErrorMsg(null);
    setTranscript('');
    setDuration(0);

    const manager = new VoiceRecordingManager();
    recorderRef.current = manager;

    try {
      const started = await manager.start(
        (liveText) => setTranscript(liveText),
        (bars) => setWaveformData(bars)
      );

      if (!started) {
        setErrorMsg('Microphone non autorisé. Cliquez sur le bouton ci-dessous pour autoriser l’accès au micro.');
        setIsRecording(false);
        return;
      }

      setIsRecording(true);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setErrorMsg('Impossible d’activer le microphone. Vérifiez les autorisations de votre téléphone.');
      setIsRecording(false);
    }
  };

  const handleStopAndAnalyze = async () => {
    if (!recorderRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsAnalyzing(true);
    const audioResult = await recorderRef.current.stop();
    setIsRecording(false);

    const textToAnalyze = transcript.trim() || 'Note vocale sans parole détectée.';
    const apiKey = getGeminiApiKey();

    try {
      const aiResult = await analyzeTranscriptWithGemini(textToAnalyze, apiKey);

      const newNote: Note = {
        id: `note-${Date.now()}`,
        title: aiResult.title,
        content: aiResult.cleanContent,
        summary: aiResult.summary,
        todos: aiResult.todos.map((t, idx) => ({
          id: `todo-${Date.now()}-${idx}`,
          text: t,
          completed: false,
        })),
        tags: aiResult.tags,
        type: 'voice',
        audioData: audioResult?.audioDataUrl,
        audioDurationSec: audioResult?.durationSec || duration,
        isPinned: false,
        isArchived: false,
        color: '#8b5cf6',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      onNoteCreated(newNote);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la structuration de la note.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-6 flex flex-col items-center shadow-2xl border border-gray-150 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        {/* HEADER MODAL */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            {isRecording ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  Enregistrement en direct
                </span>
              </>
            ) : isAnalyzing ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  Structuration IA...
                </span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-keo-600 dark:text-keo-400" />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  Mémo vocal & Dictée
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ÉTAT 1 : EN ATTENTE D'AUTORISATION OU DÉMARRAGE */}
        {!isRecording && !isAnalyzing && (
          <div className="my-8 flex flex-col items-center text-center max-w-sm w-full">
            <button
              type="button"
              onClick={handleStartRecording}
              className="w-24 h-24 rounded-full bg-gradient-to-tr from-keo-600 via-purple-600 to-amber-400 text-white flex items-center justify-center shadow-xl shadow-keo-600/30 hover:scale-105 active:scale-95 transition group"
            >
              <Mic className="w-10 h-10 group-hover:scale-110 transition-transform" />
            </button>
            <h4 className="mt-4 font-extrabold text-base text-gray-900 dark:text-white">
              Appuyer pour parler
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
              Active le microphone de votre téléphone et transcrit vos paroles en temps réel.
            </p>

            {errorMsg && (
              <div className="mt-5 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-left space-y-2 w-full">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>Autorisation microphone requise</span>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  Keo Note a besoin de l’accès au micro pour retranscrire votre voix.
                </p>
                <button
                  type="button"
                  onClick={handleStartRecording}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-98 transition flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Autoriser le microphone</span>
                </button>
                <p className="text-[10px] text-gray-400">
                  Si le popup n'apparaît pas : Paramètres du téléphone &gt; Applications &gt; Keo Note &gt; Autorisations.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ÉTAT 2 : ENREGISTREMENT ACTIF */}
        {isRecording && (
          <>
            {/* COMPTEUR & VISUALISATION AUDIO */}
            <div className="my-6 flex flex-col items-center">
              <div className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white font-mono mb-4">
                {formatSeconds(duration)}
              </div>

              {/* ONDE SONORE DYNAMIQUE */}
              <div className="flex items-center gap-1.5 h-16 px-4 py-2 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-700/80">
                {waveformData.map((amplitude, i) => (
                  <div
                    key={i}
                    className="w-2 rounded-full bg-gradient-to-t from-keo-600 to-amber-400 transition-all duration-75"
                    style={{
                      height: `${Math.max(12, amplitude)}%`,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* TRANSCRIPTION EN DIRECT */}
            <div className="w-full bg-gray-50 dark:bg-slate-900/90 rounded-2xl p-4 border border-gray-150 dark:border-slate-700 min-h-[110px] max-h-[160px] overflow-y-auto mb-6">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-400 mb-1 flex items-center gap-1">
                <Volume2 className="w-3 h-3 text-keo-500" />
                <span>Retranscription en temps réel :</span>
              </div>
              {transcript ? (
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-relaxed">
                  {transcript}
                </p>
              ) : (
                <p className="text-xs text-gray-400 italic">
                  Parlez naturellement en français... Vos paroles s’affichent ici en direct.
                </p>
              )}
            </div>

            {/* ACTIONS & CONTRÔLE */}
            <div className="w-full flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleStartRecording}
                disabled={isAnalyzing}
                className="p-3 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-2xl transition flex items-center justify-center gap-1.5 text-xs font-bold disabled:opacity-50"
                title="Recommencer l'enregistrement"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Recommencer</span>
              </button>

              <button
                type="button"
                onClick={handleStopAndAnalyze}
                disabled={isAnalyzing || duration === 0}
                className="flex-1 py-3.5 px-4 bg-gradient-to-r from-keo-600 to-purple-600 hover:from-keo-700 hover:to-purple-700 text-white rounded-2xl text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-2 shadow-lg shadow-keo-600/30 active:scale-98 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Terminer & Structurer avec l'IA</span>
              </button>
            </div>
          </>
        )}

        {/* ÉTAT 3 : ANALYSE EN COURS */}
        {isAnalyzing && (
          <div className="my-10 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-keo-50 dark:bg-slate-900 flex items-center justify-center text-keo-600 dark:text-keo-400 shadow-inner">
              <Sparkles className="w-8 h-8 animate-spin text-amber-400" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">
                Structuration intelligente en cours...
              </h4>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">
                Gemini extrait le titre, le résumé, vos to-dos et les catégories.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
