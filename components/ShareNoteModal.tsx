'use client';

import React, { useState } from 'react';
import {
  X,
  Share2,
  MessageCircle,
  Mail,
  MessageSquare,
  Copy,
  Check,
  Users,
  CheckSquare,
  ShoppingCart,
  Send,
  Calendar,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { Note } from '@/types/note';

interface ShareNoteModalProps {
  isOpen: boolean;
  note: Note | null;
  onClose: () => void;
}

export function formatNoteForSharing(note: Note): string {
  const lines: string[] = [];
  lines.push(`📝 *${note.title}*`);

  if (note.summary && note.summary !== 'Mémo vocal enregistré...') {
    lines.push(`\n✨ _Résumé : ${note.summary}_`);
  }

  if (note.content && note.content.trim()) {
    lines.push(`\n${note.content.trim()}`);
  }

  if (note.todos && note.todos.length > 0) {
    lines.push(`\n📋 *Actions / À faire :*`);
    note.todos.forEach((t) => {
      lines.push(`${t.completed ? '✅' : '⬜'} ${t.text}`);
    });
  }

  if (note.tags && note.tags.length > 0) {
    lines.push(`\n🏷️ ${note.tags.map((t) => `#${t}`).join(' ')}`);
  }

  lines.push(`\n— Partagé depuis Keo Note`);
  return lines.join('\n');
}

export function ShareNoteModal({ isOpen, note, onClose }: ShareNoteModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !note) return null;

  const formattedText = formatNoteForSharing(note);
  const encodedText = encodeURIComponent(formattedText);
  const encodedTitle = encodeURIComponent(note.title);

  // 1. Partage natif Android / Web Share API
  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: note.title,
          text: formattedText,
        });
        return;
      } catch (_) {}
    }
    handleCopyText();
  };

  // 2. Copier dans le presse-papier
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(formattedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (_) {
      const textarea = document.createElement('textarea');
      textarea.value = formattedText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // 3. WhatsApp
  const whatsappUrl = `https://wa.me/?text=${encodedText}`;

  // 4. SMS
  const smsUrl = `sms:?body=${encodedText}`;

  // 5. Email
  const mailtoUrl = `mailto:?subject=${encodedTitle}&body=${encodedText}`;

  // 6. Envoyer vers Keo Family (https://dar.otsmane.fr & Custom Scheme keofamily://)
  const buildKeoFamilyPayload = (target: 'taches' | 'courses' | 'messages' | 'agenda') => {
    const payload = {
      source: 'keonote',
      target,
      title: note.title,
      content: note.content,
      summary: note.summary || '',
      todos: note.todos.map((t) => ({ text: t.text, completed: t.completed })),
      tags: note.tags || [],
      createdAt: note.createdAt,
    };

    const jsonStr = JSON.stringify(payload);
    const b64 = typeof window !== 'undefined'
      ? window.btoa(unescape(encodeURIComponent(jsonStr)))
      : '';

    return {
      webUrl: `https://dar.otsmane.fr/${target}?keonote_import=${encodeURIComponent(b64)}`,
      intentUrl: `intent://dar.otsmane.fr/${target}?keonote_import=${encodeURIComponent(b64)}#Intent;scheme=https;package=fr.otsmane.dar;S.browser_fallback_url=${encodeURIComponent(
        `https://dar.otsmane.fr/${target}?keonote_import=${encodeURIComponent(b64)}`
      )};end`,
    };
  };

  const handleOpenKeoFamily = (target: 'taches' | 'courses' | 'messages' | 'agenda') => {
    const { webUrl, intentUrl } = buildKeoFamilyPayload(target);
    const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
    if (isAndroid) {
      window.location.href = intentUrl;
    } else {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 flex flex-col shadow-2xl border border-gray-150 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-keo-100 dark:bg-keo-950/60 text-keo-600 dark:text-keo-400 rounded-xl">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">
                Partager & Envoyer la note
              </h3>
              <p className="text-[11px] text-gray-400 truncate max-w-[230px]">
                {note.title}
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

        {/* SECTION 1 : AJOUTER À KEO FAMILY */}
        <div className="mt-4 p-3.5 bg-gradient-to-br from-orange-50 via-amber-50/70 to-white dark:from-orange-950/40 dark:via-slate-900 dark:to-slate-850 rounded-2xl border border-orange-200/80 dark:border-orange-800/50 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-xs">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                  <span>Envoyer vers Keo Family</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-amber-300">
                    Suite Keo
                  </span>
                </h4>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Ajoute directement votre note ou vos tâches dans l’espace familial
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {/* 1. Vers Tâches Familiales */}
            <button
              type="button"
              onClick={() => handleOpenKeoFamily('taches')}
              className="p-2.5 bg-white dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-slate-750 border border-orange-200/70 dark:border-slate-700 rounded-xl text-left transition flex items-center gap-2 group shadow-2xs"
            >
              <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-amber-400 truncate">
                  Tâches famille
                </div>
                <div className="text-[10px] text-gray-400 truncate">
                  {note.todos.length > 0 ? `${note.todos.length} tâche(s) à faire` : 'Créer une tâche'}
                </div>
              </div>
            </button>

            {/* 2. Vers Liste de Courses */}
            <button
              type="button"
              onClick={() => handleOpenKeoFamily('courses')}
              className="p-2.5 bg-white dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-slate-750 border border-orange-200/70 dark:border-slate-700 rounded-xl text-left transition flex items-center gap-2 group shadow-2xs"
            >
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-amber-400 truncate">
                  Liste de courses
                </div>
                <div className="text-[10px] text-gray-400 truncate">
                  Ajouter les articles
                </div>
              </div>
            </button>

            {/* 3. Vers Messagerie Familiale */}
            <button
              type="button"
              onClick={() => handleOpenKeoFamily('messages')}
              className="p-2.5 bg-white dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-slate-750 border border-orange-200/70 dark:border-slate-700 rounded-xl text-left transition flex items-center gap-2 group shadow-2xs"
            >
              <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
                <Send className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-amber-400 truncate">
                  Chat familial
                </div>
                <div className="text-[10px] text-gray-400 truncate">
                  Publier dans le groupe
                </div>
              </div>
            </button>

            {/* 4. Vers Agenda Familial */}
            <button
              type="button"
              onClick={() => handleOpenKeoFamily('agenda')}
              className="p-2.5 bg-white dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-slate-750 border border-orange-200/70 dark:border-slate-700 rounded-xl text-left transition flex items-center gap-2 group shadow-2xs"
            >
              <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-amber-400 truncate">
                  Agenda famille
                </div>
                <div className="text-[10px] text-gray-400 truncate">
                  Planifier un événement
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* SECTION 2 : MOYENS DE PARTAGE HABITUELS (WHATSAPP, SMS, EMAIL, SYSTÈME) */}
        <div className="mt-4 space-y-2.5">
          <h4 className="text-[11px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">
            Partager via vos applications
          </h4>

          <div className="grid grid-cols-3 gap-2">
            {/* WHATSAPP */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="p-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 border border-emerald-200/70 dark:border-emerald-800/50 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-emerald-700 dark:text-emerald-300 transition active:scale-95"
            >
              <MessageCircle className="w-5 h-5 text-emerald-500" />
              <span className="text-xs font-bold">WhatsApp</span>
            </a>

            {/* SMS */}
            <a
              href={smsUrl}
              onClick={onClose}
              className="p-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/70 border border-blue-200/70 dark:border-blue-800/50 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-blue-700 dark:text-blue-300 transition active:scale-95"
            >
              <MessageSquare className="w-5 h-5 text-blue-500" />
              <span className="text-xs font-bold">SMS</span>
            </a>

            {/* EMAIL */}
            <a
              href={mailtoUrl}
              onClick={onClose}
              className="p-3 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/70 border border-amber-200/70 dark:border-amber-800/50 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-amber-700 dark:text-amber-300 transition active:scale-95"
            >
              <Mail className="w-5 h-5 text-amber-500" />
              <span className="text-xs font-bold">E-mail</span>
            </a>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {/* COPIER LE TEXTE */}
            <button
              type="button"
              onClick={handleCopyText}
              className="py-2.5 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-300">Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copier le texte</span>
                </>
              )}
            </button>

            {/* AUTRES APPLICATIONS ANDROID */}
            <button
              type="button"
              onClick={handleNativeShare}
              className="py-2.5 px-3 bg-keo-600 hover:bg-keo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-keo-600/20"
            >
              <Share2 className="w-4 h-4" />
              <span>Autres applis...</span>
            </button>
          </div>
        </div>

        {/* APERÇU DU TEXTE FORMATÉ */}
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700">
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">
            Aperçu de la note partagée :
          </div>
          <pre className="p-3 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-150 dark:border-slate-750 text-[11px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-sans max-h-28 overflow-y-auto leading-relaxed">
            {formattedText}
          </pre>
        </div>
      </div>
    </div>
  );
}
