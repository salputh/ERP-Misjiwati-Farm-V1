<?php

namespace App\Support;

use App\Enums\Jabatan;
use App\Models\Karyawan;
use Illuminate\Support\Collection;

/**
 * Isi halaman data karyawan: seluruh karyawan per kandang, beserta slip gajinya di payroll terakhir.
 */
class DaftarKaryawan
{
    /**
     * Pakai relasi kandang yang sudah di-load. $payroll adalah hasil LembarPayroll::buat() periode terakhir yang
     * punya slip gaji. Mengembalikan null bila belum ada karyawan.
     *
     * @param  Collection<int, Karyawan>  $karyawan
     * @param  array<string, mixed>|null  $payroll
     * @return ?array{
     *     total: int,
     *     rincian: string,
     *     kandang: list<array{nama: string, jumlah: int, rincian: string, karyawan: list<array{id: int, nama: string, jabatan: Jabatan, keterangan: ?string, slip: ?array{id: int, hari_kerja: int, bersih: int}}>}>
     * }
     */
    public static function buat(Collection $karyawan, ?array $payroll): ?array
    {
        if ($karyawan->isEmpty()) {
            return null;
        }

        $slip = collect($payroll['kandang'] ?? [])
            ->flatMap(fn (array $kandang): array => $kandang['slip'])
            ->whereNotNull('karyawan_id')
            ->keyBy('karyawan_id');

        return [
            'total' => $karyawan->count(),
            'rincian' => self::rincian($karyawan),
            'kandang' => $karyawan
                ->sortBy('id')
                // Karyawan tanpa kandang dikumpulkan di kelompok terakhir.
                ->groupBy(fn (Karyawan $satu): string => $satu->kandang?->nama ?? '')
                ->sortBy(fn (Collection $sekandang, string $nama): string => $nama === '' ? "\u{FFFF}" : $nama)
                ->map(fn (Collection $sekandang, string $nama): array => [
                    'nama' => $nama === '' ? 'Belum ditempatkan' : $nama,
                    'jumlah' => $sekandang->count(),
                    'rincian' => self::rincian($sekandang),
                    'karyawan' => $sekandang->map(fn (Karyawan $satu): array => [
                        'id' => $satu->id,
                        'nama' => $satu->nama,
                        'jabatan' => $satu->jabatan,
                        'keterangan' => $satu->keterangan,
                        'slip' => $slip->has($satu->id)
                            ? ['id' => $slip[$satu->id]['id'], 'hari_kerja' => $slip[$satu->id]['hari_kerja'], 'bersih' => $slip[$satu->id]['bersih']]
                            : null,
                    ])->values()->all(),
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * Jumlah orang per jabatan dalam urutan enum, misalnya "4 ABK, 1 Joker".
     *
     * @param  Collection<int, Karyawan>  $karyawan
     */
    private static function rincian(Collection $karyawan): string
    {
        return collect(Jabatan::cases())
            ->map(fn (Jabatan $jabatan): array => ['jabatan' => $jabatan, 'jumlah' => $karyawan->where('jabatan', $jabatan)->count()])
            ->where('jumlah', '>', 0)
            ->map(fn (array $satu): string => Format::angka($satu['jumlah']).' '.$satu['jabatan']->label())
            ->join(', ');
    }
}
