<?php

namespace App\Models;

use Database\Factories\KasbonFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Kasbon seorang ABK, misalnya untuk membeli HP atau sepeda motor, yang dikembalikan lewat beberapa kali
 * potongan slip gaji periode. Potongan pertama ada di slip periode saat kasbon diambil.
 */
class Kasbon extends Model
{
    /** @use HasFactory<KasbonFactory> */
    use HasFactory;

    /** Batas jumlah potongan satu kasbon. */
    public const MAKS_POTONGAN = 24;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['tanggal' => 'date', 'jumlah' => 'integer', 'jumlah_potongan' => 'integer', 'nilai_potongan' => 'integer'];
    }

    public function karyawan(): BelongsTo
    {
        return $this->belongsTo(Karyawan::class);
    }

    public function periode(): BelongsTo
    {
        return $this->belongsTo(Periode::class);
    }

    /**
     * Transaksi Pinjaman ABK di kas operasional bila uang kasbon keluar dari kas kandang.
     */
    public function transaksiKas(): BelongsTo
    {
        return $this->belongsTo(TransaksiKas::class);
    }

    public function potongan(): HasMany
    {
        return $this->hasMany(PotonganKasbon::class);
    }

    /**
     * Jumlah yang sudah dipotong dari slip gaji. Pakai relasi potongan yang sudah di-load.
     */
    public function terpotong(): int
    {
        return (int) $this->potongan->sum('jumlah');
    }

    public function sisa(): int
    {
        return max(0, $this->jumlah - $this->terpotong());
    }

    public function lunas(): bool
    {
        return $this->sisa() === 0;
    }

    /**
     * Jumlah kali potongan bila tiap slip dipotong sebesar nominal tertentu: potongan terakhir mengambil sisanya.
     */
    public static function kaliUntukNominal(int $jumlah, int $nilaiPotongan): int
    {
        return (int) ceil($jumlah / max(1, $nilaiPotongan));
    }

    /**
     * Potongan yang disarankan untuk slip berikutnya. Bila nominal per slip ditentukan, nominal itu yang dipotong
     * sampai lunas. Bila tidak, sisa dibagi rata ke sisa jatah potongan, dibulatkan ke atas per Rp 1.000 agar
     * angkanya bulat; bila jatah potongan sudah habis tetapi masih bersisa, seluruh sisa dipotong.
     */
    public function saranPotongan(): int
    {
        $sisa = $this->sisa();
        if ($this->nilai_potongan) {
            return min($sisa, $this->nilai_potongan);
        }

        $sisaJatah = $this->jumlah_potongan - $this->potongan->count();

        if ($sisa === 0 || $sisaJatah <= 1) {
            return $sisa;
        }

        return min($sisa, (int) ceil($sisa / $sisaJatah / 1000) * 1000);
    }
}
