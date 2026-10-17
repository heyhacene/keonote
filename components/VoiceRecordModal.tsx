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
      handleStartRecording();
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

    const started = await manager.start(
      (liveText) => setTranscript(liveText),
      (bars) => setWaveformData(bars)
    );

    if (!started) {
      setErrorMsg('Impossible d’accéder au microphone. Veuillez autoriser l’accès micro.');
      setIsRecording(false);
      return;
    }

    setIsRecording(true);
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
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
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
              {isRecording ? 'Enregistrement en direct' : isAnalyzing ? 'Structuration IA...' : 'Mémo vocal'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
                  height: `${isRecording ? Math.max(12, amplitude) : 12}%`,
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

        {/* MESSAGE D'ERREUR */}
        {errorMsg && (
          <div className="w-full mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

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
            {isAnalyzing ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
                <span>Structuration IA en cours...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Terminer & Structurer avec l'IA</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
