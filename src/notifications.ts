import { create } from 'zustand';
import { useChronos } from './store';
import {
  EVENT_KINDS,
  fmtDate,
  fmtOffset,
  nowHM,
  parseDate,
  todayStr,
  uid,
  UNIT_MS,
} from './utils';

export interface Toast {
  id: string;
  title: string;
  body?: string;
}

interface ToastStore {
  toasts: Toast[];
  push: (title: string, body?: string) => void;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  push: (title, body) => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts, { id, title, body }] }));
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      6000
    );
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function showSystemNotification(title: string, body?: string) {
  const options: NotificationOptions = { body, icon: './icon.svg', badge: './icon.svg' };
  // Su smartphone e tablet le notifiche devono passare dal service worker:
  // il costruttore `new Notification()` lì lancia un errore.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (reg) return reg.showNotification(title, options);
        new Notification(title, options);
      })
      .catch(() => {
        try {
          new Notification(title, options);
        } catch {
          // Il toast in-app resta comunque visibile.
        }
      });
  } else {
    try {
      new Notification(title, options);
    } catch {
      // Il toast in-app resta comunque visibile.
    }
  }
}

/** Notifica unificata: toast in-app sempre, notifica di sistema se il permesso è concesso. */
export function notify(title: string, body?: string) {
  useToasts.getState().push(title, body);
  if (notificationsSupported() && Notification.permission === 'granted') {
    showSystemNotification(title, body);
  }
}

// Evita notifiche duplicate nella stessa sessione di utilizzo.
const notified = new Set<string>(
  JSON.parse(sessionStorage.getItem('chronos-notified') ?? '[]') as string[]
);

function markNotified(key: string) {
  notified.add(key);
  sessionStorage.setItem('chronos-notified', JSON.stringify([...notified]));
}

/**
 * Scheduler dei promemoria: controlla attività, eventi e abitudini
 * e notifica quando l'orario è raggiunto. Chiamato ogni 30 secondi da App.
 */
export function checkReminders() {
  const { tasks, events, habits, settings } = useChronos.getState();
  if (!settings.notifEnabled) return;

  const today = todayStr();
  const now = nowHM();

  if (settings.notifTasks) {
    for (const t of tasks) {
      if (t.done || !t.reminder || t.due !== today || !t.time) continue;
      const key = `task:${t.id}:${today}`;
      if (now >= t.time && !notified.has(key)) {
        notify('⏰ Attività in scadenza', t.title);
        markNotified(key);
      }
    }
  }

  if (settings.notifEvents) {
    const nowMs = Date.now();
    for (const e of events) {
      if (!e.reminder) continue;

      // 1) Preavviso configurabile: "tra X minuti/ore/giorni".
      //    Per gli eventi senza orario si assume come riferimento le 09:00.
      if (e.reminderValue && e.reminderUnit) {
        const [hh, mm] = (e.time ?? '09:00').split(':').map(Number);
        const eventDate = parseDate(e.date);
        eventDate.setHours(hh, mm, 0, 0);
        const eventMs = eventDate.getTime();
        const triggerMs = eventMs - e.reminderValue * UNIT_MS[e.reminderUnit];
        // La chiave include data/orario/preavviso: se l'evento viene
        // modificato, il promemoria si riarma da solo.
        const key = `evrem:${e.id}:${e.date}:${e.time ?? ''}:${e.reminderValue}${e.reminderUnit}`;
        if (nowMs >= triggerMs && nowMs < eventMs && !notified.has(key)) {
          const kind = EVENT_KINDS[e.kind ?? 'appuntamento'];
          const when = e.date === today ? 'oggi' : fmtDate(e.date);
          // Se c'è un luogo lo aggiungiamo al messaggio: si sa subito dove andare.
          const place = e.location ? ` · 📍 ${e.location}` : '';
          notify(
            `${kind.icon} Tra ${fmtOffset(e.reminderValue, e.reminderUnit)}: ${e.title}`,
            `${kind.label} in programma ${when}${e.time ? ` alle ${e.time}` : ''}${place}.`
          );
          markNotified(key);
        }
      }

      // 2) Notifica al momento dell'evento (comportamento già esistente).
      if (e.date === today && e.time) {
        const key = `event:${e.id}:${today}:${e.time}`;
        if (now >= e.time && !notified.has(key)) {
          notify('📅 Evento in programma', e.title);
          markNotified(key);
        }
      }
    }
  }

  if (settings.notifHabits) {
    for (const h of habits) {
      if (!h.reminderTime || h.days[today]) continue;
      const key = `habit:${h.id}:${today}`;
      if (now >= h.reminderTime && !notified.has(key)) {
        notify('🔁 Promemoria abitudine', `Non dimenticare: ${h.name}`);
        markNotified(key);
      }
    }
  }

  // Promemoria generale "controlla Chronos": frequenza scelta dall'utente
  // (ogni 1/2/3 giorni o settimanale, 0 = mai), all'orario impostato.
  // L'ultima data di invio è salvata in localStorage così la cadenza
  // "ogni N giorni" sopravvive anche alla chiusura del browser.
  if (settings.summaryEvery > 0 && now >= settings.dailyTime) {
    const last = localStorage.getItem('chronos-last-summary');
    const daysSinceLast = last
      ? Math.round((parseDate(today).getTime() - parseDate(last).getTime()) / 86_400_000)
      : Number.POSITIVE_INFINITY;
    if (daysSinceLast >= settings.summaryEvery) {
      const dueToday = tasks.filter((t) => !t.done && t.due === today).length;
      const overdue = tasks.filter((t) => !t.done && t.due && t.due < today).length;
      const todayEvents = events.filter((e) => e.date === today).length;
      const habitsTodo = habits.filter((h) => !h.days[today]).length;

      const parts: string[] = [];
      if (dueToday > 0) parts.push(`${dueToday} attività in scadenza`);
      if (overdue > 0) parts.push(`${overdue} in ritardo`);
      if (todayEvents > 0) parts.push(`${todayEvents} ${todayEvents === 1 ? 'evento' : 'eventi'} a calendario`);
      if (habitsTodo > 0) parts.push(`${habitsTodo} abitudini da completare`);

      const body =
        parts.length > 0
          ? `Oggi hai: ${parts.join(', ')}. Dai un'occhiata! 💪`
          : 'Nessun impegno in programma: giornata libera! 🌤️';
      notify('🌅 Il tuo riepilogo di oggi', body);
      localStorage.setItem('chronos-last-summary', today);
    }
  }
}
