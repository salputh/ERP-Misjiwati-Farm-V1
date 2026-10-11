<?php

namespace App\Support;

use App\Models\PeriodeKandang;
use App\Models\SlipGaji;
use Illuminate\Support\Collection;

/**
 * Slip gaji satu periode, per kandang. ABK yang ada di lembar bagi hasil menerima bagian rata dari gaji ABK,
 * bonus pasar ABK, dan premi pemeliharaan kandangnya, ditambah premi tetapnya; pendapatan lain dan potongan
 * dicatat per orang.
 */
class LembarPayroll
{
    /**
     * Pakai relasi slipGaji.penerimaBagiHasil, bagiHasil.penerima, dan kandang yang sudah di-load.
     * $rhpp adalah hasil LembarRhpp::real() periode itu. Mengembalikan null bila belum ada slip gaji.
     *
     * @param  Collection<int, PeriodeKandang>  $kandangPeriode
     * @param  array<string, mixed>|null  $rhpp
     * @return ?array{
     *     kandang: list<array{id: int, nama: string, slip: list<array<string, mixed>>, total: array{orang: int, pendapatan: int, potongan: int, bersih: int}}>,
     *     total: array{orang: int, pendapatan: int, potongan: int, bersih: int},
     *     jabatan: array<string, int>
     * }
     */
    public static function buat(Collection $kandangPeriode, ?array $rhpp): ?array
    {
        $kandang = $kandangPeriode
            ->filter(fn (PeriodeKandang $satu): bool => $satu->slipGaji->isNotEmpty())
            ->sortBy('kandang.nama')
            ->values()
            ->map(function (PeriodeKandang $satu) use ($rhpp): array {
                $bagiHasil = LembarBagiHasil::buat($satu, $rhpp);
                $slip = $satu->slipGaji->map(fn (SlipGaji $slip): array => self::slip($slip, $satu->kandang->nama, $bagiHasil))->values();

                return ['id' => $satu->id, 'nama' => $satu->kandang->nama, 'slip' => $slip->all(), 'total' => self::total($slip)];
            });

        if ($kandang->isEmpty()) {
            return null;
        }

        $semua = $kandang->flatMap(fn (array $satu): array => $satu['slip']);

        return [
            'kandang' => $kandang->all(),
            'total' => self::total($semua),
            'jabatan' => $semua->countBy('jabatan')->all(),
        ];
    }

    /**
     * @param  array<string, mixed>|null  $bagiHasil  lembar bagi hasil kandangnya
     * @return array{id: int, karyawan_id: ?int, nama: string, jabatan: string, kandang: string, hari_kerja: int, pendapatan: list<array{label: string, jumlah: int, rumus: ?string}>, potongan: list<array{label: string, jumlah: int, rumus: ?string}>, total_pendapatan: int, total_potongan: int, bersih: int}
     */
    private static function slip(SlipGaji $slip, string $kandang, ?array $bagiHasil): array
    {
        $penerima = $slip->penerimaBagiHasil;
        $jumlahAbk = $bagiHasil['ringkasan']['jumlah_abk'] ?? 0;
        $ikutBagiHasil = $penerima && $bagiHasil && $jumlahAbk > 0;
        $sumber = $ikutBagiHasil ? $bagiHasil['abk']['sumber'] : ['gaji' => 0, 'bonus_pasar' => 0, 'premi_pemeliharaan' => 0];
        $pembagi = ' ÷ '.Format::angka($jumlahAbk).' ABK';
        $bagian = fn (int $jumlah): int => $ikutBagiHasil ? (int) round($jumlah / $jumlahAbk) : 0;
        $rumus = fn (string $nama, int $jumlah): ?string => $ikutBagiHasil && $jumlah > 0 ? $nama.' Rp '.Format::angka($jumlah).$pembagi : null;

        $pendapatan = collect([
            $penerima
                ? self::baris('Pendapatan bagi hasil', $bagian($sumber['gaji']), $rumus('gaji ABK', $sumber['gaji']))
                : self::baris('Gaji pokok', $slip->gaji_pokok),
            self::baris('Bonus pasar', $bagian($sumber['bonus_pasar']), $rumus('bonus pasar ABK', $sumber['bonus_pasar'])),
            self::baris('Premi pemeliharaan', $bagian($sumber['premi_pemeliharaan']) + $slip->premi_pemeliharaan, $rumus('premi pemeliharaan ABK', $sumber['premi_pemeliharaan'])),
            self::baris('Premi tetap', (int) $penerima?->jumlah, $penerima?->keterangan, opsional: true),
            self::baris('Premi panen', $slip->premi_panen),
            self::baris('Premi pasang geomembran', $slip->premi_geomembran),
            self::baris('Penghasilan kotoran', $slip->penghasilan_kotoran),
        ])->reject(fn (array $baris): bool => $baris['opsional'] && $baris['jumlah'] === 0)->map(fn (array $baris): array => collect($baris)->except('opsional')->all())->values();

        $potongan = collect([
            self::baris('Uang makan', $slip->uang_makan, self::rumusUangMakan($slip)),
            self::baris('Pinjaman ABK', $slip->pinjaman),
            self::baris('Potongan lain', $slip->potongan_lain, $slip->keterangan_potongan_lain),
        ])->map(fn (array $baris): array => collect($baris)->except('opsional')->all());

        $totalPendapatan = (int) $pendapatan->sum('jumlah');
        $totalPotongan = (int) $potongan->sum('jumlah');

        return [
            'id' => $slip->id,
            'karyawan_id' => $slip->karyawan_id,
            'nama' => $slip->nama,
            'jabatan' => $slip->jabatan->value,
            'kandang' => $kandang,
            'hari_kerja' => $slip->hari_kerja,
            'pendapatan' => $pendapatan->all(),
            'potongan' => $potongan->all(),
            'total_pendapatan' => $totalPendapatan,
            'total_potongan' => $totalPotongan,
            'bersih' => $totalPendapatan - $totalPotongan,
        ];
    }

    /**
     * Tarif uang makan per hari, ditulis hanya bila jumlahnya habis dibagi hari kerja.
     */
    private static function rumusUangMakan(SlipGaji $slip): ?string
    {
        if ($slip->uang_makan === 0 || $slip->hari_kerja === 0 || $slip->uang_makan % $slip->hari_kerja !== 0) {
            return null;
        }

        return Format::angka($slip->hari_kerja).' hari × Rp '.Format::angka(intdiv($slip->uang_makan, $slip->hari_kerja));
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $slip
     * @return array{orang: int, pendapatan: int, potongan: int, bersih: int}
     */
    private static function total(Collection $slip): array
    {
        return [
            'orang' => $slip->count(),
            'pendapatan' => (int) $slip->sum('total_pendapatan'),
            'potongan' => (int) $slip->sum('total_potongan'),
            'bersih' => (int) $slip->sum('bersih'),
        ];
    }

    /**
     * Satu baris slip. Baris opsional tidak ditampilkan bila nilainya nol.
     *
     * @return array{label: string, jumlah: int, rumus: ?string, opsional: bool}
     */
    private static function baris(string $label, int $jumlah, ?string $rumus = null, bool $opsional = false): array
    {
        return ['label' => $label, 'jumlah' => $jumlah, 'rumus' => $rumus, 'opsional' => $opsional];
    }
}
