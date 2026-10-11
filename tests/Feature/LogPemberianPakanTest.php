<?php

namespace Tests\Feature;

use App\Models\Periode;
use App\Support\LogPakan;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
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
        $this->assertSame(['masuk' => 1100.0, 'terpakai' => 699.0, 'sisa' => 401.0], $log['total_stok']);

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

        $this->get(route('pakan.log'))
            ->assertOk()
            ->assertSee('Log harian pemberian pakan')
            ->assertSee('Kandang 2 (zak)')
            ->assertDontSee('Kandang 1 (zak)')
            ->assertSee('Jum, 11 Sep 2026');

        $juli = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();

        $this->get(route('pakan.log', ['periode' => $juli->id]))
            ->assertOk()
            ->assertSee('Kandang 1 (zak)')
            ->assertSee('Kandang 2 (zak)');
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
