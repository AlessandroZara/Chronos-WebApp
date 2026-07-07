/*
 * Test end-to-end del sistema di account, con Edge headless (puppeteer-core).
 * Simula browser "nuovi" (profili temporanei, localStorage vuoto) e verifica:
 *   1. che senza login compaia la schermata di accesso;
 *   2. che l'occhiolino mostri/nasconda la password;
 *   3. che una password sbagliata mostri l'errore (e non faccia entrare);
 *   4. che il login corretto apra l'app e scarichi i dati dell'account;
 *   5. che un altro utente NON veda i dati altrui (isolamento).
 *
 * Prerequisiti: `npm run preview` su :4173, php -S su :8010, sito LocalWP acceso.
 */
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const APP = 'http://localhost:4173/';
const MARIO = { email: 'mario.rossi@test.it', password: 'Chronos123!' };
const LUCA = { email: 'luca.bianchi@test.it', password: 'Chronos123!' };

const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const edge = EDGE_PATHS.find((p) => existsSync(p));
if (!edge) {
  console.error('Edge non trovato');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
};

/**
 * Imposta il valore di un input controllato da React in modo deterministico:
 * usa il setter nativo e poi emette un evento 'input', che è ciò che React
 * ascolta. (Assegnare .value direttamente non aggiorna lo stato React.)
 */
async function clearAndType(page, selector, text) {
  await page.evaluate(
    ({ sel, val }) => {
      const input = document.querySelector(sel);
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      setter.call(input, val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    { sel: selector, val: text }
  );
}

/** Compila la form di login e la invia. */
async function doLogin(page, { email, password }) {
  await page.waitForSelector('#auth-email');
  await clearAndType(page, '#auth-email', email);
  await clearAndType(page, '#auth-password', password);
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Accedi') && b.type === 'submit').click();
  });
}

/** Legge lo stato dell'app dal localStorage della pagina. */
const readState = (page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('chronos-data');
    if (!raw) return { logged: false, firstName: null, tasks: [] };
    const s = JSON.parse(raw).state;
    return {
      logged: !!s.auth.token,
      firstName: s.auth.user?.firstName ?? null,
      tasks: s.tasks.map((t) => t.title),
    };
  });

const browser = await puppeteer.launch({ executablePath: edge, headless: true });

// ---- Test 1: browser nuovo -> schermata di login ----
const page = await browser.newPage();
await page.goto(APP, { waitUntil: 'networkidle2' });
const loginVisible = await page.$('#auth-email');
check('1. browser nuovo: compare la schermata di accesso', !!loginVisible);

// ---- Test 2: occhiolino mostra/nasconde la password ----
await page.type('#auth-password', 'segretissima');
const typeBefore = await page.$eval('#auth-password', (el) => el.type);
await page.click('button[aria-label="Mostra password"]');
const typeAfter = await page.$eval('#auth-password', (el) => el.type);
check('2. occhiolino password', typeBefore === 'password' && typeAfter === 'text');

// ---- Test 3: password sbagliata -> errore, non si entra ----
await doLogin(page, { email: MARIO.email, password: 'passwordERRATA' });
await sleep(1500);
const errorShown = await page.evaluate(() =>
  document.body.textContent.includes('Email o password errati')
);
const stillOnLogin = await page.$('#auth-email');
check('3. password errata: messaggio di errore e niente accesso', errorShown && !!stillOnLogin);

// ---- Test 4: login corretto -> app aperta + dati dell'account scaricati ----
await doLogin(page, MARIO);
await sleep(3000); // login + pull dal server
const mario = await readState(page);
check(
  '4. login Mario: app aperta e dati sincronizzati dal server',
  mario.logged && mario.firstName === 'Mario' && mario.tasks.includes('Compito segreto di Mario'),
  `utente=${mario.firstName}, task=[${mario.tasks.join(', ')}]`
);

// ---- Test 5: Luca su un profilo vergine non vede i dati di Mario ----
// NOTA: non si controlla che Luca abbia zero elementi (il suo account può
// avere dati veri), ma che NON veda il task-sentinella di Mario.
const ctx = await browser.createBrowserContext();
const page2 = await ctx.newPage();
await page2.goto(APP, { waitUntil: 'networkidle2' });
await doLogin(page2, LUCA);
await sleep(3000);
const luca = await readState(page2);
check(
  '5. login Luca: account separato, nessun dato di Mario',
  luca.logged && luca.firstName === 'Luca' && !luca.tasks.includes('Compito segreto di Mario'),
  `utente=${luca.firstName}, task=[${luca.tasks.join(', ')}]`
);

// ---- Test 6: layout responsive (viewport da smartphone) ----
// Sidebar desktop nascosta, barra di navigazione inferiore visibile,
// nessuno scroll orizzontale.
await page.setViewport({ width: 390, height: 844 });
await sleep(400);
const mobile = await page.evaluate(() => {
  const aside = document.querySelector('aside');
  const bottomNav = document.querySelector('nav.fixed');
  return {
    sidebarHidden: !aside || getComputedStyle(aside).display === 'none',
    bottomNavVisible: !!bottomNav && getComputedStyle(bottomNav).display !== 'none',
    noHorizontalScroll: document.documentElement.scrollWidth <= window.innerWidth + 1,
  };
});
check(
  '6. layout mobile (390px): sidebar nascosta, barra inferiore, no scroll orizzontale',
  mobile.sidebarHidden && mobile.bottomNavVisible && mobile.noHorizontalScroll,
  JSON.stringify(mobile)
);

// E il contrario su desktop (1280px).
await page.setViewport({ width: 1280, height: 800 });
await sleep(400);
const desktop = await page.evaluate(() => {
  const aside = document.querySelector('aside');
  const bottomNav = document.querySelector('nav.fixed');
  return {
    sidebarVisible: !!aside && getComputedStyle(aside).display !== 'none',
    bottomNavHidden: !bottomNav || getComputedStyle(bottomNav).display === 'none',
  };
});
check(
  '7. layout desktop (1280px): sidebar visibile, barra inferiore nascosta',
  desktop.sidebarVisible && desktop.bottomNavHidden,
  JSON.stringify(desktop)
);

// ---- Test 8: popup di conferma personalizzato (brand Chronos) ----
// Apre Impostazioni -> "Esci": deve comparire il dialogo di Chronos
// (non il confirm nativo); "Annulla" lo chiude senza fare logout.
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Opzioni')).click();
});
await sleep(400);
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Esci')).click();
});
await sleep(400);
const dialog = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]');
  return { open: !!d, branded: !!d && d.textContent.includes('Chronos') };
});
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Annulla').click();
});
await sleep(400);
const afterCancel = await page.evaluate(() => ({
  closed: !document.querySelector('[role="dialog"]'),
  stillLogged: !!JSON.parse(localStorage.getItem('chronos-data')).state.auth.token,
}));
check(
  '8. popup di conferma Chronos: si apre brandizzato, Annulla non esegue il logout',
  dialog.open && dialog.branded && afterCancel.closed && afterCancel.stillLogged,
  JSON.stringify({ ...dialog, ...afterCancel })
);

await browser.close();
console.log(results.every(Boolean) ? '\nTUTTI I TEST SUPERATI' : '\nALCUNI TEST FALLITI');
process.exit(results.every(Boolean) ? 0 : 1);
