<?php

namespace Tests\Feature;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Livewire\MasterUangMakan;
use App\Models\Aktivitas;
use App\Models\Pengaturan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * Uang makan bawaan ABK di Master data: Rp 35.000 per hari selama 55 hari, tanpa perlu seeder.
 */
class MasterUangMakanTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_is_35_thousand_for_55_days_without_any_stored_setting(): void
    {
        $this->assertSame(0, Pengaturan::count());
        $this->assertSame(['per_hari' => 35_000, 'hari' => 55, 'total' => 1_925_000], Pengaturan::uangMakan());

        $this->get(route('master-data'))
            ->assertOk()
            ->assertSee('Uang makan')
            ->assertSee('Rp 35.000')
            ->assertSee('55 hari')
            ->assertSee('Rp 1.925.000');
    }

    public function test_rate_and_days_can_be_changed_and_only_real_changes_are_logged(): void
    {
        $halaman = Livewire::test(MasterUangMakan::class)
            ->call('ubah')
            ->assertSet('perHari', '35000')
            ->assertSet('hari', '55')
            ->call('simpan')
            ->assertHasNoErrors();
        $this->assertSame(0, Aktivitas::count());

        $halaman->call('ubah')
            ->set('perHari', '40000')
            ->set('hari', '50')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Uang makan diperbarui.')
            ->assertDispatched('tutup-modal-uang-makan')
            ->assertSee('Rp 2.000.000');

        $this->assertSame(['per_hari' => 40_000, 'hari' => 50, 'total' => 2_000_000], Pengaturan::uangMakan());

        $aktivitas = Aktivitas::query()->sole();
        $this->assertSame([JenisAktivitas::Ubah, ModulAktivitas::MasterData, 'Uang makan ABK', 'Rp 40.000 × 50 hari'], [$aktivitas->jenis, $aktivitas->modul, $aktivitas->subjek, $aktivitas->rincian]);
    }

    public function test_invalid_values_are_rejected_and_nothing_changes(): void
    {
        Livewire::test(MasterUangMakan::class)
            ->call('ubah')
            ->set('perHari', '')
            ->set('hari', '400')
            ->call('simpan')
            ->assertHasErrors(['perHari' => 'required', 'hari' => 'max'])
            ->set('perHari', '-1')
            ->set('hari', 'lima')
            ->call('simpan')
            ->assertHasErrors(['perHari' => 'min', 'hari' => 'integer']);

        $this->assertSame(0, Pengaturan::count());
        $this->assertSame(0, Aktivitas::count());
    }
}
