<?php

namespace Tests\Feature;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Livewire\FormLaporanHarian;
use App\Livewire\LaporanHarian;
use App\Livewire\RiwayatAktivitas;
use App\Livewire\SamplingBobot;
use App\Models\Aktivitas;
use App\Models\Kandang;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Livewire\Features\SupportTesting\Testable;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * Riwayat aktivitas: tiap aksi simpan atau hapus dicatat sekali, lalu tampil di ringkasan dan di halaman riwayat.
 */
class AktivitasTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-10-05 08:00:00');
    }

    public function test_seeding_data_records_no_activity(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(0, Aktivitas::count());
    }

    public function test_saving_a_new_daily_report_records_an_addition(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->formLaporan()
            ->set('isian.'.$this->kunciKandangDua().'.mati', '7')
            ->call('simpan')
            ->assertHasNoErrors();

        $aktivitas = Aktivitas::sole();
        $this->assertSame(JenisAktivitas::Tambah, $aktivitas->jenis);
        $this->assertSame(ModulAktivitas::LaporanHarian, $aktivitas->modul);
        $this->assertSame('Laporan harian 3 Oktober 2026 ditambahkan', $aktivitas->kalimat());
        $this->assertSame('Periode September 2026, umur 22 hari', $aktivitas->rincian);
    }

    public function test_saving_a_stored_daily_report_records_a_change(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->formLaporan('2026-10-02')
            ->set('isian.'.$this->kunciKandangDua().'.mati', '9')
            ->call('simpan')
            ->assertHasNoErrors();

        $aktivitas = Aktivitas::sole();
        $this->assertSame(JenisAktivitas::Ubah, $aktivitas->jenis);
        $this->assertSame('Laporan harian 2 Oktober 2026 diubah', $aktivitas->kalimat());
    }

    public function test_a_report_that_fails_validation_records_nothing(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->formLaporan()->call('simpan')->assertHasErrors('kosong');

        $this->assertSame(0, Aktivitas::count());
    }

    public function test_deleting_a_daily_report_records_a_deletion_from_the_form_and_from_the_list(): void
    {
        $this->seed(DatabaseSeeder::class);
        $september = $this->september();

        $this->formLaporan('2026-10-02')->call('hapus');

        Livewire::withQueryParams(['periode' => $september->id])
            ->test(LaporanHarian::class)
            // Tanpa tanggal yang dikonfirmasi tidak ada yang dihapus, jadi tidak ada yang dicatat.
            ->call('hapus')
            ->call('mintaHapus', '2026-10-01')
            ->call('hapus');

        $this->assertSame(
            ['Laporan harian 1 Oktober 2026 dihapus', 'Laporan harian 2 Oktober 2026 dihapus'],
            Aktivitas::terbaru()->get()->map->kalimat()->all(),
        );
        $this->assertSame([JenisAktivitas::Hapus], Aktivitas::pluck('jenis')->unique()->values()->all());
    }

    public function test_saving_a_sampling_session_records_an_addition_then_a_change(): void
    {
        $this->seed(DatabaseSeeder::class);
        $kandangDua = PeriodeKandang::whereRelation('periode', 'nama', 'Periode September 2026')->firstOrFail();

        $komponen = Livewire::withQueryParams(['periode' => $kandangDua->periode_id, 'kandang' => $kandangDua->id, 'tanggal' => '2026-09-15'])
            ->test(SamplingBobot::class);
        $this->isiSampling($komponen);

        $komponen->call('simpan')->assertHasNoErrors();
        $komponen->call('simpan')->assertHasNoErrors();

        $aktivitas = Aktivitas::orderBy('id')->get();
        $this->assertSame([JenisAktivitas::Tambah, JenisAktivitas::Ubah], $aktivitas->pluck('jenis')->all());
        $this->assertSame(ModulAktivitas::SamplingBobot, $aktivitas[0]->modul);
        $this->assertSame('Sampling bobot 15 September 2026 ditambahkan', $aktivitas[0]->kalimat());
        $this->assertSame('Kandang 2, Periode September 2026', $aktivitas[0]->rincian);
    }

    public function test_incomplete_sampling_records_nothing(): void
    {
        $this->seed(DatabaseSeeder::class);
        $kandangDua = PeriodeKandang::whereRelation('periode', 'nama', 'Periode September 2026')->firstOrFail();

        Livewire::withQueryParams(['periode' => $kandangDua->periode_id, 'kandang' => $kandangDua->id, 'tanggal' => '2026-09-15'])
            ->test(SamplingBobot::class)
            ->call('simpan')
            ->assertHasErrors();

        $this->assertSame(0, Aktivitas::count());
    }

    public function test_module_label_and_icon_come_from_the_sidebar_navigation(): void
    {
        foreach (ModulAktivitas::cases() as $modul) {
            $this->assertNotSame('', $modul->label());
            $this->assertStringStartsWith('uil-', $modul->ikon());
        }

        $this->assertSame('Laporan harian', ModulAktivitas::LaporanHarian->label());
        $this->assertSame(config('navigasi.produksi.item.sampling-bobot.ikon'), ModulAktivitas::SamplingBobot->ikon());
    }

    public function test_dashboard_shows_the_six_latest_activities_newest_first(): void
    {
        $this->seed(DatabaseSeeder::class);

        foreach (range(1, 7) as $jam) {
            Aktivitas::factory()->aksi(JenisAktivitas::Ubah)->pada("2026-10-05 0{$jam}:00:00")->create(['subjek' => "Laporan ke-{$jam}", 'rincian' => 'Periode September 2026, umur 22 hari']);
        }

        $this->get(route('dashboard'))
            ->assertOk()
            ->assertSee('Aktivitas terbaru')
            ->assertSee('href="'.route('aktivitas').'"', false)
            ->assertSeeInOrder(['Laporan ke-7 diubah', 'Laporan ke-6 diubah', 'Laporan ke-2 diubah'])
            ->assertDontSee('Laporan ke-1 diubah')
            ->assertSee('Laporan harian, Periode September 2026, umur 22 hari')
            ->assertSee('badge-dot badge-dot--big dot-info', false)
            ->assertSee('1 jam yang lalu');
    }

    public function test_dashboard_says_so_when_there_is_no_activity_yet(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->get(route('dashboard'))
            ->assertOk()
            ->assertSee('Aktivitas terbaru')
            ->assertSee('Belum ada aktivitas.');
    }

    public function test_history_page_lists_activities_by_day_newest_first(): void
    {
        Aktivitas::factory()->aksi(JenisAktivitas::Tambah)->pada('2026-10-03 16:45:00')->create(['subjek' => 'Laporan harian 3 Oktober 2026']);
        Aktivitas::factory()->aksi(JenisAktivitas::Hapus)->pada('2026-10-05 07:15:00')->create(['subjek' => 'Laporan harian 1 Oktober 2026']);
        Aktivitas::factory()->aksi(JenisAktivitas::Ubah, ModulAktivitas::SamplingBobot)->pada('2026-10-05 07:30:00')->create(['subjek' => 'Sampling bobot 4 Oktober 2026', 'rincian' => 'Kandang 2, Periode September 2026']);

        $this->get(route('aktivitas'))
            ->assertOk()
            ->assertSee('Riwayat aktivitas')
            ->assertSee('3 aktivitas')
            ->assertSeeInOrder([
                'Senin, 5 Oktober 2026',
                '07:30', 'Sampling bobot 4 Oktober 2026 diubah', 'Kandang 2, Periode September 2026',
                '07:15', 'Laporan harian 1 Oktober 2026 dihapus',
                'Sabtu, 3 Oktober 2026',
                '16:45', 'Laporan harian 3 Oktober 2026 ditambahkan',
            ])
            ->assertSee('dm-tag tag-transparented m-0 tag-danger', false)
            ->assertDontSee('Tampilkan lebih banyak');
    }

    public function test_history_page_filters_by_action_and_module(): void
    {
        Aktivitas::factory()->aksi(JenisAktivitas::Tambah)->create(['subjek' => 'Laporan harian 3 Oktober 2026']);
        Aktivitas::factory()->aksi(JenisAktivitas::Hapus)->create(['subjek' => 'Laporan harian 1 Oktober 2026']);
        Aktivitas::factory()->aksi(JenisAktivitas::Tambah, ModulAktivitas::SamplingBobot)->create(['subjek' => 'Sampling bobot 4 Oktober 2026']);

        Livewire::test(RiwayatAktivitas::class)
            ->call('pilihJenis', 'tambah')
            ->assertSet('jenis', 'tambah')
            ->assertSee('2 aktivitas')
            ->assertSee('Laporan harian 3 Oktober 2026 ditambahkan')
            ->assertDontSee('Laporan harian 1 Oktober 2026 dihapus')
            ->call('pilihModul', 'sampling-bobot')
            ->assertSee('1 aktivitas')
            ->assertSee('Sampling bobot 4 Oktober 2026 ditambahkan')
            ->assertDontSee('Laporan harian 3 Oktober 2026 ditambahkan')
            ->call('pilihJenis', 'hapus')
            ->assertSee('0 aktivitas')
            ->assertSee('Tidak ada aktivitas yang cocok dengan saringan ini.')
            // Saringan yang tidak dikenal berarti semua.
            ->call('pilihJenis', 'ngawur')
            ->call('pilihModul', 'ngawur')
            ->assertSet('jenis', '')
            ->assertSet('modul', '')
            ->assertSee('3 aktivitas');

        Livewire::withQueryParams(['aksi' => 'hapus', 'modul' => 'ngawur'])
            ->test(RiwayatAktivitas::class)
            ->assertSet('modul', '')
            ->assertSee('1 aktivitas')
            ->assertSee('Laporan harian 1 Oktober 2026 dihapus');
    }

    public function test_history_page_loads_more_activities_on_request(): void
    {
        Aktivitas::factory()->count(50)->pada('2026-10-05 07:00:00')->create();
        Aktivitas::factory()->aksi(JenisAktivitas::Tambah)->pada('2026-10-01 07:00:00')->create(['subjek' => 'Laporan paling lama']);

        Livewire::test(RiwayatAktivitas::class)
            ->assertSee('51 aktivitas')
            ->assertSee('Menampilkan 50 dari 51 aktivitas')
            ->assertDontSee('Laporan paling lama')
            ->call('muatLagi')
            ->assertSee('Laporan paling lama ditambahkan')
            ->assertDontSee('Tampilkan lebih banyak');
    }

    public function test_history_page_shows_an_empty_state_and_a_loading_overlay(): void
    {
        $this->get(route('aktivitas'))
            ->assertOk()
            ->assertSee('Belum ada aktivitas')
            ->assertSee('wire:target="pilihJenis, pilihModul, muatLagi"', false);
    }

    public function test_sidebar_links_to_the_history_page(): void
    {
        $this->get(route('aktivitas'))
            ->assertOk()
            ->assertSee('<a href="'.route('aktivitas').'" class="active">', false);

        $this->get(route('dashboard'))->assertSee('<a href="'.route('aktivitas').'" class="">', false);
    }

    private function formLaporan(?string $tanggal = null): Testable
    {
        return Livewire::withQueryParams(array_filter(['periode' => $this->september()->id, 'tanggal' => $tanggal]))->test(FormLaporanHarian::class);
    }

    private function isiSampling(Testable $komponen): void
    {
        foreach (config('sampling.lantai') as $lantai => $info) {
            foreach ($info['line'] as $line) {
                $komponen->set("berat.{$lantai}.campuran.{$line}.1", 2400)->set("berat.{$lantai}.campuran.{$line}.2", 2600);
            }
        }
    }

    private function september(): Periode
    {
        return Periode::where('nama', 'Periode September 2026')->firstOrFail();
    }

    private function kunciKandangDua(): string
    {
        return 'k'.PeriodeKandang::where(['periode_id' => $this->september()->id, 'kandang_id' => Kandang::where('nama', 'Kandang 2')->firstOrFail()->id])->firstOrFail()->id;
    }
}
