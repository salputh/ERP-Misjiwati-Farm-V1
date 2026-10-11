<?php

namespace App\Livewire;

use App\Livewire\Concerns\MemilihPeriode;
use App\Models\PeriodeKandang;
use App\Support\LembarRecording;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Title;
use Livewire\Attributes\Url;
use Livewire\Component;

#[Title('Recording harian')]
class RecordingHarian extends Component
{
    use MemilihPeriode;

    #[Url(as: 'kandang')]
    public ?int $periodeKandangId = null;

    /**
     * Kandang pada periode terpilih, urut nama.
     *
     * @return Collection<int, PeriodeKandang>
     */
    #[Computed]
    public function daftarKandang(): Collection
    {
        if (! $this->periode) {
            return new Collection;
        }

        return $this->periode->kandangPeriode()
            ->with(['kandang', 'periode', 'recordings', 'pemberianPakan'])
            ->get()
            ->sortBy('kandang.nama')
            ->values();
    }

    #[Computed]
    public function terpilih(): ?PeriodeKandang
    {
        return $this->daftarKandang->firstWhere('id', $this->periodeKandangId) ?? $this->daftarKandang->first();
    }

    /**
     * Baris lembar recording kandang terpilih.
     *
     * @return list<array<string, mixed>>
     */
    #[Computed]
    public function baris(): array
    {
        return $this->terpilih ? LembarRecording::baris($this->terpilih) : [];
    }

    public function pilihKandang(int $periodeKandangId): void
    {
        $this->periodeKandangId = $periodeKandangId;
    }

    public function render(): View
    {
        return view('livewire.recording-harian');
    }
}
