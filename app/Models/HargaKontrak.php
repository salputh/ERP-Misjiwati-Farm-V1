<?php

namespace App\Models;

use Database\Factories\HargaKontrakFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu bracket harga kontrak: ABW mulai dari bobot_min_kg dibayar harga_per_kg.
 */
class HargaKontrak extends Model
{
    /** @use HasFactory<HargaKontrakFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['bobot_min_kg' => 'float'];
    }

    public function periode(): BelongsTo
    {
        return $this->belongsTo(Periode::class);
    }
}
