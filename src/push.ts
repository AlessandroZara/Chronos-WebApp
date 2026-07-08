/*
 * Web Push: gestione della subscription lato browser.
 *
 * Questo modulo è il primo tassello delle notifiche "vere" (quelle che
 * arrivano anche ad app e browser chiusi): crea e mantiene la
 * subscription push del dispositivo. L'invio dei promemoria dal server
 * (api.php + cron) arriverà con lo step successivo — per ora la
 * subscription viene salvata in locale, pronta da spedire al backend.
 *
 * Nessun import dagli altri moduli dell'app: così notifications.ts può
 * importare da qui senza creare cicli.
 */

/**
 * Chiave pubblica VAPID della coppia generata con
 * `node tools/generate-vapid-keys.mjs` (la privata è in
 * server/push-config.php, fuori dal repository). È pubblica per natura:
 * il browser la consegna al push service per legare la subscription al
 * nostro server. Se rigeneri le chiavi va aggiornata anche qui.
 */
export const VAPID_PUBLIC_KEY =
  'BLu2KiscmXimBR_cvmM5MN0rJyzzRWifs4U0ZI9XrGOerKprJNCPE9eGnAspPQ0JYoGyihPQpAvgVsxiDy89n9Y';

/** Copia locale dell'ultima subscription creata (per il futuro invio al server). */
const SUBSCRIPTION_KEY = 'chronos-push-subscription';

/** true se il browser ha tutto ciò che serve per il Web Push. */
export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Converte la chiave base64url nel formato binario richiesto da
 * `pushManager.subscribe` (alcuni browser non accettano la stringa).
 */
function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Garantisce che il dispositivo abbia una subscription push attiva:
 * riusa quella esistente o ne crea una nuova. Da chiamare quando il
 * permesso notifiche è (o diventa) concesso; con permesso mancante o
 * browser non compatibile non fa nulla.
 *
 * Restituisce la subscription in formato JSON (endpoint + chiavi) o
 * null se non è stato possibile crearla: in quel caso l'app continua
 * a funzionare con le sole notifiche locali.
 */
export async function ensurePushSubscription(): Promise<PushSubscriptionJSON | null> {
  if (!pushSupported() || Notification.permission !== 'granted') return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return null; // service worker non (ancora) registrato

    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        // Obbligatorio: ogni push deve produrre una notifica visibile,
        // niente push "silenziosi" (è una regola dei browser).
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }));

    const json = sub.toJSON();
    localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(json));
    // PROSSIMO STEP: inviare `json` ad api.php (action=push-subscribe)
    // per salvarla nel database insieme all'utente, così il cron potrà
    // spedire i promemoria a questo dispositivo.
    return json;
  } catch {
    // Push service non raggiungibile (es. rete aziendale, browser senza
    // servizio push): nessun danno, restano le notifiche locali.
    return null;
  }
}
