import { Note } from '@/types/note';

const STORAGE_KEY = 'keonote_notes_v1';
const API_KEY_STORAGE = 'keonote_gemini_api_key';

// Notes de démonstration pour que l'app soit immédiatement vivante
const INITIAL_NOTES: Note[] = [
  {
    id: 'demo-1',
    title: 'Bienvenue dans Keo Note !',
    content: 'Keo Note est votre carnet de notes et mémos vocaux intelligent.\n\nVous pouvez enregistrer vos pensées à la voix, l’IA Gemini se charge de créer un titre, un résumé et des cases à cocher automatiquement.',
    summary: 'Présentation de Keo Note et de son fonctionnement vocal + IA.',
    todos: [
      { id: 't1', text: 'Enregistrer votre premier mémo vocal avec le micro', completed: false },
      { id: 't2', text: 'Ajouter votre clé API Gemini gratuite dans les Paramètres', completed: false },
      { id: 't3', text: 'Poser une question à votre Second Cerveau', completed: false },
    ],
    tags: ['Bienvenue', 'Astuces'],
    type: 'text',
    isPinned: true,
    isArchived: false,
    color: '#8b5cf6',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'demo-2',
    title: 'Mémo vocal : Révision voiture & courses',
    content: 'Penser à vérifier la pression des pneus avant de partir en week-end et acheter de l’huile moteur 5W30 chez le garagiste. Passer prendre du pain et du café.',
    summary: 'Points de contrôle automobile et petites courses à faire.',
    todos: [
      { id: 't4', text: 'Vérifier la pression des pneus', completed: false },
      { id: 't5', text: 'Acheter de l’huile moteur 5W30', completed: false },
      { id: 't6', text: 'Passer prendre du pain et du café', completed: true },
    ],
    tags: ['Auto', 'Courses'],
    type: 'voice',
    audioDurationSec: 12,
    isPinned: false,
    isArchived: false,
    color: '#f59e0b',
    createdAt: Date.now() - 3600000 * 2,
    updatedAt: Date.now() - 3600000 * 2,
  },
];

export function loadNotes(): Note[] {
  if (typeof window === 'undefined') return INITIAL_NOTES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_NOTES));
      return INITIAL_NOTES;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erreur chargement notes:', err);
    return INITIAL_NOTES;
  }
}

export function saveNotes(notes: Note[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (err) {
    console.error('Erreur sauvegarde notes:', err);
  }
}

export function getGeminiApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

export function saveGeminiApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (!key.trim()) {
    localStorage.removeItem(API_KEY_STORAGE);
  } else {
    localStorage.setItem(API_KEY_STORAGE, key.trim());
  }
}
