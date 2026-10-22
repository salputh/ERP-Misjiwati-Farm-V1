<?php

namespace Database\Seeders;

use App\Enums\KategoriKas;
use App\Models\Kandang;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class KasOperasionalSeptemberKandangSatuSeeder extends Seeder
{
    /**
     * Riwayat dana operasional. Baris tanpa tanggal di PDF disesuaikan dengan tanggal pembayaran DP,
     * dan ditetapkan ke tanggal 2 September.
     *
     * @var list<array{string, int}>
     */
    private const DANA = [
        ['2026-09-03', 19_484_750],
        ['2026-09-04', 10_000_000],
        ['2026-09-05', 2_815_000],
        ['2026-09-10', 10_000_000],
        ['2026-09-02', 20_466_000],
        ['2026-09-16', 595_000],
        ['2026-09-16', 1_700_000],
        ['2026-09-22', 10_000_000],
        ['2026-10-03', 10_000_000],
    ];

    /**
     * Buku besar laporan kas Kandang 1: [tanggal, kategori, uraian, jumlah (Rp)].
     *
     * @var list<array{string, KategoriKas, string, int}>
     */
    private const KELUAR = [
        ['2026-08-29', KategoriKas::Maintenance, 'Besi meja shawmill', 984_000],
        ['2026-08-29', KategoriKas::Maintenance, 'Pulley mesin shawmill 6 inch', 70_000],
        ['2026-08-29', KategoriKas::Maintenance, 'Pulley 4 inch', 45_000],
        ['2026-08-29', KategoriKas::Maintenance, 'Belting', 35_000],
        ['2026-08-29', KategoriKas::Maintenance, 'Oli kotor (10)', 100_000],
        ['2026-09-01', KategoriKas::Maintenance, 'Bubut pulley shawmill', 200_000],
        ['2026-09-01', KategoriKas::Maintenance, 'Belting shawmill (2)', 90_000],
        ['2026-09-02', KategoriKas::Maintenance, 'Bayar DP orderan barang', 20_466_000],
        ['2026-09-03', KategoriKas::Upah, 'Upah tukang las buat mesin shawmill', 720_000],
        ['2026-09-03', KategoriKas::Maintenance, 'Pembelian kayu', 19_484_750],
        ['2026-09-03', KategoriKas::Maintenance, 'Semen (10)', 700_000],
        ['2026-09-03', KategoriKas::Maintenance, 'Mesin circular 12x40', 450_000],
        ['2026-09-03', KategoriKas::Maintenance, 'Meteran 7,5 mtr', 30_000],
        ['2026-09-03', KategoriKas::Maintenance, 'Mesin ketam modren', 495_000],
        ['2026-09-03', KategoriKas::Maintenance, 'Mesin bor bs nachi', 135_000],
        ['2026-09-03', KategoriKas::Maintenance, 'Kikir gergaji (2)', 30_000],
        ['2026-09-03', KategoriKas::Maintenance, 'Kawat licin 16', 675_000],
        ['2026-09-03', KategoriKas::Transport, 'Ongkos kirim material', 300_000],
        ['2026-09-05', KategoriKas::PinjamanMakan, 'Uang makan 6 orang (6)', 1_470_000],
        ['2026-09-05', KategoriKas::PinjamanKaryawan, 'Pinjaman Angga (HP)', 1_600_000],
        ['2026-09-12', KategoriKas::PinjamanMakan, 'Uang makan 6 orang', 1_550_000],
        ['2026-09-13', KategoriKas::Transport, 'Ongkos supir bawa kayu', 200_000],
        ['2026-09-13', KategoriKas::Transport, 'Ongkos kirim kayu', 400_000],
        ['2026-09-13', KategoriKas::Transport, 'Gaji tukang masak', 650_000],
        ['2026-09-13', KategoriKas::GajiKaryawan, 'Gaji tukang (Dani)', 1_500_000],
        ['2026-09-13', KategoriKas::Transport, 'Uang jalan Dani dan Wahyu ke Cikampak', 250_000],
        ['2026-09-13', KategoriKas::MakanMinum, 'Air minum (9)', 54_000],
        ['2026-09-14', KategoriKas::Maintenance, 'Belting shawmill (beli Medan)', 180_000],
        ['2026-09-14', KategoriKas::Maintenance, 'Ongkos kirim belting', 30_000],
        ['2026-09-14', KategoriKas::Maintenance, 'Mata potong mesin kayu', 620_000],
        ['2026-09-14', KategoriKas::Maintenance, 'Ongkos kirim mata potong kayu', 40_000],
        ['2026-09-14', KategoriKas::Maintenance, 'Alat ukur RPM', 180_000],
        ['2026-09-14', KategoriKas::Listrik, 'Token listrik', 1_000_000],
        ['2026-09-14', KategoriKas::Maintenance, 'Ongkos kirim alat RPM', 40_000],
        ['2026-09-15', KategoriKas::Maintenance, 'Selasiban hitam (10 pcs)', 100_000],
        ['2026-09-16', KategoriKas::Maintenance, 'Paku 3 inchi (2 kotak)', 550_000],
        ['2026-09-16', KategoriKas::Maintenance, 'Paku 2,5 inchi (2 kotak)', 550_000],
        ['2026-09-16', KategoriKas::Maintenance, 'Paku 2 inchi (1 kotak)', 275_000],
        ['2026-09-16', KategoriKas::Maintenance, 'Lahar angkong (2 pcs)', 50_000],
        ['2026-09-17', KategoriKas::Maintenance, 'Baut (15 buah)', 75_000],
        ['2026-09-18', KategoriKas::Maintenance, 'Benang nilon (5 pcs)', 50_000],
        ['2026-09-18', KategoriKas::Maintenance, 'Meteran (2 pcs)', 80_000],
        ['2026-09-18', KategoriKas::Maintenance, 'Mesin potong kayu', 887_000],
        ['2026-09-18', KategoriKas::Maintenance, 'Mata potong mesin potong kayu', 297_000],
        ['2026-09-18', KategoriKas::PinjamanMakan, 'Uang makan 6 orang', 1_600_000],
        ['2026-09-19', KategoriKas::GajiKaryawan, 'Gaji tukang (Dani)', 1_500_000],
        ['2026-09-19', KategoriKas::Starlink, 'Starlink', 800_000],
        ['2026-09-19', KategoriKas::Maintenance, 'Ongkos kirim mesin potong kayu', 60_000],
        ['2026-09-19', KategoriKas::Maintenance, 'Pembayaran tali pancing', 595_000],
        ['2026-09-19', KategoriKas::Maintenance, 'Pembayaran tali pancing', 1_700_000],
        ['2026-09-19', KategoriKas::PinjamanKaryawan, 'Pinjaman Angga', 200_000],
        ['2026-09-20', KategoriKas::Listrik, 'PLN September', 8_333_000],
        ['2026-09-23', KategoriKas::Maintenance, 'Paku 3 inchi (2 kotak)', 550_000],
        ['2026-09-23', KategoriKas::Maintenance, 'Paku 2,5 inchi (2 kotak)', 550_000],
        ['2026-09-23', KategoriKas::Maintenance, 'Paku 1,5 inchi (2 kotak)', 550_000],
        ['2026-09-23', KategoriKas::Maintenance, 'Paku GRC (2 kotak)', 550_000],
        ['2026-09-23', KategoriKas::Maintenance, 'Mata potong mesin potong kayu', 250_000],
        ['2026-09-25', KategoriKas::PinjamanKaryawan, 'Pinjaman Angga', 500_000],
        ['2026-09-25', KategoriKas::Berobat, 'Berobat Wahyu', 100_000],
        ['2026-09-25', KategoriKas::Berobat, 'Berobat Rohim', 100_000],
        ['2026-09-26', KategoriKas::MakanMinum, 'Air minum (9)', 54_000],
        ['2026-09-26', KategoriKas::MakanMinum, 'Pudding tukang dan ABK', 175_000],
        ['2026-09-27', KategoriKas::PinjamanMakan, 'Uang makan 7 orang', 1_850_000],
        ['2026-09-27', KategoriKas::GajiKaryawan, 'Gaji tukang (Dani)', 1_500_000],
        ['2026-09-27', KategoriKas::Berobat, 'Berobat Rohim', 80_000],
        ['2026-09-27', KategoriKas::Berobat, 'Berobat Tofa', 80_000],
        ['2026-09-27', KategoriKas::Berobat, 'Berobat Angga', 180_000],
        ['2026-09-27', KategoriKas::Berobat, 'Berobat Juni', 170_000],
        ['2026-09-29', KategoriKas::Maintenance, 'Paku 2,5 inchi (2 kotak)', 550_000],
        ['2026-10-02', KategoriKas::Maintenance, 'Paku GRC (2 kotak)', 550_000],
        ['2026-10-02', KategoriKas::Maintenance, 'Kawat (1 roll)', 570_000],
        ['2026-10-02', KategoriKas::Maintenance, 'Paku 1,5 inchi (2 kotak)', 550_000],
        ['2026-10-02', KategoriKas::Maintenance, 'Paku 2 inchi (1 kotak)', 275_000],
        ['2026-10-03', KategoriKas::GajiKaryawan, 'Gaji tukang (Dani)', 1_500_000],
        ['2026-10-03', KategoriKas::GajiKaryawan, 'Gaji tukang (Ali)', 1_440_000],
        ['2026-10-03', KategoriKas::PinjamanMakan, 'Uang makan 8 orang', 2_100_000],
        ['2026-10-07', KategoriKas::GajiKaryawan, 'Gaji tukang masak', 1_000_000],
        ['2026-10-07', KategoriKas::Listrik, 'Token listrik', 1_500_000],
        ['2026-10-07', KategoriKas::MakanMinum, 'Air minum (9)', 54_000],
        ['2026-10-07', KategoriKas::Maintenance, 'Tali pengencang slat (4 pcs)', 600_000],
        ['2026-10-07', KategoriKas::Maintenance, 'Lampu jalan tenaga surya (5 pcs)', 1_500_000],
        ['2026-10-07', KategoriKas::PinjamanKaryawan, 'Pinjaman Rifi', 200_000],
        ['2026-10-10', KategoriKas::GajiKaryawan, 'Gaji tukang (Dani)', 1_500_000],
        ['2026-10-10', KategoriKas::GajiKaryawan, 'Gaji tukang (Ali)', 1_120_000],
        ['2026-10-10', KategoriKas::GajiKaryawan, 'Gaji tukang (Dimas)', 840_000],
        ['2026-10-10', KategoriKas::PinjamanMakan, 'Uang makan 8 orang', 2_100_000],
    ];

    /**
     * @var array<string, int>
     */
    private const KATEGORI_PENGELUARAN = [
        'berobat' => 710_000,
        'gaji-karyawan' => 11_900_000,
        'listrik' => 10_833_000,
        'maintenance' => 57_393_750,
        'makan-minum' => 337_000,
        'pinjaman-karyawan' => 2_500_000,
        'pinjaman-makan' => 10_670_000,
        'starlink' => 800_000,
        'transport' => 1_800_000,
        'upah' => 720_000,
    ];

    public function run(): void
    {
        $periode = Periode::where('nama', 'Periode September 2026')->firstOrFail();
        $kandang = Kandang::where('nama', 'Kandang 1')->firstOrFail();
        $periodeKandang = PeriodeKandang::firstOrCreate(
            ['periode_id' => $periode->id, 'kandang_id' => $kandang->id],
            ['populasi_awal' => 0],
        );

        $totalDana = array_sum(array_column(self::DANA, 1));
        $totalPengeluaran = array_sum(array_column(self::KELUAR, 3));
        $totalPerKategori = collect(self::KELUAR)
            ->groupBy(fn (array $baris): string => $baris[1]->value)
            ->map(fn ($baris): int => (int) $baris->sum(fn (array $transaksi): int => $transaksi[3]))
            ->sortKeys()
            ->all();
        $kategoriDiharapkan = self::KATEGORI_PENGELUARAN;
        ksort($kategoriDiharapkan);

        if (
            $totalDana !== 85_060_750
            || $totalPengeluaran !== 97_663_750
            || count(self::KELUAR) !== 86
            || $totalPerKategori !== $kategoriDiharapkan
        ) {
            throw new RuntimeException('Total transaksi laporan kas September Kandang 1 tidak cocok dengan rincian PDF.');
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
        $transaksi = $periodeKandang->transaksiKas()
            ->whereDate('tanggal', $tanggal)
            ->where('kategori', $kategori->value)
            ->where('jumlah', $jumlah)
            ->where('uraian', $uraian)
            ->first();

        if ($transaksi) {
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
