<?php

namespace App\Livewire;

use App\Livewire\Concerns\MemilihPeriode;
use App\Models\PeriodeKandang;
use App\Support\LembarPayroll;
use App\Support\LembarRhpp;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Title;
use Livewire\Attributes\Url;
use Livewire\Component;

/**
 * Slip gaji ABK satu periode: rekap per orang dan slip tiap orang, bisa disaring per kandang.
 */
#[Title('Payroll ABK')]
class PayrollAbk extends Component
{
    use MemilihPeriode;

    /** Saringan kandang (id periode_kandang); null berarti semua kandang. */
    #[Url(as: 'kandang')]
    public ?int $periodeKandangId = null;

    public function pilihKandang(?int $periodeKandangId = null): void
    {
        $this->periodeKandangId = $periodeKandangId;
    }

    /**
     * Kandang periode terpilih yang punya slip gaji, urut nama.
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
            ->has('slipGaji')
            ->with(['kandang', 'slipGaji.penerimaBagiHasil', 'bagiHasil.penerima'])
            ->get()
            ->sortBy('kandang.nama')
            ->values();
    }

    #[Computed]
    public function terpilih(): ?PeriodeKandang
    {
        return $this->daftarKandang->firstWhere('id', $this->periodeKandangId);
    }

    /**
     * Slip gaji kandang terpilih, atau semua kandang bila tidak disaring.
     *
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function lembar(): ?array
    {
        if ($this->daftarKandang->isEmpty()) {
            return null;
        }

        $rhpp = LembarRhpp::real($this->periode->loadMissing(LembarRhpp::RELASI));

        return LembarPayroll::buat($this->terpilih ? $this->daftarKandang->where('id', $this->terpilih->id) : $this->daftarKandang, $rhpp);
    }

    public function render(): View
    {
        return view('livewire.payroll-abk');
    }
}
