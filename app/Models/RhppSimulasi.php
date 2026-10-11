<?php

namespace App\Models;

use Database\Factories\RhppSimulasiFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Input manual simulasi RHPP satu periode: harga DOC, biaya pakan, OVK, dan insentif.
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
