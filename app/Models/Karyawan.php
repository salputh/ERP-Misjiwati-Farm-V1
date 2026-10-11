<?php

namespace App\Models;

use App\Enums\Jabatan;
use Database\Factories\KaryawanFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Karyawan kandang: orang yang menerima slip gaji.
 */
class Karyawan extends Model
{
    /** @use HasFactory<KaryawanFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['jabatan' => Jabatan::class];
    }

    public function kandang(): BelongsTo
    {
        return $this->belongsTo(Kandang::class);
    }

    public function slipGaji(): HasMany
    {
        return $this->hasMany(SlipGaji::class);
    }
}
