export type Priority = 'alta' | 'media' | 'bassa';

export interface Task {
  id: string;
  title: string;
  priority: Priority;
  due?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  done: boolean;
  reminder: boolean;
  /** Promemoria: quanti giorni prima della scadenza avvisare (0 = giorno stesso). */
  reminderDaysBefore?: number;
  /** Promemoria: a che ora avvisare (HH:MM). */
  reminderTime?: string;
  createdAt: string; // ISO
  completedAt?: string; // YYYY-MM-DD
}

/** Categoria di un evento a calendario (icona e colore in utils.EVENT_KINDS). */
export type EventKind =
  | 'appuntamento'
  | 'lavoro'
  | 'personale'
  | 'salute'
  | 'compleanno'
  | 'scadenza'
  | 'altro';

export type ReminderUnit = 'min' | 'ore' | 'giorni';

export interface CalEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  kind?: EventKind;
  location?: string; // luogo dell'evento (opzionale)
  notes?: string; // dettagli/annotazioni (opzionale)
  reminder: boolean;
  /** Preavviso: quanto tempo prima notificare (es. 30 min, 2 ore, 1 giorno). */
  reminderValue?: number;
  reminderUnit?: ReminderUnit;
}

export interface Note {
  id: string;
  title: string;
  html: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  name: string;
  color: string;
  reminderTime?: string; // HH:MM
  days: Record<string, boolean>; // YYYY-MM-DD -> fatto
  createdAt: string; // YYYY-MM-DD
}

export interface FocusSession {
  id: string;
  date: string; // YYYY-MM-DD
  minutes: number;
  taskId?: string;
  endedAt: string; // ISO
}

export interface PomodoroConfig {
  work: number; // minuti
  short: number;
  long: number;
  cycles: number; // sessioni prima della pausa lunga
}

/** Utente autenticato (restituito dall'API dopo login/registrazione). */
export interface AuthUser {
  firstName: string;
  lastName: string;
  email: string;
}

/** Sessione di accesso: il token personale è la "chiave" verso il server. */
export interface AuthState {
  token: string | null; // null = non loggato
  user: AuthUser | null;
  apiUrl: string; // indirizzo di api.php
}

export interface Settings {
  /** system = segue il tema di PC/telefono; auto = in base all'orario. */
  theme: 'light' | 'dark' | 'system' | 'auto';
  darkStart: string; // HH:MM — inizio tema scuro in modalità auto
  darkEnd: string; // HH:MM — fine tema scuro in modalità auto
  notifEnabled: boolean;
  notifTasks: boolean;
  notifEvents: boolean;
  notifHabits: boolean;
  /** Promemoria generale "controlla Chronos": ogni quanti giorni (0 = mai). */
  summaryEvery: number;
  dailyTime: string; // HH:MM a cui inviare il promemoria generale
  pomodoro: PomodoroConfig;
}

export type TimerMode = 'work' | 'short' | 'long';

export interface TimerState {
  mode: TimerMode;
  running: boolean;
  endAt: number | null; // timestamp ms
  remaining: number; // secondi
  cycle: number; // sessioni di lavoro completate nel ciclo corrente
  taskId?: string;
}

export type View =
  | 'dashboard'
  | 'tasks'
  | 'calendar'
  | 'notes'
  | 'focus'
  | 'habits'
  | 'settings'
  | 'account'; // pagina profilo, raggiungibile dal chip nella dashboard
