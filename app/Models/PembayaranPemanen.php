<?php

namespace App\Models;

use Database\Factories\PembayaranPemanenFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Upah seorang pemanen di satu periode yang sudah dibayar, dengan nominal upah saat ditandai dibayar.
 */
class PembayaranPemanen extends Model
{
    /** @use HasFactory<PembayaranPemanenFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['jumlah' => 'integer', 'dibayar_pada' => 'datetime'];
    }

    public function periode(): BelongsTo
    {
        return $this->belongsTo(Periode::class);
    }

    public function pemanen(): BelongsTo
    {
        return $this->belongsTo(Pemanen::class);
    }
}
