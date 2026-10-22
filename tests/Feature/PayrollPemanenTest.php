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
            ->assertSee('Berat timbang aktual dipakai jika diisi');

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

    public function test_note_weight_is_allocated_by_each_harvesters_starting_crate(): void
    {
        $periode = $this->buatPeriode();
        Pemanen::create(['nama' => 'Rizal', 'upah_per_kg' => 20]);
        Pemanen::create(['nama' => 'David', 'upah_per_kg' => 40]);
        $nota = $this->buatNota($periode, 'BT003', '100.00', '');
        $nota->update(['jumlah_krat' => 10]);
        $nota->pemanenKrat()->createMany([
            ['nama' => 'Rizal', 'krat_mulai' => 1],
            ['nama' => 'David', 'krat_mulai' => 4],
        ]);

        Livewire::test(PayrollPemanen::class)
            ->set('periodeId', $periode->id)
            ->assertSee('30,00 kg')
            ->assertSee('70,00 kg')
            ->assertSee('Rp 600')
            ->assertSee('Rp 2.800')
            ->assertSee('Rp 3.400');
    }

    public function test_krat_before_the_first_harvesters_start_remain_unallocated(): void
    {
        $periode = $this->buatPeriode();
        Pemanen::create(['nama' => 'Rizal', 'upah_per_kg' => 20]);
        $nota = $this->buatNota($periode, 'BT004', '100.00', '');
        $nota->update(['jumlah_krat' => 10]);
        $nota->pemanenKrat()->create([
            'nama' => 'Rizal',
            'krat_mulai' => 3,
        ]);

        Livewire::test(PayrollPemanen::class)
            ->set('periodeId', $periode->id)
            ->assertSee('80,00 kg')
            ->assertSee('20,00 kg belum teralokasi ke pemanen')
            ->assertSee('Rp 1.600')
            ->assertDontSee('Rp 2.000');
    }

    public function test_manual_harvester_weights_are_used_and_the_remaining_note_weight_is_split_by_crates(): void
    {
        $periode = $this->buatPeriode();
        Pemanen::create(['nama' => 'Rizal', 'upah_per_kg' => 20]);
        Pemanen::create(['nama' => 'David', 'upah_per_kg' => 20]);
        Pemanen::create(['nama' => 'Budi', 'upah_per_kg' => 20]);
        $nota = $this->buatNota($periode, 'BT005', '100.00', '');
        $nota->update(['jumlah_krat' => 10]);
        $nota->pemanenKrat()->createMany([
            ['nama' => 'Rizal', 'krat_mulai' => 1, 'berat_timbang_kg' => 20],
            ['nama' => 'David', 'krat_mulai' => 4],
            ['nama' => 'Budi', 'krat_mulai' => 8],
        ]);

        Livewire::test(PayrollPemanen::class)
            ->set('periodeId', $periode->id)
            ->assertSee('20,00 kg')
            ->assertSee('45,71 kg')
            ->assertSee('34,29 kg')
            ->assertSee('Rp 400')
            ->assertSee('Rp 914')
            ->assertSee('Rp 686')
            ->assertSee('Rp 2.000');
    }

    public function test_all_entered_harvester_weights_override_the_crate_proportions(): void
    {
        $periode = $this->buatPeriode();
        Pemanen::create(['nama' => 'Rizal', 'upah_per_kg' => 20]);
        Pemanen::create(['nama' => 'David', 'upah_per_kg' => 20]);
        $nota = $this->buatNota($periode, 'BT006', '100.00', '');
        $nota->update(['jumlah_krat' => 10]);
        $nota->pemanenKrat()->createMany([
            ['nama' => 'Rizal', 'krat_mulai' => 1, 'berat_timbang_kg' => 25.25],
            ['nama' => 'David', 'krat_mulai' => 4, 'berat_timbang_kg' => 74.75],
        ]);

        Livewire::test(PayrollPemanen::class)
            ->set('periodeId', $periode->id)
            ->assertSee('25,25 kg')
            ->assertSee('74,75 kg')
            ->assertSee('Rp 505')
            ->assertSee('Rp 1.495')
            ->assertSee('Rp 2.000');
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
            ->assertSee('10,00 kg belum teralokasi ke pemanen')
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
            'status' => 'tutup_rhpp',
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
