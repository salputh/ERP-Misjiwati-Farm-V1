<?php

namespace App\Support;

use App\Enums\KategoriKas;
use App\Models\PeriodeKandang;
use App\Models\TransaksiKas;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * Isi "Laporan Biaya Operasional" satu kandang dalam satu periode: ringkasan dana, riwayat dana masuk,
 * pengeluaran per kategori, dan buku kas berurutan tanggal dengan saldo berjalan.
 */
class BukuKas
{
    /**
     * Pakai relasi transaksiKas yang sudah di-load. Mengembalikan null bila buku kas masih kosong.
     *
     * @return ?array{
     *     mulai: CarbonInterface,
     *     selesai: CarbonInterface,
     *     ringkasan: array{masuk: int, keluar: int, selisih: int, pinjaman: int, biaya: int, jumlah_masuk: int, jumlah_keluar: int, jumlah_pinjaman: int, jumlah_biaya: int, jumlah_kategori: int},
     *     dana: list<array{tanggal: CarbonInterface, uraian: string, jumlah: int, saldo: int}>,
     *     biaya: list<array{kategori: KategoriKas, transaksi: int, jumlah: int, persen: float}>,
     *     pinjaman: list<array{kategori: KategoriKas, transaksi: int, jumlah: int, persen: float}>,
     *     transaksi: list<array{id: int, nomor: int, tanggal: CarbonInterface, kategori: KategoriKas, uraian: string, masuk: ?int, keluar: ?int, saldo: int}>
     * }
     */
    public static function buat(PeriodeKandang $periodeKandang): ?array
    {
        $transaksi = $periodeKandang->transaksiKas;
        if ($transaksi->isEmpty()) {
            return null;
        }

        [$masuk, $keluar] = $transaksi->partition(fn (TransaksiKas $satu): bool => $satu->kategori->masuk());
        $kategori = self::kategori($keluar);
        $pinjaman = (int) $kategori->where('pinjaman', true)->sum('jumlah');
        $jumlahPinjaman = (int) $kategori->where('pinjaman', true)->sum('transaksi');

        return [
            'mulai' => $transaksi->min('tanggal'),
            'selesai' => $transaksi->max('tanggal'),
            'ringkasan' => [
                'masuk' => (int) $masuk->sum('jumlah'),
                'keluar' => (int) $keluar->sum('jumlah'),
                'selisih' => (int) $masuk->sum('jumlah') - (int) $keluar->sum('jumlah'),
                'pinjaman' => $pinjaman,
                // Biaya operasional: seluruh pengeluaran selain pinjaman karyawan.
                'biaya' => (int) $keluar->sum('jumlah') - $pinjaman,
                'jumlah_masuk' => $masuk->count(),
                'jumlah_keluar' => $keluar->count(),
                'jumlah_pinjaman' => $jumlahPinjaman,
                'jumlah_biaya' => $keluar->count() - $jumlahPinjaman,
                'jumlah_kategori' => $kategori->count(),
            ],
            'dana' => self::dana($masuk),
            'biaya' => self::tanpaPenanda($kategori->where('pinjaman', false)),
            'pinjaman' => self::tanpaPenanda($kategori->where('pinjaman', true)),
            'transaksi' => self::transaksi($transaksi),
        ];
    }

    /**
     * Buku kas yang disaring ke satu kategori (atau seluruhnya), dikelompokkan per bulan dengan subtotalnya.
     * Nomor dan saldo tiap baris tetap dari buku kas utuh.
     *
     * @param  list<array{id: int, nomor: int, tanggal: CarbonInterface, kategori: KategoriKas, uraian: string, masuk: ?int, keluar: ?int, saldo: int}>  $transaksi
     * @return array{bulan: list<array{bulan: CarbonInterface, baris: list<array<string, mixed>>, masuk: int, keluar: int}>, jumlah: int, masuk: int, keluar: int}
     */
    public static function saring(array $transaksi, ?KategoriKas $kategori = null): array
    {
        $baris = collect($transaksi)
            ->when($kategori, fn (Collection $semua): Collection => $semua->where('kategori', $kategori));

        return [
            'bulan' => $baris
                ->groupBy(fn (array $satu): string => $satu['tanggal']->format('Y-m'))
                ->map(fn (Collection $sebulan): array => [
                    'bulan' => $sebulan->first()['tanggal']->copy()->startOfMonth(),
                    'baris' => $sebulan->values()->all(),
                    'masuk' => (int) $sebulan->sum('masuk'),
                    'keluar' => (int) $sebulan->sum('keluar'),
                ])
                ->values()
                ->all(),
            'jumlah' => $baris->count(),
            'masuk' => (int) $baris->sum('masuk'),
            'keluar' => (int) $baris->sum('keluar'),
        ];
    }

