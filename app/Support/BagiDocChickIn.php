<?php

namespace App\Support;

use App\Models\PeriodeKandang;
use Illuminate\Support\Collection;

/**
 * Membagi jumlah DOC chick-in tingkat periode ke tiap kandang pada periode itu.
 *
 * Populasi administratif tiap kandang menjadi bobot pembagian, sehingga pembagian ini hanya berlaku pada
 * periodenya sendiri. Bonus DOC sudah tercatat terpisah per kandang dan tidak ikut dibagi; ia hanya
 * mengurangi bagian populasi administratif. Sisa pembulatan jatuh ke kandang dengan sisa pembagian terbesar
 * supaya jumlah ekornya tepat sama dengan yang diminta.
 */
class BagiDocChickIn
{
    /**
     * @param  Collection<int, PeriodeKandang>  $kandang  Kandang periode, sudah dimuat relasi kandang dan recording.
     * @return array{populasi_awal: array<int, int>, galat: ?string} Populasi administratif baru per id kandang, atau pesan galat.
     */
    public static function alokasi(int $total, Collection $kandang): array
    {
        if ($kandang->isEmpty()) {
            return ['populasi_awal' => [], 'galat' => 'Tambahkan kandang ke periode ini terlebih dahulu untuk menetapkan jumlah DOC chick-in.'];
        }

        $bonusTotal = (int) $kandang->sum(fn (PeriodeKandang $satu): int => (int) ($satu->bonus_doc_ekor ?? 0));
        if ($bonusTotal > $total) {
            return [
                'populasi_awal' => [],
                'galat' => 'Jumlah DOC chick-in tidak boleh lebih kecil dari total bonus DOC ('.Format::angka($bonusTotal).' ekor).',
            ];
        }

        $sisa = $total - $bonusTotal;
        $bobot = $kandang->map(fn (PeriodeKandang $satu): int => (int) $satu->populasi_awal)->values();
        $totalBobot = (int) $bobot->sum();
        if ($totalBobot <= 0) {
            $bobot = $kandang->map(fn (): int => 1)->values();
            $totalBobot = $bobot->count();
        }

        $populasi = [];
        $sisaPembagian = [];
        foreach ($kandang->values() as $indeks => $satu) {
            $populasi[$indeks] = intdiv($sisa * $bobot[$indeks], $totalBobot);
            $sisaPembagian[$indeks] = $sisa * $bobot[$indeks] - $populasi[$indeks] * $totalBobot;
        }

        $sisaUntukDibagikan = $sisa - (int) array_sum($populasi);
        if ($sisaUntukDibagikan > 0) {
            $urutan = collect($sisaPembagian)
                ->map(fn (int $nilai, int $indeks): array => ['indeks' => $indeks, 'nilai' => $nilai])
                ->sortByDesc('nilai')
                ->pluck('indeks')
                ->all();

            foreach (array_slice($urutan, 0, $sisaUntukDibagikan) as $indeks) {
                $populasi[$indeks]++;
            }
        }

        foreach ($kandang->values() as $indeks => $satu) {
            $baru = $populasi[$indeks];
            $populasiAktualBaru = $baru + (int) ($satu->bonus_doc_ekor ?? 0);

            if ((int) $satu->populasi_awal >= 1 && $baru < 1) {
                return [
                    'populasi_awal' => [],
                    'galat' => 'Jumlah DOC chick-in terlalu kecil untuk dibagikan ke seluruh kandang pada periode ini.',
                ];
            }

            $kapasitas = (int) ($satu->kandang?->kapasitas ?? 0);
            if ($kapasitas > 0 && $populasiAktualBaru > $kapasitas) {
                return [
                    'populasi_awal' => [],
                    'galat' => 'Populasi '.($satu->kandang?->nama ?? 'kandang').' menjadi '.Format::angka($populasiAktualBaru)
                        .' ekor dan melebihi kapasitas ('.Format::angka($kapasitas).' ekor).',
                ];
            }

            $mati = $satu->kematianTercatat();
            if ($mati > $populasiAktualBaru) {
                return [
                    'populasi_awal' => [],
                    'galat' => 'Populasi '.($satu->kandang?->nama ?? 'kandang').' menjadi '.Format::angka($populasiAktualBaru)
                        .' ekor, lebih kecil dari kematian tercatat '.Format::angka($mati).' ekor.',
                ];
            }
        }

        $hasil = [];
        foreach ($kandang->values() as $indeks => $satu) {
            $hasil[$satu->id] = $populasi[$indeks];
        }

        return ['populasi_awal' => $hasil, 'galat' => null];
    }
}
