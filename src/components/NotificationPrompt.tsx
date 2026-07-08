import { useState } from 'react';
import { useChronos } from '../store';
import {
  isIOS,
  isStandalone,
  notificationsSupported,
  notifUnblockInstructions,
  notify,
  requestNotificationPermission,
} from '../notifications';

/*
 * Ricorda in quale stato del permesso l'utente ha chiuso il banner.
 * Salvando lo stato (e non un semplice flag) il banner ricompare una
 * volta se il permesso cambia: es. chiuso quando era "default", poi
 * l'utente blocca le notifiche dal browser -> riappare la variante
 * "bloccate" con la procedura per riattivarle.
 */
const DISMISS_KEY = 'chronos-notif-prompt-dismissed';

/** Stato effettivo del permesso, con il caso "API assente" esplicito. */
function permissionState(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

/**
 * Banner non invasivo mostrato quando le notifiche di sistema non sono
 * attive, in tre varianti:
 *  - permesso mai chiesto ("default"): pulsante che apre la richiesta
 *    del browser. DEVE partire da un click dell'utente: Firefox e
 *    Safari ignorano le richieste automatiche.
 *  - permesso bloccato ("denied"): il browser non permette più di
 *    chiederlo via codice, quindi si spiega la procedura manuale.
 *  - iPhone/iPad nel browser ("unsupported"): lì l'API Notification
 *    non esiste finché Chronos non viene installata nella schermata
 *    Home, quindi si spiega prima quel passaggio.
 */
export default function NotificationPrompt() {
  const notifEnabled = useChronos((s) => s.settings.notifEnabled);
  const [visible, setVisible] = useState(() => {
    const perm = permissionState();
    if (perm === 'granted') return false;
    // Senza API il banner ha senso solo su iPhone/iPad non ancora
    // installati: negli altri browser senza supporto non c'è rimedio
    // e resta l'avviso nelle Opzioni.
    if (perm === 'unsupported' && (!isIOS() || isStandalone())) return false;
    return localStorage.getItem(DISMISS_KEY) !== perm;
  });

  if (!visible || !notifEnabled) return null;

  const perm = permissionState();

  const enable = async () => {
    setVisible(false);
    const granted = await requestNotificationPermission();
    if (granted) {
      notify('🔔 Notifiche attivate!', 'Riceverai i promemoria anche come avvisi di sistema.');
    } else {
      notify(
        'ℹ️ Notifiche di sistema non attive',
        "Riceverai comunque gli avvisi dentro l'app. Puoi riprovare dalle Opzioni."
      );
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, perm);
    setVisible(false);
  };

  // z-40 (sotto i toast, z-50): se arriva un avviso mentre il banner è
  // aperto, il toast — che sparisce da solo in pochi secondi — vince.
  return (
    <div className="card fixed inset-x-4 bottom-20 z-40 mx-auto max-w-md shadow-lg md:bottom-6">
      {perm === 'unsupported' ? (
        <>
          <p className="text-sm font-semibold">📲 Vuoi le notifiche su iPhone/iPad?</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Qui nel browser i promemoria compaiono solo con Chronos aperta. Per
            riceverli come notifiche, installa prima l'app: in Safari tocca
            Condividi → "Aggiungi alla schermata Home", apri Chronos da lì e
            attiva le notifiche quando te lo chiede.
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={dismiss} className="btn-primary">
              Ho capito
            </button>
          </div>
        </>
      ) : perm === 'denied' ? (
        <>
          <p className="text-sm font-semibold">🔕 Notifiche di sistema bloccate</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            I promemoria al momento compaiono solo dentro l'app: le notifiche di
            sistema sono bloccate. Per riattivarle: {notifUnblockInstructions()}
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={dismiss} className="btn-primary">
              Ho capito
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold">🔔 Attivare le notifiche?</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Per ricevere i promemoria di attività, eventi e abitudini anche come
            avvisi di sistema, il browser ha bisogno del tuo permesso. Puoi
            decidere anche più tardi dalle Opzioni.
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={enable} className="btn-primary">
              Attiva notifiche
            </button>
            <button onClick={dismiss} className="btn-ghost">
              Non ora
            </button>
          </div>
        </>
      )}
    </div>
  );
}
