<?php

namespace Tests\Feature;

use App\Livewire\LogPemberianPakan;
use App\Models\JenisPakan;
use App\Models\PemberianPakan;
use App\Models\PenerimaanPakan;
use App\Models\Periode;
use App\Support\LembarRecording;
use App\Support\LogPakan;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Livewire\Livewire;
use Tests\TestCase;

class LogPemberianPakanTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-10-03');
    }

    /**
     * Angka dari log pemberian pakan KD 2, chick-in 11 September 2026.
     */
    public function test_log_matches_the_original_feed_log(): void
    {
        $this->seed(DatabaseSeeder::class);

        $log = $this->log('Periode September 2026');
        $hari = collect($log['hari'])->keyBy('umur');
        $idKandang = array_key_first($log['kandang']);

        $this->assertSame(['Kandang 2'], array_values($log['kandang']));
        $this->assertSame(699.0, $log['total']);

        $this->assertSame('2026-09-11', $hari[0]['tanggal']->format('Y-m-d'));
        $this->assertSame(9.0, $hari[0]['jenis'][0]['total']);
        $this->assertSame([], $hari[1]['jenis']);

        // Hari ke-10 berganti pakan: dua baris, SB-10 lalu SB-11.
        $this->assertSame(['SB-10', 'SB-11'], array_column($hari[10]['jenis'], 'jenis'));
        $this->assertSame([7.0, 17.0], array_column($hari[10]['jenis'], 'total'));
        $this->assertSame(60.0, $hari[21]['jenis'][0]['zak'][$idKandang]);
    }

    public function test_remaining_feed_per_type_is_deliveries_minus_the_log(): void
    {
        $this->seed(DatabaseSeeder::class);

        $log = $this->log('Periode September 2026');
        $stok = collect($log['per_jenis'])->mapWithKeys(fn (array $jenis): array => [$jenis['jenis'] => [$jenis['masuk'], $jenis['terpakai'], $jenis['sisa']]]);

        $this->assertSame([156.0, 156.0, 0.0], $stok['SB-10']);
        $this->assertSame([572.0, 543.0, 29.0], $stok['SB-11']);
        $this->assertSame([372.0, 0.0, 372.0], $stok['SB-12']);
        $this->assertSame([
            'masuk' => 1100.0,
            'masuk_kg' => 55000.0,
            'terpakai' => 699.0,
            'terpakai_kg' => 34950.0,
            'sisa' => 401.0,
            'sisa_kg' => 20050.0,
        ], $log['total_stok']);

        $this->get(route('pakan.log'))
            ->assertOk()
            ->assertSeeInOrder(['SB-10', 'Habis', 'SB-11', '29', 'SB-12', 'Belum dipakai', '372']);
    }

    public function test_remaining_feed_is_not_computed_when_feed_type_was_not_recorded(): void
    {
        $this->seed(DatabaseSeeder::class);

        $log = $this->log('Periode Juli 2026');

        $this->assertNull($log['per_jenis'][0]['sisa']);
        $this->assertSame(1540.0, $log['per_jenis'][0]['terpakai']);
        $this->assertNull($log['total_stok']['sisa']);
    }

    public function test_per_type_bag_weight_is_used_for_stock_and_recording(): void
    {
        $this->seed(DatabaseSeeder::class);

        JenisPakan::where('kode', 'SB-10')->firstOrFail()->update(['kg_per_zak' => 25]);
        $periode = Periode::where('nama', 'Periode September 2026')->firstOrFail();
        $log = $this->log('Periode September 2026');
        $stokSb10 = collect($log['per_jenis'])->firstWhere('jenis', 'SB-10');
        $periodeKandang = $periode->kandangPeriode()
            ->with(['periode', 'recordings', 'pemberianPakan'])
            ->whereHas('kandang', fn ($query) => $query->where('nama', 'Kandang 2'))
            ->firstOrFail();
        $barisTerakhir = collect(LembarRecording::baris($periodeKandang))
            ->filter(fn (array $baris): bool => $baris['terisi'])
            ->last();

        $this->assertSame(25.0, $stokSb10['kg_per_zak']);
        $this->assertSame(0.0, $stokSb10['sisa_kg']);
        $this->assertSame(31050.0, $log['total_kg']);
        $this->assertSame(31050.0, $barisTerakhir['pakan_kg_kumulatif']);
    }

    public function test_active_period_runs_to_today_and_finished_period_stops_at_its_last_entry(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(22, collect($this->log('Periode September 2026')['hari'])->last()['umur']);
        $this->assertSame(24, collect($this->log('Periode Juli 2026')['hari'])->last()['umur']);
    }

    public function test_row_total_sums_every_coop(): void
    {
        $this->seed(DatabaseSeeder::class);

        $log = $this->log('Periode Juli 2026');
        $hariPertama = $log['hari'][1]['jenis'][0];

        $this->assertSame(['Kandang 1', 'Kandang 2'], array_values($log['kandang']));
        $this->assertSame([7.0, 9.0], array_values($hariPertama['zak']));
        $this->assertSame(16.0, $hariPertama['total']);
        $this->assertNull($hariPertama['jenis']);
        $this->assertSame([690.0, 850.0], array_values($log['total_kandang']));
        $this->assertSame(1540.0, $log['total']);
    }

    public function test_page_shows_the_log_for_each_period(): void
    {
        $this->get(route('pakan.log'))->assertOk()->assertSee('Belum ada periode');

        $this->seed(DatabaseSeeder::class);
        Periode::where('nama', 'Periode September 2026')->update(['status' => 'berjalan']);

        $this->get(route('pakan.log'))
            ->assertOk()
            ->assertSeeInOrder(['Log harian pemberian pakan', 'Daftar pakan masuk'])
            ->assertSee('Log harian pemberian pakan')
            ->assertSee('Daftar pakan masuk')
            ->assertDontSee('Daftar pemberian pakan')
            ->assertDontSee('Kelola catatan')
            ->assertSeeInOrder(['Kandang 2 (zak)', 'Total (kg)', 'Aksi'])
            ->assertSee('Ubah')
            ->assertSee('Hapus')
            ->assertSee('Tambah pakan masuk')
            ->assertSee('Tambah pemberian')
            ->assertSeeHtml('id="modal-form-pakan"')
            ->assertSeeHtml('wire:submit="simpan"')
            ->assertSeeHtml('data-bs-target="#modal-form-pakan"')
            ->assertSee('Kandang 2 (zak)')
            ->assertDontSee('Kandang 1 (zak)')
            ->assertSee('Jum, 11 Sep 2026');

        $juli = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();

        $this->get(route('pakan.log', ['periode' => $juli->id]))
            ->assertOk()
            ->assertSee('Kandang 1 (zak)')
            ->assertSee('Kandang 2 (zak)');
    }

    public function test_feed_page_does_not_show_transfer_controls_or_stock_labels(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->get(route('pakan.log'))
            ->assertOk()
            ->assertDontSee('Daftar transfer pakan')
            ->assertDontSee('Transfer pakan ke kandang')
            ->assertDontSee('Dipindahkan ke kandang')
            ->assertDontSee('Stok di farm');
    }

    public function test_feed_receipts_can_be_created_updated_and_deleted_from_the_feed_and_stock_page(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = Periode::where('nama', 'Periode September 2026')->firstOrFail();
        $periode->update(['status' => 'berjalan']);
        $jenisPakan = JenisPakan::where('kode', 'SB-10')->firstOrFail();

        $halaman = Livewire::withQueryParams(['periode' => $periode->id])
            ->test(LogPemberianPakan::class)
            ->call('tambahPenerimaan')
            ->set('tanggal', '2026-10-03')
            ->set('jenisPakanId', (string) $jenisPakan->id)
            ->set('zak', '4.5')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSee('Pakan masuk SB-10 ditambahkan.')
            ->assertSee('4,5');

        $penerimaan = PenerimaanPakan::query()
            ->where('periode_id', $periode->id)
            ->where('jenis_pakan_id', $jenisPakan->id)
            ->where('zak', 4.5)
            ->firstOrFail();
        $this->assertDatabaseHas('aktivitas', ['modul' => 'pakan-dan-stok', 'jenis' => 'tambah']);

        $halaman->call('ubahPenerimaan', $penerimaan->id)
            ->set('tanggal', '2026-10-02')
            ->set('zak', '6')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSee('Pakan masuk SB-10 diperbarui.')
            ->assertSee('6');

        $this->assertDatabaseHas('penerimaan_pakans', [
            'id' => $penerimaan->id,
            'zak' => 6,
        ]);
        $this->assertSame('2026-10-02', $penerimaan->fresh()->tanggal->toDateString());

        $halaman->call('mintaHapusPenerimaan', $penerimaan->id)
            ->call('hapus')
            ->assertHasNoErrors()
            ->assertSee('Pakan masuk SB-10 dihapus.');

        $this->assertDatabaseMissing('penerimaan_pakans', ['id' => $penerimaan->id]);
        $this->assertDatabaseHas('aktivitas', ['modul' => 'pakan-dan-stok', 'jenis' => 'hapus']);
    }

    public function test_feed_issues_can_be_created_updated_and_deleted_with_their_period_age(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = Periode::where('nama', 'Periode September 2026')->firstOrFail();
        $periode->update(['status' => 'berjalan']);
        $kandang = $periode->kandangPeriode()
            ->whereHas('kandang', fn ($query) => $query->where('nama', 'Kandang 2'))
            ->firstOrFail();
        $jenisPakan = JenisPakan::where('kode', 'SB-12')->firstOrFail();

        $halaman = Livewire::withQueryParams(['periode' => $periode->id])
            ->test(LogPemberianPakan::class)
            ->call('tambahPemberian')
            ->set('tanggal', '2026-10-03')
            ->set('jenisPakanId', (string) $jenisPakan->id)
            ->set('periodeKandangId', (string) $kandang->id)
            ->set('zak', '2.5')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSee('Pemberian pakan SB-12 Kandang 2 ditambahkan.');

        $pemberian = PemberianPakan::query()
            ->where('periode_kandang_id', $kandang->id)
            ->where('jenis_pakan_id', $jenisPakan->id)
            ->where('zak', 2.5)
            ->firstOrFail();
        $this->assertSame(22, $pemberian->umur);
        $halaman->assertSee('2,5');

        $halaman->call('ubahPemberian', $pemberian->id)
            ->set('tanggal', '2026-10-02')
            ->set('zak', '3')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSee('Pemberian pakan SB-12 Kandang 2 diperbarui.');

        $this->assertDatabaseHas('pemberian_pakans', [
            'id' => $pemberian->id,
            'umur' => 21,
            'zak' => 3,
        ]);
        $this->assertSame('2026-10-02', $pemberian->fresh()->tanggal->toDateString());

        $halaman->call('mintaHapusPemberian', $pemberian->id)
            ->call('hapus')
            ->assertHasNoErrors()
            ->assertSee('Pemberian pakan SB-12 Kandang 2 dihapus.');

        $this->assertDatabaseMissing('pemberian_pakans', ['id' => $pemberian->id]);
    }

    public function test_feed_transfers_are_no_longer_supported_from_the_feed_page(): void
    {
        $this->seed(DatabaseSeeder::class);
        $periode = Periode::where('nama', 'Periode September 2026')->firstOrFail();

        Livewire::withQueryParams(['periode' => $periode->id])
            ->test(LogPemberianPakan::class)
            ->call('tambahPemberian')
            ->set('tipeForm', 'transfer')
            ->set('tanggal', '2026-10-03')
            ->set('zak', '10')
            ->call('simpan')
            ->assertHasErrors(['tipeForm']);

        $this->assertDatabaseCount('transfer_pakans', 0);
    }

    public function test_feed_record_mutations_are_scoped_to_the_selected_period_and_reject_future_dates(): void
    {
        $this->seed(DatabaseSeeder::class);
        $juli = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
        $september = Periode::where('nama', 'Periode September 2026')->firstOrFail();
        $penerimaanJuli = PenerimaanPakan::factory()->create([
            'periode_id' => $juli->id,
            'jenis_pakan_id' => JenisPakan::where('kode', 'SB-10')->firstOrFail()->id,
            'tanggal' => $juli->tanggal_chick_in,
        ]);

        Livewire::withQueryParams(['periode' => $september->id])
            ->test(LogPemberianPakan::class)
            ->call('ubahPenerimaan', $penerimaanJuli->id)
            ->assertNotFound();

        Livewire::withQueryParams(['periode' => $september->id])
            ->test(LogPemberianPakan::class)
            ->call('tambahPenerimaan')
            ->set('tanggal', '2026-10-04')
            ->set('jenisPakanId', (string) JenisPakan::where('kode', 'SB-10')->firstOrFail()->id)
            ->set('zak', '1')
            ->call('simpan')
            ->assertHasErrors(['tanggal' => 'before_or_equal']);
    }

    /**
     * @return array<string, mixed>
     */
    private function log(string $namaPeriode): array
    {
        $periode = Periode::with(['kandangPeriode.kandang', 'kandangPeriode.pemberianPakan.jenisPakan', 'penerimaanPakan.jenisPakan'])
            ->where('nama', $namaPeriode)
            ->firstOrFail();

        return LogPakan::buat($periode);
    }
}
