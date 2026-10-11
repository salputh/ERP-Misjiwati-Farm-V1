<?php

namespace App\Models;

use App\Enums\Jabatan;
use Database\Factories\SlipGajiFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Slip gaji satu orang di satu kandang untuk satu periode: pendapatan dan potongan yang dicatat per orang.
 * Bagian dari bagi hasil (bila orang itu ABK di lembar bagi hasil) tidak disimpan, tetapi dihitung dari sana.
 */
class SlipGaji extends Model
{
    /** @use HasFactory<SlipGajiFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['jabatan' => Jabatan::class];
    }

    public function karyawan(): BelongsTo
    {
        return $this->belongsTo(Karyawan::class);
    }

    public function periodeKandang(): BelongsTo
    {
        return $this->belongsTo(PeriodeKandang::class);
    }

    public function penerimaBagiHasil(): BelongsTo
    {
        return $this->belongsTo(PenerimaBagiHasil::class);
    }
}
