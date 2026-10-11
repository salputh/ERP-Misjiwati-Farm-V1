<?php

namespace App\Models;

use Database\Factories\PenerimaanPakanFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pakan masuk ke farm pada satu periode.
 */
class PenerimaanPakan extends Model
{
    /** @use HasFactory<PenerimaanPakanFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['tanggal' => 'date', 'zak' => 'float'];
    }

    public function periode(): BelongsTo
    {
        return $this->belongsTo(Periode::class);
    }

    public function jenisPakan(): BelongsTo
    {
        return $this->belongsTo(JenisPakan::class);
    }
}
