<?php

namespace Database\Seeders;

use App\Enums\Jabatan;
use App\Models\Kandang;
use App\Models\Karyawan;
use Illuminate\Database\Seeder;

class KaryawanSeeder extends Seeder
{
    /**
     * Orang yang sama dengan penerima slip di lembar "Slip Gaji ABK" periode Juli 2026: [nama, jabatan, keterangan].
     * Keterangan "ketua ABK" untuk Frengky berasal dari lembar bagi hasil Kandang 2.
     *
     * @var array<string, list<array{string, Jabatan, ?string}>>
     */
    private const KARYAWAN = [
        'Kandang 1' => [
            ['Wahyu', Jabatan::Abk, null],
            ['Angga', Jabatan::Abk, null],
            ['Rifi', Jabatan::Abk, null],
            ['Mustofa', Jabatan::Abk, null],
        ],
        'Kandang 2' => [
            ['Frengky', Jabatan::Abk, 'ketua ABK'],
            ['Igo', Jabatan::Abk, null],
            ['Utama', Jabatan::Abk, null],
            ['Rafi', Jabatan::Abk, null],
            ['Rohim', Jabatan::Joker, null],
        ],
    ];

    public function run(): void
    {
        foreach (self::KARYAWAN as $namaKandang => $daftar) {
            $kandang = Kandang::where('nama', $namaKandang)->firstOrFail();

            foreach ($daftar as [$nama, $jabatan, $keterangan]) {
                Karyawan::updateOrCreate(['nama' => $nama, 'kandang_id' => $kandang->id], ['jabatan' => $jabatan, 'keterangan' => $keterangan]);
            }
        }
    }
}
