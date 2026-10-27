<?php

namespace Tests\Feature;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Livewire\MasterTarifPeriode;
use App\Livewire\Rhpp;
use App\Models\Aktivitas;
use App\Models\Periode;
use App\Models\TarifPeriode;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class MasterTarifPeriodeTest extends TestCase
{
    use RefreshDatabase;

    public function test_master_data_page_shows_the_global_rates(): void
    {
        $this->get(route('master-data'))
            ->assertOk()
            ->assertSee('Tarif periode')
            ->assertSee('Gaji ABK per kg')
            ->assertSee('Rp 500')
            ->assertSee('2,5%');
    }

    public function test_legacy_rate_url_redirects_to_the_master_data_page(): void
    {
        $this->get(route('tarif-periode'))->assertRedirect(route('master-data'));
    }

    public function test_rates_can_be_changed_and_only_real_changes_are_logged(): void
    {
        $halaman = Livewire::test(MasterTarifPeriode::class)
            ->call('ubah')
            ->assertSet('tarif.tarif_gaji_abk_per_kg', '500')
            ->assertSet('tarif.persen_zakat', '2.5')
            ->call('simpan')
            ->assertHasNoErrors();
        $this->assertSame(0, Aktivitas::count());

        $halaman->call('ubah')
            ->set('tarif.tarif_gaji_abk_per_kg', '600')
            ->set('tarif.persen_zakat', '3')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Tarif periode diperbarui.')
            ->assertSee('Rp 600');

        $tarif = TarifPeriode::global();
        $this->assertSame([600, 3.0], [$tarif->tarif_gaji_abk_per_kg, $tarif->persen_zakat]);
        $this->assertDatabaseHas('aktivitas', [
            'jenis' => JenisAktivitas::Ubah->value,
            'modul' => ModulAktivitas::MasterData->value,
            'subjek' => 'Tarif periode',
        ]);
    }

    public function test_rates_are_validated(): void
    {
        Livewire::test(MasterTarifPeriode::class)
            ->call('ubah')
            ->set('tarif.tarif_gaji_abk_per_kg', '-1')
            ->set('tarif.persen_zakat', '101')
            ->set('tarif.persen_bonus_pasar_abk', '')
            ->call('simpan')
            ->assertHasErrors(['tarif.tarif_gaji_abk_per_kg' => 'min', 'tarif.persen_zakat' => 'between', 'tarif.persen_bonus_pasar_abk' => 'required']);

        $this->assertSame(500, TarifPeriode::global()->tarif_gaji_abk_per_kg);
    }

    public function test_rhpp_simulation_without_its_own_sheet_uses_the_global_rates(): void
    {
        $this->seed(DatabaseSeeder::class);
        TarifPeriode::global()->update(['tarif_gaji_abk_per_kg' => 725, 'persen_zakat' => 3]);
        $periode = Periode::where('nama', 'Periode September 2026')->firstOrFail();

        Livewire::withQueryParams(['periode' => $periode->id])
            ->test(Rhpp::class)
            ->call('pilihTab', 'bagi-hasil')
            ->assertSet('tarifDariMaster', true)
            ->assertSet('masukanBagiHasil.tarif_gaji_abk_per_kg', '725')
            ->assertSet('masukanBagiHasil.persen_zakat', '3')
            ->assertSee('diambil dari Tarif periode');
    }
}
