/*
 * Ambiente locale con un solo comando (Windows/macOS/Linux, zero dipendenze):
 *
 *   npm run dev           -> PHP + Vite dev server (http://localhost:5173)
 *   npm run preview:full  -> PHP + anteprima della build (http://localhost:4173)
 *
 * Avvia il backend PHP (api.php, docroot server/) sulla porta 8010 e il
 * frontend Vite, e li spegne insieme. Il frontend chiama sempre
 * `/api.php` sul proprio dominio: in locale è il proxy di Vite (vedi
 * vite.config.ts) a girare la richiesta al PHP qui avviato, in
 * produzione api.php sta fisicamente accanto a index.html. Così non
 * servono URL speciali per lo sviluppo.
 *
 * Se PHP non è installato parte comunque il solo frontend (l'app
 * funziona in locale senza account/sincronizzazione).
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] === 'preview' ? 'preview' : 'dev';

// --- Backend PHP: http://127.0.0.1:8010/api.php ---
const php = spawn('php', ['-S', '127.0.0.1:8010', '-t', 'server'], {
  cwd: root,
  stdio: ['ignore', 'inherit', 'inherit'],
});
let phpOk = true;
php.on('error', () => {
  // PHP assente dal PATH: niente panico, si continua senza backend.
  phpOk = false;
  console.warn(
    '\n[serve] PHP non trovato: parte solo il frontend.\n' +
      '[serve] Senza backend non funzionano login e sincronizzazione.\n'
  );
});

// --- Frontend Vite (dev server o anteprima della build) ---
// Lanciato con lo stesso Node di questo script: funziona anche su
// Windows, dove gli eseguibili .bin/vite sono script non spawnabili.
const vite = spawn(
  process.execPath,
  [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), ...(mode === 'preview' ? ['preview'] : [])],
  { cwd: root, stdio: 'inherit' }
);

// Vita e morte insieme: chiuso uno (o premuto Ctrl+C), si chiude tutto.
const stopAll = () => {
  if (phpOk && php.exitCode === null) php.kill();
  if (vite.exitCode === null) vite.kill();
};
vite.on('exit', (code) => {
  stopAll();
  process.exit(code ?? 0);
});
php.on('exit', (code) => {
  // Uscita inattesa del PHP (es. porta 8010 occupata): meglio saperlo.
  if (code !== null && code !== 0 && vite.exitCode === null) {
    console.warn(`\n[serve] Il server PHP si è chiuso (codice ${code}); il frontend resta attivo.\n`);
  }
});
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
