<?php

namespace App\Support;

use App\Enums\PeranBagiHasil;
use App\Models\PenerimaBagiHasil;
use App\Models\PeriodeKandang;
use Illuminate\Support\Collection;

/**
 * Isi lembar "Bagi Hasil" satu kandang dalam satu periode. Pendapatan diambil dari alokasi per kandang
 * di RHPP real, lalu dipotong berurutan: operasional pemeliharaan, entertain, zakat. Sisa akhirnya dibagi
 * ke pemodal; upah dan bonus pasar ABK dibagi ke tiap ABK.
 */
class LembarBagiHasil
{
    /**
     * Pakai relasi bagiHasil.penerima yang sudah di-load. $rhpp adalah hasil LembarRhpp::real() periode itu,
     * $kasKeluar total pengeluaran buku kas kandang (null bila buku kas kosong).
     * Mengembalikan null bila masukan bagi hasil atau pendapatan RHPP real kandang ini belum ada.
     *
     * @param  array<string, mixed>|null  $rhpp
     * @return ?array{
     *     identitas: array{populasi: int, kg: float, controller: ?string},
     *     ringkasan: array{pendapatan: int, pengeluaran: int, sisa: int, entertain: int, zakat: int, sisa_akhir: int, abk: int, jumlah_abk: int},
     *     pendapatan: list<array<string, mixed>>,
     *     pengeluaran: list<array<string, mixed>>,
     *     sisa: list<array<string, mixed>>,
     *     operasional: array{lembar: int, kas: ?int, selisih: ?int},
     *     tidak_dijumlahkan: list<array{nama: string, jumlah: int}>,
     *     abk: array{rekap: list<array<string, mixed>>, sumber: array{gaji: int, bonus_pasar: int, premi_pemeliharaan: int}, penerima: list<array{nama: string, keterangan: ?string, rata: int, premi_tetap: int, jumlah: int}>, rata: int, premi_tetap: int, total: int},
     *     pemodal: array{penerima: list<array{nama: string, persen: float, jumlah: int}>, persen: float, total: int}
     * }
     */
    public static function buat(PeriodeKandang $periodeKandang, ?array $rhpp, ?int $kasKeluar = null): ?array
    {
        $masukan = $periodeKandang->bagiHasil;
        $kolom = collect($rhpp['kandang']['kolom'] ?? [])->firstWhere('kandang_id', $periodeKandang->kandang_id);
        if (! $masukan || ! $kolom) {
            return null;
        }

        $kg = (float) $kolom['tonase'];
        $teksKg = Format::angka($kg, 2).' kg';
        $controller = $masukan->controller ? ' '.$masukan->controller : '';

        $totalBudidaya = $kolom['selisih_budidaya'] + $kolom['efisiensi'];
        $bonusPasar = $kolom['subsidi'];
        $pendapatan = $kolom['bersih'];

        $abk = $masukan->penerimaBerperan(PeranBagiHasil::Abk);
        $bonusPerorangan = $masukan->penerimaBerperan(PeranBagiHasil::BonusPasar);
        $entertain = $masukan->penerimaBerperan(PeranBagiHasil::Entertain);

        $gaji = (int) round($masukan->tarif_gaji_abk_per_kg * $kg);
        $premiTetap = (int) $abk->sum('jumlah');
        $upahController = (int) round($pendapatan * $masukan->persen_upah_controller / 100) + $masukan->premi_controller;
        $bonusAbk = (int) round($bonusPasar * $masukan->persen_bonus_pasar_abk / 100);
        $bonusController = (int) round($bonusPasar * $masukan->persen_bonus_pasar_controller / 100);

        $pengeluaran = $masukan->operasional + $gaji + $masukan->premi_pemeliharaan_abk + $masukan->premi_controller + $premiTetap
            + $upahController + $bonusAbk + $bonusController + (int) $bonusPerorangan->where('dijumlahkan', true)->sum('jumlah');

        $sisa = $pendapatan - $pengeluaran;
        $totalEntertain = (int) $entertain->sum('jumlah');
        $sisaEntertain = $sisa - $totalEntertain;
        // Zakat hanya dipotong dari sisa yang positif.
        $zakat = (int) round(max(0, $sisaEntertain) * $masukan->persen_zakat / 100);
        $sisaAkhir = $sisaEntertain - $zakat;

        $upahAbk = $gaji + $masukan->premi_pemeliharaan_abk;
        $pembagianAbk = self::pembagianAbk($abk, $upahAbk + $bonusAbk);

        return [
            'identitas' => ['populasi' => $periodeKandang->populasi_awal, 'kg' => $kg, 'controller' => $masukan->controller],
            'ringkasan' => [
                'pendapatan' => $pendapatan,
                'pengeluaran' => $pengeluaran,
                'sisa' => $sisa,
                'entertain' => $totalEntertain,
                'zakat' => $zakat,
                'sisa_akhir' => $sisaAkhir,
                'abk' => $upahAbk + $bonusAbk,
                'jumlah_abk' => $abk->count(),
            ],
            'pendapatan' => [
                self::baris('Penjualan ayam', $kolom['total_panen'], $teksKg.' × Rp '.Format::angka($kg > 0 ? $kolom['total_panen'] / $kg : 0, 2)),
                self::baris('Dikurangi sapronak', $kolom['sapronak'], 'alokasi sapronak RHPP real menurut tonase'),
                self::baris('Hasil usaha budidaya', $kolom['selisih_budidaya'], 'penjualan − sapronak', tebal: true),
                self::baris('Selisih efisiensi', $kolom['efisiensi'], $teksKg.' × Rp '.Format::angka($rhpp['rekap']['tarif_efisiensi'])),
                self::baris('Total budidaya', $totalBudidaya, 'Rp '.Format::angka($periodeKandang->populasi_awal > 0 ? $totalBudidaya / $periodeKandang->populasi_awal : 0, 2).' per ekor populasi', tebal: true),
                self::baris('Bonus pasar', $bonusPasar, $teksKg.' × Rp '.Format::angka($kolom['subsidi_per_kg'] ?? 0, 2).' subsidi harga pasar'),
                self::baris('Jumlah pendapatan', $pendapatan, 'total budidaya + bonus pasar', sorot: true),
            ],
            'pengeluaran' => [
                self::baris('Operasional', $masukan->operasional, 'termasuk pinjaman makan dan pinjaman ABK', masukan: true),
                self::baris('Gaji ABK', $gaji, $teksKg.' × Rp '.Format::angka($masukan->tarif_gaji_abk_per_kg)),
                self::baris('Premi pemeliharaan ABK', $masukan->premi_pemeliharaan_abk, masukan: true),
                self::baris('Premi controller'.$controller, $masukan->premi_controller, masukan: true),
                ...$abk->where('jumlah', '>', 0)->map(fn (PenerimaBagiHasil $satu): array => self::baris('Premi tetap '.self::namaLengkap($satu), $satu->jumlah, masukan: true)),
                self::baris('Upah controller'.$controller, $upahController, Format::persen($masukan->persen_upah_controller).' × jumlah pendapatan + premi controller'),
                self::baris('Bonus pasar ABK', $bonusAbk, Format::persen($masukan->persen_bonus_pasar_abk).' × bonus pasar'),
                self::baris('Bonus pasar controller'.$controller, $bonusController, Format::persen($masukan->persen_bonus_pasar_controller).' × bonus pasar'),
                ...$bonusPerorangan->map(fn (PenerimaBagiHasil $satu): array => self::baris('Bonus pasar '.self::namaLengkap($satu), $satu->jumlah, $satu->dijumlahkan ? null : 'tidak ikut dijumlahkan', masukan: true)),
                self::baris('Total operasional pemeliharaan', $pengeluaran, sorot: true),
            ],
            'sisa' => [
                self::baris('Jumlah pendapatan', $pendapatan),
                self::baris('Dikurangi total operasional pemeliharaan', $pengeluaran),
                self::baris('Sisa diperoleh', $sisa, tebal: true),
                ...$entertain->map(fn (PenerimaBagiHasil $satu): array => self::baris('Dikurangi entertain '.self::namaLengkap($satu), $satu->jumlah, masukan: true)),
                self::baris('Sisa setelah entertain', $sisaEntertain, tebal: true),
                self::baris('Dikurangi zakat penghasilan', $zakat, Format::persen($masukan->persen_zakat).' × sisa setelah entertain'),
                self::baris('Sisa akhir diperoleh', $sisaAkhir, 'dibagi ke pemodal', sorot: true),
            ],
            'operasional' => [
                'lembar' => $masukan->operasional,
                'kas' => $kasKeluar,
                'selisih' => $kasKeluar !== null ? $kasKeluar - $masukan->operasional : null,
            ],
            'tidak_dijumlahkan' => $bonusPerorangan->where('dijumlahkan', false)
                ->map(fn (PenerimaBagiHasil $satu): array => ['nama' => $satu->nama, 'jumlah' => (int) $satu->jumlah])
                ->values()
                ->all(),
            'abk' => [
                'rekap' => [
                    self::baris('Upah ABK', $upahAbk, 'gaji ABK + premi pemeliharaan ABK'),
                    self::baris('Premi bonus pasar', $bonusAbk, Format::persen($masukan->persen_bonus_pasar_abk).' × bonus pasar'),
                    self::baris('Total pendapatan ABK', $upahAbk + $bonusAbk, sorot: true),
                ],
                'sumber' => ['gaji' => $gaji, 'bonus_pasar' => $bonusAbk, 'premi_pemeliharaan' => $masukan->premi_pemeliharaan_abk],
                'penerima' => $pembagianAbk,
                'rata' => (int) array_sum(array_column($pembagianAbk, 'rata')),
                'premi_tetap' => $premiTetap,
                'total' => (int) array_sum(array_column($pembagianAbk, 'jumlah')),
            ],
            'pemodal' => self::pembagianPemodal($masukan->penerimaBerperan(PeranBagiHasil::Pemodal), $sisaAkhir),
        ];
    }

