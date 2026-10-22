<?php

namespace Tests\Feature;

use App\Models\Periode;
use App\Support\RingkasanHarian;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class LaporanHarianTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Angka dari lembar "Laporan Harian Pemeliharaan Ayam Broiler" per 2 Oktober 2026.
     */
    public function test_report_matches_the_original_daily_report(): void
    {
        $this->seed(DatabaseSeeder::class);

        $laporan = $this->laporan('Periode September 2026', '2026-10-02');

        $this->assertSame(21, $laporan['umur']);
        $this->assertSame(26000, $laporan['populasi']);
        $this->assertCount(12, $laporan['pakan_masuk']);
        $this->assertSame(1100.0, $laporan['total_pakan_masuk']);

        $opname = collect($laporan['opname'])->keyBy('jenis');
        $this->assertSame([156.0, 0.0, 156.0, 0.0], $this->stok($opname['SB-10']));
        $this->assertSame([572.0, 60.0, 543.0, 29.0], $this->stok($opname['SB-11']));
        $this->assertSame([372.0, 0.0, 0.0, 372.0], $this->stok($opname['SB-12']));
        $this->assertSame(401.0, $laporan['total_opname']['sisa']);
        $this->assertEqualsWithDelta(6.68, $laporan['hari_cukup'], 0.01);

        $this->assertSame(5, $laporan['total']['mati_hari_ini']);
        $this->assertSame(1002, $laporan['total']['mati_kumulatif']);
        $this->assertSame(0, $laporan['total']['terpanen']);
        $this->assertSame(24998, $laporan['total']['sisa']);
        $this->assertSame(1269.0, $laporan['total']['abw']);
    }

    public function test_report_subtracts_harvested_chickens_only_through_the_report_date(): void
    {
        $this->seed(DatabaseSeeder::class);
        $september = Periode::where('nama', 'Periode September 2026')->firstOrFail();
        $september->notaPanen()->create([
            'tanggal_panen' => '2026-10-01',
            'no_btpa' => 'TEST-001',
            'no_polisi' => 'BM TEST',
            'pembeli' => 'Pembeli Tes',
            'mulai' => '2026-10-01 20:00:00',
            'selesai' => '2026-10-01 21:00:00',
            'jumlah_krat' => 10,
            'ekor' => 200,
            'berat_kg' => 300,
            'netto_nota_kg' => 300,
        ]);
        $september->notaPanen()->create([
            'tanggal_panen' => '2026-10-03',
            'no_btpa' => 'TEST-002',
            'no_polisi' => 'BM TEST',
            'pembeli' => 'Pembeli Tes',
            'mulai' => '2026-10-03 20:00:00',
            'selesai' => '2026-10-03 21:00:00',
            'jumlah_krat' => 5,
            'ekor' => 100,
            'berat_kg' => 150,
            'netto_nota_kg' => 150,
        ]);

        $sebelumPanenKedua = $this->laporan('Periode September 2026', '2026-10-02');
        $setelahPanenKedua = $this->laporan('Periode September 2026', '2026-10-03');

        $this->assertSame([200, 24798], [$sebelumPanenKedua['total']['terpanen'], $sebelumPanenKedua['total']['sisa']]);
        $this->assertSame([300, 24698], [$setelahPanenKedua['total']['terpanen'], $setelahPanenKedua['total']['sisa']]);
    }

    public function test_report_only_counts_data_up_to_the_report_date(): void
    {
        $this->seed(DatabaseSeeder::class);

        $laporan = $this->laporan('Periode September 2026', '2026-09-21');
        $opname = collect($laporan['opname'])->keyBy('jenis');

        $this->assertSame(10, $laporan['umur']);
        $this->assertSame(280.0, $laporan['total_pakan_masuk']);
        $this->assertSame([156.0, 7.0, 156.0, 0.0], $this->stok($opname['SB-10']));
        $this->assertSame([124.0, 17.0, 17.0, 107.0], $this->stok($opname['SB-11']));
        $this->assertArrayNotHasKey('SB-12', $opname->all());
        $this->assertSame(0, $laporan['total']['mati_kumulatif']);
        $this->assertNull($laporan['total']['abw']);
        $this->assertSame([], $laporan['catatan']);
    }

    public function test_stock_is_not_computed_when_feed_type_was_not_recorded(): void
    {
        $this->seed(DatabaseSeeder::class);

        $laporan = $this->laporan('Periode Juli 2026', '2026-08-08');
        $stok = $laporan['opname'][0];

        $this->assertSame('Jenis belum dicatat', $stok['jenis']);
        $this->assertNull($stok['masuk']);
        $this->assertNull($stok['sisa']);
        $this->assertSame(1540.0, $stok['terpakai']);
        $this->assertNull($laporan['total_opname']['sisa']);
        $this->assertSame(770, $laporan['total']['mati_kumulatif']);
        $this->assertSame(['Kandang 1', 'Kandang 2'], array_column($laporan['kandang'], 'nama'));
    }

    public function test_page_defaults_to_the_last_recorded_date_and_accepts_a_chosen_date(): void
    {
        $this->seed(DatabaseSeeder::class);
        $september = Periode::where('nama', 'Periode September 2026')->firstOrFail();
        $september->notaPanen()->create([
            'tanggal_panen' => '2026-10-03',
            'no_btpa' => 'TEST-003',
            'no_polisi' => 'BM TEST',
            'pembeli' => 'Pembeli Tes',
            'mulai' => '2026-10-03 20:00:00',
            'selesai' => '2026-10-03 21:00:00',
            'jumlah_krat' => 5,
            'ekor' => 100,
            'berat_kg' => 150,
            'netto_nota_kg' => 150,
        ]);

        $this->get(route('laporan.harian'))
            ->assertOk()
            ->assertSee('Sabtu, 3 Oktober 2026')
            ->assertSee('24.898')
            ->assertSee('Akumulasi kematian hari 0 sampai 20');

        $this->get(route('laporan.harian', ['periode' => $september->id, 'tanggal' => '2026-09-21']))
            ->assertOk()
            ->assertSee('Senin, 21 September 2026');

        // Tanggal di luar periode atau tidak sah kembali ke tanggal terakhir.
        $this->get(route('laporan.harian', ['periode' => $september->id, 'tanggal' => '2030-01-01']))
            ->assertOk()
            ->assertSee('Sabtu, 3 Oktober 2026');
        $this->get(route('laporan.harian', ['periode' => $september->id, 'tanggal' => 'bukan-tanggal']))
            ->assertOk()
            ->assertSee('Sabtu, 3 Oktober 2026');
    }

    public function test_page_renders_for_every_period_and_without_data(): void
    {
        $this->get(route('laporan.harian'))->assertOk()->assertSee('Belum ada data untuk dilaporkan');

        $this->seed(DatabaseSeeder::class);

        foreach (Periode::all() as $periode) {
            $this->get(route('laporan.harian', ['periode' => $periode->id]))->assertOk()->assertSee($periode->nama);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function laporan(string $namaPeriode, string $tanggal): array
    {
        $periode = Periode::with([
            'kandangPeriode.kandang',
            'kandangPeriode.recordings',
            'kandangPeriode.pemberianPakan.jenisPakan',
            'penerimaanPakan.jenisPakan',
        ])->where('nama', $namaPeriode)->firstOrFail();

        return RingkasanHarian::buat($periode, Carbon::parse($tanggal));
    }

    /**
     * @param  array<string, mixed>  $stok
     * @return list<float>
     */
    private function stok(array $stok): array
    {
        return [$stok['masuk'], $stok['terpakai_hari_ini'], $stok['terpakai'], $stok['sisa']];
    }
}
