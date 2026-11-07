<?php

namespace App\Enums;

/**
 * Status bobot kandang terhadap standar strain.
 */
enum StatusBobot: string
{
    case Baik = 'baik';
    case Waspada = 'waspada';
    case Buruk = 'buruk';
    case Belum = 'belum';

    /**
     * Ambang selisih bobot terhadap standar (persen). Nilai sementara, konfirmasi dengan pemilik farm.
     */
    public const AMBANG_WASPADA = -3;

    public const AMBANG_BURUK = -8;

    public static function dariSelisih(?float $selisihPersen): self
    {
        return match (true) {
            $selisihPersen === null => self::Belum,
            $selisihPersen >= self::AMBANG_WASPADA => self::Baik,
            $selisihPersen >= self::AMBANG_BURUK => self::Waspada,
            default => self::Buruk,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Baik => 'Sesuai standar',
            self::Waspada => 'Di bawah standar',
            self::Buruk => 'Jauh di bawah standar',
            self::Belum => 'Belum ditimbang',
        };
    }

    /**
     * Kelas CSS lencana status dari template Basalt.
     */
    public function kelasLencana(): string
    {
        return match ($this) {
            self::Baik => 'bg-success-subtle text-success',
            self::Waspada => 'bg-warning-subtle text-warning',
            self::Buruk => 'bg-danger-subtle text-danger',
            self::Belum => 'bg-body-secondary text-body-secondary',
        };
    }
}
