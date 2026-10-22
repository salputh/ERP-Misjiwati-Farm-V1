<?php

namespace App\Support;

use App\Models\PemberianPakan;
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
        $periodeKandang->loadMissing(['periode', 'recordings', 'pemberianPakan.jenisPakan']);

        $periode = $periodeKandang->periode;
        $beratDoc = (float) $periodeKandang->beratDocGramEfektif();
        $tanggalChickIn = $periodeKandang->tanggalChickInEfektif();
        $standar = new Standar($periode->strain, $beratDoc);
        $populasi = $periodeKandang->populasiAktual();
        $gramPerZakStandar = config('standar.kg_per_zak') * 1000;
        $catatan = $periodeKandang->recordings->keyBy('umur');
        $pemberianPerUmur = $periodeKandang->pemberianPakan->groupBy('umur');
        $zakPerUmur = $pemberianPerUmur->map->sum('zak');
        $gramPakanPerUmur = $pemberianPerUmur->map(
            fn ($pemberian): float => (float) $pemberian->sum(
                fn (PemberianPakan $satu): float => $satu->zak * ($satu->jenisPakan?->kg_per_zak ?? config('standar.kg_per_zak')) * 1000,
            ),
        );

        // Hari chick-in (umur 0) tidak punya baris di lembar, tetapi kematian dan pakannya ikut dihitung.
        $deplesiKumulatif = (int) ($catatan->get(0)?->mati + $catatan->get(0)?->afkir);
        $zakKumulatif = (float) $zakPerUmur->get(0, 0);
        $gramPakanKumulatif = (float) $gramPakanPerUmur->get(0, 0);
        $populasiHidup = $populasi - $deplesiKumulatif;
        $pakanKumulatif = $populasiHidup > 0 ? $gramPakanKumulatif / $populasiHidup : 0.0;
        $pakanKgKumulatif = $gramPakanKumulatif / 1000;

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
                'tanggal' => $tanggalChickIn->copy()->addDays($umur),
                'umur' => $umur,
                'terisi' => $rekam || $adaPakan,
                'mati' => $rekam?->mati,
                'afkir' => $rekam?->afkir,
                'deplesi_kumulatif' => $deplesiKumulatif,
                'deplesi_persen' => $populasi > 0 ? $deplesiKumulatif / $populasi * 100 : 0.0,
                'deplesi_persen_standar' => $standar->deplesiPersen($umur),
                // Dikali dulu baru dibagi agar tidak kena galat pembulatan float (772,5 bukan 772,4999).
                'deplesi_ekor_standar' => round($standar->deplesiPersen($umur) * $populasi) / 100,
                'pakan_gram_standar' => $pakanStandar,
                'pakan_gram_standar_kumulatif' => $pakanStandarKumulatif,
                'abw_standar' => $abwStandar,
                'dg_standar' => $dgStandar,
                'persen_pakan_bw_standar' => $dgStandar / $pakanStandar * 100,
                'fcr_standar' => $standar->fcr($umur),
                'saldo' => $saldo,
            ];

            if ($hasil['terisi']) {
                $zak = (float) $zakPerUmur->get($umur, 0);
                $zakStandar = $pakanStandar * $saldo / $gramPerZakStandar;
                $zakStandarKumulatif += $zakStandar;
                $zakKumulatif += $zak;
                $gramPakan = (float) $gramPakanPerUmur->get($umur, 0);
                $pakanKgKumulatif += $gramPakan / 1000;
                $pakanGram = $saldo > 0 ? $gramPakan / $saldo : 0.0;
                $pakanKumulatif += $pakanGram;

                $hasil += [
                    'zak_standar' => $zakStandar,
                    'zak_standar_kumulatif' => $zakStandarKumulatif,
                    'zak' => $adaPakan ? $zak : null,
                    'zak_kumulatif' => $zakKumulatif,
                    'pakan_kg_kumulatif' => $pakanKgKumulatif,
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
