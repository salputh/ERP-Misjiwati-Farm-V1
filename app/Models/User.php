<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Panjang password minimal, baik dari halaman Akun pengguna maupun perintah pengguna:atur.
     */
    public const PANJANG_PASSWORD_MINIMAL = 12;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'terakhir_masuk_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * @return HasMany<Sesi, $this>
     */
    public function sesi(): HasMany
    {
        return $this->hasMany(Sesi::class);
    }

    /**
     * Inisial untuk avatar: huruf pertama dua kata pertama nama, "Salman Putra" menjadi "SP".
     */
    public function inisial(): string
    {
        return Str::of($this->name)->squish()->explode(' ')->take(2)
            ->map(fn (string $kata): string => Str::upper(Str::substr($kata, 0, 1)))
            ->implode('');
    }
}
