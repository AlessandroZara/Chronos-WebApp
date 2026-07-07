export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const pad = (n: number) => String(n).padStart(2, '0');

/** Data locale in formato YYYY-MM-DD (niente UTC: evita slittamenti di giorno). */
export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayStr = () => localDateStr(new Date());

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr: string, n: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

/** Ultimi n giorni inclusa oggi, in ordine cronologico. */
export function lastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(todayStr(), -i));
  return out;
}

export function fmtDate(s: string): string {
  return parseDate(s).toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function fmtDateLong(s: string): string {
  return parseDate(s).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export const nowHM = () => new Date().toTimeString().slice(0, 5);

/** "HH:MM" corrente è dentro l'intervallo [start, end)? Gestisce intervalli a cavallo della mezzanotte. */
export function isTimeInRange(current: string, start: string, end: string): boolean {
  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end; // es. 20:00 -> 07:00
}

export function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent ?? '';
}

/** Estrae i titoli dei collegamenti [[wiki-style]] dal contenuto di una nota. */
export function extractWikiLinks(html: string): string[] {
  const text = stripHtml(html);
  const links = [...text.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim());
  return [...new Set(links.filter(Boolean))];
}

export function fmtMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function fmtCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad(m)}:${pad(s)}`;
}

import type { EventKind, ReminderUnit } from './types';

/** Icona, etichetta e colore del puntino per ogni tipo di evento. */
export const EVENT_KINDS: Record<EventKind, { label: string; icon: string; dot: string }> = {
  appuntamento: { label: 'Appuntamento', icon: '📌', dot: 'bg-sky-500' },
  lavoro: { label: 'Lavoro', icon: '💼', dot: 'bg-indigo-500' },
  personale: { label: 'Personale', icon: '🏠', dot: 'bg-emerald-500' },
  salute: { label: 'Salute', icon: '🩺', dot: 'bg-rose-500' },
  compleanno: { label: 'Compleanno', icon: '🎂', dot: 'bg-pink-500' },
  scadenza: { label: 'Scadenza', icon: '⏳', dot: 'bg-amber-500' },
  altro: { label: 'Altro', icon: '📎', dot: 'bg-slate-400' },
};

/** "30 minuti", "1 ora", "2 giorni"... per i messaggi dei promemoria. */
export function fmtOffset(value: number, unit: ReminderUnit): string {
  if (unit === 'min') return `${value} ${value === 1 ? 'minuto' : 'minuti'}`;
  if (unit === 'ore') return `${value} ${value === 1 ? 'ora' : 'ore'}`;
  return `${value} ${value === 1 ? 'giorno' : 'giorni'}`;
}

/** Millisecondi per unità di preavviso. */
export const UNIT_MS: Record<ReminderUnit, number> = {
  min: 60_000,
  ore: 3_600_000,
  giorni: 86_400_000,
};
