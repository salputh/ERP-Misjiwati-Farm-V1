<?php

namespace App\Livewire;

use App\Livewire\Concerns\MemilihPeriode;
use App\Models\Periode;
use App\Support\LembarRhpp;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Title;
use Livewire\Attributes\Url;
use Livewire\Component;

#[Title('RHPP')]
class Rhpp extends Component
{
    use MemilihPeriode;

    private const TAB = ['simulasi', 'real'];

    #[Url(as: 'tab')]
    public string $tab = 'simulasi';

    public function mount(): void
    {
        $this->pilihTab($this->tab);
    }

    public function pilihTab(string $tab): void
    {
        $this->tab = in_array($tab, self::TAB, true) ? $tab : 'simulasi';
    }

    /**
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function simulasi(): ?array
    {
        return $this->periodeTermuat() ? LembarRhpp::simulasi($this->periodeTermuat()) : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function real(): ?array
    {
        return $this->periodeTermuat() ? LembarRhpp::real($this->periodeTermuat()) : null;
    }

    public function render(): View
    {
        return view('livewire.rhpp');
    }

    private function periodeTermuat(): ?Periode
    {
        return $this->periode?->loadMissing(LembarRhpp::RELASI);
    }
}
