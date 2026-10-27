<?php

namespace Tests\Feature;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Livewire\SamplingBobot;
use App\Models\Aktivitas;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use App\Models\Recording;
use App\Models\SesiSampling;
use App\Support\LembarRecording;
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
        $hasil = $this->ubahSesi('2026-09-12')->instance()->hasil;

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
        $komponen = $this->ubahSesi('2026-10-03')->instance();
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
        $this->tambahPada('2026-09-23')
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
        $komponen = $this->tambahPada('2026-09-15')->assertSet('sesiId', null)->assertSet('denganSexing', false);
        $this->isiCampuran($komponen, 2400, 2600);

        $komponen->call('simpan')->assertHasNoErrors()->assertSee('Sampling Kandang 2 15 September 2026 tersimpan.');

        $sesi = SesiSampling::whereDate('tanggal', '2026-09-15')->with('titik')->firstOrFail();
        $this->assertSame(4, $sesi->umur);
        $this->assertFalse($sesi->dengan_sexing);
        $this->assertCount(24, $sesi->titik);
        $this->assertSame(125.0, $sesi->abw());
        // Form kembali kosong untuk sampling berikutnya; sesi baru tampil di riwayat.
        $komponen->assertSet('sesiId', null)->assertSet('berat', [])->assertSee('usia 4 hari');
        $this->assertSame(1, Aktivitas::where(['modul' => ModulAktivitas::SamplingBobot, 'jenis' => JenisAktivitas::Tambah])->count());
    }

    public function test_incomplete_samples_are_not_saved(): void
    {
        $this->tambahPada('2026-09-15')
            ->set('berat.bawah.campuran.A.1', 2400)
            ->call('simpan')
            ->assertHasErrors(['berat.bawah.campuran.A.2', 'berat.atas.campuran.O.2'])
            ->assertSee('isian belum benar');

        $this->assertDatabaseMissing('sesi_samplings', ['umur' => 4]);
    }

    public function test_switching_an_existing_session_to_sexing_replaces_its_samples(): void
    {
        $komponen = $this->ubahSesi('2026-09-12')->call('pilihJenis', true);

        foreach (config('sampling.lantai') as $lantai => $info) {
            foreach (['jantan', 'betina'] as $kelamin) {
                foreach ($info['line'] as $line) {
                    $komponen->set("berat.{$lantai}.{$kelamin}.{$line}.1", 700)->set("berat.{$lantai}.{$kelamin}.{$line}.2", 720);
                }
            }
        }

        $komponen->call('simpan')->assertHasNoErrors()->assertSee('Sampling Kandang 2 12 September 2026 diperbarui.');

        $sesi = SesiSampling::whereDate('tanggal', '2026-09-12')->with('titik')->firstOrFail();
        $this->assertTrue($sesi->dengan_sexing);
        $this->assertCount(48, $sesi->titik);
        $this->assertSame(['betina', 'jantan'], $sesi->titik->pluck('kelamin')->unique()->sort()->values()->all());
    }

    public function test_opening_a_session_from_history_shows_its_results_in_a_modal(): void
    {
        $sesi = SesiSampling::whereDate('tanggal', '2026-10-03')->firstOrFail();

        $komponen = $this->komponen()
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

        $komponen = $this->komponen()
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

        $this->tambahPada('2026-09-20')
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

        $komponen = $this->komponen()->call('buka', $sesiLain->id)->assertSet('sesiDilihatId', null);

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
            ->assertSeeInOrder(['Tambah sampling Kandang 2', 'Ringkasan sampling', 'Sesi terakhir', 'Riwayat sampling']);
    }

    /**
     * Jumlah ekor setiap titik terkunci pada ekor per sampel sesi (T10), jadi tidak ada titik yang berbeda.
     */
    public function test_every_point_uses_the_head_count_per_sample(): void
    {
        $komponen = $this->tambahPada('2026-09-15')
            ->set('ekor.campuran', 16)
            ->assertSeeHtml('title="Mengikuti ekor per sampel"')
            ->assertDontSeeHtml('wire:model.blur="ekorTitik.');
        $this->isiCampuran($komponen, 1600, 1600);

        // Nilai titik yang dikirim sendiri tetap diganti ekor per sampel saat disimpan.
        $komponen->set('ekorTitik.bawah.campuran.A.1', 5)->call('simpan')->assertHasNoErrors();

        $sesi = SesiSampling::whereDate('tanggal', '2026-09-15')->with('titik')->firstOrFail();
        $this->assertSame([16], $sesi->titik->pluck('ekor')->unique()->values()->all());
        $this->assertSame(384, $sesi->titik->sum('ekor'));
        $this->assertSame(100.0, $sesi->abw());
    }

    public function test_head_count_per_sample_can_be_locked_and_unlocked(): void
    {
        $komponen = $this->tambahPada('2026-09-15')
            ->assertSet('ekorTerkunci', false)
            ->set('ekor.campuran', 16)
            ->call('kunciEkor')
            ->assertHasNoErrors()
            ->assertSet('ekorTerkunci', true)
            ->assertSeeHtml('aria-label="Buka kunci ekor per sampel"');

        // Selama terkunci, perubahan yang terkirim dikembalikan.
        $komponen->set('ekor.campuran', 30)->assertSet('ekor.campuran', 16);
        $this->assertSame(16, $komponen->instance()->ekorTitik['atas']['campuran']['O'][2]);

        $komponen->call('bukaKunciEkor')
            ->assertSet('ekorTerkunci', false)
            ->set('ekor.campuran', 30)
            ->assertSet('ekor.campuran', 30);
    }

    public function test_an_empty_head_count_cannot_be_locked_and_a_saved_session_opens_locked(): void
    {
        $this->tambahPada('2026-09-15')
            ->set('ekor.campuran', '')
            ->call('kunciEkor')
            ->assertHasErrors(['ekor.campuran' => 'required'])
            ->assertSet('ekorTerkunci', false);

        $this->ubahSesi('2026-09-12')
            ->assertSet('ekorTerkunci', true)
            ->call('pilihJenis', true)
            ->assertSet('ekorTerkunci', false);
    }

    public function test_head_count_per_sample_is_required(): void
    {
        $komponen = $this->tambahPada('2026-09-15')->set('ekor.campuran', '');
        $this->isiCampuran($komponen, 1600, 1600);

        $komponen->call('simpan')->assertHasErrors(['ekor.campuran' => 'required']);
        $this->assertDatabaseMissing('sesi_samplings', ['umur' => 4]);
    }

    public function test_the_default_head_count_applies_to_every_point(): void
    {
        $komponen = $this->tambahPada('2026-09-15')->set('ekor.campuran', 16);
        $titik = $komponen->instance()->ekorTitik;

        $this->assertSame(16, $titik['bawah']['campuran']['A'][1]);
        $this->assertSame(16, $titik['atas']['campuran']['O'][2]);
    }

    /**
     * ABW sesi menjadi ABW aktual recording harian tanggal itu tanpa membuat baris recording (FR-403).
     */
    public function test_a_saved_session_becomes_the_recording_body_weight_without_creating_a_recording(): void
    {
        $jumlahRecording = Recording::count();
        $komponen = $this->tambahPada('2026-09-15');
        $this->isiCampuran($komponen, 2400, 2600);

        $komponen->call('simpan')->assertHasNoErrors()->assertSee('ABW 125,0 g menjadi ABW aktual recording harian tanggal itu.');

        $this->assertSame($jumlahRecording, Recording::count());
        $this->assertSame(125.0, $this->abwRecording(4));
    }

    public function test_the_session_body_weight_takes_precedence_over_the_typed_recording_value(): void
    {
        $komponen = $this->tambahPada('2026-10-02')->assertSet('sesiId', null);

        foreach (config('sampling.lantai') as $lantai => $info) {
            foreach (['jantan', 'betina'] as $kelamin) {
                foreach ($info['line'] as $line) {
                    $komponen->set("berat.{$lantai}.{$kelamin}.{$line}.1", 700)->set("berat.{$lantai}.{$kelamin}.{$line}.2", 720);
                }
            }
        }

        $komponen->call('simpan')->assertHasNoErrors();

        $this->assertSame(71.0, $this->abwRecording(21));
    }

    /**
     * Tanggal yang sudah punya sesi tidak dapat dipakai untuk sampling baru; sesi itu tidak tertimpa diam-diam.
     */
    public function test_adding_a_session_on_a_date_that_already_has_one_is_refused(): void
    {
        $sesi = SesiSampling::whereDate('tanggal', '2026-09-12')->with('titik')->firstOrFail();
        $komponen = $this->tambahPada('2026-09-12')
            ->assertHasErrors('tanggal')
            ->assertSee('Kandang 2 sudah punya sampling 12 September 2026');
        $this->isiCampuran($komponen, 2400, 2600);

        $komponen->call('simpan')->assertHasErrors('tanggal');

        $this->assertSame($sesi->abw(), $sesi->fresh('titik')->abw());
        $this->assertSame(0, Aktivitas::where('modul', ModulAktivitas::SamplingBobot)->count());
    }

    public function test_editing_a_session_keeps_its_date(): void
    {
        $sesi = SesiSampling::whereDate('tanggal', '2026-09-12')->firstOrFail();

        $this->ubahSesi('2026-09-12')
            ->assertSet('sesiId', $sesi->id)
            ->set('tanggal', '2026-09-15')
            ->assertSet('tanggal', '2026-09-12')
            ->assertDontSeeHtml('id="sampling-tanggal"');
    }

    public function test_a_session_can_be_deleted_with_the_recording_it_created_automatically(): void
    {
        $sesi = SesiSampling::whereDate('tanggal', '2026-09-12')->firstOrFail();
        $otomatis = Recording::create([
            'periode_kandang_id' => $sesi->periode_kandang_id,
            'tanggal' => '2026-09-12',
            'umur' => 1,
            'mati' => 0,
            'afkir' => 0,
            'bobot_rata_gram' => 71.7,
            'catatan' => 'ABW dari sampling bobot; kematian dan afkir belum dicatat.',
        ]);

        $this->komponen()
            ->call('mintaHapus', $sesi->id)
            ->assertSet('labelHapus', 'Kandang 2 12 September 2026 (usia 1 hari)')
            ->call('hapus')
            ->assertHasNoErrors()
            ->assertSee('Sampling Kandang 2 12 September 2026 (usia 1 hari) dihapus.');

        $this->assertModelMissing($sesi);
        $this->assertModelMissing($otomatis);
        $this->assertSame(1, Aktivitas::where(['modul' => ModulAktivitas::SamplingBobot, 'jenis' => JenisAktivitas::Hapus])->count());
    }

    public function test_sessions_of_a_closed_period_cannot_be_deleted(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
        $kandang = $periode->kandangPeriode()->firstOrFail();
        $sesi = SesiSampling::factory()->create(['periode_kandang_id' => $kandang->id, 'tanggal' => '2026-07-20', 'umur' => 5]);

        Livewire::withQueryParams(['periode' => $periode->id, 'kandang' => $kandang->id])
            ->test(SamplingBobot::class)
            ->assertDontSeeHtml('data-bs-target="#modal-form-sampling"')
            ->call('mintaHapus', $sesi->id)
            ->call('hapus')
            ->assertForbidden();

        $this->assertModelExists($sesi);
    }

    /**
     * Jarak antar sesi lebih dari satu hari, maka DG dinormalkan per hari (FR-405).
     */
    public function test_daily_gain_is_normalized_when_the_previous_session_is_more_than_a_day_old(): void
    {
        $komponen = $this->tambahPada('2026-09-15');
        $this->isiCampuran($komponen, 2400, 2600);

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

        $komponen = Livewire::withQueryParams(['periode' => $periode->id, 'kandang' => $kandang->first()->id])
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

        $komponen = Livewire::withQueryParams(['periode' => $periode->id, 'kandang' => $kandang->first()->id])
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
     * Ikon Lihat pada ringkasan memilih kandang itu dan menampilkan sesi terakhirnya, tanpa menyentuh form.
     */
    public function test_the_summary_shows_the_latest_session_of_a_house(): void
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

        $komponen = Livewire::withQueryParams(['periode' => $periode->id, 'kandang' => $kandang->first()->id])
            ->test(SamplingBobot::class)
            ->call('lihatTerakhir', $kandang->last()->id);

        $komponen->assertSet('periodeKandangId', $kandang->last()->id);
        $komponen->assertSet('sesiDilihatId', $sesi->id);
        $komponen->assertSet('sesiId', null);
    }

    /**
     * Halaman sampling dengan Kandang 2 September terpilih.
     */
    private function komponen(): Testable
    {
        $kandangDua = PeriodeKandang::whereRelation('periode', 'nama', 'Periode September 2026')->firstOrFail();

        return Livewire::withQueryParams(['periode' => $kandangDua->periode_id, 'kandang' => $kandangDua->id])
            ->test(SamplingBobot::class);
    }

    /**
     * Tombol "Tambah sampling", lalu tanggal dipilih di form.
     */
    private function tambahPada(string $tanggal): Testable
    {
        return $this->komponen()->call('tambah')->set('tanggal', $tanggal);
    }

    /**
     * Ikon Ubah pada riwayat untuk sesi tanggal itu.
     */
    private function ubahSesi(string $tanggal): Testable
    {
        $sesi = SesiSampling::whereDate('tanggal', $tanggal)
            ->whereRelation('periodeKandang.periode', 'nama', 'Periode September 2026')
            ->firstOrFail();

        return $this->komponen()->call('ubah', $sesi->id);
    }

    private function isiCampuran(Testable $komponen, int $sampelSatu, int $sampelDua): void
    {
        foreach (config('sampling.lantai') as $lantai => $info) {
            foreach ($info['line'] as $line) {
                $komponen->set("berat.{$lantai}.campuran.{$line}.1", $sampelSatu)->set("berat.{$lantai}.campuran.{$line}.2", $sampelDua);
            }
        }
    }

    /**
     * ABW aktual di lembar recording Kandang 2 September pada umur itu.
     */
    private function abwRecording(int $umur): ?float
    {
        $kandangDua = PeriodeKandang::whereRelation('periode', 'nama', 'Periode September 2026')->firstOrFail();

        return collect(LembarRecording::baris($kandangDua))->firstWhere('umur', $umur)['abw'] ?? null;
    }
}
