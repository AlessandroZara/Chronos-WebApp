import { useState } from 'react';
import { useChronos } from '../store';
import {
  notificationsSupported,
  notify,
  requestNotificationPermission,
} from '../notifications';

const DISMISS_KEY = 'chronos-notif-prompt-dismissed';

/**
 * Banner mostrato al primo utilizzo per chiedere il permesso delle
 * notifiche di sistema. La richiesta al browser DEVE partire da un
 * click dell'utente: Firefox e Safari ignorano quelle automatiche.
 */
export default function NotificationPrompt() {
  const notifEnabled = useChronos((s) => s.settings.notifEnabled);
  const [visible, setVisible] = useState(
    () =>
      notificationsSupported() &&
      Notification.permission === 'default' &&
      !localStorage.getItem(DISMISS_KEY)
  );

  if (!visible || !notifEnabled) return null;

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
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  return (
    <div className="card fixed inset-x-4 bottom-20 z-50 mx-auto max-w-md shadow-lg md:bottom-6">
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
    </div>
  );
}
