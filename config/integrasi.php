<?php

/*
 * Integrasi dari sistem lain. Token Kandang Suite dibaca dari .env (KANDANG_SUITE_TOKEN);
 * bila kosong, pintu integrasinya nonaktif dan menolak semua permintaan.
 */

return [
    'kandang_suite' => [
        'token' => env('KANDANG_SUITE_TOKEN'),
    ],
];
