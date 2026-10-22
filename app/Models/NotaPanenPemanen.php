<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotaPanenPemanen extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'krat_mulai' => 'integer',
            'berat_timbang_kg' => 'float',
        ];
    }

    public function notaPanen(): BelongsTo
    {
        return $this->belongsTo(NotaPanen::class);
    }
}
