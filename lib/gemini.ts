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
 * Priorise les modèles : favorise les modèles rapides sans mode de réflexion (thinking)
 */
function prioritizeModels(models: string[]): string[] {
  return [...models].sort((a, b) => {
    const aThinking = a.includes('thinking') ? 1 : 0;
    const bThinking = b.includes('thinking') ? 1 : 0;
    if (aThinking !== bThinking) return aThinking - bThinking;

    const getScore = (m: string) => {
      if (m === 'gemini-2.0-flash') return 100;
      if (m === 'gemini-1.5-flash') return 90;
      if (m.includes('2.5-flash')) return 80;
      if (m.includes('2.0-flash')) return 70;
      if (m.includes('1.5-flash')) return 60;
      if (m.includes('1.5-pro')) return 50;
      if (m.includes('2.0-pro')) return 40;
      return 10;
    };
    return getScore(b) - getScore(a);
  });
}

export type GeminiContentPart =
  | { text: string; thought?: boolean }
  | { inlineData: { mimeType: string; data: string } };

/**
 * Exécute un appel direct generateContent sur un endpoint spécifique
 */
async function tryGenerateContent(
  apiKey: string,
  endpoint: WorkingEndpoint,
  promptOrParts: string | GeminiContentPart[],
  responseJson: boolean = false
): Promise<{ text: string; error?: string; status?: number }> {
  try {
    const parts =
      typeof promptOrParts === 'string'
        ? [{ text: promptOrParts }]
        : promptOrParts;

    const bodyPayload: any = {
      contents: [{ parts }],
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
      const candidate = data?.candidates?.[0];
      const resParts: any[] = candidate?.content?.parts || [];
      // Filtrer les parties de réflexion interne (thought: true)
      const nonThoughtParts = resParts.filter((p: any) => !p.thought);
      const usefulParts = nonThoughtParts.length > 0 ? nonThoughtParts : resParts;
      const text = usefulParts
        .map((p: any) => (typeof p.text === 'string' ? p.text : ''))
        .filter(Boolean)
        .join('\n')
        .trim();
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
    const prioritized = prioritizeModels(allDiscovered);
    diagnostics.push(`Modèles découverts sur votre compte : ${prioritized.slice(0, 4).join(', ')}`);

    // Tenter avec les modèles dans l'ordre de priorité (flash sans thinking d'abord)
    for (const m of prioritized) {
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
          availableModels: prioritized,
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
  promptOrParts: string | GeminiContentPart[],
  responseJson: boolean = false
): Promise<{ text: string; error?: string }> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return { text: '', error: 'Clé absente' };

  // 1. Essayer d'abord le dernier endpoint fonctionnel mémorisé
  const saved = getSavedWorkingEndpoint();
  if (saved) {
    const res = await tryGenerateContent(cleanKey, saved, promptOrParts, responseJson);
    if (res.text) return { text: res.text };

    // Tentative de rattrapage après 800ms
    await new Promise((r) => setTimeout(r, 800));
    const retry = await tryGenerateContent(cleanKey, saved, promptOrParts, responseJson);
    if (retry.text) return { text: retry.text };
  }

  // 2. Parcourir les candidats en secours
  for (const cand of CANDIDATE_ENDPOINTS) {
    const res = await tryGenerateContent(cleanKey, cand, promptOrParts, responseJson);
    if (res.text) {
      saveWorkingEndpoint(cand);
      return { text: res.text };
    }
  }

  return { text: '', error: 'Impossible de contacter l’API Gemini avec cette clé.' };
}

/**
 * Analyse et structure un mémo vocal avec Gemini (écoute directe de l'audio si présent)
 */
export async function analyzeVoiceMemoWithGemini(
  audioDataUrl: string | undefined,
  liveTranscript: string,
  apiKey: string
): Promise<GeminiStructureResult> {
  if (!apiKey.trim()) {
    return fallbackStructure(liveTranscript || 'Mémo vocal enregistré');
  }

  let audioPart: GeminiContentPart | null = null;
  if (audioDataUrl && audioDataUrl.includes('base64,')) {
    const [header, base64Data] = audioDataUrl.split(';base64,');
    let mime = header.replace(/^data:/, '').split(';')[0] || 'audio/webm';
    if (mime.includes('webm')) mime = 'audio/webm';
    else if (mime.includes('mp4')) mime = 'audio/mp4';
    else if (mime.includes('ogg')) mime = 'audio/ogg';
    else if (mime.includes('wav')) mime = 'audio/wav';
    else if (mime.includes('aac')) mime = 'audio/aac';

    if (base64Data && base64Data.length > 50) {
      audioPart = {
        inlineData: {
          mimeType: mime,
          data: base64Data,
        },
      };
    }
  }

  const promptText = `Tu es l'assistant d'un carnet de notes personnel intelligent nommé "Keo Note".
L'utilisateur vient d'enregistrer un mémo vocal.
${audioPart ? "Écoute attentivement l'enregistrement audio vocal ci-joint en français et transcris avec exactitude tout ce que l'utilisateur a prononcé." : ""}
${liveTranscript && liveTranscript.trim() ? `Transcription de référence : """${liveTranscript}"""` : ""}

Analyse et structure ce mémo vocal en renvoyant STRICTEMENT un objet JSON (sans balises markdown supplémentaires) ayant exactement ce schéma :
{
  "title": "Un titre court et percutant en français (3 à 6 mots maximum)",
  "summary": "Un résumé clair et synthétique en français (1 ou 2 phrases)",
  "cleanContent": "L'intégralité du texte retranscrit et corrigé avec une ponctuation soignée",
  "todos": ["Action concrète 1 à faire", "Action concrète 2 à faire"],
  "tags": ["Courses", "Maison", "Travail"]
}

Règles impératives :
- Transcris fidèlement la voix de l'utilisateur dans "cleanContent". S'il n'y a absolument aucune voix audible ou seulement du silence, indique "Mémo vocal sans parole détectée".
- Si le mémo contient des actions ou des tâches à faire, liste-les dans le tableau "todos". Sinon, laisse le tableau "todos" vide [].
- "tags" doit contenir entre 1 et 3 catégories courtes en français (ex: Maison, Famille, Courses, Auto, Travail, Santé, Idée, Finances, Rendez-vous).
- Réponds UNIQUEMENT le JSON valide.`;

  const parts: GeminiContentPart[] = [];
  if (audioPart) {
    parts.push(audioPart);
  }
  parts.push({ text: promptText });

  try {
    const { text, error } = await callGeminiApi(apiKey, parts, true);
    if (!text || error) {
      console.warn('Gemini audio call failed:', error);
      return fallbackStructure(liveTranscript || 'Mémo vocal enregistré');
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    return {
      title: parsed.title || 'Mémo vocal',
      summary: parsed.summary || 'Mémo vocal enregistré',
      cleanContent: parsed.cleanContent || liveTranscript || 'Mémo vocal enregistré',
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
      tags: Array.isArray(parsed.tags) && parsed.tags.length > 0 ? parsed.tags : ['Mémo'],
    };
  } catch (err) {
    console.warn('Erreur JSON ou appel Gemini audio:', err);
    return fallbackStructure(liveTranscript || 'Mémo vocal enregistré');
  }
}

/**
 * Analyse et structure une transcription avec Gemini (rétrocompatibilité)
 */
export async function analyzeTranscriptWithGemini(
  transcript: string,
  apiKey: string
): Promise<GeminiStructureResult> {
  return analyzeVoiceMemoWithGemini(undefined, transcript, apiKey);
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

Question posée par l'utilisateur :
"${question}"

DIRECTIVES IMPORTANTES DE FORMAT ET DE TON :
1. Réponds directement à l'utilisateur de manière chaleureuse, soignée, précise et polie en français.
2. Si la réponse liste des articles, des courses, des tâches ou des idées, utilise une belle liste à puces aérée avec des tirets (-) ou des puces (•).
3. Mentionne naturellement le titre de la ou des notes sources (ex: "D'après votre note '... '").
4. RÈGLE CRUCIALE : Ne produis AUCUN plan préliminaire, AUCUN brouillon, AUCUN monologue de réflexion, AUCUNE auto-évaluation. Tu ne dois renvoyer QUE la réponse finale.

Réponds STRICTEMENT sous forme d'un objet JSON valide ayant cette structure :
{
  "answer": "Ta réponse complète, bienveillante et mise en forme pour l'utilisateur en français",
  "relatedNoteIds": ["id1", "id2"]
}`;

  try {
    const { text, error } = await callGeminiApi(apiKey, prompt, true);
    if (!text || error) {
      return {
        answer: "Impossible d'interroger le Second Cerveau pour le moment. Réessayez dans quelques instants.",
        relatedNoteIds: [],
      };
    }

    return cleanSecondBrainResponse(text, activeNotes);
  } catch (err: any) {
    return {
      answer: "Impossible d'interroger le Second Cerveau pour le moment. Réessayez dans quelques instants.",
      relatedNoteIds: [],
    };
  }
}

/**
 * Nettoie et extrait la réponse propre du Second Cerveau
 */
function cleanSecondBrainResponse(
  rawText: string,
  activeNotes: Note[]
): { answer: string; relatedNoteIds: string[] } {
  let cleaned = rawText.trim();
  const relatedNoteIds: string[] = [];

  // 1. Tenter d'extraire et parser le JSON
  try {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.answer === 'string' && parsed.answer.trim()) {
        const ids = Array.isArray(parsed.relatedNoteIds) ? parsed.relatedNoteIds : [];
        ids.forEach((id: any) => {
          if (typeof id === 'string' && activeNotes.some((n) => n.id === id)) {
            if (!relatedNoteIds.includes(id)) relatedNoteIds.push(id);
          }
        });
        return { answer: parsed.answer.trim(), relatedNoteIds };
      }
    }
  } catch (_) {}

  // 2. Si le modèle a produit une section de "Refining" ou "Réponse finale" (modèle thinking)
  const refineMatch = cleaned.match(
    /(?:Refining[^\n:]*|Version finale|R[ée]ponse finale)\s*:\s*([\s\S]+?)(?=\n\s*(?:RELATED_IDS|\* Precise|\* Polite|\* French|$))/i
  );
  if (refineMatch && refineMatch[1]?.trim().length > 10) {
    cleaned = refineMatch[1].trim();
  }

  // 3. Extraction des RELATED_IDS si présents
  const idMatch = cleaned.match(/RELATED_IDS:\s*(.+)$/im);
  if (idMatch) {
    cleaned = cleaned.replace(/RELATED_IDS:\s*(.+)$/im, '').trim();
    const idsRaw = idMatch[1].split(',').map((id) => id.trim());
    idsRaw.forEach((id) => {
      if (id && id !== 'NONE' && activeNotes.some((n) => n.id === id)) {
        if (!relatedNoteIds.includes(id)) relatedNoteIds.push(id);
      }
    });
  }

  // 4. Nettoyage des métadonnées, brouillons ou auto-évaluations
  cleaned = cleaned
    .replace(/^\s*\*\s*(?:Role|Input Data|Constraints|User Question|Relevance|Source|Items to buy|Precise\?|Polite\?|French\?|Indicate note\?|Format RELATED_IDS\?)[^\n]*\n?/gim, '')
    .replace(/^\s*\*\s*Draft\s*\d+[^\n]*\n?/gim, '')
    .replace(/^\s*-\s*(?:Role|Input Data|Constraints|User Question)[^\n]*\n?/gim, '')
    .trim();

  // 5. Fallback si le texte nettoyé est vide
  if (!cleaned) {
    cleaned = rawText.trim();
  }

  return { answer: cleaned, relatedNoteIds };
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
