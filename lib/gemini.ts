import { Note, GeminiStructureResult } from '@/types/note';

/**
 * Appel à l'API gratuite Gemini 1.5 Flash ou 2.0 Flash
 */
export async function analyzeTranscriptWithGemini(
  transcript: string,
  apiKey: string
): Promise<GeminiStructureResult> {
  if (!apiKey.trim()) {
    // Mode hors-ligne / fallback intelligent si aucune clé n'est encore configurée
    return fallbackStructure(transcript);
  }

  const prompt = `Tu es l'assistant d'un carnet de notes personnel intelligent nommé "Keo Note".
L'utilisateur vient de dicter un mémo vocal. Voici la transcription brute :
"""
${transcript}
"""

Analyse cette transcription et renvoie STRICTEMENT un objet JSON (sans balises markdown supplémentaires) ayant exactement ce schéma :
{
  "title": "Un titre court et percutant en français (3 à 6 mots maximum)",
  "summary": "Un résumé clair et synthétique en français (1 ou 2 phrases)",
  "cleanContent": "Le texte retranscrit et corrigé avec une ponctuation et des paragraphes soignés",
  "todos": ["Action concrète 1 à faire", "Action concrète 2 à faire"],
  "tags": ["Courses", "Maison", "Travail"]
}

Règles :
- Si la note ne contient pas d'actions précises à faire, laisse le tableau "todos" vide.
- "tags" doit contenir entre 1 et 3 catégories courtes en français (ex: Maison, Famille, Courses, Auto, Travail, Santé, Idée, Finances, Rendez-vous).
- Réponds UNIQUEMENT le JSON valide.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.warn('Gemini API Error, utilisation du fallback:', errData);
      return fallbackStructure(transcript);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return fallbackStructure(transcript);

    const parsed = JSON.parse(rawText);
    return {
      title: parsed.title || 'Mémo vocal',
      summary: parsed.summary || transcript.slice(0, 80) + '...',
      cleanContent: parsed.cleanContent || transcript,
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : ['Mémo'],
    };
  } catch (err) {
    console.warn('Erreur appel Gemini:', err);
    return fallbackStructure(transcript);
  }
}

/**
 * Second Cerveau : Poser une question à l'ensemble de ses notes
 */
export async function querySecondBrain(
  question: string,
  notes: Note[],
  apiKey: string
): Promise<{ answer: string; relatedNoteIds: string[] }> {
  const activeNotes = notes.filter((n) => !n.isArchived);
  if (activeNotes.length === 0) {
    return {
      answer: "Vous n'avez pas encore de notes actives enregistrées.",
      relatedNoteIds: [],
    };
  }

  if (!apiKey.trim()) {
    // Recherche locale par mots clés si pas d'API Gemini
    const qLower = question.toLowerCase();
    const matches = activeNotes.filter(
      (n) =>
        n.title.toLowerCase().includes(qLower) ||
        n.content.toLowerCase().includes(qLower) ||
        n.todos.some((t) => t.text.toLowerCase().includes(qLower)) ||
        n.tags.some((t) => t.toLowerCase().includes(qLower))
    );

    if (matches.length > 0) {
      return {
        answer: `J'ai trouvé ${matches.length} note(s) correspondant à votre recherche :\n` +
          matches.map((m) => `• **${m.title}** : ${m.summary || m.content.slice(0, 100)}`).join('\n\n') +
          `\n\n*(Ajoutez une clé API Gemini gratuite dans les Paramètres pour obtenir des réponses synthétiques en langage naturel !)*`,
        relatedNoteIds: matches.map((m) => m.id),
      };
    }

    return {
      answer: "Aucune note ne semble correspondre directement à ces mots-clés. Ajoutez une clé API Gemini gratuite dans les Paramètres pour une compréhension intelligente de vos notes !",
      relatedNoteIds: [],
    };
  }

  // Préparation du contexte des notes
  const notesContext = activeNotes.map((n, idx) => {
    return `[Note ID: ${n.id} | Titre: "${n.title}" | Tags: ${n.tags.join(', ')}]\nContenu: ${n.content}\nRésumé: ${n.summary || ''}\nTâches: ${n.todos.map((t) => (t.completed ? '[x] ' : '[ ] ') + t.text).join('; ')}\n`;
  }).join('\n---\n');

  const prompt = `Tu es le "Second Cerveau" de l'utilisateur dans l'application Keo Note.
Voici toutes les notes actuelles de l'utilisateur :
${notesContext}

L'utilisateur te pose cette question :
"${question}"

Réponds précisément, poliment et en français en t'appuyant sur ses notes.
Indique clairement quelle note contient l'information.
À la toute fin de ta réponse, sur une nouvelle ligne, écris exactement :
RELATED_IDS: id1, id2 (les identifiants des notes dont tu t'es servi, ou NONE).`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
          },
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Erreur API Gemini: ${res.status}`);
    }

    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extraction des IDs de notes reliées
    let answer = text;
    const relatedNoteIds: string[] = [];
    const match = text.match(/RELATED_IDS:\s*(.+)$/i);
    if (match) {
      answer = text.replace(/RELATED_IDS:\s*(.+)$/i, '').trim();
      const idsRaw = match[1].split(',').map((id) => id.trim());
      idsRaw.forEach((id) => {
        if (id && id !== 'NONE' && activeNotes.some((n) => n.id === id)) {
          relatedNoteIds.push(id);
        }
      });
    }

    return { answer, relatedNoteIds };
  } catch (err: any) {
    return {
      answer: `Impossible d'interroger Gemini pour le moment : ${err.message || 'Erreur réseau'}.`,
      relatedNoteIds: [],
    };
  }
}

/**
 * Fallback local quand l'API n'est pas configurée ou hors ligne
 */
function fallbackStructure(transcript: string): GeminiStructureResult {
  const words = transcript.trim().split(/\s+/);
  const title = words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');

  // Détection basique de to-dos si phrases avec verbes d'action
  const sentences = transcript.split(/[.?!]\s+|\n+/).filter((s) => s.trim().length > 0);
  const todos: string[] = [];
  const actionKeywords = ['penser à', 'acheter', 'rappeler', 'appeler', 'envoyer', 'faire', 'prendre', 'commander', 'payer', 'vérifier'];

  sentences.forEach((sentence) => {
    const sLower = sentence.toLowerCase();
    if (actionKeywords.some((k) => sLower.includes(k))) {
      todos.push(sentence.trim());
    }
  });

  return {
    title: title ? title.charAt(0).toUpperCase() + title.slice(1) : 'Nouveau mémo',
    summary: transcript.slice(0, 100) + (transcript.length > 100 ? '...' : ''),
    cleanContent: transcript,
    todos: todos.slice(0, 5),
    tags: ['Mémo'],
  };
}
