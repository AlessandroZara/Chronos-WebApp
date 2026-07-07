import { create } from 'zustand';
import { defaultSettings, useChronos } from './store';
import type {
  AuthUser,
  CalEvent,
  FocusSession,
  Habit,
  Note,
  Settings,
  Task,
} from './types';

/*
 * ============================================================
 * SINCRONIZZAZIONE CON IL SERVER (server/api.php)
 * ------------------------------------------------------------
 * Strategia "offline-first, last-write-wins":
 * - localStorage resta la copia di lavoro: l'app è sempre reattiva
 *   e funziona anche senza rete;
 * - a ogni modifica locale, lo stato viene inviato al server
 *   (con un debounce per non fare una richiesta a ogni tasto);
 * - all'avvio, al ritorno sull'app e ogni minuto si scarica lo
 *   stato dal server: se è più recente di quello locale, vince.
 *
 * L'accesso avviene con l'account utente: il token personale
 * ottenuto al login autentica ogni richiesta.
 * ============================================================
 */

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error';

/** Forma dei dati salvati sul server (stessa struttura dello snapshot). */
interface RemotePayload {
  tasks?: Task[];
  events?: CalEvent[];
  notes?: Note[];
  habits?: Habit[];
  sessions?: FocusSession[];
  settings?: Partial<Settings>;
}

interface SyncStatusStore {
  status: SyncStatus;
  lastSync: string | null; // ISO dell'ultima sincronizzazione riuscita
  error: string | null;
  set: (patch: Partial<Omit<SyncStatusStore, 'set'>>) => void;
}

/** Piccolo store separato solo per mostrare lo stato della sync nella UI. */
export const useSyncStatus = create<SyncStatusStore>((set) => ({
  status: 'off',
  lastSync: null,
  error: null,
  set: (patch) => set(patch),
}));

// Timestamp dell'ultima modifica locale: è il valore confrontato
// con updated_at del server per decidere chi è più aggiornato.
const LAST_MODIFIED_KEY = 'chronos-last-modified';

const getAuth = () => useChronos.getState().auth;
const isEnabled = () => {
  const a = getAuth();
  return !!a.token && !!a.apiUrl;
};

/**
 * Fotografia serializzata dello stato da sincronizzare.
 * Esclusi di proposito: il timer (cambia ogni secondo) e la sessione
 * di accesso (token e URL sono specifici del dispositivo).
 */
function snapshot(): string {
  const { tasks, events, notes, habits, sessions, settings } = useChronos.getState();
  return JSON.stringify({ tasks, events, notes, habits, sessions, settings });
}

let lastPushed = ''; // ultimo snapshot inviato con successo (evita push inutili)
let pushTimer: number | undefined;
let applyingRemote = false; // true mentre applichiamo dati dal server (evita il loop push<->pull)
let initialized = false;

/** Chiamata autenticata all'endpoint dello stato. */
async function request(method: 'GET' | 'POST', body?: unknown): Promise<unknown> {
  const a = getAuth();
  const res = await fetch(`${a.apiUrl}?action=state`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Chronos-Token': a.token ?? '',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(json?.error ?? `Errore HTTP ${res.status}`);
  }
  return res.json();
}

/** Login o registrazione: restituisce token e dati utente. */
export async function authRequest(
  apiUrl: string,
  action: 'login' | 'register',
  payload: Record<string, string>
): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${apiUrl}?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => null)) as
    | { token?: string; user?: AuthUser; error?: string }
    | null;
  if (!res.ok || !json?.token || !json.user) {
    throw new Error(json?.error ?? `Errore HTTP ${res.status}: server non raggiungibile.`);
  }
  return { token: json.token, user: json.user };
}

function setOk() {
  useSyncStatus.getState().set({
    status: 'idle',
    lastSync: new Date().toISOString(),
    error: null,
  });
}

function setError(e: unknown) {
  useSyncStatus.getState().set({
    status: 'error',
    error: e instanceof Error ? e.message : 'Errore sconosciuto',
  });
}

