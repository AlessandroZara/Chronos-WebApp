export type Priority = 'alta' | 'media' | 'bassa';

export interface Task {
  id: string;
  title: string;
  priority: Priority;
  due?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  done: boolean;
  reminder: boolean;
  createdAt: string; // ISO
  completedAt?: string; // YYYY-MM-DD
}

export interface CalEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  reminder: boolean;
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
  theme: 'light' | 'dark' | 'auto';
  darkStart: string; // HH:MM — inizio tema scuro in modalità auto
  darkEnd: string; // HH:MM — fine tema scuro in modalità auto
  notifEnabled: boolean;
  notifTasks: boolean;
  notifEvents: boolean;
  notifHabits: boolean;
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
