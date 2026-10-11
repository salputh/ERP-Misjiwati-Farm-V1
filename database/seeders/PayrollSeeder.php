<?php

namespace Database\Seeders;

use App\Enums\PeranBagiHasil;
use App\Models\Kandang;
use App\Models\Karyawan;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use App\Models\SlipGaji;
use Illuminate\Database\Seeder;

class PayrollSeeder extends Seeder
{
    /**
     * Periode Juli 2026, dari lembar "Slip Gaji ABK" (periode panen 8 s/d 17 Agustus 2026).
     * [nama, jabatan, hari kerja, gaji pokok, premi pemeliharaan, premi panen, premi pasang geomembran,
     * penghasilan kotoran, uang makan, pinjaman ABK, potongan lain, keterangan potongan lain].
     *
     * Pendapatan bagi hasil, bonus pasar, premi pemeliharaan, dan premi tetap ABK tidak disalin:
     * dihitung dari bagi hasil kandangnya dan hasilnya sama dengan slip. Rohim (joker) tidak ikut bagi hasil.
     *
     * @var array<string, list<array{string, string, int, int, int, int, int, int, int, int, int, ?string}>>
     */
    private const JULI = [
        'Kandang 1' => [
            ['Wahyu', 'ABK', 56, 0, 0, 500_000, 420_000, 1_415_000, 1_960_000, 0, 0, null],
            ['Angga', 'ABK', 56, 0, 0, 300_000, 240_000, 1_415_000, 1_960_000, 1_500_000, 1_750_000, null],
            ['Rifi', 'ABK', 56, 0, 0, 500_000, 420_000, 1_415_000, 1_960_000, 2_000_000, 0, null],
            ['Mustofa', 'ABK', 56, 0, 0, 300_000, 240_000, 1_415_000, 1_960_000, 900_000, 0, null],
        ],
        'Kandang 2' => [
            ['Frengky', 'ABK', 56, 0, 0, 300_000, 240_000, 2_115_000, 1_960_000, 440_000, 3_600_000, 'Kereta dan HP'],
            ['Igo', 'ABK', 56, 0, 0, 500_000, 420_000, 2_115_000, 1_960_000, 0, 0, null],
            ['Utama', 'ABK', 56, 0, 0, 500_000, 240_000, 2_115_000, 1_960_000, 850_000, 0, null],
            ['Rafi', 'ABK', 56, 0, 0, 300_000, 420_000, 2_115_000, 1_960_000, 0, 0, null],
            ['Rohim', 'Joker', 30, 2_000_000, 1_960_000, 300_000, 420_000, 2_115_000, 0, 0, 0, null],
        ],
    ];

    public function run(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();

        foreach (self::JULI as $namaKandang => $daftar) {
            $kandang = Kandang::where('nama', $namaKandang)->firstOrFail();
            $periodeKandang = PeriodeKandang::with('bagiHasil.penerima')
                ->where(['periode_id' => $periode->id, 'kandang_id' => $kandang->id])
                ->firstOrFail();
            $abk = $periodeKandang->bagiHasil?->penerimaBerperan(PeranBagiHasil::Abk) ?? collect();

            foreach ($daftar as $urutan => [$nama, $jabatan, $hariKerja, $gajiPokok, $premiPemeliharaan, $premiPanen, $premiGeomembran, $kotoran, $uangMakan, $pinjaman, $potonganLain, $keterangan]) {
                SlipGaji::updateOrCreate(['periode_kandang_id' => $periodeKandang->id, 'nama' => $nama], [
                    'karyawan_id' => Karyawan::where(['nama' => $nama, 'kandang_id' => $kandang->id])->value('id'),
                    'penerima_bagi_hasil_id' => $jabatan === 'ABK' ? $abk->firstWhere('nama', $nama)?->id : null,
                    'jabatan' => $jabatan,
                    'hari_kerja' => $hariKerja,
                    'gaji_pokok' => $gajiPokok,
                    'premi_pemeliharaan' => $premiPemeliharaan,
                    'premi_panen' => $premiPanen,
                    'premi_geomembran' => $premiGeomembran,
                    'penghasilan_kotoran' => $kotoran,
                    'uang_makan' => $uangMakan,
                    'pinjaman' => $pinjaman,
                    'potongan_lain' => $potonganLain,
                    'keterangan_potongan_lain' => $keterangan,
                    'urutan' => $urutan + 1,
                ]);
            }
        }
    }
}
