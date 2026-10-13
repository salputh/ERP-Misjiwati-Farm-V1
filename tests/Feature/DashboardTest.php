<?php

namespace Tests\Feature;

use App\Enums\StatusBobot;
use App\Livewire\Dashboard;
use App\Models\Periode;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_root_redirects_to_dashboard(): void
    {
        $this->get('/')->assertRedirect('/dashboard');
    }

    public function test_dashboard_shows_empty_state_without_a_period(): void
    {
        $this->get(route('dashboard'))
            ->assertOk()
            ->assertSee('Belum ada periode');
    }

    public function test_dashboard_shows_period_summary_and_each_coop(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->get(route('dashboard', ['periode' => $this->periodeJuli()->id]))
            ->assertOk()
            ->assertSee('Periode Juli 2026')
            ->assertSee('Ayam hidup')
            ->assertSee('Performa kandang')
            ->assertSeeInOrder(['Kandang 1', 'Kandang 2']);
    }

    public function test_totals_are_consistent_with_per_coop_figures(): void
    {
        $this->seed(DatabaseSeeder::class);

        $dashboard = Livewire::withQueryParams(['periode' => $this->periodeJuli()->id])->test(Dashboard::class)->instance();
        $kandang = collect($dashboard->kandang);
        $total = $dashboard->total;

        $this->assertSame($kandang->sum('sisa'), $total['sisa']);
        $this->assertSame($total['awal'] - $total['mati'] - $total['afkir'], $total['sisa']);
        $this->assertEqualsWithDelta($total['pakan_kg'], array_sum($dashboard->grafik['pakan']), 0.5);
    }

    public function test_weight_status_follows_deviation_thresholds(): void
    {
        $this->assertSame(StatusBobot::Baik, StatusBobot::dariSelisih(12.5));
        $this->assertSame(StatusBobot::Baik, StatusBobot::dariSelisih(-3));
        $this->assertSame(StatusBobot::Waspada, StatusBobot::dariSelisih(-3.1));
        $this->assertSame(StatusBobot::Waspada, StatusBobot::dariSelisih(-8));
        $this->assertSame(StatusBobot::Buruk, StatusBobot::dariSelisih(-8.1));
        $this->assertSame(StatusBobot::Belum, StatusBobot::dariSelisih(null));
    }

    public function test_seeded_coops_are_above_standard_weight(): void
    {
        $this->seed(DatabaseSeeder::class);

        $status = collect(Livewire::withQueryParams(['periode' => $this->periodeJuli()->id])->test(Dashboard::class)->instance()->kandang)->pluck('status', 'nama');

        $this->assertSame(StatusBobot::Baik, $status['Kandang 1']);
        $this->assertSame(StatusBobot::Baik, $status['Kandang 2']);
    }

    public function test_dashboard_defaults_to_the_latest_period(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->get(route('dashboard'))
            ->assertOk()
            ->assertSee('Periode September 2026');
    }

    public function test_pemodal_menu_opens_the_master_data_page(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->get(route('master-data'))
            ->assertOk()
            ->assertSee('Daftar jenis pakan')
            ->assertSee('Daftar harga kontrak')
            ->assertSee('Daftar pemodal')
            ->assertSee('Tambah pemodal');
    }

    public function test_production_menu_lists_daily_report(): void
    {
        $this->get('/produksi/laporan-harian')->assertOk()->assertSee('Laporan harian');
        $this->get('/produksi/sampel-harian')->assertNotFound();
    }

    public function test_unknown_module_returns_not_found(): void
    {
        $this->get('/keuangan/tidak-ada')->assertNotFound();
    }

    private function periodeJuli(): Periode
    {
        return Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
    }
}
