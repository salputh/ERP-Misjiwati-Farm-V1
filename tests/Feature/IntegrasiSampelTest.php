<?php

namespace Tests\Feature;

use App\Models\Kandang;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use App\Models\SesiSampling;
use App\Support\SusunanSampling;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class IntegrasiSampelTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN = 'token-uji-rahasia';

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-10-04');
        $this->seed(DatabaseSeeder::class);
        config(['integrasi.kandang_suite.token' => self::TOKEN]);
    }

    /**
     * Titik lengkap sesuai susunan kandang, semua berat sama.
     *
     * @return list<array<string, int|string>>
     */
    private function titik(string $kandang, bool $sexing = false, int $berat = 1500, int $ekor = 20): array
    {
        $titik = [];
        foreach (SusunanSampling::untuk($kandang) as $lantai => $info) {
            foreach ($sexing ? ['jantan', 'betina'] : ['campuran'] as $kelamin) {
                foreach ($info['line'] as $line) {
                    foreach ([1, 2] as $urutan) {
                        $titik[] = compact('lantai', 'kelamin', 'line', 'urutan') + ['beratGram' => $berat, 'ekor' => $ekor];
                    }
                }
            }
        }

        return $titik;
    }

    /**
     * @param  array<string, mixed>  $ubah
     * @return array<string, mixed>
     */
    private function muatan(array $ubah = []): array
    {
        return array_merge([
            'idEksternal' => 'ks-sampel-1',
            'kandang' => 'Kandang 2',
            'tanggal' => '2026-09-20',
            'jenis' => 'campuran',
            'titik' => $this->titik('Kandang 2'),
        ], $ubah);
    }

    private function kirim(array $muatan, ?string $token = self::TOKEN): TestResponse
    {
        return $this->withToken((string) $token)->postJson('/api/integrasi/sampel', $muatan);
    }

    private function kandangSatuBerjalan(): PeriodeKandang
    {
        $periode = Periode::query()->where('nama', 'Periode September 2026')->firstOrFail();
        $kandang = Kandang::query()->where('nama', 'Kandang 1')->firstOrFail();

        return PeriodeKandang::query()->firstOrCreate(
            ['periode_id' => $periode->id, 'kandang_id' => $kandang->id],
            [
                'nomor_siklus' => 99,
                'populasi_awal' => 20000,
                'tanggal_chick_in' => Carbon::create(2026, 9, 11),
                'berat_doc_gram' => 37,
                'harga_doc_per_ekor' => 9415,
                'bonus_doc_ekor' => 0,
            ],
        );
    }

    public function test_tanpa_atau_dengan_token_salah_ditolak(): void
    {
        $this->postJson('/api/integrasi/sampel', $this->muatan())->assertUnauthorized();
        $this->kirim($this->muatan(), 'salah')->assertUnauthorized();
        $this->assertSame(0, SesiSampling::query()->whereNotNull('id_eksternal')->count());
    }

    public function test_integrasi_nonaktif_bila_token_belum_diatur(): void
    {
        config(['integrasi.kandang_suite.token' => null]);

        $this->kirim($this->muatan())->assertStatus(503);
    }

    public function test_sampel_lengkap_tersimpan_dan_dihitung_erp(): void
    {
        $this->kirim($this->muatan())
            ->assertCreated()
            ->assertJsonPath('umur', 9);

        $sesi = SesiSampling::query()->where('id_eksternal', 'ks-sampel-1')->firstOrFail();
        $this->assertSame('2026-09-20', $sesi->tanggal->format('Y-m-d'));
        $this->assertFalse($sesi->dengan_sexing);
        $this->assertCount(24, $sesi->titik);
        $this->assertEqualsWithDelta(1500 / 20, $sesi->load('titik')->abw(), 0.001);
    }

    public function test_sampel_dengan_sexing_tersimpan(): void
    {
        $this->kirim($this->muatan(['jenis' => 'sexing', 'titik' => $this->titik('Kandang 2', true, 14500, 10)]))->assertCreated();

        $sesi = SesiSampling::query()->where('id_eksternal', 'ks-sampel-1')->firstOrFail();
        $this->assertTrue($sesi->dengan_sexing);
        $this->assertCount(48, $sesi->titik);
    }

    public function test_kiriman_ulang_memperbarui_sesi_yang_sama(): void
    {
        $this->kirim($this->muatan())->assertCreated();
        $jumlahSesi = SesiSampling::query()->count();

        $this->kirim($this->muatan(['titik' => $this->titik('Kandang 2', false, 1600)]))->assertOk();

        $this->assertSame($jumlahSesi, SesiSampling::query()->count());
        $sesi = SesiSampling::query()->where('id_eksternal', 'ks-sampel-1')->firstOrFail();
        $this->assertCount(24, $sesi->titik);
        $this->assertSame(1600, (int) $sesi->titik->first()->berat_gram);
    }

    public function test_tanggal_yang_sudah_ada_di_erp_tidak_ditimpa(): void
    {
        $adaDiErp = SesiSampling::query()->whereDate('tanggal', '2026-10-03')->firstOrFail();
        $beratAwal = $adaDiErp->titik()->orderBy('id')->value('berat_gram');

        $this->kirim($this->muatan(['tanggal' => '2026-10-03', 'jenis' => 'sexing', 'titik' => $this->titik('Kandang 2', true)]))
            ->assertStatus(409);

        $this->assertSame($beratAwal, $adaDiErp->fresh()->titik()->orderBy('id')->value('berat_gram'));
        $this->assertNull($adaDiErp->fresh()->id_eksternal);
    }

    public function test_kandang_satu_memakai_susunan_line_sendiri(): void
    {
        $this->kandangSatuBerjalan();
        $titik = $this->titik('Kandang 1');

        $this->assertCount(20, $titik); // 2 lantai x 5 line x 2 sampel
        $this->kirim($this->muatan(['kandang' => 'Kandang 1', 'titik' => $titik]))->assertCreated();

        $lines = SesiSampling::query()->where('id_eksternal', 'ks-sampel-1')->firstOrFail()
            ->titik->groupBy('lantai')->map(fn ($t) => $t->pluck('line')->unique()->sort()->values()->all())->all();
        $this->assertSame(['A', 'B', 'C', 'D', 'E'], $lines['bawah']);
        $this->assertSame(['F', 'G', 'H', 'I', 'J'], $lines['atas']);
    }

    public function test_kandang_satu_dengan_susunan_kandang_dua_ditolak(): void
    {
        $this->kandangSatuBerjalan();

        $this->kirim($this->muatan(['kandang' => 'Kandang 1', 'titik' => $this->titik('Kandang 2')]))
            ->assertStatus(422)
            ->assertJsonPath('pesan', 'Data sampel belum lengkap atau tidak sesuai susunan Kandang 1.');
    }

    public function test_sampel_tidak_lengkap_ditolak_dengan_rincian(): void
    {
        $titik = $this->titik('Kandang 2');
        array_pop($titik);

        $respons = $this->kirim($this->muatan(['titik' => $titik]))->assertStatus(422);

        $this->assertStringContainsString('Belum diisi', $respons->json('rincian.0'));
        $this->assertSame(0, SesiSampling::query()->whereNotNull('id_eksternal')->count());
    }

    public function test_berat_desimal_ditolak(): void
    {
        $titik = $this->titik('Kandang 2');
        $titik[0]['beratGram'] = 1500.5;

        $this->kirim($this->muatan(['titik' => $titik]))->assertStatus(422);
    }

    public function test_ekor_berbeda_dalam_satu_kelamin_ditolak(): void
    {
        $titik = $this->titik('Kandang 2');
        $titik[0]['ekor'] = 10;

        $this->kirim($this->muatan(['titik' => $titik]))
            ->assertStatus(422)
            ->assertJsonFragment(['Jumlah ekor campuran harus sama untuk semua titik.']);
    }

    public function test_kandang_tidak_dikenal_dan_tanggal_di_luar_periode_ditolak(): void
    {
        $this->kirim($this->muatan(['kandang' => 'Kandang 9']))->assertStatus(422);
        $this->kirim($this->muatan(['tanggal' => '2026-09-01']))->assertStatus(422);
    }

    public function test_periode_tertutup_tidak_menerima_sampel(): void
    {
        Periode::query()->where('nama', 'Periode September 2026')->update(['status' => 'tutup_rhpp']);

        $this->kirim($this->muatan())->assertStatus(422);
    }
}
