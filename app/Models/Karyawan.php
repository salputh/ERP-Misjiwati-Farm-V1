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

    /**
     * Inisial dua kata pertama nama untuk avatar, mis. "Wahyu ABK" menjadi "WA".
     */
    public function inisial(): string
    {
        return collect(explode(' ', $this->nama))
            ->take(2)
            ->map(fn (string $kata): string => mb_strtoupper(mb_substr($kata, 0, 1)))
            ->implode('');
    }

    public function kandang(): BelongsTo
    {
        return $this->belongsTo(Kandang::class);
    }

    public function slipGaji(): HasMany
    {
        return $this->hasMany(SlipGaji::class);
    }

    public function kasbon(): HasMany
    {
        return $this->hasMany(Kasbon::class);
    }
}
