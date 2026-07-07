# ⏳ Chronos

> La tua suite personale di produttività: attività, calendario, note interconnesse, focus timer, abitudini e statistiche — in un'unica web app installabile sul telefono come PWA.

![Stato](https://img.shields.io/badge/stato-attivo-brightgreen)
![Versione](https://img.shields.io/badge/versione-0.1.0-blue)
![Licenza](https://img.shields.io/badge/licenza-MIT-green)

---

## 📖 Descrizione

**Chronos** è un'applicazione personale di produttività *all-in-one* che unisce in un'unica interfaccia gli strumenti essenziali per organizzare la giornata. Ogni modulo dialoga con gli altri: le attività compaiono sul calendario, le sessioni di focus alimentano le statistiche, le abitudini generano promemoria e le note si collegano tra loro come una base di conoscenza personale.

È una **web app** (React + Vite + Tailwind CSS) che funziona interamente **offline**: i dati sono salvati in locale nel browser e possono essere esportati/importati come backup JSON. Grazie alla configurazione **PWA** si installa su smartphone, tablet e desktop senza passare da App Store o Google Play.

---

## ✨ Funzionalità

- [x] **To-Do List** — attività con priorità (alta/media/bassa), scadenze, orari, filtri, modifica e promemoria
- [x] **Calendario** — vista mensile con attività ed eventi integrati, creazione rapida di eventi
- [x] **Note rich-text** — editor con grassetto, corsivo, titoli, elenchi puntati e numerati
- [x] **Organizzazione note avanzata** — tag, ricerca full-text e collegamenti bidirezionali `[[wiki-style]]` con pannello dei backlink
- [x] **Focus Timer (Pomodoro)** — sessioni di lavoro e pause configurabili, cicli automatici, collegamento a un'attività
- [x] **Sistema di notifiche** — promemoria per attività, eventi e abitudini: toast in-app + notifiche di sistema (desktop e mobile via service worker), attivabili per singolo modulo
- [x] **Promemoria generale configurabile** — notifica di riepilogo (attività, eventi, abitudini) con frequenza a scelta: ogni giorno, ogni 2-3 giorni o settimanale, all'orario preferito
- [x] **Eventi con categoria e preavviso** — tipo di evento (appuntamento, lavoro, salute, compleanno…) con icona e colore, e notifica anticipata configurabile in minuti, ore o giorni
- [x] **Habit Tracker** — abitudini quotidiane con streak 🔥, griglia degli ultimi 28 giorni e promemoria a orario
- [x] **Statistiche e resoconti** — dashboard con grafici settimanali/mensili su focus, attività completate e abitudini, più report testuale
- [x] **Modalità scura** — manuale, in base al tema di sistema del dispositivo, o programmata in base all'orario
- [x] **PWA installabile** — offline completo e installazione su telefono/desktop
- [x] **Backup dati** — esportazione/importazione completa in JSON
- [x] **Sincronizzazione cloud** — API PHP + MySQL da caricare sul proprio hosting (es. Altervista): dati allineati tra telefono e computer, offline-first
- [x] **Account multi-utente** — registrazione (nome, cognome, email, password) e login: ogni utente ha i propri dati, su qualunque dispositivo
- [x] **Pagina profilo** — dal chip nella dashboard: modifica di nome, cognome, email e password salvati nel database, più logout
- [x] **Sicurezza** — password con hash bcrypt, token personale per sessione, blocco account di 15 minuti dopo 5 tentativi falliti
- [ ] **Email di conferma registrazione** *(in roadmap)*
- [ ] **Allegati alle note** — file e immagini *(in roadmap)*

---

## 🖥️ Prerequisiti di sistema

| Requisito | Dettaglio |
|---|---|
| **Per usarla** | Un browser recente (Chrome, Edge, Firefox, Safari) — nessuna installazione |
| **Per svilupparla** | [Node.js](https://nodejs.org) ≥ 20 e npm |
| **Connessione internet** | Non necessaria dopo il primo caricamento (offline via service worker) |
| **Notifiche su iPhone/iPad** | iOS 16.4+ e app installata nella schermata Home |

---

## 🚀 Installazione e avvio

```bash
# 1. Clona la repository
git clone https://github.com/<tuo-utente>/chronos.git
cd chronos

# 2. Installa le dipendenze
npm install

# 3. Avvia in sviluppo (http://localhost:5173)
npm run dev

# 4. Build di produzione + anteprima
npm run build
npm run preview
```

Per usarla dal telefono: pubblica la cartella `dist/` su un hosting statico gratuito (GitHub Pages, Netlify, Vercel…), apri l'indirizzo dal telefono e scegli **«Aggiungi a schermata Home»** — Chronos si installerà come una vera app.

> 💡 I dati vivono nel browser che usi. Per spostarli su un altro dispositivo: **Impostazioni → Esporta backup**.

---

## 🗂️ Struttura del progetto

```
Chronos/
├── index.html               # Entry point + meta PWA
├── public/
│   ├── manifest.webmanifest # Manifest PWA (nome, icona, colori)
│   ├── sw.js                # Service worker: offline + notifiche mobile
│   └── icon.svg             # Icona dell'app
├── src/
│   ├── main.tsx             # Bootstrap React + registrazione service worker
│   ├── App.tsx              # Layout responsive, navigazione, tema, motore timer
│   ├── store.ts             # Stato centrale (Zustand) con salvataggio automatico
│   ├── notifications.ts     # Toast in-app, notifiche di sistema, scheduler promemoria
│   ├── types.ts             # Tipi TypeScript condivisi
│   ├── utils.ts             # Helper per date, formattazioni, wiki-link
│   ├── sync.ts              # Sincronizzazione offline-first con il server
│   ├── components/          # BarChart, Toasts
│   └── views/               # AuthView (login/registrazione), AccountView (profilo),
│                            #   Dashboard, Tasks, CalendarView, NotesView,
│                            #   Focus, Habits, SettingsView
├── server/
│   ├── api.php              # API REST: registrazione, login, stato per utente
│   ├── config.sample.php    # Credenziali DB (da copiare in config.php)
│   └── README.md            # Istruzioni di deploy su Altervista
├── tests/
│   └── e2e-sync.mjs         # Test end-to-end (login, sync, isolamento utenti)
└── README.md
```

---

## ☁️ Account e sincronizzazione (Altervista o altro hosting PHP)

Chronos salva i dati di ogni utente su un database MySQL tramite una piccola API PHP: ti registri una volta e poi accedi con email e password da qualunque dispositivo, ritrovando tutto.

1. `npm run build` e carica via FTP il contenuto di `dist/` nella root del tuo spazio web;
2. copia `server/config.sample.php` in `config.php` con le credenziali MySQL, e carica `api.php` + `config.php` accanto a `index.html`;
3. apri il sito: compare la schermata di accesso → **Registrati** → fatto. Su ogni altro dispositivo basta **Accedi**.

Le tabelle (`users` e `chronos_user_state`) si creano da sole alla prima richiesta. La strategia è *offline-first, last-write-wins*: l'app funziona sempre anche senza rete e sincronizza appena possibile. Dettagli in [`server/README.md`](server/README.md).

---

## 📄 Licenza

Questo progetto è distribuito con licenza **MIT** — vedi il file [LICENSE](LICENSE) per i dettagli.

---

*Sviluppato con ❤️ e ⏳ — Chronos, il tempo dalla tua parte.*
