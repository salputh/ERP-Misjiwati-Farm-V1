<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Kandang extends Model
{
    protected $guarded = [];

    public function farm(): BelongsTo
    {
        return $this->belongsTo(Farm::class);
    }

    public function karyawan(): HasMany
    {
        return $this->hasMany(Karyawan::class);
    }

    public function periodeKandang(): HasMany
    {
        return $this->hasMany(PeriodeKandang::class);
    }

    public function pemodal(): BelongsToMany
    {
        return $this->belongsToMany(Pemodal::class)
            ->withPivot('persen')
            ->withTimestamps()
            ->orderBy('kandang_pemodal.id');
    }
}
