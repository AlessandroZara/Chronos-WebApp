import { useState } from 'react';
import type { FormEvent } from 'react';
import { useChronos } from '../store';
import { pullNow, updateProfile, useSyncStatus } from '../sync';

/*
 * Pagina "Il mio account": mostra i dati dell'utente salvati nel database
 * e permette di modificarli (nome, cognome, email, password).
 * Da qui si effettua anche il logout, che riporta alla schermata di accesso.
 */
export default function AccountView({ onBack }: { onBack: () => void }) {
  const auth = useChronos((s) => s.auth);
  const setAuth = useChronos((s) => s.setAuth);
  const logout = useChronos((s) => s.logout);
  const syncStatus = useSyncStatus();

  // Copie locali dei dati del profilo: si salvano solo premendo il pulsante.
  const [firstName, setFirstName] = useState(auth.user?.firstName ?? '');
  const [lastName, setLastName] = useState(auth.user?.lastName ?? '');
  const [email, setEmail] = useState(auth.user?.email ?? '');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  const initials =
    (auth.user?.firstName?.[0] ?? '') + (auth.user?.lastName?.[0] ?? '');

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProfileMsg(null);
    try {
      const user = await updateProfile({ firstName, lastName, email });
      setAuth({ user }); // aggiorna anche il chip nella dashboard
      setProfileMsg('✅ Profilo aggiornato nel database!');
    } catch (err) {
      setProfileMsg(`❌ ${err instanceof Error ? err.message : 'Errore imprevisto.'}`);
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setPasswordMsg(null);
    try {
      // L'endpoint aggiorna sempre anche i dati anagrafici:
      // passiamo quelli correnti insieme alle password.
      const user = await updateProfile({
        firstName,
        lastName,
        email,
        currentPassword,
        newPassword,
      });
      setAuth({ user });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordMsg('✅ Password cambiata! Usala dal prossimo accesso.');
    } catch (err) {
      setPasswordMsg(`❌ ${err instanceof Error ? err.message : 'Errore imprevisto.'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button onClick={onBack} className="btn-ghost" aria-label="Torna alla dashboard">
          ←
        </button>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-lg font-bold text-white uppercase">
          {initials || '👤'}
        </span>
        <div>
          <h1 className="text-2xl font-bold">Il mio account</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{auth.user?.email}</p>
        </div>
      </header>

      {/* ---- Dati del profilo (modificabili) ---- */}
      <form onSubmit={saveProfile} className="card space-y-3">
        <h2 className="font-semibold">📇 Dati del profilo</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="acc-firstname">Nome</label>
            <input
              id="acc-firstname"
              className="input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="acc-lastname">Cognome</label>
            <input
              id="acc-lastname"
              className="input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="acc-email">Email (usata per accedere)</label>
          <input
            id="acc-email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {profileMsg && <p className="text-sm">{profileMsg}</p>}
        <button type="submit" disabled={busy} className="btn-primary">
          💾 Salva modifiche
        </button>
      </form>

      {/* ---- Cambio password ---- */}
      <form onSubmit={savePassword} className="card space-y-3">
        <h2 className="font-semibold">🔐 Cambia password</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="acc-current-pw">Password attuale</label>
            <input
              id="acc-current-pw"
              type={showPasswords ? 'text' : 'password'}
              className="input"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="acc-new-pw">Nuova password</label>
            <div className="relative">
              <input
                id="acc-new-pw"
                type={showPasswords ? 'text' : 'password'}
                className="input !pr-10"
                placeholder="Almeno 8 caratteri"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                aria-label={showPasswords ? 'Nascondi password' : 'Mostra password'}
                className="absolute inset-y-0 right-0 flex cursor-pointer items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPasswords ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
        </div>
        {passwordMsg && <p className="text-sm">{passwordMsg}</p>}
        <button type="submit" disabled={busy} className="btn-primary">
          🔑 Aggiorna password
        </button>
      </form>

      {/* ---- Sincronizzazione ---- */}
      <section className="card space-y-2">
        <h2 className="font-semibold">☁️ Sincronizzazione</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          I dati di questo account sono salvati sul server e disponibili su ogni
          dispositivo in cui accedi con la stessa email.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Stato:{' '}
          {syncStatus.status === 'off' && '⚪ non attiva'}
          {syncStatus.status === 'idle' && '🟢 allineata'}
          {syncStatus.status === 'syncing' && '🔵 sincronizzazione…'}
          {syncStatus.status === 'error' && `🔴 errore: ${syncStatus.error}`}
          {syncStatus.lastSync &&
            ` · ultima sync ${new Date(syncStatus.lastSync).toLocaleTimeString('it-IT')}`}
        </p>
        <button
          onClick={() => void pullNow()}
          className="btn-ghost border border-slate-200 dark:border-slate-700"
        >
          🔄 Sincronizza ora
        </button>
      </section>

      {/* ---- Logout ---- */}
      <section className="card space-y-2 !border-red-200 dark:!border-red-900">
        <h2 className="font-semibold">🚪 Esci dall'account</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Tornerai alla schermata di accesso. I dati non ancora sincronizzati su
          questo dispositivo andranno persi.
        </p>
        <button
          onClick={() => {
            if (confirm('Uscire dall\'account e tornare alla schermata di login?')) logout();
          }}
          className="btn-danger border border-red-200 dark:border-red-900"
        >
          🚪 Esci
        </button>
      </section>
    </div>
  );
}
