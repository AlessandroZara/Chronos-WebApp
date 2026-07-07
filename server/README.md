# Chronos — Backend di sincronizzazione (Altervista / hosting PHP+MySQL)

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
