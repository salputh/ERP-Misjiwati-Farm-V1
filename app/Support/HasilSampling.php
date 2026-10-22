<?php

namespace App\Support;

/**
 * Menghitung rekap sampling bobot: total per line, subtotal dan ABW per lantai dan kelamin,
 * lalu gabungan seluruh sampel beserta DG terhadap standar.
 *
 * Satu titik = satu kali timbang sekelompok ayam pada satu line, lantai, dan kelamin.
 * Jumlah ekor tiap titik boleh berbeda (blok sampling memakai jumlah ekor yang berbeda-beda),
 * jadi ABW dihitung dari total ekor yang benar-benar ditimbang, bukan dari satu angka per sesi.
 */
class HasilSampling
{
    /**
     * @param  array<string, array<string, array<string, array<int, int|float|string|null>>>>  $berat  [lantai][kelamin][line][urutan] => gram
     * @param  array<string, array<string, array<string, array<int, int|string|null>>>>  $ekorTitik  [lantai][kelamin][line][urutan] => ekor
     * @param  ?float  $abwSebelumnya  ABW acuan gabungan (bobot DOC di umur 1 bila belum ada penimbangan lain)
     * @param  array<string, array<string, ?float>>  $abwKelompokSebelumnya  [lantai][kelamin] => ABW sesi sebelumnya
     * @param  int  $hariAcuan  Jarak hari antara sesi ini dan acuan gabungan
     * @param  int  $hariAcuanKelompok  Jarak hari antara sesi ini dan sesi sebelumnya
     * @return array<string, mixed>
     */
    public static function hitung(
        array $berat,
        array $ekorTitik,
        bool $denganSexing,
        int $umur,
        Standar $standar,
        ?float $abwSebelumnya,
        array $abwKelompokSebelumnya = [],
        int $hariAcuan = 1,
        int $hariAcuanKelompok = 1,
    ): array {
        $kelaminAktif = self::kelamin($denganSexing);
        $sampelPerLine = config('sampling.sampel_per_line');
        $abwStandar = $standar->abw($umur);
        $dgStandar = $abwStandar !== null && $standar->abw($umur - 1) !== null ? $abwStandar - $standar->abw($umur - 1) : null;
        $hariAcuan = max(1, $hariAcuan);
        $hariAcuanKelompok = max(1, $hariAcuanKelompok);

        $lantai = [];
        foreach (config('sampling.lantai') as $kunciLantai => $infoLantai) {
            foreach ($kelaminAktif as $kelamin) {
                $baris = [];
                foreach ($infoLantai['line'] as $line) {
                    $sampel = [];
                    $ekorBaris = [];
                    for ($urutan = 1; $urutan <= $sampelPerLine; $urutan++) {
                        $nilai = $berat[$kunciLantai][$kelamin][$line][$urutan] ?? null;
                        $sampel[$urutan] = is_numeric($nilai) ? (float) $nilai : null;
                        $ekorBaris[$urutan] = (int) ($ekorTitik[$kunciLantai][$kelamin][$line][$urutan] ?? 0);
                    }
                    $terisi = array_filter($sampel, fn (?float $nilai): bool => $nilai !== null);
                    $totalEkor = 0;
                    foreach ($terisi as $urutan => $nilai) {
                        $totalEkor += $ekorBaris[$urutan];
                    }

                    $baris[$line] = [
                        'sampel' => $sampel,
                        'ekor_titik' => $ekorBaris,
                        'total' => $terisi ? array_sum($terisi) : null,
                        'jumlah_terisi' => count($terisi),
                        'ekor' => $totalEkor,
                    ];
                }

                $subtotal = array_sum(array_column($baris, 'total'));
                $totalEkor = array_sum(array_column($baris, 'ekor'));
                $abw = $totalEkor > 0 ? $subtotal / $totalEkor : null;

                // Kelompok tanpa sexing memakai ABW gabungan sebagai acuan bila sesi sebelumnya tidak punya kelompok yang sama.
                $acuan = $abwKelompokSebelumnya[$kunciLantai][$kelamin] ?? null;
                $hari = $hariAcuanKelompok;
                if ($acuan === null && $kelamin === 'campuran') {
                    $acuan = $abwSebelumnya;
                    $hari = $hariAcuan;
                }

                $dg = $abw !== null && $acuan !== null ? $abw - $acuan : null;
                $dgPerHari = $dg !== null ? $dg / $hari : null;

                $lantai[$kunciLantai][$kelamin] = [
                    'baris' => $baris,
                    'subtotal' => $subtotal,
                    'ekor' => $totalEkor,
                    'abw' => $abw,
                    'dg' => $dg,
                    'dg_per_hari' => $dgPerHari,
                    'hari' => $hari,
                    'dg_standar' => $dgStandar,
                    'selisih_dg' => $dgPerHari !== null && $dgStandar !== null ? $dgPerHari - $dgStandar : null,
                ];
            }
        }

        $perKelamin = [];
        foreach ($kelaminAktif as $kelamin) {
            $kelompok = array_column($lantai, $kelamin);
            $total = array_sum(array_column($kelompok, 'subtotal'));
            $ekor = array_sum(array_column($kelompok, 'ekor'));
            $perKelamin[$kelamin] = [
                'total' => $total,
                'jumlah_line' => array_sum(array_map(fn (array $k): int => count(array_filter($k['baris'], fn (array $b): bool => $b['jumlah_terisi'] > 0)), $kelompok)),
                'jumlah_titik' => array_sum(array_map(fn (array $k): int => array_sum(array_column($k['baris'], 'jumlah_terisi')), $kelompok)),
                'ekor' => $ekor,
                'abw' => $ekor > 0 ? $total / $ekor : null,
            ];
        }

        $total = array_sum(array_column($perKelamin, 'total'));
        $ekor = array_sum(array_column($perKelamin, 'ekor'));
        $abw = $ekor > 0 ? $total / $ekor : null;
        $dg = $abw !== null && $abwSebelumnya !== null ? $abw - $abwSebelumnya : null;
        $dgPerHari = $dg !== null ? $dg / $hariAcuan : null;
        $jumlahTitikPenuh = count($kelaminAktif) * array_sum(array_map(fn (array $info): int => count($info['line']), config('sampling.lantai'))) * $sampelPerLine;

        return [
            'kelamin' => $kelaminAktif,
            'lantai' => $lantai,
            'per_kelamin' => $perKelamin,
            'gabungan' => [
                'total' => $total,
                'jumlah_line' => array_sum(array_map(fn (array $info): int => count($info['line']), config('sampling.lantai'))),
                'jumlah_titik' => array_sum(array_column($perKelamin, 'jumlah_titik')),
                'jumlah_titik_penuh' => $jumlahTitikPenuh,
                'ekor' => $ekor,
                'abw' => $abw,
                'abw_standar' => $abwStandar,
                'abw_sebelumnya' => $abwSebelumnya,
                'dg' => $dg,
                'dg_per_hari' => $dgPerHari,
                'hari' => $hariAcuan,
                'dg_standar' => $dgStandar,
                'selisih_dg' => $dgPerHari !== null && $dgStandar !== null ? $dgPerHari - $dgStandar : null,
            ],
        ];
    }

    /**
     * @return list<string>
     */
    public static function kelamin(bool $denganSexing): array
    {
        return $denganSexing ? ['jantan', 'betina'] : ['campuran'];
    }
}
