import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Priority, Task } from '../types';
import { useChronos } from '../store';
import { fmtDate, todayStr } from '../utils';

export const PRIORITY_META: Record<
  Priority,
  { label: string; chip: string; dot: string }
> = {
  alta: {
    label: 'Alta',
    chip: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    dot: 'bg-red-500',
  },
  media: {
    label: 'Media',
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  bassa: {
    label: 'Bassa',
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
};

const PRIORITY_WEIGHT: Record<Priority, number> = { alta: 0, media: 1, bassa: 2 };

type StatusFilter = 'tutte' | 'attive' | 'completate';

export default function Tasks() {
  const tasks = useChronos((s) => s.tasks);
  const addTask = useChronos((s) => s.addTask);
  const updateTask = useChronos((s) => s.updateTask);
  const toggleTask = useChronos((s) => s.toggleTask);
  const deleteTask = useChronos((s) => s.deleteTask);

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('media');
  const [due, setDue] = useState('');
  const [time, setTime] = useState('');
  const [reminder, setReminder] = useState(true);
  // Quando avvisare: quanti giorni prima della scadenza e a che ora.
  const [reminderDaysBefore, setReminderDaysBefore] = useState(0);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('tutte');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'tutte'>('tutte');

  const resetForm = () => {
    setTitle('');
    setPriority('media');
    setDue('');
    setTime('');
    setReminder(true);
    setReminderDaysBefore(0);
    setReminderTime('09:00');
    setEditingId(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const payload = {
      title: trimmed,
      priority,
      due: due || undefined,
      time: time || undefined,
      // Il promemoria ha senso solo con una scadenza da ricordare.
      reminder: reminder && !!due,
      reminderDaysBefore,
      reminderTime,
    };
    if (editingId) updateTask(editingId, payload);
    else addTask(payload);
    resetForm();
  };

  const startEdit = (t: Task) => {
    setEditingId(t.id);
    setTitle(t.title);
    setPriority(t.priority);
    setDue(t.due ?? '');
    setTime(t.time ?? '');
    setReminder(t.reminder);
    // Attività create prima del promemoria configurabile: stessi
    // ripieghi dello scheduler (giorno stesso, orario scadenza o 09:00).
    setReminderDaysBefore(t.reminderDaysBefore ?? 0);
    setReminderTime(t.reminderTime ?? t.time ?? '09:00');
  };

  const visible = tasks
    .filter((t) => {
      if (statusFilter === 'attive' && t.done) return false;
      if (statusFilter === 'completate' && !t.done) return false;
      if (priorityFilter !== 'tutte' && t.priority !== priorityFilter) return false;
      return true;
    })
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] ||
        (a.due ?? '9999').localeCompare(b.due ?? '9999')
    );

  const today = todayStr();
  const openCount = tasks.filter((t) => !t.done).length;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">✅ Attività</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {openCount === 0
            ? 'Tutto fatto! Nessuna attività aperta.'
            : `${openCount} attività aperte`}{' '}
          · le scadenze compaiono anche sul calendario
        </p>
      </header>

      {/* Form aggiunta / modifica */}
      <form onSubmit={submit} className="card space-y-3">
        <div>
          <label className="label" htmlFor="task-title">
            {editingId ? 'Modifica attività' : 'Nuova attività'}
          </label>
          <input
            id="task-title"
            className="input"
            placeholder="Cosa devi fare?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor="task-priority">Priorità</label>
            <select
              id="task-priority"
              className="input"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              <option value="alta">🔴 Alta</option>
              <option value="media">🟡 Media</option>
              <option value="bassa">🟢 Bassa</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="task-due">Scadenza</label>
            <input
              id="task-due"
              type="date"
              className="input"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="task-time">Ora</label>
            <input
              id="task-time"
              type="time"
              className="input"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div className="flex items-end pb-1">
            <label
              className={`flex items-center gap-2 text-sm ${
                due ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
              }`}
            >
              <input
                type="checkbox"
                checked={reminder && !!due}
                disabled={!due}
                onChange={(e) => setReminder(e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              🔔 Promemoria
            </label>
          </div>
        </div>

        {/* Quando avvisare: come per gli eventi a calendario, si sceglie
            il giorno (stesso giorno o in anticipo) e l'ora dell'avviso. */}
        {reminder && due && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500 dark:text-slate-400">Avvisami</span>
            <select
              id="task-reminder-days"
              className="input !w-auto"
              value={reminderDaysBefore}
              onChange={(e) => setReminderDaysBefore(Number(e.target.value))}
              aria-label="Quanti giorni prima avvisare"
            >
              <option value={0}>il giorno stesso</option>
              <option value={1}>1 giorno prima</option>
              <option value={2}>2 giorni prima</option>
              <option value={3}>3 giorni prima</option>
              <option value={7}>1 settimana prima</option>
            </select>
            <span className="text-slate-500 dark:text-slate-400">alle</span>
            <input
              id="task-reminder-time"
              type="time"
              className="input !w-28"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              aria-label="Ora del promemoria"
            />
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">
            {editingId ? '💾 Salva modifiche' : '➕ Aggiungi'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="btn-ghost">
              Annulla
            </button>
          )}
        </div>
      </form>

      {/* Filtri */}
      <div className="flex flex-wrap items-center gap-2">
        {(['tutte', 'attive', 'completate'] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`chip cursor-pointer capitalize ${
              statusFilter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {f}
          </button>
        ))}
        <span className="mx-1 text-slate-300 dark:text-slate-700">|</span>
        {(['tutte', 'alta', 'media', 'bassa'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setPriorityFilter(f)}
            className={`chip cursor-pointer capitalize ${
              priorityFilter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {f === 'tutte' ? 'ogni priorità' : f}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {visible.length === 0 && (
          <div className="card py-10 text-center text-sm text-slate-400">
            Nessuna attività qui. Aggiungine una sopra! 🎯
          </div>
        )}
        {visible.map((t) => {
          const overdue = !t.done && t.due !== undefined && t.due < today;
          return (
            <div
              key={t.id}
              className={`card flex items-center gap-3 !p-3 ${t.done ? 'opacity-60' : ''}`}
            >
              <button
                onClick={() => toggleTask(t.id)}
                aria-label={t.done ? 'Segna da fare' : 'Segna completata'}
                className={`flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 text-xs transition ${
                  t.done
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-300 hover:border-indigo-500 dark:border-slate-600'
                }`}
              >
                {t.done && '✓'}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${t.done ? 'line-through' : ''}`}>
                  {t.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={`chip ${PRIORITY_META[t.priority].chip}`}>
                    {PRIORITY_META[t.priority].label}
                  </span>
                  {t.due && (
                    <span
                      className={`chip ${
                        overdue
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      📅 {fmtDate(t.due)}
                      {t.time && ` · ${t.time}`}
                      {overdue && ' · in ritardo'}
                    </span>
                  )}
                  {t.reminder && t.due && !t.done && (
                    <span className="chip bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      🔔{' '}
                      {(t.reminderDaysBefore ?? 0) === 0
                        ? 'stesso giorno'
                        : t.reminderDaysBefore === 7
                          ? '1 sett. prima'
                          : `${t.reminderDaysBefore}g prima`}
                      {` · ${t.reminderTime ?? t.time ?? '09:00'}`}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => startEdit(t)} className="btn-ghost !p-2" aria-label="Modifica">
                ✏️
              </button>
              <button
                onClick={() => deleteTask(t.id)}
                className="btn-danger !p-2"
                aria-label="Elimina"
              >
                🗑️
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
