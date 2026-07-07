import { useState } from 'react';
import type { FormEvent } from 'react';
import type { CalEvent, EventKind, ReminderUnit } from '../types';
import { useChronos } from '../store';
import { askConfirm } from '../components/ConfirmDialog';
import { EVENT_KINDS, fmtDateLong, fmtOffset, localDateStr, todayStr } from '../utils';
import { PRIORITY_META } from './Tasks';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export default function CalendarView() {
  const tasks = useChronos((s) => s.tasks);
  const events = useChronos((s) => s.events);
  const addEvent = useChronos((s) => s.addEvent);
  const updateEvent = useChronos((s) => s.updateEvent);
  const deleteEvent = useChronos((s) => s.deleteEvent);
  const toggleTask = useChronos((s) => s.toggleTask);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [selected, setSelected] = useState(todayStr());

  const [evTitle, setEvTitle] = useState('');
  const [evTime, setEvTime] = useState('');
  const [evKind, setEvKind] = useState<EventKind>('appuntamento');
  const [evReminder, setEvReminder] = useState(true);
  // Preavviso: "avvisami X minuti/ore/giorni prima dell'evento".
  const [evRemValue, setEvRemValue] = useState(30);
  const [evRemUnit, setEvRemUnit] = useState<ReminderUnit>('min');
  // Se valorizzato, il form sta MODIFICANDO un evento esistente.
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const resetEventForm = () => {
    setEvTitle('');
    setEvTime('');
    setEvKind('appuntamento');
    setEvReminder(true);
    setEvRemValue(30);
    setEvRemUnit('min');
    setEditingEventId(null);
  };

  // Carica i dati di un evento nel form per modificarlo.
  const startEditEvent = (e: CalEvent) => {
    setEditingEventId(e.id);
    setEvTitle(e.title);
    setEvTime(e.time ?? '');
    setEvKind(e.kind ?? 'appuntamento');
    setEvReminder(e.reminder);
    setEvRemValue(e.reminderValue ?? 30);
    setEvRemUnit(e.reminderUnit ?? 'min');
    setSelected(e.date); // porta la selezione sul giorno dell'evento
  };

  const today = todayStr();

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelected(today);
  };

  // Griglia 6x7 con lunedì come primo giorno.
  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(year, month, 1 - firstOffset + i);
    return { date: localDateStr(d), inMonth: d.getMonth() === month, dayNum: d.getDate() };
  });

  const tasksOn = (date: string) => tasks.filter((t) => t.due === date);
  const eventsOn = (date: string) =>
    events
      .filter((e) => e.date === date)
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));

  const submitEvent = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = evTitle.trim();
    if (!trimmed) return;
    const payload = {
      title: trimmed,
      // In modifica, il giorno selezionato diventa la (eventuale nuova) data:
      // così si può anche spostare un evento a un altro giorno.
      date: selected,
      time: evTime || undefined,
      kind: evKind,
      reminder: evReminder,
      // Il preavviso viene salvato solo se il promemoria è attivo.
      reminderValue: evReminder ? evRemValue : undefined,
      reminderUnit: evReminder ? evRemUnit : undefined,
    };
    if (editingEventId) updateEvent(editingEventId, payload);
    else addEvent(payload);
    resetEventForm();
  };

  const monthLabel = new Date(year, month, 1).toLocaleDateString('it-IT', {
    month: 'long',
    year: 'numeric',
  });

  const selTasks = tasksOn(selected);
  const selEvents = eventsOn(selected);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">📅 Calendario</h1>
          <p className="text-sm text-slate-500 capitalize dark:text-slate-400">{monthLabel}</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => shiftMonth(-1)} className="btn-ghost" aria-label="Mese precedente">
            ‹
          </button>
          <button onClick={goToday} className="btn-ghost">
            Oggi
          </button>
          <button onClick={() => shiftMonth(1)} className="btn-ghost" aria-label="Mese successivo">
            ›
          </button>
        </div>
      </header>

      <div className="card !p-2 sm:!p-4">
        <div className="mb-1 grid grid-cols-7">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1 text-center text-xs font-semibold text-slate-400">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c) => {
            const dayTasks = tasksOn(c.date);
            const dayEvents = eventsOn(c.date);
            const isSelected = c.date === selected;
            const isToday = c.date === today;
            return (
              <button
                key={c.date}
                onClick={() => setSelected(c.date)}
                className={`flex min-h-14 cursor-pointer flex-col items-center rounded-lg p-1 text-sm transition sm:min-h-16 ${
                  isSelected
                    ? 'bg-indigo-600 text-white'
                    : c.inMonth
                      ? 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      : 'text-slate-300 dark:text-slate-600'
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday && !isSelected ? 'bg-indigo-100 font-bold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300' : ''
                  } ${isToday && isSelected ? 'font-bold' : ''}`}
                >
                  {c.dayNum}
                </span>
                <span className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                  {dayTasks.slice(0, 3).map((t) => (
                    <span
                      key={t.id}
                      className={`h-1.5 w-1.5 rounded-full ${
                        isSelected ? 'bg-white' : PRIORITY_META[t.priority].dot
                      } ${t.done ? 'opacity-40' : ''}`}
                    />
                  ))}
                  {dayEvents.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className={`h-1.5 w-1.5 rounded-full ${
                        isSelected ? 'bg-white' : EVENT_KINDS[e.kind ?? 'appuntamento'].dot
                      }`}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-4 px-1 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> attività
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> eventi
          </span>
        </div>
      </div>

      {/* Dettaglio del giorno selezionato */}
      <div className="card space-y-3">
        <h2 className="font-semibold capitalize">{fmtDateLong(selected)}</h2>

        <form
          onSubmit={submitEvent}
          className="space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60"
        >
          {/* Intestazione esplicita: si capisce subito a cosa serve il form */}
          <p className="label !mb-1">
            {editingEventId
              ? '✏️ Stai modificando l\'evento'
              : '➕ Nuovo evento, appuntamento o impegno'}
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              className="input min-w-40 flex-1"
              placeholder="Es. Dentista, riunione, compleanno…"
              value={evTitle}
              onChange={(e) => setEvTitle(e.target.value)}
            />
            {/* Tipo di evento: determina icona e colore nel calendario */}
            <select
              className="input w-auto"
              value={evKind}
              onChange={(e) => setEvKind(e.target.value as EventKind)}
              aria-label="Tipo di evento"
            >
              {Object.entries(EVENT_KINDS).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.icon} {meta.label}
                </option>
              ))}
            </select>
            <input
              type="time"
              className="input w-28"
              value={evTime}
              onChange={(e) => setEvTime(e.target.value)}
            />
          </div>
          {/* Promemoria anticipato: quanto tempo prima ricevere la notifica */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={evReminder}
                onChange={(e) => setEvReminder(e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              🔔 Avvisami
            </label>
            {evReminder && (
              <>
                <input
                  type="number"
                  min={1}
                  max={999}
                  className="input !w-20 !py-1"
                  value={evRemValue}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 1) setEvRemValue(v);
                  }}
                  aria-label="Quanto tempo prima"
                />
                <select
                  className="input !w-auto !py-1"
                  value={evRemUnit}
                  onChange={(e) => setEvRemUnit(e.target.value as ReminderUnit)}
                  aria-label="Unità di tempo"
                >
                  <option value="min">minuti</option>
                  <option value="ore">ore</option>
                  <option value="giorni">giorni</option>
                </select>
                <span className="text-slate-500 dark:text-slate-400">prima dell'evento</span>
              </>
            )}
          </div>
          {/* Pulsante con etichetta chiara (niente più "+" solitario) */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="submit" className="btn-primary">
              {editingEventId ? '💾 Salva modifiche' : '➕ Aggiungi al calendario'}
            </button>
            {editingEventId && (
              <>
                <button type="button" onClick={resetEventForm} className="btn-ghost">
                  Annulla
                </button>
                <span className="text-xs text-slate-400">
                  💡 Seleziona un altro giorno per spostare l'evento
                </span>
              </>
            )}
          </div>
        </form>

        {selEvents.length === 0 && selTasks.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-400">
            Giornata libera — nessun impegno. 🌤️
          </p>
        )}

        {selEvents.map((e) => {
          const kind = EVENT_KINDS[e.kind ?? 'appuntamento'];
          return (
            <div
              key={e.id}
              className="flex items-center gap-3 rounded-lg bg-sky-50 p-2.5 dark:bg-sky-950/50"
            >
              <span title={kind.label}>{kind.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {kind.label} · {e.time ? `ore ${e.time}` : 'tutto il giorno'}
                  {e.reminder &&
                    e.reminderValue &&
                    e.reminderUnit &&
                    ` · 🔔 ${fmtOffset(e.reminderValue, e.reminderUnit)} prima`}
                </p>
              </div>
              <button
                onClick={() => startEditEvent(e)}
                className="btn-ghost !p-1.5"
                aria-label="Modifica evento"
              >
                ✏️
              </button>
              <button
                onClick={async () => {
                  if (await askConfirm(`Eliminare "${e.title}" dal calendario?`, 'Elimina'))
                    deleteEvent(e.id);
                }}
                className="btn-danger !p-1.5"
                aria-label="Elimina evento"
              >
                🗑️
              </button>
            </div>
          );
        })}

        {selTasks.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/60 ${
              t.done ? 'opacity-60' : ''
            }`}
          >
            <button
              onClick={() => toggleTask(t.id)}
              aria-label={t.done ? 'Segna da fare' : 'Segna completata'}
              className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 text-[10px] ${
                t.done
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
            >
              {t.done && '✓'}
            </button>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-medium ${t.done ? 'line-through' : ''}`}>
                {t.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Attività · priorità {t.priority}
                {t.time && ` · ore ${t.time}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
