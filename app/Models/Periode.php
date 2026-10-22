<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Periode extends Model
{
    protected $guarded = [];

    public function scopePrioritaskanAktif(Builder $query): Builder
    {
        return $query
            ->orderByRaw("CASE WHEN status IN ('berjalan', 'aktif') THEN 0 WHEN status = 'persiapan' THEN 1 WHEN status = 'panen' THEN 2 ELSE 3 END")
            ->orderByDesc('tanggal_chick_in')
            ->orderByDesc('id');
    }

    public function tertutup(): bool
    {
        return $this->status === 'tutup_rhpp' || $this->status === 'selesai';
    }

    protected function casts(): array
    {
        return [
            'nomor_siklus' => 'integer',
            'tanggal_chick_in' => 'date',
            'rekap_pakan_zak' => 'float',
        ];
    }

    public function farm(): BelongsTo
    {
        return $this->belongsTo(Farm::class);
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

    public function transferPakan(): HasMany
    {
        return $this->hasMany(TransferPakan::class)->orderBy('tanggal')->orderBy('id');
    }

    /**
     * Umur ayam pada suatu tanggal: 0 di hari chick-in.
     */
    public function umurPada(CarbonInterface $tanggal): int
    {
        return (int) $this->tanggal_chick_in->diffInDays($tanggal->copy()->startOfDay());
    }

    /**
     * Total DOC yang chick-in pada periode ini, dihitung dari populasi tiap kandang.
     * Inilah satu-satunya sumber angka DOC tingkat periode; angka di form periode mengikuti hasil hitungan ini.
     */
    public function totalDocChickIn(): int
    {
        $this->loadMissing('kandangPeriode');

        return (int) $this->kandangPeriode->sum(
            fn (PeriodeKandang $satu): int => $satu->populasiAktual()
        );
    }
}
