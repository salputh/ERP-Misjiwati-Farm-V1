<?php

namespace App\Livewire;

use App\Livewire\Concerns\MemilihPeriode;
use App\Support\LogPakan;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Title;
use Livewire\Component;

#[Title('Pakan dan stok')]
class LogPemberianPakan extends Component
{
    use MemilihPeriode;

    /**
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function log(): ?array
    {
        if (! $this->periode) {
            return null;
        }

        return LogPakan::buat($this->periode->loadMissing(['kandangPeriode.kandang', 'kandangPeriode.pemberianPakan.jenisPakan', 'penerimaanPakan.jenisPakan']));
    }

    public function render(): View
    {
        return view('livewire.log-pemberian-pakan');
    }
}
