<?php

namespace App\Models;

use Database\Factories\NotaPanenFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu nota timbang panen (satu truk). Muatan dari beberapa kandang dicatat sebagai satu nota utuh.
 */
class NotaPanen extends Model
{
    /** @use HasFactory<NotaPanenFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'tanggal_panen' => 'date',
            'mulai' => 'datetime',
            'selesai' => 'datetime',
            'berat_kg' => 'float',
            'netto_nota_kg' => 'float',
        ];
    }

    public function periode(): BelongsTo
    {
        return $this->belongsTo(Periode::class);
    }
}
