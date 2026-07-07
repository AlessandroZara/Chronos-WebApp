<?php
/*
 * Copia questo file come `config.php` (nella stessa cartella di api.php)
 * e compila i valori con le credenziali del tuo database.
 *
 * Valori tipici su Altervista:
 *   db_host = 'localhost'
 *   db_user = il tuo nome utente Altervista
 *   db_pass = '' (vuota, salvo tu ne abbia impostata una dal pannello)
 *   db_name = 'my_' seguito dal tuo nome utente (es. 'my_alessandro')
 *   db_port = 3306
 */
return [
    'db_host' => 'localhost',
    'db_user' => 'TUO_USERNAME',
    'db_pass' => '',
    'db_name' => 'my_TUO_USERNAME',
    'db_port' => 3306, // porta standard MySQL (LocalWP usa porte diverse)
];
