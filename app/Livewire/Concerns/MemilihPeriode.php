<?php

namespace App\Livewire\Concerns;

use App\Models\Periode;
use Illuminate\Database\Eloquent\Collection;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Url;

/**
 * Pemilihan periode lewat query string ?periode=. Tanpa pilihan, dipakai periode terbaru.
 */
trait MemilihPeriode
{
    #[Url(as: 'periode')]
    public ?int $periodeId = null;

    /**
     * @return Collection<int, Periode>
     */
    #[Computed]
    public function daftarPeriode(): Collection
    {
        return Periode::orderByDesc('tanggal_chick_in')->get();
    }

    #[Computed]
    public function periode(): ?Periode
    {
        return $this->daftarPeriode->firstWhere('id', $this->periodeId) ?? $this->daftarPeriode->first();
    }
}
