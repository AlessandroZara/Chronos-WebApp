import { useToasts } from '../notifications';

export default function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);

  return (
    <div className="fixed right-4 bottom-20 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 md:bottom-6">
      {toasts.map((t) => (
        <div key={t.id} className="card flex items-start gap-2 !p-3 shadow-lg">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t.title}</p>
            {t.body && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {t.body}
              </p>
            )}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Chiudi notifica"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
