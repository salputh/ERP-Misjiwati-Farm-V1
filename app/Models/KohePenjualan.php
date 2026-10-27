<?php

namespace App\Models;

use Database\Factories\KohePenjualanFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Penjualan kohe dari stok farm kepada seorang pembeli.
 */
class KohePenjualan extends Model
{
    /** @use HasFactory<KohePenjualanFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['tanggal' => 'date', 'jumlah_karung' => 'integer', 'harga_per_karung' => 'integer'];
    }

    /**
     * Nilai penjualan: jumlah karung × harga per karung.
     */
    public function total(): int
    {
        return $this->jumlah_karung * $this->harga_per_karung;
    }

    public function farm(): BelongsTo
    {
        return $this->belongsTo(Farm::class);
    }
}
