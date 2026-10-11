<?php

namespace Database\Seeders;

use App\Enums\PeranBagiHasil;
use App\Models\BagiHasil;
use App\Models\Kandang;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use Illuminate\Database\Seeder;

class BagiHasilSeeder extends Seeder
{
    /**
     * Periode Juli 2026, dari lembar "Bagi Hasil - Indojaya | Kandang 1" dan "Bagi Hasil - Kandang 2".
     * Pendapatan tidak disalin: halaman mengambilnya dari RHPP real, dan angkanya sama dengan lembar.
     * Penerima: [peran, nama, jumlah (Rp), persen, keterangan, dijumlahkan].
     *
     * Di lembar Kandang 1, "Bonus Pasar Rohim" tercantum tetapi tidak masuk "Total operasional pemeliharaan".
     *
     * @var array<string, array{masukan: array<string, mixed>, penerima: list<array{PeranBagiHasil, string, ?int, ?float, ?string, bool}>}>
     */
    private const JULI = [
        'Kandang 1' => [
            'masukan' => [
                'controller' => 'An Nisa',
                'operasional' => 75_995_246,
                'tarif_gaji_abk_per_kg' => 500,
                'premi_pemeliharaan_abk' => 0,
                'premi_controller' => 0,
                'persen_upah_controller' => 3,
                'persen_bonus_pasar_abk' => 30,
                'persen_bonus_pasar_controller' => 10,
                'persen_zakat' => 2.5,
            ],
            'penerima' => [
                [PeranBagiHasil::Abk, 'Wahyu', null, null, null, true],
                [PeranBagiHasil::Abk, 'Angga', null, null, null, true],
                [PeranBagiHasil::Abk, 'Rifi', null, null, null, true],
                [PeranBagiHasil::Abk, 'Mustofa', null, null, null, true],
                [PeranBagiHasil::BonusPasar, 'Rohim', 500_000, null, null, false],
                [PeranBagiHasil::Entertain, 'Heri', 500_000, null, null, true],
                [PeranBagiHasil::Entertain, 'Dian', 500_000, null, null, true],
                [PeranBagiHasil::Pemodal, 'Muchrizan', null, 79.9, null, true],
                [PeranBagiHasil::Pemodal, 'Chatam', null, 20.1, null, true],
            ],
        ],
        'Kandang 2' => [
            'masukan' => [
                'controller' => 'Salman',
                'operasional' => 59_944_239,
                'tarif_gaji_abk_per_kg' => 500,
                'premi_pemeliharaan_abk' => 1_050_000,
                'premi_controller' => 262_500,
                'persen_upah_controller' => 3,
                'persen_bonus_pasar_abk' => 30,
                'persen_bonus_pasar_controller' => 10,
                'persen_zakat' => 2.5,
            ],
            'penerima' => [
                [PeranBagiHasil::Abk, 'Frengky', 500_000, null, 'ketua ABK', true],
                [PeranBagiHasil::Abk, 'Igo', null, null, null, true],
                [PeranBagiHasil::Abk, 'Utama', null, null, null, true],
                [PeranBagiHasil::Abk, 'Rafi', null, null, null, true],
                [PeranBagiHasil::Entertain, 'Heri', 500_000, null, null, true],
                [PeranBagiHasil::Entertain, 'Dian', 500_000, null, null, true],
                [PeranBagiHasil::Pemodal, 'Muchrizan', null, 100, null, true],
            ],
        ],
    ];

    /**
     * Masukan dan penerima diperbarui di tempat (penerima dirujuk slip gaji), jadi seeding ulang tidak menggandakan data.
     */
    public function run(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();

        foreach (self::JULI as $namaKandang => $data) {
            $kandang = Kandang::where('nama', $namaKandang)->firstOrFail();
            $periodeKandang = PeriodeKandang::where(['periode_id' => $periode->id, 'kandang_id' => $kandang->id])->firstOrFail();

            $bagiHasil = BagiHasil::updateOrCreate(['periode_kandang_id' => $periodeKandang->id], $data['masukan']);

            foreach ($data['penerima'] as $urutan => [$peran, $nama, $jumlah, $persen, $keterangan, $dijumlahkan]) {
                $bagiHasil->penerima()->updateOrCreate(['peran' => $peran, 'nama' => $nama], [
                    'jumlah' => $jumlah,
                    'persen' => $persen,
                    'keterangan' => $keterangan,
                    'dijumlahkan' => $dijumlahkan,
                    'urutan' => $urutan + 1,
                ]);
            }
        }
    }
}
