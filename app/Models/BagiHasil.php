<?php

namespace App\Models;

use App\Enums\PeranBagiHasil;
use Database\Factories\BagiHasilFactory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Masukan bagi hasil satu kandang dalam satu periode: biaya operasional, tarif, premi, dan persen potongan.
 * Pendapatannya diambil dari RHPP real; orang-orangnya ada di penerima.
 */
class BagiHasil extends Model
{
    /** @use HasFactory<BagiHasilFactory> */
    use HasFactory;

    /**
     * Lembar masih boleh diubah.
     */
    public const SEMENTARA = 'sementara';

    /**
     * Lembar dikunci: tidak dapat diubah sampai dibuka kembali dengan password admin.
     */
    public const DIKUNCI = 'dikunci';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'persen_upah_controller' => 'float',
            'persen_bonus_pasar_abk' => 'float',
            'persen_bonus_pasar_controller' => 'float',
            'persen_zakat' => 'float',
        ];
    }

    public function periodeKandang(): BelongsTo
    {
        return $this->belongsTo(PeriodeKandang::class);
    }

    /**
     * Apakah lembar ini dikunci sehingga tidak dapat diubah.
     */
    public function terkunci(): bool
    {
        return $this->status === self::DIKUNCI;
    }

    public function penerima(): HasMany
    {
        return $this->hasMany(PenerimaBagiHasil::class)->orderBy('urutan')->orderBy('id');
    }

    /**
     * Penerima dengan satu peran, dari relasi yang sudah di-load.
     *
     * @return Collection<int, PenerimaBagiHasil>
     */
    public function penerimaBerperan(PeranBagiHasil $peran): Collection
    {
        return $this->penerima->where('peran', $peran)->values();
    }
}
