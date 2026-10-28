<?php

namespace App\Enums;

use App\Models\Sesi;
use Illuminate\Support\Collection;

/**
 * Keadaan masuk sebuah akun menurut sesinya yang belum kedaluwarsa.
 */
enum StatusMasuk: string
{
    case Online = 'online';
    case Diam = 'diam';
    case Keluar = 'keluar';

    /**
     * @param  Collection<int, Sesi>  $sesi  Sesi akun yang masih masuk.
     */
    public static function dariSesi(Collection $sesi): self
    {
        return match (true) {
            $sesi->contains(fn (Sesi $satu): bool => $satu->online()) => self::Online,
            $sesi->isNotEmpty() => self::Diam,
            default => self::Keluar,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Online => 'Online',
            self::Diam => 'Masuk, tidak aktif',
            self::Keluar => 'Tidak masuk',
        };
    }

    /**
     * Kelas CSS lencana status dari template HexaDash.
     */
    public function kelasLencana(): string
    {
        return match ($this) {
            self::Online => 'bg-opacity-success color-success',
            self::Diam => 'bg-opacity-warning color-warning',
            self::Keluar => 'bg-opacity-light color-gray',
        };
    }

    /**
     * Kelas titik status di pojok avatar (HexaDash: chat-badge-dot); akun yang tidak masuk tidak diberi titik.
     */
    public function kelasTitik(): ?string
    {
        return match ($this) {
            self::Online => 'avatar-online',
            self::Diam => 'avatar-offline',
            self::Keluar => null,
        };
    }
}
