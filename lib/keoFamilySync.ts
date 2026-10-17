import { Note } from '@/types/note';

const SUPABASE_URL = 'https://lveoxuijbpvrnwqbvxud.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2ZW94dWlqYnB2cm53cWJ2eHVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4OTI2NDAsImV4cCI6MjEwNzQ2ODY0MH0.8h2b5CQRrrQiDlB0t6LrVFi9xD-bo3Bo3ROyySRCCD4';

const BRIDGE_EMAIL = 'keonote-sync@otsmane.fr';
const BRIDGE_PASSWORD = 'KeoNoteSyncBridge!2026';
const DEFAULT_CREATOR_ID = 'b7b1872e-e761-4764-bff2-5d263628199b';
const DEFAULT_FAMILY_CONV_ID = '0003b1ef-b3d9-45e6-8f36-c459f73ed661';

let cachedToken: string | null = null;
let cachedUserId: string | null = null;
let tokenExpiresAt = 0;

async function getBridgeAuth(): Promise<{ token: string; userId: string }> {
  if (cachedToken && cachedUserId && Date.now() < tokenExpiresAt) {
    return { token: cachedToken, userId: cachedUserId };
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: BRIDGE_EMAIL,
      password: BRIDGE_PASSWORD,
    }),
  });

  if (!res.ok) {
    throw new Error('Impossible de se connecter au Cloud Keo Family.');
  }

  const data = await res.json();
  cachedToken = data.access_token;
  cachedUserId = data.user?.id || DEFAULT_CREATOR_ID;
  tokenExpiresAt = Date.now() + 45 * 60 * 1000;

  return { token: cachedToken!, userId: cachedUserId! };
}

function autoDetectShoppingCategory(name?: string): string {
  if (!name) return 'epicerie';
  const n = String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (
    /pomme|poire|banane|orange|citron|fraise|tomate|carotte|salade|courgette|oignon|echalote|ail|avocat|poireau|pomme de terre|champignon|concombre|poivron|haricot|herbe|persil|coriandre|basilic|epinard|legume|fruit|radis|chou|melon|pasteque|peche|abricot/i.test(
      n
    )
  ) {
    return 'fruits_legumes';
  }
  if (
    /lait|beurre|creme|yaourt|fromage|gruyere|parmesan|mozzarella|creme fraiche|emmental|oeuf|comte|chevre|feta|ricotta|mascarpone/i.test(
      n
    )
  ) {
    return 'frais_cremerie';
  }
  if (
    /poulet|boeuf|porc|veau|steak|viande|saumon|cabillaud|thon|crevette|jambon|dinde|lard|saucisse|poisson|bifteck|hache|escalope|merguez|chipolata/i.test(
      n
    )
  ) {
    return 'viandes_poissons';
  }
  if (/pain|baguette|croissant|brioche|mie|biscotte|patisserie|pain au chocolat/i.test(n)) {
    return 'boulangerie';
  }
  if (/eau|jus|coca|soda|biere|vin|cafe|the|sirop|boisson|limonade|cidre/i.test(n)) {
    return 'boissons';
  }
  if (
    /savon|dentifrice|shampoing|gel douche|lessive|eponge|sopalin|papier toilette|vaisselle|poubelle|nettoyant|javel|coton|shampooing|adoucissant|huile/i.test(
      n
    )
  ) {
    return 'hygiene';
  }
  return 'epicerie';
}

export interface KeoFamilySyncResult {
  success: boolean;
  message: string;
}

/**
 * 1. Envoyer vers Tâches famille (public.family_tasks)
 */
export async function sendNoteToFamilyTasks(note: Note): Promise<KeoFamilySyncResult> {
  const { token } = await getBridgeAuth();
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };

  const nowIso = new Date().toISOString();
  const todoItems =
    note.todos && note.todos.length > 0
      ? note.todos.map((t) => t.text.trim()).filter(Boolean)
      : [];

  const tasksPayload =
    todoItems.length > 0
      ? todoItems.map((text, idx) => ({
          id: `task-keonote-${Date.now()}-${idx}`,
          title: text,
          description: `Note : ${note.title}`,
          priority: 'normal',
          completed: false,
          created_by: DEFAULT_CREATOR_ID,
          created_by_name: 'Hacène (Keo Note)',
          created_at: nowIso,
          updated_at: nowIso,
        }))
      : [
          {
            id: `task-keonote-${Date.now()}-0`,
            title: note.title || 'Note depuis Keo Note',
            description: note.content || note.summary || null,
            priority: 'normal',
            completed: false,
            created_by: DEFAULT_CREATOR_ID,
            created_by_name: 'Hacène (Keo Note)',
            created_at: nowIso,
            updated_at: nowIso,
          },
        ];

  const res = await fetch(`${SUPABASE_URL}/rest/v1/family_tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(tasksPayload),
  });

  if (!res.ok) {
    throw new Error(`Erreur lors de l'ajout aux Tâches famille (${res.status})`);
  }

  return {
    success: true,
    message:
      tasksPayload.length > 1
        ? `✅ ${tasksPayload.length} tâches ont bien été ajoutées dans Keo Family (Tâches famille) !`
        : `✅ La tâche « ${tasksPayload[0].title} » a bien été ajoutée dans Keo Family !`,
  };
}

