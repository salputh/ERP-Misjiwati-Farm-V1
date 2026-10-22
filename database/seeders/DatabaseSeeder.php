<?php

namespace Database\Seeders;

use App\Models\Farm;
use App\Models\JenisPakan;
use App\Models\Kandang;
use App\Models\PemberianPakan;
use App\Models\PenerimaanPakan;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use App\Models\Recording;
use App\Models\SesiSampling;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class DatabaseSeeder extends Seeder
{
    /**
     * Periode Juli 2026, dari lembar "Data Record Kandang 1" dan "Data Record Kandang 2".
     * Per hari mulai umur 1: [mati, pakan (zak), ABW (gram)]. Afkir nol; jenis pakan tidak tercatat.
     *
     * @var array<string, array{populasi: int, harian: list<array{int, int, float}>}>
     */
    private const JULI = [
        'Kandang 1' => [
            'populasi' => 20000,
            'harian' => [
                [48, 7, 69], [15, 7, 80], [26, 10, 100], [24, 11, 108], [17, 10, 145], [12, 10, 166], [28, 12, 194],
                [5, 16, 242], [0, 18, 287], [10, 26, 324], [8, 28, 385], [6, 28, 438], [4, 34, 503], [3, 35, 546],
                [5, 36, 604], [5, 31, 718], [4, 40, 807], [32, 40, 910], [12, 42, 976], [6, 44, 1051], [12, 45, 1144],
                [17, 47, 1251], [6, 53, 1362], [6, 60, 1493],
            ],
        ],
        'Kandang 2' => [
            'populasi' => 25000,
            'harian' => [
                [97, 9, 66], [70, 8, 75], [57, 8, 101], [35, 13, 132], [23, 15, 156], [12, 16, 180], [26, 22, 221],
                [13, 23, 269], [7, 24, 317], [3, 30, 357], [10, 31, 394.8], [8, 31, 445], [5, 36, 498.5], [11, 37, 561],
                [11, 39, 631], [5, 44, 738], [3, 49, 811], [14, 49, 876], [6, 52, 943], [8, 51, 1050], [8, 57, 1136],
                [8, 58, 1237], [11, 71, 1342], [8, 77, 1466],
            ],
        ],
    ];

    /**
     * Periode September 2026, pakan masuk dari "Laporan Harian" 2 Oktober 2026: [tanggal, jenis, zak].
     * Entri 25 September di lembar tertulis tahun 3036; dianggap salah ketik untuk 2026.
     *
     * @var list<array{string, string, int}>
     */
    private const SEPTEMBER_PAKAN_MASUK = [
        ['2026-09-08', 'SB-10', 60], ['2026-09-16', 'SB-10', 60], ['2026-09-18', 'SB-10', 36], ['2026-09-18', 'SB-11', 124],
        ['2026-09-22', 'SB-11', 160], ['2026-09-25', 'SB-11', 80], ['2026-09-28', 'SB-11', 140], ['2026-09-28', 'SB-12', 20],
        ['2026-09-29', 'SB-11', 68], ['2026-09-29', 'SB-12', 92], ['2026-10-01', 'SB-12', 100], ['2026-10-02', 'SB-12', 160],
    ];

    /**
     * Periode September 2026, log pemberian pakan Kandang 2: umur => [[jenis, zak], ...]. Umur 1 tidak ada pemberian.
     *
     * @var array<int, list<array{string, int}>>
     */
    private const SEPTEMBER_PEMBERIAN = [
        0 => [['SB-10', 9]], 2 => [['SB-10', 9]], 3 => [['SB-10', 10]], 4 => [['SB-10', 12]], 5 => [['SB-10', 20]],
        6 => [['SB-10', 22]], 7 => [['SB-10', 21]], 8 => [['SB-10', 24]], 9 => [['SB-10', 22]],
        10 => [['SB-10', 7], ['SB-11', 17]], 11 => [['SB-11', 26]], 12 => [['SB-11', 31]], 13 => [['SB-11', 41]],
        14 => [['SB-11', 48]], 15 => [['SB-11', 52]], 16 => [['SB-11', 52]], 17 => [['SB-11', 52]], 18 => [['SB-11', 54]],
        19 => [['SB-11', 52]], 20 => [['SB-11', 58]], 21 => [['SB-11', 60]],
    ];

    /**
     * Sampling bobot Kandang 2 periode September, dari lembar "Rekap Hasil Sampel Bobot Ayam".
     * [tanggal, umur, dengan sexing, ekor per sampel per kelamin, berat [lantai][kelamin][line] => [sampel 1, sampel 2]].
     *
     * @var list<array{string, int, bool, array<string, int>, array<string, array<string, array<string, array{int, int}>>>}>
     */
    private const SEPTEMBER_SAMPLING = [
        ['2026-09-12', 1, false, ['campuran' => 20], [
            'bawah' => ['campuran' => ['A' => [1400, 1400], 'B' => [1400, 1400], 'C' => [1400, 1500], 'D' => [1400, 1400], 'E' => [1400, 1500], 'F' => [1400, 1500]]],
            'atas' => ['campuran' => ['J' => [1400, 1400], 'K' => [1400, 1500], 'L' => [1400, 1500], 'M' => [1400, 1400], 'N' => [1400, 1500], 'O' => [1500, 1500]]],
        ]],
        ['2026-10-03', 22, true, ['jantan' => 10, 'betina' => 10], [
            'bawah' => [
                'jantan' => ['A' => [14500, 14600], 'B' => [14600, 14600], 'C' => [14700, 14600], 'D' => [14700, 14600], 'E' => [14600, 14600], 'F' => [14700, 14600]],
                'betina' => ['A' => [13200, 13300], 'B' => [13300, 13300], 'C' => [13400, 13300], 'D' => [13300, 13300], 'E' => [13400, 13300], 'F' => [13300, 13400]],
            ],
            'atas' => [
                'jantan' => ['J' => [14400, 14500], 'K' => [14500, 14600], 'L' => [14600, 14600], 'M' => [14700, 14600], 'N' => [14600, 14700], 'O' => [14600, 14700]],
                'betina' => ['J' => [13300, 13200], 'K' => [13200, 13300], 'L' => [13300, 13200], 'M' => [13300, 13300], 'N' => [13400, 13300], 'O' => [13300, 13400]],
            ],
        ]],
    ];

    public function run(): void
    {
        $jenis = collect(['SB-10', 'SB-11', 'SB-12'])
            ->mapWithKeys(fn (string $kode): array => [$kode => JenisPakan::create(['kode' => $kode])]);

        $farm = Farm::query()->where('kode', 'K0242')->firstOrFail();
        $kandang = [
            'Kandang 1' => Kandang::create(['farm_id' => $farm->id, 'nama' => 'Kandang 1', 'kapasitas' => 20000]),
            'Kandang 2' => Kandang::create(['farm_id' => $farm->id, 'nama' => 'Kandang 2', 'kapasitas' => 26000]),
        ];

        $this->periodeJuli($farm, $kandang);
        $this->periodeSeptember($farm, $kandang['Kandang 2'], $jenis->all());

        $this->call([PemodalSeeder::class, PemanenSeeder::class, PanenSeeder::class, RhppSeeder::class, KasOperasionalSeeder::class, BagiHasilSeeder::class, KaryawanSeeder::class, PayrollSeeder::class]);
    }

    /**
     * @param  array<string, Kandang>  $kandang
     */
    private function periodeJuli(Farm $farm, array $kandang): void
    {
        $chickIn = Carbon::create(2026, 7, 15);

        $periode = Periode::create([
            'farm_id' => $farm->id,
            'nama' => 'Periode Juli 2026',
            'nomor_siklus' => 18,
            'inti' => 'PT. Indojaya Agrinusa',
            'ppl' => 'PPL Misjiwati',
            'strain' => 'Standar farm',
            'tanggal_chick_in' => $chickIn,
            'berat_doc_gram' => 37,
            'status' => 'tutup_rhpp',
        ]);

        foreach (self::JULI as $nama => $data) {
            $periodeKandang = PeriodeKandang::create([
                'periode_id' => $periode->id,
                'kandang_id' => $kandang[$nama]->id,
                'populasi_awal' => $data['populasi'],
                'tanggal_chick_in' => $chickIn,
                'berat_doc_gram' => 37,
                'harga_doc_per_ekor' => 9415,
                'bonus_doc_ekor' => 0,
            ]);

            foreach ($data['harian'] as $indeks => [$mati, $zak, $abw]) {
                $umur = $indeks + 1;
                $tanggal = $chickIn->copy()->addDays($umur);

                Recording::create([
                    'periode_kandang_id' => $periodeKandang->id,
                    'tanggal' => $tanggal,
                    'umur' => $umur,
                    'mati' => $mati,
                    'afkir' => 0,
                    'bobot_rata_gram' => $abw,
                ]);

                PemberianPakan::create([
                    'periode_kandang_id' => $periodeKandang->id,
                    'jenis_pakan_id' => null,
                    'tanggal' => $tanggal,
                    'umur' => $umur,
                    'zak' => $zak,
                ]);
            }
        }
    }

    /**
     * Dari "Laporan Harian" dan log pemberian pakan per 2 Oktober 2026 (umur 21).
     *
     * @param  array<string, JenisPakan>  $jenis
     */
    private function periodeSeptember(Farm $farm, Kandang $kandangDua, array $jenis): void
    {
        $chickIn = Carbon::create(2026, 9, 11);

        $periode = Periode::create([
            'farm_id' => $farm->id,
            'nama' => 'Periode September 2026',
            'nomor_siklus' => 19,
            'inti' => 'PT. Indojaya Agrinusa',
            'ppl' => 'PPL Misjiwati',
            'strain' => 'Standar farm',
            'tanggal_chick_in' => $chickIn,
            // Berat DOC periode ini tidak tercantum di laporan; memakai angka periode Juli.
            'berat_doc_gram' => 37,
            'status' => 'berjalan',
        ]);

        $periodeKandang = PeriodeKandang::create([
            'periode_id' => $periode->id,
            'kandang_id' => $kandangDua->id,
            'populasi_awal' => 26000,
            'tanggal_chick_in' => $chickIn,
            'berat_doc_gram' => 37,
            'harga_doc_per_ekor' => 9415,
            'bonus_doc_ekor' => 0,
        ]);

        foreach (self::SEPTEMBER_PAKAN_MASUK as [$tanggal, $kode, $zak]) {
            PenerimaanPakan::create([
                'periode_id' => $periode->id,
                'jenis_pakan_id' => $jenis[$kode]->id,
                'tanggal' => $tanggal,
                'zak' => $zak,
            ]);
        }

        foreach (self::SEPTEMBER_PEMBERIAN as $umur => $pemberian) {
            foreach ($pemberian as [$kode, $zak]) {
                PemberianPakan::create([
                    'periode_kandang_id' => $periodeKandang->id,
                    'jenis_pakan_id' => $jenis[$kode]->id,
                    'tanggal' => $chickIn->copy()->addDays($umur),
                    'umur' => $umur,
                    'zak' => $zak,
                ]);
            }
        }

        // Laporan hanya memberi kematian hari ke-21 (5 ekor) dan kumulatifnya (1.002 ekor).
        // Rincian hari 0 sampai 20 belum ada, jadi 997 ekor dicatat sekaligus di hari ke-20.
        Recording::create([
            'periode_kandang_id' => $periodeKandang->id,
            'tanggal' => $chickIn->copy()->addDays(20),
            'umur' => 20,
            'mati' => 997,
            'afkir' => 0,
            'catatan' => 'Akumulasi kematian hari 0 sampai 20. Rincian per hari belum dicatat.',
        ]);

        Recording::create([
            'periode_kandang_id' => $periodeKandang->id,
            'tanggal' => $chickIn->copy()->addDays(21),
            'umur' => 21,
            'mati' => 5,
            'afkir' => 0,
            'bobot_rata_gram' => 1269,
        ]);

        foreach (self::SEPTEMBER_SAMPLING as [$tanggal, $umur, $denganSexing, $ekorPerSampel, $berat]) {
            $sesi = SesiSampling::create([
                'periode_kandang_id' => $periodeKandang->id,
                'tanggal' => $tanggal,
                'umur' => $umur,
                'dengan_sexing' => $denganSexing,
            ]);

            foreach ($berat as $lantai => $perKelamin) {
                foreach ($perKelamin as $kelamin => $perLine) {
                    foreach ($perLine as $line => $sampel) {
                        foreach ($sampel as $indeks => $gram) {
                            $sesi->titik()->create([
                                'lantai' => $lantai,
                                'line' => $line,
                                'kelamin' => $kelamin,
                                'urutan' => $indeks + 1,
                                'berat_gram' => $gram,
                                'ekor' => $ekorPerSampel[$kelamin],
                            ]);
                        }
                    }
                }
            }
        }
    }
}
