<?php

namespace App\Models;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use Database\Factories\AktivitasFactory;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Satu aksi pengguna yang menambah, mengubah, atau menghapus data. Dicatat sekali per aksi, bukan per baris
 * tabel yang ikut berubah, dan menyimpan salinan teksnya sehingga tidak bergantung pada data aslinya.
 */
class Aktivitas extends Model
{
    /** @use HasFactory<AktivitasFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['jenis' => JenisAktivitas::class, 'modul' => ModulAktivitas::class];
    }

    /**
     * Catat satu aksi. Panggil di dalam transaksi yang sama dengan perubahan datanya.
     *
     * @param  string  $subjek  Data yang dikenai aksi, diawali huruf besar: "Laporan harian 2 Oktober 2026".
     * @param  ?string  $rincian  Keterangan tambahan, misalnya kandang dan periodenya.
     */
    public static function catat(JenisAktivitas $jenis, ModulAktivitas $modul, string $subjek, ?string $rincian = null): self
    {
        return self::create(['jenis' => $jenis, 'modul' => $modul, 'subjek' => $subjek, 'rincian' => $rincian]);
    }

    /**
     * Terbaru dulu; aktivitas pada detik yang sama diurutkan menurut urutan pencatatannya.
     *
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function terbaru(Builder $query): void
    {
        $query->orderByDesc('created_at')->orderByDesc('id');
    }

    /**
     * Kalimat aktivitas: "Laporan harian 2 Oktober 2026 diubah".
     */
    public function kalimat(): string
    {
        return "{$this->subjek} {$this->jenis->hasil()}";
    }

    /**
     * Modul dan rincian dalam satu baris: "Laporan harian, Periode September 2026, umur 22 hari".
     */
    public function konteks(): string
    {
        return implode(', ', array_filter([$this->modul->label(), $this->rincian]));
    }
}
