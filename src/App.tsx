import { useEffect, useState } from 'react';
import type { View } from './types';
import { useChronos } from './store';
import { checkReminders, notify } from './notifications';
import { initSync } from './sync';
import { fmtCountdown, isTimeInRange, nowHM } from './utils';
import Toasts from './components/Toasts';
import AccountView from './views/AccountView';
import AuthView from './views/AuthView';
import Dashboard from './views/Dashboard';
import Tasks from './views/Tasks';
import CalendarView from './views/CalendarView';
import NotesView from './views/NotesView';
import Focus from './views/Focus';
import Habits from './views/Habits';
import SettingsView from './views/SettingsView';

const NAV: { view: View; label: string; icon: string }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: '📊' },
  { view: 'tasks', label: 'Attività', icon: '✅' },
  { view: 'calendar', label: 'Calendario', icon: '📅' },
  { view: 'notes', label: 'Note', icon: '📝' },
  { view: 'focus', label: 'Focus', icon: '⏱️' },
  { view: 'habits', label: 'Abitudini', icon: '🔁' },
  { view: 'settings', label: 'Opzioni', icon: '⚙️' },
];

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const settings = useChronos((s) => s.settings);
  const timer = useChronos((s) => s.timer);
  const auth = useChronos((s) => s.auth);

  // Tema: manuale, come il sistema (PC/telefono) o automatico a orario.
  // Rivalutato ogni minuto e all'istante se cambia il tema del dispositivo.
  useEffect(() => {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark =
        settings.theme === 'dark' ||
        (settings.theme === 'system' && systemDark.matches) ||
        (settings.theme === 'auto' &&
          isTimeInRange(nowHM(), settings.darkStart, settings.darkEnd));
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    const int = setInterval(apply, 60_000);
    systemDark.addEventListener('change', apply);
    return () => {
      clearInterval(int);
      systemDark.removeEventListener('change', apply);
    };
  }, [settings.theme, settings.darkStart, settings.darkEnd]);

  // Scheduler dei promemoria (attività, eventi, abitudini).
  useEffect(() => {
    checkReminders();
    const int = setInterval(checkReminders, 30_000);
    return () => clearInterval(int);
  }, []);

  // Sincronizzazione con il server, se configurata nelle impostazioni.
  useEffect(() => {
    initSync();
  }, []);

  // Motore del timer: basato su timestamp, sopravvive a refresh e cambi di scheda.
  useEffect(() => {
    if (!timer.running) return;
    const int = setInterval(() => {
      const { timer: t, settings: s, setTimer, addSession } = useChronos.getState();
      if (!t.running || !t.endAt) return;
      const remaining = Math.max(0, Math.round((t.endAt - Date.now()) / 1000));
      if (remaining > 0) {
        setTimer({ remaining });
        return;
      }
      const p = s.pomodoro;
      if (t.mode === 'work') {
        addSession({ minutes: p.work, taskId: t.taskId });
        const cycle = t.cycle + 1;
        const nextMode = cycle % p.cycles === 0 ? 'long' : 'short';
        const nextMin = nextMode === 'long' ? p.long : p.short;
        setTimer({
          mode: nextMode,
          cycle,
          running: false,
          endAt: null,
          remaining: nextMin * 60,
        });
        notify(
          '🍅 Sessione completata!',
          `Ottimo lavoro: ${p.work} min di focus. Ora ${nextMode === 'long' ? 'pausa lunga' : 'pausa breve'} di ${nextMin} min.`
        );
      } else {
        setTimer({ mode: 'work', running: false, endAt: null, remaining: p.work * 60 });
        notify('☕ Pausa finita', 'Pronto per una nuova sessione di focus?');
      }
    }, 500);
    return () => clearInterval(int);
  }, [timer.running]);

  // Senza login niente app: schermata di accesso/registrazione.
  // (I toast restano montati per eventuali avvisi.)
  if (!auth.token) {
    return (
      <>
        <AuthView />
        <Toasts />
      </>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-slate-200 bg-white p-4 md:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-2 px-2 text-xl font-bold">
          <span>⏳</span>
          <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
            Chronos
          </span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              className={`btn justify-start ${
                view === item.view
                  ? 'bg-indigo-50 font-semibold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto px-2 text-xs text-slate-400">
          Chronos v0.1.0 · dati salvati in locale e database
        </div>
      </aside>

      {/* Contenuto */}
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-24 md:ml-56 md:p-8 md:pb-8">
        {view === 'dashboard' && <Dashboard onNavigate={setView} />}
        {view === 'tasks' && <Tasks />}
        {view === 'calendar' && <CalendarView />}
        {view === 'notes' && <NotesView />}
        {view === 'focus' && <Focus />}
        {view === 'habits' && <Habits />}
        {view === 'settings' && <SettingsView />}
        {view === 'account' && <AccountView onBack={() => setView('dashboard')} />}
      </main>

      {/* Chip timer attivo, visibile ovunque */}
      {timer.running && view !== 'focus' && (
        <button
          onClick={() => setView('focus')}
          className="fixed top-3 right-3 z-50 flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-lg"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          {fmtCountdown(timer.remaining)}
        </button>
      )}

      {/* Barra di navigazione mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-7 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/95">
        {NAV.map((item) => (
          <button
            key={item.view}
            onClick={() => setView(item.view)}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${
              view === item.view
                ? 'font-semibold text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <Toasts />
    </div>
  );
}
