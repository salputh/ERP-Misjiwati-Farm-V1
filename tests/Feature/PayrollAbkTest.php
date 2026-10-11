<?php

namespace Tests\Feature;

use App\Livewire\PayrollAbk;
use App\Models\Kandang;
use App\Models\PenerimaBagiHasil;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use App\Models\SlipGaji;
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
        $periodeKandang->bagiHasil->update(['premi_pemeliharaan_abk' => 400_000]);
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
        $this->assertSame(16, PenerimaBagiHasil::count());
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

    public function test_page_explains_when_a_period_has_no_slips(): void
    {
        $september = Periode::where('nama', 'Periode September 2026')->firstOrFail();

        $this->get(route('payroll.abk', ['periode' => $september->id]))
            ->assertOk()
            ->assertSee('Belum ada slip gaji di periode ini')
            ->assertDontSee('Rekap payroll');
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

    private function periode(): Periode
    {
        return Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
    }

    private function periodeKandang(string $kandang): PeriodeKandang
    {
        return PeriodeKandang::with('bagiHasil')
            ->where(['periode_id' => $this->periode()->id, 'kandang_id' => Kandang::where('nama', $kandang)->firstOrFail()->id])
            ->firstOrFail();
    }
}
