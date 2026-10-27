<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Tarif bagi hasil yang sama untuk setiap periode: gaji ABK per kg, premi controller, persen bonus pasar, upah controller, dan zakat.
 * Premi pemeliharaan ABK tidak di sini: nilainya dari tabel PremiAbk menurut total budidaya per ekor.
 * Hanya ada satu baris global. Menjadi asumsi simulasi bagi hasil di RHPP bila kandang belum punya lembar bagi hasil sendiri.
 */
class TarifPeriode extends Model
{
    public const GLOBAL_ID = 1;

    /**
     * Kolom tarif, sama dengan kolom tarif di lembar bagi hasil.
     */
    public const KOLOM = [
        'tarif_gaji_abk_per_kg',
        'premi_controller',
        'persen_upah_controller',
        'persen_bonus_pasar_abk',
        'persen_bonus_pasar_controller',
        'persen_zakat',
    ];

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'tarif_gaji_abk_per_kg' => 'integer',
            'premi_controller' => 'integer',
            'persen_upah_controller' => 'float',
            'persen_bonus_pasar_abk' => 'float',
            'persen_bonus_pasar_controller' => 'float',
            'persen_zakat' => 'float',
        ];
    }

    public static function global(): self
    {
        return self::query()->findOrFail(self::GLOBAL_ID);
    }
}
