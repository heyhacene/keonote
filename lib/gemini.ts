import { Note, GeminiStructureResult } from '@/types/note';

interface WorkingEndpoint {
  apiVersion: string;
  model: string;
}

const WORKING_ENDPOINT_KEY = 'keonote_working_gemini_endpoint';

const CANDIDATE_ENDPOINTS: WorkingEndpoint[] = [
  { apiVersion: 'v1', model: 'gemini-1.5-flash' },
  { apiVersion: 'v1beta', model: 'gemini-2.0-flash' },
  { apiVersion: 'v1beta', model: 'gemini-2.5-flash' },
  { apiVersion: 'v1', model: 'gemini-2.0-flash' },
  { apiVersion: 'v1beta', model: 'gemini-2.0-flash-exp' },
  { apiVersion: 'v1beta', model: 'gemini-1.5-flash' },
  { apiVersion: 'v1beta', model: 'gemini-1.5-flash-latest' },
  { apiVersion: 'v1', model: 'gemini-1.5-pro' },
  { apiVersion: 'v1beta', model: 'gemini-1.5-pro' },
];

export interface GeminiTestResult {
  success: boolean;
  message: string;
  modelUsed?: string;
  apiVersionUsed?: string;
  availableModels?: string[];
  diagnostics?: string[];
}

function getSavedWorkingEndpoint(): WorkingEndpoint | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(WORKING_ENDPOINT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveWorkingEndpoint(endpoint: WorkingEndpoint) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WORKING_ENDPOINT_KEY, JSON.stringify(endpoint));
  } catch (e) {}
}

/**
 * Découvre dynamiquement les modèles supportés par la clé API auprès de Google
 */
async function discoverModelsFromGoogle(
  apiKey: string,
  version: 'v1' | 'v1beta'
): Promise<string[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/${version}/models?key=${apiKey.trim()}`,
      {
        headers: {
          'x-goog-api-key': apiKey.trim(),
        },
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.models)) {
        return data.models
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => m.name.replace(/^models\//, ''));
      }
    }
  } catch (e) {
    console.warn(`Could not list models on ${version}:`, e);
  }
  return [];
}

/**
 * Exécute un appel direct generateContent sur un endpoint spécifique
 */
async function tryGenerateContent(
  apiKey: string,
  endpoint: WorkingEndpoint,
  prompt: string,
  responseJson: boolean = false
): Promise<{ text: string; error?: string; status?: number }> {
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

    const url = `https://generativelanguage.googleapis.com/${endpoint.apiVersion}/models/${endpoint.model}:generateContent?key=${apiKey.trim()}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey.trim(),
      },
      body: JSON.stringify(bodyPayload),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return { text };
      }
    }

    const errJson = await res.json().catch(() => ({}));
    const errMsg = errJson.error?.message || `Erreur API (${res.status})`;
    return { text: '', error: errMsg, status: res.status };
  } catch (err: any) {
    return { text: '', error: err.message || 'Erreur réseau' };
  }
}

/**
 * Diagnostic complet et test de la clé Gemini
 */
export async function testGeminiApiKey(apiKey: string): Promise<GeminiTestResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { success: false, message: 'Veuillez renseigner une clé API avant de tester.' };
  }

  const diagnostics: string[] = [];

  // 1. Tenter la découverte de modèles sur v1beta et v1
  const modelsBeta = await discoverModelsFromGoogle(cleanKey, 'v1beta');
  const modelsV1 = await discoverModelsFromGoogle(cleanKey, 'v1');
  const allDiscovered = Array.from(new Set([...modelsBeta, ...modelsV1]));

  if (allDiscovered.length > 0) {
    diagnostics.push(`Modèles découverts sur votre compte : ${allDiscovered.slice(0, 4).join(', ')}`);

    // Tenter avec le premier modèle découvert
    for (const m of allDiscovered) {
      const ver = modelsBeta.includes(m) ? 'v1beta' : 'v1';
      const testAttempt = await tryGenerateContent(cleanKey, { apiVersion: ver, model: m }, 'Réponds "OK"');
      if (testAttempt.text) {
        const ep = { apiVersion: ver, model: m };
        saveWorkingEndpoint(ep);
        return {
          success: true,
          message: `Succès : Clé validée avec le modèle ${m} (${ver}) ! 🎉`,
          modelUsed: m,
          apiVersionUsed: ver,
          availableModels: allDiscovered,
          diagnostics,
        };
      }
    }
  }

  // 2. Tester les combinaisons candidates
  for (const cand of CANDIDATE_ENDPOINTS) {
    const res = await tryGenerateContent(cleanKey, cand, 'Réponds "OK"');
    if (res.text) {
      saveWorkingEndpoint(cand);
      return {
        success: true,
        message: `Succès : Clé validée avec ${cand.model} (API ${cand.apiVersion}) ! 🎉`,
        modelUsed: cand.model,
        apiVersionUsed: cand.apiVersion,
        diagnostics,
      };
    } else {
      diagnostics.push(`${cand.apiVersion}/${cand.model} : ${res.error || 'échec'}`);
    }
  }

  const firstError = diagnostics[0] || 'Aucun modèle compatible trouvé.';
  return {
    success: false,
    message: `Échec du test. ${firstError}`,
    diagnostics,
  };
}

/**
 * Exécute un appel à Gemini avec le meilleur endpoint validé
 */
export async function callGeminiApi(
  apiKey: string,
  prompt: string,
  responseJson: boolean = false
): Promise<{ text: string; error?: string }> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return { text: '', error: 'Clé absente' };

  // 1. Essayer d'abord le dernier endpoint fonctionnel mémorisé
  const saved = getSavedWorkingEndpoint();
  if (saved) {
    const res = await tryGenerateContent(cleanKey, saved, prompt, responseJson);
    if (res.text) return { text: res.text };
  }

  // 2. Parcourir les candidats en secours
  for (const cand of CANDIDATE_ENDPOINTS) {
    const res = await tryGenerateContent(cleanKey, cand, prompt, responseJson);
    if (res.text) {
      saveWorkingEndpoint(cand);
      return { text: res.text };
    }
  }

  return { text: '', error: 'Impossible de contacter l’API Gemini avec cette clé.' };
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
