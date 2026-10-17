'use client';

import React, { useState } from 'react';
import {
  BrainCircuit,
  X,
  Send,
  Sparkles,
  Bot,
  User,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { Note } from '@/types/note';
import { querySecondBrain } from '@/lib/gemini';
import { getGeminiApiKey } from '@/lib/storage';

interface SecondBrainModalProps {
  isOpen: boolean;
  notes: Note[];
  onClose: () => void;
  onOpenNote: (note: Note) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  relatedNotes?: Note[];
}

function FormattedAiMessage({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        const isBullet = /^[•\-\*]\s+/.test(trimmed);
        const content = isBullet ? trimmed.replace(/^[•\-\*]\s+/, '') : trimmed;

        const renderInline = (str: string) => {
          const parts = str.split(/(\*\*[^*]+\*\*)/g);
          return parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-bold text-gray-950 dark:text-white">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return <span key={pIdx}>{part}</span>;
          });
        };

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 py-0.5">
              <span className="text-amber-500 font-bold shrink-0 mt-0.5">•</span>
              <span className="flex-1 text-gray-800 dark:text-gray-100">{renderInline(content)}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="text-gray-800 dark:text-gray-100">
            {renderInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

export function SecondBrainModal({
  isOpen,
  notes,
  onClose,
  onOpenNote,
}: SecondBrainModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "Bonjour ! Je suis votre Second Cerveau Keo Note. Je connais l'intégralité de vos notes, mémos vocaux et to-dos.\n\nPosez-moi n'importe quelle question sur vos notes enregistrées !",
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sampleQuestions = [
    'Quelles sont mes tâches urgentes à faire ?',
    'Qu’ai-je noté concernant la voiture ?',
    'Y a-t-il une liste de courses en cours ?',
  ];

  const handleSend = async (questionText?: string) => {
    const q = (questionText || inputQuery).trim();
    if (!q || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const apiKey = getGeminiApiKey();
      const res = await querySecondBrain(q, notes, apiKey);

      const relatedNotes = notes.filter((n) => res.relatedNoteIds.includes(n.id));

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: res.answer,
        relatedNotes,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'assistant',
          text: "Désolé, une erreur est survenue lors de l'interrogation de vos notes.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full h-[85vh] flex flex-col shadow-2xl border border-gray-150 dark:border-slate-700 animate-in fade-in zoom-in-95 overflow-hidden">
        {/* HEADER */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-keo-50 via-amber-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                <span>Second Cerveau IA</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                  Gemini
                </span>
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Interrogez l'ensemble de vos {notes.length} note(s) en langage naturel
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

        {/* MESSAGES */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/50 dark:bg-slate-900/50">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.sender === 'assistant' && (
                <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-keo-600 text-white rounded-br-xs shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 border border-gray-150 dark:border-slate-700 rounded-bl-xs shadow-xs'
                }`}
              >
                {m.sender === 'user' ? (
                  <div className="whitespace-pre-wrap">{m.text}</div>
                ) : (
                  <FormattedAiMessage text={m.text} />
                )}

                {/* NOTES SOURCES ASSOCIÉES */}
                {m.relatedNotes && m.relatedNotes.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-700 space-y-1.5">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Sources trouvées dans vos notes :
                    </div>
                    {m.relatedNotes.map((note) => (
                      <button
                        key={note.id}
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenNote(note);
                        }}
                        className="w-full p-2 bg-gray-50 dark:bg-slate-750 hover:bg-keo-50 dark:hover:bg-slate-700 rounded-xl border border-gray-200/60 dark:border-slate-700 transition flex items-center justify-between text-left group"
                      >
                        <div className="truncate pr-2">
                          <div className="font-bold text-xs text-gray-900 dark:text-white truncate">
                            {note.title}
                          </div>
                          <div className="text-[10px] text-gray-400 truncate">
                            {note.summary || note.content.slice(0, 50)}
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-keo-600 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {m.sender === 'user' && (
                <div className="w-7 h-7 rounded-xl bg-keo-700 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2.5 items-center text-gray-400 text-xs italic pl-9">
              <Sparkles className="w-4 h-4 animate-spin text-amber-500" />
              <span>Votre Second Cerveau consulte vos notes...</span>
            </div>
          )}
        </div>

        {/* QUESTIONS SUGGÉRÉES */}
        {messages.length <= 2 && (
          <div className="p-2.5 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {sampleQuestions.map((sq, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSend(sq)}
                className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 hover:bg-keo-50 hover:text-keo-600 dark:bg-slate-700 dark:hover:bg-slate-650 text-gray-700 dark:text-gray-300 transition"
              >
                {sq}
              </button>
            ))}
          </div>
        )}

        {/* CHAMP DE SAISIE */}
        <div className="p-3 border-t border-gray-150 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Posez une question sur vos notes..."
            className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!inputQuery.trim() || isLoading}
            className="p-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl transition disabled:opacity-40 shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
