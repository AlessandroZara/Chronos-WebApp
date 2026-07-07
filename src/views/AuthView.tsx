import { useState } from 'react';
import type { FormEvent } from 'react';
import { useChronos } from '../store';
import { authRequest, pullNow } from '../sync';

/*
 * Schermata di accesso / registrazione, mostrata al posto dell'app
 * finché non c'è un utente loggato. Dopo il login il token personale
 * viene salvato in locale: da quel momento la sincronizzazione con il
 * server è automatica e la schermata non ricompare più (fino al logout).
 */
export default function AuthView() {
  const auth = useChronos((s) => s.auth);
  const setAuth = useChronos((s) => s.setAuth);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // occhiolino 👁
  const [apiUrl, setApiUrl] = useState(auth.apiUrl);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payload: Record<string, string> =
        mode === 'login'
          ? { email, password }
          : { firstName, lastName, email, password };
      const { token, user } = await authRequest(apiUrl.trim(), mode, payload);
      // Sessione salvata: da qui in poi l'app è "collegata" su questo dispositivo.
      setAuth({ token, user, apiUrl: apiUrl.trim() });
      void pullNow(); // scarica subito i dati dell'account dal server
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore imprevisto, riprova.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-6 text-center">
          <div className="text-5xl">⏳</div>
          <h1 className="mt-2 bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-3xl font-bold text-transparent">
            Chronos
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            La tua produttività, ovunque tu sia
          </p>
        </div>

        <div className="card space-y-4 !p-6">
          {/* Selettore Accedi / Registrati */}
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 text-sm dark:border-slate-700">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`cursor-pointer py-2 font-medium transition ${
                  mode === m
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400'
                }`}
              >
                {m === 'login' ? 'Accedi' : 'Registrati'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'register' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="auth-firstname">Nome</label>
                  <input
                    id="auth-firstname"
                    className="input"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="auth-lastname">Cognome</label>
                  <input
                    id="auth-lastname"
                    className="input"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {/* Email sopra... */}
            <div>
              <label className="label" htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                type="email"
                className="input"
                placeholder="nome@esempio.it"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* ...password sotto, con l'occhiolino per mostrarla/nasconderla */}
            <div>
              <label className="label" htmlFor="auth-password">Password</label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  className="input !pr-10"
                  placeholder={mode === 'register' ? 'Almeno 8 caratteri' : '••••••••'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={mode === 'register' ? 8 : undefined}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                  className="absolute inset-y-0 right-0 flex cursor-pointer items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full !py-2.5">
              {busy ? '⏳ Attendi…' : mode === 'login' ? '🔓 Accedi' : '✨ Crea account'}
            </button>
          </form>

          {/* Impostazione avanzata: dove si trova il server (di norma
              non va toccata — viene rilevata da sola). */}
          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer select-none">Impostazioni avanzate</summary>
            <div className="mt-2">
              <label className="label" htmlFor="auth-server">Indirizzo del server (api.php)</label>
              <input
                id="auth-server"
                type="url"
                className="input"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
            </div>
          </details>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          I tuoi dati restano tuoi: salvati sul tuo dispositivo e sul tuo server.
        </p>
      </div>
    </div>
  );
}
