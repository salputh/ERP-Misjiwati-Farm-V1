<?php

namespace App\Support;

use App\Enums\Jabatan;
use App\Enums\KategoriKas;
use App\Models\Pengaturan;
use App\Models\PeriodeKandang;
use App\Models\PotonganKasbon;
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
     * Pakai relasi slipGaji.penerimaBagiHasil, slipGaji.potonganKasbon.kasbon.potongan, bagiHasil.penerima, dan kandang yang sudah di-load.
     * $rhpp adalah hasil LembarRhpp::real() periode itu; uang makan bawaan ABK baru dipotong setelah RHPP itu keluar.
     * Mengembalikan null bila belum ada slip gaji.
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
        $uangMakanBawaan = self::uangMakanBawaanPeriode($rhpp);
        $kandang = $kandangPeriode
            ->filter(fn (PeriodeKandang $satu): bool => $satu->slipGaji->isNotEmpty())
            ->sortBy('kandang.nama')
            ->values()
            ->map(function (PeriodeKandang $satu) use ($rhpp, $uangMakanBawaan): array {
                $bagiHasil = LembarBagiHasil::buat($satu, $rhpp);
                $uangMakan = self::uangMakanDariKas($satu);
                $slip = $satu->slipGaji->map(fn (SlipGaji $slip): array => self::slip($slip, $satu->kandang->nama, $bagiHasil, $uangMakan[$slip->id] ?? null, $uangMakanBawaan))->values();

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
     * @param  ?array{jumlah: int, transaksi: int}  $uangMakanKas  uang makan atas nama orang ini di kas kandangnya
     * @param  ?array{per_hari: int, hari: int, total: int}  $uangMakanBawaan  uang makan bawaan ABK; null bila RHPP periode ini belum keluar
     * @return array{id: int, karyawan_id: ?int, nama: string, jabatan: string, kandang: string, hari_kerja: int, pendapatan: list<array{label: string, jumlah: int, rumus: ?string}>, potongan: list<array{label: string, jumlah: int, rumus: ?string}>, total_pendapatan: int, total_potongan: int, bersih: int}
     */
    private static function slip(SlipGaji $slip, string $kandang, ?array $bagiHasil, ?array $uangMakanKas = null, ?array $uangMakanBawaan = null): array
    {
        $bawaan = $uangMakanKas === null ? self::uangMakanBawaan($slip, $uangMakanBawaan) : null;
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
            match (true) {
                $uangMakanKas !== null => self::baris('Uang makan', $uangMakanKas['jumlah'], 'dari kas: '.Format::angka($uangMakanKas['transaksi']).' transaksi Pinjaman Makan'),
                $bawaan !== null => self::baris('Uang makan', $bawaan['jumlah'], $bawaan['rumus']),
                default => self::baris('Uang makan', $slip->uang_makan, self::rumusUangMakan($slip)),
            },
            self::baris('Pinjaman ABK', $slip->pinjaman),
            ...$slip->potonganKasbon->sortBy('id')->map(fn (PotonganKasbon $potongan): array => self::barisKasbon($potongan))->all(),
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
     * Cicilan kasbon di slip: urutan potongannya dan sisa kasbon setelah slip ini. Urutan mengikuti potongan yang
     * tidak nol, dihitung dari potongan yang dibuat lebih dulu.
     *
     * @return array{label: string, jumlah: int, rumus: ?string, opsional: bool}
     */
    private static function barisKasbon(PotonganKasbon $potongan): array
    {
        $kasbon = $potongan->kasbon;
        $sampaiSlipIni = $kasbon->potongan->where('id', '<=', $potongan->id);
        $sisa = max(0, $kasbon->jumlah - (int) $sampaiSlipIni->sum('jumlah'));
        $ke = $sampaiSlipIni->where('jumlah', '>', 0)->count();
        $keterangan = $potongan->jumlah > 0
            ? 'potongan '.Format::angka($ke).' dari '.Format::angka(max($ke, $kasbon->jumlah_potongan)).', '
            : '';

        return self::baris(
            'Kasbon '.$kasbon->keperluan,
            $potongan->jumlah,
            $keterangan.($sisa > 0 ? 'sisa Rp '.Format::angka($sisa) : 'lunas'),
        );
    }

    /**
     * Uang makan tiap slip dari kas operasional kandangnya: transaksi Pinjaman Makan yang uraiannya menyebut nama
     * orang itu (nama di slip atau nama lengkap karyawannya, sebagai kata utuh). Transaksi yang menyebut beberapa
     * nama dibagi rata ke nama-nama itu; transaksi tanpa nama tidak dipotong ke siapa pun. Slip yang tidak punya
     * satu pun transaksi atas namanya tidak ada di hasil, sehingga angka tersimpannya (data lama) tetap dipakai.
     *
     * @return array<int, array{jumlah: int, transaksi: int}> kuncinya id slip
     */
    public static function uangMakanDariKas(PeriodeKandang $periodeKandang): array
    {
        $periodeKandang->loadMissing(['transaksiKas', 'slipGaji.karyawan']);

        $pola = $periodeKandang->slipGaji->mapWithKeys(fn (SlipGaji $slip): array => [
            $slip->id => collect([$slip->nama, $slip->karyawan?->nama])
                ->filter()
                ->unique(fn (string $nama): string => mb_strtolower($nama))
                ->map(fn (string $nama): string => '/(?<![\pL\pN])'.preg_quote(mb_strtolower(trim($nama)), '/').'(?![\pL\pN])/u')
                ->all(),
        ]);

        $hasil = [];
        foreach ($periodeKandang->transaksiKas as $transaksi) {
            if ($transaksi->kategori !== KategoriKas::PinjamanMakan) {
                continue;
            }

            $uraian = mb_strtolower($transaksi->uraian);
            $penerima = $pola
                ->filter(fn (array $daftar): bool => collect($daftar)->contains(fn (string $satu): bool => preg_match($satu, $uraian) === 1))
                ->keys()
                ->values();
            if ($penerima->isEmpty()) {
                continue;
            }

            // Dibagi rata; sisa pembulatan rupiah diberikan ke nama pertama.
            $bagian = intdiv($transaksi->jumlah, $penerima->count());
            $sisa = $transaksi->jumlah - $bagian * $penerima->count();
            foreach ($penerima as $urutan => $slipId) {
                $hasil[$slipId] ??= ['jumlah' => 0, 'transaksi' => 0];
                $hasil[$slipId]['jumlah'] += $bagian + ($urutan === 0 ? $sisa : 0);
                $hasil[$slipId]['transaksi']++;
            }
        }

        return $hasil;
    }

    /**
     * Uang makan bawaan dari Master data, berlaku untuk periode yang RHPP real-nya sudah keluar; null bila belum.
     *
     * @param  array<string, mixed>|null  $rhpp  hasil LembarRhpp::real() periode itu
     * @return ?array{per_hari: int, hari: int, total: int}
     */
    public static function uangMakanBawaanPeriode(?array $rhpp): ?array
    {
        return $rhpp === null ? null : Pengaturan::uangMakan();
    }

    /**
     * Uang makan bawaan untuk satu slip: hanya ABK, dan hanya bila slip belum punya angka uang makan sendiri.
     * Pemanggil mendahulukan transaksi Pinjaman Makan di kas, jadi hasil ini dipakai bila kas tidak punya transaksi atas nama orang itu.
     *
     * @param  ?array{per_hari: int, hari: int, total: int}  $bawaan  hasil uangMakanBawaanPeriode()
     * @return ?array{jumlah: int, rumus: string}
     */
    public static function uangMakanBawaan(SlipGaji $slip, ?array $bawaan): ?array
    {
        if ($bawaan === null || $bawaan['total'] === 0 || $slip->jabatan !== Jabatan::Abk || $slip->uang_makan > 0) {
            return null;
        }

        return [
            'jumlah' => $bawaan['total'],
            'rumus' => Format::angka($bawaan['hari']).' hari × Rp '.Format::angka($bawaan['per_hari']).', bawaan master data',
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
