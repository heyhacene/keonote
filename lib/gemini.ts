import { Note, GeminiStructureResult } from '@/types/note';

/**
 * Modèles candidats ordonnés par priorité (les plus récents en premier)
 */
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
];

let cachedWorkingModel: string | null = null;

/**
 * Découvre ou sélectionne le modèle Gemini Flash actif pour cette clé API
 */
export async function getActiveGeminiModel(apiKey: string): Promise<string> {
  if (cachedWorkingModel) return cachedWorkingModel;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.models)) {
        const availableNames: string[] = data.models
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => m.name.replace(/^models\//, ''));

        for (const candidate of CANDIDATE_MODELS) {
          const match = availableNames.find((n) => n === candidate || n.startsWith(candidate));
          if (match) {
            cachedWorkingModel = match;
            return match;
          }
        }

        const anyFlash = availableNames.find((n) => n.includes('flash'));
        if (anyFlash) {
          cachedWorkingModel = anyFlash;
          return anyFlash;
        }

        if (availableNames.length > 0) {
          cachedWorkingModel = availableNames[0];
          return availableNames[0];
        }
      }
    }
  } catch (e) {
    console.warn('Impossible de lister les modèles, utilisation de la liste de secours');
  }

  return 'gemini-2.5-flash';
}

/**
 * Exécute un appel à Gemini avec basculement automatique sur les modèles compatibles
 */
export async function callGeminiApi(
  apiKey: string,
  prompt: string,
  responseJson: boolean = false
): Promise<{ text: string; modelUsed: string; error?: string }> {
  const primaryModel = await getActiveGeminiModel(apiKey);
  const modelsToTry = [
    primaryModel,
    ...CANDIDATE_MODELS.filter((m) => m !== primaryModel),
  ];

  let lastError = '';

  for (const model of modelsToTry) {
    try {
      const bodyPayload: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
        },
      };

      if (responseJson) {
        bodyPayload.generationConfig.responseMimeType = 'application/json';
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          cachedWorkingModel = model;
          return { text, modelUsed: model };
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        lastError = errJson.error?.message || `Erreur API (${res.status})`;
        // Si le modèle n'existe pas (404), on essaye le suivant dans la liste
        if (res.status === 404) {
          continue;
        }
        return { text: '', modelUsed: model, error: lastError };
      }
    } catch (err: any) {
      lastError = err.message || 'Erreur réseau';
    }
  }

  return { text: '', modelUsed: '', error: lastError || 'Aucun modèle compatible trouvé.' };
}

/**
 * Teste la validité de la clé API Gemini
 */
export async function testGeminiApiKey(
  apiKey: string
): Promise<{ success: boolean; message: string; modelUsed?: string }> {
  if (!apiKey.trim()) {
    return { success: false, message: 'Veuillez renseigner une clé API avant de tester.' };
  }

  const { text, modelUsed, error } = await callGeminiApi(
    apiKey,
    'Réponds exactement "OK" en un seul mot.'
  );

  if (text) {
    return {
      success: true,
      message: `Succès : Clé Gemini valide ! (Modèle actif : ${modelUsed}) 🎉`,
      modelUsed,
    };
  }

  return {
    success: false,
    message: error || 'Impossible de joindre Gemini avec cette clé.',
  };
}

/**
 * Analyse et structure une transcription avec Gemini
 */
export async function analyzeTranscriptWithGemini(
  transcript: string,
  apiKey: string
): Promise<GeminiStructureResult> {
  if (!apiKey.trim()) {
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
    const { text, error } = await callGeminiApi(apiKey, prompt, true);
    if (!text || error) {
      console.warn('Gemini call failed, fallback used:', error);
      return fallbackStructure(transcript);
    }

    const parsed = JSON.parse(text);
    return {
      title: parsed.title || 'Mémo vocal',
      summary: parsed.summary || transcript.slice(0, 80) + '...',
      cleanContent: parsed.cleanContent || transcript,
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : ['Mémo'],
    };
  } catch (err) {
    console.warn('Erreur JSON ou appel Gemini:', err);
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
        answer:
          `J'ai trouvé ${matches.length} note(s) correspondant à votre recherche :\n` +
          matches.map((m) => `• **${m.title}** : ${m.summary || m.content.slice(0, 100)}`).join('\n\n') +
          `\n\n*(Ajoutez une clé API Gemini gratuite dans les Paramètres pour obtenir des réponses rédigées en langage naturel !)*`,
        relatedNoteIds: matches.map((m) => m.id),
      };
    }

    return {
      answer:
        "Aucune note ne semble correspondre directement à ces mots-clés. Ajoutez une clé API Gemini gratuite dans les Paramètres pour une compréhension intelligente de vos notes !",
      relatedNoteIds: [],
    };
  }

  const notesContext = activeNotes
    .map((n) => {
      return `[Note ID: ${n.id} | Titre: "${n.title}" | Tags: ${n.tags.join(', ')}]\nContenu: ${n.content}\nRésumé: ${n.summary || ''}\nTâches: ${n.todos.map((t) => (t.completed ? '[x] ' : '[ ] ') + t.text).join('; ')}\n`;
    })
    .join('\n---\n');

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
    const { text, error } = await callGeminiApi(apiKey, prompt, false);
    if (!text || error) {
      return {
        answer: `Impossible d'interroger Gemini pour le moment : ${error || 'Erreur réseau'}.`,
        relatedNoteIds: [],
      };
    }

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

  const sentences = transcript.split(/[.?!]\s+|\n+/).filter((s) => s.trim().length > 0);
  const todos: string[] = [];
  const actionKeywords = [
    'penser à',
    'acheter',
    'rappeler',
    'appeler',
    'envoyer',
    'faire',
    'prendre',
    'commander',
    'payer',
    'vérifier',
  ];

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
