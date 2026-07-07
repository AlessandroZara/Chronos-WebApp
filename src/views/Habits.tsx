import { useState } from 'react';
import type { FormEvent } from 'react';
import { habitStreak, useChronos } from '../store';
import { askConfirm } from '../components/ConfirmDialog';
import { lastNDays, parseDate, todayStr } from '../utils';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];

export default function Habits() {
  const habits = useChronos((s) => s.habits);
  const addHabit = useChronos((s) => s.addHabit);
  const updateHabit = useChronos((s) => s.updateHabit);
  const deleteHabit = useChronos((s) => s.deleteHabit);
  const toggleHabitDay = useChronos((s) => s.toggleHabitDay);

  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [reminderTime, setReminderTime] = useState('');

  const week = lastNDays(7);
  const month = lastNDays(28);
  const today = todayStr();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    addHabit({ name: trimmed, color, reminderTime: reminderTime || undefined });
    setName('');
    setReminderTime('');
  };

  // Percentuale di completamento negli ultimi 28 giorni,
  // contando solo i giorni da quando l'abitudine esiste.
  const completionPct = (habit: (typeof habits)[number]) => {
    const days = month.filter((d) => d >= habit.createdAt);
    if (days.length === 0) return 0;
    const done = days.filter((d) => habit.days[d]).length;
    return Math.round((done / days.length) * 100);
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">🔁 Abitudini</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Piccoli passi ogni giorno · i promemoria arrivano come notifiche
        </p>
      </header>

      {/* Form nuova abitudine */}
      <form onSubmit={submit} className="card space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="min-w-48 flex-1">
            <label className="label" htmlFor="habit-name">Nuova abitudine</label>
            <input
              id="habit-name"
              className="input"
              placeholder="Es. Leggere 20 minuti"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="habit-reminder">Promemoria (opzionale)</label>
            <input
              id="habit-reminder"
              type="time"
              className="input"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="label !mb-0">Colore</span>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-7 w-7 cursor-pointer rounded-full transition ${
                color === c ? 'scale-110 ring-2 ring-slate-400 ring-offset-2 dark:ring-offset-slate-900' : ''
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Colore ${c}`}
            />
          ))}
          <button type="submit" className="btn-primary ml-auto">
            ➕ Aggiungi
          </button>
        </div>
      </form>

      {habits.length === 0 && (
        <div className="card py-10 text-center text-sm text-slate-400">
          Nessuna abitudine ancora. Inizia con qualcosa di piccolo! 🌱
        </div>
      )}

      {habits.map((h) => {
        const streak = habitStreak(h);
        return (
          <div key={h.id} className="card space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: h.color }} />
              <h2 className="flex-1 truncate font-semibold">{h.name}</h2>
              {streak > 0 && (
                <span className="chip bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                  🔥 {streak} {streak === 1 ? 'giorno' : 'giorni'}
                </span>
              )}
              <button
                onClick={async () => {
                  if (await askConfirm(`Eliminare l'abitudine "${h.name}"?`, 'Elimina'))
                    deleteHabit(h.id);
                }}
                className="btn-danger !p-1.5"
                aria-label="Elimina abitudine"
              >
                🗑️
              </button>
            </div>

            {/* Ultimi 7 giorni: tocca per segnare fatto/non fatto */}
            <div className="flex justify-between gap-1 sm:justify-start sm:gap-2">
              {week.map((d) => {
                const done = !!h.days[d];
                const initial = parseDate(d)
                  .toLocaleDateString('it-IT', { weekday: 'short' })
                  .slice(0, 2);
                return (
                  <div key={d} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-slate-400 uppercase">{initial}</span>
                    <button
                      onClick={() => toggleHabitDay(h.id, d)}
                      aria-label={`${h.name} — ${d}`}
                      className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 text-sm font-semibold transition active:scale-90 ${
                        d === today ? 'ring-2 ring-indigo-400 ring-offset-1 dark:ring-offset-slate-900' : ''
                      }`}
                      style={
                        done
                          ? { backgroundColor: h.color, borderColor: h.color, color: '#fff' }
                          : { borderColor: 'rgb(148 163 184 / .5)' }
                      }
                    >
                      {done ? '✓' : parseDate(d).getDate()}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Mini-griglia degli ultimi 28 giorni (stile GitHub) */}
            <div className="flex flex-wrap items-center gap-1">
              {month.map((d) => (
                <span
                  key={d}
                  title={d}
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{
                    backgroundColor: h.days[d] ? h.color : 'rgb(148 163 184 / .25)',
                  }}
                />
              ))}
              <span className="ml-2 text-xs text-slate-400">
                {completionPct(h)}% negli ultimi 28 giorni
              </span>
            </div>

            {/* Promemoria modificabile al volo */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500 dark:text-slate-400">🔔 Promemoria:</span>
              <input
                type="time"
                className="input !w-28 !py-1"
                value={h.reminderTime ?? ''}
                onChange={(e) =>
                  updateHabit(h.id, { reminderTime: e.target.value || undefined })
                }
              />
              {h.reminderTime && (
                <button
                  onClick={() => updateHabit(h.id, { reminderTime: undefined })}
                  className="btn-ghost !px-2 !py-1 text-xs"
                >
                  Rimuovi
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
