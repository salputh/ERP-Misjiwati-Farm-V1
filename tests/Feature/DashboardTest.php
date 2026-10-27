<?php

namespace Tests\Feature;

use App\Enums\StatusBobot;
use App\Livewire\Dashboard;
use App\Models\NotaPanen;
use App\Models\Periode;
use App\Models\RhppReal;
use App\Models\SesiSampling;
use App\Models\TitikSampling;
use App\Support\Format;
use App\Support\LembarRhpp;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
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
            ->assertSee('Belum ada periode')
            ->assertSee('Panduan sistem')
            ->assertSee('Hentikan panduan')
            ->assertSee('Siapkan data dasar')
            ->assertSee('Tinjau dan tutup periode');
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
        $terpanen = (int) NotaPanen::where('periode_id', $this->periodeJuli()->id)->sum('ekor');

        $this->assertSame($terpanen, $total['terpanen']);
        $this->assertSame($kandang->sum('sisa') - $terpanen, $total['sisa']);
        $this->assertSame($total['awal'] - $total['mati'] - $total['afkir'] - $terpanen, $total['sisa']);
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
            ->assertSee('Periode September 2026')
            ->assertSee('Pilih periode');
    }

    public function test_dashboard_defaults_to_the_active_period_before_a_newer_closed_period(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periodeAktif = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
        $periodeTerbaru = Periode::where('nama', 'Periode September 2026')->firstOrFail();
        $periodeAktif->update(['status' => 'berjalan']);
        $periodeTerbaru->update(['status' => 'tutup_rhpp']);

        $this->assertSame($periodeAktif->id, Livewire::test(Dashboard::class)->instance()->periode->id);

        $this->get(route('dashboard'))
            ->assertOk()
            ->assertSee('Periode Juli 2026');
    }

    public function test_dashboard_handles_cash_only_coop_without_a_bird_population(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->get(route('dashboard', ['periode' => Periode::where('nama', 'Periode September 2026')->value('id')]))
            ->assertOk()
            ->assertSee('Kandang 1')
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

    public function test_age_and_working_days_count_from_doc_chick_in(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = Periode::where('nama', 'Periode September 2026')->firstOrFail();
        $periode->notaPanen()->delete();
        $this->travelTo($periode->tanggal_chick_in->copy()->addDays(20)->setTime(9, 0));

        $dashboard = Livewire::withQueryParams(['periode' => $periode->id])->test(Dashboard::class);
        $waktu = $dashboard->instance()->waktu;

        $this->assertSame([20, 21, false, false], [$waktu['umur'], $waktu['hari_kerja'], $waktu['umur_selesai'], $waktu['kerja_selesai']]);
        $dashboard->assertSee('Umur ayam')->assertSee('Total hari kerja');
    }

    public function test_age_and_working_days_stop_at_the_last_harvest_of_a_closed_period(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = $this->periodeJuli();
        $panenTerakhir = $periode->notaPanen()->max('tanggal_panen');
        $umurPanen = $periode->umurPada(Carbon::parse($panenTerakhir));

        $waktu = Livewire::withQueryParams(['periode' => $periode->id])->test(Dashboard::class)->instance()->waktu;

        $this->assertSame([$umurPanen, $umurPanen + 1, true, true], [$waktu['umur'], $waktu['hari_kerja'], $waktu['umur_selesai'], $waktu['kerja_selesai']]);
    }

    public function test_bird_summary_switches_to_real_rhpp_figures_once_the_document_is_locked(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = $this->periodeJuli();

        Livewire::withQueryParams(['periode' => $periode->id])->test(Dashboard::class)
            ->assertSet('real', null)
            ->assertSee('FCR sementara')
            ->assertDontSee('(RHPP real)');

        $periode->rhppReal->update(['status' => RhppReal::DIKUNCI]);
        $kinerja = LembarRhpp::real($periode->fresh())['kinerja'];

        $dashboard = Livewire::withQueryParams(['periode' => $periode->id])->test(Dashboard::class)
            ->assertSee('Ayam hidup (RHPP real)')
            ->assertSee('FCR (RHPP real)')
            ->assertDontSee('FCR sementara');
        $real = $dashboard->instance()->real;

        $this->assertSame($kinerja['ekor'], $real['ekor']);
        $this->assertSame($kinerja['deplesi']['aktual'], $real['deplesi']);
        $this->assertSame($kinerja['fcr']['aktual'], $real['fcr']);
        $this->assertEqualsWithDelta($kinerja['bw'] * 1000, $real['bw_gram'], 0.001);
        $dashboard->assertSee(Format::angka($real['fcr'], 3));
    }

    public function test_weight_chart_adds_male_and_female_lines_from_sexing_samples(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = $this->periodeJuli();
        [$pertama, $kedua] = $periode->kandangPeriode()->with('kandang')->get()->sortBy('kandang.nama')->values()->all();

        // Kandang pertama: 20 ekor jantan 30 kg dan 20 ekor betina 26 kg pada umur 21.
        $sesi = SesiSampling::factory()->denganSexing()->create(['periode_kandang_id' => $pertama->id, 'tanggal' => $periode->tanggal_chick_in->copy()->addDays(21), 'umur' => 21]);
        TitikSampling::factory()->create(['sesi_sampling_id' => $sesi->id, 'kelamin' => 'jantan', 'berat_gram' => 30000, 'ekor' => 20]);
        TitikSampling::factory()->create(['sesi_sampling_id' => $sesi->id, 'kelamin' => 'betina', 'berat_gram' => 26000, 'ekor' => 20]);
        // Kandang kedua: 20 ekor jantan 34 kg pada hari yang sama; sesi tanpa sexing tidak ikut.
        $sesi = SesiSampling::factory()->denganSexing()->create(['periode_kandang_id' => $kedua->id, 'tanggal' => $periode->tanggal_chick_in->copy()->addDays(21), 'umur' => 21]);
        TitikSampling::factory()->create(['sesi_sampling_id' => $sesi->id, 'kelamin' => 'jantan', 'berat_gram' => 34000, 'ekor' => 20]);
        $campuran = SesiSampling::factory()->create(['periode_kandang_id' => $kedua->id, 'tanggal' => $periode->tanggal_chick_in->copy()->addDays(14), 'umur' => 14]);
        TitikSampling::factory()->create(['sesi_sampling_id' => $campuran->id, 'kelamin' => 'campuran', 'berat_gram' => 10000, 'ekor' => 20]);

        $bobot = Livewire::withQueryParams(['periode' => $periode->id])->test(Dashboard::class)->instance()->grafik['bobot'];
        $kodePertama = 'kandang-'.trim(str_ireplace('kandang', '', $pertama->kandang->nama));

        $this->assertSame([1500.0, 1300.0], [$bobot[$kodePertama]['sexing']['jantan'][21], $bobot[$kodePertama]['sexing']['betina'][21]]);
        // Gabungan ditimbang ekor sampel: (30.000 + 34.000) / 40 ekor.
        $this->assertSame(1600.0, $bobot['semua']['sexing']['jantan'][21]);
        $this->assertSame(1300.0, $bobot['semua']['sexing']['betina'][21]);
        $this->assertNull($bobot['semua']['sexing']['jantan'][14]);
        $this->assertCount(43, $bobot['semua']['sexing']['jantan']);
    }

    public function test_weight_chart_has_no_sexing_lines_without_sexing_samples(): void
    {
        $this->seed(DatabaseSeeder::class);
        SesiSampling::query()->update(['dengan_sexing' => false]);

        $bobot = Livewire::withQueryParams(['periode' => $this->periodeJuli()->id])->test(Dashboard::class)->instance()->grafik['bobot'];

        $this->assertNull($bobot['semua']['sexing']);
    }

    private function periodeJuli(): Periode
    {
        return Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
    }
}
