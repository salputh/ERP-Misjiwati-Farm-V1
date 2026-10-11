<?php

namespace Tests\Feature;

use App\Livewire\Rhpp;
use App\Models\HargaKontrak;
use App\Models\Periode;
use App\Support\LembarRhpp;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\RhppSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class RhppTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DatabaseSeeder::class);
    }

    public function test_contract_price_follows_the_abw_bracket(): void
    {
        $bracket = $this->periode('Periode Juli 2026')->hargaKontrak;

        $this->assertNull(LembarRhpp::hargaKontrak($bracket, 1.299));
        $this->assertSame(22145, LembarRhpp::hargaKontrak($bracket, 1.3));
        $this->assertSame(21670, LembarRhpp::hargaKontrak($bracket, 1.699));
        $this->assertSame(21600, LembarRhpp::hargaKontrak($bracket, 1.7));
        $this->assertSame(21440, LembarRhpp::hargaKontrak($bracket, 1.998));
        $this->assertSame(21190, LembarRhpp::hargaKontrak($bracket, 2.5));
        $this->assertNull(LembarRhpp::hargaKontrak($bracket, null));
    }

    /**
     * Angka dari lembar "Simulasi RHPP". Lembar itu mencatat nota BTPA 15883 seberat 1.500,00 kg;
     * rekap panen dan RHPP real mencatat 1.499,80 kg, sehingga nilai penjualan di sini lebih kecil Rp 4.386.
     */
    public function test_simulation_matches_the_original_sheet(): void
    {
        $simulasi = LembarRhpp::simulasi($this->periode('Periode Juli 2026'));

        $nota = collect($simulasi['nota'])->keyBy('no_btpa');
        $this->assertCount(53, $nota);
        $this->assertSame([1, 22145, 44267855], [$nota['15882']['hari'], $nota['15882']['harga_kontrak'], $nota['15882']['nilai_kontrak']]);
        $this->assertSame([4, 21190, 14794858], [$nota['16363']['hari'], $nota['16363']['harga_kontrak'], $nota['16363']['nilai_kontrak']]);
        $this->assertSame([21935, 32898113], [$nota['15883']['harga_kontrak'], $nota['15883']['nilai_kontrak']]);
        $this->assertSame('1,313', number_format($nota['15882']['abw'], 3, ','));

        $total = $simulasi['total'];
        $this->assertSame([44078, 79821.2, 1718070111, 0], [$total['ekor'], $total['berat'], $total['nilai_kontrak'], $total['tanpa_harga_kontrak']]);
        $this->assertSame(21524, (int) round($total['harga_kontrak']));

        $biaya = $simulasi['biaya'];
        $this->assertSame([45000, 9415, 423675000], [$biaya['doc'], $biaya['harga_doc'], $biaya['biaya_doc']]);
        $this->assertSame([2238.0, 497410, 1113204000], [$biaya['pakan_zak'], (int) round($biaya['harga_pakan']), $biaya['biaya_pakan']]);
        $this->assertSame([2000000, 1538879000], [$biaya['biaya_ovk'], $biaya['total']]);

        $hasil = $simulasi['hasil'];
        $this->assertSame([1718070111, 1538879000, 179191111, 0, 179191111], [$hasil['penjualan'], $hasil['sapronak'], $hasil['laba_kotor'], $hasil['insentif'], $hasil['laba']]);
        $this->assertSame([4065, 2245, 19279], [(int) round($hasil['laba_per_ekor']), (int) round($hasil['laba_per_kg']), (int) round($hasil['hpp'])]);
        $this->assertSame('10,4', number_format($hasil['margin'], 1, ','));

        $this->assertSame('P.17', $simulasi['kontrak']);
        $this->assertSame(['dari' => 1.3, 'sampai' => 1.39, 'harga' => 22145], $simulasi['bracket'][0]);
        $this->assertSame(['dari' => 2.1, 'sampai' => null, 'harga' => 21190], $simulasi['bracket'][8]);
    }

    /**
     * Angka dari lembar "RHPP Real" bagian A sampai D.
     */
    public function test_real_rhpp_matches_the_original_sheet(): void
    {
        $real = LembarRhpp::real($this->periode('Periode Juli 2026'));

        $this->assertSame([423675000, 1113204000, 3297000], array_column($real['sapronak']['baris'], 'total'));
        $this->assertSame(['9.415,00', '9.948,20', '1.099,00'], array_map(fn (array $baris): string => number_format($baris['harga'], 2, ',', '.'), $real['sapronak']['baris']));
        $this->assertSame(1540176000, $real['sapronak']['total']);

        $kinerja = $real['kinerja'];
        $this->assertSame([44078, 79821.2, 1760821618], [$kinerja['ekor'], $kinerja['berat'], $kinerja['total_panen']]);
        $this->assertSame('22.059,57', number_format($kinerja['harga_rata'], 2, ',', '.'));
        $this->assertSame([1.402, 1.487, '-0,085'], [$kinerja['fcr']['aktual'], $kinerja['fcr']['standar'], number_format($kinerja['fcr']['selisih'], 3, ',')]);
        $this->assertSame([2.1, 3.6, '-1,5'], [$kinerja['deplesi']['aktual'], $kinerja['deplesi']['standar'], number_format($kinerja['deplesi']['selisih'], 1, ',')]);
        $this->assertSame([30.08, 420], [$kinerja['umur_rata'], $kinerja['ip']]);

        $this->assertSame([
            'total_panen' => 1760821618,
            'sapronak' => 1540176000,
            'selisih_budidaya' => 220645618,
            'efisiensi' => 20753512,
            'tarif_efisiensi' => 260,
            'subsidi' => 100730134,
            'lain' => 121483646,
            'bersih' => 342129264,
        ], $real['rekap']);

        $satuan = $real['satuan'];
        $this->assertSame(['1.261,95', '2.285,27', '1.521,95', '5.364,43'], array_map(
            fn (float $nilai): string => number_format($nilai, 2, ',', '.'),
            [$satuan['subsidi_per_kg'], $satuan['subsidi_per_ekor'], $satuan['subsidi_prestasi_per_kg'], $satuan['nilai_per_doc']],
        ));
        $this->assertSame([241399130, 45000], [$satuan['budidaya_efisiensi'], $satuan['doc']]);

        $trip = collect($real['trip'])->keyBy('no_btpa');
        $utama = $trip['15882'];
        $this->assertSame([22703, 45383297, 22145, 44267855], [$utama['harga_real'], $utama['nilai_real'], $utama['harga_kontrak'], $utama['nilai_kontrak']]);
        $this->assertSame([558, 1115442, 2522632], [$utama['selisih_harga'], $utama['selisih_nilai'], $utama['alokasi_subsidi']]);
        // Nota dengan bracket harga real berbeda dari kontrak: selisih 389, bukan 549.
        $this->assertSame([22324, 21935, 389, 427394], [$trip['15886']['harga_real'], $trip['15886']['harga_kontrak'], $trip['15886']['selisih_harga'], $trip['15886']['selisih_nilai']]);

        $total = $real['total'];
        $this->assertSame([1760821618, 1718070111, 42751507, 100730133], [$total['nilai_real'], $total['nilai_kontrak'], $total['selisih_nilai'], $total['alokasi_subsidi']]);
        $this->assertSame(['21.523,98', '535,59'], [number_format($total['harga_kontrak'], 2, ',', '.'), number_format($total['selisih_harga'], 2, ',', '.')]);
    }

    /**
     * Angka dari lembar "RHPP Real" bagian E.
     */
    public function test_income_is_allocated_per_house_by_tonnage(): void
    {
        $kandang = LembarRhpp::real($this->periode('Periode Juli 2026'))['kandang'];
        [$satu, $dua] = $kandang['kolom'];

        $this->assertSame(['Kandang 1', 23, 19704, 32871.93], [$satu['nama'], $satu['trip'], $satu['ekor'], $satu['tonase']]);
        $this->assertSame(['1,668', '41,2'], [number_format($satu['bw'], 3, ','), number_format($satu['bagian_persen'], 1, ',')]);
        $this->assertSame([725140752, 634274574, 90866178, 8546702, 41482638, 50029340, 140895518], $this->rupiah($satu));
        $this->assertSame([1035680866, 905901426, 129779440, 12206810, 59247496, 71454306, 201233746], $this->rupiah($dua));
        $this->assertSame([1760821618, 1540176000, 220645618, 20753512, 100730134, 121483646, 342129264], $this->rupiah($kandang['total']));
        $this->assertTrue($kandang['cocok']);

        $this->assertSame(['4.286,20', '7.150,60', '1.261,95', '6.125.892'], $this->indikator($satu));
        $this->assertSame(['4.286,20', '8.256,08', '1.261,95', '6.707.792'], $this->indikator($dua));
        $this->assertSame(['4.286,20', '7.761,91', '1.261,95', '6.455.269'], $this->indikator($kandang['total']));
        $this->assertSame(53, $kandang['total']['trip']);
    }

    public function test_notes_outside_the_contract_brackets_have_no_contract_value(): void
    {
        $periode = $this->periode('Periode Juli 2026');
        HargaKontrak::where('periode_id', $periode->id)->where('bobot_min_kg', '<', 1.5)->delete();

        $simulasi = LembarRhpp::simulasi($this->periode('Periode Juli 2026'));
        $nota = collect($simulasi['nota'])->keyBy('no_btpa');

        $this->assertNull($nota['15882']['harga_kontrak']);
        $this->assertNull($nota['15882']['nilai_kontrak']);
        $this->assertSame(5, $simulasi['total']['tanpa_harga_kontrak']);
    }

    public function test_seeding_rhpp_twice_does_not_duplicate_records(): void
    {
        $this->seed(RhppSeeder::class);

        $periode = $this->periode('Periode Juli 2026');
        $this->assertCount(9, $periode->hargaKontrak);
        $this->assertSame([1, 1], [$periode->rhppSimulasi()->count(), $periode->rhppReal()->count()]);
    }

    public function test_page_opens_on_the_simulation_tab_and_switches_to_real(): void
    {
        $periode = $this->periode('Periode Juli 2026');

        Livewire::withQueryParams(['periode' => $periode->id])
            ->test(Rhpp::class)
            ->assertSet('tab', 'simulasi')
            ->assertSee('Rincian penjualan per nota timbang')
            ->assertSee('1.718.070.111')
            ->assertSee('179.191.111')
            ->assertDontSee('Rekapitulasi pendapatan')
            ->call('pilihTab', 'real')
            ->assertSet('tab', 'real')
            ->assertSee('Rekapitulasi pendapatan')
            ->assertSee('F02410000018')
            ->assertSee('342.129.264')
            ->assertSee('140.895.518')
            ->assertDontSee('Rincian penjualan per nota timbang');
    }

    public function test_tab_can_be_chosen_from_the_url_and_unknown_tabs_fall_back(): void
    {
        $periode = $this->periode('Periode Juli 2026');

        $this->get(route('rhpp', ['periode' => $periode->id, 'tab' => 'real']))->assertOk()->assertSee('Rekapitulasi pendapatan');
        $this->get(route('rhpp', ['periode' => $periode->id, 'tab' => 'lain']))->assertOk()->assertSee('Rincian penjualan per nota timbang');
    }

    public function test_page_explains_when_a_period_has_no_harvest_or_no_real_rhpp(): void
    {
        $september = $this->periode('Periode September 2026');
        $this->assertNull(LembarRhpp::simulasi($september));
        $this->get(route('rhpp', ['periode' => $september->id]))->assertOk()->assertSee('Belum ada panen');

        $juli = $this->periode('Periode Juli 2026');
        $juli->rhppReal()->delete();
        $this->get(route('rhpp', ['periode' => $juli->id, 'tab' => 'real']))->assertOk()->assertSee('RHPP real belum dicatat');
    }

    private function periode(string $nama): Periode
    {
        return Periode::where('nama', $nama)
            ->with(['notaPanen', 'hargaKontrak', 'rhppSimulasi', 'rhppReal', 'kandangPeriode.kandang', 'kandangPeriode.recordings', 'kandangPeriode.pemberianPakan'])
            ->firstOrFail();
    }

    /**
     * @param  array<string, mixed>  $kolom
     * @return list<int>
     */
    private function rupiah(array $kolom): array
    {
        return [$kolom['total_panen'], $kolom['sapronak'], $kolom['selisih_budidaya'], $kolom['efisiensi'], $kolom['subsidi'], $kolom['lain'], $kolom['bersih']];
    }

    /**
     * @param  array<string, mixed>  $kolom
     * @return list<string>
     */
    private function indikator(array $kolom): array
    {
        return [
            number_format($kolom['bersih_per_kg'], 2, ',', '.'),
            number_format($kolom['bersih_per_ekor'], 2, ',', '.'),
            number_format($kolom['subsidi_per_kg'], 2, ',', '.'),
            number_format($kolom['bersih_per_trip'], 0, ',', '.'),
        ];
    }
}
