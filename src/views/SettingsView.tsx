import { useRef, useState } from 'react';
import { useChronos } from '../store';
import {
  notificationsSupported,
  notify,
  requestNotificationPermission,
} from '../notifications';
import { pullNow, useSyncStatus } from '../sync';
import { todayStr } from '../utils';

export default function SettingsView() {
  const settings = useChronos((s) => s.settings);
  const setSettings = useChronos((s) => s.setSettings);
  const setTimer = useChronos((s) => s.setTimer);
  const timer = useChronos((s) => s.timer);
  const exportData = useChronos((s) => s.exportData);
  const importData = useChronos((s) => s.importData);
  const resetAll = useChronos((s) => s.resetAll);

  const auth = useChronos((s) => s.auth);
  const logout = useChronos((s) => s.logout);

  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const syncStatus = useSyncStatus();

  const p = settings.pomodoro;

  // Aggiorna una durata del pomodoro; se il timer è fermo lo riallinea
  // subito alla nuova durata, così il quadrante non mostra valori vecchi.
  const setPomodoro = (patch: Partial<typeof p>) => {
    const next = { ...p, ...patch };
    setSettings({ pomodoro: next });
    if (!timer.running) {
      const minutes =
        timer.mode === 'work' ? next.work : timer.mode === 'short' ? next.short : next.long;
      setTimer({ remaining: minutes * 60, endAt: null });
    }
  };

  const toggleNotifications = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestNotificationPermission();
      setSettings({ notifEnabled: true });
      if (!granted) {
        notify(
          'ℹ️ Notifiche di sistema non attive',
          'Riceverai comunque gli avvisi dentro l\'app. Controlla i permessi del browser per quelle di sistema.'
        );
      }
    } else {
      setSettings({ notifEnabled: false });
    }
  };

  // Scarica tutti i dati come file JSON.
  const doExport = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronos-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (file: File) => {
    const text = await file.text();
    const ok = importData(text);
    setImportMsg(
      ok
        ? '✅ Backup importato con successo!'
        : '❌ File non valido: assicurati che sia un backup di Chronos.'
    );
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">⚙️ Impostazioni</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Personalizza Chronos come preferisci
        </p>
      </header>

      {/* ---- Aspetto ---- */}
      <section className="card space-y-3">
        <h2 className="font-semibold">🎨 Aspetto</h2>
        <div>
          <label className="label" htmlFor="theme-select">Tema</label>
          <select
            id="theme-select"
            className="input"
            value={settings.theme}
            onChange={(e) =>
              setSettings({ theme: e.target.value as typeof settings.theme })
            }
          >
            <option value="light">☀️ Chiaro</option>
            <option value="dark">🌙 Scuro</option>
            <option value="auto">🕐 Automatico in base all'orario</option>
          </select>
        </div>
        {settings.theme === 'auto' && (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="dark-start">Tema scuro dalle</label>
              <input
                id="dark-start"
                type="time"
                className="input"
                value={settings.darkStart}
                onChange={(e) => setSettings({ darkStart: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="dark-end">alle</label>
              <input
                id="dark-end"
                type="time"
                className="input"
                value={settings.darkEnd}
                onChange={(e) => setSettings({ darkEnd: e.target.value })}
              />
            </div>
          </div>
        )}
      </section>

      {/* ---- Pomodoro ---- */}
      <section className="card space-y-3">
        <h2 className="font-semibold">🍅 Focus Timer</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumberField
            label="Focus (min)"
            value={p.work}
            min={5}
            max={120}
            onChange={(v) => setPomodoro({ work: v })}
          />
          <NumberField
            label="Pausa breve"
            value={p.short}
            min={1}
            max={30}
            onChange={(v) => setPomodoro({ short: v })}
          />
          <NumberField
            label="Pausa lunga"
            value={p.long}
            min={5}
            max={60}
            onChange={(v) => setPomodoro({ long: v })}
          />
          <NumberField
            label="Cicli"
            value={p.cycles}
            min={2}
            max={8}
            onChange={(v) => setPomodoro({ cycles: v })}
          />
        </div>
      </section>

      {/* ---- Notifiche ---- */}
      <section className="card space-y-3">
        <h2 className="font-semibold">🔔 Notifiche</h2>
        {!notificationsSupported() && (
          <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            Questo browser non supporta le notifiche di sistema: riceverai solo gli
            avvisi dentro l'app. Su iPhone/iPad installa prima Chronos nella schermata
            Home (Condividi → Aggiungi a Home).
          </p>
        )}
        <ToggleRow
          label="Notifiche attive"
          checked={settings.notifEnabled}
          onChange={toggleNotifications}
        />
        <ToggleRow
          label="Promemoria attività"
          checked={settings.notifTasks}
          disabled={!settings.notifEnabled}
          onChange={(v) => setSettings({ notifTasks: v })}
        />
        <ToggleRow
          label="Promemoria eventi"
          checked={settings.notifEvents}
          disabled={!settings.notifEnabled}
          onChange={(v) => setSettings({ notifEvents: v })}
        />
        <ToggleRow
          label="Promemoria abitudini"
          checked={settings.notifHabits}
          disabled={!settings.notifEnabled}
          onChange={(v) => setSettings({ notifHabits: v })}
        />
        <ToggleRow
          label="Riepilogo giornaliero (attività, eventi, abitudini)"
          checked={settings.notifDaily}
          disabled={!settings.notifEnabled}
          onChange={(v) => setSettings({ notifDaily: v })}
        />
        {settings.notifDaily && settings.notifEnabled && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500 dark:text-slate-400">🌅 Orario del riepilogo:</span>
            <input
              type="time"
              className="input !w-28 !py-1"
              value={settings.dailyTime}
              onChange={(e) => setSettings({ dailyTime: e.target.value })}
            />
          </div>
        )}
        <button
          onClick={() => notify('🔔 Notifica di prova', 'Le notifiche funzionano! 🎉')}
          className="btn-ghost border border-slate-200 dark:border-slate-700"
        >
          Invia notifica di prova
        </button>
      </section>

      {/* ---- Backup ---- */}
      <section className="card space-y-3">
        <h2 className="font-semibold">💾 Backup e dati</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          I dati vivono in locale su questo dispositivo (e sul tuo server, se
          attivi la sincronizzazione qui sotto). Il backup JSON resta utile come
          copia di sicurezza da conservare dove preferisci.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={doExport} className="btn-primary">
            ⬇️ Esporta backup
          </button>
          <button onClick={() => fileRef.current?.click()} className="btn-ghost border border-slate-200 dark:border-slate-700">
            ⬆️ Importa backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void doImport(file);
              e.target.value = ''; // permette di reimportare lo stesso file
            }}
          />
        </div>
        {importMsg && <p className="text-sm">{importMsg}</p>}
      </section>

      {/* ---- Account e sincronizzazione ---- */}
      <section className="card space-y-3">
        <h2 className="font-semibold">👤 Account</h2>
        <p className="text-sm">
          Connesso come{' '}
          <strong>
            {auth.user?.firstName} {auth.user?.lastName}
          </strong>{' '}
          <span className="text-slate-500 dark:text-slate-400">({auth.user?.email})</span>
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          I tuoi dati si sincronizzano automaticamente con il server: accedi con le
          stesse credenziali da telefono, tablet o computer e ritrovi tutto.
        </p>
        {/* Riga di stato: cosa sta facendo la sync in questo momento */}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Stato:{' '}
          {syncStatus.status === 'off' && '⚪ non attiva'}
          {syncStatus.status === 'idle' && '🟢 allineata'}
          {syncStatus.status === 'syncing' && '🔵 sincronizzazione…'}
          {syncStatus.status === 'error' && `🔴 errore: ${syncStatus.error}`}
          {syncStatus.lastSync &&
            ` · ultima sync ${new Date(syncStatus.lastSync).toLocaleTimeString('it-IT')}`}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void pullNow()}
            className="btn-ghost border border-slate-200 dark:border-slate-700"
          >
            🔄 Sincronizza ora
          </button>
          <button
            onClick={() => {
              if (
                confirm(
                  'Uscire dall\'account? I dati non ancora sincronizzati su questo dispositivo andranno persi.'
                )
              )
                logout();
            }}
            className="btn-danger border border-red-200 dark:border-red-900"
          >
            🚪 Esci
          </button>
        </div>
      </section>

      {/* ---- Installazione PWA ---- */}
      <section className="card space-y-2">
        <h2 className="font-semibold">📱 Installa sul telefono</h2>
        <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>
            <strong>Android (Chrome):</strong> menu ⋮ → «Installa app» oppure «Aggiungi a
            schermata Home».
          </li>
          <li>
            <strong>iPhone/iPad (Safari):</strong> pulsante Condividi → «Aggiungi alla
            schermata Home».
          </li>
          <li>
            <strong>Desktop (Chrome/Edge):</strong> icona di installazione nella barra
            degli indirizzi.
          </li>
        </ul>
      </section>

      {/* ---- Zona pericolosa ---- */}
      <section className="card space-y-2 !border-red-200 dark:!border-red-900">
        <h2 className="font-semibold text-red-600 dark:text-red-400">⚠️ Zona pericolosa</h2>
        <button
          onClick={() => {
            if (confirm('Cancellare TUTTI i dati di Chronos? L\'operazione non è reversibile.'))
              resetAll();
          }}
          className="btn-danger border border-red-200 dark:border-red-900"
        >
          🗑️ Cancella tutti i dati
        </button>
      </section>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        className="input"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v >= min && v <= max) onChange(v);
        }}
      />
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center justify-between text-sm ${
        disabled ? 'opacity-50' : 'cursor-pointer'
      }`}
    >
      {label}
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-indigo-600"
      />
    </label>
  );
}
