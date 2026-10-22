<?php

namespace Tests\Feature;

use App\Livewire\ManajemenPeriode;
use App\Models\Farm;
use App\Models\Kandang;
use App\Models\Pengaturan;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use App\Models\Recording;
use App\Support\LembarRecording;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class ManajemenPeriodeTest extends TestCase
{
    use RefreshDatabase;

    public function test_period_page_shows_period_details_and_module_links(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = Periode::query()->where('nama', 'Periode Juli 2026')->firstOrFail();

        $this->get(route('periode.index', ['periode' => $periode->id]))
            ->assertOk()
            ->assertSee('Periode September 2026')
            ->assertSee('Kandang 2')
            ->assertSee('Farm / Gabungan')
            ->assertSee('Stok gudang tercatat')
            ->assertSee('Biaya bersama')
            ->assertSee('Master data dan kesiapan periode')
            ->assertSee(e(route('recording.harian', ['periode' => $periode->id, 'kandang' => $periode->kandangPeriode->first()->id])), false)
            ->assertSee(e(route('bagi.hasil', ['kandang' => $periode->kandangPeriode->first()->kandang_id, 'periode' => $periode->id])), false);
    }

    public function test_period_page_shows_the_active_period_summary(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = Periode::query()->where('nama', 'Periode September 2026')->firstOrFail();

        $this->get(route('periode.index', ['periode' => $periode->id]))
            ->assertOk()
            ->assertSee('Periode aktif')
            ->assertSee('DOC chick-in')
            ->assertSee('26.000 ekor')
            ->assertSee('Kandang farm')
            ->assertSee('Total DOC chick-in periode ini')
            ->assertSee('Jumlah DOC chick-in (ekor)')
            ->assertSee('sedang dikerjakan');
    }

    public function test_periods_can_be_created_and_updated(): void
    {
        Livewire::test(ManajemenPeriode::class)
            ->call('tambahPeriode')
            ->set('nama', 'Periode Baru')
            ->set('nomorSiklus', '20')
            ->set('inti', 'PT. Indojaya Agrinusa')
            ->set('ppl', 'PPL Baru')
            ->set('strain', 'Standar farm')
            ->set('tanggalChickIn', '2026-10-15')
            ->set('beratDocGram', '38')
            ->set('status', 'persiapan')
            ->call('simpanPeriode')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Periode Periode Baru ditambahkan.')
            ->assertSee('Periode Baru');

        $periode = Periode::query()->where('nama', 'Periode Baru')->firstOrFail();

        Livewire::test(ManajemenPeriode::class)
            ->call('ubahPeriode', $periode->id)
            ->set('nama', 'Periode Baru Selesai')
            ->set('status', 'berjalan')
            ->call('simpanPeriode')
            ->assertHasNoErrors()
            ->assertSee('Periode Baru Selesai');

        $this->assertDatabaseHas('periodes', [
            'id' => $periode->id,
            'nama' => 'Periode Baru Selesai',
            'nomor_siklus' => 20,
            'inti' => 'PT. Indojaya Agrinusa',
            'ppl' => 'PPL Baru',
            'status' => 'berjalan',
        ]);
    }

    public function test_farms_can_be_created_and_periods_and_houses_are_scoped_to_the_selected_farm(): void
    {
        $this->seed(DatabaseSeeder::class);
        $kandangFarmUtama = Kandang::query()->where('nama', 'Kandang 1')->firstOrFail();

        Livewire::test(ManajemenPeriode::class)
            ->call('tambahFarm')
            ->set('namaFarm', 'Farm Kedua')
            ->set('kodeFarm', 'F002')
            ->call('simpanFarm')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Farm Farm Kedua ditambahkan.')
            ->assertSee('Farm Kedua');

        $farmKedua = Farm::query()->where('kode', 'F002')->firstOrFail();
        $periodeKedua = Periode::query()->create([
            'farm_id' => $farmKedua->id,
            'nama' => 'Periode Juli 2026',
            'nomor_siklus' => 18,
            'inti' => 'Inti Farm Kedua',
            'ppl' => 'PPL Farm Kedua',
            'strain' => 'Standar farm',
            'tanggal_chick_in' => '2026-07-15',
            'berat_doc_gram' => 37,
            'status' => 'berjalan',
        ]);

        Livewire::withQueryParams(['farm' => $farmKedua->id, 'periode' => $periodeKedua->id])
            ->test(ManajemenPeriode::class)
            ->assertSee('Farm Kedua')
            ->assertSee('Periode Juli 2026')
            ->assertDontSee('Periode September 2026')
            ->call('tambahKandang')
            ->set('kandangId', (string) $kandangFarmUtama->id)
            ->set('populasiAwal', '100')
            ->set('tanggalChickInKandang', '2026-07-15')
            ->set('beratDocGramKandang', '37')
            ->call('simpanKandang')
            ->assertHasErrors(['kandangId' => 'exists']);

        $this->assertDatabaseMissing('periode_kandangs', [
            'periode_id' => $periodeKedua->id,
            'kandang_id' => $kandangFarmUtama->id,
        ]);

        $this->get(route('kas.operasional', ['kandang' => $kandangFarmUtama->id, 'farm' => $farmKedua->id]))
            ->assertNotFound();
    }

    public function test_empty_period_identity_can_be_filled_in_after_transactions_are_recorded(): void
    {
        $this->seed(DatabaseSeeder::class);
        $farm = Farm::query()->where('kode', 'K0242')->firstOrFail();
        $periode = Periode::query()->create([
            'farm_id' => $farm->id,
            'nama' => 'Periode Tanpa Identitas',
            'nomor_siklus' => null,
            'inti' => null,
            'ppl' => null,
            'strain' => 'Standar farm',
            'tanggal_chick_in' => '2026-10-01',
            'berat_doc_gram' => 37,
            'status' => 'berjalan',
        ]);
        $kandang = Kandang::query()->where('nama', 'Kandang 1')->firstOrFail();
        $periodeKandang = PeriodeKandang::query()->create([
            'periode_id' => $periode->id,
            'kandang_id' => $kandang->id,
            'populasi_awal' => 20000,
        ]);
        Recording::query()->create([
            'periode_kandang_id' => $periodeKandang->id,
            'tanggal' => '2026-10-02',
            'umur' => 1,
            'mati' => 3,
            'afkir' => 0,
        ]);

        Livewire::withQueryParams(['farm' => $farm->id, 'periode' => $periode->id])
            ->test(ManajemenPeriode::class)
            ->call('ubahPeriode', $periode->id)
            ->set('nomorSiklus', '23')
            ->set('inti', 'PT. Indojaya Agrinusa')
            ->set('ppl', 'PPL Baru')
            ->call('simpanPeriode')
            ->assertHasNoErrors();

        $this->assertDatabaseHas('periodes', [
            'id' => $periode->id,
            'nomor_siklus' => 23,
            'inti' => 'PT. Indojaya Agrinusa',
            'ppl' => 'PPL Baru',
        ]);
    }

    public function test_period_baseline_cannot_be_changed_and_a_period_with_transactions_cannot_be_deleted(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = Periode::query()->where('nama', 'Periode September 2026')->firstOrFail();

        Livewire::withQueryParams(['periode' => $periode->id])
            ->test(ManajemenPeriode::class)
            ->call('ubahPeriode', $periode->id)
            ->set('tanggalChickIn', '2026-09-12')
            ->call('simpanPeriode')
            ->assertHasErrors('periodeForm');

        Livewire::withQueryParams(['periode' => $periode->id])
            ->test(ManajemenPeriode::class)
            ->call('mintaHapusPeriode', $periode->id)
            ->call('hapusPeriode')
            ->assertHasErrors('hapusPeriode');

        $this->assertSame('2026-09-11', $periode->fresh()->tanggal_chick_in->toDateString());
    }

    public function test_initial_population_cannot_exceed_the_selected_house_capacity(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = Periode::query()->where('nama', 'Periode September 2026')->firstOrFail();
        $kandang = Kandang::query()->create(['nama' => 'Kandang Uji', 'kapasitas' => 15000]);

        Livewire::withQueryParams(['periode' => $periode->id])
            ->test(ManajemenPeriode::class)
            ->assertSet('periodeId', $periode->id)
            ->call('tambahKandang')
            ->set('kandangId', (string) $kandang->id)
            ->set('populasiAwal', (string) ($kandang->kapasitas + 1))
            ->call('simpanKandang')
            ->assertHasErrors('populasiAwal');

        $this->assertDatabaseMissing('periode_kandangs', [
            'periode_id' => $periode->id,
            'kandang_id' => $kandang->id,
        ]);
    }

    public function test_empty_house_can_be_added_to_and_removed_from_a_period(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = Periode::query()->where('nama', 'Periode September 2026')->firstOrFail();
        $kandang = Kandang::query()->create(['nama' => 'Kandang Uji', 'kapasitas' => 15000]);

        Livewire::withQueryParams(['periode' => $periode->id])
            ->test(ManajemenPeriode::class)
            ->call('tambahKandang')
            ->set('kandangId', (string) $kandang->id)
            ->set('populasiAwal', (string) $kandang->kapasitas)
            ->call('simpanKandang')
            ->assertHasNoErrors()
            ->assertSee('Kandang Uji');

        $periodeKandang = PeriodeKandang::query()
            ->where('periode_id', $periode->id)
            ->where('kandang_id', $kandang->id)
            ->firstOrFail();

        Livewire::withQueryParams(['periode' => $periode->id])
            ->test(ManajemenPeriode::class)
            ->call('mintaHapusKandang', $periodeKandang->id)
            ->call('hapusKandang')
            ->assertHasNoErrors();

        $this->assertDatabaseMissing('periode_kandangs', ['id' => $periodeKandang->id]);
    }

    public function test_house_with_records_can_still_have_its_doc_population_and_price_corrected(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = Periode::query()->where('nama', 'Periode September 2026')->firstOrFail();
        $kandang = Kandang::query()->where('nama', 'Kandang 2')->firstOrFail();
        $periodeKandang = PeriodeKandang::query()
            ->where('periode_id', $periode->id)
            ->where('kandang_id', $kandang->id)
            ->firstOrFail();

        $this->assertTrue($periodeKandang->punyaCatatan());

        // Kandang 2 sudah penuh, jadi kapasitasnya dinaikkan lebih dulu lewat master kandang.
        Livewire::withQueryParams(['farm' => $periode->farm_id, 'periode' => $periode->id])
            ->test(ManajemenPeriode::class)
            ->call('ubahKandangMaster', $kandang->id)
            ->set('kandangMasterKapasitas', '30000')
            ->call('simpanKandangMaster')
            ->assertHasNoErrors();

        Livewire::withQueryParams(['farm' => $periode->farm_id, 'periode' => $periode->id])
            ->test(ManajemenPeriode::class)
            ->call('ubahKandang', $periodeKandang->id)
            ->assertSet('populasiAwal', '26000')
            ->set('populasiAwal', '26500')
            ->set('bonusDocEkor', '500')
            ->set('hargaDocPerEkor', '9500')
            ->call('simpanKandang')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Kandang Kandang 2 diperbarui.');

        $periodeKandang->refresh();
        $this->assertSame(26500, $periodeKandang->populasi_awal);
        $this->assertSame(500, $periodeKandang->bonus_doc_ekor);
        $this->assertSame(9500, $periodeKandang->harga_doc_per_ekor);
        $this->assertSame(27000, $periode->fresh()->totalDocChickIn());

        $this->assertDatabaseHas('aktivitas', [
            'subjek' => 'Kandang Kandang 2 pada Periode September 2026',
            'rincian' => 'populasi awal 26.000 menjadi 26.500 ekor; bonus DOC 0 menjadi 500 ekor; harga DOC Rp 9.415 menjadi Rp 9.500/ekor',
        ]);
    }

    public function test_house_with_records_keeps_its_cage_and_doc_parameters_locked(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = Periode::query()->where('nama', 'Periode September 2026')->firstOrFail();
        $kandang = Kandang::query()->where('nama', 'Kandang 2')->firstOrFail();
        $periodeKandang = PeriodeKandang::query()
            ->where('periode_id', $periode->id)
            ->where('kandang_id', $kandang->id)
            ->firstOrFail();

        Livewire::withQueryParams(['farm' => $periode->farm_id, 'periode' => $periode->id])
            ->test(ManajemenPeriode::class)
            ->call('ubahKandang', $periodeKandang->id)
            ->set('tanggalChickInKandang', '2026-09-12')
            ->call('simpanKandang')
            ->assertHasErrors('kandangForm');

        $this->assertSame('2026-09-11', $periodeKandang->fresh()->tanggal_chick_in->toDateString());
    }

    public function test_house_population_cannot_drop_below_recorded_mortality(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = Periode::query()->where('nama', 'Periode September 2026')->firstOrFail();
        $kandang = Kandang::query()->where('nama', 'Kandang 2')->firstOrFail();
        $periodeKandang = PeriodeKandang::query()
            ->where('periode_id', $periode->id)
            ->where('kandang_id', $kandang->id)
            ->firstOrFail();

        Livewire::withQueryParams(['farm' => $periode->farm_id, 'periode' => $periode->id])
            ->test(ManajemenPeriode::class)
            ->call('ubahKandang', $periodeKandang->id)
            ->set('populasiAwal', '500')
            ->call('simpanKandang')
            ->assertHasErrors('populasiAwal');

        $this->assertSame(26000, $periodeKandang->fresh()->populasi_awal);
    }

    public function test_house_cycle_stores_individual_doc_details_and_bonus_population(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = Periode::query()->where('nama', 'Periode September 2026')->firstOrFail();
        $kandang = Kandang::query()->create([
            'farm_id' => $periode->farm_id,
            'nama' => 'Kandang Uji DOC',
            'kapasitas' => 25000,
        ]);

        Livewire::withQueryParams(['farm' => $periode->farm_id, 'periode' => $periode->id])
            ->test(ManajemenPeriode::class)
            ->call('tambahKandang')
            ->set('kandangId', (string) $kandang->id)
            ->set('populasiAwal', '24000')
            ->set('tanggalChickInKandang', '2026-10-10')
            ->set('beratDocGramKandang', '42')
            ->set('hargaDocPerEkor', '9500')
            ->set('bonusDocEkor', '1000')
            ->call('simpanKandang')
            ->assertHasNoErrors();

        $periodeKandang = PeriodeKandang::query()
            ->where('periode_id', $periode->id)
            ->where('kandang_id', $kandang->id)
            ->firstOrFail();

        $this->assertSame(25000, $periodeKandang->populasiAktual());
        $this->assertSame('2026-10-10', $periodeKandang->tanggalChickInEfektif()->toDateString());
        $this->assertSame(42, $periodeKandang->beratDocGramEfektif());
        $barisUmurSatu = collect(LembarRecording::baris($periodeKandang))->firstWhere('umur', 1);
        $this->assertSame('2026-10-11', $barisUmurSatu['tanggal']->toDateString());
        $this->assertSame(25000, $barisUmurSatu['saldo']);
    }

    public function test_period_cannot_be_closed_before_real_rhpp_is_available(): void
    {
        Livewire::test(ManajemenPeriode::class)
            ->call('tambahPeriode')
            ->set('nama', 'Periode Belum RHPP')
            ->set('nomorSiklus', '21')
            ->set('inti', 'PT. Indojaya Agrinusa')
            ->set('ppl', 'PPL Baru')
            ->set('strain', 'Standar farm')
            ->set('tanggalChickIn', '2026-10-16')
            ->set('beratDocGram', '37')
            ->set('status', 'tutup_rhpp')
            ->call('simpanPeriode')
            ->assertHasErrors('periodeForm')
            ->assertSee('RHPP real harus tersedia');

        $this->assertDatabaseMissing('periodes', ['nama' => 'Periode Belum RHPP']);
    }

    public function test_the_active_period_can_be_switched_from_the_period_list(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periodeJuli = Periode::query()->where('nama', 'Periode Juli 2026')->firstOrFail();
        $periodeSeptember = Periode::query()->where('nama', 'Periode September 2026')->firstOrFail();

        Livewire::withQueryParams(['periode' => $periodeSeptember->id])
            ->test(ManajemenPeriode::class)
            ->assertSet('periodeId', $periodeSeptember->id)
            ->call('pilihPeriode', $periodeJuli->id)
            ->assertSet('periodeId', $periodeJuli->id)
            ->assertSee('Periode Juli 2026')
            ->assertSee('Periode aktif');
    }

    public function test_doc_chick_in_total_can_be_changed_from_the_period_form(): void
    {
        [$periode, $kandangSatu, $kandangDua] = $this->periodeUjiDenganDuaKandang();

        $this->assertSame(45000, $periode->totalDocChickIn());

        Livewire::withQueryParams(['farm' => $periode->farm_id, 'periode' => $periode->id])
            ->test(ManajemenPeriode::class)
            ->call('ubahPeriode', $periode->id)
            ->assertSet('jumlahDocChickIn', '45000')
            ->set('jumlahDocChickIn', '46000')
            ->call('simpanPeriode')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Periode Periode Uji diperbarui.');

        $this->assertSame(46000, $periode->fresh()->totalDocChickIn());
        $this->assertSame(20444, $kandangSatu->fresh()->populasi_awal);
        $this->assertSame(25556, $kandangDua->fresh()->populasi_awal);

        $this->assertDatabaseHas('aktivitas', [
            'subjek' => 'Periode Periode Uji',
            'rincian' => 'Jumlah DOC chick-in 45.000 menjadi 46.000 ekor',
        ]);
    }

    public function test_doc_chick_in_total_is_kept_when_the_period_form_is_saved_unchanged(): void
    {
        [$periode, $kandangSatu, $kandangDua] = $this->periodeUjiDenganDuaKandang();

        Livewire::withQueryParams(['farm' => $periode->farm_id, 'periode' => $periode->id])
            ->test(ManajemenPeriode::class)
            ->call('ubahPeriode', $periode->id)
            ->set('inti', 'PT. Indojaya Agrinusa')
            ->call('simpanPeriode')
            ->assertHasNoErrors();

        $this->assertSame(45000, $periode->fresh()->totalDocChickIn());
        $this->assertSame(20000, $kandangSatu->fresh()->populasi_awal);
        $this->assertSame(25000, $kandangDua->fresh()->populasi_awal);
    }

    public function test_doc_chick_in_total_cannot_exceed_house_capacity(): void
    {
        [$periode] = $this->periodeUjiDenganDuaKandang();

        Livewire::withQueryParams(['farm' => $periode->farm_id, 'periode' => $periode->id])
            ->test(ManajemenPeriode::class)
            ->call('ubahPeriode', $periode->id)
            ->set('jumlahDocChickIn', '70000')
            ->call('simpanPeriode')
            ->assertHasErrors('jumlahDocChickIn');

        $this->assertSame(45000, $periode->fresh()->totalDocChickIn());
    }

    public function test_doc_chick_in_total_cannot_go_below_recorded_mortality(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = Periode::query()->where('nama', 'Periode September 2026')->firstOrFail();

        Livewire::withQueryParams(['farm' => $periode->farm_id, 'periode' => $periode->id])
            ->test(ManajemenPeriode::class)
            ->call('ubahPeriode', $periode->id)
            ->assertSet('jumlahDocChickIn', '26000')
            ->set('jumlahDocChickIn', '500')
            ->call('simpanPeriode')
            ->assertHasErrors('jumlahDocChickIn');

        $this->assertSame(26000, $periode->fresh()->totalDocChickIn());
    }

    public function test_locked_bagi_hasil_sheet_can_be_opened_from_the_period_page(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = Periode::query()->where('nama', 'Periode Juli 2026')->firstOrFail();
        $kandang = Kandang::query()->where('nama', 'Kandang 2')->firstOrFail();
        $periodeKandang = PeriodeKandang::query()
            ->where('periode_id', $periode->id)
            ->where('kandang_id', $kandang->id)
            ->firstOrFail();
        Pengaturan::setPasswordAdmin('rahasia123');
        $periodeKandang->bagiHasil->update(['status' => 'dikunci']);

        Livewire::withQueryParams(['farm' => $periode->farm_id, 'periode' => $periode->id])
            ->test(ManajemenPeriode::class)
            ->assertSee('Buka kunci bagi hasil')
            ->call('bukaModalBukaKunciBagiHasil', $periodeKandang->id)
            ->set('sandiAdmin', 'salah')
            ->call('bukaKunciBagiHasil')
            ->assertHasErrors(['sandiAdmin']);

        $this->assertSame('dikunci', $periodeKandang->fresh()->bagiHasil->status);

        Livewire::withQueryParams(['farm' => $periode->farm_id, 'periode' => $periode->id])
            ->test(ManajemenPeriode::class)
            ->call('bukaModalBukaKunciBagiHasil', $periodeKandang->id)
            ->set('sandiAdmin', 'rahasia123')
            ->call('bukaKunciBagiHasil')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Lembar bagi hasil Kandang 2 dibuka kembali.');

        $this->assertSame('sementara', $periodeKandang->fresh()->bagiHasil->status);
        $this->assertDatabaseHas('aktivitas', [
            'subjek' => 'Bagi hasil Kandang 2 pada Periode Juli 2026',
            'rincian' => 'Lembar dibuka kembali dengan password admin',
        ]);
    }

    public function test_farm_houses_can_be_created_and_their_capacity_updated(): void
    {
        $this->seed(DatabaseSeeder::class);
        $farm = Farm::query()->where('kode', 'K0242')->firstOrFail();

        Livewire::withQueryParams(['farm' => $farm->id])
            ->test(ManajemenPeriode::class)
            ->call('tambahKandangMaster')
            ->set('kandangMasterNama', 'Kandang 3')
            ->set('kandangMasterKapasitas', '15000')
            ->call('simpanKandangMaster')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Kandang 3 ditambahkan.');

        $kandang = Kandang::query()->where('nama', 'Kandang 3')->firstOrFail();
        $this->assertSame(15000, $kandang->kapasitas);

        Livewire::withQueryParams(['farm' => $farm->id])
            ->test(ManajemenPeriode::class)
            ->call('ubahKandangMaster', $kandang->id)
            ->set('kandangMasterKapasitas', '18000')
            ->call('simpanKandangMaster')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Kandang 3 diperbarui.');

        $this->assertSame(18000, $kandang->fresh()->kapasitas);
    }

    public function test_a_house_used_by_a_period_cannot_be_deleted_from_the_farm(): void
    {
        $this->seed(DatabaseSeeder::class);
        $farm = Farm::query()->where('kode', 'K0242')->firstOrFail();
        $kandang = Kandang::query()->where('nama', 'Kandang 1')->firstOrFail();

        Livewire::withQueryParams(['farm' => $farm->id])
            ->test(ManajemenPeriode::class)
            ->call('mintaHapusKandangMaster', $kandang->id)
            ->call('hapusKandangMaster')
            ->assertHasErrors('hapusKandangMaster');

        $this->assertDatabaseHas('kandangs', ['id' => $kandang->id]);
    }

    /**
     * Periode uji dengan dua kandang, populasi 20.000 dan 25.000 ekor, kapasitas 30.000 ekor per kandang.
     *
     * @return array{0: Periode, 1: PeriodeKandang, 2: PeriodeKandang}
     */
    private function periodeUjiDenganDuaKandang(): array
    {
        $this->seed(DatabaseSeeder::class);
        $farm = Farm::query()->where('kode', 'K0242')->firstOrFail();

        $kandangSatu = Kandang::query()->create(['farm_id' => $farm->id, 'nama' => 'Kandang Uji 1', 'kapasitas' => 30000]);
        $kandangDua = Kandang::query()->create(['farm_id' => $farm->id, 'nama' => 'Kandang Uji 2', 'kapasitas' => 30000]);

        $periode = Periode::query()->create([
            'farm_id' => $farm->id,
            'nama' => 'Periode Uji',
            'nomor_siklus' => 22,
            'inti' => 'PT. Indojaya Agrinusa',
            'ppl' => 'PPL Uji',
            'strain' => 'Standar farm',
            'tanggal_chick_in' => '2026-10-01',
            'berat_doc_gram' => 37,
            'status' => 'berjalan',
        ]);

        $satu = PeriodeKandang::query()->create([
            'periode_id' => $periode->id,
            'kandang_id' => $kandangSatu->id,
            'populasi_awal' => 20000,
            'tanggal_chick_in' => '2026-10-01',
            'berat_doc_gram' => 37,
            'harga_doc_per_ekor' => 9415,
            'bonus_doc_ekor' => 0,
        ]);

        $dua = PeriodeKandang::query()->create([
            'periode_id' => $periode->id,
            'kandang_id' => $kandangDua->id,
            'populasi_awal' => 25000,
            'tanggal_chick_in' => '2026-10-01',
            'berat_doc_gram' => 37,
            'harga_doc_per_ekor' => 9415,
            'bonus_doc_ekor' => 0,
        ]);

        return [$periode, $satu, $dua];
    }
}
