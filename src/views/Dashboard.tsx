import { useState } from 'react';
import type { View } from '../types';
import { habitStreak, useChronos } from '../store';
import { fmtMinutes, lastNDays, parseDate, todayStr } from '../utils';
import BarChart from '../components/BarChart';

type Range = 'week' | 'month';

export default function Dashboard({ onNavigate }: { onNavigate: (v: View) => void }) {
  const tasks = useChronos((s) => s.tasks);
  const events = useChronos((s) => s.events);
  const habits = useChronos((s) => s.habits);
  const sessions = useChronos((s) => s.sessions);
  const toggleTask = useChronos((s) => s.toggleTask);
  const user = useChronos((s) => s.auth.user);

  const [range, setRange] = useState<Range>('week');
  const days = lastNDays(range === 'week' ? 7 : 30);
  const today = todayStr();

  // ---- Riepilogo di oggi ----
  const todayTasks = tasks.filter((t) => t.due === today);
  const todayDone = todayTasks.filter((t) => t.done).length;
  const todayEvents = events
    .filter((e) => e.date === today)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  const todayFocus = sessions
    .filter((s) => s.date === today)
    .reduce((sum, s) => sum + s.minutes, 0);
  const habitsDoneToday = habits.filter((h) => h.days[today]).length;

  // ---- Serie giornaliere per i grafici ----
  const focusSeries = days.map((d) => ({
    label: labelFor(d, range),
    value: sessions.filter((s) => s.date === d).reduce((sum, s) => sum + s.minutes, 0),
  }));
  const tasksSeries = days.map((d) => ({
    label: labelFor(d, range),
    value: tasks.filter((t) => t.done && t.completedAt === d).length,
  }));
  // % di abitudini mantenute quel giorno (solo quelle già esistenti allora).
  const habitsSeries = days.map((d) => {
    const active = habits.filter((h) => h.createdAt <= d);
    const done = active.filter((h) => h.days[d]).length;
    return {
      label: labelFor(d, range),
      value: active.length === 0 ? 0 : Math.round((done / active.length) * 100),
    };
  });

  // ---- Numeri del report per il periodo selezionato ----
  const periodFocus = focusSeries.reduce((sum, d) => sum + d.value, 0);
  const periodSessions = sessions.filter((s) => days.includes(s.date)).length;
  const periodTasksDone = tasksSeries.reduce((sum, d) => sum + d.value, 0);
  const avgHabits =
    habits.length === 0
      ? 0
      : Math.round(habitsSeries.reduce((sum, d) => sum + d.value, 0) / days.length);
  const bestStreakHabit = habits.reduce<{ name: string; streak: number } | null>(
    (best, h) => {
      const s = habitStreak(h);
      return !best || s > best.streak ? { name: h.name, streak: s } : best;
    },
    null
  );
  const bestFocusDay = focusSeries.reduce(
    (best, d, i) => (d.value > best.value ? { value: d.value, date: days[i] } : best),
    { value: 0, date: '' }
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return 'Buonanotte';
    if (h < 13) return 'Buongiorno';
    if (h < 18) return 'Buon pomeriggio';
    return 'Buonasera';
  })();

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">
            {greeting}
            {user ? `, ${user.firstName}` : ''}! 👋
          </h1>
          <p className="text-sm text-slate-500 capitalize dark:text-slate-400">
            {new Date().toLocaleDateString('it-IT', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
        {/* Chip profilo: apre la pagina "Il mio account" */}
        <button
          onClick={() => onNavigate('account')}
          title="Il mio account"
          className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pr-3 pl-1 shadow-sm transition hover:border-indigo-300 active:scale-95 dark:border-slate-700 dark:bg-slate-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white uppercase">
            {(user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '') || '👤'}
          </span>
          <span className="hidden text-sm font-medium sm:block">{user?.firstName}</span>
        </button>
      </header>

      {/* Card riassuntive: 2 colonne su mobile, 4 su desktop */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          icon="✅"
          value={`${todayDone}/${todayTasks.length}`}
          label="attività di oggi"
          onClick={() => onNavigate('tasks')}
        />
        <SummaryCard
          icon="⏱️"
          value={fmtMinutes(todayFocus)}
          label="focus oggi"
          onClick={() => onNavigate('focus')}
        />
        <SummaryCard
          icon="🔁"
          value={`${habitsDoneToday}/${habits.length}`}
          label="abitudini fatte"
          onClick={() => onNavigate('habits')}
        />
        <SummaryCard
          icon="📅"
          value={String(todayEvents.length)}
          label="eventi oggi"
          onClick={() => onNavigate('calendar')}
        />
      </div>

      {/* Agenda di oggi: attività ed eventi in un colpo d'occhio */}
      {(todayTasks.length > 0 || todayEvents.length > 0) && (
        <div className="card space-y-2">
          <h2 className="font-semibold">🗓️ Agenda di oggi</h2>
          {todayEvents.map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-sm">
              <span className="w-12 font-mono text-xs text-slate-400">{e.time ?? '—'}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
              <span className="truncate">{e.title}</span>
            </div>
          ))}
          {todayTasks
            .slice()
            .sort((a, b) => Number(a.done) - Number(b.done))
            .map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <span className="w-12 font-mono text-xs text-slate-400">{t.time ?? '—'}</span>
                <button
                  onClick={() => toggleTask(t.id)}
                  aria-label="Completa attività"
                  className={`flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 text-[9px] ${
                    t.done
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {t.done && '✓'}
                </button>
                <span className={`truncate ${t.done ? 'text-slate-400 line-through' : ''}`}>
                  {t.title}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Selettore periodo per grafici e report */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">📊 Statistiche</h2>
        <div className="flex overflow-hidden rounded-lg border border-slate-200 text-sm dark:border-slate-700">
          {(['week', 'month'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`cursor-pointer px-3 py-1.5 ${
                range === r
                  ? 'bg-indigo-600 font-medium text-white'
                  : 'bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400'
              }`}
            >
              {r === 'week' ? 'Settimana' : 'Mese'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold">⏱️ Minuti di focus al giorno</h3>
          <BarChart
            data={focusSeries}
            colorClass="bg-indigo-500"
            suffix=" min"
            labelEvery={range === 'week' ? 1 : 5}
          />
        </div>
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold">✅ Attività completate al giorno</h3>
          <BarChart
            data={tasksSeries}
            colorClass="bg-emerald-500"
            labelEvery={range === 'week' ? 1 : 5}
          />
        </div>
        <div className="card lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">🔁 Abitudini mantenute (%)</h3>
          <BarChart
            data={habitsSeries}
            colorClass="bg-violet-500"
            suffix="%"
            labelEvery={range === 'week' ? 1 : 5}
          />
        </div>
      </div>

      {/* Report testuale del periodo */}
      <div className="card">
        <h3 className="mb-2 text-sm font-semibold">
          📋 Report {range === 'week' ? 'settimanale' : 'mensile'}
        </h3>
        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <li>
            ⏱️ <strong>{fmtMinutes(periodFocus)}</strong> di focus in{' '}
            <strong>{periodSessions}</strong> sessioni
          </li>
          <li>
            ✅ <strong>{periodTasksDone}</strong> attività completate
          </li>
          <li>
            🔁 Abitudini mantenute in media al <strong>{avgHabits}%</strong>
          </li>
          {bestStreakHabit && bestStreakHabit.streak > 0 && (
            <li>
              🔥 Streak migliore: <strong>{bestStreakHabit.name}</strong> (
              {bestStreakHabit.streak} giorni)
            </li>
          )}
          {bestFocusDay.value > 0 && (
            <li>
              🏆 Giorno più produttivo:{' '}
              <strong>
                {parseDate(bestFocusDay.date).toLocaleDateString('it-IT', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </strong>{' '}
              con {fmtMinutes(bestFocusDay.value)} di focus
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function labelFor(date: string, range: Range): string {
  return range === 'week'
    ? parseDate(date).toLocaleDateString('it-IT', { weekday: 'short' })
    : String(parseDate(date).getDate());
}

function SummaryCard({
  icon,
  value,
  label,
  onClick,
}: {
  icon: string;
  value: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card cursor-pointer text-left transition hover:border-indigo-300 active:scale-95"
    >
      <span className="text-xl">{icon}</span>
      <p className="mt-1 text-xl font-bold">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </button>
  );
}
