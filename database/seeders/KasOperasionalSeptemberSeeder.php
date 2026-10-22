<?php

namespace Database\Seeders;

use App\Enums\KategoriKas;
use App\Models\Kandang;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class KasOperasionalSeptemberSeeder extends Seeder
{
    /**
     * Dana masuk; tanggal setoran Rp3.862.000 mengikuti tanggal 10 September pada sel tanggal gabungan.
     *
     * @var list<array{string, int}>
     */
    private const DANA = [
        ['2026-09-04', 10_000_000],
        ['2026-09-10', 10_000_000],
        ['2026-09-10', 3_862_000],
        ['2026-09-22', 10_000_000],
        ['2026-09-29', 10_000_000],
    ];

    /**
     * Buku besar laporan kas Kandang 2; jumlah item disertakan dalam uraian karena tidak ada kolom khusus.
     *
     * @var list<array{string, KategoriKas, string, int}>
     */
    private const KELUAR = [
        ['2026-09-05', KategoriKas::Maintenance, 'Paku 1,5 inch (5 kg)', 110_000],
        ['2026-09-05', KategoriKas::Maintenance, 'Paku 2,5 inch (5 kg)', 110_000],
        ['2026-09-05', KategoriKas::Maintenance, 'Martil (1)', 50_000],
        ['2026-09-05', KategoriKas::Transport, 'Ongkos kirim kayu (1)', 300_000],
        ['2026-09-05', KategoriKas::Maintenance, 'Cat hitam 10 kaleng (10)', 900_000],
        ['2026-09-05', KategoriKas::Maintenance, 'Thinner (10)', 400_000],
        ['2026-09-05', KategoriKas::Maintenance, 'Kayu', 3_862_000],
        ['2026-09-06', KategoriKas::Maintenance, 'Cat hitam 10 kaleng (10)', 900_000],
        ['2026-09-06', KategoriKas::Maintenance, 'Thinner 2 kaleng (2)', 390_000],
        ['2026-09-07', KategoriKas::Maintenance, 'Cat minyak 8 kaleng', 760_000],
        ['2026-09-07', KategoriKas::Maintenance, 'Cat minyak 22 kaleng', 1_980_000],
        ['2026-09-07', KategoriKas::Maintenance, 'Thinner 2 kaleng', 390_000],
        ['2026-09-08', KategoriKas::Maintenance, 'Cat minyak 8 kaleng', 720_000],
        ['2026-09-08', KategoriKas::Maintenance, 'Thinner 2 kaleng', 390_000],
        ['2026-09-08', KategoriKas::MakanMinum, 'Air minum (8)', 48_000],
        ['2026-09-08', KategoriKas::Upah, 'Upah tukang listrik', 300_000],
        ['2026-09-08', KategoriKas::Maintenance, 'Kabel NYM (10 m)', 210_000],
        ['2026-09-08', KategoriKas::Maintenance, 'Gas untuk fogging (5)', 150_000],
        ['2026-09-09', KategoriKas::Gas, 'Gas 3 kg (70)', 1_680_000],
        ['2026-09-10', KategoriKas::Maintenance, 'Sarung tangan karet (10)', 200_000],
        ['2026-09-10', KategoriKas::Upah, 'Upah supir DOC', 100_000],
        ['2026-09-10', KategoriKas::GajiKaryawan, 'Upah tukang masak', 1_000_000],
        ['2026-09-12', KategoriKas::Gas, 'Gas 3 kg (70)', 1_680_000],
        ['2026-09-12', KategoriKas::Solar, 'Solar (5)', 1_500_000],
        ['2026-09-12', KategoriKas::MakanMinum, 'Air minum', 42_000],
        ['2026-09-12', KategoriKas::Maintenance, 'Tali tambang (1 gulung)', 45_000],
        ['2026-09-12', KategoriKas::Maintenance, 'Saklar mesin air', 40_000],
        ['2026-09-12', KategoriKas::PinjamanAbk, 'Pinjaman Rohim', 100_000],
        ['2026-09-12', KategoriKas::MakanMinum, 'Kopi ABK', 400_000],
        ['2026-09-12', KategoriKas::Maintenance, 'Cas untuk bor baterai', 250_000],
        ['2026-09-12', KategoriKas::Maintenance, 'Mesin bor', 700_000],
        ['2026-09-12', KategoriKas::Maintenance, 'Mesin sprayer cat', 450_000],
        ['2026-09-12', KategoriKas::Transport, 'Ongkos kirim mesin bor', 40_000],
        ['2026-09-12', KategoriKas::Transport, 'Ongkos kirim sprayer cat', 40_000],
        ['2026-09-12', KategoriKas::Maintenance, 'Desinfektan fogging', 625_000],
        ['2026-09-12', KategoriKas::Maintenance, 'Alat fogging', 925_000],
        ['2026-09-17', KategoriKas::Maintenance, 'Racun lalat (1 kotak)', 940_000],
        ['2026-09-17', KategoriKas::Upah, 'Upah tukang listrik', 100_000],
        ['2026-09-17', KategoriKas::Upah, 'Upah orang PLN', 100_000],
        ['2026-09-18', KategoriKas::Upah, 'Upah supir pakan', 100_000],
        ['2026-09-18', KategoriKas::Gas, 'Gas 3 kg', 1_680_000],
        ['2026-09-18', KategoriKas::Solar, 'Solar (2 jerigen)', 600_000],
        ['2026-09-18', KategoriKas::PinjamanAbk, 'Pinjaman Rohim', 50_000],
        ['2026-09-19', KategoriKas::Maintenance, 'Perbaiki supra', 180_000],
        ['2026-09-20', KategoriKas::PinjamanAbk, 'Pinjaman Frengky', 120_000],
        ['2026-09-22', KategoriKas::PinjamanAbk, 'Pinjaman Rohim', 100_000],
        ['2026-09-22', KategoriKas::Listrik, 'PLN September', 10_996_000],
        ['2026-09-22', KategoriKas::PinjamanAbk, 'Pinjaman Juni', 100_000],
        ['2026-09-23', KategoriKas::MakanMinum, 'Air minum (9)', 54_000],
        ['2026-09-23', KategoriKas::MakanMinum, 'Pudding ABK', 125_000],
        ['2026-09-25', KategoriKas::GajiKaryawan, 'Gaji Rohim', 1_750_000],
        ['2026-09-25', KategoriKas::Maintenance, 'Lahar angkong (5)', 50_000],
        ['2026-09-25', KategoriKas::PinjamanAbk, 'Pinjaman Frengky', 120_000],
        ['2026-09-28', KategoriKas::Berobat, 'Berobat Tama', 100_000],
        ['2026-09-28', KategoriKas::Berobat, 'Berobat Frengky', 170_000],
        ['2026-10-03', KategoriKas::PinjamanAbk, 'Pinjaman Frengky', 450_000],
        ['2026-10-04', KategoriKas::PinjamanAbk, 'Pinjaman Frengky', 120_000],
        ['2026-10-07', KategoriKas::GajiKaryawan, 'Gaji tukang masak', 1_000_000],
        ['2026-10-07', KategoriKas::Upah, 'Upah pengurangan 3 orang', 300_000],
        ['2026-10-07', KategoriKas::MakanMinum, 'Air minum (9)', 54_000],
        ['2026-10-07', KategoriKas::PinjamanAbk, 'Pinjaman Rohim', 200_000],
        ['2026-10-07', KategoriKas::Maintenance, 'Sarung tangan panen', 110_000],
        ['2026-10-07', KategoriKas::Maintenance, 'Lampu 50 watt (2 pcs)', 200_000],
        ['2026-10-07', KategoriKas::Maintenance, 'Tali plastik', 80_000],
        ['2026-10-07', KategoriKas::Maintenance, 'Biodes (4 botol)', 400_000],
        ['2026-10-07', KategoriKas::Maintenance, 'Phycurma (2 botol)', 500_000],
    ];

    /**
     * @var array<string, list<string>>
     */
    private const URAIAN_LAMA = [
        'Paku 1,5 inch (5 kg)' => ['Paku 1,5 inch'],
        'Paku 2,5 inch (5 kg)' => ['Paku 2,5 inch'],
        'Martil (1)' => ['Martil'],
        'Ongkos kirim kayu (1)' => ['Ongkos Kirim Kayu'],
    ];

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $periode = Periode::where('nama', 'Periode September 2026')->firstOrFail();
        $kandang = Kandang::where('nama', 'Kandang 2')->firstOrFail();
        $periodeKandang = PeriodeKandang::where([
            'periode_id' => $periode->id,
            'kandang_id' => $kandang->id,
        ])->firstOrFail();

        $totalDana = array_sum(array_column(self::DANA, 1));
        $totalKeluar = array_sum(array_column(self::KELUAR, 3));
        if ($totalDana !== 43_862_000 || $totalKeluar !== 42_636_000) {
            throw new RuntimeException('Total transaksi laporan kas September tidak cocok dengan ringkasan PDF.');
        }

        DB::transaction(function () use ($periodeKandang): void {
            foreach (self::DANA as [$tanggal, $jumlah]) {
                $this->simpanJikaBelumAda($periodeKandang, $tanggal, KategoriKas::DanaOperasional, 'Uang Masuk', $jumlah);
            }

            foreach (self::KELUAR as [$tanggal, $kategori, $uraian, $jumlah]) {
                $this->simpanJikaBelumAda($periodeKandang, $tanggal, $kategori, $uraian, $jumlah);
            }
        });
    }

    private function simpanJikaBelumAda(
        PeriodeKandang $periodeKandang,
        string $tanggal,
        KategoriKas $kategori,
        string $uraian,
        int $jumlah,
    ): void {
        $uraians = [$uraian, ...(self::URAIAN_LAMA[$uraian] ?? [])];
        $transaksi = $periodeKandang->transaksiKas()
            ->whereDate('tanggal', $tanggal)
            ->where('kategori', $kategori->value)
            ->where('jumlah', $jumlah)
            ->whereIn('uraian', $uraians)
            ->first();

        if ($transaksi) {
            if ($transaksi->uraian !== $uraian) {
                $transaksi->update(['uraian' => $uraian]);
            }

            return;
        }

        $periodeKandang->transaksiKas()->create([
            'tanggal' => $tanggal,
            'kategori' => $kategori,
            'uraian' => $uraian,
            'jumlah' => $jumlah,
        ]);
    }
}
