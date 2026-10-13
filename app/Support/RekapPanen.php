<?php

namespace App\Support;

use App\Models\NotaPanen;
use App\Models\PemberianPakan;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * Isi "Rekapitulasi Panen Gabungan" satu periode: nota timbang per hari panen beserta subtotalnya,
 * total seluruh panen, umur panen per tanggal, dan perhitungan FCR serta IP.
 */
class RekapPanen
{
    /**
     * Pakai relasi notaPanen dan kandangPeriode (recordings, pemberianPakan) yang sudah di-load.
     * Mengembalikan null bila periode belum punya nota panen.
     *
     * @return ?array{mulai: CarbonInterface, selesai: CarbonInterface, hari: list<array<string, mixed>>, total: array<string, int|float|null>, umur: list<array<string, mixed>>, performa: array<string, mixed>}
     */
    public static function buat(Periode $periode): ?array
    {
        $periode->loadMissing('kandangPeriode.pemberianPakan.jenisPakan');
        $nota = $periode->notaPanen;
        if ($nota->isEmpty()) {
            return null;
        }

        $total = self::jumlah($nota);
        $umur = self::umur($periode, $nota);

        return [
            'mulai' => $nota->min('mulai'),
            'selesai' => $nota->max('selesai'),
            'hari' => self::hari($nota),
            'total' => $total,
            'umur' => $umur,
            'performa' => self::performa($periode, $total, $umur),
        ];
    }

    /**
     * Nota dikelompokkan per sesi panen (malam sampai pagi berikutnya), diberi nomor hari berurutan.
     *
     * @param  Collection<int, NotaPanen>  $nota
     * @return list<array{nomor: int, dari: CarbonInterface, sampai: CarbonInterface, nota: list<array<string, mixed>>, subtotal: array<string, int|float|null>}>
     */
    private static function hari(Collection $nota): array
    {
        return $nota
            ->groupBy(fn (NotaPanen $satu): string => $satu->tanggal_panen->toDateString())
            ->sortKeys()
            ->values()
            ->map(fn (Collection $sesi, int $indeks): array => [
                'nomor' => $indeks + 1,
                'dari' => $sesi->min('mulai'),
                'sampai' => $sesi->max('selesai'),
                'nota' => $sesi->map(fn (NotaPanen $satu): array => [
                    'id' => $satu->id,
                    'no_spa' => $satu->no_spa,
                    'no_btpa' => $satu->no_btpa,
                    'no_polisi' => $satu->no_polisi,
                    'pembeli' => $satu->pembeli,
                    'tukang_tangkap' => $satu->tukang_tangkap,
                    'mulai' => $satu->mulai,
                    'selesai' => $satu->selesai,
                    ...self::jumlah(collect([$satu])),
                ])->values()->all(),
                'subtotal' => self::jumlah($sesi),
            ])
            ->all();
    }

    /**
     * Umur ayam saat dipanen, per tanggal mulai timbang: tanggal itu dikurangi tanggal DOC masuk.
     *
     * @param  Collection<int, NotaPanen>  $nota
     * @return list<array<string, mixed>>
     */
    private static function umur(Periode $periode, Collection $nota): array
    {
        return $nota
            ->groupBy(fn (NotaPanen $satu): string => $satu->mulai->toDateString())
            ->sortKeys()
            ->map(fn (Collection $sehari): array => [
                'tanggal' => $sehari->first()->mulai->copy()->startOfDay(),
                'umur' => $periode->umurPada($sehari->first()->mulai),
                ...self::jumlah($sehari),
            ])
            ->values()
            ->all();
    }

    /**
     * FCR memakai seluruh pakan periode dibagi berat ayam terpanen. IP disajikan dua versi:
     * basis ekor terpanen dan basis populasi hidup (DOC dikurangi deplesi).
     *
     * @param  array<string, int|float|null>  $total
     * @param  list<array<string, mixed>>  $umur
     * @return array<string, mixed>
     */
    private static function performa(Periode $periode, array $total, array $umur): array
    {
        $kgPerZakStandar = config('standar.kg_per_zak');
        $pakanZak = $periode->rekap_pakan_zak
            ?? (float) $periode->kandangPeriode->sum(fn (PeriodeKandang $kandang): float => (float) $kandang->pemberianPakan->sum('zak'));
        $deplesi = $periode->rekap_deplesi_ekor
            ?? (int) $periode->kandangPeriode->sum(fn (PeriodeKandang $kandang): int => (int) ($kandang->recordings->sum('mati') + $kandang->recordings->sum('afkir')));

        $pakanKg = $periode->rekap_pakan_zak !== null
            ? $pakanZak * $kgPerZakStandar
            : (float) $periode->kandangPeriode->flatMap->pemberianPakan->sum(
                fn (PemberianPakan $pemberian): float => $pemberian->zak * ($pemberian->jenisPakan?->kg_per_zak ?? $kgPerZakStandar),
            );
        $kgPerZakRataRata = $pakanZak > 0 ? $pakanKg / $pakanZak : $kgPerZakStandar;
        $doc = (int) $periode->kandangPeriode->sum('populasi_awal');
        $fcr = $total['berat'] > 0 ? $pakanKg / $total['berat'] : null;
        $umurRata = collect($umur)->sum(fn (array $hari): int => $hari['ekor'] * $hari['umur']) / $total['ekor'];
        $deplesiPersen = $doc > 0 ? $deplesi / $doc * 100 : null;
        $hidupTerpanen = $doc > 0 ? $total['ekor'] / $doc * 100 : null;
        $hidupDeplesi = $deplesiPersen !== null ? 100 - $deplesiPersen : null;
        $ip = fn (?float $hidup): ?float => $hidup !== null && $fcr && $umurRata > 0 ? $hidup * $total['bw'] / ($fcr * $umurRata) * 100 : null;

        return [
            'pakan_zak' => $pakanZak,
            'pakan_manual' => $periode->rekap_pakan_zak !== null,
            'pakan_kg' => $pakanKg,
            'kg_per_zak' => $kgPerZakRataRata,
            'fcr' => $fcr,
            'doc' => $doc,
            'deplesi' => $deplesi,
            'deplesi_manual' => $periode->rekap_deplesi_ekor !== null,
            'deplesi_persen' => $deplesiPersen,
            'umur_rata' => $umurRata,
            'hidup_terpanen' => $hidupTerpanen,
            'hidup_deplesi' => $hidupDeplesi,
            'ip_terpanen' => $ip($hidupTerpanen),
            'ip_hidup' => $ip($hidupDeplesi),
        ];
    }

    /**
     * Jumlah dan rata-rata sekelompok nota: BW per ekor dan berat per krat dari total berat.
     *
     * @param  Collection<int, NotaPanen>  $nota
     * @return array{jumlah_nota: int, krat: int, ekor: int, berat: float, bw: ?float, per_krat: ?float, netto: float, selisih: float}
     */
    private static function jumlah(Collection $nota): array
    {
        $krat = (int) $nota->sum('jumlah_krat');
        $ekor = (int) $nota->sum('ekor');
        $berat = round((float) $nota->sum('berat_kg'), 2);
        $netto = round((float) $nota->sum('netto_nota_kg'), 2);

        return [
            'jumlah_nota' => $nota->count(),
            'krat' => $krat,
            'ekor' => $ekor,
            'berat' => $berat,
            'bw' => $ekor > 0 ? $berat / $ekor : null,
            'per_krat' => $krat > 0 ? $berat / $krat : null,
            'netto' => $netto,
            'selisih' => round($berat - $netto, 2),
        ];
    }
}
