<?php

namespace App\Models;

use App\Support\LembarRecording;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class PeriodeKandang extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['panen_tonase_kg' => 'float'];
    }

    public function periode(): BelongsTo
    {
        return $this->belongsTo(Periode::class);
    }

    public function kandang(): BelongsTo
    {
        return $this->belongsTo(Kandang::class);
    }

    public function recordings(): HasMany
    {
        return $this->hasMany(Recording::class)->orderBy('umur');
    }

    public function sesiSampling(): HasMany
    {
        return $this->hasMany(SesiSampling::class)->orderBy('tanggal');
    }

    public function pemberianPakan(): HasMany
    {
        return $this->hasMany(PemberianPakan::class)->orderBy('umur')->orderBy('id');
    }

    public function transaksiKas(): HasMany
    {
        return $this->hasMany(TransaksiKas::class)->orderBy('tanggal')->orderBy('id');
    }

    public function slipGaji(): HasMany
    {
        return $this->hasMany(SlipGaji::class)->orderBy('urutan')->orderBy('id');
    }

    public function bagiHasil(): HasOne
    {
        return $this->hasOne(BagiHasil::class);
    }

    /**
     * Ringkasan performa satu kandang dalam satu periode, diambil dari lembar recording.
     * Pakai relasi yang sudah di-load agar tidak query ulang.
     *
     * @return array<string, mixed>
     */
    public function ringkasan(): array
    {
        $baris = collect(LembarRecording::baris($this))->where('terisi', true);
        $terakhir = $baris->last();
        $timbang = $baris->filter(fn (array $hari): bool => isset($hari['abw']));
        $timbangTerakhir = $timbang->last();

        return [
            'umur' => (int) ($terakhir['umur'] ?? 0),
            'populasi_awal' => $this->populasi_awal,
            'sisa' => $terakhir['saldo'] ?? $this->populasi_awal,
            'mati' => (int) $baris->sum('mati'),
            'afkir' => (int) $baris->sum('afkir'),
            'mortalitas' => (float) ($terakhir['deplesi_persen'] ?? 0),
            'pakan_kg' => (float) ($terakhir['pakan_kg_kumulatif'] ?? 0),
            'abw' => $timbangTerakhir['abw'] ?? null,
            'abw_umur' => $timbangTerakhir['umur'] ?? null,
            'abw_standar' => $timbangTerakhir['abw_standar'] ?? null,
            'abw_selisih' => $timbangTerakhir ? $timbangTerakhir['abw_persen_standar'] - 100 : null,
            'fcr' => $timbangTerakhir['fcr'] ?? null,
            'pakan_gram_kumulatif' => $timbangTerakhir['pakan_gram_kumulatif'] ?? null,
            'titik_aktual' => $timbang->map(fn (array $hari): array => ['umur' => $hari['umur'], 'gram' => $hari['abw']])->values()->all(),
        ];
    }
}
