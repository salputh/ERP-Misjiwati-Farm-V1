<?php

namespace Tests\Feature;

use App\Enums\KategoriKas;
use App\Enums\ModulAktivitas;
use App\Livewire\KasOperasional;
use App\Models\Aktivitas;
use App\Models\Kandang;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use App\Models\TransaksiKas;
use App\Support\BukuKas;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\KasOperasionalSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class KasOperasionalTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DatabaseSeeder::class);
    }

    /**
     * Angka dari "Ringkasan Operasional" di lembar "Laporan Biaya Operasional — Kandang 2".
     */
    public function test_summary_matches_the_original_sheet(): void
    {
        $ringkasan = $this->buku('Kandang 2')['ringkasan'];

        $this->assertSame(45_000_000, $ringkasan['masuk']);
        $this->assertSame(67_327_239, $ringkasan['keluar']);
        $this->assertSame(-22_327_239, $ringkasan['selisih']);
        $this->assertSame(13_040_000, $ringkasan['pinjaman']);
        $this->assertSame(54_287_239, $ringkasan['biaya']);
        $this->assertSame([4, 120, 20, 100, 14], [$ringkasan['jumlah_masuk'], $ringkasan['jumlah_keluar'], $ringkasan['jumlah_pinjaman'], $ringkasan['jumlah_biaya'], $ringkasan['jumlah_kategori']]);
    }

    public function test_fund_history_accumulates_each_deposit(): void
    {
        $dana = $this->buku('Kandang 2')['dana'];

        $this->assertSame(['2026-07-09', '2026-07-13', '2026-07-25', '2026-09-01'], array_map(fn (array $setoran): string => $setoran['tanggal']->toDateString(), $dana));
        $this->assertSame([10_000_000, 10_000_000, 15_000_000, 10_000_000], array_column($dana, 'jumlah'));
        $this->assertSame([10_000_000, 20_000_000, 35_000_000, 45_000_000], array_column($dana, 'saldo'));
    }

    /**
     * Angka dari tabel kategori di lembar yang sama; di halaman diurutkan dari yang terbesar.
     */
    public function test_category_totals_match_the_original_sheet(): void
    {
        $buku = $this->buku('Kandang 2');
        $biaya = collect($buku['biaya'])->mapWithKeys(fn (array $baris): array => [$baris['kategori']->label() => $baris['jumlah']])->all();
        $pinjaman = collect($buku['pinjaman'])->mapWithKeys(fn (array $baris): array => [$baris['kategori']->label() => $baris['jumlah']])->all();

        $this->assertSame([
            'Maintenance' => 19_155_000,
            'PLN & Kelistrikan' => 6_550_000,
            'Upah' => 5_882_439,
            'Gas' => 5_880_000,
            'Biaya Sewa Lahan' => 4_874_800,
            'Obat Ayam' => 4_550_000,
            'Lain-lain' => 4_350_000,
            'Solar' => 1_500_000,
            'Meal & Drink' => 848_000,
            'Berobat' => 577_000,
            'Transport' => 70_000,
            'Entertain' => 50_000,
        ], $biaya);
        $this->assertSame(['Pinjaman Makan (Uang Makan)' => 11_650_000, 'Pinjaman ABK' => 1_390_000], $pinjaman);

        $this->assertSame([54, 28.5], [$buku['biaya'][0]['transaksi'], round($buku['biaya'][0]['persen'], 1)]);
        $this->assertEqualsWithDelta(100.0, array_sum(array_column([...$buku['biaya'], ...$buku['pinjaman']], 'persen')), 0.0001);
    }

    public function test_ledger_runs_in_date_order_with_a_running_balance(): void
    {
        $transaksi = $this->buku('Kandang 2')['transaksi'];

        $this->assertCount(124, $transaksi);
        $this->assertSame(range(1, 124), array_column($transaksi, 'nomor'));

        // Pengeluaran 3 sampai 5 Juli terjadi sebelum dana pertama masuk, jadi saldo sempat negatif.
        $this->assertSame(['2026-07-03', 'Briket 140 kg', null, 2_070_000, -2_070_000], $this->baris($transaksi[0]));
        $this->assertSame(['2026-07-05', 'Pinjaman Makan', null, 1_300_000, -3_940_000], $this->baris($transaksi[3]));
        $this->assertSame(['2026-07-09', 'Uang masuk (operasional)', 10_000_000, null, 6_060_000], $this->baris($transaksi[4]));

        $terakhir = $transaksi[123];
        $this->assertSame(['2026-09-01', 'Uang masuk (operasional)', 10_000_000, null, -22_327_239], $this->baris($terakhir));
        $this->assertSame(KategoriKas::DanaOperasional, $terakhir['kategori']);

        $tanggal = array_map(fn (array $baris): string => $baris['tanggal']->toDateString(), $transaksi);
        $urut = $tanggal;
        sort($urut);
        $this->assertSame($urut, $tanggal);
    }

    public function test_ledger_filter_groups_by_month_and_keeps_original_numbers_and_balances(): void
    {
        $transaksi = $this->buku('Kandang 2')['transaksi'];

        $semua = BukuKas::saring($transaksi);
        $this->assertSame(['2026-07', '2026-08', '2026-09'], array_map(fn (array $sebulan): string => $sebulan['bulan']->format('Y-m'), $semua['bulan']));
        $this->assertSame([124, 45_000_000, 67_327_239], [$semua['jumlah'], $semua['masuk'], $semua['keluar']]);
        $this->assertSame(67_327_239, array_sum(array_column($semua['bulan'], 'keluar')));

        $gas = BukuKas::saring($transaksi, KategoriKas::Gas);
        $this->assertSame([7, 0, 5_880_000], [$gas['jumlah'], $gas['masuk'], $gas['keluar']]);
        $this->assertCount(1, $gas['bulan']);

        $pertama = $gas['bulan'][0]['baris'][0];
        $this->assertSame(['2026-07-09', 'Gas 35', null, 840_000, 5_220_000], $this->baris($pertama));
        $this->assertSame(6, $pertama['nomor']);
    }

    public function test_surplus_and_books_without_loans_are_computed_from_any_transactions(): void
    {
        $periodeKandang = $this->periodeKandang('Kandang 1');
        TransaksiKas::factory()->for($periodeKandang)->danaMasuk(5_000_000)->create(['tanggal' => '2026-07-10']);
        TransaksiKas::factory()->for($periodeKandang)->keluar(KategoriKas::Gas, 1_200_000)->create(['tanggal' => '2026-07-11']);
        TransaksiKas::factory()->for($periodeKandang)->keluar(KategoriKas::Solar, 300_000)->create(['tanggal' => '2026-07-12']);

        $buku = BukuKas::buat($periodeKandang->fresh());

        $this->assertSame([5_000_000, 1_500_000, 3_500_000, 0, 1_500_000], [
            $buku['ringkasan']['masuk'], $buku['ringkasan']['keluar'], $buku['ringkasan']['selisih'], $buku['ringkasan']['pinjaman'], $buku['ringkasan']['biaya'],
        ]);
        $this->assertSame([], $buku['pinjaman']);
        $this->assertSame([5_000_000, 3_800_000, 3_500_000], array_column($buku['transaksi'], 'saldo'));
        $this->assertSame([80.0, 20.0], array_column($buku['biaya'], 'persen'));
    }

    public function test_empty_book_has_no_report(): void
    {
        $this->assertNull($this->buku('Kandang 1'));
    }

    public function test_seeding_twice_does_not_duplicate_transactions(): void
    {
        $this->seed(KasOperasionalSeeder::class);

        $this->assertSame(290, TransaksiKas::count());
    }

    public function test_september_kandang_two_cash_report_matches_its_summary_and_categories(): void
    {
        $buku = $this->bukuSeptemberKandangDua();

        $this->assertSame(
            [43_862_000, 42_636_000, 1_226_000, 1_360_000, 41_276_000, 5, 66, 9, 57],
            [
                $buku['ringkasan']['masuk'],
                $buku['ringkasan']['keluar'],
                $buku['ringkasan']['selisih'],
                $buku['ringkasan']['pinjaman'],
                $buku['ringkasan']['biaya'],
                $buku['ringkasan']['jumlah_masuk'],
                $buku['ringkasan']['jumlah_keluar'],
                $buku['ringkasan']['jumlah_pinjaman'],
                $buku['ringkasan']['jumlah_biaya'],
            ],
        );

        $biaya = collect($buku['biaya'])->mapWithKeys(
            fn (array $baris): array => [$baris['kategori']->label() => $baris['jumlah']],
        )->all();
        $pinjaman = collect($buku['pinjaman'])->mapWithKeys(
            fn (array $baris): array => [$baris['kategori']->label() => $baris['jumlah']],
        )->all();

        $this->assertSame([
            'Maintenance' => 17_017_000,
            'PLN & Kelistrikan' => 10_996_000,
            'Gas' => 5_040_000,
            'Gaji Karyawan' => 3_750_000,
            'Solar' => 2_100_000,
            'Upah' => 1_000_000,
            'Meal & Drink' => 723_000,
            'Transport' => 380_000,
            'Berobat' => 270_000,
        ], $biaya);
        $this->assertSame(['Pinjaman ABK' => 1_360_000], $pinjaman);
        $this->assertSame(71, $buku['ringkasan']['jumlah_masuk'] + $buku['ringkasan']['jumlah_keluar']);
    }

    public function test_september_kandang_one_cash_report_matches_its_transactions_and_categories(): void
    {
        $buku = $this->bukuSeptemberKandangSatu();

        $this->assertSame(
            [85_060_750, 97_663_750, -12_603_000, 13_170_000, 84_493_750, 9, 86, 10, 76],
            [
                $buku['ringkasan']['masuk'],
                $buku['ringkasan']['keluar'],
                $buku['ringkasan']['selisih'],
                $buku['ringkasan']['pinjaman'],
                $buku['ringkasan']['biaya'],
                $buku['ringkasan']['jumlah_masuk'],
                $buku['ringkasan']['jumlah_keluar'],
                $buku['ringkasan']['jumlah_pinjaman'],
                $buku['ringkasan']['jumlah_biaya'],
            ],
        );

        $biaya = collect($buku['biaya'])->mapWithKeys(
            fn (array $baris): array => [$baris['kategori']->label() => $baris['jumlah']],
        )->all();
        $pinjaman = collect($buku['pinjaman'])->mapWithKeys(
            fn (array $baris): array => [$baris['kategori']->label() => $baris['jumlah']],
        )->all();

        $this->assertSame([
            'Maintenance' => 57_393_750,
            'Gaji Karyawan' => 11_900_000,
            'PLN & Kelistrikan' => 10_833_000,
            'Transport' => 1_800_000,
            'Starlink' => 800_000,
            'Upah' => 720_000,
            'Berobat' => 710_000,
            'Meal & Drink' => 337_000,
        ], $biaya);
        $this->assertSame([
            'Pinjaman Makan (Uang Makan)' => 10_670_000,
            'Pinjaman Karyawan' => 2_500_000,
        ], $pinjaman);
        $this->assertSame(['2026-08-29', '2026-10-10'], [
            $buku['mulai']->toDateString(),
            $buku['selesai']->toDateString(),
        ]);
    }

    public function test_september_cash_seeder_is_idempotent(): void
    {
        $this->seed(KasOperasionalSeeder::class);

        $this->assertSame(290, TransaksiKas::count());
        $this->assertSame(71, $this->bukuSeptemberKandangDua()['ringkasan']['jumlah_masuk'] + $this->bukuSeptemberKandangDua()['ringkasan']['jumlah_keluar']);
        $this->assertSame(95, $this->bukuSeptemberKandangSatu()['ringkasan']['jumlah_masuk'] + $this->bukuSeptemberKandangSatu()['ringkasan']['jumlah_keluar']);
    }

    public function test_page_shows_the_report_for_a_house_with_transactions(): void
    {
        $this->get($this->alamat('Kandang 2', 'Periode Juli 2026'))
            ->assertOk()
            ->assertSee('Laporan biaya operasional Kandang 2')
            ->assertSee('3 Juli s/d 1 September 2026')
            ->assertSee('4 dana masuk, 120 pengeluaran')
            ->assertSee('Rp 45,0 jt')
            ->assertSee('-Rp 22,3 jt')
            ->assertSee('67.327.239')
            ->assertSee('(22.327.239)')
            ->assertSee('54.287.239')
            ->assertSee('Dikurangi Pinjaman Makan (Uang Makan)')
            ->assertSee('Total pinjaman karyawan')
            ->assertSee('13.040.000')
            ->assertSee('Tempah corong kotoran 3 buah')
            ->assertSee('Subtotal Agustus 2026')
            ->assertSee('Total seluruh transaksi');
    }

    public function test_create_button_submits_the_transaction_form_from_the_modal_footer(): void
    {
        $periode = Periode::where('nama', 'Periode September 2026')->firstOrFail();

        $html = Livewire::withQueryParams(['periode' => $periode->id])
            ->test(KasOperasional::class, ['kandang' => $this->kandang('Kandang 2')])
            ->html();

        // Tombol simpan di footer modal harus berada di dalam form, kalau tidak kliknya tidak mengirim apa pun.
        $this->assertStringContainsString('<form wire:submit="simpan">', $html);
        preg_match('/<form wire:submit="simpan">(.*?)<\/form>/s', $html, $isiForm);
        $this->assertNotEmpty($isiForm);
        $this->assertStringContainsString('type="submit"', $isiForm[1]);
    }

    public function test_operational_funds_must_be_recorded_before_an_expense(): void
    {
        $periodeKandang = $this->periodeKandang('Kandang 1');
        $periodeKandang->periode->update(['status' => 'berjalan']);
        $halaman = Livewire::withQueryParams(['periode' => $periodeKandang->periode_id])
            ->test(KasOperasional::class, ['kandang' => $this->kandang('Kandang 1')])
            ->call('tambah')
            ->set('tanggal', '2026-07-10')
            ->set('kategoriTransaksi', KategoriKas::Gas->value)
            ->set('uraian', 'Gas kandang')
            ->set('jumlah', '500000')
            ->call('simpan')
            ->assertHasErrors('kategoriTransaksi');

        $this->assertSame(0, $periodeKandang->transaksiKas()->count());

        $halaman->set('kategoriTransaksi', KategoriKas::DanaOperasional->value)
            ->set('uraian', 'Setoran dana operasional')
            ->set('jumlah', '1000000')
            ->call('simpan')
            ->assertHasNoErrors();

        $halaman->set('kategoriTransaksi', KategoriKas::Gas->value)
            ->set('uraian', 'Gas kandang')
            ->set('jumlah', '500000')
            ->call('simpan')
            ->assertHasNoErrors();

        $this->assertSame(2, $periodeKandang->transaksiKas()->count());
        $this->assertSame(2, Aktivitas::where('modul', ModulAktivitas::KasOperasional)->count());
    }

    public function test_cash_transactions_can_be_updated_and_deleted(): void
    {
        $periodeKandang = $this->periodeKandang('Kandang 1');
        $periodeKandang->periode->update(['status' => 'berjalan']);
        $dana = TransaksiKas::factory()->for($periodeKandang)->danaMasuk(1_000_000)->create(['tanggal' => '2026-07-10']);
        $pengeluaran = TransaksiKas::factory()->for($periodeKandang)->keluar(KategoriKas::Gas, 500_000)->create(['tanggal' => '2026-07-11']);
        $halaman = Livewire::withQueryParams(['periode' => $periodeKandang->periode_id])
            ->test(KasOperasional::class, ['kandang' => $this->kandang('Kandang 1')]);

        $halaman->call('ubah', $pengeluaran->id)
            ->set('uraian', 'Pembelian gas')
            ->set('jumlah', '400000')
            ->call('simpan')
            ->assertHasNoErrors();

        $this->assertDatabaseHas('transaksi_kas', ['id' => $pengeluaran->id, 'uraian' => 'Pembelian gas', 'jumlah' => 400_000]);

        $halaman->call('mintaHapus', $pengeluaran->id)
            ->call('hapus')
            ->assertHasNoErrors();

        $this->assertDatabaseMissing('transaksi_kas', ['id' => $pengeluaran->id]);
        $this->assertDatabaseHas('transaksi_kas', ['id' => $dana->id]);
    }

    public function test_last_operational_fund_cannot_be_deleted_while_expenses_remain(): void
    {
        $periodeKandang = $this->periodeKandang('Kandang 1');
        $periodeKandang->periode->update(['status' => 'berjalan']);
        $dana = TransaksiKas::factory()->for($periodeKandang)->danaMasuk(1_000_000)->create();
        TransaksiKas::factory()->for($periodeKandang)->keluar(KategoriKas::Gas, 500_000)->create();
        $halaman = Livewire::withQueryParams(['periode' => $periodeKandang->periode_id])
            ->test(KasOperasional::class, ['kandang' => $this->kandang('Kandang 1')]);

        $halaman->call('mintaHapus', $dana->id)
            ->call('hapus')
            ->assertHasErrors('transaksi_hapus');

        $this->assertDatabaseHas('transaksi_kas', ['id' => $dana->id]);
    }

    public function test_ledger_can_be_filtered_by_category(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();

        Livewire::withQueryParams(['periode' => $periode->id])
            ->test(KasOperasional::class, ['kandang' => $this->kandang('Kandang 2')])
            ->assertSee('Briket 140 kg')
            ->call('pilihKategori', KategoriKas::PinjamanAbk->value)
            ->assertSet('kategori', 'pinjaman-abk')
            ->assertSee('Pinjaman Frengky')
            ->assertSee('Total Pinjaman ABK, 10 transaksi')
            ->assertDontSee('Briket 140 kg')
            ->assertDontSee('Total seluruh transaksi')
            ->call('pilihKategori', 'tidak-ada')
            ->assertSet('kategori', '')
            ->assertSee('Briket 140 kg');
    }

    public function test_category_filter_can_be_chosen_from_the_url(): void
    {
        $this->get($this->alamat('Kandang 2', 'Periode Juli 2026').'&kategori=solar')
            ->assertOk()
            ->assertSee('Solar 5 jerigen')
            ->assertSee('Total Solar, 1 transaksi')
            ->assertDontSee('Briket 140 kg');
    }

    public function test_page_explains_when_a_house_has_no_transactions_or_is_not_in_the_period(): void
    {
        $this->get($this->alamat('Kandang 1', 'Periode Juli 2026'))
            ->assertOk()
            ->assertSee('Laporan biaya operasional Kandang 1')
            ->assertSee('Belum ada transaksi kas')
            ->assertDontSee('Buku kas</h6>', false);

        $this->get($this->alamat('Kandang 1', 'Periode September 2026'))
            ->assertOk()
            ->assertSee('Laporan biaya operasional Kandang 1')
            ->assertSee('85.060.750')
            ->assertSee('97.663.750')
            ->assertSee('12.603.000');

        $this->get($this->alamat('Kandang 2', 'Periode September 2026'))
            ->assertOk()
            ->assertSee('Laporan biaya operasional Kandang 2')
            ->assertSee('4 September s/d 7 Oktober 2026')
            ->assertSee('5 dana masuk, 66 pengeluaran')
            ->assertSee('43.862.000')
            ->assertSee('42.636.000')
            ->assertSee('Gaji Karyawan');
    }

    public function test_sidebar_lists_each_house_under_kas_operasional_and_bare_url_redirects(): void
    {
        $kandangSatu = $this->kandang('Kandang 1');
        $kandangDua = $this->kandang('Kandang 2');

        $this->get(route('dashboard'))
            ->assertOk()
            ->assertSee(route('kas.operasional', $kandangSatu))
            ->assertSee(route('kas.operasional', $kandangDua));

        $this->get('/keuangan/kas-operasional')->assertRedirect(route('kas.operasional', $kandangSatu));
        $this->get('/keuangan/kas-operasional/999')->assertNotFound();
    }

    /**
     * @return array<string, mixed>|null
     */
    private function buku(string $kandang): ?array
    {
        return BukuKas::buat($this->periodeKandang($kandang));
    }

    /**
     * @return array<string, mixed>
     */
    private function bukuSeptemberKandangDua(): array
    {
        $periode = Periode::where('nama', 'Periode September 2026')->firstOrFail();
        $periodeKandang = PeriodeKandang::where([
            'periode_id' => $periode->id,
            'kandang_id' => $this->kandang('Kandang 2')->id,
        ])->firstOrFail();

        return BukuKas::buat($periodeKandang->load('transaksiKas'));
    }

    /**
     * @return array<string, mixed>
     */
    private function bukuSeptemberKandangSatu(): array
    {
        $periode = Periode::where('nama', 'Periode September 2026')->firstOrFail();
        $periodeKandang = PeriodeKandang::where([
            'periode_id' => $periode->id,
            'kandang_id' => $this->kandang('Kandang 1')->id,
        ])->with('transaksiKas')->firstOrFail();

        return BukuKas::buat($periodeKandang);
    }

    private function periodeKandang(string $kandang): PeriodeKandang
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();

        return PeriodeKandang::where(['periode_id' => $periode->id, 'kandang_id' => $this->kandang($kandang)->id])->firstOrFail();
    }

    private function kandang(string $nama): Kandang
    {
        return Kandang::where('nama', $nama)->firstOrFail();
    }

    private function alamat(string $kandang, string $periode): string
    {
        return route('kas.operasional', ['kandang' => $this->kandang($kandang), 'periode' => Periode::where('nama', $periode)->firstOrFail()->id]);
    }

    /**
     * @param  array<string, mixed>  $baris
     * @return array{string, string, ?int, ?int, int}
     */
    private function baris(array $baris): array
    {
        return [$baris['tanggal']->toDateString(), $baris['uraian'], $baris['masuk'], $baris['keluar'], $baris['saldo']];
    }
}
