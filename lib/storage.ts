import { Note } from '@/types/note';

const STORAGE_KEY = 'keonote_notes_v1';
const SEEDED_APPS_KEY = 'keonote_seeded_apps_v2';
const API_KEY_STORAGE = 'keonote_gemini_api_key';

export const APP_SHARE_NOTES: Note[] = [
  {
    id: 'share-app-keofamily',
    title: '🏠 Découvre Keo Family — L’application tout-en-un pour organiser la vie de famille !',
    content: `Keo Family regroupe au même endroit tout ce dont le foyer a besoin au quotidien :
• 📅 Agenda familial partagé (avec import/export de rendez-vous .ics et Doctolib)
• 🛒 Liste de courses intelligente classée par rayons + liste de tâches
• 🍽️ Planning des menus de la semaine & carnet de recettes (avec import depuis n'importe quel site)
• 🗂️ Coffre-fort de documents familiaux (pièces d'identité, mutuelle, livret de famille avec alertes d'expiration)
• 💊 Suivi médical et traitements de la famille
• 💬 Messagerie familiale avec sondages intégrés

📲 Télécharger et installer Keo Family (Android APK) :
https://github.com/heyhacene/keofamily/releases/latest/download/KeoFamily.apk

🚀 Comment l'installer et l'utiliser :
1. Clique sur le lien ci-dessus pour télécharger l'application.
2. Ouvre le fichier téléchargé et autorise l'installation si ton téléphone le demande.
3. Au premier lancement, entre simplement ton prénom pour créer ton espace familial, puis ajoute les membres de ton foyer dans l'onglet "Famille" !`,
    summary: 'Lien de téléchargement direct et guide d’installation de Keo Family.',
    todos: [
      { id: 'kf-1', text: 'Télécharger l’APK via le lien cliquable ci-dessus', completed: false },
      { id: 'kf-2', text: 'Installer Keo Family sur son smartphone Android', completed: false },
      { id: 'kf-3', text: 'Entrer son prénom pour créer son espace familial', completed: false },
    ],
    tags: ['Keo Family', 'Partage', 'Applications'],
    type: 'text',
    isPinned: true,
    isArchived: false,
    color: '#f59e0b',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'share-app-keonote',
    title: '🎙️✨ Découvre Keo Note — Le bloc-notes vocal et intelligent propulsé par l’IA !',
    content: `Plus besoin de taper tes notes à la main : parle, et l'intelligence artificielle s'occupe du reste.
• 🎤 Dictée vocale IA : enregistre une note vocale, Keo Note la retranscrit et la structure automatiquement (titre, résumé, points clés ou liste de courses/tâches à cocher).
• 📝 Notes texte, listes d'actions interactives et second cerveau IA.
• 📌 Organisation par étiquettes, épingles et recherche intelligente.
• 📤 Partage en 1 clic par WhatsApp, SMS, Mail ou directement vers Keo Family.

📲 Télécharger et installer Keo Note (Android APK) :
https://github.com/heyhacene/keonote/releases/latest/download/KeoNote.apk

🚀 Comment l'installer et l'utiliser :
1. Clique sur le lien ci-dessus pour télécharger et installer l'application sur Android.
2. Pour activer l'IA : va dans les Paramètres (icône engrenage en haut à droite) et colle ta clé API gratuite Google Gemini (disponible gratuitement sur https://aistudio.google.com).
3. Appuie sur le bouton micro en bas de l'écran, dicte tes idées ou ta liste de courses, et laisse l'IA organiser ta note !`,
    summary: 'Lien de téléchargement direct et guide d’utilisation de Keo Note.',
    todos: [
      { id: 'kn-1', text: 'Télécharger l’APK Keo Note via le lien ci-dessus', completed: false },
      { id: 'kn-2', text: 'Configurer sa clé API Gemini gratuite dans les Paramètres', completed: false },
      { id: 'kn-3', text: 'Enregistrer son premier mémo vocal IA', completed: false },
    ],
    tags: ['Keo Note', 'Partage', 'Applications'],
    type: 'text',
    isPinned: true,
    isArchived: false,
    color: '#8b5cf6',
    createdAt: Date.now() - 1000,
    updatedAt: Date.now() - 1000,
  },
  {
    id: 'share-app-keopass',
    title: '🔐 Découvre KeoPass — Ton coffre-fort de mots de passe sécurisé et 100 % privé !',
    content: `Fini les mots de passe oubliés ou notés sur des bouts de papier :
• 🛡️ Chiffrement intégral : tous tes identifiants, mots de passe, cartes bancaires et notes secrètes sont chiffrés avec ton mot de passe maître.
• 👆 Déverrouillage rapide par empreinte digitale / biométrie.
• ⚡ Générateur de mots de passe ultra-robustes intégré, codes 2FA (TOTP) et audit de sécurité.
• 🔄 Remplissage automatique Android et partage sécurisé par lien éphémère.

📲 Télécharger et installer KeoPass (Android APK) :
https://github.com/heyhacene/keopass/releases/latest/download/KeoPass.apk

🚀 Comment l'installer et l'utiliser :
1. Clique sur le lien ci-dessus pour télécharger et installer l'application sur Android.
2. Lors de la première ouverture, choisis ton mot de passe maître (la seule clé qui déverrouille ton coffre) et active l'empreinte digitale.
3. Appuie sur "+" pour enregistrer tes comptes, cartes ou notes secrètes et copie tes identifiants en un geste !`,
    summary: 'Lien de téléchargement direct et guide d’utilisation de KeoPass.',
    todos: [
      { id: 'kp-1', text: 'Télécharger l’APK KeoPass via le lien ci-dessus', completed: false },
      { id: 'kp-2', text: 'Créer son coffre-fort avec un mot de passe maître', completed: false },
      { id: 'kp-3', text: 'Activer le déverrouillage par empreinte digitale', completed: false },
    ],
    tags: ['KeoPass', 'Partage', 'Applications'],
    type: 'text',
    isPinned: true,
    isArchived: false,
    color: '#10b981',
    createdAt: Date.now() - 2000,
    updatedAt: Date.now() - 2000,
  },
];

// Notes de démonstration pour que l'app soit immédiatement vivante
const INITIAL_NOTES: Note[] = [
  ...APP_SHARE_NOTES,
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
    isPinned: false,
    isArchived: false,
    color: '#8b5cf6',
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
  },
];

export function loadNotes(): Note[] {
  if (typeof window === 'undefined') return INITIAL_NOTES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_NOTES));
      localStorage.setItem(SEEDED_APPS_KEY, '1');
      return INITIAL_NOTES;
    }
    let parsed: Note[] = JSON.parse(raw);
    if (!localStorage.getItem(SEEDED_APPS_KEY)) {
      const existingIds = new Set(parsed.map((n) => n.id));
      const toPrepend = APP_SHARE_NOTES.filter((n) => !existingIds.has(n.id));
      parsed = [...toPrepend, ...parsed];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      localStorage.setItem(SEEDED_APPS_KEY, '1');
    }
    return parsed;
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
