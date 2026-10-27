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
     * Riwayat dana operasional (Kandang 1, periode September 2026) dari "Operasional Kandang 1.pdf".
     *
     * @var list<array{string, int}>
     */
    private const DANA = [
        ['2026-09-03', 19484750],
        ['2026-09-04', 10000000],
        ['2026-09-05', 2815000],
        ['2026-09-10', 10000000],
        ['2026-09-02', 20466000],
        ['2026-09-16', 595000],
        ['2026-09-16', 1700000],
        ['2026-09-22', 10000000],
        ['2026-10-03', 10000000],
        ['2026-10-14', 10000000],
    ];

    /**
     * Buku besar laporan kas Kandang 1: [tanggal, kategori, uraian, jumlah (Rp)].
     *
     * @var list<array{string, KategoriKas, string, int}>
     */
    private const KELUAR = [
        ['2026-08-29', KategoriKas::Maintenance, 'Besi meja shawmill', 984000],
        ['2026-08-29', KategoriKas::Maintenance, 'Pulley mesin shawmill 6 inch', 70000],
        ['2026-08-29', KategoriKas::Maintenance, 'Pulley 4 inch', 45000],
        ['2026-08-29', KategoriKas::Maintenance, 'Belting', 35000],
        ['2026-08-29', KategoriKas::Maintenance, 'Oli kotor', 100000],
        ['2026-09-01', KategoriKas::Maintenance, 'Bubut pulley shawmill', 200000],
        ['2026-09-01', KategoriKas::Maintenance, 'Belting shawmill', 90000],
        ['2026-09-02', KategoriKas::Maintenance, 'Bayar DP Orderan Barang', 20466000],
        ['2026-09-03', KategoriKas::Upah, 'Upah tukang las buat mesin shawmill', 720000],
        ['2026-09-03', KategoriKas::Maintenance, 'Pembelian Kayu', 19484750],
        ['2026-09-03', KategoriKas::Maintenance, 'Semen', 700000],
        ['2026-09-03', KategoriKas::Maintenance, 'Mesin circular 12x40', 450000],
        ['2026-09-03', KategoriKas::Maintenance, 'Meteran 7,5 mtr', 30000],
        ['2026-09-03', KategoriKas::Maintenance, 'Mesin ketam modren', 495000],
        ['2026-09-03', KategoriKas::Maintenance, 'Mesin bor bs nachi', 135000],
        ['2026-09-03', KategoriKas::Maintenance, 'Kikir gergaji', 30000],
        ['2026-09-03', KategoriKas::Maintenance, 'Kawat licin 16', 675000],
        ['2026-09-03', KategoriKas::Transport, 'Ongkos kirim material', 300000],
        ['2026-09-05', KategoriKas::PinjamanMakan, 'Uang makan 6 orang', 1470000],
        ['2026-09-05', KategoriKas::PinjamanKaryawan, 'Pinjaman Angga (HP)', 1600000],
        ['2026-09-12', KategoriKas::PinjamanMakan, 'Uang makan 6 orang', 1550000],
        ['2026-09-13', KategoriKas::Transport, 'Ongkos supir bawa kayu', 200000],
        ['2026-09-13', KategoriKas::Transport, 'Ongkos kirim kayu', 400000],
        ['2026-09-13', KategoriKas::Transport, 'Gaji tukang masak', 650000],
        ['2026-09-13', KategoriKas::GajiKaryawan, 'Gaji tukang ( dani )', 1500000],
        ['2026-09-13', KategoriKas::Transport, 'Uang jalan dani dan wahyu ke cikampak', 250000],
        ['2026-09-13', KategoriKas::MakanMinum, 'Air minum 9', 54000],
        ['2026-09-14', KategoriKas::Maintenance, 'Belting Shawmill (beli medan)', 180000],
        ['2026-09-14', KategoriKas::Maintenance, 'Ongkos kirim belting', 30000],
        ['2026-09-14', KategoriKas::Maintenance, 'Mata potong mesin kayu', 620000],
        ['2026-09-14', KategoriKas::Maintenance, 'Ongkos kirim mata potong kayu', 40000],
        ['2026-09-14', KategoriKas::Maintenance, 'Alat ukur RPM', 180000],
        ['2026-09-14', KategoriKas::Listrik, 'Token listrik', 1000000],
        ['2026-09-14', KategoriKas::Maintenance, 'Ongkos kirim alat rpm', 40000],
        ['2026-09-15', KategoriKas::Maintenance, 'Selasiban hitam 10 pcs', 100000],
        ['2026-09-16', KategoriKas::Maintenance, 'Paku 3 inchi 2 kotak', 550000],
        ['2026-09-16', KategoriKas::Maintenance, 'Paku 2,5 inchi 2 kotak', 550000],
        ['2026-09-16', KategoriKas::Maintenance, 'Paku 2 inchi 1 kotak', 275000],
        ['2026-09-16', KategoriKas::Maintenance, 'Lahar angkong 2 pcs', 50000],
        ['2026-09-17', KategoriKas::Maintenance, 'Baut 15 buah', 75000],
        ['2026-09-18', KategoriKas::Maintenance, 'Benang nilon 5 pcs', 50000],
        ['2026-09-18', KategoriKas::Maintenance, 'Meteran 2 pcs', 80000],
        ['2026-09-18', KategoriKas::Maintenance, 'Mesin potong kayu', 887000],
        ['2026-09-18', KategoriKas::Maintenance, 'Mata potong mesin potong kayu', 297000],
        ['2026-09-18', KategoriKas::PinjamanMakan, 'Uang makan 6 orang', 1600000],
        ['2026-09-19', KategoriKas::GajiKaryawan, 'Gaji tukang ( dani )', 1500000],
        ['2026-09-19', KategoriKas::Starlink, 'Starlink', 800000],
        ['2026-09-19', KategoriKas::Maintenance, 'Onngkos kirim mesin potong kayu', 60000],
        ['2026-09-19', KategoriKas::Maintenance, 'Pembayaran tali pancing', 595000],
        ['2026-09-19', KategoriKas::Maintenance, 'Pembayaran tali pancing', 1700000],
        ['2026-09-19', KategoriKas::PinjamanKaryawan, 'Pinjaman Angga', 200000],
        ['2026-09-20', KategoriKas::Listrik, 'PLN september', 8333000],
        ['2026-09-23', KategoriKas::Maintenance, 'Paku 3 inchi 2 kotak', 550000],
        ['2026-09-23', KategoriKas::Maintenance, 'Paku 2,5 inchi 2 kotak', 550000],
        ['2026-09-23', KategoriKas::Maintenance, 'Paku 1,5 inchi 2 kotak', 550000],
        ['2026-09-23', KategoriKas::Maintenance, 'Paku grc 2 kotak', 550000],
        ['2026-09-23', KategoriKas::Maintenance, 'Mata potong mesin potong kayu', 250000],
        ['2026-09-25', KategoriKas::PinjamanKaryawan, 'Pinjaman Angga', 500000],
        ['2026-09-25', KategoriKas::Berobat, 'Berobat wahyu', 100000],
        ['2026-09-25', KategoriKas::Berobat, 'Berobat rohim', 100000],
        ['2026-09-26', KategoriKas::MakanMinum, 'Air minum 9', 54000],
        ['2026-09-26', KategoriKas::MakanMinum, 'Pudding tukang dan abk', 175000],
        ['2026-09-27', KategoriKas::PinjamanMakan, 'Uang Makan 7 orang', 1850000],
        ['2026-09-27', KategoriKas::GajiKaryawan, 'Gaji tukang ( dani )', 1500000],
        ['2026-09-27', KategoriKas::Berobat, 'Berobat rohim', 80000],
        ['2026-09-27', KategoriKas::Berobat, 'Brobat tofa', 80000],
        ['2026-09-27', KategoriKas::Berobat, 'Berobat angga', 180000],
        ['2026-09-27', KategoriKas::Berobat, 'Berobat juni', 170000],
        ['2026-09-29', KategoriKas::Maintenance, 'Paku 2,5 inchi 2 kotak', 550000],
        ['2026-10-02', KategoriKas::Maintenance, 'Paku grc 2 kotak', 550000],
        ['2026-10-02', KategoriKas::Maintenance, 'Kawat 1 roll', 570000],
        ['2026-10-02', KategoriKas::Maintenance, 'Paku 1,5 inchi 2 kotak', 550000],
        ['2026-10-02', KategoriKas::Maintenance, 'Paku 2 inchi 1 kotak', 275000],
        ['2026-10-03', KategoriKas::GajiKaryawan, 'Gaji tukang ( dani )', 1500000],
        ['2026-10-03', KategoriKas::GajiKaryawan, 'Gaji tukang (Ali)', 1440000],
        ['2026-10-03', KategoriKas::PinjamanMakan, 'Uang Makan 8 orang', 2100000],
        ['2026-10-07', KategoriKas::GajiKaryawan, 'Gaji tukang masak', 1000000],
        ['2026-10-07', KategoriKas::Listrik, 'Token Listrik', 1500000],
        ['2026-10-07', KategoriKas::MakanMinum, 'Air minum 9', 54000],
        ['2026-10-07', KategoriKas::Maintenance, 'Tali pengencang slat 4 pcs', 600000],
        ['2026-10-07', KategoriKas::Maintenance, 'Lampu jalan tenaga surya 5 pcs', 1500000],
        ['2026-10-07', KategoriKas::PinjamanKaryawan, 'Pinjaman rifi', 200000],
        ['2026-10-10', KategoriKas::GajiKaryawan, 'Gaji tukang ( dani )', 1500000],
        ['2026-10-10', KategoriKas::GajiKaryawan, 'Gaji tukang (Ali)', 1120000],
        ['2026-10-10', KategoriKas::GajiKaryawan, 'Gaji tukang (dimas)', 840000],
        ['2026-10-10', KategoriKas::PinjamanMakan, 'Uang Makan 8 orang', 2100000],
        ['2026-10-13', KategoriKas::Maintenance, 'Tang 3 buah', 150000],
        ['2026-10-13', KategoriKas::Maintenance, 'Cutter', 25000],
        ['2026-10-13', KategoriKas::PinjamanKaryawan, 'Pinjaman rifi', 200000],
        ['2026-10-14', KategoriKas::Maintenance, 'Staples 3 pcs', 450000],
        ['2026-10-14', KategoriKas::Maintenance, 'Anak staples 3 kotak', 90000],
        ['2026-10-17', KategoriKas::GajiKaryawan, 'Gaji tukang ( dani )', 1000000],
        ['2026-10-17', KategoriKas::GajiKaryawan, 'Gaji tukang (Ali)', 1120000],
        ['2026-10-17', KategoriKas::GajiKaryawan, 'Gaji tukang (dimas)', 840000],
        ['2026-10-17', KategoriKas::Berobat, 'Kusuk angga', 100000],
        ['2026-10-18', KategoriKas::Berobat, 'Kusuk angga', 100000],
        ['2026-10-18', KategoriKas::Maintenance, 'Colokan 2 lobang 40pcs', 480000],
        ['2026-10-18', KategoriKas::Maintenance, 'Baut skrup 1 kotak', 50000],
        ['2026-10-18', KategoriKas::Maintenance, 'Lakban 10 pcs', 70000],
        ['2026-10-18', KategoriKas::Maintenance, 'Tedos listrik 20pcs', 90000],
        ['2026-10-18', KategoriKas::Maintenance, 'Pipa listrik 70 btg', 490000],
        ['2026-10-18', KategoriKas::Maintenance, 'Paku klem 3 bks', 180000],
        ['2026-10-18', KategoriKas::Maintenance, 'Elbow pipa listrik 1 bks', 60000],
        ['2026-10-18', KategoriKas::Maintenance, 'Kabel NYA 6 roll', 2370000],
        ['2026-10-18', KategoriKas::Upah, 'Upah tukang listrik', 500000],
        ['2026-10-18', KategoriKas::PinjamanMakan, 'Uang Makan 8 orang', 2100000],
        ['2026-10-18', KategoriKas::Maintenance, 'Kawat untu terpal dan sekat', 1615000],
        ['2026-10-18', KategoriKas::Transport, 'Ongkos kirim kawat', 60000],
        ['2026-10-18', KategoriKas::PinjamanKaryawan, 'Pinjaman angga', 300000],
        ['2026-10-18', KategoriKas::Maintenance, 'Paku grc 1 kotak', 250000],
        ['2026-10-19', KategoriKas::Maintenance, 'Staples 2 pcs', 300000],
        ['2026-10-19', KategoriKas::Maintenance, 'Anak staples 3 kotak', 90000],
        ['2026-10-19', KategoriKas::Maintenance, 'Buat dudukan handwitch', 350000],
        ['2026-10-19', KategoriKas::Listrik, 'PLN oktober', 1540000],
        ['2026-10-19', KategoriKas::Upah, 'Upah AbK kd 2 bantu kd 1 2,5 hari', 510000],
        ['2026-10-20', KategoriKas::Upah, 'Upah tukang listrik', 300000],
        ['2026-10-20', KategoriKas::Maintenance, 'Paku 2 inchi 2 kotak', 450000],
    ];

    /**
     * @var array<string, int>
     */
    private const KATEGORI_PENGELUARAN = [
        'berobat' => 910000,
        'gaji-karyawan' => 14860000,
        'listrik' => 12373000,
        'maintenance' => 64953750,
        'makan-minum' => 337000,
        'pinjaman-karyawan' => 3000000,
        'pinjaman-makan' => 12770000,
        'starlink' => 800000,
        'transport' => 1860000,
        'upah' => 2030000,
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
            $totalDana !== 95_060_750
            || $totalPengeluaran !== 113_893_750
            || count(self::KELUAR) !== 117
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
