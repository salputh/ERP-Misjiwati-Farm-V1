<?php

namespace App\Models;

use App\Enums\KategoriKas;
use Database\Factories\TransaksiKasFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu baris buku kas operasional sebuah kandang dalam satu periode: dana masuk atau pengeluaran.
 */
class TransaksiKas extends Model
{
    /** @use HasFactory<TransaksiKasFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['tanggal' => 'date', 'kategori' => KategoriKas::class, 'jumlah' => 'integer'];
    }

    public function periodeKandang(): BelongsTo
    {
        return $this->belongsTo(PeriodeKandang::class);
    }
}
