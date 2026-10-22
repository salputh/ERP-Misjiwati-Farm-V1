<?php

namespace Tests\Feature;

use App\Livewire\FormLaporanHarian;
use App\Livewire\FormLaporanHarianModal;
use App\Livewire\LaporanHarian;
use App\Models\JenisPakan;
use App\Models\Kandang;
use App\Models\PemberianPakan;
use App\Models\PenerimaanPakan;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use App\Models\Recording;
use App\Support\IsianLaporanHarian;
use App\Support\LembarLaporanHarian;
use App\Support\RingkasanHarian;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Livewire\Features\SupportTesting\Testable;
use Livewire\Livewire;
use Tests\TestCase;

class FormLaporanHarianTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-10-05 08:00:00');
        $this->seed(DatabaseSeeder::class);
    }

    public function test_new_report_starts_on_the_day_after_the_last_report(): void
    {
        $this->form('Periode September 2026')
            ->assertSet('tanggal', '2026-10-03')
            ->assertSee('Laporan baru')
            ->assertSee('22 hari')
            ->assertSee('sisa 24.998 dari 26.000 ekor')
            ->assertSet('isian.'.$this->kunciKandang('Periode September 2026', 'Kandang 2').'.mati', '')
            ->assertDontSee('Hapus laporan');
    }

    public function test_inline_report_modal_starts_on_the_next_unreported_day(): void
    {
        $september = $this->periode('Periode September 2026');

        Livewire::withQueryParams(['periode' => $september->id, 'tanggal' => '2026-10-01'])
            ->test(FormLaporanHarianModal::class, ['periodeId' => $september->id])
            ->assertSet('tanggal', '2026-10-03')
            ->assertSee('Laporan baru')
            ->assertSeeHtml('id="modal-form-laporan-harian"');
    }

    public function test_saving_a_new_report_stores_recording_feed_use_and_feed_received(): void
    {
        $september = $this->periode('Periode September 2026');
        $kandang = $this->kunciKandang('Periode September 2026', 'Kandang 2');
        $sb12 = JenisPakan::where('kode', 'SB-12')->firstOrFail();

        $this->form('Periode September 2026')
            ->set("isian.{$kandang}.mati", '7')
            ->set("isian.{$kandang}.afkir", '2')
            ->set("isian.{$kandang}.abw", '1362.5')
            ->set("isian.{$kandang}.pakan.j{$sb12->id}", '62')
            ->set("isian.{$kandang}.catatan", 'Litter basah di sisi timur')
            ->set("masuk.j{$sb12->id}", '120')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertRedirect(route('laporan.harian', ['periode' => $september->id, 'tanggal' => '2026-10-03']));

        $rekaman = Recording::whereDate('tanggal', '2026-10-03')->sole();
        $this->assertSame([22, 7, 2, 1362.5, 'Litter basah di sisi timur'], [$rekaman->umur, $rekaman->mati, $rekaman->afkir, $rekaman->bobot_rata_gram, $rekaman->catatan]);

        $pemberian = PemberianPakan::whereDate('tanggal', '2026-10-03')->sole();
        $this->assertSame([$sb12->id, 22, 62.0], [$pemberian->jenis_pakan_id, $pemberian->umur, $pemberian->zak]);
        $this->assertSame(120.0, PenerimaanPakan::whereDate('tanggal', '2026-10-03')->sole()->zak);

        // Laporan harian tanggal itu langsung memakai data baru: 1.002 + 9 kematian kumulatif.
        $laporan = RingkasanHarian::buat($this->periodeTermuat('Periode September 2026'), Carbon::parse('2026-10-03'));
        $this->assertSame([9, 1011, 24989], [$laporan['total']['mati_hari_ini'], $laporan['total']['mati_kumulatif'], $laporan['total']['sisa']]);

        $this->get(route('laporan.harian', ['periode' => $september->id, 'tanggal' => '2026-10-03']))
            ->assertOk()
            ->assertSee('Laporan harian 3 Oktober 2026 tersimpan.')
            ->assertSee('Litter basah di sisi timur');
    }

    public function test_editing_loads_saved_values_and_replaces_them(): void
    {
        $kandang = $this->kunciKandang('Periode September 2026', 'Kandang 2');
        $sb11 = JenisPakan::where('kode', 'SB-11')->firstOrFail();
        $sb12 = JenisPakan::where('kode', 'SB-12')->firstOrFail();

        $this->form('Periode September 2026', '2026-10-02')
            ->assertSee('Mengubah laporan tersimpan')
            ->assertSee('sisa 25.003 dari 26.000 ekor')
            ->assertSet("isian.{$kandang}.mati", '5')
            ->assertSet("isian.{$kandang}.afkir", '0')
            ->assertSet("isian.{$kandang}.abw", '1269')
            ->assertSet("isian.{$kandang}.pakan.j{$sb11->id}", '60')
            ->assertSet("masuk.j{$sb12->id}", '160')
            ->set("isian.{$kandang}.mati", '8')
            ->set("isian.{$kandang}.pakan.j{$sb11->id}", '40')
            ->set("isian.{$kandang}.pakan.j{$sb12->id}", '22.5')
            ->set("masuk.j{$sb12->id}", '')
            ->call('simpan')
            ->assertHasNoErrors();

        $this->assertSame(8, Recording::whereDate('tanggal', '2026-10-02')->sole()->mati);
        $this->assertSame([$sb11->id => 40.0, $sb12->id => 22.5], PemberianPakan::whereDate('tanggal', '2026-10-02')->pluck('zak', 'jenis_pakan_id')->all());
        $this->assertSame(0, PenerimaanPakan::whereDate('tanggal', '2026-10-02')->count());
        $this->assertSame(1, Recording::whereDate('tanggal', '2026-10-02')->count());
    }

    public function test_feed_without_a_recorded_type_keeps_its_own_field(): void
    {
        $this->periode('Periode Juli 2026')->update(['status' => 'berjalan']);
        $satu = $this->kunciKandang('Periode Juli 2026', 'Kandang 1');
        $dua = $this->kunciKandang('Periode Juli 2026', 'Kandang 2');

        $this->form('Periode Juli 2026', '2026-07-20')
            ->assertSee('Kandang 1, Kandang 2')
            ->assertSee('Jenis belum dicatat (zak)')
            ->assertSet("isian.{$satu}.mati", '17')
            ->assertSet("isian.{$satu}.abw", '145')
            ->assertSet("isian.{$satu}.pakan.tanpa", '10')
            ->assertSet("isian.{$dua}.pakan.tanpa", '15')
            ->set("isian.{$satu}.pakan.tanpa", '12')
            ->call('simpan')
            ->assertHasNoErrors();

        $pemberian = PemberianPakan::whereDate('tanggal', '2026-07-20')->orderBy('periode_kandang_id')->get();
        $this->assertSame([[null, 12.0], [null, 15.0]], $pemberian->map(fn (PemberianPakan $satu): array => [$satu->jenis_pakan_id, $satu->zak])->all());
        $this->assertSame(2, Recording::whereDate('tanggal', '2026-07-20')->count());
    }

    public function test_changing_the_date_loads_that_date_and_invalid_dates_fall_back(): void
    {
        $kandang = $this->kunciKandang('Periode September 2026', 'Kandang 2');

        $this->form('Periode September 2026', '2026-10-02')
            ->set('tanggal', '2026-10-04')
            ->assertSee('Laporan baru')
            ->assertSet("isian.{$kandang}.mati", '')
            ->set('tanggal', '2026-10-02')
            ->assertSet("isian.{$kandang}.mati", '5')
            // Sebelum chick-in, sesudah hari ini, atau bukan tanggal: kembali ke tanggal laporan baru.
            ->set('tanggal', '2026-09-01')
            ->assertSet('tanggal', '2026-10-03')
            ->set('tanggal', '2026-10-06')
            ->assertSet('tanggal', '2026-10-03')
            ->set('tanggal', 'besok')
            ->assertSet('tanggal', '2026-10-03');
    }

    public function test_invalid_input_is_rejected_with_messages(): void
    {
        $kandang = $this->kunciKandang('Periode September 2026', 'Kandang 2');
        $sb12 = JenisPakan::where('kode', 'SB-12')->firstOrFail();

        $this->form('Periode September 2026')
            ->call('simpan')
            ->assertHasErrors('kosong')
            ->assertSee('Isi sedikitnya satu data sebelum menyimpan.')
            ->set("isian.{$kandang}.mati", '2.5')
            ->set("isian.{$kandang}.abw", '0')
            ->set("isian.{$kandang}.pakan.j{$sb12->id}", '-3')
            ->set("masuk.j{$sb12->id}", 'banyak')
            ->call('simpan')
            ->assertHasErrors(["isian.{$kandang}.mati", "isian.{$kandang}.abw", "isian.{$kandang}.pakan.j{$sb12->id}", "masuk.j{$sb12->id}"])
            ->assertSee('Kematian harus angka bulat.')
            ->assertSee('ABW paling sedikit 1.')
            ->assertSee('Pakan masuk SB-12 harus angka.')
            ->assertNoRedirect();

        $this->assertSame(0, Recording::whereDate('tanggal', '2026-10-03')->count());
    }

    public function test_deaths_cannot_use_up_the_remaining_birds(): void
    {
        $kandang = $this->kunciKandang('Periode September 2026', 'Kandang 2');

        $this->form('Periode September 2026')
            ->set("isian.{$kandang}.mati", '24000')
            ->set("isian.{$kandang}.afkir", '998')
            ->call('simpan')
            ->assertHasErrors("isian.{$kandang}.mati")
            ->assertSee('Kematian dan afkir harus kurang dari sisa ayam (24.998 ekor).')
            ->set("isian.{$kandang}.afkir", '997')
            ->call('simpan')
            ->assertHasNoErrors();
    }

    public function test_report_can_be_deleted_from_the_form_after_confirmation(): void
    {
        $september = $this->periode('Periode September 2026');

        $this->form('Periode September 2026', '2026-10-02')
            ->assertSee('Hapus laporan')
            // Tombol hapus hanya membuka modal konfirmasi; aksi hapus ada di tombol setuju modal itu.
            ->assertSeeHtml('data-bs-target="#konfirmasi-hapus-laporan"')
            ->assertSee('Hapus laporan harian 2 Oktober 2026?')
            ->assertSee('Ya, hapus')
            ->call('hapus')
            ->assertRedirect(route('laporan.harian', ['periode' => $september->id]));

        $this->assertSame(0, Recording::whereDate('tanggal', '2026-10-02')->count());
        $this->assertSame(0, PemberianPakan::whereDate('tanggal', '2026-10-02')->count());
        $this->assertSame(0, PenerimaanPakan::whereDate('tanggal', '2026-10-02')->count());
        $this->assertSame(1, Recording::whereDate('tanggal', '2026-10-01')->count());
    }

    public function test_list_summarises_every_reported_date_newest_first(): void
    {
        $daftar = IsianLaporanHarian::daftar($this->periodeTermuat('Periode September 2026'));

        $this->assertSame('2026-10-02', $daftar[0]['tanggal']->toDateString());
        $this->assertSame(['umur' => 21, 'kematian' => 5, 'pakan_terpakai' => 60.0, 'pakan_masuk' => 160.0, 'abw' => 1269.0], collect($daftar[0])->except('tanggal')->all());

        // 28 September: pakan masuk 140 + 20 zak dan pakan terpakai, tetapi kematian belum dicatat.
        $akhirSeptember = collect($daftar)->first(fn (array $baris): bool => $baris['tanggal']->toDateString() === '2026-09-28');
        $this->assertSame([null, 160.0, null], [$akhirSeptember['kematian'], $akhirSeptember['pakan_masuk'], $akhirSeptember['abw']]);

        $tanggal = array_map(fn (array $baris): string => $baris['tanggal']->toDateString(), $daftar);
        $urut = $tanggal;
        rsort($urut);
        $this->assertSame($urut, $tanggal);
        $this->assertSame('2026-09-08', end($tanggal));

        // Periode Juli: dua kandang dijumlahkan, ABW dirata-rata.
        $juli = collect(IsianLaporanHarian::daftar($this->periodeTermuat('Periode Juli 2026')))->first(fn (array $baris): bool => $baris['tanggal']->toDateString() === '2026-07-20');
        $this->assertSame([5, 40, 25.0, 0.0, 150.5], [$juli['umur'], $juli['kematian'], $juli['pakan_terpakai'], $juli['pakan_masuk'], $juli['abw']]);
    }

    public function test_report_page_lists_reports_with_view_edit_and_delete_actions(): void
    {
        $september = $this->periode('Periode September 2026');

        $this->get(route('laporan.harian', ['periode' => $september->id]))
            ->assertOk()
            ->assertSee('Daftar laporan harian')
            ->assertSee('Tambah laporan')
            ->assertSee('Ubah laporan ini')
            ->assertSeeHtml('data-bs-target="#modal-form-laporan-harian"')
            ->assertSeeHtml('id="modal-form-laporan-harian"')
            ->assertSee(e(route('laporan.harian.form', ['periode' => $september->id, 'tanggal' => '2026-10-01'])), false)
            ->assertSee(e(route('laporan.harian', ['periode' => $september->id, 'tanggal' => '2026-10-01'])), false)
            ->assertSee('Hapus laporan 1 Oktober 2026');
    }

    public function test_report_can_be_deleted_from_the_list_after_confirmation(): void
    {
        $september = $this->periode('Periode September 2026');

        Livewire::withQueryParams(['periode' => $september->id, 'tanggal' => '2026-10-02'])
            ->test(LaporanHarian::class)
            ->call('hapus')
            ->assertDontSee('Laporan harian 2 Oktober 2026 dihapus.')
            ->call('mintaHapus', '2026-12-31')
            ->assertSet('tanggalDihapus', null)
            ->assertSeeHtml('data-bs-target="#konfirmasi-hapus-laporan"')
            ->assertSee('Hapus laporan harian ?')
            ->call('mintaHapus', '2026-10-01')
            ->assertSee('Hapus laporan harian 1 Oktober 2026?')
            ->call('mintaHapus', '2026-10-02')
            ->assertSet('tanggalDihapus', '2026-10-02')
            ->assertSee('Hapus laporan harian 2 Oktober 2026?')
            ->call('hapus')
            ->assertSet('tanggalDihapus', null)
            ->assertSet('tanggal', null)
            ->assertSet('pesan', 'Laporan harian 2 Oktober 2026 dihapus.')
            ->assertSee('Laporan harian 2 Oktober 2026 dihapus.')
            // Laporan kembali ke tanggal terakhir yang masih ada.
            ->assertSee('Kamis, 1 Oktober 2026')
            ->assertDontSee('Hapus laporan 2 Oktober 2026');

        $this->assertSame(0, Recording::whereDate('tanggal', '2026-10-02')->count());
        $this->assertSame(0, PenerimaanPakan::whereDate('tanggal', '2026-10-02')->count());
    }

    public function test_selected_reports_can_be_deleted_together_after_confirmation(): void
    {
        $september = $this->periode('Periode September 2026');

        Livewire::withQueryParams(['periode' => $september->id, 'tanggal' => '2026-10-02'])
            ->test(LaporanHarian::class)
            ->assertSee('Pilih semua laporan harian')
            ->assertSee('Hapus terpilih')
            ->set('tanggalTerpilih', ['2026-10-01', '2026-10-02'])
            ->assertSee('2 laporan dipilih')
            ->call('mintaHapusTerpilih')
            ->assertSet('tanggalHapusTerpilih', ['2026-10-01', '2026-10-02'])
            ->assertSee('Hapus laporan terpilih?')
            ->assertSee('2 laporan harian beserta catatan terkait akan dihapus.')
            ->call('hapusTerpilih')
            ->assertHasNoErrors()
            ->assertSet('tanggalTerpilih', [])
            ->assertSet('tanggalHapusTerpilih', [])
            ->assertSet('tanggal', null)
            ->assertSee('2 laporan harian berhasil dihapus.')
            ->assertSee('Sel, 29 Sep 2026')
            ->assertDontSee('1 Oktober 2026')
            ->assertDontSee('2 Oktober 2026');

        foreach (['2026-10-01', '2026-10-02'] as $tanggal) {
            $this->assertSame(0, Recording::whereDate('tanggal', $tanggal)->count());
            $this->assertSame(0, PemberianPakan::whereDate('tanggal', $tanggal)->count());
            $this->assertSame(0, PenerimaanPakan::whereDate('tanggal', $tanggal)->count());
        }

        $this->assertContains(
            '2026-09-29',
            array_map(
                fn (array $baris): string => $baris['tanggal']->format('Y-m-d'),
                IsianLaporanHarian::daftar($this->periodeTermuat('Periode September 2026')),
            ),
        );
    }

    public function test_select_all_toggles_only_the_current_period_report_dates(): void
    {
        $september = $this->periode('Periode September 2026');
        $jumlahTanggal = count(IsianLaporanHarian::daftar($this->periodeTermuat('Periode September 2026')));

        Livewire::withQueryParams(['periode' => $september->id])
            ->test(LaporanHarian::class)
            ->call('pilihSemua')
            ->assertSet(
                'tanggalTerpilih',
                array_map(
                    fn (array $baris): string => $baris['tanggal']->format('Y-m-d'),
                    IsianLaporanHarian::daftar($this->periodeTermuat('Periode September 2026')),
                ),
            )
            ->call('pilihSemua')
            ->assertSet('tanggalTerpilih', []);
    }

    public function test_bulk_delete_ignores_dates_outside_the_selected_period(): void
    {
        $september = $this->periode('Periode September 2026');

        Livewire::withQueryParams(['periode' => $september->id])
            ->test(LaporanHarian::class)
            ->set('tanggalTerpilih', ['2026-08-08'])
            ->call('mintaHapusTerpilih')
            ->assertSet('tanggalHapusTerpilih', [])
            ->assertHasErrors(['tanggalTerpilih'])
            ->call('hapusTerpilih')
            ->assertHasErrors(['tanggalTerpilih']);

        $this->assertGreaterThan(0, Recording::whereDate('tanggal', '2026-08-08')->count());
    }

    public function test_changing_a_saved_report_asks_for_confirmation_but_a_new_report_saves_directly(): void
    {
        // Laporan baru: tombol simpan langsung menjalankan aksi, tanpa modal konfirmasi.
        $this->form('Periode September 2026')
            ->assertSeeHtml('wire:key="tombol-simpan-baru" wire:click="simpan"')
            ->assertDontSeeHtml('id="konfirmasi-simpan-laporan"')
            ->assertDontSeeHtml('id="konfirmasi-hapus-laporan"');

        // Laporan tersimpan: tombol simpan dan hapus hanya membuka modal; aksinya ada di tombol setuju.
        $this->form('Periode September 2026', '2026-10-02')
            ->assertSeeHtml('wire:key="tombol-simpan-perubahan" data-bs-toggle="modal" data-bs-target="#konfirmasi-simpan-laporan"')
            ->assertDontSeeHtml('wire:key="tombol-simpan-baru"')
            ->assertSeeHtml('id="konfirmasi-simpan-laporan"')
            ->assertSee('Simpan perubahan laporan 2 Oktober 2026?')
            ->assertSee('Ya, simpan')
            ->assertSeeHtml('id="konfirmasi-hapus-laporan"')
            // Mengganti tanggal ke hari tanpa laporan menghilangkan konfirmasi lagi.
            ->set('tanggal', '2026-10-04')
            ->assertDontSeeHtml('id="konfirmasi-simpan-laporan"')
            ->assertSeeHtml('wire:key="tombol-simpan-baru"');
    }

    public function test_report_sheet_holds_ready_to_show_text_for_the_modal_and_the_png(): void
    {
        $lembar = $this->lembar('Periode September 2026', '2026-10-02');

        $this->assertSame(['laporan-harian-periode-september-2026-2026-10-02', '2026-10-02', '2 Oktober 2026'], [$lembar['berkas'], $lembar['tanggal'], $lembar['judul']]);
        $this->assertSame(['Peternak' => 'Misjiwati', 'Periode' => 'Periode September 2026', 'Kandang' => 'Kandang 2', 'Jumlah ayam' => '26.000 ekor', 'Tanggal laporan' => 'Jumat, 2 Oktober 2026', 'Usia' => '21 hari'], array_column($lembar['info'], 'nilai', 'label'));
        $this->assertSame(['Sisa ayam di kandang' => '24.998', 'Kematian hari ini' => '5', 'ABW' => '1.269 g', 'FCR' => '1,066'], array_column($lembar['utama'], 'nilai', 'label'));
        $this->assertSame(['dari 26.000 ekor chick-in, dikurangi 0 ekor panen', 'kumulatif 1.002 ekor (3,85%)', 'dari standar 1.069 g', 'standar 1,271'], array_column($lembar['utama'], 'catatan'));
        $this->assertSame(['teks' => '18,7%', 'naik' => true], $lembar['utama'][2]['selisih']);

        $this->assertCount(12, $lembar['pakan_masuk']['baris']);
        $this->assertSame(['tanggal' => '2 Oktober 2026', 'jenis' => 'SB-12', 'zak' => '160'], $lembar['pakan_masuk']['baris'][11]);
        $this->assertSame('1.100 zak', $lembar['pakan_masuk']['total']);
        $this->assertSame(['jenis' => 'SB-11', 'masuk' => '572', 'terpakai_hari_ini' => '60', 'terpakai' => '543', 'sisa' => '29', 'sisa_kurang' => false], $lembar['opname']['baris'][1]);
        $this->assertSame(['masuk' => '1.100', 'terpakai_hari_ini' => '60', 'terpakai' => '699', 'sisa' => '401', 'sisa_kurang' => false], $lembar['opname']['total']);
        $this->assertSame('Sisa stok cukup sekitar 6,7 hari dengan pemakaian hari ini', $lembar['opname']['catatan']);

        $this->assertNull($lembar['kandang']['total']);
        $this->assertSame([
            'nama' => 'Kandang 2', 'populasi' => '26.000 ekor chick-in', 'mati_hari_ini' => '5', 'mati_kumulatif' => '1.002', 'mortalitas' => '3,85%',
            'sisa' => '24.998', 'abw' => '1.269 g', 'abw_selisih' => ['teks' => '18,7%', 'naik' => true], 'fcr' => '1,066', 'fcr_standar' => 'standar 1,271',
        ], $lembar['kandang']['baris'][0]);
        $this->assertSame(['Kandang 2, 1 Oktober 2026: Akumulasi kematian hari 0 sampai 20. Rincian per hari belum dicatat.'], $lembar['catatan']);
    }

    public function test_closed_period_rejects_daily_report_mutations(): void
    {
        $periode = Periode::query()->where('nama', 'Periode September 2026')->firstOrFail();
        $periode->update(['status' => 'tutup_rhpp']);

        Livewire::withQueryParams(['periode' => $periode->id])
            ->test(FormLaporanHarian::class)
            ->call('simpan')
            ->assertStatus(403);
    }

    public function test_report_sheet_totals_several_houses_and_marks_uncounted_stock(): void
    {
        $lembar = $this->lembar('Periode Juli 2026', '2026-07-20');

        $this->assertSame('Kandang 1, Kandang 2', $lembar['info'][2]['nilai']);
        $this->assertSame(['rata-rata tertimbang jumlah ayam', 'pakan per ekor dibagi ABW'], [$lembar['utama'][2]['catatan'], $lembar['utama'][3]['catatan']]);
        $this->assertNull($lembar['utama'][2]['selisih']);
        $this->assertSame([], $lembar['pakan_masuk']['baris']);
        $this->assertSame(['jenis' => 'Jenis belum dicatat', 'masuk' => '-', 'terpakai_hari_ini' => '25', 'terpakai' => '98', 'sisa' => '-', 'sisa_kurang' => false], $lembar['opname']['baris'][0]);
        $this->assertNull($lembar['opname']['catatan']);
        $this->assertSame(['Kandang 1', 'Kandang 2'], array_column($lembar['kandang']['baris'], 'nama'));
        $this->assertSame(['mati_hari_ini' => '40', 'mati_kumulatif' => '412 (0,92%)', 'sisa' => '44.588', 'abw' => '151 g', 'fcr' => '0,726'], $lembar['kandang']['total']);
        $this->assertSame([], $lembar['catatan']);
    }

    public function test_view_action_opens_the_chosen_report_in_a_modal_with_png_buttons(): void
    {
        $september = $this->periode('Periode September 2026');

        Livewire::withQueryParams(['periode' => $september->id])
            ->test(LaporanHarian::class)
            ->assertSeeHtml('id="modal-laporan-harian"')
            ->assertSeeHtml('data-bs-target="#modal-laporan-harian"')
            ->assertSeeHtml('wire:click.prevent="buka(\'2026-10-01\')"')
            ->assertDontSee('Laporan harian 1 Oktober 2026')
            ->call('buka', '2026-12-31')
            ->assertSet('tanggalDilihat', null)
            ->call('buka', '2026-10-01')
            ->assertSet('tanggalDilihat', '2026-10-01')
            ->assertSee('Laporan harian 1 Oktober 2026')
            ->assertSee('Kamis, 1 Oktober 2026')
            ->assertSee('kumulatif 997 ekor (3,83%)')
            ->assertSee('Sisa stok cukup sekitar 5,2 hari dengan pemakaian hari ini')
            ->assertSeeHtml('laporan-harian-periode-september-2026-2026-10-01')
            ->assertSeeHtml(e(route('laporan.harian.form', ['periode' => $september->id, 'tanggal' => '2026-10-01'])))
            // Laporan di halaman tetap tanggal terakhir.
            ->assertSet('tanggal', null)
            ->assertSee('Jumat, 2 Oktober 2026');
    }

    public function test_report_page_offers_png_download_and_copy_for_the_shown_report(): void
    {
        $september = $this->periode('Periode September 2026');

        $this->get(route('laporan.harian', ['periode' => $september->id, 'tanggal' => '2026-09-28']))
            ->assertOk()
            ->assertSee('Simpan PNG')
            ->assertSee('Salin PNG')
            ->assertSee('x-data="eksporLaporan"', false)
            ->assertSee('laporan-harian-periode-september-2026-2026-09-28', false);
    }

    public function test_form_pages_open_for_every_period_and_without_data(): void
    {
        $this->get(route('laporan.harian.form'))
            ->assertOk()
            ->assertSee('Form laporan harian')
            ->assertSee('Simpan laporan')
            ->assertSeeHtml('data-bs-target="#modal-form-laporan-harian"')
            ->assertSeeHtml('id="modal-form-laporan-harian"');
        $this->get(route('laporan.harian.form', ['periode' => $this->periode('Periode Juli 2026')->id, 'tanggal' => '2026-07-20']))->assertOk()->assertSee('Simpan perubahan');

        // Periode selesai: laporan baru dibatasi umur terakhir di standar strain, bukan hari ini.
        $this->form('Periode Juli 2026')->assertSet('tanggal', '2026-08-09');

        PeriodeKandang::query()->delete();
        $this->get(route('laporan.harian.form'))->assertOk()->assertSee('Periode ini belum punya kandang');

        Periode::query()->delete();
        $this->get(route('laporan.harian.form'))->assertOk()->assertSee('Belum ada periode');
        $this->get(route('laporan.harian'))->assertOk()->assertSee('Belum ada data untuk dilaporkan')->assertDontSee('Tambah laporan');
    }

    private function form(string $periode, ?string $tanggal = null): Testable
    {
        return Livewire::withQueryParams(array_filter(['periode' => $this->periode($periode)->id, 'tanggal' => $tanggal]))->test(FormLaporanHarian::class);
    }

    /**
     * @return array<string, mixed>
     */
    private function lembar(string $periode, string $tanggal): array
    {
        $termuat = $this->periodeTermuat($periode);

        return LembarLaporanHarian::buat($termuat, RingkasanHarian::buat($termuat, Carbon::parse($tanggal)));
    }

    private function periode(string $nama): Periode
    {
        return Periode::where('nama', $nama)->firstOrFail();
    }

    private function periodeTermuat(string $nama): Periode
    {
        return $this->periode($nama)->load(['kandangPeriode.kandang', 'kandangPeriode.recordings', 'kandangPeriode.pemberianPakan.jenisPakan', 'penerimaanPakan.jenisPakan']);
    }

    private function kunciKandang(string $periode, string $kandang): string
    {
        return 'k'.PeriodeKandang::where(['periode_id' => $this->periode($periode)->id, 'kandang_id' => Kandang::where('nama', $kandang)->firstOrFail()->id])->firstOrFail()->id;
    }
}
