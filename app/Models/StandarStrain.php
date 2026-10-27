<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StandarStrain extends Model
{
    protected $guarded = [];

    public function harian(): HasMany
    {
        return $this->hasMany(StandarStrainHarian::class)->orderBy('umur');
    }

    /**
     * Jumlah periode yang memakai strain ini; nama strain disimpan apa adanya di tabel periodes.
     */
    public function jumlahPeriode(): int
    {
        return Periode::query()->where('strain', $this->nama)->count();
    }
}
