<?php

namespace App\Models;

use App\Enums\PeranBagiHasil;
use Database\Factories\PenerimaBagiHasilFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu orang di lembar bagi hasil: ABK, penerima bonus pasar, penerima entertain, atau pemodal.
 */
class PenerimaBagiHasil extends Model
{
    /** @use HasFactory<PenerimaBagiHasilFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['peran' => PeranBagiHasil::class, 'jumlah' => 'integer', 'persen' => 'float', 'dijumlahkan' => 'boolean'];
    }

    public function bagiHasil(): BelongsTo
    {
        return $this->belongsTo(BagiHasil::class);
    }
}
