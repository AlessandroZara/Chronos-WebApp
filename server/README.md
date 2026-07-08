# Chronos — Backend di sincronizzazione (Altervista / hosting PHP+MySQL)

## Struttura consigliata sull'hosting

Tutto nella root del sito, frontend e backend sullo stesso dominio
(così l'app chiama `/api.php` senza configurare nulla):

```
htdocs/                       (root del tuo spazio web)
├── index.html                ┐
├── assets/                   │ contenuto di dist/ (build Vite: statico,
├── sw.js                     │ nessun processo da tenere acceso)
├── icon.svg                  │
├── manifest.webmanifest      ┘
├── api.php                   ← da server/ (eseguito da Apache a richiesta)
├── config.php                ← creato sull'hosting: credenziali MySQL
├── push-config.php           ← generato in locale: chiavi VAPID + segreto cron
└── cron-reminders.php        ← da server/: lavori automatici (Web Push)
```

PHP su hosting classico non è un processo da avviare: Apache esegue
`api.php` a ogni richiesta. I lavori periodici (invio promemoria push)
girano via **cron**: dal pannello dell'hosting (`php .../cron-reminders.php`
ogni 5 minuti) oppure, se il piano non ha cron, con un servizio esterno
gratuito come cron-job.org che apre
`https://tuosito/cron-reminders.php?secret=...` (il segreto è
`cron_secret` in push-config.php).

## Deploy in 5 passi

1. **Build dell'app**: nella cartella del progetto esegui `npm run build` → viene creata la cartella `dist/`.
2. **Config**: copia `config.sample.php` come `config.php` e compila credenziali MySQL e token segreto.
3. **Upload via FTP** sul tuo spazio Altervista:
   - tutto il **contenuto** di `dist/` nella root del sito;
   - `api.php` e `config.php` sempre nella root (accanto a `index.html`).
4. **Verifica**: apri `https://tuosito.altervista.org/api.php` → deve rispondere `{"error":"Token non valido o mancante."}` (è corretto: sei senza token).
5. **Collega l'app**: apri Chronos → Impostazioni → ☁️ Sincronizzazione cloud → inserisci URL `https://tuosito.altervista.org/api.php` e il token, attiva e premi «Prova connessione».

La tabella MySQL (`chronos_state`) viene creata automaticamente alla prima richiesta: non serve alcun setup dal pannello phpMyAdmin.

## Note

- Il token in `config.php` è l'unica protezione: usane uno lungo e casuale.
- I dati viaggiano su HTTPS (incluso nei domini *.altervista.org).
- Sincronizzazione "last-write-wins": se modifichi da due dispositivi offline contemporaneamente, vince l'ultimo che si sincronizza.
