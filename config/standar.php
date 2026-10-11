<?php

/*
 * Standar pemeliharaan broiler per umur (hari), disalin dari lembar "Recording Harian" farm.
 * Nama strain tidak tercantum di lembar itu, jadi kuncinya memakai nama umum.
 */

$abw = [56, 73, 94, 117, 144, 174, 205, 244, 285, 330, 380, 434, 492, 553, 618, 685, 756, 830, 908, 987, 1069, 1153, 1239, 1327, 1418, 1510, 1604, 1698, 1794, 1891, 1989, 2087, 2187, 2289, 2390, 2495, 2592, 2693, 2794, 2895, 2996, 3097];

$pakan = [18, 22, 26, 30, 34, 38, 43, 45, 53, 56, 63, 68, 73, 78, 84, 90, 96, 102, 106, 114, 120, 126, 132, 138, 144, 150, 156, 162, 168, 173, 178, 183, 188, 193, 198, 202, 206, 210, 214, 216, 222, 225];

return [
    // Berat satu zak pakan (kg).
    'kg_per_zak' => 50,

    'strain' => [
        'Standar farm' => [
            // Bobot badan rata-rata (gram), umur 1 sampai 42.
            'abw' => array_combine(range(1, 42), $abw),

            // Konsumsi pakan per ekor per hari (gram), umur 1 sampai 42.
            'pakan_gram' => array_combine(range(1, 42), $pakan),

            // Deplesi kumulatif (persen): 0,10% di hari pertama, naik 0,13% per hari.
            'deplesi_persen' => array_combine(range(1, 42), array_map(fn (int $umur): float => round(0.10 + 0.13 * ($umur - 1), 2), range(1, 42))),
        ],
    ],
];
