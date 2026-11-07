<?php

/*
 * Sampling bobot: susunan line per lantai dan aturan sexing, mengikuti lembar
 * "Rekap Hasil Sampel Bobot Ayam" farm.
 */

return [
    // Mulai umur ini sampel dipisah jantan dan betina.
    'umur_mulai_sexing' => 13,

    // Jumlah ekor dalam satu kali timbang (satu sampel).
    'ekor_per_sampel' => [
        'campuran' => 20,
        'jantan' => 10,
        'betina' => 10,
    ],

    // Dua kali timbang per line.
    'sampel_per_line' => 2,

    'lantai' => [
        'bawah' => ['label' => 'Lantai bawah', 'line' => ['A', 'B', 'C', 'D', 'E', 'F']],
        'atas' => ['label' => 'Lantai atas', 'line' => ['J', 'K', 'L', 'M', 'N', 'O']],
    ],

    // Kandang yang susunan line-nya berbeda dari 'lantai' di atas (kunci: nama kandang persis).
    'susunan_kandang' => [
        'Kandang 1' => [
            'bawah' => ['label' => 'Lantai bawah', 'line' => ['A', 'B', 'C', 'D', 'E']],
            'atas' => ['label' => 'Lantai atas', 'line' => ['F', 'G', 'H', 'I', 'J']],
        ],
    ],
];
