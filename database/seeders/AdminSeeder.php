<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

class AdminSeeder extends Seeder
{
    /**
     * Membuat atau memperbarui akun admin pertama dari variabel lingkungan.
     *
     * Isi ADMIN_NAME, ADMIN_EMAIL, dan ADMIN_PASSWORD (minimal 12 karakter) di .env server,
     * lalu jalankan: php artisan db:seed --class=AdminSeeder --force.
     * Password tidak ditulis di kode dan tidak ditampilkan. Aman dijalankan ulang;
     * menjalankannya lagi dengan password baru akan mengganti password akun itu.
     */
    public function run(): void
    {
        $nama = (string) config('app.admin.nama');
        $email = (string) config('app.admin.email');
        $password = (string) config('app.admin.password');

        if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new RuntimeException('Isi ADMIN_EMAIL dengan alamat email yang valid di .env.');
        }

        if (mb_strlen($password) < User::PANJANG_PASSWORD_MINIMAL) {
            throw new RuntimeException('ADMIN_PASSWORD wajib diisi, minimal '.User::PANJANG_PASSWORD_MINIMAL.' karakter.');
        }

        $pengguna = User::query()->firstOrNew(['email' => $email]);
        $pengguna->forceFill([
            'name' => $nama,
            'password' => $password,
            'email_verified_at' => $pengguna->email_verified_at ?? now(),
        ])->save();

        $this->command?->info('Akun admin siap: '.$email);
    }
}
