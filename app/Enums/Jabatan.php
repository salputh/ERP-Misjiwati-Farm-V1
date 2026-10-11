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
     * Kelas CSS tag template HexaDash (dm-tag).
     */
    public function kelasTag(): string
    {
        return match ($this) {
            self::Abk => 'tag-primary',
            self::Joker => 'tag-info',
        };
    }
}
