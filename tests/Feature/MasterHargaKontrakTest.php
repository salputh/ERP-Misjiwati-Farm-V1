<?php

namespace Tests\Feature;

use App\Livewire\MasterHargaKontrak;
use App\Models\Periode;
use App\Support\LembarRhpp;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class MasterHargaKontrakTest extends TestCase
{
    use RefreshDatabase;

    public function test_page_shows_the_selected_periods_contract_brackets(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();

        $this->get(route('master-data', ['periode' => $periode->id]))
            ->assertOk()
            ->assertSee('Daftar harga kontrak')
            ->assertSee('Periode Juli 2026')
            ->assertSee('BW Minimum (kg)')
            ->assertSee('BW Maksimum (kg)')
            ->assertSee('Harga Kontrak/kg')
            ->assertSee('1,30')
            ->assertSee('1,39')
            ->assertSee('22.145')
            ->assertSee(route('master-data'), false);
    }

    public function test_contract_brackets_can_be_created_updated_and_deleted_for_the_selected_period(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();

        $halaman = Livewire::withQueryParams(['periode' => $periode->id])
            ->test(MasterHargaKontrak::class)
            ->call('tambah')
            ->set('bobotMinKg', '0.00')
            ->set('bobotMaxKg', '1.08')
            ->set('hargaPerKg', '23150')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSee('0,00')
            ->assertSee('1,08')
            ->assertSee('23.150');

        $hargaKontrak = $periode->hargaKontrak()->where('bobot_min_kg', 0)->firstOrFail();

        $halaman->call('ubah', $hargaKontrak->id)
            ->assertSet('bobotMinKg', '0.00')
            ->assertSet('bobotMaxKg', '1.08')
            ->set('bobotMaxKg', '1.07')
            ->set('hargaPerKg', '23200')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSee('23.200')
            ->call('mintaHapus', $hargaKontrak->id)
            ->call('hapus')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Bracket BW 0,00–1,07 kg dihapus.');

        $this->assertDatabaseMissing('harga_kontraks', ['id' => $hargaKontrak->id]);
    }

    public function test_contract_bracket_mutations_cannot_touch_another_period(): void
    {
        $this->seed(DatabaseSeeder::class);
        $juli = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
        $september = Periode::where('nama', 'Periode September 2026')->firstOrFail();
        $hargaJuli = $juli->hargaKontrak()->firstOrFail();

        Livewire::withQueryParams(['periode' => $september->id])
            ->test(MasterHargaKontrak::class)
            ->call('ubah', $hargaJuli->id)
            ->assertNotFound();

        $this->assertDatabaseHas('harga_kontraks', ['id' => $hargaJuli->id, 'periode_id' => $juli->id]);
    }

    public function test_bracket_validation_rejects_invalid_ranges_and_overlaps(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();

        Livewire::withQueryParams(['periode' => $periode->id])
            ->test(MasterHargaKontrak::class)
            ->call('tambah')
            ->set('bobotMinKg', '2.10')
            ->set('bobotMaxKg', '2.00')
            ->set('hargaPerKg', '22000')
            ->call('simpan')
            ->assertHasErrors(['bobotMaxKg' => 'gte']);

        Livewire::withQueryParams(['periode' => $periode->id])
            ->test(MasterHargaKontrak::class)
            ->call('tambah')
            ->set('bobotMinKg', '2.05')
            ->set('bobotMaxKg', '2.15')
            ->set('hargaPerKg', '22000')
            ->call('simpan')
            ->assertHasErrors(['bobotMinKg']);
    }

    public function test_rhpp_uses_only_the_price_from_the_matching_weight_range(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
        $bracket = $periode->hargaKontrak;

        $this->assertNull(LembarRhpp::hargaKontrak($bracket, 1.29));
        $this->assertSame(22145, LembarRhpp::hargaKontrak($bracket, 1.3));
        $this->assertSame(21190, LembarRhpp::hargaKontrak($bracket, 9.99));
        $this->assertNull(LembarRhpp::hargaKontrak($bracket, 10.0));
        $this->assertNull(LembarRhpp::hargaKontrak($bracket, null));
    }

    public function test_menu_links_to_contract_price_master_page(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->get(route('master-data'))
            ->assertOk()
            ->assertSee('Master data')
            ->assertSee('Daftar harga kontrak')
            ->assertDontSee('Belum ada periode');
    }

    public function test_legacy_contract_price_url_preserves_the_selected_period(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();

        $this->get(route('harga-kontrak', ['periode' => $periode->id]))
            ->assertRedirect(route('master-data', ['periode' => $periode->id]));
    }
}
