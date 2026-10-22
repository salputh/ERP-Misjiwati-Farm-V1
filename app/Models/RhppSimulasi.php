<?php

namespace App\Models;

use Database\Factories\RhppSimulasiFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Input simulasi RHPP satu periode. Kolom insentif lama tetap ada untuk kompatibilitas data.
 */
class RhppSimulasi extends Model
{
    /** @use HasFactory<RhppSimulasiFactory> */
    use HasFactory;

    protected $guarded = [];

    public function periode(): BelongsTo
    {
        return $this->belongsTo(Periode::class);
    }
}
