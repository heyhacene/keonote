import { Note, GeminiStructureResult } from '@/types/note';

interface WorkingEndpoint {
  apiVersion: string;
  model: string;
}

const WORKING_ENDPOINT_KEY = 'keonote_working_gemini_endpoint';

const CANDIDATE_ENDPOINTS: WorkingEndpoint[] = [
  { apiVersion: 'v1beta', model: 'gemini-2.5-flash' },
  { apiVersion: 'v1beta', model: 'gemini-2.0-flash' },
  { apiVersion: 'v1', model: 'gemini-2.5-flash' },
  { apiVersion: 'v1', model: 'gemini-2.0-flash' },
  { apiVersion: 'v1beta', model: 'gemini-2.5-flash-lite' },
  { apiVersion: 'v1beta', model: 'gemini-2.0-flash-lite' },
  { apiVersion: 'v1beta', model: 'gemini-2.5-pro' },
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
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Ignorer les anciens modèles 1.5 retirés par Google
    if (parsed?.model?.includes('1.5')) return null;
    return parsed;
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
          .filter(
            (m: any) =>
              m.supportedGenerationMethods?.includes('generateContent') &&
              !m.name.includes('1.5') &&
              !m.name.includes('vision') &&
              !m.name.includes('embedding') &&
              !m.name.includes('imagen') &&
              !m.name.includes('tts') &&
              !m.name.includes('aqa')
          )
          .map((m: any) => m.name.replace(/^models\//, ''));
      }
    }
  } catch (e) {
    console.warn(`Could not list models on ${version}:`, e);
  }
  return [];
}

/**
 * Priorise les modèles : favorise gemini-2.5-flash et gemini-2.0-flash
 */
function prioritizeModels(models: string[]): string[] {
  return [...models].sort((a, b) => {
    const aThinking = a.includes('thinking') ? 1 : 0;
    const bThinking = b.includes('thinking') ? 1 : 0;
    if (aThinking !== bThinking) return aThinking - bThinking;

    const getScore = (m: string) => {
      if (m === 'gemini-2.5-flash') return 110;
      if (m === 'gemini-2.0-flash') return 100;
      if (m.startsWith('gemini-2.5-flash')) return 95;
      if (m.startsWith('gemini-2.0-flash')) return 90;
      if (m.includes('2.5-pro')) return 80;
      if (m.includes('flash')) return 70;
      if (m.includes('pro')) return 50;
      return 10;
    };
    return getScore(b) - getScore(a);
  });
}

export type GeminiContentPart =
  | { text: string; thought?: boolean }
  | { inlineData: { mimeType: string; data: string } };

/**
 * Convertit n'importe quel DataURL audio (webm/opus, mp4, etc.) en WAV PCM 16-bit 16kHz Mono
 * Universellement accepté par tous les modèles Gemini (v1 et v1beta) sans erreur de codec !
 */
