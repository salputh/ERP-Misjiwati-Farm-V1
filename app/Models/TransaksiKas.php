<?php

namespace App\Models;

use App\Enums\KategoriKas;
use App\Support\KategoriKasTambahan;
use Database\Factories\TransaksiKasFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

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
        return ['tanggal' => 'date', 'jumlah' => 'integer'];
    }

    /**
     * Kategori baku (KategoriKas) atau kategori tambahan yang namanya diketik pengguna.
     *
     * @return Attribute<KategoriKas|KategoriKasTambahan, KategoriKas|KategoriKasTambahan|string>
     */
    protected function kategori(): Attribute
    {
        return Attribute::make(
            get: fn (string $nilai): KategoriKas|KategoriKasTambahan => KategoriKas::tryFrom($nilai) ?? new KategoriKasTambahan($nilai),
            set: fn (KategoriKas|KategoriKasTambahan|string $kategori): string => is_string($kategori) ? $kategori : $kategori->value,
        );
    }

    public function periodeKandang(): BelongsTo
    {
        return $this->belongsTo(PeriodeKandang::class);
    }

    /**
     * Kasbon ABK yang uangnya dicatat lewat transaksi ini. Transaksinya diubah dari halaman Kasbon ABK, bukan dari buku kas.
     */
    public function kasbon(): HasOne
    {
        return $this->hasOne(Kasbon::class);
    }
}
