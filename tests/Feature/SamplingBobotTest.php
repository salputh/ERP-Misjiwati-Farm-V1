<?php

namespace Tests\Feature;

use App\Livewire\SamplingBobot;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use App\Models\Recording;
use App\Models\SesiSampling;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Livewire\Features\SupportTesting\Testable;
use Livewire\Livewire;
use Tests\TestCase;

class SamplingBobotTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-10-04');
        $this->seed(DatabaseSeeder::class);
    }

    /**
     * Angka dari "Rekap Hasil Sampel Bobot Ayam — 20 ekor / sampel", Kandang 2 usia 1 hari.
     */
    public function test_sampling_without_sexing_matches_the_original_sheet(): void
    {
        $hasil = $this->komponen('2026-09-12')->instance()->hasil;

        $this->assertSame(['campuran'], $hasil['kelamin']);
        $this->assertSame(17100.0, $hasil['lantai']['bawah']['campuran']['subtotal']);
        $this->assertSame(71, (int) round($hasil['lantai']['bawah']['campuran']['abw']));
        $this->assertSame(34, (int) round($hasil['lantai']['bawah']['campuran']['dg']));
        $this->assertSame(17300.0, $hasil['lantai']['atas']['campuran']['subtotal']);
        $this->assertSame(72, (int) round($hasil['lantai']['atas']['campuran']['abw']));
        $this->assertSame(35, (int) round($hasil['lantai']['atas']['campuran']['dg']));

        $gabungan = $hasil['gabungan'];
        $this->assertSame(34400.0, $gabungan['total']);
        $this->assertSame([12, 24, 480], [$gabungan['jumlah_line'], $gabungan['jumlah_titik'], $gabungan['ekor']]);
        $this->assertSame(72, (int) round($gabungan['abw']));
        $this->assertSame(56.0, $gabungan['abw_standar']);
        $this->assertSame(35, (int) round($gabungan['dg']));
        $this->assertSame(19.0, $gabungan['dg_standar']);
        $this->assertSame(16, (int) round($gabungan['selisih_dg']));
    }

    /**
     * Angka dari "Rekap Hasil Sampel Bobot Ayam — per jenis kelamin", Kandang 2 usia 22 hari.
     */
    public function test_sampling_with_sexing_matches_the_original_sheet(): void
    {
        $komponen = $this->komponen('2026-10-03')->instance();
        $hasil = $komponen->hasil;

        $this->assertSame(['jantan', 'betina'], $hasil['kelamin']);
        $this->assertSame(175400.0, $hasil['lantai']['bawah']['jantan']['subtotal']);
        $this->assertSame(1462, (int) round($hasil['lantai']['bawah']['jantan']['abw']));
        $this->assertSame(159800.0, $hasil['lantai']['bawah']['betina']['subtotal']);
        $this->assertSame(1332, (int) round($hasil['lantai']['bawah']['betina']['abw']));
        $this->assertSame(175100.0, $hasil['lantai']['atas']['jantan']['subtotal']);
        $this->assertSame(1459, (int) round($hasil['lantai']['atas']['jantan']['abw']));
        $this->assertSame(159500.0, $hasil['lantai']['atas']['betina']['subtotal']);
        $this->assertEqualsWithDelta(1329.17, $hasil['lantai']['atas']['betina']['abw'], 0.01);

        $this->assertSame([350500.0, 12, 24, 240], array_values(array_intersect_key($hasil['per_kelamin']['jantan'], array_flip(['total', 'jumlah_line', 'jumlah_titik', 'ekor']))));
        $this->assertSame(1460, (int) round($hasil['per_kelamin']['jantan']['abw']));
        $this->assertSame(319300.0, $hasil['per_kelamin']['betina']['total']);
        $this->assertSame(1330, (int) round($hasil['per_kelamin']['betina']['abw']));

        $gabungan = $hasil['gabungan'];
        $this->assertSame([669800.0, 480], [$gabungan['total'], $gabungan['ekor']]);
        $this->assertSame(1395, (int) round($gabungan['abw']));
        $this->assertSame(1153.0, $gabungan['abw_standar']);
        $this->assertSame(126, (int) round($gabungan['dg']));
        $this->assertSame(84.0, $gabungan['dg_standar']);
        $this->assertSame(42, (int) round($gabungan['selisih_dg']));

        $this->assertSame(63, (int) round($komponen->pakan['zak_standar']));
        $this->assertSame('1,288', number_format($komponen->pakan['fcr_standar'], 3, ',', '.'));
    }

    public function test_sampling_type_follows_age_and_can_be_switched(): void
    {
        $this->komponen('2026-09-23')
            ->assertSet('denganSexing', false)
            ->assertSee('Ekor per sampel')
            ->set('tanggal', '2026-09-24')
            ->assertSet('denganSexing', true)
            ->assertSee('Ekor per sampel jantan')
            ->call('pilihJenis', false)
            ->assertSet('denganSexing', false)
            ->assertDontSee('Ekor per sampel jantan');
    }

    public function test_saving_a_new_session_stores_every_sample_and_shows_it_in_history(): void
    {
        $komponen = $this->komponen('2026-09-15')->assertSet('sesiId', null)->assertSet('denganSexing', false);

        foreach (config('sampling.lantai') as $lantai => $info) {
            foreach ($info['line'] as $line) {
                $komponen->set("berat.{$lantai}.campuran.{$line}.1", 2400)->set("berat.{$lantai}.campuran.{$line}.2", 2600);
            }
        }

        $komponen->call('simpan')->assertHasNoErrors()->assertSee('Sampling 15 September 2026 tersimpan.');

        $sesi = SesiSampling::whereDate('tanggal', '2026-09-15')->with('titik')->firstOrFail();
        $this->assertSame(4, $sesi->umur);
        $this->assertFalse($sesi->dengan_sexing);
        $this->assertCount(24, $sesi->titik);
        $this->assertSame(125.0, $sesi->abw());
        $komponen->assertSet('sesiId', $sesi->id)->assertSee('usia 4 hari');
    }

    public function test_incomplete_samples_are_not_saved(): void
    {
        $this->komponen('2026-09-15')
            ->set('berat.bawah.campuran.A.1', 2400)
            ->call('simpan')
            ->assertHasErrors(['berat.bawah.campuran.A.2', 'berat.atas.campuran.O.2'])
            ->assertSee('isian belum benar');

        $this->assertDatabaseMissing('sesi_samplings', ['umur' => 4]);
    }

    public function test_switching_an_existing_session_to_sexing_replaces_its_samples(): void
    {
        $komponen = $this->komponen('2026-09-12')->call('pilihJenis', true);

        foreach (config('sampling.lantai') as $lantai => $info) {
            foreach (['jantan', 'betina'] as $kelamin) {
                foreach ($info['line'] as $line) {
                    $komponen->set("berat.{$lantai}.{$kelamin}.{$line}.1", 700)->set("berat.{$lantai}.{$kelamin}.{$line}.2", 720);
                }
            }
        }

        $komponen->call('simpan')->assertHasNoErrors();

        $sesi = SesiSampling::whereDate('tanggal', '2026-09-12')->with('titik')->firstOrFail();
        $this->assertTrue($sesi->dengan_sexing);
        $this->assertCount(48, $sesi->titik);
        $this->assertSame(['betina', 'jantan'], $sesi->titik->pluck('kelamin')->unique()->sort()->values()->all());
    }

    public function test_opening_a_session_from_history_shows_its_results_in_a_modal(): void
    {
        $sesi = SesiSampling::whereDate('tanggal', '2026-10-03')->firstOrFail();

        $komponen = $this->komponen('2026-09-20')
            ->assertDontSee('14.500')
            ->call('buka', $sesi->id)
            ->assertSet('sesiDilihatId', $sesi->id)
            ->assertSee('14.500')
            ->assertSee('Ekor per sampel jantan');

        $dilihat = $komponen->instance()->dilihat;
        $this->assertTrue($dilihat['sesi']->is($sesi));
        $this->assertSame(['jantan' => 10, 'betina' => 10], array_intersect_key($dilihat['ekor'], array_flip(['jantan', 'betina'])));
        $this->assertSame(14500.0, $dilihat['hasil']['lantai']['bawah']['jantan']['baris']['A']['sampel'][1]);
        $this->assertSame(1395, (int) round($dilihat['hasil']['gabungan']['abw']));
        $this->assertSame(42, (int) round($dilihat['hasil']['gabungan']['selisih_dg']));
        $this->assertSame('1,288', number_format($dilihat['pakan']['fcr_standar'], 3, ',', '.'));
    }

    public function test_an_opened_session_can_be_saved_or_copied_as_an_image(): void
    {
        $sesi = SesiSampling::whereDate('tanggal', '2026-10-03')->firstOrFail();

        $komponen = $this->komponen('2026-09-20')
            ->assertDontSee('Simpan PNG')
            ->call('buka', $sesi->id)
            ->assertSee('Simpan PNG')
            ->assertSee('Salin PNG')
            ->assertSeeHtml('sampling-kandang-2-2026-10-03');

        $dilihat = $komponen->instance()->dilihat;
        $lembar = $dilihat['lembar'];
        $this->assertSame('sampling-kandang-2-2026-10-03', $lembar['berkas']);
        $this->assertSame(['Kandang 2', 22, true], [$lembar['kandang'], $lembar['umur'], $lembar['dengan_sexing']]);
        $this->assertSame(['bawah' => 'Lantai bawah', 'atas' => 'Lantai atas'], $lembar['lantai']);
        $this->assertSame($dilihat['hasil'], $lembar['hasil']);
        $this->assertSame($dilihat['pakan'], $lembar['pakan']);
    }

    public function test_opening_a_session_from_history_leaves_the_form_untouched(): void
    {
        $sesi = SesiSampling::whereDate('tanggal', '2026-10-03')->firstOrFail();

        $this->komponen('2026-09-20')
            ->set('berat.bawah.campuran.A.1', 2400)
            ->call('buka', $sesi->id)
            ->assertSet('tanggal', '2026-09-20')
            ->assertSet('sesiId', null)
            ->assertSet('denganSexing', false)
            ->assertSet('berat', ['bawah' => ['campuran' => ['A' => [1 => 2400]]]])
            ->assertSet('ekor.campuran', 20);
    }

    public function test_a_session_from_another_house_cannot_be_opened(): void
    {
        $kandangLain = PeriodeKandang::whereRelation('periode', 'nama', 'Periode Juli 2026')->firstOrFail();
        $sesiLain = SesiSampling::factory()->create(['periode_kandang_id' => $kandangLain->id, 'tanggal' => '2026-07-20', 'umur' => 9]);

        $komponen = $this->komponen('2026-09-20')->call('buka', $sesiLain->id)->assertSet('sesiDilihatId', null);

        $this->assertNull($komponen->instance()->dilihat);
    }

    public function test_page_renders_for_every_period(): void
    {
        foreach (Periode::all() as $periode) {
            $this->get(route('sampling.bobot', ['periode' => $periode->id]))->assertOk()->assertSee('Rekap hasil sampel bobot ayam');
        }
    }

    /**
     * Halaman dibuka dengan ringkasan seluruh kandangs, sebelum form sampling kandangs terpilih.
     */
    public function test_the_page_opens_with_the_summary_of_every_house(): void
    {
        $periode = Periode::where('nama', 'Periode September 2026')->firstOrFail();

        $this->get(route('sampling.bobot', ['periode' => $periode->id]))
            ->assertOk()
            ->assertSee('Ringkasan sampling')
            ->assertSee('Kandang 1')
            ->assertSee('Kandang 2')
            ->assertSeeInOrder(['Ringkasan sampling', 'Sesi terakhir', 'Kandang 2 ·']);
    }

    /**
     * Jumlah ekor tiap titik boleh berbeda, jadi ABW dihitung dari ekor yang benar-benar ditimbang.
     */
    public function test_head_count_per_point_is_stored_and_used_for_the_average(): void
    {
        $komponen = $this->komponen('2026-09-15')->assertSet('sesiId', null);

        foreach (config('sampling.lantai') as $lantai => $info) {
            foreach ($info['line'] as $line) {
                $komponen->set("berat.{$lantai}.campuran.{$line}.1", 1000)
                    ->set("berat.{$lantai}.campuran.{$line}.2", 1000)
                    ->set("ekorTitik.{$lantai}.campuran.{$line}.1", 20)
                    ->set("ekorTitik.{$lantai}.campuran.{$line}.2", 10);
            }
        }

        $komponen->call('simpan')->assertHasNoErrors();

        $sesi = SesiSampling::whereDate('tanggal', '2026-09-15')->with('titik')->firstOrFail();
        $this->assertCount(24, $sesi->titik);
        $this->assertSame([10, 20], $sesi->titik->pluck('ekor')->unique()->sort()->values()->all());
        $this->assertSame(360, $sesi->titik->sum('ekor'));
        $this->assertSame(24000, $sesi->titik->sum('berat_gram'));
        $this->assertEqualsWithDelta(66.6667, $sesi->abw(), 0.001);
    }

    public function test_the_default_head_count_applies_to_every_point(): void
    {
        $komponen = $this->komponen('2026-09-15')->set('ekor.campuran', 16);
        $titik = $komponen->instance()->ekorTitik;

        $this->assertSame(16, $titik['bawah']['campuran']['A'][1]);
        $this->assertSame(16, $titik['atas']['campuran']['O'][2]);
    }

    /**
     * ABW hasil sampling langsung mengisi ABW aktual di recording harian.
     */
    public function test_saving_a_session_fills_the_body_weight_into_the_daily_recording(): void
    {
        $komponen = $this->komponen('2026-09-15');

        foreach (config('sampling.lantai') as $lantai => $info) {
            foreach ($info['line'] as $line) {
                $komponen->set("berat.{$lantai}.campuran.{$line}.1", 2400)->set("berat.{$lantai}.campuran.{$line}.2", 2600);
            }
        }

        $komponen->call('simpan')->assertHasNoErrors()->assertSee('ABW 125,0 g masuk ke recording harian');

        $rekaman = Recording::whereDate('tanggal', '2026-09-15')->firstOrFail();
        $this->assertSame(4, $rekaman->umur);
        $this->assertSame(125.0, $rekaman->bobot_rata_gram);
    }

    public function test_saving_a_session_replaces_the_body_weight_already_in_the_recording(): void
    {
        $komponen = $this->komponen('2026-10-02')->assertSet('sesiId', null);

        foreach (config('sampling.lantai') as $lantai => $info) {
            foreach (['jantan', 'betina'] as $kelamin) {
                foreach ($info['line'] as $line) {
                    $komponen->set("berat.{$lantai}.{$kelamin}.{$line}.1", 700)->set("berat.{$lantai}.{$kelamin}.{$line}.2", 720);
                }
            }
        }

        $komponen->call('simpan')->assertHasNoErrors();

        $rekaman = Recording::whereDate('tanggal', '2026-10-02')->firstOrFail();
        $this->assertSame(21, $rekaman->umur);
        $this->assertSame(71.0, $rekaman->bobot_rata_gram);
    }

    /**
     * Jarak antar sesi lebih dari satu hari, maka DG dinormalkan per hari (FR-405).
     */
    public function test_daily_gain_is_normalized_when_the_previous_session_is_more_than_a_day_old(): void
    {
        $komponen = $this->komponen('2026-09-15');

        foreach (config('sampling.lantai') as $lantai => $info) {
            foreach ($info['line'] as $line) {
                $komponen->set("berat.{$lantai}.campuran.{$line}.1", 2400)->set("berat.{$lantai}.campuran.{$line}.2", 2600);
            }
        }

        $hasil = $komponen->instance()->hasil;

        // Sesi sebelumnya berumur 1 hari (ABW 71,67 g), jadi jaraknya tiga hari.
        $this->assertSame(3, $hasil['gabungan']['hari']);
        $this->assertEqualsWithDelta(53.3333, $hasil['gabungan']['dg'], 0.001);
        $this->assertEqualsWithDelta(17.7778, $hasil['gabungan']['dg_per_hari'], 0.001);
        $this->assertSame(23.0, $hasil['gabungan']['dg_standar']);
        $this->assertEqualsWithDelta(-5.2222, $hasil['gabungan']['selisih_dg'], 0.001);
        $this->assertEqualsWithDelta(17.9167, $hasil['lantai']['bawah']['campuran']['dg_per_hari'], 0.001);
    }

    /**
     * Ringkasan gabungan antar kandang dalam periode (FR-404).
     */
    public function test_the_combined_summary_collects_every_house_of_the_period(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
        $kandang = $periode->kandangPeriode()->get();

        foreach ($kandang as $satu) {
            $sesi = SesiSampling::create([
                'periode_kandang_id' => $satu->id,
                'tanggal' => '2026-07-20',
                'umur' => 5,
                'dengan_sexing' => false,
            ]);
            $sesi->titik()->create([
                'lantai' => 'bawah',
                'line' => 'A',
                'kelamin' => 'campuran',
                'urutan' => 1,
                'berat_gram' => 2000,
                'ekor' => 20,
            ]);
        }

        $komponen = Livewire::withQueryParams(['periode' => $periode->id, 'kandang' => $kandang->first()->id, 'tanggal' => '2026-07-20'])
            ->test(SamplingBobot::class);

        $gabungan = $komponen->instance()->gabunganKandang;

        $this->assertCount(2, $gabungan['kandang']);
        $this->assertSame(['Kandang 1', 'Kandang 2'], array_column($gabungan['kandang'], 'kandang'));
        $this->assertSame(2, $gabungan['total']['titik']);
        $this->assertSame(40, $gabungan['total']['ekor']);
        $this->assertSame(100.0, $gabungan['total']['abw']);
    }

    /**
     * Ringkasan memakai sesi terbaru tiap kandangs, bukan hanya tanggal yang sedang dipilih.
     */
    public function test_the_summary_shows_the_latest_session_of_every_house(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
        $kandang = $periode->kandangPeriode()->get();

        foreach ($kandang as $satu) {
            $sesi = SesiSampling::create([
                'periode_kandang_id' => $satu->id,
                'tanggal' => '2026-07-20',
                'umur' => 5,
                'dengan_sexing' => false,
            ]);
            $sesi->titik()->create([
                'lantai' => 'bawah',
                'line' => 'A',
                'kelamin' => 'campuran',
                'urutan' => 1,
                'berat_gram' => 2000,
                'ekor' => 20,
            ]);
        }

        // Kandang 1 punya sesi yang lebih baru lagi.
        $sesiBaru = SesiSampling::create([
            'periode_kandang_id' => $kandang->first()->id,
            'tanggal' => '2026-07-22',
            'umur' => 7,
            'dengan_sexing' => false,
        ]);
        $sesiBaru->titik()->create([
            'lantai' => 'bawah',
            'line' => 'A',
            'kelamin' => 'campuran',
            'urutan' => 1,
            'berat_gram' => 3000,
            'ekor' => 20,
        ]);

        $komponen = Livewire::withQueryParams(['periode' => $periode->id, 'kandang' => $kandang->first()->id, 'tanggal' => '2026-07-20'])
            ->test(SamplingBobot::class);

        $gabungan = $komponen->instance()->gabunganKandang;

        $this->assertSame('2026-07-22', $gabungan['kandang'][0]['tanggal']->format('Y-m-d'));
        $this->assertSame(7, $gabungan['kandang'][0]['umur']);
        $this->assertSame(150.0, $gabungan['kandang'][0]['abw']);
        $this->assertSame('2026-07-20', $gabungan['kandang'][1]['tanggal']->format('Y-m-d'));
        $this->assertSame(100.0, $gabungan['kandang'][1]['abw']);
        $this->assertSame(125.0, $gabungan['total']['abw']);
    }

    /**
     * Tombol Buka pada ringkasan memuatkan sesi terakhir kandangs itu ke form.
     */
    public function test_the_summary_opens_the_latest_session_of_a_house(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
        $kandang = $periode->kandangPeriode()->get();

        $sesi = SesiSampling::create([
            'periode_kandang_id' => $kandang->last()->id,
            'tanggal' => '2026-07-20',
            'umur' => 5,
            'dengan_sexing' => false,
        ]);
        $sesi->titik()->create([
            'lantai' => 'bawah',
            'line' => 'A',
            'kelamin' => 'campuran',
            'urutan' => 1,
            'berat_gram' => 2000,
            'ekor' => 20,
        ]);

        $komponen = Livewire::withQueryParams(['periode' => $periode->id, 'kandang' => $kandang->first()->id, 'tanggal' => '2026-07-10'])
            ->test(SamplingBobot::class)
            ->call('bukaSesi', $kandang->last()->id, '2026-07-20');

        $komponen->assertSet('periodeKandangId', $kandang->last()->id);
        $komponen->assertSet('tanggal', '2026-07-20');
        $komponen->assertSet('sesiId', $sesi->id);
    }

    private function komponen(string $tanggal): Testable
    {
        $kandangDua = PeriodeKandang::whereRelation('periode', 'nama', 'Periode September 2026')->firstOrFail();

        return Livewire::withQueryParams(['periode' => $kandangDua->periode_id, 'kandang' => $kandangDua->id, 'tanggal' => $tanggal])
            ->test(SamplingBobot::class);
    }
}