/** Invia subito lo stato locale al server. */
export async function pushNow(): Promise<void> {
  if (!isEnabled()) return;
  const snap = snapshot();
  const updatedAt = localStorage.getItem(LAST_MODIFIED_KEY) ?? new Date().toISOString();
  useSyncStatus.getState().set({ status: 'syncing' });
  try {
    await request('POST', { data: JSON.parse(snap), updatedAt });
    lastPushed = snap;
    setOk();
  } catch (e) {
    setError(e);
  }
}

/** Scarica lo stato dal server e lo applica se è più recente del locale. */
export async function pullNow(): Promise<void> {
  if (!isEnabled()) return;
  useSyncStatus.getState().set({ status: 'syncing' });
  try {
    const remote = (await request('GET')) as {
      data: RemotePayload | null;
      updatedAt: string | null;
    };

    if (!remote.data || typeof remote.updatedAt !== 'string') {
      // Account ancora senza dati sul server: carichiamo quelli locali.
      await pushNow();
      return;
    }

    const localAt = localStorage.getItem(LAST_MODIFIED_KEY) ?? '';

    // Rete di sicurezza per i dispositivi nuovi: se qui non c'è ancora
    // nessun contenuto ma il server sì, scarichiamo SEMPRE dal server,
    // qualunque cosa dicano i timestamp.
    const s = useChronos.getState();
    const localEmpty =
      s.tasks.length === 0 &&
      s.notes.length === 0 &&
      s.habits.length === 0 &&
      s.events.length === 0 &&
      s.sessions.length === 0;
    const remoteHasContent =
      (remote.data.tasks?.length ?? 0) > 0 ||
      (remote.data.notes?.length ?? 0) > 0 ||
      (remote.data.habits?.length ?? 0) > 0 ||
      (remote.data.events?.length ?? 0) > 0 ||
      (remote.data.sessions?.length ?? 0) > 0;

    if (remote.updatedAt > localAt || (localEmpty && remoteHasContent)) {
      // Il server è più aggiornato: applichiamo i suoi dati.
      applyingRemote = true;
      const d = remote.data;
      useChronos.setState({
        tasks: d.tasks ?? [],
        events: d.events ?? [],
        notes: d.notes ?? [],
        habits: d.habits ?? [],
        sessions: d.sessions ?? [],
        settings: { ...defaultSettings, ...(d.settings ?? {}) },
      });
      applyingRemote = false;
      lastPushed = snapshot();
      localStorage.setItem(LAST_MODIFIED_KEY, remote.updatedAt);
      setOk();
    } else if (snapshot() !== lastPushed) {
      // Il locale è più recente (o allineato ma mai inviato): carichiamo noi.
      await pushNow();
    } else {
      setOk();
    }
  } catch (e) {
    setError(e);
  }
}

/**
 * Avvia il motore di sincronizzazione. Chiamato una volta da App.tsx:
 * - osserva ogni modifica dello store e programma un push (debounce 1,5 s);
 * - fa un pull all'avvio, quando l'app torna in primo piano e ogni minuto.
 */
export function initSync() {
  if (initialized) return; // protezione dal doppio mount di StrictMode
  initialized = true;

  lastPushed = snapshot();

  useChronos.subscribe(() => {
    if (applyingRemote) return;
    const snap = snapshot();
    if (snap === lastPushed) return; // è cambiato solo timer/sessione: niente da inviare

    // Il timestamp locale va aggiornato SEMPRE, anche da sloggati:
    // così i dati creati prima del login non rischiano di essere
    // sovrascritti da dati più vecchi presenti sul server.
    localStorage.setItem(LAST_MODIFIED_KEY, new Date().toISOString());

    if (!isEnabled()) {
      useSyncStatus.getState().set({ status: 'off' });
      return;
    }
    window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(() => void pushNow(), 1500);
  });

  window.addEventListener('focus', () => void pullNow());
  setInterval(() => void pullNow(), 60_000);

  if (isEnabled()) {
    void pullNow();
  }
}
