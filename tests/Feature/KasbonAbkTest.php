<?php

namespace Tests\Feature;

use App\Enums\JenisAktivitas;
use App\Enums\KategoriKas;
use App\Enums\ModulAktivitas;
use App\Livewire\DataKaryawan;
use App\Livewire\KasbonAbk;
use App\Livewire\KasOperasional;
use App\Livewire\PayrollAbk;
use App\Models\Aktivitas;
use App\Models\BagiHasil;
use App\Models\Kandang;
use App\Models\Karyawan;
use App\Models\Kasbon;
use App\Models\PenerimaBagiHasil;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use App\Models\PotonganKasbon;
use App\Models\SlipGaji;
use App\Models\TransaksiKas;
use App\Support\LembarPayroll;
use App\Support\LembarRhpp;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Features\SupportTesting\Testable;
use Livewire\Livewire;
use Tests\TestCase;

class KasbonAbkTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DatabaseSeeder::class);
    }

    public function test_kasbon_is_not_deducted_until_the_potong_button_is_used(): void
    {
        $this->halamanKasbon()
            ->call('tambah')
            ->call('pilihKaryawan', $this->frengky()->id)
            ->set('keperluan', 'HP')
            ->set('jumlah', '3000000')
            ->set('jumlahPotongan', '3')
            ->assertSet('rencanaPotongan', [1_000_000, 1_000_000, 1_000_000])
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSee('Rp 3.000.000 belum dipotong dari gaji');

        $slip = $this->buatSlipSeptember()->firstWhere('nama', 'Frengky');
        $kasbon = Kasbon::sole();

        $this->assertNull($kasbon->transaksi_kas_id);
        // Slip baru tidak memotong kasbon; pinjaman biasa di kas tetap dipotong penuh seperti sebelumnya.
        $this->assertSame(0, $slip->potonganKasbon()->count());
        $this->assertSame(1_330_000, $slip->pinjaman);
        $this->assertNull(collect($this->slipLembar('Frengky')['potongan'])->firstWhere('label', 'Kasbon HP'));

        $this->halamanKasbon()
            ->assertSee('Belum dipotong di periode ini')
            ->call('mintaPotong', $kasbon->id)
            ->assertSet('nilaiPotong', 1_000_000)
            ->call('potong')
            ->assertHasNoErrors()
            ->assertSee('Sudah dipotong di slip periode ini');

        $this->assertSame([1_000_000], $slip->potonganKasbon()->pluck('jumlah')->all());
        $this->assertSame(
            ['label' => 'Kasbon HP', 'jumlah' => 1_000_000, 'rumus' => 'potongan 1 dari 3, sisa Rp 2.000.000'],
            collect($this->slipLembar('Frengky')['potongan'])->firstWhere('label', 'Kasbon HP'),
        );
        $this->assertSame(2, Aktivitas::where(['modul' => ModulAktivitas::KasbonAbk, 'jenis' => JenisAktivitas::Tambah])->count());
    }

    public function test_the_agreed_amount_can_differ_from_the_suggestion_and_is_cut_once_per_slip(): void
    {
        $kasbon = $this->kasbonFrengky();
        $slip = $this->buatSlipSeptember()->firstWhere('nama', 'Frengky');
        $halaman = $this->halamanKasbon()->call('mintaPotong', $kasbon->id);

        $halaman->set('nilaiPotong', 3_000_001)->call('potong')->assertHasErrors(['nilaiPotong' => 'max']);
        $halaman->set('nilaiPotong', 750_000)->call('potong')->assertHasNoErrors();

        $this->assertSame([750_000], $slip->potonganKasbon()->pluck('jumlah')->all());
        $this->halamanKasbon()->call('mintaPotong', $kasbon->id)->assertHasErrors('nilaiPotong');
        $this->assertSame(1, $slip->potonganKasbon()->count());
    }

    public function test_kasbon_cannot_be_cut_before_the_slip_exists(): void
    {
        $kasbon = $this->kasbonFrengky();

        $this->halamanKasbon()
            ->assertSee('Belum dapat dipotong: slip gaji periode ini belum dibuat')
            ->assertDontSeeHtml('mintaPotong('.$kasbon->id.')')
            ->call('mintaPotong', $kasbon->id)
            ->assertHasErrors('nilaiPotong');

        $this->assertSame(0, PotonganKasbon::count());
    }

    public function test_a_deduction_can_be_cancelled_in_an_open_period(): void
    {
        $kasbon = $this->kasbonFrengky();
        $slip = $this->buatSlipSeptember()->firstWhere('nama', 'Frengky');
        $this->potong($kasbon);
        $potongan = $slip->potonganKasbon()->sole();

        $this->halamanKasbon()
            ->call('mintaBatalkanPotongan', $potongan->id)
            ->call('batalkanPotongan')
            ->assertHasNoErrors()
            ->assertSee('Belum dipotong di periode ini');

        $this->assertModelMissing($potongan);
        $this->assertSame(3_000_000, $kasbon->fresh()->sisa());
        $this->assertSame(1, Aktivitas::where(['modul' => ModulAktivitas::KasbonAbk, 'jenis' => JenisAktivitas::Hapus])->count());
    }

    public function test_cancelling_a_deduction_that_no_longer_exists_shows_a_message_instead_of_not_found(): void
    {
        $kasbon = $this->kasbonFrengky();
        $this->buatSlipSeptember();
        $this->potong($kasbon);
        $potongan = PotonganKasbon::sole();
        $halaman = $this->halamanKasbon()->call('mintaBatalkanPotongan', $potongan->id);

        $potongan->delete();

        $halaman->call('batalkanPotongan')
            ->assertHasErrors('potongan_batal')
            ->assertSee('Potongan ini sudah tidak ada di slip gaji')
            ->assertSee('Belum dipotong di periode ini');
        $this->halamanKasbon()->call('mintaBatalkanPotongan', $potongan->id)->assertHasErrors('potongan_batal');
    }

    public function test_uneven_amounts_are_rounded_to_thousands_and_the_last_deduction_takes_the_rest(): void
    {
        $this->halamanKasbon()
            ->set('jumlah', '1600000')
            ->set('jumlahPotongan', '3')
            ->assertSet('rencanaPotongan', [534_000, 533_000, 533_000]);
    }

    public function test_a_fixed_amount_per_slip_sets_the_number_of_deductions(): void
    {
        $this->halamanKasbon()
            ->call('pilihKaryawan', $this->frengky()->id)
            ->set('keperluan', 'HP')
            ->set('jumlah', 3_000_000)
            ->set('nilaiPotongan', 1_200_000)
            ->assertSet('jumlahPotongan', '3')
            ->assertSet('rencanaPotongan', [1_200_000, 1_200_000, 600_000])
            ->call('simpan')
            ->assertHasNoErrors();

        $this->assertSame([3, 1_200_000], [Kasbon::sole()->jumlah_potongan, Kasbon::sole()->nilai_potongan]);
        $slip = $this->buatSlipSeptember()->firstWhere('nama', 'Frengky');
        $this->potong(Kasbon::sole());
        $this->assertSame([1_200_000], $slip->potonganKasbon()->pluck('jumlah')->all());
        $this->assertSame(
            'potongan 1 dari 3, sisa Rp 1.800.000',
            collect($this->slipLembar('Frengky')['potongan'])->firstWhere('label', 'Kasbon HP')['rumus'],
        );
    }

    public function test_a_fixed_amount_per_slip_must_fit_the_kasbon_and_the_deduction_limit(): void
    {
        $halaman = $this->halamanKasbon()
            ->call('pilihKaryawan', $this->frengky()->id)
            ->set('keperluan', 'HP')
            ->set('jumlah', 3_000_000);

        $halaman->set('nilaiPotongan', 100_000)
            ->assertSet('jumlahPotongan', '30')
            ->call('simpan')
            ->assertHasErrors(['jumlahPotongan' => 'max']);

        $halaman->set('nilaiPotongan', 3_500_000)
            ->call('simpan')
            ->assertHasErrors(['nilaiPotongan' => 'lte']);

        $this->assertSame(0, Kasbon::count());
    }

    public function test_clearing_the_amount_hides_the_plan_and_asks_for_an_amount(): void
    {
        $this->halamanKasbon()
            ->set('jumlah', 3_000_000)
            ->set('jumlah', null)
            ->assertSet('rencanaPotongan', [])
            ->call('simpan')
            ->assertHasErrors(['jumlah' => 'required']);
    }

    public function test_a_slip_deduction_can_be_changed_and_the_rest_is_spread_over_later_deductions(): void
    {
        $kasbon = $this->kasbonFrengky();
        $slip = $this->buatSlipSeptember()->firstWhere('nama', 'Frengky');
        $this->potong($kasbon);
        $potongan = $slip->potonganKasbon()->sole();

        $halaman = Livewire::withQueryParams(['periode' => $this->september()->id])
            ->test(PayrollAbk::class)
            ->call('ubah', $slip->id)
            ->assertSet("isianKasbon.{$potongan->id}", '1000000')
            ->set("isianKasbon.{$potongan->id}", '3000001')
            ->call('simpan')
            ->assertHasErrors("isianKasbon.{$potongan->id}");

        $halaman->set("isianKasbon.{$potongan->id}", '500000')
            ->call('simpan')
            ->assertHasNoErrors();

        $this->assertSame(500_000, $potongan->fresh()->jumlah);
        $this->assertSame(2_500_000, $kasbon->fresh()->sisa());
        // Sisa Rp 2.500.000 dibagi ke dua potongan yang tersisa.
        $this->assertSame(1_250_000, $kasbon->fresh()->saranPotongan());
    }

    public function test_kasbon_from_an_earlier_period_can_be_cut_in_the_next_slip(): void
    {
        $juli = SlipGaji::where('nama', 'Frengky')->whereHas('periodeKandang', fn ($query) => $query->where('periode_id', $this->juli()->id))->sole();
        $kasbon = Kasbon::factory()->for($this->frengky())->create(['periode_id' => $this->juli()->id]);
        PotonganKasbon::factory()->for($kasbon)->create(['slip_gaji_id' => $juli->id]);

        $slip = $this->buatSlipSeptember()->firstWhere('nama', 'Frengky');
        $this->potong($kasbon);

        $this->assertSame([1_000_000], $slip->potonganKasbon()->pluck('jumlah')->all());
        $this->assertSame(
            'potongan 2 dari 3, sisa Rp 1.000.000',
            collect($this->slipLembar('Frengky')['potongan'])->firstWhere('label', 'Kasbon HP')['rumus'],
        );
        // Kasbon periode yang ditutup tidak dapat diubah dari periode lain.
        $this->halamanKasbon()->call('ubah', $kasbon->id)->assertNotFound();
    }

    public function test_kasbon_paid_from_the_cash_book_is_not_deducted_as_a_regular_loan(): void
    {
        $this->halamanKasbon()
            ->call('pilihKaryawan', $this->frengky()->id)
            ->set('keperluan', 'HP')
            ->set('jumlah', '3000000')
            ->set('jumlahPotongan', '3')
            ->set('dariKas', true)
            ->call('simpan')
            ->assertHasNoErrors();

        $transaksi = Kasbon::sole()->transaksiKas;
        $this->assertSame([KategoriKas::PinjamanAbk, 'Kasbon HP Frengky', 3_000_000], [$transaksi->kategori, $transaksi->uraian, $transaksi->jumlah]);
        $this->assertSame($this->kandangDuaSeptember()->id, $transaksi->periode_kandang_id);

        $slip = $this->buatSlipSeptember()->firstWhere('nama', 'Frengky');
        $this->assertSame(1_330_000, $slip->pinjaman);
        $this->assertSame(0, $slip->potonganKasbon()->count());

        Livewire::withQueryParams(['periode' => $this->september()->id])
            ->test(KasOperasional::class, ['kandang' => Kandang::where('nama', 'Kandang 2')->firstOrFail()])
            ->assertSee('Kasbon HP Frengky')
            ->call('mintaHapus', $transaksi->id)
            ->assertNotFound();
    }

    public function test_changing_a_kasbon_keeps_agreed_deductions_and_deleting_it_removes_them(): void
    {
        $slip = $this->buatSlipSeptember()->firstWhere('nama', 'Frengky');
        $halaman = $this->halamanKasbon()
            ->call('pilihKaryawan', $this->frengky()->id)
            ->set('keperluan', 'Sepeda motor')
            ->set('jumlah', '3000000')
            ->set('jumlahPotongan', '3')
            ->set('dariKas', true)
            ->call('simpan');
        $kasbon = Kasbon::sole();
        $this->potong($kasbon);

        $halaman->call('ubah', $kasbon->id)
            ->set('jumlah', 900_000)
            ->call('simpan')
            ->assertHasErrors('jumlah');

        $halaman->call('ubah', $kasbon->id)
            ->set('jumlahPotongan', '2')
            ->set('dariKas', false)
            ->call('simpan')
            ->assertHasNoErrors();
        $this->assertSame([1_000_000], $slip->potonganKasbon()->pluck('jumlah')->all());
        $this->assertSame(2_000_000, $kasbon->fresh()->saranPotongan());
        $this->assertNull($kasbon->fresh()->transaksi_kas_id);
        $this->assertSame(0, TransaksiKas::where('uraian', 'Kasbon Sepeda motor Frengky')->count());

        $halaman->call('mintaHapus', $kasbon->id)->call('hapus')->assertHasNoErrors();
        $this->assertSame(0, Kasbon::count());
        $this->assertSame(0, $slip->potonganKasbon()->count());
        $this->assertSame(
            [JenisAktivitas::Tambah, JenisAktivitas::Tambah, JenisAktivitas::Ubah, JenisAktivitas::Hapus],
            Aktivitas::where('modul', ModulAktivitas::KasbonAbk)->orderBy('id')->pluck('jenis')->all(),
        );
    }

    public function test_kasbon_needs_an_abk_and_at_least_one_deduction(): void
    {
        $this->halamanKasbon()
            ->call('pilihKaryawan', Karyawan::factory()->joker()->create()->id)
            ->set('keperluan', 'HP')
            ->set('jumlah', '3000000')
            ->set('jumlahPotongan', '0')
            ->call('simpan')
            ->assertHasErrors(['karyawanId' => 'exists', 'jumlahPotongan' => 'min']);

        $this->assertSame(0, Kasbon::count());
    }

    public function test_kasbon_cannot_be_recorded_in_a_closed_period(): void
    {
        Livewire::withQueryParams(['periode' => $this->juli()->id])
            ->test(KasbonAbk::class)
            ->assertDontSeeHtml('data-bs-target="#modal-kasbon"')
            ->call('pilihKaryawan', $this->frengky()->id)
            ->set('keperluan', 'HP')
            ->set('jumlah', '3000000')
            ->call('simpan')
            ->assertForbidden();
    }

    public function test_an_employee_with_a_kasbon_cannot_be_deleted(): void
    {
        $kasbon = $this->kasbonFrengky();

        Livewire::test(DataKaryawan::class)
            ->call('mintaHapus', $kasbon->karyawan_id)
            ->call('hapus')
            ->assertHasErrors('karyawan_hapus');

        $this->assertModelExists($this->frengky());
    }

    private function halamanKasbon(): Testable
    {
        return Livewire::withQueryParams(['periode' => $this->september()->id])->test(KasbonAbk::class);
    }

    /**
     * Potong kasbon dari slip September sebesar saran cicilannya, seperti menekan tombol Potong.
     */
    private function potong(Kasbon $kasbon): void
    {
        $this->halamanKasbon()->call('mintaPotong', $kasbon->id)->call('potong')->assertHasNoErrors();
    }

    private function kasbonFrengky(): Kasbon
    {
        return Kasbon::factory()->for($this->frengky())->create(['periode_id' => $this->september()->id]);
    }

    /**
     * Lembar bagi hasil Kandang 2 September dengan empat ABK, lalu slip gajinya dibuat dari halaman Payroll ABK.
     *
     * @return Collection<int, SlipGaji>
     */
    private function buatSlipSeptember(): Collection
    {
        $periodeKandang = $this->kandangDuaSeptember();
        $bagiHasil = BagiHasil::factory()->for($periodeKandang)->create();
        PenerimaBagiHasil::factory()->for($bagiHasil)->count(4)->sequence(
            ['nama' => 'Frengky', 'urutan' => 1, 'jumlah' => 500_000, 'keterangan' => 'ketua ABK'],
            ['nama' => 'Igo', 'urutan' => 2],
            ['nama' => 'Utama', 'urutan' => 3],
            ['nama' => 'Rafi', 'urutan' => 4],
        )->create();

        Livewire::withQueryParams(['periode' => $this->september()->id])
            ->test(PayrollAbk::class)
            ->call('buatSlip', $periodeKandang->id)
            ->assertHasNoErrors();

        return $periodeKandang->slipGaji()->get();
    }

    /**
     * Slip satu orang di lembar payroll September.
     *
     * @return array<string, mixed>
     */
    private function slipLembar(string $nama): array
    {
        $periode = $this->september()->load(LembarRhpp::RELASI);
        $kandangPeriode = $periode->kandangPeriode()->has('slipGaji')->with(['kandang', 'slipGaji.penerimaBagiHasil', 'slipGaji.potonganKasbon.kasbon.potongan', 'bagiHasil.penerima'])->get();

        return collect(LembarPayroll::buat($kandangPeriode, LembarRhpp::real($periode))['kandang'])
            ->flatMap(fn (array $kandang): array => $kandang['slip'])
            ->firstWhere('nama', $nama);
    }

    private function frengky(): Karyawan
    {
        return Karyawan::where('nama', 'Frengky')->firstOrFail();
    }

    private function kandangDuaSeptember(): PeriodeKandang
    {
        return PeriodeKandang::where([
            'periode_id' => $this->september()->id,
            'kandang_id' => Kandang::where('nama', 'Kandang 2')->firstOrFail()->id,
        ])->firstOrFail();
    }

    private function juli(): Periode
    {
        return Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
    }

    private function september(): Periode
    {
        return Periode::where('nama', 'Periode September 2026')->firstOrFail();
    }
}
