import { create } from 'zustand';
import { useChronos } from './store';
import { nowHM, todayStr, uid } from './utils';

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
    for (const e of events) {
      if (!e.reminder || e.date !== today || !e.time) continue;
      const key = `event:${e.id}:${today}`;
      if (now >= e.time && !notified.has(key)) {
        notify('📅 Evento in programma', e.title);
        markNotified(key);
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

  // Riepilogo giornaliero: una sola notifica al giorno, all'orario scelto
  // (o appena si apre l'app, se l'orario è già passato).
  if (settings.notifDaily && now >= settings.dailyTime) {
    const key = `daily:${today}`;
    if (!notified.has(key)) {
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
      markNotified(key);
    }
  }
}
