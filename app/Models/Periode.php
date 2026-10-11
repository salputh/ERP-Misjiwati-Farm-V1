<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Periode extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['tanggal_chick_in' => 'date', 'rekap_pakan_zak' => 'float'];
    }

    public function kandangPeriode(): HasMany
    {
        return $this->hasMany(PeriodeKandang::class);
    }

    public function notaPanen(): HasMany
    {
        return $this->hasMany(NotaPanen::class)->orderBy('mulai')->orderBy('id');
    }

    public function hargaKontrak(): HasMany
    {
        return $this->hasMany(HargaKontrak::class)->orderBy('bobot_min_kg');
    }

    public function rhppSimulasi(): HasOne
    {
        return $this->hasOne(RhppSimulasi::class);
    }

    public function rhppReal(): HasOne
    {
        return $this->hasOne(RhppReal::class);
    }

    public function penerimaanPakan(): HasMany
    {
        return $this->hasMany(PenerimaanPakan::class)->orderBy('tanggal')->orderBy('id');
    }

    /**
     * Umur ayam pada suatu tanggal: 0 di hari chick-in.
     */
    public function umurPada(CarbonInterface $tanggal): int
    {
        return (int) $this->tanggal_chick_in->diffInDays($tanggal->copy()->startOfDay());
    }
}
