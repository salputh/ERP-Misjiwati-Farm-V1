<?php

namespace Tests\Feature;

use App\Models\BagiHasil;
use App\Models\Kandang;
use App\Models\PenerimaBagiHasil;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use App\Support\BukuKas;
use App\Support\LembarBagiHasil;
use App\Support\LembarRhpp;
use Database\Seeders\BagiHasilSeeder;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BagiHasilTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DatabaseSeeder::class);
    }

    /**
     * Angka dari lembar "Bagi Hasil - Indojaya | Kandang 1".
     */
    public function test_house_one_matches_the_original_sheet(): void
    {
        $lembar = $this->lembar('Kandang 1');

        $this->assertSame(['populasi' => 20000, 'kg' => 32871.93, 'controller' => 'An Nisa'], $lembar['identitas']);
        $this->assertSame([
            'Penjualan ayam' => 725_140_752,
            'Dikurangi sapronak' => 634_274_574,
            'Hasil usaha budidaya' => 90_866_178,
            'Selisih efisiensi' => 8_546_702,
            'Total budidaya' => 99_412_880,
            'Bonus pasar' => 41_482_638,
            'Jumlah pendapatan' => 140_895_518,
        ], array_column($lembar['pendapatan'], 'jumlah', 'label'));
        $this->assertSame('32.871,93 kg × Rp 22.059,57', $lembar['pendapatan'][0]['rumus']);
        $this->assertSame('Rp 4.970,64 per ekor populasi', $lembar['pendapatan'][4]['rumus']);
        $this->assertSame('32.871,93 kg × Rp 1.261,95 subsidi harga pasar', $lembar['pendapatan'][5]['rumus']);

        $this->assertSame([
            'Operasional' => 75_995_246,
            'Gaji ABK' => 16_435_965,
            'Premi pemeliharaan ABK' => 0,
            'Premi controller An Nisa' => 0,
            'Upah controller An Nisa' => 4_226_866,
            'Bonus pasar ABK' => 12_444_791,
            'Bonus pasar controller An Nisa' => 4_148_264,
            'Bonus pasar Rohim' => 500_000,
            'Total operasional pemeliharaan' => 113_251_132,
        ], array_column($lembar['pengeluaran'], 'jumlah', 'label'));

        $this->assertSame([
            'pendapatan' => 140_895_518,
            'pengeluaran' => 113_251_132,
            'sisa' => 27_644_386,
            'entertain' => 1_000_000,
            'zakat' => 666_110,
            'sisa_akhir' => 25_978_276,
            'abk' => 28_880_756,
            'jumlah_abk' => 4,
        ], $lembar['ringkasan']);
        $this->assertSame([140_895_518, 113_251_132, 27_644_386, 500_000, 500_000, 26_644_386, 666_110, 25_978_276], array_column($lembar['sisa'], 'jumlah'));
    }

    /**
     * Bonus pasar Rohim tercantum di lembar Kandang 1, tetapi total pengeluarannya tidak memasukkannya.
     */
    public function test_listed_bonus_outside_the_sheet_total_is_reported_but_not_summed(): void
    {
        $lembar = $this->lembar('Kandang 1');

        $this->assertSame([['nama' => 'Rohim', 'jumlah' => 500_000]], $lembar['tidak_dijumlahkan']);
        $this->assertSame('tidak ikut dijumlahkan', collect($lembar['pengeluaran'])->firstWhere('label', 'Bonus pasar Rohim')['rumus']);

        PenerimaBagiHasil::where('nama', 'Rohim')->update(['dijumlahkan' => true]);

        $this->assertSame(113_751_132, $this->lembar('Kandang 1')['ringkasan']['pengeluaran']);
        $this->assertSame([], $this->lembar('Kandang 1')['tidak_dijumlahkan']);
    }

    /**
     * Angka dari lembar "Bagi Hasil - Kandang 2".
     */
    public function test_house_two_matches_the_original_sheet(): void
    {
        $lembar = $this->lembar('Kandang 2');

        $this->assertSame([1_035_680_866, 905_901_426, 129_779_440, 12_206_810, 141_986_250, 59_247_496, 201_233_746], array_column($lembar['pendapatan'], 'jumlah'));
        $this->assertSame('Rp 5.679,45 per ekor populasi', $lembar['pendapatan'][4]['rumus']);

        $this->assertSame([
            'Operasional' => 59_944_239,
            'Gaji ABK' => 23_474_635,
            'Premi pemeliharaan ABK' => 1_050_000,
            'Premi controller Salman' => 262_500,
            'Premi tetap Frengky (ketua ABK)' => 500_000,
            'Upah controller Salman' => 6_299_512,
            'Bonus pasar ABK' => 17_774_249,
            'Bonus pasar controller Salman' => 5_924_750,
            'Total operasional pemeliharaan' => 115_229_885,
        ], array_column($lembar['pengeluaran'], 'jumlah', 'label'));

        $this->assertSame([86_003_861, 1_000_000, 2_125_097, 82_878_764], [
            $lembar['ringkasan']['sisa'], $lembar['ringkasan']['entertain'], $lembar['ringkasan']['zakat'], $lembar['ringkasan']['sisa_akhir'],
        ]);
        $this->assertSame([], $lembar['tidak_dijumlahkan']);
    }

    public function test_abk_income_is_split_evenly_after_fixed_premiums(): void
    {
        $satu = $this->lembar('Kandang 1')['abk'];
        $this->assertSame([16_435_965, 12_444_791, 28_880_756], array_column($satu['rekap'], 'jumlah'));
        $this->assertSame(['Wahyu' => 7_220_189, 'Angga' => 7_220_189, 'Rifi' => 7_220_189, 'Mustofa' => 7_220_189], array_column($satu['penerima'], 'jumlah', 'nama'));
        $this->assertSame([28_880_756, 0, 28_880_756], [$satu['rata'], $satu['premi_tetap'], $satu['total']]);

        $dua = $this->lembar('Kandang 2')['abk'];
        $this->assertSame([24_524_635, 17_774_249, 42_298_884], array_column($dua['rekap'], 'jumlah'));
        $this->assertSame(['Frengky' => 10_949_721, 'Igo' => 10_449_721, 'Utama' => 10_449_721, 'Rafi' => 10_449_721], array_column($dua['penerima'], 'jumlah', 'nama'));
        $this->assertSame(['nama' => 'Frengky', 'keterangan' => 'ketua ABK', 'rata' => 10_449_721, 'premi_tetap' => 500_000, 'jumlah' => 10_949_721], $dua['penerima'][0]);
        $this->assertSame([41_798_884, 500_000, 42_298_884], [$dua['rata'], $dua['premi_tetap'], $dua['total']]);
    }

    /**
     * Di lembar Kandang 1 bagian Muchrizan tertulis 20.756.642, sehingga dua barisnya berjumlah Rp 1 di bawah totalnya.
     * Di sini pemodal terakhir menerima sisa, jadi jumlahnya tepat sama dengan sisa akhir.
     */
    public function test_final_remainder_is_divided_between_investors_and_adds_up_exactly(): void
    {
        $satu = $this->lembar('Kandang 1')['pemodal'];
        $this->assertSame(['Muchrizan' => 20_756_643, 'Chatam' => 5_221_633], array_column($satu['penerima'], 'jumlah', 'nama'));
        $this->assertSame([79.9, 20.1], array_column($satu['penerima'], 'persen'));
        $this->assertSame([100.0, 25_978_276], [$satu['persen'], $satu['total']]);

        $dua = $this->lembar('Kandang 2')['pemodal'];
        $this->assertSame([['nama' => 'Muchrizan', 'persen' => 100.0, 'jumlah' => 82_878_764]], $dua['penerima']);
    }

    public function test_operational_cost_is_compared_with_the_cash_book(): void
    {
        $this->assertSame(['lembar' => 75_995_246, 'kas' => null, 'selisih' => null], $this->lembar('Kandang 1')['operasional']);
        $this->assertSame(['lembar' => 59_944_239, 'kas' => 67_327_239, 'selisih' => 7_383_000], $this->lembar('Kandang 2')['operasional']);
    }

    public function test_loss_is_not_charged_zakat_and_uneven_rupiah_go_to_the_first_abk(): void
    {
        $periodeKandang = $this->periodeKandang('Kandang 1');
        $periodeKandang->bagiHasil->delete();

        $bagiHasil = BagiHasil::factory()->for($periodeKandang)->create(['operasional' => 150_000_000, 'premi_pemeliharaan_abk' => 2]);
        PenerimaBagiHasil::factory()->for($bagiHasil)->count(3)->sequence(['nama' => 'A', 'urutan' => 1], ['nama' => 'B', 'urutan' => 2], ['nama' => 'C', 'urutan' => 3])->create();
        PenerimaBagiHasil::factory()->for($bagiHasil)->pemodal(60)->create(['nama' => 'X', 'urutan' => 4]);
        PenerimaBagiHasil::factory()->for($bagiHasil)->pemodal(40)->create(['nama' => 'Y', 'urutan' => 5]);

        $lembar = $this->lembar('Kandang 1');

        // 150.000.000 + 16.435.965 + 2 + 4.226.866 + 12.444.791 + 4.148.264
        $this->assertSame(187_255_888, $lembar['ringkasan']['pengeluaran']);
        $this->assertSame([-46_360_370, 0, -46_360_370], [$lembar['ringkasan']['sisa'], $lembar['ringkasan']['zakat'], $lembar['ringkasan']['sisa_akhir']]);
        $this->assertSame(['X' => -27_816_222, 'Y' => -18_544_148], array_column($lembar['pemodal']['penerima'], 'jumlah', 'nama'));

        // 28.880.758 dibagi tiga menyisakan Rp 1, yang diberikan ke ABK pertama.
        $this->assertSame(['A' => 9_626_920, 'B' => 9_626_919, 'C' => 9_626_919], array_column($lembar['abk']['penerima'], 'jumlah', 'nama'));
        $this->assertSame(28_880_758, $lembar['abk']['total']);
    }

    public function test_sheet_needs_both_inputs_and_real_rhpp(): void
    {
        $periodeKandang = $this->periodeKandang('Kandang 1');

        $this->assertNull(LembarBagiHasil::buat($periodeKandang, null));

        $periodeKandang->bagiHasil->delete();

        $this->assertNull($this->lembar('Kandang 1'));
    }

    public function test_seeding_twice_does_not_duplicate_records(): void
    {
        $this->seed(BagiHasilSeeder::class);

        $this->assertSame(2, BagiHasil::count());
        $this->assertSame(13, PenerimaBagiHasil::count());
    }

    public function test_page_shows_the_sheet_for_each_house(): void
    {
        $this->get($this->alamat('Kandang 1', 'Periode Juli 2026'))
            ->assertOk()
            ->assertSee('Bagi hasil Kandang 1')
            ->assertSee('An Nisa')
            ->assertSee('32.871,93 kg')
            ->assertSee('Rp 140,9 jt')
            ->assertSee('140.895.518')
            ->assertSee('113.251.132')
            ->assertSee('25.978.276')
            ->assertSee('Bonus pasar Rohim')
            ->assertSee('tercantum di lembar asli tetapi tidak masuk totalnya')
            ->assertSee('belum bisa dicocokkan')
            ->assertSee('79,9%')
            ->assertSee('20.756.643')
            ->assertSee('Mustofa')
            ->assertSee('7.220.189');

        $this->get($this->alamat('Kandang 2', 'Periode Juli 2026'))
            ->assertOk()
            ->assertSee('Bagi hasil Kandang 2')
            ->assertSee('Premi tetap Frengky (ketua ABK)')
            ->assertSee('115.229.885')
            ->assertSee('82.878.764')
            ->assertSee('10.949.721')
            ->assertSee('Operasional berbeda dari')
            ->assertSee('67.327.239')
            ->assertSee('7.383.000')
            ->assertDontSee('tercantum di lembar asli tetapi tidak masuk totalnya');
    }

    public function test_page_explains_what_is_missing(): void
    {
        $this->get($this->alamat('Kandang 1', 'Periode September 2026'))
            ->assertOk()
            ->assertSee('Kandang 1 tidak dipakai di periode ini');

        $this->get($this->alamat('Kandang 2', 'Periode September 2026'))
            ->assertOk()
            ->assertSee('RHPP real belum dicatat');

        $this->periodeKandang('Kandang 2')->bagiHasil->delete();

        $this->get($this->alamat('Kandang 2', 'Periode Juli 2026'))
            ->assertOk()
            ->assertSee('Bagi hasil belum diisi')
            ->assertDontSee('Rekap pendapatan ABK');
    }

    public function test_sidebar_lists_each_house_under_bagi_hasil_and_bare_url_redirects(): void
    {
        $kandangSatu = $this->kandang('Kandang 1');
        $kandangDua = $this->kandang('Kandang 2');

        $this->get(route('dashboard'))
            ->assertOk()
            ->assertSee(route('bagi.hasil', $kandangSatu))
            ->assertSee(route('bagi.hasil', $kandangDua));

        $this->get('/keuangan/bagi-hasil')->assertRedirect(route('bagi.hasil', $kandangSatu));
        $this->get('/keuangan/bagi-hasil/999')->assertNotFound();
    }

    /**
     * @return array<string, mixed>|null
     */
    private function lembar(string $kandang): ?array
    {
        $periodeKandang = $this->periodeKandang($kandang);
        $periode = $periodeKandang->periode->load(['notaPanen', 'hargaKontrak', 'rhppReal', 'kandangPeriode.kandang', 'kandangPeriode.recordings', 'kandangPeriode.pemberianPakan']);

        return LembarBagiHasil::buat($periodeKandang, LembarRhpp::real($periode), BukuKas::buat($periodeKandang)['ringkasan']['keluar'] ?? null);
    }

    private function periodeKandang(string $kandang): PeriodeKandang
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();

        return PeriodeKandang::with(['bagiHasil.penerima', 'transaksiKas'])
            ->where(['periode_id' => $periode->id, 'kandang_id' => $this->kandang($kandang)->id])
            ->firstOrFail();
    }

    private function kandang(string $nama): Kandang
    {
        return Kandang::where('nama', $nama)->firstOrFail();
    }

    private function alamat(string $kandang, string $periode): string
    {
        return route('bagi.hasil', ['kandang' => $this->kandang($kandang), 'periode' => Periode::where('nama', $periode)->firstOrFail()->id]);
    }
}
