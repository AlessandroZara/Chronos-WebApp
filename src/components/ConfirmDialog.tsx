import { useEffect } from 'react';
import { create } from 'zustand';

/*
 * Finestra di conferma personalizzata di Chronos.
 * Sostituisce il confirm() nativo del browser, che mostra sempre
 * "localhost dice..." / "tuosito.altervista.org dice..." e non è
 * personalizzabile né coerente col tema dell'app. Uso:
 *
 *   if (await askConfirm('Eliminare la nota?', 'Elimina')) { ... }
 */

interface ConfirmState {
  open: boolean;
  message: string;
  confirmLabel: string; // testo del pulsante di conferma (es. "Elimina")
  resolve: ((ok: boolean) => void) | null;
  ask: (message: string, confirmLabel: string) => Promise<boolean>;
  close: (ok: boolean) => void;
}

const useConfirm = create<ConfirmState>((set, get) => ({
  open: false,
  message: '',
  confirmLabel: 'Conferma',
  resolve: null,
  // Apre la finestra e restituisce una Promise risolta con la scelta dell'utente.
  ask: (message, confirmLabel) =>
    new Promise<boolean>((resolve) => set({ open: true, message, confirmLabel, resolve })),
  close: (ok) => {
    get().resolve?.(ok);
    set({ open: false, resolve: null });
  },
}));

/** Chiede conferma all'utente con la finestra di Chronos (al posto di confirm()). */
export const askConfirm = (message: string, confirmLabel = 'Conferma') =>
  useConfirm.getState().ask(message, confirmLabel);

export default function ConfirmDialog() {
  const { open, message, confirmLabel, close } = useConfirm();

  // Tasto Esc = annulla, come nei dialoghi di sistema.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    // Sfondo scurito a tutto schermo: un click fuori dalla finestra annulla.
    // p-4 garantisce margini su schermi piccoli (mobile-friendly).
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => close(false)}
      role="dialog"
      aria-modal="true"
    >
      {/* stopPropagation: i click DENTRO la finestra non devono chiuderla */}
      <div
        className="card w-full max-w-sm space-y-3 !p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="flex items-center gap-2 text-lg font-bold">
          <span>⏳</span>
          <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
            Chronos
          </span>
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={() => close(false)} className="btn-ghost">
            Annulla
          </button>
          <button
            onClick={() => close(true)}
            className="btn bg-red-600 text-white shadow-sm hover:bg-red-500"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