/**
 * 2. Envoyer vers Liste de courses (public.family_kitchen)
 */
export async function sendNoteToFamilyShopping(note: Note): Promise<KeoFamilySyncResult> {
  const { token } = await getBridgeAuth();
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Extraire les articles
  let rawItems: string[] = [];
  if (note.todos && note.todos.length > 0) {
    rawItems = note.todos.map((t) => t.text.trim()).filter(Boolean);
  } else if (note.content && note.content.trim()) {
    rawItems = note.content
      .split(/\n|•|-|,/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1);
  }
  if (rawItems.length === 0) {
    rawItems = [note.title];
  }

  // Lire l'état actuel de family_kitchen
  const getRes = await fetch(`${SUPABASE_URL}/rest/v1/family_kitchen?id=eq.main&select=*`, {
    headers,
  });
  if (!getRes.ok) {
    throw new Error(`Impossible de récupérer la liste de courses (${getRes.status})`);
  }

  const rows = await getRes.json();
  const mainRow = rows && rows[0] ? rows[0] : null;
  const existingItems = Array.isArray(mainRow?.custom_shopping_items)
    ? mainRow.custom_shopping_items
    : [];

  const newShoppingItems = rawItems.map((text, idx) => ({
    id: `shop-keonote-${Date.now()}-${idx}`,
    name: text,
    quantity: 1,
    unit: '',
    category: autoDetectShoppingCategory(text),
    checked: false,
  }));

  const updatedItems = [...newShoppingItems, ...existingItems];

  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/family_kitchen?id=eq.main`, {
    method: 'PATCH',
    headers: {
      ...headers,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      custom_shopping_items: updatedItems,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!patchRes.ok) {
    throw new Error(`Erreur lors de la mise à jour des courses (${patchRes.status})`);
  }

  return {
    success: true,
    message:
      newShoppingItems.length > 1
        ? `✅ ${newShoppingItems.length} articles ont bien été ajoutés à la Liste de courses de Keo Family !`
        : `✅ « ${newShoppingItems[0].name} » a bien été ajouté à la Liste de courses de Keo Family !`,
  };
}

/**
 * 3. Envoyer vers le Chat familial (« Toute la Famille » dans public.messages)
 */
export async function sendNoteToFamilyChat(
  note: Note,
  formattedText: string
): Promise<KeoFamilySyncResult> {
  const { token, userId } = await getBridgeAuth();
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      conversation_id: DEFAULT_FAMILY_CONV_ID,
      sender_id: userId,
      content: formattedText,
    }),
  });

  if (!res.ok) {
    throw new Error(`Erreur lors de l'envoi dans le Chat familial (${res.status})`);
  }

  return {
    success: true,
    message: `✅ La note « ${note.title} » a bien été publiée dans le Chat familial Keo Family !`,
  };
}

/**
 * 4. Envoyer vers l'Agenda famille (public.events)
 */
export async function sendNoteToFamilyAgenda(
  note: Note,
  dateStr: string,
  timeStr: string
): Promise<KeoFamilySyncResult> {
  const { token } = await getBridgeAuth();
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };

  const startIso = new Date(`${dateStr}T${timeStr || '18:00'}:00`).toISOString();
  const endIso = new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();

  const descriptionParts: string[] = [];
  if (note.summary && note.summary !== 'Mémo vocal enregistré...') {
    descriptionParts.push(`Résumé : ${note.summary}`);
  }
  if (note.content) {
    descriptionParts.push(note.content);
  }
  if (note.todos && note.todos.length > 0) {
    descriptionParts.push(
      'À faire :\n' + note.todos.map((t) => `- ${t.text}`).join('\n')
    );
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: note.title || 'Événement Keo Note',
      description: descriptionParts.join('\n\n') || null,
      start_date: startIso,
      end_date: endIso,
      all_day: false,
      category: 'famille',
      color: '#ee7318',
      created_by: DEFAULT_CREATOR_ID,
    }),
  });

  if (!res.ok) {
    throw new Error(`Erreur lors de l'ajout à l'Agenda familial (${res.status})`);
  }

  return {
    success: true,
    message: `✅ Événement « ${note.title} » ajouté à l'Agenda Keo Family (${dateStr} à ${timeStr}) !`,
  };
}
