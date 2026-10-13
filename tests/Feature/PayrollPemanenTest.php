<?php

namespace Tests\Feature;

use App\Livewire\PayrollPemanen;
use App\Models\NotaPanen;
use App\Models\Pemanen;
use App\Models\Periode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class PayrollPemanenTest extends TestCase
{
    use RefreshDatabase;

    public function test_each_harvester_is_paid_for_the_full_weight_of_each_note_that_lists_them(): void
    {
        $periode = $this->buatPeriode();
        Pemanen::create(['nama' => 'Rizal', 'upah_per_kg' => 20]);
        Pemanen::create(['nama' => 'David', 'upah_per_kg' => 40]);
        $this->buatNota($periode, 'BT001', '2000.00', "Rizal, David\nRizal");
        $this->buatNota($periode, 'BT002', '500.00', 'rizal');

        $this->get(route('payroll.pemanen', ['periode' => $periode->id]))
            ->assertOk()
            ->assertSee('Payroll pemanen')
            ->assertSee(route('payroll.pemanen'), false)
            ->assertSee('masing-masing menerima perhitungan atas seluruh berat nota');

        Livewire::test(PayrollPemanen::class)
            ->set('periodeId', $periode->id)
            ->assertSee('Rizal')
            ->assertSee('David')
            ->assertSee('2.500,00 kg')
            ->assertSee('2.000,00 kg')
            ->assertSee('Rp 50.000')
            ->assertSee('Rp 80.000')
            ->assertSee('Rp 130.000');
    }

    public function test_unregistered_and_unassigned_harvest_weight_is_reported_not_paid(): void
    {
        $periode = $this->buatPeriode();
        Pemanen::create(['nama' => 'Rizal', 'upah_per_kg' => 20]);
        $this->buatNota($periode, 'BT001', '12.03', 'Rizal, Pemanen Asing');
        $this->buatNota($periode, 'BT002', '10.00', '');

        Livewire::test(PayrollPemanen::class)
            ->set('periodeId', $periode->id)
            ->assertSee('Pemanen Asing')
            ->assertSee('12,03 kg')
            ->assertSee('10,00 kg belum memiliki nama tukang tangkap')
            ->assertSee('Rp 241')
            ->assertDontSee('Rp 480');
    }

    public function test_payroll_page_explains_when_the_selected_period_has_no_harvest(): void
    {
        $periode = $this->buatPeriode();

        Livewire::test(PayrollPemanen::class)
            ->set('periodeId', $periode->id)
            ->assertSee('Belum ada panen di periode ini');
    }

    private function buatPeriode(): Periode
    {
        return Periode::create([
            'nama' => 'Periode Uji Payroll',
            'strain' => 'Ross',
            'tanggal_chick_in' => '2026-10-01',
            'berat_doc_gram' => 40,
            'status' => 'selesai',
        ]);
    }

    private function buatNota(Periode $periode, string $noBtpa, string $beratKg, string $tukangTangkap): NotaPanen
    {
        return NotaPanen::factory()
            ->for($periode)
            ->create([
                'no_btpa' => $noBtpa,
                'tukang_tangkap' => $tukangTangkap,
                'berat_kg' => $beratKg,
                'netto_nota_kg' => $beratKg,
            ]);
    }
}
