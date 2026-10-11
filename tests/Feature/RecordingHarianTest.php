<?php

namespace Tests\Feature;

use App\Livewire\RecordingHarian;
use App\Models\PeriodeKandang;
use App\Support\Format;
use App\Support\LembarRecording;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Livewire\Livewire;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class RecordingHarianTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Nilai yang diharapkan disalin dari lembar "Data Record Kandang 1" dan "Data Record Kandang 2",
     * sudah dalam format tampilan lembar itu.
     *
     * @return array<string, array{string, int, array<string, string>}>
     */
    public static function nilaiLembarAsli(): array
    {
        return [
            'kandang 1 hari 1' => ['Kandang 1', 1, [
                'deplesi_kumulatif' => '48', 'deplesi_persen:1' => '0,2', 'deplesi_persen_standar:2' => '0,10', 'deplesi_ekor_standar' => '20',
                'zak_standar' => '7', 'zak_standar_kumulatif' => '7', 'pakan_gram_standar_kumulatif' => '18',
                'zak_kumulatif' => '7', 'pakan_gram' => '18', 'pakan_gram_kumulatif' => '18', 'selisih_zak' => '(0)', 'selisih_pakan_gram' => '(0)',
                'dg_standar' => '19', 'dg' => '32', 'dg_kumulatif' => '32', 'abw_persen_standar' => '123', 'selisih_abw' => '13', 'selisih_dg' => '13',
                'persen_pakan_bw_standar' => '106', 'persen_pakan_bw' => '182',
                'fcr_standar:3' => '0,321', 'fcr:3' => '0,254', 'selisih_fcr:3' => '(0,067)', 'saldo' => '19.952',
            ]],
            'kandang 1 hari 4' => ['Kandang 1', 4, [
                'deplesi_kumulatif' => '113', 'deplesi_ekor_standar' => '98', 'zak_standar' => '12', 'zak_standar_kumulatif' => '38',
                'zak_kumulatif' => '35', 'pakan_gram' => '28', 'pakan_gram_kumulatif' => '88', 'selisih_zak' => '(3)', 'selisih_pakan_gram' => '(8)',
                'dg' => '8', 'dg_kumulatif' => '71', 'abw_persen_standar' => '92', 'selisih_abw' => '(9)', 'selisih_dg' => '(15)',
                'persen_pakan_bw_standar' => '77', 'persen_pakan_bw' => '29', 'fcr:3' => '0,814', 'selisih_fcr:3' => '(0,007)', 'saldo' => '19.887',
            ]],
            'kandang 1 hari 15' => ['Kandang 1', 15, [
                'zak_standar_kumulatif' => '290', 'zak_kumulatif' => '288', 'pakan_gram_kumulatif' => '726', 'selisih_zak' => '(2)', 'selisih_pakan_gram' => '(5)',
                'fcr_standar:3' => '1,183', 'fcr:3' => '1,203', 'selisih_fcr:3' => '0,020', 'saldo' => '19.789',
            ]],
            'kandang 1 hari 24' => ['Kandang 1', 24, [
                'deplesi_kumulatif' => '311', 'deplesi_persen:1' => '1,6', 'deplesi_persen_standar:2' => '3,09', 'deplesi_ekor_standar' => '618',
                'zak_standar' => '54', 'zak_standar_kumulatif' => '694', 'pakan_gram_standar_kumulatif' => '1.755',
                'zak_kumulatif' => '690', 'pakan_gram' => '152', 'pakan_gram_kumulatif' => '1.745', 'selisih_zak' => '(4)', 'selisih_pakan_gram' => '(10)',
                'dg' => '131', 'dg_kumulatif' => '1.456', 'abw_persen_standar' => '113', 'selisih_abw' => '166', 'selisih_dg' => '43',
                'persen_pakan_bw_standar' => '64', 'persen_pakan_bw' => '86',
                'fcr_standar:3' => '1,323', 'fcr:3' => '1,169', 'selisih_fcr:3' => '(0,153)', 'saldo' => '19.689',
            ]],
            'kandang 2 hari 1' => ['Kandang 2', 1, [
                'deplesi_kumulatif' => '97', 'deplesi_persen:1' => '0,4', 'deplesi_ekor_standar' => '25', 'zak_standar' => '9',
                'pakan_gram' => '18', 'selisih_zak' => '0', 'selisih_pakan_gram' => '0', 'dg' => '29', 'abw_persen_standar' => '118',
                'persen_pakan_bw' => '160', 'fcr:3' => '0,274', 'selisih_fcr:3' => '(0,048)', 'saldo' => '24.903',
            ]],
            'kandang 2 hari 11' => ['Kandang 2', 11, [
                'zak_kumulatif' => '199', 'pakan_gram_kumulatif' => '403', 'dg_kumulatif:1' => '357,8', 'abw_persen_standar' => '104',
                'selisih_abw' => '15', 'selisih_dg' => '(12)', 'persen_pakan_bw' => '60', 'fcr:3' => '1,021', 'selisih_fcr:3' => '(0,106)', 'saldo' => '24.647',
            ]],
            'kandang 2 hari 24' => ['Kandang 2', 24, [
                'deplesi_kumulatif' => '459', 'deplesi_persen:1' => '1,8', 'deplesi_ekor_standar' => '773',
                'zak_standar' => '68', 'zak_standar_kumulatif' => '864', 'zak_kumulatif' => '850', 'pakan_gram' => '157', 'pakan_gram_kumulatif' => '1.727',
                'selisih_zak' => '(14)', 'selisih_pakan_gram' => '(28)', 'dg' => '124', 'dg_kumulatif' => '1.429', 'abw_persen_standar' => '110',
                'selisih_abw' => '139', 'selisih_dg' => '36', 'persen_pakan_bw' => '79', 'fcr:3' => '1,178', 'selisih_fcr:3' => '(0,145)', 'saldo' => '24.541',
            ]],
        ];
    }

    /**
     * @param  array<string, string>  $harapan  Kunci "kolom" atau "kolom:desimal" ke teks seperti di lembar.
     */
    #[DataProvider('nilaiLembarAsli')]
    public function test_sheet_matches_the_original_recording(string $namaKandang, int $umur, array $harapan): void
    {
        $this->seed(DatabaseSeeder::class);

        $hari = $this->baris($namaKandang)[$umur - 1];

        foreach ($harapan as $kunci => $teks) {
            [$kolom, $desimal] = array_pad(explode(':', $kunci), 2, 0);

            $this->assertSame($teks, Format::kurung($hari[$kolom], (int) $desimal), "{$namaKandang} hari {$umur}: {$kolom}");
        }
    }

    public function test_days_without_a_record_show_only_standards_and_carry_the_balance(): void
    {
        $this->seed(DatabaseSeeder::class);

        $baris = $this->baris('Kandang 1');
        $hari = $baris[24];

        $this->assertCount(42, $baris);
        $this->assertFalse($hari['terisi']);
        $this->assertNull($hari['mati']);
        $this->assertArrayNotHasKey('zak', $hari);
        $this->assertArrayNotHasKey('fcr', $hari);
        $this->assertSame(311, $hari['deplesi_kumulatif']);
        $this->assertSame(19689, $hari['saldo']);
        $this->assertSame('1.899', Format::kurung($hari['pakan_gram_standar_kumulatif']));
        $this->assertSame('1,339', Format::kurung($hari['fcr_standar'], 3));
        $this->assertSame('1,661', Format::kurung($baris[41]['fcr_standar'], 3));
    }

    public function test_page_shows_the_sheet_and_switches_coops(): void
    {
        $this->seed(DatabaseSeeder::class);

        $kandangDua = PeriodeKandang::where('populasi_awal', 25000)->firstOrFail();

        $this->get(route('recording.harian', ['periode' => $kandangDua->periode_id]))
            ->assertOk()
            ->assertSee('Recording harian')
            ->assertSee('20.000 ekor')
            ->assertSee('Minggu VI')
            ->assertSee('19.952');

        Livewire::withQueryParams(['periode' => $kandangDua->periode_id])->test(RecordingHarian::class)
            ->call('pilihKandang', $kandangDua->id)
            ->assertSee('25.000 ekor')
            ->assertSee('24.903');
    }

    public function test_page_shows_empty_state_without_a_period(): void
    {
        $this->get(route('recording.harian'))
            ->assertOk()
            ->assertSee('Belum ada kandang untuk direkam');
    }

    public function test_page_offers_downloads_for_the_selected_coop(): void
    {
        $this->seed(DatabaseSeeder::class);

        $periodeKandang = PeriodeKandang::where('populasi_awal', 25000)->firstOrFail();

        $this->get(route('recording.harian', [
            'periode' => $periodeKandang->periode_id,
            'kandang' => $periodeKandang->id,
        ]))
            ->assertOk()
            ->assertSee('PDF')
            ->assertSee('Excel (XLSX)')
            ->assertSee(route('recording.harian.export', ['periodeKandang' => $periodeKandang->id, 'format' => 'pdf']))
            ->assertSee(route('recording.harian.export', ['periodeKandang' => $periodeKandang->id, 'format' => 'xlsx']));
    }

    public function test_pdf_export_downloads_a_valid_pdf_for_the_selected_coop(): void
    {
        $this->seed(DatabaseSeeder::class);

        $periodeKandang = PeriodeKandang::with(['kandang', 'periode'])
            ->where('populasi_awal', 20000)
            ->firstOrFail();
        $filename = Str::slug("recording-harian-{$periodeKandang->kandang->nama}-{$periodeKandang->periode->nama}").'.pdf';

        $response = $this->get(route('recording.harian.export', [
            'periodeKandang' => $periodeKandang->id,
            'format' => 'pdf',
        ]));

        $response->assertOk()->assertDownload($filename);
        $this->assertStringStartsWith('%PDF-', $response->getContent());
    }

    public function test_excel_export_downloads_a_workbook_with_recording_data(): void
    {
        $this->seed(DatabaseSeeder::class);

        $periodeKandang = PeriodeKandang::with(['kandang', 'periode', 'recordings', 'pemberianPakan'])
            ->where('populasi_awal', 20000)
            ->firstOrFail();
        $filename = Str::slug("recording-harian-{$periodeKandang->kandang->nama}-{$periodeKandang->periode->nama}").'.xlsx';

        $response = $this->get(route('recording.harian.export', [
            'periodeKandang' => $periodeKandang->id,
            'format' => 'xlsx',
        ]));

        $response->assertOk()->assertDownload($filename);

        $worksheet = IOFactory::load($response->baseResponse->getFile()->getPathname())->getActiveSheet();

        $this->assertSame('Tanggal', $worksheet->getCell('A1')->getValue());
        $this->assertSame('Saldo ayam (ekor)', $worksheet->getCell('AF1')->getValue());
        $this->assertSame(43, $worksheet->getHighestRow());
        $this->assertSame('AF', $worksheet->getHighestColumn());
        $this->assertSame(LembarRecording::baris($periodeKandang)[0]['mati'], $worksheet->getCell('C2')->getValue());
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function baris(string $namaKandang): array
    {
        $periodeKandang = PeriodeKandang::with(['periode', 'recordings', 'pemberianPakan'])
            ->whereRelation('periode', 'nama', 'Periode Juli 2026')
            ->whereRelation('kandang', 'nama', $namaKandang)
            ->firstOrFail();

        return LembarRecording::baris($periodeKandang);
    }
}
