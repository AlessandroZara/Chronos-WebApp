/*
 * Genera la coppia di chiavi VAPID per il Web Push e scrive
 * `server/push-config.php` (che resta FUORI dal repository, come
 * config.php: contiene la chiave privata).
 *
 * Uso:  node tools/generate-vapid-keys.mjs [email] [--force]
 *   email    contatto del "subject" VAPID (i push service lo usano per
 *            avvisarti in caso di problemi); se omessa resta il segnaposto.
 *   --force  sovrascrive un push-config.php esistente. ATTENZIONE:
 *            rigenerare le chiavi invalida tutte le subscription già
 *            registrate dai dispositivi.
 *
 * Dopo la generazione, copia la chiave PUBBLICA stampata a video nella
 * costante VAPID_PUBLIC_KEY di `src/push.ts` (la pubblica può stare nel
 * repository senza problemi: serve proprio al browser).
 */
import { createECDH } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const force = args.includes('--force');
const email = args.find((a) => a.includes('@')) ?? 'esempio@esempio.it';

const outFile = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'push-config.php');
if (existsSync(outFile) && !force) {
  console.error(
    'server/push-config.php esiste già: rigenerare le chiavi invaliderebbe\n' +
      'le subscription attive. Se lo vuoi davvero, rilancia con --force.'
  );
  process.exit(1);
}

// Base64 "url-safe" senza padding: il formato richiesto sia dal browser
// (applicationServerKey) sia dalle librerie Web Push lato server.
const b64url = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Curva P-256: è quella prescritta dallo standard VAPID (RFC 8292).
const ecdh = createECDH('prime256v1');
ecdh.generateKeys();
// La chiave privata può uscire più corta di 32 byte (zeri iniziali
// omessi): la riallineiamo, i push service pretendono esattamente 32.
const privateRaw = ecdh.getPrivateKey();
const privatePadded = Buffer.concat([Buffer.alloc(32 - privateRaw.length), privateRaw]);

const publicKey = b64url(ecdh.getPublicKey()); // punto non compresso, 65 byte
const privateKey = b64url(privatePadded);

writeFileSync(
  outFile,
  `<?php
/*
 * Chiavi VAPID per il Web Push, generate da tools/generate-vapid-keys.mjs.
 * QUESTO FILE NON VA MAI PUBBLICATO NÉ COMMITTATO: contiene la chiave
 * privata. Va caricato sull'hosting accanto ad api.php, come config.php.
 */
return [
    // Contatto usato dai push service per segnalare problemi.
    'vapid_subject' => 'mailto:${email}',
    'vapid_public_key' => '${publicKey}',
    'vapid_private_key' => '${privateKey}',
];
`
);

console.log('Chiavi VAPID generate!\n');
console.log(`  File scritto:    server/push-config.php (chiave privata, NON committare)`);
console.log(`  Subject:         mailto:${email}`);
console.log(`  Chiave pubblica: ${publicKey}\n`);
console.log('Ora incolla la chiave pubblica in VAPID_PUBLIC_KEY dentro src/push.ts');
