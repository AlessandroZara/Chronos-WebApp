import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AuthState,
  CalEvent,
  FocusSession,
  Habit,
  Note,
  Priority,
  Settings,
  Task,
  TimerState,
} from './types';
import { todayStr, uid } from './utils';

export const defaultSettings: Settings = {
  theme: 'auto',
  darkStart: '20:00',
  darkEnd: '07:00',
  notifEnabled: true,
  notifTasks: true,
  notifEvents: true,
  notifHabits: true,
  notifDaily: true,
  dailyTime: '08:30',
  pomodoro: { work: 25, short: 5, long: 15, cycles: 4 },
};

// URL predefinito dell'API: in produzione (es. Altervista) è lo stesso
// dominio che serve l'app; in locale punta al server PHP di sviluppo.
const isLocalhost =
  typeof location !== 'undefined' &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

export const defaultAuth: AuthState = {
  token: null,
  user: null,
  apiUrl: isLocalhost ? 'http://localhost:8010/api.php' : `${location.origin}/api.php`,
};

const defaultTimer: TimerState = {
  mode: 'work',
  running: false,
  endAt: null,
  remaining: 25 * 60,
  cycle: 0,
};

export interface TaskInput {
  title: string;
  priority: Priority;
  due?: string;
  time?: string;
  reminder: boolean;
}

interface ChronosStore {
  tasks: Task[];
  events: CalEvent[];
  notes: Note[];
  habits: Habit[];
  sessions: FocusSession[];
  settings: Settings;
  timer: TimerState;
  auth: AuthState;

  addTask: (input: TaskInput) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;

  addEvent: (input: Omit<CalEvent, 'id'>) => void;
  deleteEvent: (id: string) => void;

  addNote: (title?: string) => string;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;

  addHabit: (input: { name: string; color: string; reminderTime?: string }) => void;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  toggleHabitDay: (id: string, date: string) => void;

  addSession: (input: { minutes: number; taskId?: string }) => void;

  setSettings: (patch: Partial<Settings>) => void;
  setTimer: (patch: Partial<TimerState>) => void;
  setAuth: (patch: Partial<AuthState>) => void;
  logout: () => void;

  exportData: () => string;
  importData: (json: string) => boolean;
  resetAll: () => void;
}

export const useChronos = create<ChronosStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      events: [],
      notes: [],
      habits: [],
      sessions: [],
      settings: defaultSettings,
      timer: defaultTimer,
      auth: defaultAuth,

      addTask: (input) =>
        set((s) => ({
          tasks: [
            ...s.tasks,
            {
              ...input,
              id: uid(),
              done: false,
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      toggleTask: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  done: !t.done,
                  completedAt: !t.done ? todayStr() : undefined,
                }
              : t
          ),
        })),

      deleteTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      addEvent: (input) =>
        set((s) => ({ events: [...s.events, { ...input, id: uid() }] })),

      deleteEvent: (id) =>
        set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

      addNote: (title = 'Nuova nota') => {
        const id = uid();
        const now = new Date().toISOString();
        set((s) => ({
          notes: [
            { id, title, html: '', tags: [], createdAt: now, updatedAt: now },
            ...s.notes,
          ],
        }));
        return id;
      },

      updateNote: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id
              ? { ...n, ...patch, updatedAt: new Date().toISOString() }
              : n
          ),
        })),

      deleteNote: (id) =>
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      addHabit: (input) =>
        set((s) => ({
          habits: [
            ...s.habits,
            { ...input, id: uid(), days: {}, createdAt: todayStr() },
          ],
        })),

      updateHabit: (id, patch) =>
        set((s) => ({
          habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)),
        })),

      deleteHabit: (id) =>
        set((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),

      toggleHabitDay: (id, date) =>
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== id) return h;
            const days = { ...h.days };
            if (days[date]) delete days[date];
            else days[date] = true;
            return { ...h, days };
          }),
        })),

      addSession: (input) =>
        set((s) => ({
          sessions: [
            ...s.sessions,
            {
              ...input,
              id: uid(),
              date: todayStr(),
              endedAt: new Date().toISOString(),
            },
          ],
        })),

      setSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      setTimer: (patch) => set((s) => ({ timer: { ...s.timer, ...patch } })),

      setAuth: (patch) => set((s) => ({ auth: { ...s.auth, ...patch } })),

      // Uscita dall'account: svuota i dati locali (potrebbero appartenere
      // a un altro utente al prossimo login) ma conserva l'URL dell'API.
      logout: () => {
        localStorage.removeItem('chronos-last-modified');
        set((s) => ({
          tasks: [],
          events: [],
          notes: [],
          habits: [],
          sessions: [],
          settings: defaultSettings,
          timer: defaultTimer,
          auth: { ...s.auth, token: null, user: null },
        }));
      },

      exportData: () => {
        const { tasks, events, notes, habits, sessions, settings } = get();
        return JSON.stringify(
          { app: 'chronos', version: 1, exportedAt: new Date().toISOString(), tasks, events, notes, habits, sessions, settings },
          null,
          2
        );
      },

      importData: (json) => {
        try {
          const data = JSON.parse(json);
          if (data?.app !== 'chronos' || !Array.isArray(data.tasks)) return false;
          set({
            tasks: data.tasks ?? [],
            events: data.events ?? [],
            notes: data.notes ?? [],
            habits: data.habits ?? [],
            sessions: data.sessions ?? [],
            settings: { ...defaultSettings, ...(data.settings ?? {}) },
          });
          return true;
        } catch {
          return false;
        }
      },

      resetAll: () =>
        set({
          tasks: [],
          events: [],
          notes: [],
          habits: [],
          sessions: [],
          settings: defaultSettings,
          timer: defaultTimer,
        }),
    }),
    {
      name: 'chronos-data',
      version: 1,
      // Merge personalizzato: se in futuro aggiungiamo nuovi campi alle
      // impostazioni, i dati già salvati dagli utenti non li perdono
      // (i default riempiono i buchi invece di essere sovrascritti in blocco).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ChronosStore>;
        return {
          ...current,
          ...p,
          settings: { ...current.settings, ...(p.settings ?? {}) },
          auth: { ...current.auth, ...(p.auth ?? {}) },
        };
      },
    }
  )
);

/** Streak corrente di un'abitudine: giorni consecutivi fino a oggi (o ieri se oggi non è ancora fatta). */
export function habitStreak(habit: Habit): number {
  let day = todayStr();
  let streak = 0;
  if (!habit.days[day]) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const cursor = new Date(day + 'T00:00:00');
  while (true) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (!habit.days[key]) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
