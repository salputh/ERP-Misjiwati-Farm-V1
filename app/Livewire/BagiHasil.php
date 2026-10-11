<?php

namespace App\Livewire;

use App\Livewire\Concerns\MemilihPeriode;
use App\Models\Kandang;
use App\Models\PeriodeKandang;
use App\Support\BukuKas;
use App\Support\LembarBagiHasil;
use App\Support\LembarRhpp;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Component;

/**
 * Bagi hasil satu kandang: pendapatan dari RHPP real, potongan berurutan, pembagian ABK dan pemodal.
 */
class BagiHasil extends Component
{
    use MemilihPeriode;

    #[Locked]
    public Kandang $kandang;

    public function mount(Kandang $kandang): void
    {
        $this->kandang = $kandang;
    }

    /**
     * Kandang ini pada periode terpilih; null bila kandang tidak dipakai di periode itu.
     */
    #[Computed]
    public function periodeKandang(): ?PeriodeKandang
    {
        return $this->periode?->kandangPeriode()
            ->where('kandang_id', $this->kandang->id)
            ->with(['bagiHasil.penerima', 'transaksiKas'])
            ->first();
    }

    /**
     * RHPP real periode terpilih; sumber pendapatan per kandang.
     *
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function rhpp(): ?array
    {
        return $this->periode ? LembarRhpp::real($this->periode->loadMissing(LembarRhpp::RELASI)) : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function lembar(): ?array
    {
        if (! $this->periodeKandang) {
            return null;
        }

        return LembarBagiHasil::buat($this->periodeKandang, $this->rhpp, BukuKas::buat($this->periodeKandang)['ringkasan']['keluar'] ?? null);
    }

    public function render(): View
    {
        return view('livewire.bagi-hasil')->title('Bagi hasil '.$this->kandang->nama);
    }
}
