<?php

namespace Tests\Feature;

use App\Enums\Jabatan;
use App\Enums\JenisAktivitas;
use App\Enums\KategoriKas;
use App\Enums\ModulAktivitas;
use App\Enums\PeranBagiHasil;
use App\Livewire\PayrollAbk;
use App\Models\Aktivitas;
use App\Models\BagiHasil;
use App\Models\Kandang;
use App\Models\Karyawan;
use App\Models\PenerimaBagiHasil;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use App\Models\PremiAbk;
use App\Models\SlipGaji;
use App\Models\TransaksiKas;
use App\Support\LembarPayroll;
use App\Support\LembarRhpp;
use Database\Seeders\BagiHasilSeeder;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\PayrollSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class PayrollAbkTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DatabaseSeeder::class);
    }

    /**
     * Angka dari lembar "Slip Gaji ABK", periode panen 8 s/d 17 Agustus 2026.
     */
    public function test_every_slip_matches_the_original_sheet(): void
    {
        $lembar = $this->lembar();

        $this->assertSame(['Kandang 1', 'Kandang 2'], array_column($lembar['kandang'], 'nama'));
        $this->assertSame([
            'Wahyu' => [9_555_189, 1_960_000, 7_595_189],
            'Angga' => [9_175_189, 5_210_000, 3_965_189],
            'Rifi' => [9_555_189, 3_960_000, 5_595_189],
            'Mustofa' => [9_175_189, 2_860_000, 6_315_189],
        ], $this->totalPerOrang($lembar['kandang'][0]['slip']));
        $this->assertSame([
            'Frengky' => [13_729_721, 6_000_000, 7_729_721],
            'Igo' => [13_609_721, 1_960_000, 11_649_721],
            'Utama' => [13_429_721, 2_810_000, 10_619_721],
            'Rafi' => [13_409_721, 1_960_000, 11_449_721],
            'Rohim' => [6_795_000, 0, 6_795_000],
        ], $this->totalPerOrang($lembar['kandang'][1]['slip']));
    }

    public function test_abk_slip_takes_an_even_share_of_the_house_profit_sharing(): void
    {
        $frengky = $this->slip('Frengky');

        $this->assertSame(['ABK', 'Kandang 2', 56], [$frengky['jabatan'], $frengky['kandang'], $frengky['hari_kerja']]);
        $this->assertSame([
            'Pendapatan bagi hasil' => 5_868_659,
            'Bonus pasar' => 4_443_562,
            'Premi pemeliharaan' => 262_500,
            'Premi tetap' => 500_000,
            'Premi panen' => 300_000,
            'Premi pasang geomembran' => 240_000,
            'Penghasilan kotoran' => 2_115_000,
        ], array_column($frengky['pendapatan'], 'jumlah', 'label'));
        $this->assertSame([
            'gaji ABK Rp 23.474.635 ÷ 4 ABK',
            'bonus pasar ABK Rp 17.774.249 ÷ 4 ABK',
            'premi pemeliharaan ABK Rp 1.050.000 ÷ 4 ABK',
            'ketua ABK',
        ], array_slice(array_column($frengky['pendapatan'], 'rumus'), 0, 4));
        $this->assertSame(['Uang makan' => 1_960_000, 'Pinjaman ABK' => 440_000, 'Potongan lain' => 3_600_000], array_column($frengky['potongan'], 'jumlah', 'label'));
        $this->assertSame(['56 hari × Rp 35.000', null, 'Kereta dan HP'], array_column($frengky['potongan'], 'rumus'));

        // Tanpa premi tetap, barisnya tidak ditampilkan; tanpa premi pemeliharaan, rumusnya kosong.
        $wahyu = $this->slip('Wahyu');
        $this->assertSame(['Pendapatan bagi hasil', 'Bonus pasar', 'Premi pemeliharaan', 'Premi panen', 'Premi pasang geomembran', 'Penghasilan kotoran'], array_column($wahyu['pendapatan'], 'label'));
        $this->assertSame([4_108_991, 3_111_198, 0, 500_000, 420_000, 1_415_000], array_column($wahyu['pendapatan'], 'jumlah'));
        $this->assertNull($wahyu['pendapatan'][2]['rumus']);
    }

    public function test_joker_slip_uses_base_salary_instead_of_profit_sharing(): void
    {
        $rohim = $this->slip('Rohim');

        $this->assertSame(['Joker', 'Kandang 2', 30], [$rohim['jabatan'], $rohim['kandang'], $rohim['hari_kerja']]);
        $this->assertSame([
            'Gaji pokok' => 2_000_000,
            'Bonus pasar' => 0,
            'Premi pemeliharaan' => 1_960_000,
            'Premi panen' => 300_000,
            'Premi pasang geomembran' => 420_000,
            'Penghasilan kotoran' => 2_115_000,
        ], array_column($rohim['pendapatan'], 'jumlah', 'label'));
        $this->assertSame([null, null, null], array_column($rohim['potongan'], 'rumus'));
    }

    public function test_totals_add_up_per_house_and_overall(): void
    {
        $lembar = $this->lembar();

        $this->assertSame(['orang' => 4, 'pendapatan' => 37_460_756, 'potongan' => 13_990_000, 'bersih' => 23_470_756], $lembar['kandang'][0]['total']);
        $this->assertSame(['orang' => 5, 'pendapatan' => 60_973_884, 'potongan' => 12_730_000, 'bersih' => 48_243_884], $lembar['kandang'][1]['total']);
        $this->assertSame(['orang' => 9, 'pendapatan' => 98_434_640, 'potongan' => 26_720_000, 'bersih' => 71_714_640], $lembar['total']);
        $this->assertSame(['ABK' => 8, 'Joker' => 1], $lembar['jabatan']);
    }

    public function test_slip_follows_changes_in_the_profit_sharing_inputs(): void
    {
        $periodeKandang = $this->periodeKandang('Kandang 1');
        // Kandang 1 menghasilkan Rp 4.970 per ekor; baris tabel ini membuat premi pemeliharaan ABK-nya Rp 400.000.
        PremiAbk::factory()->create(['hasil_per_ekor' => 4_000, 'premi' => 400_000]);
        PenerimaBagiHasil::where(['bagi_hasil_id' => $periodeKandang->bagiHasil->id, 'nama' => 'Wahyu'])->update(['jumlah' => 250_000, 'keterangan' => 'ketua ABK']);

        $wahyu = array_column($this->slip('Wahyu')['pendapatan'], 'jumlah', 'label');

        $this->assertSame([100_000, 250_000], [$wahyu['Premi pemeliharaan'], $wahyu['Premi tetap']]);
        $this->assertSame(9_555_189 + 350_000, $this->slip('Wahyu')['total_pendapatan']);
    }

    public function test_slip_without_profit_sharing_data_still_shows_recorded_components(): void
    {
        $this->periodeKandang('Kandang 1')->bagiHasil->delete();

        $wahyu = $this->slip('Wahyu');

        // Penerima bagi hasil ikut terhapus, jadi slip kembali ke gaji pokok (nol) dan komponen yang dicatat per orang.
        $this->assertSame(['Gaji pokok' => 0, 'Bonus pasar' => 0, 'Premi pemeliharaan' => 0, 'Premi panen' => 500_000, 'Premi pasang geomembran' => 420_000, 'Penghasilan kotoran' => 1_415_000], array_column($wahyu['pendapatan'], 'jumlah', 'label'));
        $this->assertSame([2_335_000, 1_960_000, 375_000], [$wahyu['total_pendapatan'], $wahyu['total_potongan'], $wahyu['bersih']]);
    }

    public function test_seeding_twice_keeps_slips_linked_and_unduplicated(): void
    {
        $this->seed([BagiHasilSeeder::class, PayrollSeeder::class]);

        $this->assertSame(9, SlipGaji::count());
        $this->assertSame(8, SlipGaji::whereNotNull('penerima_bagi_hasil_id')->count());
        $this->assertSame(13, PenerimaBagiHasil::count());
        $this->assertSame(7_729_721, $this->slip('Frengky')['bersih']);
    }

    public function test_page_shows_the_recap_and_every_slip(): void
    {
        $response = $this->get(route('payroll.abk', ['periode' => $this->periode()->id]))
            ->assertOk()
            ->assertSee('Slip gaji ABK')
            ->assertSee('8 Agustus s/d 17 Agustus 2026')
            ->assertSee('Rp 71,7 jt')
            ->assertSee('71.714.640')
            ->assertSee('Subtotal Kandang 1')
            ->assertSee('23.470.756')
            ->assertSee('Total semua kandang')
            ->assertSee('Slip Kandang 2')
            ->assertSee('Mustofa')
            ->assertSee('6.315.189')
            ->assertSee('Rohim')
            ->assertSee('Joker')
            ->assertSee('Gaji pokok')
            ->assertSee('Kereta dan HP')
            ->assertSee('56 hari × Rp 35.000')
            ->assertSee('Pendapatan bersih diterima');

        $this->assertSame(9, substr_count($response->getContent(), 'aria-label="Unduh gambar slip"'));
        $this->assertSame(9, substr_count($response->getContent(), 'x-data="eksporPayroll"'));
    }

    public function test_page_can_be_filtered_to_one_house(): void
    {
        $kandangSatu = $this->periodeKandang('Kandang 1');

        Livewire::withQueryParams(['periode' => $this->periode()->id])
            ->test(PayrollAbk::class)
            ->assertSee('Frengky')
            ->assertSee('Total semua kandang')
            ->call('pilihKandang', $kandangSatu->id)
            ->assertSet('periodeKandangId', $kandangSatu->id)
            ->assertSee('Wahyu')
            ->assertSee('23.470.756')
            ->assertDontSee('Frengky')
            ->assertDontSee('Total semua kandang')
            ->assertDontSee('Slip Kandang 1')
            ->call('pilihKandang')
            ->assertSet('periodeKandangId', null)
            ->assertSee('Frengky');

        $this->get(route('payroll.abk', ['periode' => $this->periode()->id, 'kandang' => $this->periodeKandang('Kandang 2')->id]))
            ->assertOk()
            ->assertSee('Rohim')
            ->assertDontSee('Mustofa');
    }

    public function test_page_offers_to_create_slips_when_a_period_has_none(): void
    {
        $this->get(route('payroll.abk', ['periode' => $this->september()->id]))
            ->assertOk()
            ->assertSee('Belum ada slip gaji di periode ini');

        $this->bagiHasilSeptemberKandangDua();

        $this->get(route('payroll.abk', ['periode' => $this->september()->id]))
            ->assertOk()
            ->assertSee('Slip gaji Kandang 2 belum dibuat')
            ->assertSee('4 ABK di lembar bagi hasil: Frengky, Igo, Utama dan Rafi; 1 joker: Rohim')
            ->assertSee('Buat slip Kandang 2')
            ->assertDontSee('Belum ada slip gaji di periode ini')
            ->assertDontSee('Rekap payroll');
    }

    public function test_abk_slips_are_created_from_profit_sharing_with_loans_from_the_cash_book(): void
    {
        $periodeKandang = $this->bagiHasilSeptemberKandangDua();
        $halaman = Livewire::withQueryParams(['periode' => $periodeKandang->periode_id])
            ->test(PayrollAbk::class)
            ->call('buatSlip', $periodeKandang->id)
            ->assertSet('pesan', 'Slip gaji 5 orang Kandang 2 dibuat. Hari kerja dan gaji pokok terisi dari data karyawan; lengkapi komponen lain lewat tombol ubah di tiap slip.')
            ->assertDontSee('Slip gaji Kandang 2 belum dibuat')
            ->assertSee('Rekap payroll');

        $slip = $periodeKandang->slipGaji()->orderBy('urutan')->get();
        $this->assertSame(['Frengky', 'Igo', 'Utama', 'Rafi', 'Rohim'], $slip->pluck('nama')->all());
        $this->assertSame([...$periodeKandang->bagiHasil->penerimaBerperan(PeranBagiHasil::Abk)->pluck('id')->all(), null], $slip->pluck('penerima_bagi_hasil_id')->all());
        $this->assertSame(Karyawan::whereIn('nama', ['Frengky', 'Igo', 'Utama', 'Rafi', 'Rohim'])->orderBy('id')->pluck('id')->all(), $slip->pluck('karyawan_id')->all());
        // Enam "Pinjaman frengky" di kas operasional Kandang 2 September.
        $this->assertSame(1_330_000, $slip->firstWhere('nama', 'Frengky')->pinjaman);
        $this->assertSame([0, 0], $slip->whereIn('nama', ['Igo', 'Utama'])->pluck('pinjaman')->all());

        $halaman->call('buatSlip', $periodeKandang->id)->assertSet('pesan', 'Semua ABK dan joker Kandang 2 sudah punya slip gaji.');
        $this->assertSame(5, $periodeKandang->slipGaji()->count());
        $this->assertSame(1, Aktivitas::where(['modul' => ModulAktivitas::PayrollAbk, 'jenis' => JenisAktivitas::Tambah])->count());
    }

    public function test_new_slips_take_hours_and_base_salary_from_the_employee_defaults(): void
    {
        $periodeKandang = $this->bagiHasilSeptemberKandangDua();
        // Rohim (joker) sudah diberi nilai bawaan oleh seeder; ABK diberi hari kerja saja, gaji pokoknya tidak dipakai.
        Karyawan::where('nama', 'Igo')->update(['hari_kerja' => 28, 'gaji_pokok' => 1_000_000]);

        Livewire::withQueryParams(['periode' => $periodeKandang->periode_id])
            ->test(PayrollAbk::class)
            ->call('buatSlip', $periodeKandang->id);

        $rohim = $periodeKandang->slipGaji()->where('nama', 'Rohim')->sole();
        $this->assertSame(Jabatan::Joker, $rohim->jabatan);
        $this->assertNull($rohim->penerima_bagi_hasil_id);
        $this->assertSame(30, $rohim->hari_kerja);
        $this->assertSame(2_000_000, $rohim->gaji_pokok);

        $igo = $periodeKandang->slipGaji()->where('nama', 'Igo')->sole();
        $this->assertSame(28, $igo->hari_kerja);
        $this->assertSame(0, $igo->gaji_pokok);
        $this->assertSame(0, $periodeKandang->slipGaji()->where('nama', 'Rafi')->sole()->hari_kerja);

        $this->assertSame('4 ABK, 1 Joker, '.$this->september()->nama, Aktivitas::where('modul', ModulAktivitas::PayrollAbk)->sole()->rincian);
    }

    public function test_a_joker_without_defaults_still_gets_an_empty_slip(): void
    {
        $periodeKandang = $this->bagiHasilSeptemberKandangDua();
        Karyawan::where('nama', 'Rohim')->update(['hari_kerja' => null, 'gaji_pokok' => null, 'tanggal_gajian' => null]);

        Livewire::withQueryParams(['periode' => $periodeKandang->periode_id])
            ->test(PayrollAbk::class)
            ->call('buatSlip', $periodeKandang->id);

        $rohim = $periodeKandang->slipGaji()->where('nama', 'Rohim')->sole();
        $this->assertSame([0, 0], [$rohim->hari_kerja, $rohim->gaji_pokok]);
    }

    public function test_slip_components_can_be_updated_and_the_slip_deleted(): void
    {
        $periodeKandang = $this->bagiHasilSeptemberKandangDua();
        $halaman = Livewire::withQueryParams(['periode' => $periodeKandang->periode_id])
            ->test(PayrollAbk::class)
            ->call('buatSlip', $periodeKandang->id);
        $igo = $periodeKandang->slipGaji()->where('nama', 'Igo')->sole();

        $halaman->call('ubah', $igo->id)
            ->assertSet('isian.hari_kerja', '0')
            ->set('isian.hari_kerja', '56')
            ->set('isian.premi_panen', '500000')
            ->set('isian.potongan_lain', '200000')
            ->set('isian.keterangan_potongan_lain', ' HP ')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Slip gaji Igo diperbarui.');

        $this->assertDatabaseHas('slip_gajis', ['id' => $igo->id, 'hari_kerja' => 56, 'premi_panen' => 500_000, 'uang_makan' => 0, 'potongan_lain' => 200_000, 'keterangan_potongan_lain' => 'HP']);

        $halaman->call('ubah', $igo->id)->set('isian.potongan_lain', '-1')->call('simpan')->assertHasErrors('isian.potongan_lain');

        $halaman->call('mintaHapus', $igo->id)
            ->call('hapus')
            ->assertSet('pesan', 'Slip gaji Igo dihapus.')
            ->assertSee('Slip gaji Kandang 2 belum dibuat');
        $this->assertDatabaseMissing('slip_gajis', ['id' => $igo->id]);
        $this->assertSame(
            [JenisAktivitas::Tambah, JenisAktivitas::Ubah, JenisAktivitas::Hapus],
            Aktivitas::where('modul', ModulAktivitas::PayrollAbk)->orderBy('id')->pluck('jenis')->all(),
        );
    }

    public function test_meal_money_comes_from_named_meal_loans_in_the_cash_book(): void
    {
        $periodeKandang = $this->bagiHasilSeptemberKandangDua();
        foreach ([
            ['Uang makan Frengky', 300_000],
            ['uang makan frengky minggu 2', 200_000],
            ['Uang makan Igo dan Utama', 401],
            ['Pinjaman Makan', 1_000_000],
        ] as [$uraian, $jumlah]) {
            TransaksiKas::factory()->for($periodeKandang)->keluar(KategoriKas::PinjamanMakan, $jumlah)->create(['uraian' => $uraian, 'tanggal' => '2026-09-20']);
        }
        // Bukan Pinjaman Makan: tidak dihitung sebagai uang makan walau menyebut nama.
        TransaksiKas::factory()->for($periodeKandang)->keluar(KategoriKas::MakanMinum, 50_000)->create(['uraian' => 'Kopi Rafi', 'tanggal' => '2026-09-20']);

        $halaman = Livewire::withQueryParams(['periode' => $periodeKandang->periode_id])
            ->test(PayrollAbk::class)
            ->call('buatSlip', $periodeKandang->id);

        $uangMakan = collect($this->lembarSeptember()['kandang'][0]['slip'])
            ->mapWithKeys(fn (array $slip): array => [$slip['nama'] => collect($slip['potongan'])->firstWhere('label', 'Uang makan')])
            ->map(fn (array $baris): array => [$baris['jumlah'], $baris['rumus']])
            ->all();

        $this->assertSame([
            'Frengky' => [500_000, 'dari kas: 2 transaksi Pinjaman Makan'],
            'Igo' => [201, 'dari kas: 1 transaksi Pinjaman Makan'],
            'Utama' => [200, 'dari kas: 1 transaksi Pinjaman Makan'],
            'Rafi' => [0, null],
            'Rohim' => [0, null],
        ], $uangMakan);

        // Di form ubah, uang makan hanya ditampilkan; tidak ada isiannya.
        $frengky = $periodeKandang->slipGaji()->where('nama', 'Frengky')->sole();
        $halaman->call('ubah', $frengky->id)
            ->assertSet('uangMakanSlip', ['jumlah' => 500_000, 'transaksi' => 2, 'dari_kas' => true])
            ->assertSee('Dari kas operasional: 2 transaksi Pinjaman Makan atas nama Frengky.')
            ->assertDontSeeHtml("isianRibuan('isian.uang_makan'");
    }

    public function test_slips_without_named_meal_loans_keep_their_saved_meal_money(): void
    {
        // Slip Juli tersimpan dengan uang makan Rp 1.960.000; kas Juli hanya punya "Pinjaman Makan" tanpa nama.
        $this->assertSame(1_960_000, collect($this->slip('Igo')['potongan'])->firstWhere('label', 'Uang makan')['jumlah']);
    }

    public function test_slips_of_a_closed_period_cannot_be_changed(): void
    {
        $wahyu = SlipGaji::where('nama', 'Wahyu')->sole();
        $halaman = Livewire::withQueryParams(['periode' => $this->periode()->id])
            ->test(PayrollAbk::class)
            ->assertDontSeeHtml('data-bs-target="#modal-slip"');

        $halaman->call('ubah', $wahyu->id)->set('isian.premi_panen', '1')->call('simpan')->assertForbidden();
        $this->assertSame(500_000, $wahyu->fresh()->premi_panen);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function lembar(): ?array
    {
        $periode = $this->periode()->load(['notaPanen', 'hargaKontrak', 'rhppReal', 'kandangPeriode.kandang', 'kandangPeriode.recordings', 'kandangPeriode.pemberianPakan']);
        $kandangPeriode = $periode->kandangPeriode()->with(['kandang', 'slipGaji.penerimaBagiHasil', 'bagiHasil.penerima'])->get();

        return LembarPayroll::buat($kandangPeriode, LembarRhpp::real($periode));
    }

    /**
     * @return array<string, mixed>
     */
    private function slip(string $nama): array
    {
        return collect($this->lembar()['kandang'])->flatMap(fn (array $kandang): array => $kandang['slip'])->firstWhere('nama', $nama);
    }

    /**
     * @param  list<array<string, mixed>>  $slip
     * @return array<string, array{int, int, int}>
     */
    private function totalPerOrang(array $slip): array
    {
        return collect($slip)->mapWithKeys(fn (array $satu): array => [$satu['nama'] => [$satu['total_pendapatan'], $satu['total_potongan'], $satu['bersih']]])->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function lembarSeptember(): array
    {
        $periode = $this->september()->load(LembarRhpp::RELASI);
        $kandangPeriode = $periode->kandangPeriode()->has('slipGaji')->with(['kandang', 'slipGaji.penerimaBagiHasil', 'bagiHasil.penerima'])->get();

        return LembarPayroll::buat($kandangPeriode, LembarRhpp::real($periode));
    }

    private function periode(): Periode
    {
        return Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
    }

    private function september(): Periode
    {
        return Periode::where('nama', 'Periode September 2026')->firstOrFail();
    }

    /**
     * Lembar bagi hasil Kandang 2 September dengan empat ABK, seperti yang diisi di halaman Bagi hasil.
     */
    private function bagiHasilSeptemberKandangDua(): PeriodeKandang
    {
        $periodeKandang = PeriodeKandang::where(['periode_id' => $this->september()->id, 'kandang_id' => Kandang::where('nama', 'Kandang 2')->firstOrFail()->id])->firstOrFail();
        $bagiHasil = BagiHasil::factory()->for($periodeKandang)->create();
        PenerimaBagiHasil::factory()->for($bagiHasil)->count(4)->sequence(
            ['nama' => 'Frengky', 'urutan' => 1, 'jumlah' => 500_000, 'keterangan' => 'ketua ABK'],
            ['nama' => 'Igo', 'urutan' => 2],
            ['nama' => 'Utama', 'urutan' => 3],
            ['nama' => 'Rafi', 'urutan' => 4],
        )->create();

        return $periodeKandang->load('bagiHasil.penerima');
    }

    private function periodeKandang(string $kandang): PeriodeKandang
    {
        return PeriodeKandang::with('bagiHasil')
            ->where(['periode_id' => $this->periode()->id, 'kandang_id' => Kandang::where('nama', $kandang)->firstOrFail()->id])
            ->firstOrFail();
    }
}
