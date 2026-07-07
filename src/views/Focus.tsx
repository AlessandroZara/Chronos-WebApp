import { useChronos } from '../store';
import type { TimerMode } from '../types';
import { fmtCountdown, fmtMinutes, todayStr } from '../utils';

const MODE_LABEL: Record<TimerMode, string> = {
  work: '🍅 Focus',
  short: '☕ Pausa breve',
  long: '🌴 Pausa lunga',
};

/*
 * Timer Pomodoro. La logica di avanzamento (fine sessione, pause,
 * conteggio cicli) vive in App.tsx così continua a funzionare anche
 * quando si naviga in un'altra sezione: qui c'è solo l'interfaccia.
 */
export default function Focus() {
  const timer = useChronos((s) => s.timer);
  const pomodoro = useChronos((s) => s.settings.pomodoro);
  const tasks = useChronos((s) => s.tasks);
  const sessions = useChronos((s) => s.sessions);
  const setTimer = useChronos((s) => s.setTimer);

  const durations: Record<TimerMode, number> = {
    work: pomodoro.work * 60,
    short: pomodoro.short * 60,
    long: pomodoro.long * 60,
  };
  const total = durations[timer.mode];
  const progress = Math.min(1, Math.max(0, 1 - timer.remaining / total));

  // Anello di avanzamento SVG: si svuota man mano che il tempo passa.
  const R = 115;
  const CIRC = 2 * Math.PI * R;

  const start = () =>
    setTimer({ running: true, endAt: Date.now() + timer.remaining * 1000 });

  const pause = () => setTimer({ running: false, endAt: null });

  const reset = () =>
    setTimer({ running: false, endAt: null, remaining: durations[timer.mode] });

  // Salta la fase corrente senza registrare la sessione.
  const skip = () => {
    const nextMode: TimerMode = timer.mode === 'work' ? 'short' : 'work';
    setTimer({
      mode: nextMode,
      running: false,
      endAt: null,
      remaining: durations[nextMode],
    });
  };

  const openTasks = tasks.filter((t) => !t.done);
  const today = todayStr();
  const todaySessions = sessions.filter((s) => s.date === today);
  const todayMinutes = todaySessions.reduce((sum, s) => sum + s.minutes, 0);
  const cycleProgress = timer.cycle % pomodoro.cycles;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">⏱️ Focus Timer</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tecnica Pomodoro: {pomodoro.work} min di lavoro, pause di {pomodoro.short}/
          {pomodoro.long} min
        </p>
      </header>

      <div className="card flex flex-col items-center gap-5 py-8">
        <span
          className={`chip ${
            timer.mode === 'work'
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          } !px-3 !py-1 !text-sm`}
        >
          {MODE_LABEL[timer.mode]}
        </span>

        {/* Quadrante con anello di avanzamento */}
        <div className="relative">
          <svg width="260" height="260" viewBox="0 0 260 260" className="-rotate-90">
            <circle
              cx="130"
              cy="130"
              r={R}
              fill="none"
              strokeWidth="10"
              className="stroke-slate-200 dark:stroke-slate-800"
            />
            <circle
              cx="130"
              cy="130"
              r={R}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * progress}
              className={`transition-[stroke-dashoffset] duration-500 ${
                timer.mode === 'work' ? 'stroke-indigo-500' : 'stroke-emerald-500'
              }`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-6xl font-bold tabular-nums">
              {fmtCountdown(timer.remaining)}
            </span>
            {/* Pallini del ciclo: quante sessioni mancano alla pausa lunga */}
            <div className="mt-2 flex gap-1.5">
              {Array.from({ length: pomodoro.cycles }, (_, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full ${
                    i < cycleProgress ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {timer.running ? (
            <button onClick={pause} className="btn-primary !px-6 !py-3 !text-base">
              ⏸ Pausa
            </button>
          ) : (
            <button onClick={start} className="btn-primary !px-6 !py-3 !text-base">
              ▶ Avvia
            </button>
          )}
          <button onClick={reset} className="btn-ghost !py-3">
            ↺ Reset
          </button>
          <button onClick={skip} className="btn-ghost !py-3">
            ⏭ Salta
          </button>
        </div>

        {/* Collega la sessione a un'attività: comparirà nelle statistiche */}
        <div className="w-full max-w-sm">
          <label className="label" htmlFor="focus-task">
            Su cosa stai lavorando?
          </label>
          <select
            id="focus-task"
            className="input"
            value={timer.taskId ?? ''}
            onChange={(e) => setTimer({ taskId: e.target.value || undefined })}
          >
            <option value="">— Nessuna attività specifica —</option>
            {openTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card flex items-center justify-around py-4 text-center">
        <div>
          <p className="text-2xl font-bold text-indigo-500">{todaySessions.length}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">sessioni oggi</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-indigo-500">{fmtMinutes(todayMinutes)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">focus oggi</p>
        </div>
      </div>
    </div>
  );
}
