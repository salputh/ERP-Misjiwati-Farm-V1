<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

/**
 * Akun pengguna dibuat dari server, bukan dari seeder, sehingga produksi tidak pernah memiliki akun bawaan.
 * Perintah yang sama dipakai untuk mengganti password pengguna yang lupa password.
 */
#[Signature('pengguna:atur {email : Email untuk masuk} {--nama= : Nama pengguna baru}')]
#[Description('Buat pengguna baru atau ganti password pengguna yang sudah ada')]
class AturPengguna extends Command
{
    public function handle(): int
    {
        $email = mb_strtolower(trim($this->argument('email')));

        if (Validator::make(['email' => $email], ['email' => ['required', 'email', 'max:255']])->fails()) {
            $this->error('Email tidak valid.');

            return self::FAILURE;
        }

        $pengguna = User::query()->where('email', $email)->first();

        if ($pengguna && ! $this->confirm("Pengguna {$email} sudah ada. Ganti password-nya?")) {
            return self::SUCCESS;
        }

        $nama = $pengguna?->name ?? ($this->option('nama') ?: $this->ask('Nama pengguna'));
        $password = (string) $this->secret('Password baru (minimal '.User::PANJANG_PASSWORD_MINIMAL.' karakter)');

        $validasi = Validator::make(
            ['nama' => $nama, 'password' => $password, 'password_confirmation' => (string) $this->secret('Ulangi password')],
            ['nama' => ['required', 'string', 'max:255'], 'password' => ['required', 'string', 'min:'.User::PANJANG_PASSWORD_MINIMAL, 'confirmed']],
            [
                'nama.required' => 'Nama wajib diisi.',
                'password.min' => 'Password minimal '.User::PANJANG_PASSWORD_MINIMAL.' karakter.',
                'password.confirmed' => 'Pengulangan password tidak sama.',
            ],
        );

        if ($validasi->fails()) {
            $this->error($validasi->errors()->first());

            return self::FAILURE;
        }

        User::query()->updateOrCreate(['email' => $email], ['name' => $nama, 'password' => $password]);

        $this->info($pengguna ? "Password {$email} diganti." : "Pengguna {$email} dibuat.");

        return self::SUCCESS;
    }
}
