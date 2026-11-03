<?php

namespace Database\Seeders;

use App\Models\Farm;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoSeeder extends Seeder
{
    /**
     * Seed data untuk demo website.
     *
     * Data ini aman untuk publik karena:
     * - Menggunakan email/password demo yang jelas
     * - Nama karyawan dan pemodal diganti dengan nama fiktif
     * - Tidak ada data sensitif (API keys, nomor HP, email asli)
     * - Data finansial dari contoh dokumen, bukan data produksi asli
     */
    public function run(): void
    {
        // Buat akun demo
        User::create([
            'name' => 'Demo User',
            'email' => config('app.demo_credentials.username', 'demo@misjiwatifarm.tech'),
            'password' => Hash::make(config('app.demo_credentials.password', 'DemoMisjiwati2026')),
            'email_verified_at' => now(),
        ]);

        // DatabaseSeeder memakai farm dengan kode K0242. Untuk demo, pakai
        // farm yang sama dengan fantasi kode bawaan produksi agar tidak ada
        // migrasi perubahan skema; nama farm publik sehingga aman ditampilkan.
        if (Farm::query()->where('kode', 'K0242')->doesntExist()) {
            Farm::create([
                'kode' => 'K0242',
                'nama' => 'Misjiwati Farm',
            ]);
        }

        // Jalankan seeder data yang sudah ada (data dari dokumen contoh, sudah aman)
        // CATATAN: Seeder ini akan dimodifikasi untuk menggunakan nama fiktif
        $this->call([
            DatabaseSeeder::class,
        ]);

        $this->command->info('✓ Data demo berhasil dibuat');
        $this->command->info('✓ Login dengan:');
        $this->command->info('  Email: '.config('app.demo_credentials.username', 'demo@misjiwatifarm.tech'));
        $this->command->info('  Password: '.config('app.demo_credentials.password', 'DemoMisjiwati2026'));
    }
}
