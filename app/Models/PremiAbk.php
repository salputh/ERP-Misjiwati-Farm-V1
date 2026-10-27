<?php

namespace App\Models;

use Database\Factories\PremiAbkFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Satu baris tabel "Estimasi hasil kandang koloni per ekor (4 abk)": bila total budidaya per ekor populasi
 * mencapai hasil_per_ekor, premi pemeliharaan ABK kandang itu sebesar premi.
 */
class PremiAbk extends Model
{
    /** @use HasFactory<PremiAbkFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['hasil_per_ekor' => 'integer', 'intensif' => 'integer', 'premi' => 'integer'];
    }

    /**
     * Baris dengan batas tertinggi yang sudah dicapai; null bila hasil per ekor di bawah baris terendah.
     */
    public static function untukHasilPerEkor(float $hasilPerEkor): ?self
    {
        return self::query()
            ->where('hasil_per_ekor', '<=', $hasilPerEkor)
            ->orderByDesc('hasil_per_ekor')
            ->first();
    }
}
