<?php
/*
 * Modello di configurazione Web Push. NON compilarlo a mano: lancia
 *
 *   node tools/generate-vapid-keys.mjs tua-email@esempio.it
 *
 * che crea `push-config.php` con una coppia di chiavi VAPID nuova.
 * Il file generato contiene la CHIAVE PRIVATA e quindi, come config.php,
 * non va mai committato (è già in .gitignore): va solo caricato
 * sull'hosting nella stessa cartella di api.php.
 *
 * La chiave PUBBLICA della stessa coppia va invece in src/push.ts
 * (costante VAPID_PUBLIC_KEY): è il "biglietto da visita" che il browser
 * usa per creare le subscription, e può stare nel repository.
 */
return [
    'vapid_subject' => 'mailto:tua-email@esempio.it',
    'vapid_public_key' => 'CHIAVE_PUBBLICA_BASE64URL',
    'vapid_private_key' => 'CHIAVE_PRIVATA_BASE64URL',
];