async function convertAudioDataUrlToWavBase64(
  audioDataUrl: string
): Promise<{ mimeType: string; data: string } | null> {
  if (typeof window === 'undefined') return null;
  try {
    const [, base64Raw] = audioDataUrl.split('base64,');
    if (!base64Raw) return null;
    const cleanB64 = base64Raw.replace(/\s/g, '');
    const binaryStr = window.atob(cleanB64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;

    const tempCtx = new AudioCtx();
    const audioBuffer = await tempCtx.decodeAudioData(bytes.buffer.slice(0));
    try {
      await tempCtx.close();
    } catch (_) {}

    // Rééchantillonnage en 16000 Hz Mono (format léger et idéal pour Gemini)
    const targetSampleRate = 16000;
    const targetLength = Math.max(1, Math.ceil(audioBuffer.duration * targetSampleRate));
    const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    const renderedBuffer = await offlineCtx.startRendering();

    const channelData = renderedBuffer.getChannelData(0);
    const numSamples = channelData.length;
    const wavBuffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(wavBuffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // PCM format = 1
    view.setUint16(22, 1, true); // Mono = 1 channel
    view.setUint32(24, targetSampleRate, true);
    view.setUint32(28, targetSampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // 16-bit
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    const wavBytes = new Uint8Array(wavBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < wavBytes.length; i += chunkSize) {
      const sub = wavBytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(sub));
    }

    return {
      mimeType: 'audio/wav',
      data: window.btoa(binary),
    };
  } catch (err) {
    console.warn('Conversion WAV échouée, utilisation du flux audio brut :', err);
    return null;
  }
}

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

    if (responseJson && endpoint.apiVersion === 'v1beta') {
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

    // Tenter avec les modèles dans l'ordre de priorité
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
  if (!cleanKey) return { text: '', error: 'Clé API Gemini absente. Ajoutez-la dans Paramètres ⚙️.' };

  let primaryError = '';

  // Helper qui tente avec responseJson puis sans responseJson si l'endpoint rejette responseMimeType
  const tryEndpointWithFallback = async (ep: WorkingEndpoint) => {
    const res = await tryGenerateContent(cleanKey, ep, promptOrParts, responseJson);
    if (res.text) return res;
    if (responseJson) {
      const resPlain = await tryGenerateContent(cleanKey, ep, promptOrParts, false);
      if (resPlain.text) return resPlain;
      return resPlain;
    }
    return res;
  };

  // 1. Essayer d'abord le dernier endpoint fonctionnel mémorisé
  const saved = getSavedWorkingEndpoint();
  if (saved) {
    const res = await tryEndpointWithFallback(saved);
    if (res.text) return { text: res.text };
    if (res.error && res.status !== 404) {
      primaryError = `${saved.model}: ${res.error}`;
    }

    // Tentative de rattrapage après 500ms
    await new Promise((r) => setTimeout(r, 500));
    const retry = await tryEndpointWithFallback(saved);
    if (retry.text) return { text: retry.text };
  }

  // 2. Découvrir dynamiquement les modèles du compte
  const modelsBeta = await discoverModelsFromGoogle(cleanKey, 'v1beta');
  const modelsV1 = await discoverModelsFromGoogle(cleanKey, 'v1');
  const allDiscovered = prioritizeModels(Array.from(new Set([...modelsBeta, ...modelsV1])));

  const dynamicEndpoints: WorkingEndpoint[] = allDiscovered.slice(0, 5).map((m) => ({
    apiVersion: modelsBeta.includes(m) ? 'v1beta' : 'v1',
    model: m,
  }));

  const allCandidates = [...dynamicEndpoints, ...CANDIDATE_ENDPOINTS];
  const seen = new Set<string>();

  for (const cand of allCandidates) {
    const key = `${cand.apiVersion}/${cand.model}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const res = await tryEndpointWithFallback(cand);
    if (res.text) {
      saveWorkingEndpoint(cand);
      return { text: res.text };
    }
    // Mémoriser en priorité une vraie erreur (ex: 400/429) plutôt qu'un 404 de modèle non trouvé
    if (res.error && (!primaryError || res.status !== 404)) {
      primaryError = `${cand.model}: ${res.error}`;
    }
  }

  return {
    text: '',
    error: primaryError || 'Impossible de contacter l’API Gemini avec cette clé.',
  };
}

/**
 * Nettoie une chaîne JSON potentiellement entourée de balises markdown ```json ... ```
 */
function parseGeminiJson(rawText: string): any {
  const stripped = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(stripped);
  } catch (_) {
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Réponse IA non structurée');
  }
}

/**
 * Analyse et structure un mémo vocal avec Gemini (écoute directe de l'audio WAV + transcription)
 */
export async function analyzeVoiceMemoWithGemini(
  audioDataUrl: string | undefined,
  liveTranscript: string,
  apiKey: string
): Promise<GeminiStructureResult> {
  if (!apiKey.trim()) {
    if (liveTranscript && liveTranscript.trim().length > 0) {
      return fallbackStructure(liveTranscript);
    }
    throw new Error(
      'Clé API Gemini non configurée. Ouvrez les Paramètres (⚙️) en haut à droite pour enregistrer votre clé API Gemini.'
    );
  }

  let audioPart: GeminiContentPart | null = null;
  if (audioDataUrl && audioDataUrl.includes('base64,')) {
    // 1. Convertir d'abord en WAV PCM 16kHz (universellement supporté par Gemini 2.0/2.5)
    const wavConverted = await convertAudioDataUrlToWavBase64(audioDataUrl);
    if (wavConverted && wavConverted.data.length > 50) {
      audioPart = {
        inlineData: {
          mimeType: wavConverted.mimeType,
          data: wavConverted.data,
        },
      };
    } else {
      // Fallback si décodage Web Audio impossible
      const [header, base64Data] = audioDataUrl.split('base64,');
      const cleanBase64 = base64Data ? base64Data.replace(/\s/g, '') : '';
      const hLower = header.toLowerCase();

      let mime = 'audio/ogg';
      if (hLower.includes('wav')) mime = 'audio/wav';
      else if (hLower.includes('mp4') || hLower.includes('m4a') || hLower.includes('aac')) mime = 'audio/aac';
      else if (hLower.includes('mpeg') || hLower.includes('mp3')) mime = 'audio/mp3';
      else if (hLower.includes('ogg') || hLower.includes('webm') || hLower.includes('opus')) mime = 'audio/ogg';

      if (cleanBase64 && cleanBase64.length > 50) {
        audioPart = {
          inlineData: {
            mimeType: mime,
            data: cleanBase64,
          },
        };
      }
    }
  }

  if (!audioPart && (!liveTranscript || !liveTranscript.trim())) {
    throw new Error('Aucun signal audio ni texte détecté dans cet enregistrement.');
  }

  const promptText = `Tu es l'assistant intelligent de prise de notes "Keo Note".
L'utilisateur vient d'enregistrer une note vocale en français.
${
  audioPart
    ? "1. ÉCOUTE ATTENTIVEMENT l'enregistrement audio joint et retranscris INTÉGRALEMENT et FIDÈLEMENT tout ce qui est dit en français (en corrigeant uniquement les hésitations orales et la ponctuation pour en faire une note écrite propre et lisible)."
    : ''
}
${
  liveTranscript && liveTranscript.trim()
    ? `Indice de reconnaissance vocale en direct : """${liveTranscript}"""`
    : ''
}

2. À partir de ce que dit l'utilisateur, génère :
- "title" : Un titre clair, pertinent et précis résumant le sujet de la note (3 à 7 mots).
- "summary" : Un résumé synthétique de l'essentiel en 1 ou 2 phrases.
- "cleanContent" : Le texte complet de la note vocale retranscrit proprement en français, structuré en paragraphes ou points clairs si nécessaire. Ne mets JAMAIS "Mémo vocal enregistré" ! Écris les vraies paroles prononcées par l'utilisateur.
- "todos" : La liste de toutes les actions, tâches à faire, courses ou rappels mentionnés dans la note (tableau de chaînes de caractères, ou [] s'il n'y en a pas).
- "tags" : 1 à 3 catégories pertinentes en français (ex: Travail, Maison, Courses, Idée, Santé, Finances, Auto, Famille).

Réponds UNIQUEMENT avec un objet JSON valide respectant strictement ce format :
{
  "title": "...",
  "summary": "...",
  "cleanContent": "...",
  "todos": ["..."],
  "tags": ["..."]
}`;

  const parts: GeminiContentPart[] = [];
  if (audioPart) {
    parts.push(audioPart);
  }
  parts.push({ text: promptText });

  const { text, error } = await callGeminiApi(apiKey, parts, true);
  if (!text || error) {
    if (liveTranscript && liveTranscript.trim().length > 0) {
      return fallbackStructure(liveTranscript);
    }
    throw new Error(error || "L'API Gemini n'a pas pu analyser l'enregistrement audio.");
  }

  try {
    const parsed = parseGeminiJson(text);
    return {
      title: parsed.title || 'Note vocale retranscrite',
      summary: parsed.summary || '',
      cleanContent: parsed.cleanContent || liveTranscript || text,
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
      tags: Array.isArray(parsed.tags) && parsed.tags.length > 0 ? parsed.tags : ['Vocal'],
    };
  } catch (err) {
    // Si Gemini a répondu en texte libre au lieu de JSON, on utilise directement son texte !
    if (text.trim().length > 0) {
      return fallbackStructure(text.trim());
    }
    throw new Error('Réponse Gemini illisible. Cliquez sur Réessayer.');
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