    /**
     * Riwayat dana operasional yang masuk, dengan jumlah kumulatifnya.
     *
     * @param  Collection<int, TransaksiKas>  $masuk
     * @return list<array{tanggal: CarbonInterface, uraian: string, jumlah: int, saldo: int}>
     */
    private static function dana(Collection $masuk): array
    {
        $saldo = 0;

        return $masuk
            ->map(function (TransaksiKas $satu) use (&$saldo): array {
                $saldo += $satu->jumlah;

                return ['tanggal' => $satu->tanggal, 'uraian' => $satu->uraian, 'jumlah' => $satu->jumlah, 'saldo' => $saldo];
            })
            ->values()
            ->all();
    }

    /**
     * Pengeluaran per kategori, dari yang terbesar. Persen dihitung terhadap seluruh pengeluaran.
     *
     * @param  Collection<int, TransaksiKas>  $keluar
     * @return Collection<int, array{kategori: KategoriKas, transaksi: int, jumlah: int, persen: float, pinjaman: bool}>
     */
    private static function kategori(Collection $keluar): Collection
    {
        $total = (int) $keluar->sum('jumlah');

        return $keluar
            ->groupBy(fn (TransaksiKas $satu): string => $satu->kategori->value)
            ->map(fn (Collection $sekategori): array => [
                'kategori' => $sekategori->first()->kategori,
                'transaksi' => $sekategori->count(),
                'jumlah' => (int) $sekategori->sum('jumlah'),
                'persen' => $total > 0 ? $sekategori->sum('jumlah') / $total * 100 : 0.0,
                'pinjaman' => $sekategori->first()->kategori->pinjaman(),
            ])
            ->sortByDesc('jumlah')
            ->values();
    }

    /**
     * @param  Collection<int, array{kategori: KategoriKas, transaksi: int, jumlah: int, persen: float, pinjaman: bool}>  $kategori
     * @return list<array{kategori: KategoriKas, transaksi: int, jumlah: int, persen: float}>
     */
    private static function tanpaPenanda(Collection $kategori): array
    {
        return $kategori->map(fn (array $satu): array => collect($satu)->except('pinjaman')->all())->values()->all();
    }

    /**
     * Buku kas berurutan tanggal. Saldo adalah sisa kas setelah transaksi itu; negatif berarti dana kurang.
     *
     * @param  Collection<int, TransaksiKas>  $transaksi
     * @return list<array{id: int, nomor: int, tanggal: CarbonInterface, kategori: KategoriKas, uraian: string, masuk: ?int, keluar: ?int, saldo: int}>
     */
    private static function transaksi(Collection $transaksi): array
    {
        $saldo = 0;

        return $transaksi
            ->values()
            ->map(function (TransaksiKas $satu, int $indeks) use (&$saldo): array {
                $masuk = $satu->kategori->masuk();
                $saldo += $masuk ? $satu->jumlah : -$satu->jumlah;

                return [
                    'id' => $satu->id,
                    'nomor' => $indeks + 1,
                    'tanggal' => $satu->tanggal,
                    'kategori' => $satu->kategori,
                    'uraian' => $satu->uraian,
                    'masuk' => $masuk ? $satu->jumlah : null,
                    'keluar' => $masuk ? null : $satu->jumlah,
                    'saldo' => $saldo,
                ];
            })
            ->all();
    }
}
