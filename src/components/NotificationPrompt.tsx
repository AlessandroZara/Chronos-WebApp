import { useState } from 'react';
import { useChronos } from '../store';
import {
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

/**
 * Banner non invasivo mostrato quando le notifiche di sistema non sono
 * attive, in due varianti:
 *  - permesso mai chiesto ("default"): pulsante che apre la richiesta
 *    del browser. DEVE partire da un click dell'utente: Firefox e
 *    Safari ignorano le richieste automatiche.
 *  - permesso bloccato ("denied"): il browser non permette più di
 *    chiederlo via codice, quindi si spiega la procedura manuale.
 */
export default function NotificationPrompt() {
  const notifEnabled = useChronos((s) => s.settings.notifEnabled);
  const [visible, setVisible] = useState(() => {
    if (!notificationsSupported()) return false;
    const perm = Notification.permission;
    if (perm === 'granted') return false;
    return localStorage.getItem(DISMISS_KEY) !== perm;
  });

  if (!visible || !notifEnabled) return null;

  const blocked = Notification.permission === 'denied';

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
    localStorage.setItem(DISMISS_KEY, Notification.permission);
    setVisible(false);
  };

  return (
    <div className="card fixed inset-x-4 bottom-20 z-50 mx-auto max-w-md shadow-lg md:bottom-6">
      {blocked ? (
        <>
          <p className="text-sm font-semibold">🔕 Notifiche disattivate</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Le notifiche di sistema sono bloccate: per continuare a ricevere i
            promemoria riattivale. {notifUnblockInstructions()} Nel frattempo
            gli avvisi compaiono solo qui dentro l'app.
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
            avvisi di sistema, il browser ha bisogno del tuo permesso.
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
