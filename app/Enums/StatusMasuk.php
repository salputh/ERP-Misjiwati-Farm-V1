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
     * Kelas CSS lencana status dari template Basalt.
     */
    public function kelasLencana(): string
    {
        return match ($this) {
            self::Online => 'bg-success-subtle text-success',
            self::Diam => 'bg-warning-subtle text-warning',
            self::Keluar => 'bg-body-secondary text-body-secondary',
        };
    }

    /**
     * Kelas titik status di pojok avatar; akun yang tidak masuk tidak diberi titik.
     */
    public function kelasTitik(): ?string
    {
        return match ($this) {
            self::Online => 'bg-success',
            self::Diam => 'bg-warning',
            self::Keluar => null,
        };
    }
}