    /**
     * Premi tetap diambil lebih dulu dari total pendapatan ABK untuk penerimanya; sisanya dibagi rata.
     * Rupiah yang tidak habis dibagi diberikan satu per satu mulai dari ABK pertama.
     *
     * @param  Collection<int, PenerimaBagiHasil>  $abk
     * @return list<array{nama: string, keterangan: ?string, rata: int, premi_tetap: int, jumlah: int}>
     */
    private static function pembagianAbk(Collection $abk, int $total): array
    {
        if ($abk->isEmpty()) {
            return [];
        }

        $dibagiRata = $total - (int) $abk->sum('jumlah');
        $rata = intdiv($dibagiRata, $abk->count());
        $lebih = $dibagiRata - $rata * $abk->count();

        return $abk->values()->map(function (PenerimaBagiHasil $satu, int $indeks) use ($rata, $lebih): array {
            $bagian = $rata + ($indeks < $lebih ? 1 : 0);

            return [
                'nama' => $satu->nama,
                'keterangan' => $satu->keterangan,
                'rata' => $bagian,
                'premi_tetap' => (int) $satu->jumlah,
                'jumlah' => $bagian + (int) $satu->jumlah,
            ];
        })->all();
    }

    /**
     * Sisa akhir dibagi menurut porsi pemodal. Pemodal terakhir menerima sisanya agar jumlahnya tepat.
     *
     * @param  Collection<int, PenerimaBagiHasil>  $pemodal
     * @return array{penerima: list<array{nama: string, persen: float, jumlah: int}>, persen: float, total: int}
     */
    private static function pembagianPemodal(Collection $pemodal, int $sisaAkhir): array
    {
        $terbagi = 0;
        $penerima = $pemodal->values()->map(function (PenerimaBagiHasil $satu, int $indeks) use ($pemodal, $sisaAkhir, &$terbagi): array {
            $jumlah = $indeks === $pemodal->count() - 1 && abs($pemodal->sum('persen') - 100) < 0.0001
                ? $sisaAkhir - $terbagi
                : (int) round($sisaAkhir * $satu->persen / 100);
            $terbagi += $jumlah;

            return ['nama' => $satu->nama, 'persen' => (float) $satu->persen, 'jumlah' => $jumlah];
        })->all();

        return ['penerima' => $penerima, 'persen' => (float) $pemodal->sum('persen'), 'total' => $terbagi];
    }

    private static function namaLengkap(PenerimaBagiHasil $penerima): string
    {
        return $penerima->keterangan ? "{$penerima->nama} ({$penerima->keterangan})" : $penerima->nama;
    }

    /**
     * Satu baris rincian: label, jumlah Rp, dan cara menghitungnya.
     *
     * @return array{label: string, jumlah: int, rumus: ?string, tebal: bool, sorot: bool, masukan: bool}
     */
    private static function baris(string $label, int $jumlah, ?string $rumus = null, bool $tebal = false, bool $sorot = false, bool $masukan = false): array
    {
        return ['label' => $label, 'jumlah' => $jumlah, 'rumus' => $rumus, 'tebal' => $tebal, 'sorot' => $sorot, 'masukan' => $masukan];
    }
}
