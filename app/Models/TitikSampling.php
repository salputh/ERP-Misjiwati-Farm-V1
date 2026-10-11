<?php

namespace App\Models;

use Database\Factories\TitikSamplingFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu kali timbang: berat total sekelompok ayam pada satu line, lantai, dan kelamin.
 */
class TitikSampling extends Model
{
    /** @use HasFactory<TitikSamplingFactory> */
    use HasFactory;

    protected $guarded = [];

    public function sesiSampling(): BelongsTo
    {
        return $this->belongsTo(SesiSampling::class);
    }
}
