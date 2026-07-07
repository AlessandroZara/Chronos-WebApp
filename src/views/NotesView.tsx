import { useEffect, useRef, useState } from 'react';
import { useChronos } from '../store';
import { useToasts } from '../notifications';
import { compressImage, extractWikiLinks, stripHtml } from '../utils';

/*
 * ============================================================
 * MODULO NOTE
 * ------------------------------------------------------------
 * - Editor rich-text basato su contentEditable (grassetto,
 *   corsivo, titoli, elenchi...).
 * - Tag per organizzare e filtrare le note.
 * - Collegamenti bidirezionali in stile wiki: scrivendo
 *   [[Titolo di un'altra nota]] si crea un link; il pannello
 *   in fondo mostra sia i link in uscita sia i "backlink"
 *   (le note che puntano a quella aperta).
 *
 * Layout responsive:
 * - Desktop: due colonne fisse (lista a sinistra, editor a destra).
 * - Mobile: si vede UNA cosa alla volta — la lista, oppure
 *   l'editor con un pulsante "indietro" per tornare alla lista.
 * ============================================================
 */

/**
 * Editor rich-text.
 * contentEditable non va d'accordo con il rendering controllato di React
 * (ogni re-render sposterebbe il cursore), quindi l'editor è "non controllato":
 * - l'HTML iniziale viene inserito una sola volta al montaggio;
 * - a ogni modifica salviamo nello store con un debounce di 400 ms
 *   (per non scrivere su localStorage a ogni singolo tasto premuto);
 * - il componente viene rimontato da zero quando si cambia nota
 *   grazie alla prop `key` usata dal genitore.
 */
function RichEditor({
  initialHtml,
  onChange,
  registerFlush,
}: {
  initialHtml: string;
  onChange: (html: string) => void;
  /** Consente al genitore di forzare un salvataggio immediato (pulsante "Salva nota"). */
  registerFlush?: (fn: () => void) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<number | undefined>(undefined);
  const latestHtml = useRef(initialHtml); // ultima versione del contenuto
  const dirty = useRef(false); // ci sono modifiche non ancora salvate?

  // Salvataggio immediato: annulla il debounce e scrive subito nello store.
  const flushNow = () => {
    window.clearTimeout(debounceTimer.current);
    if (ref.current) latestHtml.current = ref.current.innerHTML;
    dirty.current = false;
    onChange(latestHtml.current);
  };

  // Inserisce l'HTML della nota UNA sola volta, al montaggio.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml;
    registerFlush?.(flushNow);
    // Al momento dello smontaggio (es. cambio nota) salviamo subito
    // eventuali modifiche in sospeso, senza aspettare il debounce.
    return () => {
      window.clearTimeout(debounceTimer.current);
      if (dirty.current) onChange(latestHtml.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cattura il contenuto corrente e programma il salvataggio ritardato.
  const scheduleSave = () => {
    if (!ref.current) return;
    latestHtml.current = ref.current.innerHTML;
    dirty.current = true;
    window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      dirty.current = false;
      onChange(latestHtml.current);
    }, 400);
  };

  // Applica un comando di formattazione (grassetto, elenco, ecc.)
  // al testo selezionato, poi salva.
  const exec = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    ref.current?.focus();
    scheduleSave();
  };

  // --- Immagini nella nota ---
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pushToast = useToasts((s) => s.push);

  // Inserisce una o più immagini (compresse) nel punto del cursore.
  const insertImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 8 * 1024 * 1024) {
        pushToast('🖼️ Immagine troppo grande', `"${file.name}" supera gli 8 MB.`);
        continue;
      }
      try {
        const dataUrl = await compressImage(file);
        ref.current?.focus();
        document.execCommand('insertImage', false, dataUrl);
      } catch {
        pushToast('🖼️ Immagine non valida', `Impossibile leggere "${file.name}".`);
      }
    }
    scheduleSave();
  };

  // I pulsanti della toolbar usano onMouseDown + preventDefault:
  // così il click NON fa perdere la selezione del testo nell'editor.
  const ToolBtn = ({
    label,
    title,
    onAction,
  }: {
    label: string;
    title: string;
    onAction: () => void;
  }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onAction();
      }}
      className="btn-ghost min-w-9 !px-2 !py-1.5 text-sm"
    >
      {label}
    </button>
  );

  return (
    <div>
      {/* Toolbar di formattazione */}
      <div className="mb-2 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        <ToolBtn label="B" title="Grassetto" onAction={() => exec('bold')} />
        <ToolBtn label="I" title="Corsivo" onAction={() => exec('italic')} />
        <ToolBtn label="U" title="Sottolineato" onAction={() => exec('underline')} />
        <ToolBtn label="S̶" title="Barrato" onAction={() => exec('strikeThrough')} />
        <ToolBtn label="H2" title="Titolo" onAction={() => exec('formatBlock', '<h2>')} />
        <ToolBtn label="¶" title="Paragrafo normale" onAction={() => exec('formatBlock', '<p>')} />
        <ToolBtn label="•" title="Elenco puntato" onAction={() => exec('insertUnorderedList')} />
        <ToolBtn label="1." title="Elenco numerato" onAction={() => exec('insertOrderedList')} />
        <ToolBtn
          label="[[ ]]"
          title="Inserisci collegamento a un'altra nota"
          onAction={() => exec('insertText', '[[Titolo nota]]')}
        />
        <ToolBtn
          label="🖼️"
          title="Inserisci una o più immagini (clicca un'immagine per rimuoverla)"
          onAction={() => imageInputRef.current?.click()}
        />
        {/* Input nascosto: si apre col pulsante 🖼️ della toolbar */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void insertImages(e.target.files);
            e.target.value = ''; // permette di reinserire la stessa immagine
          }}
        />
      </div>

      {/* Area di scrittura vera e propria.
          Click su un'immagine = proposta di rimozione (oltre a Canc/Backspace). */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="rich-editor rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700"
        onInput={scheduleSave}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.tagName === 'IMG' && confirm("Rimuovere l'immagine dalla nota?")) {
            target.remove();
            scheduleSave();
          }
        }}
      />
    </div>
  );
}

