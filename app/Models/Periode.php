<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

class Periode extends Model
{
    /** Status periode yang sudah ditutup: datanya tidak dapat diubah lagi. */
    public const STATUS_TERTUTUP = ['tutup_rhpp', 'selesai'];

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
        return in_array($this->status, self::STATUS_TERTUTUP, true);
    }

    /**
     * Periode sedang berjalan (status lama "aktif" disamakan dengan "berjalan").
     */
    public function berjalan(): bool
    {
        return in_array($this->status, ['berjalan', 'aktif'], true);
    }

    /**
     * Label status untuk tampilan; status lama "aktif" dan "selesai" ditampilkan dengan nama barunya.
     */
    public function labelStatus(): string
    {
        return match ($this->status) {
            'persiapan' => 'Persiapan',
            'berjalan', 'aktif' => 'Berjalan',
            'panen' => 'Panen',
            'tutup_rhpp', 'selesai' => 'Tutup RHPP',
            default => (string) $this->status,
        };
    }

    /**
     * Total DOC dari jumlah agregat withSum (populasi awal + bonus DOC), untuk daftar periode tanpa memuat kandangnya.
     */
    public function docChickInTerjumlah(): int
    {
        return (int) $this->kandang_periode_sum_populasi_awal + (int) $this->kandang_periode_sum_bonus_doc_ekor;
    }

    /**
     * Berat DOC periode untuk tampilan: satu angka bila semua kandang sama, "Bervariasi" bila berbeda, "-" bila belum ada.
     */
    public function beratDocTampil(): string
    {
        $berat = $this->kandangPeriode
            ->map(fn (PeriodeKandang $satu): int => $satu->beratDocGramEfektif())
            ->filter()
            ->unique();

        return match ($berat->count()) {
            0 => '-',
            1 => $berat->first().' gram',
            default => 'Bervariasi',
        };
    }

    protected function casts(): array
    {
        return [
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
    /**
     * Tanggal acuan "hari ini" untuk umur ayam. Pada mode demo data berhenti di recording terakhir,
     * jadi umur tidak ikut bertambah mengikuti kalender dan tetap cocok dengan data yang ada.
     */
    public function tanggalAcuan(): CarbonInterface
    {
        if (config('app.demo_mode')) {
            $terakhir = Recording::query()
                ->whereIn('periode_kandang_id', $this->kandangPeriode()->select('id'))
                ->max('tanggal');

            if ($terakhir) {
                return Carbon::parse($terakhir)->startOfDay();
            }
        }

        return today();
    }

    public function umurPada(CarbonInterface $tanggal): int
    {
        return (int) $this->tanggal_chick_in->diffInDays($tanggal->copy()->startOfDay());
    }

    /**
     * Nomor siklus tiap kandang pada periode ini, mis. "Kandang 1: 18 · Kandang 2: 19".
     * Bila semua kandang sama, cukup satu nomor.
     */
    public function labelSiklus(): string
    {
        $this->loadMissing('kandangPeriode.kandang');

        $siklus = $this->kandangPeriode->filter(fn (PeriodeKandang $satu): bool => $satu->nomor_siklus !== null);

        if ($siklus->isEmpty()) {
            return '-';
        }

        if ($siklus->pluck('nomor_siklus')->unique()->count() === 1) {
            return (string) $siklus->first()->nomor_siklus;
        }

        return $siklus->map(fn (PeriodeKandang $satu): string => $satu->kandang->nama.' '.$satu->nomor_siklus)->implode(' · ');
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
