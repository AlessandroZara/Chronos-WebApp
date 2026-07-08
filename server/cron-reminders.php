<?php
/*
 * Chronos — Attività pianificate (cron).
 *
 * Punto d'ingresso unico per i lavori automatici lato server, pensato
 * per girare SENZA intervento manuale in due modi equivalenti:
 *
 *   1. cron dell'hosting (es. SiteGround):
 *        php /percorso/del/sito/cron-reminders.php
 *   2. cron esterno via HTTP (es. cron-job.org, per hosting senza cron):
 *        https://tuosito.example/cron-reminders.php?secret=IL_TUO_SEGRETO
 *
 * Il segreto (`cron_secret` in push-config.php, generato da
 * tools/generate-vapid-keys.mjs) serve solo per la via HTTP: impedisce
 * a chiunque di far lavorare il server a raffica. Da riga di comando
 * non è richiesto: chi ha accesso alla shell ha già tutto.
 *
 * OGGI questo script è un "battito di vita": risponde confermando di
 * essere raggiungibile e configurato. PROSSIMO STEP: caricare le
 * subscription Web Push dal database, calcolare i promemoria in
 * scadenza e spedirli con la libreria minishlink/web-push firmando con
 * le chiavi VAPID di push-config.php (ripulendo le subscription morte,
 * risposte 404/410 dal push service).
 *
 * La frequenza del cron (es. ogni 5 minuti) sarà la puntualità massima
 * dei promemoria inviati.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

/** Risponde con un codice HTTP e un payload JSON, poi termina. */
function respond(int $code, array $payload): void
{
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

$pushConfigFile = __DIR__ . '/push-config.php';
$pushConfig = file_exists($pushConfigFile) ? require $pushConfigFile : [];

// Via HTTP si entra solo con il segreto giusto (confronto a tempo
// costante). In CLI il controllo non serve.
if (PHP_SAPI !== 'cli') {
    $secret = (string) ($pushConfig['cron_secret'] ?? '');
    if ($secret === '' || !hash_equals($secret, (string) ($_GET['secret'] ?? ''))) {
        respond(403, ['error' => 'Segreto mancante o errato.']);
    }
}

// --- Da qui in poi: i lavori veri e propri (prossimo step) ---

respond(200, [
    'ok' => true,
    'message' => 'Cron raggiungibile. Invio promemoria: non ancora implementato.',
    'vapidConfigured' => isset($pushConfig['vapid_private_key']),
    'time' => date('c'),
]);
