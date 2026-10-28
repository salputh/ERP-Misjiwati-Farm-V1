<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * Parameter aplikasi yang bisa diubah dari dalam aplikasi, disimpan sebagai pasangan kunci dan nilai.
 * Nilai sensitif disimpan dalam bentuk hash, sehingga tidak pernah ditulis sebagai teks polos.
 */
class Pengaturan extends Model
{
    protected $guarded = [];

    protected $hidden = ['nilai'];

    /**
     * Hash password admin yang boleh membuka kunci RHPP real dan lembar bagi hasil.
     */
    public const PASSWORD_ADMIN = 'password_admin';

    /**
     * Jumlah password admin salah sebelum percobaan dikunci sementara.
     */
    public const BATAS_PERCOBAAN = 5;

    /**
     * Uang makan bawaan ABK: tarif per hari (Rp) dan jumlah hari. Nilai bawaan dipakai selama belum pernah diubah
     * di Master data, sehingga produksi tidak perlu seeder.
     */
    public const UANG_MAKAN_PER_HARI = 'uang_makan_per_hari';

    public const UANG_MAKAN_HARI = 'uang_makan_hari';

    public const UANG_MAKAN_PER_HARI_BAWAAN = 35_000;

    public const UANG_MAKAN_HARI_BAWAAN = 55;

    /**
     * Uang makan bawaan satu ABK: tarif per hari, jumlah hari, dan totalnya (tarif × hari).
     *
     * @return array{per_hari: int, hari: int, total: int}
     */
    public static function uangMakan(): array
    {
        $perHari = (int) (self::nilai(self::UANG_MAKAN_PER_HARI) ?? self::UANG_MAKAN_PER_HARI_BAWAAN);
        $hari = (int) (self::nilai(self::UANG_MAKAN_HARI) ?? self::UANG_MAKAN_HARI_BAWAAN);

        return ['per_hari' => $perHari, 'hari' => $hari, 'total' => $perHari * $hari];
    }

    public static function setUangMakan(int $perHari, int $hari): void
    {
        self::simpan(self::UANG_MAKAN_PER_HARI, (string) $perHari);
        self::simpan(self::UANG_MAKAN_HARI, (string) $hari);
    }

    public static function nilai(string $kunci): ?string
    {
        return self::query()->where('kunci', $kunci)->value('nilai');
    }

    public static function simpan(string $kunci, ?string $nilai): void
    {
        self::query()->updateOrCreate(['kunci' => $kunci], ['nilai' => $nilai]);
    }

    /**
     * Apakah password admin sudah pernah ditetapkan.
     */
    public static function passwordAdminTeratur(): bool
    {
        return self::nilai(self::PASSWORD_ADMIN) !== null;
    }

    public static function setPasswordAdmin(string $password): void
    {
        self::simpan(self::PASSWORD_ADMIN, Hash::make($password));
    }

    /**
     * Tolak password admin yang salah sebagai kesalahan isian $kolom. Setelah lima kesalahan, percobaan
     * berikutnya dari pengguna dan alamat IP yang sama ditolak selama satu menit agar password tidak bisa ditebak beruntun.
     *
     * @throws ValidationException
     */
    public static function pastikanPasswordAdmin(string $password, string $kolom, string $pesanSalah = 'Password admin salah.'): void
    {
        $kunci = 'password-admin|'.auth()->id().'|'.request()->ip();

        if (RateLimiter::tooManyAttempts($kunci, self::BATAS_PERCOBAAN)) {
            throw ValidationException::withMessages([
                $kolom => 'Terlalu banyak percobaan password admin. Coba lagi dalam '.RateLimiter::availableIn($kunci).' detik.',
            ]);
        }

        if (! self::cocokPasswordAdmin($password)) {
            RateLimiter::hit($kunci);

            throw ValidationException::withMessages([$kolom => $pesanSalah]);
        }

        RateLimiter::clear($kunci);
    }

    /**
     * Apakah password yang diberikan cocok dengan password admin yang tersimpan.
     */
    public static function cocokPasswordAdmin(string $password): bool
    {
        $hash = self::nilai(self::PASSWORD_ADMIN);

        return $hash !== null && Hash::check($password, $hash);
    }
}
