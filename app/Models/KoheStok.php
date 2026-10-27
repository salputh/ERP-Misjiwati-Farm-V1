<?php

namespace App\Models;

use Database\Factories\KoheStokFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Kohe (kotoran hewan) yang masuk ke stok farm, dalam karung.
 */
class KoheStok extends Model
{
    /** @use HasFactory<KoheStokFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['tanggal' => 'date', 'jumlah_karung' => 'integer'];
    }

    public function farm(): BelongsTo
    {
        return $this->belongsTo(Farm::class);
    }

    public function kandang(): BelongsTo
    {
        return $this->belongsTo(Kandang::class);
    }
}
