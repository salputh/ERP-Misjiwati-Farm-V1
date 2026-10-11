<?php

namespace App\Support;

/**
 * Menghitung rekap sampling bobot: total per line, subtotal dan ABW per lantai dan kelamin,
 * lalu gabungan seluruh sampel beserta DG terhadap standar.
 *
 * Satu sampel = berat total sekelompok ayam (mis. 20 ekor) dalam gram.
 */
class HasilSampling
{
    /**
     * @param  array<string, array<string, array<string, array<int, int|float|string|null>>>>  $berat  [lantai][kelamin][line][urutan] => gram
     * @param  array<string, int>  $ekorPerSampel  kelamin => ekor
     * @param  ?float  $abwSebelumnya  ABW gabungan hari sebelumnya (atau berat DOC di umur 1)
     * @param  array<string, array<string, ?float>>  $abwKelompokSebelumnya  [lantai][kelamin] => ABW sesi hari sebelumnya
     * @return array<string, mixed>
     */
    public static function hitung(
        array $berat,
        array $ekorPerSampel,
        bool $denganSexing,
        int $umur,
        Standar $standar,
        ?float $abwSebelumnya,
        array $abwKelompokSebelumnya = [],
    ): array {
        $kelaminAktif = self::kelamin($denganSexing);
        $sampelPerLine = config('sampling.sampel_per_line');
        $abwStandar = $standar->abw($umur);
        $dgStandar = $abwStandar !== null && $standar->abw($umur - 1) !== null ? $abwStandar - $standar->abw($umur - 1) : null;

        $lantai = [];
        foreach (config('sampling.lantai') as $kunciLantai => $infoLantai) {
            foreach ($kelaminAktif as $kelamin) {
                $baris = [];
                foreach ($infoLantai['line'] as $line) {
                    $sampel = [];
                    for ($urutan = 1; $urutan <= $sampelPerLine; $urutan++) {
                        $nilai = $berat[$kunciLantai][$kelamin][$line][$urutan] ?? null;
                        $sampel[$urutan] = is_numeric($nilai) ? (float) $nilai : null;
                    }
                    $terisi = array_filter($sampel, fn (?float $nilai): bool => $nilai !== null);
                    $baris[$line] = ['sampel' => $sampel, 'total' => $terisi ? array_sum($terisi) : null, 'jumlah_terisi' => count($terisi)];
                }

                $subtotal = array_sum(array_column($baris, 'total'));
                $ekor = array_sum(array_column($baris, 'jumlah_terisi')) * ($ekorPerSampel[$kelamin] ?? 0);
                $abw = $ekor > 0 ? $subtotal / $ekor : null;
                // Kelompok tanpa sexing memakai ABW gabungan kemarin bila tidak ada sampel kelompok yang sama.
                $acuan = $abwKelompokSebelumnya[$kunciLantai][$kelamin] ?? ($kelamin === 'campuran' ? $abwSebelumnya : null);
                $dg = $abw !== null && $acuan !== null ? $abw - $acuan : null;

                $lantai[$kunciLantai][$kelamin] = [
                    'baris' => $baris,
                    'subtotal' => $subtotal,
                    'ekor' => $ekor,
                    'abw' => $abw,
                    'dg' => $dg,
                    'dg_standar' => $dgStandar,
                    'selisih_dg' => $dg !== null && $dgStandar !== null ? $dg - $dgStandar : null,
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
                'dg_standar' => $dgStandar,
                'selisih_dg' => $dg !== null && $dgStandar !== null ? $dg - $dgStandar : null,
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
