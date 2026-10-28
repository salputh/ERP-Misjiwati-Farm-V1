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
     * Rohim (joker) bergaji pokok Rp 2.000.000 untuk 30 hari kerja dan digaji tiap tanggal 25.
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

    /**
     * Nilai bawaan slip gaji per nama: gaji pokok, hari kerja, dan tanggal gajian.
     *
     * @var array<string, array{gaji_pokok: int, hari_kerja: int, tanggal_gajian: int}>
     */
    private const GAJI_BAWAAN = [
        'Rohim' => ['gaji_pokok' => 2_000_000, 'hari_kerja' => 30, 'tanggal_gajian' => 25],
    ];

    public function run(): void
    {
        foreach (self::KARYAWAN as $namaKandang => $daftar) {
            $kandang = Kandang::where('nama', $namaKandang)->firstOrFail();

            foreach ($daftar as [$nama, $jabatan, $keterangan]) {
                Karyawan::updateOrCreate(['nama' => $nama, 'kandang_id' => $kandang->id], ['jabatan' => $jabatan, 'keterangan' => $keterangan, ...(self::GAJI_BAWAAN[$nama] ?? [])]);
            }
        }
    }
}
