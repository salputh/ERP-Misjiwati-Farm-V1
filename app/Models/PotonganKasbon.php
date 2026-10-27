<?php

namespace App\Models;

use Database\Factories\PotonganKasbonFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Cicilan satu kasbon yang dipotong di satu slip gaji.
 */
class PotonganKasbon extends Model
{
    /** @use HasFactory<PotonganKasbonFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['jumlah' => 'integer'];
    }

    public function kasbon(): BelongsTo
    {
        return $this->belongsTo(Kasbon::class);
    }

    public function slipGaji(): BelongsTo
    {
        return $this->belongsTo(SlipGaji::class);
    }
}
