<?php

namespace App\Enums;

/**
 * Jabatan karyawan kandang, seperti tertulis di slip gaji.
 */
enum Jabatan: string
{
    /** Anak kandang; ikut bagi hasil kandangnya. */
    case Abk = 'ABK';

    /** Tenaga pengganti bergaji pokok; tidak ikut bagi hasil. */
    case Joker = 'Joker';

    public function label(): string
    {
        return $this->value;
    }

    /**
     * Kelas CSS tag template Basalt (badge).
     */
    public function kelasTag(): string
    {
        return match ($this) {
            self::Abk => 'bg-primary-subtle text-primary',
            self::Joker => 'bg-info-subtle text-info',
        };
    }
}
