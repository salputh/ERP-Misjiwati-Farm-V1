<?php

namespace Tests\Feature;

use App\Enums\Jabatan;
use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Livewire\DataKaryawan as DataKaryawanPage;
use App\Models\Aktivitas;
use App\Models\Kandang;
use App\Models\Karyawan;
use App\Models\Periode;
use App\Models\SlipGaji;
use App\Support\DaftarKaryawan;
use App\Support\LembarPayroll;
use App\Support\LembarRhpp;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\KaryawanSeeder;
use Database\Seeders\PayrollSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class DataKaryawanTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DatabaseSeeder::class);
    }

    public function test_employees_are_exactly_the_people_on_the_payroll_slips(): void
    {
        $karyawan = Karyawan::with('kandang')->orderBy('id')->get()
            ->map(fn (Karyawan $satu): array => [$satu->nama, $satu->jabatan->value, $satu->kandang->nama])
            ->all();
        $slip = SlipGaji::with('periodeKandang.kandang')->orderBy('id')->get()
            ->map(fn (SlipGaji $satu): array => [$satu->nama, $satu->jabatan->value, $satu->periodeKandang->kandang->nama])
            ->all();

        $this->assertCount(9, $karyawan);
        $this->assertSame($slip, $karyawan);
        $this->assertSame(['Rohim', 'Joker', 'Kandang 2'], $karyawan[8]);
    }

    public function test_every_slip_belongs_to_its_employee(): void
    {
        $this->assertSame(0, SlipGaji::whereNull('karyawan_id')->count());

        SlipGaji::with('karyawan')->get()->each(function (SlipGaji $slip): void {
            $this->assertSame($slip->nama, $slip->karyawan->nama);
            $this->assertSame($slip->jabatan, $slip->karyawan->jabatan);
        });
    }

    public function test_list_groups_employees_by_house_with_their_latest_slip(): void
    {
        $daftar = $this->daftar();

        $this->assertSame([9, '8 ABK, 1 Joker'], [$daftar['total'], $daftar['rincian']]);
        $this->assertSame(['Kandang 1' => '4 ABK', 'Kandang 2' => '4 ABK, 1 Joker'], array_column($daftar['kandang'], 'rincian', 'nama'));
        $this->assertSame(['Wahyu', 'Angga', 'Rifi', 'Mustofa'], array_column($daftar['kandang'][0]['karyawan'], 'nama'));
        $this->assertSame(['Frengky', 'Igo', 'Utama', 'Rafi', 'Rohim'], array_column($daftar['kandang'][1]['karyawan'], 'nama'));

        $frengky = $daftar['kandang'][1]['karyawan'][0];
        $this->assertSame([Jabatan::Abk, 'ketua ABK', 56, 7_729_721], [$frengky['jabatan'], $frengky['keterangan'], $frengky['slip']['hari_kerja'], $frengky['slip']['bersih']]);

        $rohim = $daftar['kandang'][1]['karyawan'][4];
        $this->assertSame([Jabatan::Joker, null, 30, 6_795_000], [$rohim['jabatan'], $rohim['keterangan'], $rohim['slip']['hari_kerja'], $rohim['slip']['bersih']]);
    }

    public function test_employee_without_house_or_slip_is_listed_last_without_slip(): void
    {
        Karyawan::factory()->joker()->create(['nama' => 'Baru']);

        $daftar = $this->daftar();

        $this->assertSame(['Kandang 1', 'Kandang 2', 'Belum ditempatkan'], array_column($daftar['kandang'], 'nama'));
        $this->assertSame(['nama' => 'Baru', 'jabatan' => Jabatan::Joker, 'slip' => null], collect($daftar['kandang'][2]['karyawan'][0])->only(['nama', 'jabatan', 'slip'])->all());
        $this->assertSame([10, '8 ABK, 2 Joker'], [$daftar['total'], $daftar['rincian']]);
    }

    public function test_rohim_is_seeded_with_his_default_salary_and_it_shows_in_the_list(): void
    {
        $rohim = Karyawan::where('nama', 'Rohim')->sole();

        $this->assertSame([2_000_000, 30, 25], [$rohim->gaji_pokok, $rohim->hari_kerja, $rohim->tanggal_gajian]);
        $this->assertSame('Rp 2.000.000, 30 hari, gajian tgl 25', $rohim->gajiBawaan());
        $this->assertNull(Karyawan::where('nama', 'Wahyu')->sole()->gajiBawaan());

        $this->get(route('karyawan'))->assertOk()->assertSee('Gaji bawaan')->assertSee('Rp 2.000.000, 30 hari, gajian tgl 25');
    }

    public function test_default_salary_can_be_saved_changed_and_cleared_from_the_form(): void
    {
        $joker = Karyawan::factory()->joker()->create(['nama' => 'Baru', 'kandang_id' => Kandang::where('nama', 'Kandang 1')->value('id')]);

        Livewire::test(DataKaryawanPage::class)
            ->call('ubah', $joker->id)
            ->assertSet('gajiPokok', '')
            ->set('gajiPokok', '2500000')
            ->set('hariKerja', '26')
            ->set('tanggalGajian', '5')
            ->call('simpan')
            ->assertHasNoErrors();

        $this->assertSame([2_500_000, 26, 5], [$joker->fresh()->gaji_pokok, $joker->fresh()->hari_kerja, $joker->fresh()->tanggal_gajian]);

        Livewire::test(DataKaryawanPage::class)
            ->call('ubah', $joker->id)
            ->assertSet('gajiPokok', '2500000')
            ->assertSet('tanggalGajian', '5')
            ->set('gajiPokok', '')
            ->set('hariKerja', '')
            ->set('tanggalGajian', '')
            ->call('simpan')
            ->assertHasNoErrors();

        $this->assertNull($joker->fresh()->gajiBawaan());
    }

    public function test_default_salary_rejects_values_that_make_no_sense(): void
    {
        $rohim = Karyawan::where('nama', 'Rohim')->sole();

        Livewire::test(DataKaryawanPage::class)
            ->call('ubah', $rohim->id)
            ->set('gajiPokok', '-1')
            ->set('hariKerja', '400')
            ->set('tanggalGajian', '32')
            ->call('simpan')
            ->assertHasErrors(['gajiPokok' => 'min', 'hariKerja' => 'max', 'tanggalGajian' => 'max'])
            ->set('gajiPokok', 'dua juta')
            ->set('hariKerja', '0')
            ->set('tanggalGajian', '0')
            ->call('simpan')
            ->assertHasErrors(['gajiPokok' => 'integer', 'tanggalGajian' => 'min'])
            ->assertHasNoErrors('hariKerja');

        $this->assertSame([2_000_000, 30, 25], [$rohim->fresh()->gaji_pokok, $rohim->fresh()->hari_kerja, $rohim->fresh()->tanggal_gajian]);
    }

    public function test_seeding_twice_does_not_duplicate_employees(): void
    {
        $this->seed([KaryawanSeeder::class, PayrollSeeder::class]);

        $this->assertSame(9, Karyawan::count());
        $this->assertSame(9, SlipGaji::whereNotNull('karyawan_id')->count());
    }

    public function test_page_lists_every_employee_with_a_link_to_the_slip(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
        $slipFrengky = SlipGaji::where('nama', 'Frengky')->firstOrFail();

        $respons = $this->get(route('karyawan'))
            ->assertOk()
            ->assertSee('Data karyawan')
            ->assertSee('9 orang')
            ->assertSee('8 ABK, 1 Joker')
            ->assertSee('4 ABK, 1 Joker')
            ->assertSee('slip gaji Periode Juli 2026')
            ->assertSee('ketua ABK')
            ->assertSee('7.729.721')
            ->assertSee(route('payroll.abk', ['periode' => $periode->id]).'#slip-'.$slipFrengky->id, false);

        foreach (['Wahyu', 'Angga', 'Rifi', 'Mustofa', 'Frengky', 'Igo', 'Utama', 'Rafi', 'Rohim'] as $nama) {
            $respons->assertSee($nama);
        }
    }

    public function test_page_works_without_payroll_and_without_employees(): void
    {
        SlipGaji::query()->delete();

        $this->get(route('karyawan'))
            ->assertOk()
            ->assertSee('Mustofa')
            ->assertDontSee('Bersih diterima')
            ->assertDontSee('belum ada slip');

        Karyawan::query()->delete();

        $this->get(route('karyawan'))
            ->assertOk()
            ->assertSee('Belum ada karyawan')
            ->assertDontSee('Daftar karyawan');
    }

    public function test_deleting_a_house_keeps_its_employees(): void
    {
        Kandang::where('nama', 'Kandang 1')->firstOrFail()->delete();

        $this->assertSame(9, Karyawan::count());
        $this->assertSame(4, Karyawan::whereNull('kandang_id')->count());
    }

    public function test_employee_can_be_added_from_the_page_and_is_logged(): void
    {
        $kandangDua = Kandang::where('nama', 'Kandang 2')->firstOrFail();

        Livewire::test(DataKaryawanPage::class)
            ->call('tambah')
            ->set('nama', '  Bagas ')
            ->set('jabatan', Jabatan::Joker->value)
            ->set('kandangId', $kandangDua->id)
            ->set('keterangan', 'pengganti cuti')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Karyawan Bagas ditambahkan.')
            ->assertSee('Bagas')
            ->assertSee('10 orang');

        $this->assertDatabaseHas('karyawans', ['nama' => 'Bagas', 'jabatan' => 'Joker', 'kandang_id' => $kandangDua->id, 'keterangan' => 'pengganti cuti']);
        $aktivitas = Aktivitas::sole();
        $this->assertSame([JenisAktivitas::Tambah, ModulAktivitas::Karyawan], [$aktivitas->jenis, $aktivitas->modul]);
        $this->assertSame(['Karyawan Bagas ditambahkan', 'Joker, Kandang 2'], [$aktivitas->kalimat(), $aktivitas->rincian]);
    }

    public function test_employee_can_be_updated_after_confirmation_and_unchanged_saves_are_not_logged(): void
    {
        $rohim = Karyawan::where('nama', 'Rohim')->firstOrFail();
        $kandangSatu = Kandang::where('nama', 'Kandang 1')->firstOrFail();

        $halaman = Livewire::test(DataKaryawanPage::class)
            ->call('ubah', $rohim->id)
            ->assertSet('nama', 'Rohim')
            ->assertSeeHtml('data-bs-target="#konfirmasi-simpan-karyawan"')
            ->call('simpan')
            ->assertHasNoErrors();
        $this->assertSame(0, Aktivitas::count());

        $halaman->call('ubah', $rohim->id)
            ->set('jabatan', Jabatan::Abk->value)
            ->set('kandangId', $kandangSatu->id)
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Karyawan Rohim diperbarui.');

        $this->assertSame([Jabatan::Abk, $kandangSatu->id], [$rohim->fresh()->jabatan, $rohim->fresh()->kandang_id]);
        $this->assertSame(['Karyawan Rohim diubah', 'ABK, Kandang 1'], [Aktivitas::sole()->kalimat(), Aktivitas::sole()->rincian]);
        // Slip gaji lama tetap mencatat jabatan saat slip dibuat.
        $this->assertSame(Jabatan::Joker, SlipGaji::where('karyawan_id', $rohim->id)->firstOrFail()->jabatan);
    }

    public function test_employee_form_requires_a_name_unique_within_the_house(): void
    {
        $kandangSatu = Kandang::where('nama', 'Kandang 1')->firstOrFail();

        Livewire::test(DataKaryawanPage::class)
            ->call('tambah')
            ->set('nama', '')
            ->call('simpan')
            ->assertHasErrors(['nama' => 'required'])
            ->set('nama', 'Wahyu')
            ->set('kandangId', $kandangSatu->id)
            ->call('simpan')
            ->assertHasErrors(['nama' => 'unique'])
            ->set('kandangId', Kandang::where('nama', 'Kandang 2')->firstOrFail()->id)
            ->call('simpan')
            ->assertHasNoErrors();

        $this->assertSame(2, Karyawan::where('nama', 'Wahyu')->count());
    }

    public function test_deleting_an_employee_keeps_their_payroll_slips(): void
    {
        $mustofa = Karyawan::where('nama', 'Mustofa')->firstOrFail();
        $jumlahSlip = SlipGaji::where('karyawan_id', $mustofa->id)->count();

        Livewire::test(DataKaryawanPage::class)
            ->call('mintaHapus', $mustofa->id)
            ->assertSet('namaHapus', 'Mustofa')
            ->call('hapus')
            ->assertSet('pesan', 'Karyawan Mustofa dihapus.')
            ->assertSee('8 orang');

        $this->assertModelMissing($mustofa);
        $this->assertGreaterThan(0, $jumlahSlip);
        $this->assertSame($jumlahSlip, SlipGaji::where('nama', 'Mustofa')->whereNull('karyawan_id')->count());
        $this->assertSame(['Karyawan Mustofa dihapus', 'ABK, Kandang 1'], [Aktivitas::sole()->kalimat(), Aktivitas::sole()->rincian]);
    }

    public function test_unplaced_employee_stays_listed_so_it_can_be_edited(): void
    {
        Karyawan::factory()->create(['nama' => 'Tanpa Kandang']);

        $this->get(route('karyawan'))
            ->assertOk()
            ->assertSee('Belum ditempatkan')
            ->assertSee('Tanpa Kandang');
    }

    /**
     * @return array<string, mixed>|null
     */
    private function daftar(): ?array
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail()->load(LembarRhpp::RELASI);
        $kandangPeriode = $periode->kandangPeriode()->with(['kandang', 'slipGaji.penerimaBagiHasil', 'bagiHasil.penerima'])->get();

        return DaftarKaryawan::buat(Karyawan::with('kandang')->get(), LembarPayroll::buat($kandangPeriode, LembarRhpp::real($periode)));
    }
}
