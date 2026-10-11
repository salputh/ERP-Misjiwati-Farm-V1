<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Recording extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['tanggal' => 'date', 'bobot_rata_gram' => 'float'];
    }

    public function periodeKandang(): BelongsTo
    {
        return $this->belongsTo(PeriodeKandang::class);
    }
}
