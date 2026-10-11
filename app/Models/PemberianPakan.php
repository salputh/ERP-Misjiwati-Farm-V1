<?php

namespace App\Models;

use Database\Factories\PemberianPakanFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pakan yang diberikan ke satu kandang pada satu hari. Jenis boleh kosong bila belum dicatat.
 */
class PemberianPakan extends Model
{
    /** @use HasFactory<PemberianPakanFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['tanggal' => 'date', 'zak' => 'float'];
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
