<?php

namespace App\Models;

use Database\Factories\SesiSamplingFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

/**
 * Satu sesi sampling bobot di satu kandang pada satu tanggal.
 */
class SesiSampling extends Model
{
    /** @use HasFactory<SesiSamplingFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['tanggal' => 'date', 'dengan_sexing' => 'boolean'];
    }

    public function periodeKandang(): BelongsTo
    {
        return $this->belongsTo(PeriodeKandang::class);
    }

    public function titik(): HasMany
    {
        return $this->hasMany(TitikSampling::class);
    }

    /**
     * Berat per sampel dalam bentuk isian form: [lantai][kelamin][line][urutan] => gram.
     *
     * @return array<string, array<string, array<string, array<int, int>>>>
     */
    public function isianBerat(): array
    {
        $isian = [];
        foreach ($this->titik as $titik) {
            $isian[$titik->lantai][$titik->kelamin][$titik->line][$titik->urutan] = $titik->berat_gram;
        }

        return $isian;
    }

    /**
     * Jumlah ekor tiap titik dalam bentuk isian form: [lantai][kelamin][line][urutan] => ekor.
     *
     * @return array<string, array<string, array<string, array<int, int>>>>
     */
    public function isianEkor(): array
    {
        $isian = [];
        foreach ($this->titik as $titik) {
            $isian[$titik->lantai][$titik->kelamin][$titik->line][$titik->urutan] = (int) $titik->ekor;
        }

        return $isian;
    }

    /**
     * Ekor per sampel tiap kelamin, diambil dari titik yang tersimpan.
     * Nilai yang paling banyak dipakai dalam kelompok itu yang ditampilkan, karena satu sesi
     * boleh memuat titik dengan jumlah ekor berbeda-beda.
     *
     * @return array<string, int>
     */
    public function ekorPerSampel(): array
    {
        return $this->titik
            ->groupBy('kelamin')
            ->map(function (Collection $titik): int {
                $hitungan = $titik->pluck('ekor')->countBy();

                return (int) $hitungan->sortByDesc(fn (int $jumlah): int => $jumlah)->keys()->first();
            })
            ->all();
    }

    /**
     * ABW gabungan, atau satu kelamin bila diberikan.
     */
    public function abw(?string $kelamin = null): ?float
    {
        $titik = $kelamin ? $this->titik->where('kelamin', $kelamin) : $this->titik;
        $ekor = $titik->sum('ekor');

        return $ekor > 0 ? $titik->sum('berat_gram') / $ekor : null;
    }

    /**
     * ABW tiap lantai dan kelamin: [lantai][kelamin] => gram.
     *
     * @return array<string, array<string, float>>
     */
    public function abwKelompok(): array
    {
        return $this->titik
            ->groupBy('lantai')
            ->map(fn ($perLantai) => $perLantai->groupBy('kelamin')->map(fn ($titik) => $titik->sum('berat_gram') / $titik->sum('ekor'))->all())
            ->all();
    }
}
