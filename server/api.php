<?php
/*
 * Chronos — API multi-utente per hosting PHP + MySQL (es. Altervista).
 *
 * Endpoint (selezionati con ?action=...):
 *   POST api.php?action=register  { firstName, lastName, email, password }
 *   POST api.php?action=login     { email, password }
 *       -> entrambi rispondono { token, user }
 *   GET  api.php?action=state     (header X-Chronos-Token) -> { data, updatedAt }
 *   POST api.php?action=state     (header X-Chronos-Token) { data, updatedAt }
 *
 * Ogni utente ha un token personale generato alla registrazione: è la sua
 * "sessione permanente". Le password sono salvate con password_hash (bcrypt).
 * Lo stato dell'app di ciascun utente è un blocco JSON in chronos_user_state.
 */

header('Content-Type: application/json; charset=utf-8');
// I dati devono essere sempre freschi: vieta a browser e proxy la cache.
header('Cache-Control: no-store');
// CORS aperto: la sicurezza è garantita da password e token, non dall'origine.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Chronos-Token');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

/** Risponde con un codice HTTP e un payload JSON, poi termina. */
function respond(int $code, array $payload): void
{
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

$configFile = __DIR__ . '/config.php';
if (!file_exists($configFile)) {
    respond(500, ['error' => 'config.php mancante: copia config.sample.php in config.php e compilalo.']);
}
$config = require $configFile;

// --- Connessione al database ---
// Da PHP 8.1 mysqli lancia eccezioni per default: le disattiviamo per
// gestire gli errori a mano e rispondere sempre con JSON pulito.
mysqli_report(MYSQLI_REPORT_OFF);
$port = (int) ($config['db_port'] ?? 3306);
$db = @mysqli_connect($config['db_host'], $config['db_user'], $config['db_pass'], $config['db_name'], $port);
if (!$db) {
    respond(500, ['error' => 'Connessione al database fallita: controlla config.php.']);
}
mysqli_set_charset($db, 'utf8mb4');

// Le tabelle si creano da sole al primo utilizzo: nessun setup manuale.
mysqli_query($db, "CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    api_token CHAR(64) NOT NULL UNIQUE,
    failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    locked_until DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4");

mysqli_query($db, "CREATE TABLE IF NOT EXISTS chronos_user_state (
    user_id INT UNSIGNED NOT NULL PRIMARY KEY,
    data LONGTEXT NOT NULL,
    updated_at VARCHAR(40) NOT NULL
) CHARACTER SET utf8mb4");

$action = $_GET['action'] ?? 'state';
$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents('php://input'), true);

// ============================================================
// REGISTRAZIONE
// ============================================================
if ($action === 'register' && $method === 'POST') {
    $firstName = trim((string) ($body['firstName'] ?? ''));
    $lastName = trim((string) ($body['lastName'] ?? ''));
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $password = (string) ($body['password'] ?? '');

    if ($firstName === '' || $lastName === '') {
        respond(400, ['error' => 'Nome e cognome sono obbligatori.']);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond(400, ['error' => 'Indirizzo email non valido.']);
    }
    if (strlen($password) < 8) {
        respond(400, ['error' => 'La password deve avere almeno 8 caratteri.']);
    }

    // Email già usata?
    $stmt = mysqli_prepare($db, 'SELECT id FROM users WHERE email = ?');
    mysqli_stmt_bind_param($stmt, 's', $email);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_store_result($stmt);
    if (mysqli_stmt_num_rows($stmt) > 0) {
        respond(409, ['error' => 'Questa email è già registrata. Prova ad accedere.']);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $token = bin2hex(random_bytes(32)); // token personale dell'utente

    $stmt = mysqli_prepare(
        $db,
        'INSERT INTO users (first_name, last_name, email, password_hash, api_token) VALUES (?, ?, ?, ?, ?)'
    );
    mysqli_stmt_bind_param($stmt, 'sssss', $firstName, $lastName, $email, $hash, $token);
    if (!mysqli_stmt_execute($stmt)) {
        respond(500, ['error' => 'Registrazione fallita, riprova.']);
    }

    respond(200, [
        'token' => $token,
        'user' => ['firstName' => $firstName, 'lastName' => $lastName, 'email' => $email],
    ]);
}

// ============================================================
// LOGIN
// ============================================================
if ($action === 'login' && $method === 'POST') {
    // Protezione anti forza bruta: dopo $maxAttempts password sbagliate
    // su un account esistente, il login viene bloccato per $lockMinutes.
    $maxAttempts = 5;
    $lockMinutes = 15;

    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $password = (string) ($body['password'] ?? '');

    $stmt = mysqli_prepare(
        $db,
        'SELECT id, first_name, last_name, password_hash, api_token, failed_attempts, locked_until
         FROM users WHERE email = ?'
    );
    mysqli_stmt_bind_param($stmt, 's', $email);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);
    $row = $result ? mysqli_fetch_assoc($result) : null;

    // Email inesistente: messaggio generico, così non riveliamo
    // quali indirizzi sono registrati.
    if (!$row) {
        respond(401, ['error' => 'Email o password errati.']);
    }

    // Account attualmente bloccato?
    if ($row['locked_until'] !== null && strtotime($row['locked_until']) > time()) {
        $minutes = (int) ceil((strtotime($row['locked_until']) - time()) / 60);
        respond(429, ['error' => "Troppi tentativi falliti: account bloccato. Riprova tra $minutes minuti."]);
    }

    if (!password_verify($password, $row['password_hash'])) {
        $attempts = (int) $row['failed_attempts'] + 1;
        if ($attempts >= $maxAttempts) {
            // Quinto errore: scatta il blocco e il contatore riparte.
            // La scadenza è calcolata da PHP (non da MySQL con NOW()):
            // così creazione e verifica usano lo stesso orologio e non
            // ci sono sorprese se DB e PHP hanno fusi orari diversi.
            $lockedUntil = date('Y-m-d H:i:s', time() + $lockMinutes * 60);
            $stmt = mysqli_prepare(
                $db,
                'UPDATE users SET failed_attempts = 0, locked_until = ? WHERE id = ?'
            );
            mysqli_stmt_bind_param($stmt, 'si', $lockedUntil, $row['id']);
            mysqli_stmt_execute($stmt);
            respond(429, ['error' => "Troppi tentativi falliti: account bloccato per $lockMinutes minuti."]);
        }
        $stmt = mysqli_prepare($db, 'UPDATE users SET failed_attempts = ? WHERE id = ?');
        mysqli_stmt_bind_param($stmt, 'ii', $attempts, $row['id']);
        mysqli_stmt_execute($stmt);
        respond(401, ['error' => 'Email o password errati.']);
    }

    // Login riuscito: azzera contatore ed eventuale blocco scaduto.
    $stmt = mysqli_prepare($db, 'UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?');
    mysqli_stmt_bind_param($stmt, 'i', $row['id']);
    mysqli_stmt_execute($stmt);

    respond(200, [
        'token' => $row['api_token'],
        'user' => ['firstName' => $row['first_name'], 'lastName' => $row['last_name'], 'email' => $email],
    ]);
}

// ============================================================
// MODIFICA PROFILO (nome, cognome, email, password — richiede token)
// ============================================================
if ($action === 'profile' && $method === 'POST') {
    $token = $_SERVER['HTTP_X_CHRONOS_TOKEN'] ?? '';
    if ($token === '') {
        respond(401, ['error' => 'Token mancante: effettua il login.']);
    }
    $stmt = mysqli_prepare($db, 'SELECT id, password_hash FROM users WHERE api_token = ?');
    mysqli_stmt_bind_param($stmt, 's', $token);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);
    $user = $result ? mysqli_fetch_assoc($result) : null;
    if (!$user) {
        respond(401, ['error' => 'Sessione non valida: effettua di nuovo il login.']);
    }
    $userId = (int) $user['id'];

    $firstName = trim((string) ($body['firstName'] ?? ''));
    $lastName = trim((string) ($body['lastName'] ?? ''));
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    if ($firstName === '' || $lastName === '') {
        respond(400, ['error' => 'Nome e cognome sono obbligatori.']);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond(400, ['error' => 'Indirizzo email non valido.']);
    }

    // La nuova email non deve appartenere a un ALTRO account.
    $stmt = mysqli_prepare($db, 'SELECT id FROM users WHERE email = ? AND id <> ?');
    mysqli_stmt_bind_param($stmt, 'si', $email, $userId);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_store_result($stmt);
    if (mysqli_stmt_num_rows($stmt) > 0) {
        respond(409, ['error' => 'Questa email è già usata da un altro account.']);
    }

    // Cambio password opzionale: richiede la password attuale corretta.
    $newPassword = (string) ($body['newPassword'] ?? '');
    if ($newPassword !== '') {
        $currentPassword = (string) ($body['currentPassword'] ?? '');
        if (!password_verify($currentPassword, $user['password_hash'])) {
            respond(401, ['error' => 'La password attuale non è corretta.']);
        }
        if (strlen($newPassword) < 8) {
            respond(400, ['error' => 'La nuova password deve avere almeno 8 caratteri.']);
        }
        $hash = password_hash($newPassword, PASSWORD_DEFAULT);
        $stmt = mysqli_prepare(
            $db,
            'UPDATE users SET first_name = ?, last_name = ?, email = ?, password_hash = ? WHERE id = ?'
        );
        mysqli_stmt_bind_param($stmt, 'ssssi', $firstName, $lastName, $email, $hash, $userId);
    } else {
        $stmt = mysqli_prepare($db, 'UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE id = ?');
        mysqli_stmt_bind_param($stmt, 'sssi', $firstName, $lastName, $email, $userId);
    }
    if (!mysqli_stmt_execute($stmt)) {
        respond(500, ['error' => 'Salvataggio del profilo fallito.']);
    }

    respond(200, [
        'ok' => true,
        'user' => ['firstName' => $firstName, 'lastName' => $lastName, 'email' => $email],
    ]);
}

