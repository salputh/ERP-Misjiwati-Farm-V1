<?php

namespace Tests\Feature;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Livewire\Kohe;
use App\Models\Aktivitas;
use App\Models\Farm;
use App\Models\Kandang;
use App\Models\KohePenjualan;
use App\Models\KoheStok;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Livewire\Features\SupportTesting\Testable;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * Halaman kohe: stok karung masuk, penjualan ke pembeli, dan sisa stok yang tidak boleh minus.
 */
class KoheTest extends TestCase
{
    use RefreshDatabase;

    private Farm $farm;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-10-24 08:00:00');
        $this->seed(DatabaseSeeder::class);
        $this->farm = Farm::query()->orderBy('nama')->firstOrFail();
    }

    public function test_page_is_reachable_from_the_sidebar_and_shows_thousand_separated_inputs(): void
    {
        $this->get(route('dashboard'))->assertSee('href="'.route('kohe'), false);

        $this->get(route('kohe'))
            ->assertOk()
            ->assertSee('Stok dan penjualan kohe')
            ->assertSee('Belum ada penjualan kohe.')
            ->assertSee("x-data=\"isianRibuan('hargaPerKarung', '.', false,", false)
            ->assertSee("x-data=\"isianRibuan('jumlahKarungJual', '.', false,", false)
            ->assertSee("x-data=\"isianRibuan('jumlahKarungStok', '.', false,", false)
            ->assertSee('inputmode="numeric"', false);
    }

    public function test_stock_and_sale_are_recorded_and_logged(): void
    {
        $kandang = Kandang::query()->where('farm_id', $this->farm->id)->orderBy('nama')->firstOrFail();

        $this->halaman()
            ->call('tambahStok')
            ->assertSet('tanggalStok', '2026-10-24')
            ->set('kandangStokId', $kandang->id)
            ->set('jumlahKarungStok', 1200)
            ->call('simpanStok')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Stok kohe 1.200 karung dicatat.')
            ->call('tambahPenjualan')
            ->set('namaPembeli', ' Pak Budi ')
            ->set('jumlahKarungJual', 1000)
            ->set('hargaPerKarung', 15000)
            ->assertSee('Rp 15.000.000')
            ->call('simpanPenjualan')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Penjualan kohe ke Pak Budi dicatat.')
            ->assertSet('ringkasan.tersedia', 200)
            ->assertSet('ringkasan.pendapatan', 15_000_000)
            ->assertSee('15.000.000');

        $this->assertDatabaseHas('kohe_penjualans', ['farm_id' => $this->farm->id, 'nama_pembeli' => 'Pak Budi', 'jumlah_karung' => 1000, 'harga_per_karung' => 15000]);
        $aktivitas = Aktivitas::query()->orderBy('id')->get();
        $this->assertSame([ModulAktivitas::Kohe, ModulAktivitas::Kohe], $aktivitas->pluck('modul')->all());
        $this->assertSame('Stok kohe 24 Oktober 2026 ditambahkan', $aktivitas[0]->kalimat());
        $this->assertSame('1.200 karung, '.$kandang->nama, $aktivitas[0]->rincian);
        $this->assertSame('Penjualan kohe ke Pak Budi ditambahkan', $aktivitas[1]->kalimat());
        $this->assertSame('24 Oktober 2026, 1.000 karung × Rp 15.000', $aktivitas[1]->rincian);
    }

    public function test_sale_cannot_exceed_available_stock_and_requires_buyer_and_price(): void
    {
        KoheStok::factory()->create(['farm_id' => $this->farm->id, 'jumlah_karung' => 50]);

        $this->halaman()
            ->call('tambahPenjualan')
            ->call('simpanPenjualan')
            ->assertHasErrors(['namaPembeli' => 'required', 'jumlahKarungJual' => 'required', 'hargaPerKarung' => 'required'])
            ->set('namaPembeli', 'Bu Sari')
            ->set('jumlahKarungJual', 51)
            ->set('hargaPerKarung', 12000)
            ->call('simpanPenjualan')
            ->assertHasErrors(['jumlahKarungJual' => 'max'])
            ->assertSee('Stok tersedia hanya 50 karung.')
            ->set('jumlahKarungJual', 50)
            ->call('simpanPenjualan')
            ->assertHasNoErrors();

        $this->assertSame(1, KohePenjualan::query()->count());
    }

    public function test_editing_a_sale_counts_its_own_sacks_as_available(): void
    {
        KoheStok::factory()->create(['farm_id' => $this->farm->id, 'jumlah_karung' => 100]);
        $penjualan = KohePenjualan::factory()->create(['farm_id' => $this->farm->id, 'jumlah_karung' => 80, 'harga_per_karung' => 10000]);

        $this->halaman()
            ->call('ubahPenjualan', $penjualan->id)
            ->assertSet('tersediaUntukForm', 100)
            ->assertSeeHtml('data-bs-target="#konfirmasi-simpan-kohe-penjualan"')
            ->set('jumlahKarungJual', 100)
            ->call('simpanPenjualan')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Penjualan kohe ke '.$penjualan->nama_pembeli.' diperbarui.');

        $this->assertSame(100, $penjualan->fresh()->jumlah_karung);
        $this->assertSame(JenisAktivitas::Ubah, Aktivitas::sole()->jenis);
    }

    public function test_stock_cannot_drop_below_sold_sacks(): void
    {
        $stok = KoheStok::factory()->create(['farm_id' => $this->farm->id, 'jumlah_karung' => 100]);
        KohePenjualan::factory()->create(['farm_id' => $this->farm->id, 'jumlah_karung' => 70]);

        $this->halaman()
            ->call('ubahStok', $stok->id)
            ->set('jumlahKarungStok', 60)
            ->call('simpanStok')
            ->assertHasErrors('jumlahKarungStok')
            ->assertSee('Minimal 70 karung.')
            ->call('mintaHapusStok', $stok->id)
            ->call('hapus')
            ->assertHasErrors('hapus');

        $this->assertModelExists($stok);
        $this->assertSame(0, Aktivitas::count());
    }

    public function test_sale_and_stock_can_be_deleted(): void
    {
        $stok = KoheStok::factory()->create(['farm_id' => $this->farm->id, 'jumlah_karung' => 100]);
        $penjualan = KohePenjualan::factory()->create(['farm_id' => $this->farm->id, 'nama_pembeli' => 'Pak Dedi', 'jumlah_karung' => 30]);

        $this->halaman()
            ->call('mintaHapusPenjualan', $penjualan->id)
            ->call('hapus')
            ->assertSet('pesan', 'Penjualan kohe ke Pak Dedi dihapus.')
            ->call('mintaHapusStok', $stok->id)
            ->call('hapus')
            ->assertSet('pesan', 'Stok kohe 100 karung dihapus.')
            ->assertSet('ringkasan.tersedia', 0);

        $this->assertModelMissing($penjualan);
        $this->assertModelMissing($stok);
        $this->assertSame([JenisAktivitas::Hapus, JenisAktivitas::Hapus], Aktivitas::query()->orderBy('id')->pluck('jenis')->all());
    }

    public function test_records_of_another_farm_are_not_shown_or_editable(): void
    {
        $farmLain = Farm::query()->create(['nama' => 'Farm Lain']);
        $penjualanLain = KohePenjualan::factory()->create(['farm_id' => $farmLain->id, 'nama_pembeli' => 'Pembeli Farm Lain']);

        $this->halaman()->assertDontSee('Pembeli Farm Lain');

        $this->halaman()->call('ubahPenjualan', $penjualanLain->id)->assertStatus(404);
    }

    private function halaman(): Testable
    {
        return Livewire::withQueryParams(['farm' => $this->farm->id])->test(Kohe::class);
    }
}