/**
 * Campo dei tag: stato locale per non "combattere" con l'utente mentre
 * digita (es. la virgola sparirebbe se il valore fosse ricalcolato
 * dallo store a ogni tasto). Lo store viene comunque aggiornato subito.
 */
function TagsInput({
  initialTags,
  onChange,
}: {
  initialTags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [text, setText] = useState(initialTags.join(', '));
  return (
    <input
      className="input"
      placeholder="tag separati da virgola (es. lavoro, idee)"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        // Normalizza: divide sulla virgola, elimina spazi e duplicati.
        const tags = [
          ...new Set(
            e.target.value
              .split(',')
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean)
          ),
        ];
        onChange(tags);
      }}
    />
  );
}

export default function NotesView() {
  const notes = useChronos((s) => s.notes);
  const addNote = useChronos((s) => s.addNote);
  const updateNote = useChronos((s) => s.updateNote);
  const deleteNote = useChronos((s) => s.deleteNote);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState(''); // ricerca full-text
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // Pulsante "Salva nota": forza il salvataggio dell'editor e mostra conferma.
  const flushEditor = useRef<(() => void) | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const feedbackTimer = useRef<number | undefined>(undefined);

  const saveNote = () => {
    flushEditor.current?.();
    const time = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    setSaveFeedback(`✅ Nota salvata alle ${time}`);
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setSaveFeedback(null), 3000);
  };

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  // Tutti i tag esistenti, per la barra dei filtri.
  const allTags = [...new Set(notes.flatMap((n) => n.tags))].sort();

  // Lista filtrata per ricerca e tag, ordinata per ultima modifica.
  const filtered = notes
    .filter((n) => {
      if (tagFilter && !n.tags.includes(tagFilter)) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          n.title.toLowerCase().includes(q) ||
          stripHtml(n.html).toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // Apre la nota con quel titolo; se non esiste la crea al volo.
  // È il cuore dei collegamenti [[wiki]]: un link a una nota
  // inesistente diventa un invito a crearla.
  const openOrCreate = (title: string) => {
    const found = notes.find(
      (n) => n.title.trim().toLowerCase() === title.trim().toLowerCase()
    );
    if (found) setSelectedId(found.id);
    else setSelectedId(addNote(title));
  };

  // Collegamenti in uscita della nota aperta ([[...]] nel testo).
  const outgoing = selected ? extractWikiLinks(selected.html) : [];

  // Backlink: tutte le altre note che contengono [[titolo di questa nota]].
  const backlinks = selected
    ? notes.filter(
        (n) =>
          n.id !== selected.id &&
          extractWikiLinks(n.html).some(
            (l) => l.toLowerCase() === selected.title.trim().toLowerCase()
          )
      )
    : [];

  const createNew = () => setSelectedId(addNote());

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📝 Note</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {notes.length} note · usa [[Titolo]] per collegarle tra loro
          </p>
        </div>
        <button onClick={createNew} className="btn-primary">
          ➕ Nuova
        </button>
      </header>

      {/* Su mobile: lista O editor. Su desktop (md:): entrambi affiancati. */}
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        {/* ---- Colonna sinistra: ricerca, tag e lista note ---- */}
        <div className={`space-y-3 ${selected ? 'hidden md:block' : ''}`}>
          <input
            className="input"
            placeholder="🔍 Cerca nelle note…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                  className={`chip cursor-pointer ${
                    tagFilter === tag
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="card py-8 text-center text-sm text-slate-400">
                Nessuna nota trovata. ✍️
              </div>
            )}
            {filtered.map((n) => (
              <button
                key={n.id}
                onClick={() => setSelectedId(n.id)}
                className={`card block w-full cursor-pointer !p-3 text-left transition hover:border-indigo-300 ${
                  n.id === selectedId ? '!border-indigo-500 ring-1 ring-indigo-500' : ''
                }`}
              >
                <p className="truncate text-sm font-semibold">{n.title || 'Senza titolo'}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                  {stripHtml(n.html).slice(0, 120) || 'Nota vuota'}
                </p>
                {n.tags.length > 0 && (
                  <p className="mt-1 truncate text-xs text-indigo-500">
                    {n.tags.map((t) => `#${t}`).join(' ')}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ---- Colonna destra: editor della nota selezionata ---- */}
        {selected ? (
          // key={selected.id}: cambiando nota, editor e campo tag
          // vengono ricreati da zero con i dati della nuova nota.
          <div key={selected.id} className="card space-y-3 self-start">
            <div className="flex items-center gap-2">
              {/* Pulsante "indietro" visibile solo su mobile */}
              <button
                onClick={() => setSelectedId(null)}
                className="btn-ghost md:hidden"
                aria-label="Torna alla lista"
              >
                ←
              </button>
              <input
                className="input !border-0 !bg-transparent !p-0 !text-lg font-bold !ring-0"
                value={selected.title}
                placeholder="Titolo della nota"
                onChange={(e) => updateNote(selected.id, { title: e.target.value })}
              />
            </div>

            <TagsInput
              initialTags={selected.tags}
              onChange={(tags) => updateNote(selected.id, { tags })}
            />

            <RichEditor
              initialHtml={selected.html}
              onChange={(html) => updateNote(selected.id, { html })}
              registerFlush={(fn) => (flushEditor.current = fn)}
            />

            {/* Barra delle azioni: rende esplicito quello che l'autosalvataggio
                fa già in silenzio, così l'esperienza è più chiara. */}
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button onClick={saveNote} className="btn-primary">
                💾 Salva nota
              </button>
              <button
                onClick={() => {
                  if (confirm(`Eliminare la nota "${selected.title}"?`)) {
                    deleteNote(selected.id);
                    setSelectedId(null);
                  }
                }}
                className="btn-danger border border-red-200 dark:border-red-900"
              >
                🗑️ Elimina nota
              </button>
              {saveFeedback ? (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {saveFeedback}
                </span>
              ) : (
                <span className="ml-auto text-xs text-slate-400">
                  ✨ Salvataggio automatico attivo mentre scrivi
                </span>
              )}
            </div>

            {/* Pannello dei collegamenti bidirezionali */}
            {(outgoing.length > 0 || backlinks.length > 0) && (
              <div className="space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                {outgoing.length > 0 && (
                  <div>
                    <p className="label !mb-1.5">🔗 Collegamenti in uscita</p>
                    <div className="flex flex-wrap gap-1.5">
                      {outgoing.map((title) => {
                        const exists = notes.some(
                          (n) => n.title.trim().toLowerCase() === title.toLowerCase()
                        );
                        return (
                          <button
                            key={title}
                            onClick={() => openOrCreate(title)}
                            className={`chip cursor-pointer ${
                              exists
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                                : 'border border-dashed border-indigo-400 text-indigo-500'
                            }`}
                            title={exists ? 'Apri nota' : 'Nota non ancora creata: clicca per crearla'}
                          >
                            {title} {!exists && '+'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {backlinks.length > 0 && (
                  <div>
                    <p className="label !mb-1.5">↩️ Backlink (note che citano questa)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {backlinks.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => setSelectedId(n.id)}
                          className="chip cursor-pointer bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                        >
                          {n.title || 'Senza titolo'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="text-right text-xs text-slate-400">
              Ultima modifica:{' '}
              {new Date(selected.updatedAt).toLocaleString('it-IT', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </p>
          </div>
        ) : (
          // Placeholder mostrato su desktop quando nessuna nota è aperta.
          <div className="card hidden items-center justify-center py-20 text-sm text-slate-400 md:flex">
            Seleziona una nota o creane una nuova 📖
          </div>
        )}
      </div>
    </div>
  );
}
