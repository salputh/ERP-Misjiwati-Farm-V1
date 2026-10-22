<?php

namespace Tests\Feature;

use App\Enums\KategoriKas;
use App\Livewire\Rhpp;
use App\Models\HargaDoc;
use App\Models\HargaKontrak;
use App\Models\JenisPakan;
use App\Models\NotaPanen;
use App\Models\PemberianPakan;
use App\Models\Pengaturan;
use App\Models\Periode;
use App\Models\RhppReal;
use App\Models\TransaksiKas;
use App\Support\Format;
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

    public function test_simulation_uses_period_doc_count_master_feed_prices_and_operational_ovk(): void
    {
        $this->petakanPakanJuli();
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
        $this->assertSame([1540.0, 506750, 780395000], [$biaya['pakan_zak'], (int) round($biaya['harga_pakan']), $biaya['biaya_pakan']]);
        $this->assertSame([4550000, 1208620000], [$biaya['biaya_ovk'], $biaya['total']]);

        $hasil = $simulasi['hasil'];
        $this->assertSame([1718070111, 1208620000, 509450111, 20753512, 0, 530203623], [
            $hasil['penjualan'],
            $hasil['sapronak'],
            $hasil['laba_kotor'],
            $hasil['selisih_efisiensi'],
            $hasil['subsidi_nilai_pasar'],
            $hasil['laba'],
        ]);

        $this->assertSame(['dari' => 1.3, 'sampai' => 1.39, 'harga' => 22145], $simulasi['bracket'][0]);
        $this->assertSame(['dari' => 2.1, 'sampai' => 9.99, 'harga' => 21190], $simulasi['bracket'][8]);
    }

    public function test_simulation_keeps_cycle_doc_price_when_master_price_changes(): void
    {
        $this->petakanPakanJuli();
        $periode = $this->periode('Periode Juli 2026');
        $periode->rhppSimulasi->update(['harga_doc' => 7000]);
        HargaDoc::query()->findOrFail(HargaDoc::GLOBAL_ID)->update([
            'harga_per_ekor' => 10000,
            'jumlah_ekor' => 30000,
        ]);

        $biaya = LembarRhpp::simulasi($periode)['biaya'];

        $this->assertSame([45000, 9415, 423675000, 1208620000], [
            $biaya['doc'],
            $biaya['harga_doc'],
            $biaya['biaya_doc'],
            $biaya['total'],
        ]);
    }

    public function test_simulation_projects_and_reconciles_values_per_house(): void
    {
        $this->petakanPakanJuli();
        $simulasi = LembarRhpp::simulasi($this->periode('Periode Juli 2026'));
        $kandang = $simulasi['kandang'];
        $baris = collect($kandang['baris'])->keyBy('nama');

        $this->assertSame([20000, 32871.93, 19704], [
            $baris['Kandang 1']['doc'],
            $baris['Kandang 1']['berat'],
            $baris['Kandang 1']['ekor'],
        ]);
        $this->assertSame([25000, 46949.27, 24374], [
            $baris['Kandang 2']['doc'],
            $baris['Kandang 2']['berat'],
            $baris['Kandang 2']['ekor'],
        ]);
        $this->assertTrue($kandang['cocok']);
        $this->assertTrue($kandang['panen_sesuai']);
        $this->assertEqualsWithDelta(100, array_sum(array_column($kandang['baris'], 'bagian_tonase')), 0.01);
        $this->assertSame($simulasi['total']['nilai_kontrak'], $kandang['total']['penjualan']);
        $this->assertSame($simulasi['biaya']['total'], $kandang['total']['sapronak']);
        $this->assertSame($simulasi['hasil']['laba'], $kandang['total']['laba']);
    }

    public function test_simulation_calculates_efficiency_income_only_below_harvest_age_standard(): void
    {
        $this->petakanPakanJuli();
        $periode = $this->periode('Periode Juli 2026');
        $periode->rhppSimulasi->update(['insentif' => 1500000]);
        $simulasi = LembarRhpp::simulasi($periode);

        $this->assertLessThan($simulasi['performa']['fcr_standar'], $simulasi['performa']['fcr']);
        $this->assertSame(260, $simulasi['hasil']['tarif_efisiensi_per_kg']);
        $this->assertSame([
            (int) round($simulasi['total']['berat'] * 260),
            0,
        ], [
            $simulasi['hasil']['selisih_efisiensi'],
            $simulasi['hasil']['subsidi_nilai_pasar'],
        ]);
        $this->assertSame(
            $simulasi['hasil']['laba_kotor'] + $simulasi['hasil']['selisih_efisiensi'],
            $simulasi['hasil']['laba'],
        );

        $periode->kandangPeriode->first()->pemberianPakan()->firstOrFail()->increment('zak', 3460);
        $periode->update(['rekap_pakan_zak' => 5000]);
        $simulasi = LembarRhpp::simulasi($this->periode('Periode Juli 2026'));

        $this->assertGreaterThan($simulasi['performa']['fcr_standar'], $simulasi['performa']['fcr']);
        $this->assertSame(0, $simulasi['hasil']['selisih_efisiensi']);
    }

    public function test_simulation_inputs_can_be_saved_and_recalculate_results(): void
    {
        $this->petakanPakanJuli();
        $periode = $this->periode('Periode Juli 2026');
        $periode->update(['status' => 'berjalan']);

        Livewire::withQueryParams(['periode' => $periode->id, 'tab' => 'simulasi'])
            ->test(Rhpp::class)
            ->assertSet('tarifEfisiensiPerKg', '260')
            ->assertSee('rhpp-tarif-efisiensi')
            ->assertSee('rhpp-tarif-input')
            ->assertSee('Simpan tarif dan hitung ulang')
            ->assertSee('Tarif efisiensi per kg')
            ->assertDontSee('Asumsi selisih efisiensi')
            ->set('tarifEfisiensiPerKg', '300')
            ->assertHasNoErrors()
            ->assertSee('Simpan')
            ->call('simpanSimulasi')
            ->assertHasNoErrors()
            ->assertSee('Input simulasi RHPP Periode Juli 2026 tersimpan.')
            ->assertSee('Proyeksi simulasi per kandang');

        $this->assertDatabaseHas('rhpp_simulasis', [
            'periode_id' => $periode->id,
            'biaya_pakan' => 780395000,
            'biaya_ovk' => 4550000,
            'tarif_efisiensi_per_kg' => 300,
            'insentif' => 0,
        ]);

        $simulasi = LembarRhpp::simulasi($periode->fresh()->load(LembarRhpp::RELASI));
        $this->assertSame(1208620000, $simulasi['biaya']['total']);
        $this->assertSame(300, $simulasi['hasil']['tarif_efisiensi_per_kg']);
        $this->assertSame(23946360, $simulasi['hasil']['selisih_efisiensi']);
        $this->assertSame(533396471, $simulasi['hasil']['laba']);
        $this->assertTrue($simulasi['kandang']['cocok']);
    }

    public function test_simulation_inputs_can_be_created_for_a_period_without_saved_inputs(): void
    {
        $this->petakanPakanJuli();
        $periode = $this->periode('Periode Juli 2026');
        $periode->update(['status' => 'berjalan']);
        $periode->rhppSimulasi()->delete();

        Livewire::withQueryParams(['periode' => $periode->id, 'tab' => 'simulasi'])
            ->test(Rhpp::class)
            ->assertSee('rhpp-tarif-efisiensi')
            ->assertSee('Selisih Efisiensi')
            ->call('simpanSimulasi')
            ->assertHasNoErrors();

        $this->assertDatabaseHas('rhpp_simulasis', [
            'periode_id' => $periode->id,
            'harga_doc' => 9415,
            'biaya_pakan' => 780395000,
            'biaya_ovk' => 4550000,
            'tarif_efisiensi_per_kg' => 260,
            'insentif' => 0,
        ]);
    }

    public function test_closed_period_simulation_is_read_only(): void
    {
        $periode = $this->periode('Periode Juli 2026');

        Livewire::withQueryParams(['periode' => $periode->id])
            ->test(Rhpp::class)
            ->call('simpanSimulasi')
            ->assertForbidden();
    }

    public function test_simulation_rejects_a_negative_efficiency_rate(): void
    {
        $periode = $this->periode('Periode Juli 2026');
        $periode->update(['status' => 'berjalan']);

        Livewire::withQueryParams(['periode' => $periode->id])
            ->test(Rhpp::class)
            ->set('tarifEfisiensiPerKg', '-1')
            ->call('simpanSimulasi')
            ->assertHasErrors(['tarifEfisiensiPerKg' => 'min']);
    }

    public function test_unclassified_feed_does_not_produce_a_fake_simulation_cost(): void
    {
        $simulasi = LembarRhpp::simulasi($this->periode('Periode Juli 2026'));

        $this->assertNull($simulasi['biaya']['biaya_pakan']);
        $this->assertNull($simulasi['biaya']['total']);
        $this->assertNull($simulasi['hasil']);

        $this->get(route('rhpp', ['periode' => $this->periode('Periode Juli 2026')->id, 'tab' => 'sapronak']))
            ->assertOk()
            ->assertSee('Jenis pakan belum ditentukan')
            ->assertSee('Total sapronak real');
    }

    public function test_doc_claim_reduces_doc_population_cost_deplesi_and_raises_ip(): void
    {
        $this->petakanPakanJuli();
        $periode = $this->periode('Periode Juli 2026');
        $tanpaKlaim = LembarRhpp::dataProduksiReal($periode);
        $denganKlaim = LembarRhpp::dataProduksiReal($periode, 351);

        $this->assertSame(45000, $tanpaKlaim['doc_ekor']);
        $this->assertSame(423675000, $tanpaKlaim['doc_total']);

        // 351 ekor diklaim ke inti: 45.000 - 351 = 44.649 ekor, biaya DOC 420.370.335.
        $this->assertSame(44649, $denganKlaim['doc_ekor']);
        $this->assertSame(420370335, $denganKlaim['doc_total']);
        $this->assertSame(3304665, 423675000 - $denganKlaim['doc_total']);
        // Deplesi memakai DOC yang dibesarkan, IP naik karena DOC yang dipanen lebih sedikit.
        $this->assertGreaterThan($tanpaKlaim['deplesi_persen'], $denganKlaim['deplesi_persen']);
        $this->assertGreaterThan($tanpaKlaim['ip'], $denganKlaim['ip']);

        // Klaim dibagi ke tiap kandang menurut DOC-nya, lalu dihargai harga DOCseitiap kandang.
        $rekapKlaim = LembarRhpp::rekapKlaimDoc($periode, 351);
        $this->assertSame(351, $rekapKlaim['ekor']);
        $this->assertSame(3304665, $rekapKlaim['nilai']);
    }

    public function test_doc_claim_is_saved_with_the_real_rhpp_document(): void
    {
        $this->petakanPakanJuli();
        $periode = $this->periode('Periode Juli 2026');
        $periode->update(['status' => 'aktif']);
        $nota = $periode->notaPanen()->firstOrFail();

        Livewire::withQueryParams(['periode' => $periode->id, 'tab' => 'real'])
            ->test(Rhpp::class)
            ->set('masukanReal.ppl', 'Heri Pranata')
            ->set('masukanReal.doc_diklaim_ekor', '351')
            // DOC, biaya DOC, deplesi, dan IP langsung ikut berubah.
            ->assertSet('masukanReal.doc_ekor', '44649')
            ->assertSet('masukanReal.doc_total', '420370335')
            ->set('hargaPanenReal.'.$nota->id, '23000')
            ->call('simpanReal')
            ->assertHasNoErrors()
            ->assertSet('masukanReal.doc_ekor', '44649')
            ->assertSet('masukanReal.doc_total', '420370335');

        $this->assertDatabaseHas('rhpp_reals', [
            'periode_id' => $periode->id,
            'doc_diklaim_ekor' => 351,
            'doc_ekor' => 44649,
            'doc_total' => 420370335,
        ]);

        $lembar = LembarRhpp::real($periode->fresh());
        $this->assertSame(351, $lembar['doc_diklaim']);
        $this->assertSame(3304665, $lembar['rekap_klaim']['nilai']);
        $this->assertSame(44649, $lembar['satuan']['doc']);
        $this->assertSame(45000, $lembar['satuan']['doc_dikirim']);
    }

    public function test_doc_claim_cannot_exceed_the_period_doc_population(): void
    {
        $this->petakanPakanJuli();
        $periode = $this->periode('Periode Juli 2026');
        $periode->update(['status' => 'aktif']);
        $nota = $periode->notaPanen()->firstOrFail();

        Livewire::withQueryParams(['periode' => $periode->id, 'tab' => 'real'])
            ->test(Rhpp::class)
            ->set('masukanReal.doc_diklaim_ekor', '45000')
            ->set('hargaPanenReal.'.$nota->id, '23000')
            ->call('simpanReal')
            ->assertHasErrors(['masukanReal.doc_diklaim_ekor']);

        // Dokumen RHPP yang sudah ada tidak tersentuh karena klaim ditolak.
        $this->assertDatabaseHas('rhpp_reals', ['periode_id' => $periode->id, 'doc_diklaim_ekor' => 0]);
    }

    public function test_doc_claim_cannot_leave_fewer_doc_than_recorded_mortality(): void
    {
        $this->petakanPakanJuli();
        $periode = $this->periode('Periode Juli 2026');
        $periode->update(['status' => 'aktif']);
        $nota = $periode->notaPanen()->firstOrFail();

        Livewire::withQueryParams(['periode' => $periode->id, 'tab' => 'real'])
            ->test(Rhpp::class)
            ->set('masukanReal.doc_diklaim_ekor', '44500')
            ->set('hargaPanenReal.'.$nota->id, '23000')
            ->call('simpanReal')
            ->assertHasErrors(['masukanReal.doc_diklaim_ekor']);

        // Dokumen RHPP yang sudah ada tidak tersentuh karena klaim ditolak.
        $this->assertDatabaseHas('rhpp_reals', ['periode_id' => $periode->id, 'doc_diklaim_ekor' => 0]);
    }

    public function test_real_rhpp_can_be_locked_and_opened_again_with_the_admin_password(): void
    {
        $this->petakanPakanJuli();
        $periode = $this->periode('Periode Juli 2026');
        $periode->update(['status' => 'aktif']);

        // Belum ada password admin: mengunci sekaligus menetapkannya.
        Livewire::withQueryParams(['periode' => $periode->id, 'tab' => 'real'])
            ->test(Rhpp::class)
            ->call('bukaModalKunciRhpp')
            ->set('sandiAdmin', 'rahasia123')
            ->set('sandiAdminUlang', 'rahasia123')
            ->call('kunciRhpp')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'RHPP real Periode Juli 2026 dikunci.');

        $this->assertDatabaseHas('rhpp_reals', [
            'periode_id' => $periode->id,
            'status' => 'dikunci',
        ]);
        $this->assertDatabaseHas('aktivitas', [
            'subjek' => 'RHPP real Periode Juli 2026',
            'rincian' => 'Dokumen dikunci, password admin ditetapkan',
        ]);
        // Password disimpan dalam bentuk hash, bukan teks polos.
        $this->assertNotSame('rahasia123', Pengaturan::nilai(Pengaturan::PASSWORD_ADMIN));
        $this->assertTrue(Pengaturan::cocokPasswordAdmin('rahasia123'));
    }

    public function test_locked_real_rhpp_cannot_be_saved_until_it_is_opened_again(): void
    {
        $this->petakanPakanJuli();
        $periode = $this->periode('Periode Juli 2026');
        $periode->update(['status' => 'aktif']);
        $nota = $periode->notaPanen()->firstOrFail();
        Pengaturan::setPasswordAdmin('rahasia123');
        $periode->rhppReal->update(['status' => RhppReal::DIKUNCI]);

        Livewire::withQueryParams(['periode' => $periode->id, 'tab' => 'real'])
            ->test(Rhpp::class)
            ->assertSet('rhppTerkunci', true)
            ->set('masukanReal.doc_diklaim_ekor', '351')
            ->set('hargaPanenReal.'.$nota->id, '24000')
            ->call('simpanReal')
            ->assertHasErrors(['masukanReal']);

        $this->assertDatabaseHas('rhpp_reals', [
            'periode_id' => $periode->id,
            'status' => 'dikunci',
        ]);
        $this->assertDatabaseMissing('nota_panens', ['id' => $nota->id, 'harga_real_per_kg' => 24000]);
    }

    public function test_locked_real_rhpp_is_only_opened_with_the_right_admin_password(): void
    {
        $this->petakanPakanJuli();
        $periode = $this->periode('Periode Juli 2026');
        $periode->update(['status' => 'aktif']);
        Pengaturan::setPasswordAdmin('rahasia123');
        $periode->rhppReal->update(['status' => RhppReal::DIKUNCI]);

        // Password salah: dokumen tetap terkunci.
        Livewire::withQueryParams(['periode' => $periode->id, 'tab' => 'real'])
            ->test(Rhpp::class)
            ->call('bukaModalBukaKunciRhpp')
            ->set('sandiAdmin', 'salah')
            ->call('bukaKunciRhpp')
            ->assertHasErrors(['sandiAdmin']);

        $this->assertDatabaseHas('rhpp_reals', ['periode_id' => $periode->id, 'status' => 'dikunci']);

        // Password benar: dokumen dapat diubah kembali.
        Livewire::withQueryParams(['periode' => $periode->id, 'tab' => 'real'])
            ->test(Rhpp::class)
            ->call('bukaModalBukaKunciRhpp')
            ->set('sandiAdmin', 'rahasia123')
            ->call('bukaKunciRhpp')
            ->assertHasNoErrors()
            ->assertSet('rhppTerkunci', false);

        $this->assertDatabaseHas('rhpp_reals', ['periode_id' => $periode->id, 'status' => 'sementara']);
    }

    public function test_admin_password_can_be_changed_with_the_old_password(): void
    {
        Pengaturan::setPasswordAdmin('rahasia123');

        Livewire::test(Rhpp::class)
            ->call('bukaModalGantiPassword')
            ->set('sandiAdminLama', 'salah')
            ->set('sandiAdmin', 'rahasia456')
            ->set('sandiAdminUlang', 'rahasia456')
            ->call('ubahPasswordAdmin')
            ->assertHasErrors(['sandiAdminLama']);

        $this->assertTrue(Pengaturan::cocokPasswordAdmin('rahasia123'));
        $this->assertFalse(Pengaturan::cocokPasswordAdmin('rahasia456'));

        Livewire::test(Rhpp::class)
            ->call('bukaModalGantiPassword')
            ->set('sandiAdminLama', 'rahasia123')
            ->set('sandiAdmin', 'rahasia456')
            ->set('sandiAdminUlang', 'rahasia456')
            ->call('ubahPasswordAdmin')
            ->assertHasNoErrors();

        $this->assertTrue(Pengaturan::cocokPasswordAdmin('rahasia456'));
        $this->assertFalse(Pengaturan::cocokPasswordAdmin('rahasia123'));
    }

    public function test_real_rhpp_uses_database_production_values_and_keeps_harvest_values(): void
    {
        $this->petakanPakanJuli();
        $periode = $this->periode('Periode Juli 2026');
        $dataProduksi = LembarRhpp::dataProduksiReal($periode);
        $real = LembarRhpp::real($periode);

        $this->assertSame([
            $dataProduksi['doc_total'],
            $dataProduksi['pakan_total'],
            $dataProduksi['ovk_total'],
        ], array_column($real['sapronak']['baris'], 'total'));
        $this->assertSame(1208620000, $real['sapronak']['total']);

        $kinerja = $real['kinerja'];
        $this->assertSame([44078, 79821.2, 1760821618], [$kinerja['ekor'], $kinerja['berat'], $kinerja['total_panen']]);
        $this->assertSame('22.059,57', number_format($kinerja['harga_rata'], 2, ',', '.'));
        $this->assertSame([$dataProduksi['fcr_aktual'], $dataProduksi['fcr_standar']], [$kinerja['fcr']['aktual'], $kinerja['fcr']['standar']]);
        $this->assertSame([$dataProduksi['deplesi_persen'], $dataProduksi['deplesi_standar_persen']], [$kinerja['deplesi']['aktual'], $kinerja['deplesi']['standar']]);
        $this->assertSame([$dataProduksi['umur_rata'], $dataProduksi['ip']], [$kinerja['umur_rata'], $kinerja['ip']]);

        $this->assertSame([
            'total_panen' => 1760821618,
            'sapronak' => 1208620000,
            'selisih_budidaya' => 552201618,
            'efisiensi' => 20753512,
            'tarif_efisiensi' => 260,
            'subsidi' => 100730134,
            'lain' => 121483646,
            'bersih' => 673685264,
        ], $real['rekap']);

        $satuan = $real['satuan'];
        $this->assertSame(['1.261,95', '2.285,27', '1.521,95'], array_map(
            fn (float $nilai): string => number_format($nilai, 2, ',', '.'),
            [$satuan['subsidi_per_kg'], $satuan['subsidi_per_ekor'], $satuan['subsidi_prestasi_per_kg']],
        ));
        $this->assertSame([572955130, 45000], [$satuan['budidaya_efisiensi'], $satuan['doc']]);

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

    public function test_real_rhpp_inputs_can_be_saved_and_recalculate_the_trip_total(): void
    {
        $this->petakanPakanJuli();
        $periode = $this->periode('Periode Juli 2026');
        $periode->update(['status' => 'aktif']);
        $nota = $periode->notaPanen()->firstOrFail();
        $dataProduksi = LembarRhpp::dataProduksiReal($periode->fresh());

        Livewire::withQueryParams(['periode' => $periode->id, 'tab' => 'real'])
            ->test(Rhpp::class)
            ->assertSee('Input RHPP real dari dokumen inti')
            ->set('masukanReal.ppl', 'Heri Pranata')
            ->set('hargaPanenReal.'.$nota->id, '23000')
            ->call('simpanReal')
            ->assertHasNoErrors()
            ->assertSee('Input RHPP real Periode Juli 2026 tersimpan.')
            ->assertSee('Perbandingan harga per trip mobil');

        $this->assertDatabaseHas('rhpp_reals', [
            'periode_id' => $periode->id,
            'status' => 'sementara',
            'ppl' => 'Heri Pranata',
            'doc_ekor' => $dataProduksi['doc_ekor'],
            'doc_total' => $dataProduksi['doc_total'],
            'pakan_kg' => $dataProduksi['pakan_kg'],
            'pakan_total' => $dataProduksi['pakan_total'],
            'ovk_total' => $dataProduksi['ovk_total'],
            'fcr_aktual' => $dataProduksi['fcr_aktual'],
            'fcr_standar' => $dataProduksi['fcr_standar'],
            'deplesi_persen' => $dataProduksi['deplesi_persen'],
            'deplesi_standar_persen' => $dataProduksi['deplesi_standar_persen'],
            'umur_rata' => $dataProduksi['umur_rata'],
            'ip' => $dataProduksi['ip'],
        ]);
        $this->assertDatabaseHas('nota_panens', [
            'id' => $nota->id,
            'harga_real_per_kg' => 23000,
        ]);
    }

    public function test_real_rhpp_resynchronizes_when_production_sources_change(): void
    {
        $this->petakanPakanJuli();
        $periode = $this->periode('Periode Juli 2026');
        $periode->update(['status' => 'aktif']);
        $dataSebelum = LembarRhpp::dataProduksiReal($periode->fresh());
        $kandangPeriode = $periode->kandangPeriode->firstOrFail();

        $kandangPeriode->pemberianPakan()->firstOrFail()->increment('zak', 1);
        $periode->increment('rekap_pakan_zak', 1);
        $kandangPeriode->recordings()->firstOrFail()->increment('mati', 100);
        $periode->increment('rekap_deplesi_ekor', 100);
        TransaksiKas::factory()
            ->for($kandangPeriode)
            ->keluar(KategoriKas::ObatAyam, 100000)
            ->create(['tanggal' => '2026-07-20']);

        $dataSesudah = LembarRhpp::dataProduksiReal($periode->fresh());

        $this->assertSame($dataSebelum['pakan_kg'] + 50, $dataSesudah['pakan_kg']);
        $this->assertSame($dataSebelum['pakan_total'] + 506750, $dataSesudah['pakan_total']);
        $this->assertSame($dataSebelum['ovk_total'] + 100000, $dataSesudah['ovk_total']);
        $this->assertGreaterThan($dataSebelum['deplesi_persen'], $dataSesudah['deplesi_persen']);

        Livewire::withQueryParams(['periode' => $periode->id, 'tab' => 'real'])
            ->test(Rhpp::class)
            ->call('simpanReal')
            ->assertHasNoErrors();

        $this->assertDatabaseHas('rhpp_reals', [
            'periode_id' => $periode->id,
            'pakan_kg' => $dataSesudah['pakan_kg'],
            'pakan_total' => $dataSesudah['pakan_total'],
            'ovk_total' => $dataSesudah['ovk_total'],
            'deplesi_persen' => $dataSesudah['deplesi_persen'],
        ]);
    }

    public function test_real_rhpp_warns_and_blocks_saving_when_production_sources_are_incomplete(): void
    {
        $periode = $this->periode('Periode Juli 2026');
        $periode->update(['status' => 'aktif']);
        $dataProduksi = LembarRhpp::dataProduksiReal($periode);
        $real = LembarRhpp::real($periode);

        $this->assertNull($dataProduksi['pakan_total']);
        $this->assertNotEmpty($real['peringatan_sumber']);
        $this->assertSame(1113204000, $real['dokumen']->pakan_total);

        Livewire::withQueryParams(['periode' => $periode->id, 'tab' => 'real'])
            ->test(Rhpp::class)
            ->call('simpanReal')
            ->assertHasErrors(['masukanReal.pakan_total']);
    }

    public function test_real_rhpp_inputs_require_a_real_price_for_each_trip(): void
    {
        $this->petakanPakanJuli();
        $periode = $this->periode('Periode Juli 2026');
        $periode->update(['status' => 'aktif']);
        $nota = $periode->notaPanen()->firstOrFail();

        Livewire::withQueryParams(['periode' => $periode->id, 'tab' => 'real'])
            ->test(Rhpp::class)
            ->set('hargaPanenReal.'.$nota->id, '')
            ->call('simpanReal')
            ->assertHasErrors(['hargaPanenReal.'.$nota->id => 'required']);
    }

    public function test_real_trip_value_rounds_half_rupiah_up_without_float_error(): void
    {
        $periode = $this->periode('Periode Juli 2026');
        $nota = $periode->notaPanen()->firstOrFail();
        $nota->update([
            'berat_kg' => 531.3,
            'harga_real_per_kg' => 22225,
        ]);

        $trip = collect(LembarRhpp::real($this->periode('Periode Juli 2026'))['trip'])
            ->firstWhere('no_btpa', $nota->no_btpa);

        $this->assertSame(11808143, $trip['nilai_real']);
    }

    public function test_closed_period_rhpp_real_is_read_only(): void
    {
        $periode = $this->periode('Periode Juli 2026');

        Livewire::withQueryParams(['periode' => $periode->id, 'tab' => 'real'])
            ->test(Rhpp::class)
            ->call('simpanReal')
            ->assertForbidden();
    }

    public function test_income_is_allocated_per_house_by_tonnage(): void
    {
        $this->petakanPakanJuli();
        $real = LembarRhpp::real($this->periode('Periode Juli 2026'));
        $kandang = $real['kandang'];
        [$satu, $dua] = $kandang['kolom'];

        $this->assertSame(['Kandang 1', 23, 19704, 32871.93], [$satu['nama'], $satu['trip'], $satu['ekor'], $satu['tonase']]);
        $this->assertSame(['1,668', '41,2'], [number_format($satu['bw'], 3, ','), number_format($satu['bagian_persen'], 1, ',')]);
        $this->assertSame($real['rekap']['total_panen'], $satu['total_panen'] + $dua['total_panen']);
        $this->assertSame($real['rekap']['sapronak'], $satu['sapronak'] + $dua['sapronak']);
        $this->assertSame($real['rekap']['bersih'], $satu['bersih'] + $dua['bersih']);
        $this->assertSame($this->rupiah($real['rekap']), $this->rupiah($kandang['total']));
        $this->assertTrue($kandang['cocok']);

        $this->assertEqualsWithDelta(100, $satu['bagian_persen'] + $dua['bagian_persen'], 0.01);
        $this->assertSame(100730134, $kandang['total']['subsidi']);
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

    public function test_page_opens_on_the_real_tab_and_switches_to_simulation(): void
    {
        $this->petakanPakanJuli();
        $periode = $this->periode('Periode Juli 2026');
        $real = LembarRhpp::real($periode);

        Livewire::withQueryParams(['periode' => $periode->id])
            ->test(Rhpp::class)
            ->assertSet('tab', 'real')
            ->assertSee('Rekapitulasi pendapatan')
            ->assertSee('F02410000018')
            ->assertSee(number_format($real['rekap']['bersih'], 0, ',', '.'))
            ->assertSee(number_format($real['kandang']['kolom'][1]['bersih'], 0, ',', '.'))
            ->assertDontSee('Rincian penjualan per nota timbang')
            ->call('pilihTab', 'simulasi')
            ->assertSet('tab', 'simulasi')
            ->assertSee('Rincian penjualan per nota timbang')
            ->assertSee('Harga kontrak periode ini')
            ->assertDontSee('No. kontrak')
            ->assertSee('1.718.070.111')
            ->assertSee('530.203.623')
            ->assertSee('Selisih Efisiensi')
            ->assertSee('Subsidi Nilai Pasar')
            ->assertDontSee('Rekapitulasi pendapatan')
            ->call('pilihTab', 'sapronak')
            ->assertSet('tab', 'sapronak')
            ->assertSee('Perhitungan otomatis biaya sapronak')
            ->assertSee('1.208.620.000')
            ->assertDontSee('1.540.176.000');
    }

    public function test_simulated_profit_sharing_uses_rhpp_simulation_and_does_not_save_inputs(): void
    {
        $this->petakanPakanJuli();
        $periode = $this->periode('Periode Juli 2026');
        $operasionalAwal = $periode->kandangPeriode()->whereHas('kandang', fn ($query) => $query->where('nama', 'Kandang 2'))->firstOrFail()->bagiHasil->operasional;
        $barisSimulasi = collect(LembarRhpp::simulasi($periode)['kandang']['baris'])->firstWhere('nama', 'Kandang 2');

        $komponen = Livewire::withQueryParams(['periode' => $periode->id])
            ->test(Rhpp::class)
            ->call('pilihTab', 'bagi-hasil')
            ->assertSet('tab', 'bagi-hasil')
            ->assertSee('Bagi Hasil Simulasi')
            ->assertSee('Simulasi bagi hasil Kandang 2')
            ->assertSee('Pendapatan dan sapronak mengikuti simulasi RHPP periode ini')
            ->assertSeeHtml("x-data=\"isianRibuan('masukanBagiHasil.operasional', ',', true)\"")
            ->assertSeeHtml("x-data=\"isianRibuan('masukanBagiHasil.tarif_gaji_abk_per_kg', ',', true)\"")
            ->assertSeeHtml("x-data=\"isianRibuan('masukanBagiHasil.premi_pemeliharaan_abk', ',', true)\"")
            ->assertSeeHtml("x-data=\"isianRibuan('masukanBagiHasil.premi_controller', ',', true)\"")
            ->assertSeeHtml("x-data=\"isianRibuan('abkSimulasi.0.jumlah', ',', true)\"")
            ->assertSeeHtml("x-data=\"isianRibuan('entertainSimulasi.0.jumlah', ',', true)\"")
            ->assertSee('Rp '.Format::angka($barisSimulasi['laba']).' dari RHPP simulasi untuk bagi hasil')
            ->assertDontSee('Hitung simulasi')
            ->assertSet('hasilSimulasiBagiHasil', fn ($hasil): bool => $hasil !== null)
            ->set('masukanBagiHasil.operasional', '60000000')
            ->assertHasNoErrors()
            ->assertSee('Jumlah pendapatan')
            ->assertSee('Total operasional pemeliharaan')
            ->assertSee('Sisa akhir diperoleh')
            ->assertSee('Rekap pendapatan ABK')
            ->assertSee('Bagi hasil pemodal')
            ->assertDontSee('Hitung simulasi')
            ->assertSee('Muchrizan');

        $hasil = $komponen->get('hasilSimulasiBagiHasil');
        $this->assertNotNull($hasil);
        $this->assertSame($barisSimulasi['penjualan'], $hasil['pendapatan'][0]['jumlah']);
        $this->assertSame(60_000_000, $hasil['pengeluaran'][0]['jumlah']);
        $this->assertSame($operasionalAwal, $periode->kandangPeriode()->whereHas('kandang', fn ($query) => $query->where('nama', 'Kandang 2'))->firstOrFail()->fresh()->bagiHasil->operasional);
    }

    public function test_simulated_income_summary_is_visible_without_profit_sharing_assumptions(): void
    {
        $this->petakanPakanJuli();
        $periode = $this->periode('Periode Juli 2026');
        $periodeKandang = $periode->kandangPeriode()
            ->whereHas('kandang', fn ($query) => $query->where('nama', 'Kandang 2'))
            ->firstOrFail();
        $periodeKandang->bagiHasil->delete();
        $barisSimulasi = collect(LembarRhpp::simulasi($periode)['kandang']['baris'])->firstWhere('id', $periodeKandang->id);

        Livewire::withQueryParams(['periode' => $periode->id])
            ->test(Rhpp::class)
            ->call('pilihTab', 'bagi-hasil')
            ->assertSet('hasilSimulasiBagiHasil', null)
            ->assertSee('Jumlah pendapatan')
            ->assertSee('Rp '.Format::angka($barisSimulasi['laba']).' dari RHPP simulasi untuk bagi hasil')
            ->assertSee('Total operasional pemeliharaan')
            ->assertDontSee('Belum ada proyeksi panen Kandang 2');
    }

    public function test_simulated_profit_sharing_rejects_investor_shares_that_do_not_total_one_hundred_percent(): void
    {
        $this->petakanPakanJuli();
        $periode = $this->periode('Periode Juli 2026');

        Livewire::withQueryParams(['periode' => $periode->id])
            ->test(Rhpp::class)
            ->call('pilihTab', 'bagi-hasil')
            ->set('pemodalSimulasi.0.persen', '90')
            ->assertHasErrors(['pemodalSimulasi'])
            ->assertSee('Jumlah porsi seluruh pemodal harus tepat 100%.');
    }

    public function test_simulated_profit_sharing_uses_latest_assumptions_when_period_has_none(): void
    {
        $periode = $this->periode('Periode September 2026');

        Livewire::withQueryParams(['periode' => $periode->id])
            ->test(Rhpp::class)
            ->call('pilihTab', 'bagi-hasil')
            ->assertSet('masukanBagiHasil.operasional', '41276000')
            ->assertSet('abkSimulasi.0.nama', 'Frengky')
            ->assertSee('asumsi bagi hasil')
            ->assertSee('Periode Juli 2026');
    }

    public function test_simulation_allocates_total_harvest_to_the_only_populated_house_when_house_harvest_is_unassigned(): void
    {
        JenisPakan::query()
            ->whereIn('kode', ['SB-10', 'SB-11', 'SB-12'])
            ->update(['harga_per_kg' => 10135, 'kg_per_zak' => 50]);
        $periode = $this->periode('Periode September 2026');
        $periodeKandang = $periode->kandangPeriode()
            ->whereHas('kandang', fn ($query) => $query->where('nama', 'Kandang 2'))
            ->firstOrFail();
        $periode->notaPanen()->save(NotaPanen::factory()->make([
            'tanggal_panen' => '2026-10-05',
            'mulai' => '2026-10-05 22:00:00',
            'selesai' => '2026-10-05 23:00:00',
            'ekor' => 24_000,
            'berat_kg' => 53_000,
            'netto_nota_kg' => 53_000,
        ]));

        $simulasi = LembarRhpp::simulasi($this->periode('Periode September 2026'));
        $barisKandangDua = collect($simulasi['kandang']['baris'])->firstWhere('id', $periodeKandang->id);

        $this->assertNotNull($barisKandangDua);
        $this->assertSame(24_000, $barisKandangDua['ekor']);
        $this->assertSame(53_000.0, $barisKandangDua['berat']);
        $this->assertSame($simulasi['hasil']['penjualan'], $barisKandangDua['penjualan']);
        $this->assertSame($simulasi['hasil']['laba'], $barisKandangDua['laba']);

        $komponen = Livewire::withQueryParams(['periode' => $periode->id])
            ->test(Rhpp::class)
            ->call('pilihTab', 'bagi-hasil')
            ->assertSet('hasilSimulasiBagiHasil', fn ($hasil): bool => $hasil !== null)
            ->assertSee('Jumlah pendapatan')
            ->assertSee('Total operasional pemeliharaan')
            ->assertSee('Bagi hasil pemodal')
            ->assertDontSee('Belum ada proyeksi panen Kandang 2');

        $hasilBagiHasil = $komponen->get('hasilSimulasiBagiHasil');
        $this->assertNotNull($hasilBagiHasil);
        $this->assertSame($simulasi['hasil']['laba'], $hasilBagiHasil['ringkasan']['pendapatan']);
        $this->assertGreaterThan(0, $hasilBagiHasil['ringkasan']['pengeluaran']);
    }

    public function test_simulated_profit_sharing_loads_latest_operational_costs_from_house_two_cash_book(): void
    {
        $periode = $this->periode('Periode Juli 2026');
        $periodeKandang = $periode->kandangPeriode()
            ->whereHas('kandang', fn ($query) => $query->where('nama', 'Kandang 2'))
            ->firstOrFail();

        Livewire::withQueryParams(['periode' => $periode->id])
            ->test(Rhpp::class)
            ->call('pilihTab', 'bagi-hasil')
            ->assertSet('masukanBagiHasil.operasional', '54287239');

        $transaksi = $periodeKandang->transaksiKas()
            ->where('kategori', '!=', KategoriKas::DanaOperasional->value)
            ->whereNotIn('kategori', [
                KategoriKas::PinjamanMakan->value,
                KategoriKas::PinjamanAbk->value,
                KategoriKas::PinjamanKaryawan->value,
            ])
            ->firstOrFail();
        $transaksi->increment('jumlah', 100_000);

        Livewire::withQueryParams(['periode' => $periode->id])
            ->test(Rhpp::class)
            ->call('pilihTab', 'bagi-hasil')
            ->assertSet('masukanBagiHasil.operasional', '54387239');
    }

    public function test_tab_can_be_chosen_from_the_url_and_unknown_tabs_fall_back(): void
    {
        $periode = $this->periode('Periode Juli 2026');

        $this->get(route('rhpp', ['periode' => $periode->id]))->assertOk()->assertSee('Rekapitulasi pendapatan');
        $this->get(route('rhpp', ['periode' => $periode->id, 'tab' => 'real']))->assertOk()->assertSee('Rekapitulasi pendapatan');
        $this->get(route('rhpp', ['periode' => $periode->id, 'tab' => 'simulasi']))->assertOk()->assertSee('Rincian penjualan per nota timbang');
        $this->get(route('rhpp', ['periode' => $periode->id, 'tab' => 'bagi-hasil']))->assertOk()->assertSee('Simulasi bagi hasil Kandang 2');
        $this->get(route('rhpp', ['periode' => $periode->id, 'tab' => 'sapronak']))->assertOk()->assertSee('Perhitungan otomatis biaya sapronak');
        $this->get(route('rhpp', ['periode' => $periode->id, 'tab' => 'lain']))->assertOk()->assertSee('Rekapitulasi pendapatan');
    }

    public function test_page_explains_when_a_period_has_no_harvest_or_no_real_rhpp(): void
    {
        $september = $this->periode('Periode September 2026');
        $this->assertNull(LembarRhpp::simulasi($september));
        $this->get(route('rhpp', ['periode' => $september->id, 'tab' => 'simulasi']))->assertOk()->assertSee('Belum ada panen');
        $this->get(route('rhpp', ['periode' => $september->id, 'tab' => 'bagi-hasil']))
            ->assertOk()
            ->assertSee('Perhitungan baru tersedia setelah panen dan biaya sapronak')
            ->assertDontSee('Hitung simulasi');

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

    private function petakanPakanJuli(): void
    {
        $periode = $this->periode('Periode Juli 2026');
        $jenisPakan = JenisPakan::where('kode', 'SB-10')->firstOrFail();
        $jenisPakan->update(['harga_per_kg' => 10135, 'kg_per_zak' => 50]);

        PemberianPakan::whereIn('periode_kandang_id', $periode->kandangPeriode()->pluck('id'))
            ->update(['jenis_pakan_id' => $jenisPakan->id]);
        $periode->update(['rekap_pakan_zak' => 1540]);
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
