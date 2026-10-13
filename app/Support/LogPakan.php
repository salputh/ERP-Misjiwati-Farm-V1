<?php

namespace App\Support;

use App\Models\PemberianPakan;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use Illuminate\Support\Collection;

/**
 * Log harian pemberian pakan satu periode: per tanggal dan jenis pakan, satu kolom per kandang, plus total.
 */
class LogPakan
{
    /**
     * Pakai relasi kandangPeriode (kandang, pemberianPakan.jenisPakan) dan penerimaanPakan.jenisPakan yang sudah di-load.
     *
     * @return array{kandang: array<int, string>, hari: list<array<string, mixed>>, total_kandang: array<int, float>, total: float, total_kg: float, per_jenis: list<array<string, mixed>>, total_stok: array{masuk: float, masuk_kg: float, terpakai: float, terpakai_kg: float, sisa: ?float, sisa_kg: ?float}}
     */
    public static function buat(Periode $periode): array
    {
        $kandang = $periode->kandangPeriode->sortBy('kandang.nama');
        $pemberian = $kandang->flatMap->pemberianPakan;
        $perUmur = $pemberian->groupBy('umur');

        $umurAkhir = max(
            (int) $pemberian->max('umur'),
            $periode->status === 'aktif' ? min($periode->umurPada(today()), (new Standar($periode->strain, 0))->umurMaksimal()) : 0,
        );

        // Sisa per jenis = pakan masuk dikurangi pemberian di log ini.
        $stok = RingkasanHarian::opname($periode);

        $hari = [];
        for ($umur = 0; $umur <= $umurAkhir; $umur++) {
            $hari[] = [
                'tanggal' => $periode->tanggal_chick_in->copy()->addDays($umur),
                'umur' => $umur,
                'jenis' => self::barisJenis($perUmur->get($umur, collect())),
            ];
        }

        return [
            'kandang' => $kandang->mapWithKeys(fn (PeriodeKandang $k): array => [$k->id => $k->kandang->nama])->all(),
            'hari' => $hari,
            'total_kandang' => $kandang->mapWithKeys(fn (PeriodeKandang $k): array => [$k->id => (float) $k->pemberianPakan->sum('zak')])->all(),
            'total' => (float) $pemberian->sum('zak'),
            'total_kg' => (float) $pemberian->sum(
                fn (PemberianPakan $satu): float => $satu->zak * ($satu->jenisPakan?->kg_per_zak ?? config('standar.kg_per_zak')),
            ),
            'per_jenis' => $stok->all(),
            'total_stok' => [
                'masuk' => (float) $stok->sum('masuk'),
                'masuk_kg' => (float) $stok->sum(fn (array $satu): float => ($satu['masuk'] ?? 0) * $satu['kg_per_zak']),
                'terpakai' => (float) $stok->sum('terpakai'),
                'terpakai_kg' => (float) $pemberian->sum(
                    fn (PemberianPakan $satu): float => $satu->zak * ($satu->jenisPakan?->kg_per_zak ?? config('standar.kg_per_zak')),
                ),
                'sisa' => $stok->whereNotNull('sisa')->isEmpty() ? null : (float) $stok->sum('sisa'),
                'sisa_kg' => $stok->whereNotNull('sisa_kg')->isEmpty() ? null : (float) $stok->sum('sisa_kg'),
            ],
        ];
    }

    /**
     * Pemberian satu hari dikelompokkan per jenis pakan, tiap jenis dengan jumlah per kandang.
     *
     * @param  Collection<int, PemberianPakan>  $pemberian
     * @return list<array{jenis: ?string, zak: array<int, float>, catatan: array<int, list<array{id: int, zak: float}>>, total: float, berat_kg: float}>
     */
    private static function barisJenis(Collection $pemberian): array
    {
        return $pemberian
            ->groupBy(fn ($beri) => $beri->jenisPakan?->kode ?? '')
            ->sortKeys()
            ->map(function (Collection $kelompok, string $jenis): array {
                $perKandang = $kelompok->groupBy('periode_kandang_id');

                return [
                    'jenis' => $jenis === '' ? null : $jenis,
                    'zak' => $perKandang->map(fn (Collection $catatan): float => (float) $catatan->sum('zak'))->all(),
                    'catatan' => $perKandang->map(fn (Collection $catatan): array => $catatan
                        ->map(fn (PemberianPakan $satu): array => ['id' => $satu->id, 'zak' => (float) $satu->zak])
                        ->values()
                        ->all())->all(),
                    'total' => (float) $kelompok->sum('zak'),
                    'berat_kg' => (float) $kelompok->sum(
                        fn (PemberianPakan $satu): float => $satu->zak * ($satu->jenisPakan?->kg_per_zak ?? config('standar.kg_per_zak')),
                    ),
                ];
            })
            ->values()
            ->all();
    }
}
