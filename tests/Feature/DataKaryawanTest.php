<?php

namespace Tests\Feature;

use App\Enums\Jabatan;
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