// ============================================================
// STATO DELL'APP (lettura/scrittura, richiede il token utente)
// ============================================================
if ($action === 'state') {
    $token = $_SERVER['HTTP_X_CHRONOS_TOKEN'] ?? '';
    if ($token === '') {
        respond(401, ['error' => 'Token mancante: effettua il login.']);
    }

    $stmt = mysqli_prepare($db, 'SELECT id FROM users WHERE api_token = ?');
    mysqli_stmt_bind_param($stmt, 's', $token);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);
    $user = $result ? mysqli_fetch_assoc($result) : null;
    if (!$user) {
        respond(401, ['error' => 'Sessione non valida: effettua di nuovo il login.']);
    }
    $userId = (int) $user['id'];

    if ($method === 'GET') {
        $stmt = mysqli_prepare($db, 'SELECT data, updated_at FROM chronos_user_state WHERE user_id = ?');
        mysqli_stmt_bind_param($stmt, 'i', $userId);
        mysqli_stmt_execute($stmt);
        $result = mysqli_stmt_get_result($stmt);
        $row = $result ? mysqli_fetch_assoc($result) : null;
        if ($row) {
            respond(200, ['data' => json_decode($row['data']), 'updatedAt' => $row['updated_at']]);
        }
        respond(200, ['data' => null, 'updatedAt' => null]);
    }

    if ($method === 'POST' || $method === 'PUT') {
        if (!is_array($body) || !isset($body['data'])) {
            respond(400, ['error' => 'Body non valido: atteso { data, updatedAt }.']);
        }
        $json = json_encode($body['data'], JSON_UNESCAPED_UNICODE);
        $updatedAt = is_string($body['updatedAt'] ?? null) ? $body['updatedAt'] : date('c');

        // REPLACE = inserisce la riga dell'utente se non esiste, altrimenti la sovrascrive.
        $stmt = mysqli_prepare($db, 'REPLACE INTO chronos_user_state (user_id, data, updated_at) VALUES (?, ?, ?)');
        mysqli_stmt_bind_param($stmt, 'iss', $userId, $json, $updatedAt);
        if (!mysqli_stmt_execute($stmt)) {
            respond(500, ['error' => 'Salvataggio fallito.']);
        }
        respond(200, ['ok' => true, 'updatedAt' => $updatedAt]);
    }
}

respond(404, ['error' => 'Azione non riconosciuta.']);
