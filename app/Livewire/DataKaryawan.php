<?php

namespace App\Livewire;

use App\Models\Karyawan;
use App\Models\Periode;
use App\Support\DaftarKaryawan;
use App\Support\LembarPayroll;
use App\Support\LembarRhpp;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Title;
use Livewire\Component;

/**
 * Data karyawan: seluruh karyawan kandang, orang yang sama dengan penerima slip di Payroll ABK.
 */
#[Title('Karyawan')]
class DataKaryawan extends Component
{
    /**
     * Periode terbaru yang sudah punya slip gaji; sumber hari kerja dan pendapatan bersih di daftar.
     */
    #[Computed]
    public function periodeSlip(): ?Periode
    {
        return Periode::whereHas('kandangPeriode.slipGaji')->orderByDesc('tanggal_chick_in')->first();
    }

    /**
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function daftar(): ?array
    {
        $payroll = null;

        if ($this->periodeSlip) {
            $kandangPeriode = $this->periodeSlip->kandangPeriode()
                ->has('slipGaji')
                ->with(['kandang', 'slipGaji.penerimaBagiHasil', 'bagiHasil.penerima'])
                ->get();
            $payroll = LembarPayroll::buat($kandangPeriode, LembarRhpp::real($this->periodeSlip->loadMissing(LembarRhpp::RELASI)));
        }

        return DaftarKaryawan::buat(Karyawan::with('kandang')->get(), $payroll);
    }

    public function render(): View
    {
        return view('livewire.data-karyawan');
    }
}
