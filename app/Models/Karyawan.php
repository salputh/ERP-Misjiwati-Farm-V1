<?php

namespace App\Models;

use App\Enums\Jabatan;
use App\Support\Format;
use Database\Factories\KaryawanFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Karyawan kandang: orang yang menerima slip gaji. Gaji pokok, hari kerja, dan tanggal gajian adalah nilai bawaan
 * slip gaji barunya; slip yang sudah dibuat tidak ikut berubah.
 */
class Karyawan extends Model
{
    /** @use HasFactory<KaryawanFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['jabatan' => Jabatan::class, 'gaji_pokok' => 'integer', 'hari_kerja' => 'integer', 'tanggal_gajian' => 'integer'];
    }

    /**
     * Inisial dua kata pertama nama untuk avatar, mis. "Wahyu ABK" menjadi "WA".
     */
    public function inisial(): string
    {
        return collect(explode(' ', $this->nama))
            ->take(2)
            ->map(fn (string $kata): string => mb_strtoupper(mb_substr($kata, 0, 1)))
            ->implode('');
    }

    /**
     * Nilai bawaan slip gaji dalam satu baris, mis. "Rp 2.000.000, 30 hari, gajian tgl 25"; null bila tidak ada satu pun.
     */
    public function gajiBawaan(): ?string
    {
        $ringkasan = collect([
            $this->gaji_pokok !== null ? 'Rp '.Format::angka($this->gaji_pokok) : null,
            $this->hari_kerja !== null ? Format::angka($this->hari_kerja).' hari' : null,
            $this->tanggal_gajian !== null ? 'gajian tgl '.$this->tanggal_gajian : null,
        ])->filter();

        return $ringkasan->isEmpty() ? null : $ringkasan->join(', ');
    }

    public function kandang(): BelongsTo
    {
        return $this->belongsTo(Kandang::class);
    }

    public function slipGaji(): HasMany
    {
        return $this->hasMany(SlipGaji::class);
    }

    public function kasbon(): HasMany
    {
        return $this->hasMany(Kasbon::class);
    }
}
