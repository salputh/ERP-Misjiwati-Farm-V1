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
     * @return array{kandang: array<int, string>, hari: list<array<string, mixed>>, total_kandang: array<int, float>, total: float, per_jenis: list<array<string, mixed>>, total_stok: array{masuk: float, terpakai: float, sisa: ?float}}
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
            'per_jenis' => $stok->all(),
            'total_stok' => [
                'masuk' => (float) $stok->sum('masuk'),
                'terpakai' => (float) $stok->sum('terpakai'),
                'sisa' => $stok->whereNotNull('sisa')->isEmpty() ? null : (float) $stok->sum('sisa'),
            ],
        ];
    }

    /**
     * Pemberian satu hari dikelompokkan per jenis pakan, tiap jenis dengan jumlah per kandang.
     *
     * @param  Collection<int, PemberianPakan>  $pemberian
     * @return list<array{jenis: ?string, zak: array<int, float>, total: float}>
     */
    private static function barisJenis(Collection $pemberian): array
    {
        return $pemberian
            ->groupBy(fn ($beri) => $beri->jenisPakan?->kode ?? '')
            ->sortKeys()
            ->map(fn (Collection $kelompok, string $jenis): array => [
                'jenis' => $jenis === '' ? null : $jenis,
                'zak' => $kelompok->groupBy('periode_kandang_id')->map(fn (Collection $perKandang) => (float) $perKandang->sum('zak'))->all(),
                'total' => (float) $kelompok->sum('zak'),
            ])
            ->values()
            ->all();
    }
}
