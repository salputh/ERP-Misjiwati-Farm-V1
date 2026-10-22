<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TransferPakan extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['tanggal' => 'date', 'zak' => 'float'];
    }

    public function periode(): BelongsTo
    {
        return $this->belongsTo(Periode::class);
    }

    public function periodeKandang(): BelongsTo
    {
        return $this->belongsTo(PeriodeKandang::class);
    }

    public function jenisPakan(): BelongsTo
    {
        return $this->belongsTo(JenisPakan::class);
    }
}
