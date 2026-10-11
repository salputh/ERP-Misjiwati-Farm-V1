<?php

namespace App\Support;

use App\Models\PeriodeKandang;
use App\Models\Recording;

/**
 * Menghitung lembar "Recording Harian" satu kandang: deplesi, pakan, body weight,
 * persentase pakan terhadap BW, FCR, dan saldo ayam, masing-masing aktual terhadap standar.
 *
 * Yang dicatat per hari hanya mati, afkir, dan ABW (recordings) serta pakan dalam zak
 * (pemberian pakan); sisanya dihitung di sini.
 */
class LembarRecording
{
    /**
     * Pakai relasi periode, recordings, dan pemberianPakan yang sudah di-load.
     *
     * @return list<array<string, mixed>> Satu baris per umur, dari hari 1 sampai umur terakhir standar.
     */
    public static function baris(PeriodeKandang $periodeKandang): array
    {
        $periode = $periodeKandang->periode;
        $beratDoc = (float) $periode->berat_doc_gram;
        $standar = new Standar($periode->strain, $beratDoc);
        $populasi = $periodeKandang->populasi_awal;
        $gramPerZak = config('standar.kg_per_zak') * 1000;
        $catatan = $periodeKandang->recordings->keyBy('umur');
        $zakPerUmur = $periodeKandang->pemberianPakan->groupBy('umur')->map->sum('zak');

        // Hari chick-in (umur 0) tidak punya baris di lembar, tetapi kematian dan pakannya ikut dihitung.
        $deplesiKumulatif = (int) ($catatan->get(0)?->mati + $catatan->get(0)?->afkir);
        $zakKumulatif = (float) $zakPerUmur->get(0, 0);
        $pakanKumulatif = $zakKumulatif * $gramPerZak / ($populasi - $deplesiKumulatif);

        $pakanStandarKumulatif = 0.0;
        $zakStandarKumulatif = 0.0;
        $abwSebelumnya = $beratDoc;
        $umurAbwSebelumnya = 0;

        $baris = [];
        for ($umur = 1; $umur <= $standar->umurMaksimal(); $umur++) {
            /** @var Recording|null $rekam */
            $rekam = $catatan->get($umur);
            $adaPakan = $zakPerUmur->has($umur);

            $pakanStandar = $standar->pakanGram($umur);
            $pakanStandarKumulatif += $pakanStandar;
            $abwStandar = $standar->abw($umur);
            $dgStandar = $abwStandar - $standar->abw($umur - 1);

            if ($rekam) {
                $deplesiKumulatif += $rekam->mati + $rekam->afkir;
            }
            $saldo = $populasi - $deplesiKumulatif;

            $hasil = [
                'tanggal' => $periode->tanggal_chick_in->copy()->addDays($umur),
                'umur' => $umur,
                'terisi' => $rekam || $adaPakan,
                'mati' => $rekam?->mati,
                'afkir' => $rekam?->afkir,
                'deplesi_kumulatif' => $deplesiKumulatif,
                'deplesi_persen' => $deplesiKumulatif / $populasi * 100,
                'deplesi_persen_standar' => $standar->deplesiPersen($umur),
                // Dikali dulu baru dibagi agar tidak kena galat pembulatan float (772,5 bukan 772,4999).
                'deplesi_ekor_standar' => round($standar->deplesiPersen($umur) * $populasi) / 100,
                'pakan_gram_standar' => $pakanStandar,
                'pakan_gram_standar_kumulatif' => $pakanStandarKumulatif,
                'abw_standar' => $abwStandar,
                'dg_standar' => $dgStandar,
                'persen_pakan_bw_standar' => $dgStandar / $pakanStandar * 100,
                'fcr_standar' => $pakanStandarKumulatif / $abwStandar,
                'saldo' => $saldo,
            ];

            if ($hasil['terisi']) {
                $zak = (float) $zakPerUmur->get($umur, 0);
                $zakStandar = $pakanStandar * $saldo / $gramPerZak;
                $zakStandarKumulatif += $zakStandar;
                $zakKumulatif += $zak;
                $pakanGram = $zak * $gramPerZak / $saldo;
                $pakanKumulatif += $pakanGram;

                $hasil += [
                    'zak_standar' => $zakStandar,
                    'zak_standar_kumulatif' => $zakStandarKumulatif,
                    'zak' => $adaPakan ? $zak : null,
                    'zak_kumulatif' => $zakKumulatif,
                    'pakan_gram' => $adaPakan ? $pakanGram : null,
                    'pakan_gram_kumulatif' => $pakanKumulatif,
                    'selisih_zak' => $zakKumulatif - $zakStandarKumulatif,
                    'selisih_pakan_gram' => $pakanKumulatif - $pakanStandarKumulatif,
                ];

                $abw = $rekam?->bobot_rata_gram;
                if ($abw !== null) {
                    $hasil += [
                        'abw' => $abw,
                        'dg_kumulatif' => $abw - $beratDoc,
                        'abw_persen_standar' => $abw / $abwStandar * 100,
                        'selisih_abw' => $abw - $abwStandar,
                        'fcr' => $pakanKumulatif / $abw,
                        'selisih_fcr' => $pakanKumulatif / $abw - $hasil['fcr_standar'],
                    ];

                    // Pertambahan harian hanya bermakna bila hari sebelumnya juga ditimbang.
                    if ($umurAbwSebelumnya === $umur - 1) {
                        $dg = $abw - $abwSebelumnya;
                        $hasil += [
                            'dg' => $dg,
                            'selisih_dg' => $dg - $dgStandar,
                            'persen_pakan_bw' => $pakanGram > 0 ? $dg / $pakanGram * 100 : null,
                        ];
                    }

                    $abwSebelumnya = $abw;
                    $umurAbwSebelumnya = $umur;
                }
            }

            $baris[] = $hasil;
        }

        return $baris;
    }
}
