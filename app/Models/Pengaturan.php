<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Hash;

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
     * Apakah password yang diberikan cocok dengan password admin yang tersimpan.
     */
    public static function cocokPasswordAdmin(string $password): bool
    {
        $hash = self::nilai(self::PASSWORD_ADMIN);

        return $hash !== null && Hash::check($password, $hash);
    }
}
