<?php

namespace App\Livewire\Concerns;

use App\Models\Farm;
use App\Models\Periode;
use Illuminate\Database\Eloquent\Collection;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Url;

/**
 * Pemilihan periode lewat query string ?periode=. Tanpa pilihan, dipakai periode terbaru.
 */
trait MemilihPeriode
{
    #[Url(as: 'farm')]
    public ?int $farmId = null;

    #[Url(as: 'periode')]
    public ?int $periodeId = null;

    /**
     * @return Collection<int, Farm>
     */
    #[Computed]
    public function daftarFarm(): Collection
    {
        return Farm::query()->orderBy('nama')->get();
    }

    #[Computed]
    public function farm(): ?Farm
    {
        $farm = $this->daftarFarm->firstWhere('id', $this->farmId);
        if ($farm) {
            return $farm;
        }

        $periode = $this->periodeId ? Periode::query()->find($this->periodeId) : null;

        return $this->daftarFarm->firstWhere('id', $periode?->farm_id) ?? $this->daftarFarm->first();
    }

    /**
     * @return Collection<int, Periode>
     */
    #[Computed]
    public function daftarPeriode(): Collection
    {
        return $this->farm
            ? $this->farm->periodes()->prioritaskanAktif()->get()
            : new Collection;
    }

    #[Computed]
    public function periode(): ?Periode
    {
        return $this->daftarPeriode->firstWhere('id', $this->periodeId) ?? $this->daftarPeriode->first();
    }

    protected function pastikanPeriodeDapatDiubah(): void
    {
        abort_if($this->periode?->tertutup(), 403);
    }
}
